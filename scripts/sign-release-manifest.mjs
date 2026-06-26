#!/usr/bin/env node
/**
 * sign-release-manifest.mjs — Gate 16 of the modelverifier.ai build pipeline.
 *
 * Generates a JSON release manifest capturing:
 *   release_date     — ISO date of this build run
 *   schema_version   — version from model-controls.schema.json
 *   control_count    — total controls across all layers
 *   layer_counts     — per-layer control breakdown
 *   baseline_controls — list of the 15 required baseline controls
 *   source_versions  — deduplicated map of source_id → {version, artifact_hash, status}
 *   build_hash       — SHA-256 of the integration/controls.json artifact (if it exists)
 *   profiles         — profile IDs and required control counts
 *   integrity        — signing metadata (key fingerprint or TODO stub)
 *
 * Signing:
 *   If MANIFEST_SIGNING_KEY is set to a 64-char hex string, the manifest is
 *   HMAC-SHA-256 signed and the signature is written to manifest.sig.
 *   If MANIFEST_SIGNING_KEY is absent, the manifest is written with
 *   integrity.signed: false and a TODO note for operators.
 *
 * Output:
 *   integration/release-manifest.json   — the manifest (always written)
 *   integration/release-manifest.sig    — HMAC-SHA-256 signature (when key available)
 *
 * Environment variables:
 *   MANIFEST_SIGNING_KEY  — 64-char hex key for HMAC-SHA-256. Keep in CI secrets.
 *   MANIFEST_REF_DATE     — YYYY-MM-DD date override for deterministic test runs.
 *
 * Exit codes:
 *   0  manifest written successfully
 *   1  fatal error (parse failure, missing integration artifact, I/O error)
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac } from 'node:crypto';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const DOMAIN_ROOT  = resolve(__dirname, '..');
const CONTROLS_DIR = join(DOMAIN_ROOT, 'controls');
const SCHEMA_DIR   = join(DOMAIN_ROOT, 'schema');
const INTEGRATION_DIR = join(DOMAIN_ROOT, 'integration');

const SCHEMA_PATH         = join(SCHEMA_DIR, 'model-controls.schema.json');
const PROFILES_PATH       = join(SCHEMA_DIR, 'profiles.json');
const INTEGRATION_JSON    = join(INTEGRATION_DIR, 'controls.json');
const MANIFEST_OUT        = join(INTEGRATION_DIR, 'release-manifest.json');
const MANIFEST_SIG_OUT    = join(INTEGRATION_DIR, 'release-manifest.sig');

const SCHEMA_VERSION = '1.0.0'; // from model-controls.schema.json meta.schema_version const

const BASELINE_CONTROLS = [
  'LI-01', 'LI-04', 'LI-06',
  'TG-01', 'TG-05',
  'EV-01', 'EV-06', 'EV-07', 'EV-09',
  'OA-01', 'OA-07',
  'BH-03', 'BH-05',
  'CR-01', 'CR-02',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256hex(key, data) {
  const keyBuf = Buffer.from(key, 'hex');
  return createHmac('sha256', keyBuf).update(data).digest('hex');
}

function loadJSON(path, label) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse ${label} at ${path}: ${e.message}`);
    process.exit(1);
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function refDate() {
  const env = process.env.MANIFEST_REF_DATE;
  if (env) {
    if (!DATE_RE.test(env)) {
      console.error(`MANIFEST_REF_DATE='${env}' is not a valid YYYY-MM-DD date`);
      process.exit(1);
    }
    return env;
  }
  return new Date().toISOString().slice(0, 10);
}

// ─── Load controls ────────────────────────────────────────────────────────────

function loadAllControls() {
  const controls = [];
  let files;
  try {
    files = readdirSync(CONTROLS_DIR).filter(f => f.endsWith('.json')).sort();
  } catch (e) {
    console.error(`Cannot read controls directory '${CONTROLS_DIR}': ${e.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`No control files found in '${CONTROLS_DIR}'`);
    process.exit(1);
  }

  for (const file of files) {
    const path = join(CONTROLS_DIR, file);
    let data;
    try {
      data = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      console.error(`JSON parse failure for ${file}: ${e.message}`);
      process.exit(1);
    }
    if (!Array.isArray(data)) {
      console.error(`${file}: root must be an array of control objects`);
      process.exit(1);
    }
    for (const ctrl of data) {
      if (typeof ctrl === 'object' && ctrl !== null) {
        controls.push({ ...ctrl, _file: file });
      }
    }
  }
  return controls;
}

// ─── Collect source versions ───────────────────────────────────────────────────

/**
 * Deduplicate sources across all controls.
 * Returns a map of source_id → { version, artifact_hash, status, title, authority, source_type, retrieved_on }.
 * When the same source_id appears with different versions across controls,
 * both are recorded under the same key with a conflict flag.
 */
function collectSourceVersions(controls) {
  const map = new Map();

  for (const ctrl of controls) {
    if (!Array.isArray(ctrl.sources)) continue;

    for (const src of ctrl.sources) {
      if (!src.id) continue;

      if (!map.has(src.id)) {
        map.set(src.id, {
          id:            src.id,
          title:         src.title ?? null,
          authority:     src.authority ?? null,
          source_type:   src.source_type ?? null,
          normative_force: src.normative_force ?? null,
          version:       src.version ?? null,
          published_on:  src.published_on ?? null,
          retrieved_on:  src.retrieved_on ?? null,
          artifact_hash: src.artifact_hash ?? null,
          license:       src.license ?? null,
          status:        src.status ?? null,
          supersedes:    src.supersedes ?? null,
          canonical_url: src.canonical_url ?? null,
          seen_in:       [ctrl.id ?? ctrl._file],
          version_conflict: false,
        });
      } else {
        const existing = map.get(src.id);
        if (!existing.seen_in.includes(ctrl.id ?? ctrl._file)) {
          existing.seen_in.push(ctrl.id ?? ctrl._file);
        }
        // Detect version conflicts
        if (src.version && existing.version && src.version !== existing.version) {
          existing.version_conflict = true;
          existing.conflicting_version = src.version;
        }
        // Prefer the entry with artifact_hash if the earlier one lacked it
        if (!existing.artifact_hash && src.artifact_hash) {
          existing.artifact_hash = src.artifact_hash;
        }
      }
    }
  }

  return map;
}

// ─── Layer breakdown ──────────────────────────────────────────────────────────

function buildLayerCounts(controls) {
  const counts = { LI: 0, TG: 0, EV: 0, OA: 0, BH: 0, CR: 0 };
  for (const ctrl of controls) {
    if (ctrl.layer && counts[ctrl.layer] !== undefined) {
      counts[ctrl.layer]++;
    }
  }
  return counts;
}

// ─── Profile summary ─────────────────────────────────────────────────────────

function buildProfileSummary(profiles) {
  if (!profiles?.profiles) return {};
  return Object.fromEntries(
    profiles.profiles.map(p => [
      p.profile_id,
      {
        name: p.name,
        required_controls: (p.required_controls ?? []).length,
        recommended_controls: (p.recommended_controls ?? []).length,
      },
    ])
  );
}

// ─── Baseline verification ────────────────────────────────────────────────────

function verifyBaseline(controls) {
  const knownIds = new Set(controls.map(c => c.id).filter(Boolean));
  const missing  = BASELINE_CONTROLS.filter(id => !knownIds.has(id));
  return { complete: missing.length === 0, missing };
}

// ─── Build hash ───────────────────────────────────────────────────────────────

function computeBuildHash() {
  if (!existsSync(INTEGRATION_JSON)) {
    return { hash: null, present: false };
  }
  const raw = readFileSync(INTEGRATION_JSON);
  return {
    hash: 'sha256:' + sha256hex(raw),
    present: true,
    size_bytes: raw.length,
  };
}

// ─── Schema version extraction ────────────────────────────────────────────────

function extractSchemaVersion() {
  const schema = loadJSON(SCHEMA_PATH, 'model-controls.schema.json');
  if (!schema) return SCHEMA_VERSION;
  // Look for the const on meta.schema_version
  try {
    return schema.properties?.meta?.properties?.schema_version?.const ?? SCHEMA_VERSION;
  } catch {
    return SCHEMA_VERSION;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('sign-release-manifest.mjs — generating release manifest');

const releaseDate   = refDate();
const controls      = loadAllControls();
const sourceMap     = collectSourceVersions(controls);
const layerCounts   = buildLayerCounts(controls);
const profiles      = loadJSON(PROFILES_PATH, 'profiles.json');
const profileSummary = buildProfileSummary(profiles);
const { complete: baselineComplete, missing: baselineMissing } = verifyBaseline(controls);
const schemaVersion = extractSchemaVersion();
const buildInfo     = computeBuildHash();

// Check for source version conflicts — emit warnings but don't fail
const versionConflicts = [];
for (const [sid, meta] of sourceMap) {
  if (meta.version_conflict) {
    console.warn(`  WARN: source '${sid}' has version conflict — '${meta.version}' vs '${meta.conflicting_version}' seen in: ${meta.seen_in.join(', ')}`);
    versionConflicts.push(sid);
  }
}

if (!baselineComplete) {
  const allowIncomplete = process.env.ALLOW_INCOMPLETE_BASELINE === '1';
  if (allowIncomplete) {
    console.warn(`  WARN: Baseline controls incomplete. Missing: ${baselineMissing.join(', ')} (ALLOW_INCOMPLETE_BASELINE=1 override active)`);
  } else {
    console.error(`  ERROR: Baseline controls not fully present. Missing: ${baselineMissing.join(', ')}`);
    console.error(`  Set ALLOW_INCOMPLETE_BASELINE=1 to generate a development manifest despite incomplete baseline.`);
    process.exit(1);
  }
}

if (!buildInfo.present) {
  console.warn(`  WARN: integration/controls.json not found — build_hash will be null. Run 'npm run build:integration' before signing.`);
}

// ── Assemble the manifest ─────────────────────────────────────────────────────

// source_versions: convert Map to sorted object, strip internal metadata
const sourceVersions = {};
for (const [sid, meta] of [...sourceMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  sourceVersions[sid] = {
    title:         meta.title,
    authority:     meta.authority,
    source_type:   meta.source_type,
    normative_force: meta.normative_force,
    version:       meta.version,
    published_on:  meta.published_on,
    retrieved_on:  meta.retrieved_on,
    artifact_hash: meta.artifact_hash,
    license:       meta.license,
    status:        meta.status,
    supersedes:    meta.supersedes,
    canonical_url: meta.canonical_url,
  };
  if (meta.version_conflict) {
    sourceVersions[sid]._conflict_note = `version conflict detected: also seen as '${meta.conflicting_version}'`;
  }
}

const manifest = {
  _schema: 'apeiris-release-manifest/v1',
  domain: 'modelverifier.ai',
  release_date: releaseDate,
  schema_version: schemaVersion,
  control_count: controls.length,
  layer_counts: layerCounts,
  baseline_controls: BASELINE_CONTROLS,
  baseline_complete: baselineComplete,
  profiles: profileSummary,
  source_count: sourceMap.size,
  source_versions: sourceVersions,
  build: {
    integration_artifact: 'integration/controls.json',
    build_hash: buildInfo.hash,
    artifact_present: buildInfo.present,
    artifact_size_bytes: buildInfo.size_bytes ?? null,
  },
  integrity: {
    // populated below after signing decision
  },
};

// ── Signing ───────────────────────────────────────────────────────────────────

const signingKey = process.env.MANIFEST_SIGNING_KEY ?? null;
const KEY_RE     = /^[a-f0-9]{64}$/;

let signatureHex = null;
let signingNote  = null;

if (signingKey !== null) {
  if (!KEY_RE.test(signingKey)) {
    console.error('  ERROR: MANIFEST_SIGNING_KEY must be a 64-char lowercase hex string');
    process.exit(1);
  }

  // Sign the canonical JSON of the manifest body (integrity block excluded)
  const manifestBody = JSON.stringify(manifest, null, 2);
  signatureHex = hmacSha256hex(signingKey, manifestBody);

  manifest.integrity = {
    algorithm: 'HMAC-SHA-256',
    signed: true,
    signed_on: releaseDate,
    key_hint: signingKey.slice(0, 8) + '...' + signingKey.slice(-8),
    signature: signatureHex,
    note: 'Signature covers the full manifest body (integrity block excluded). Verify with MANIFEST_SIGNING_KEY using HMAC-SHA-256.',
  };
  signingNote = `signed (HMAC-SHA-256, key hint: ${manifest.integrity.key_hint})`;
} else {
  manifest.integrity = {
    algorithm: 'HMAC-SHA-256',
    signed: false,
    signed_on: null,
    key_hint: null,
    signature: null,
    note: 'TODO: Set MANIFEST_SIGNING_KEY in CI secrets to enable manifest signing. ' +
          'The key must be a 64-char hex string (256 bits). Store securely — never commit to source.',
  };
  signingNote = 'unsigned (MANIFEST_SIGNING_KEY not set)';
}

// ── Write outputs ─────────────────────────────────────────────────────────────

mkdirSync(INTEGRATION_DIR, { recursive: true });

const manifestJson = JSON.stringify(manifest, null, 2) + '\n';
writeFileSync(MANIFEST_OUT, manifestJson, 'utf8');
console.log(`  wrote ${MANIFEST_OUT} (${manifestJson.length} bytes)`);

if (signatureHex !== null) {
  // Write detached signature file: hex-encoded HMAC + newline
  const sigContent = signatureHex + '\n';
  writeFileSync(MANIFEST_SIG_OUT, sigContent, 'utf8');
  console.log(`  wrote ${MANIFEST_SIG_OUT} (detached HMAC-SHA-256 signature)`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`
  release manifest summary:
    release_date:    ${releaseDate}
    schema_version:  ${schemaVersion}
    control_count:   ${controls.length}  ${JSON.stringify(layerCounts)}
    source_count:    ${sourceMap.size}
    baseline:        ${baselineComplete ? 'COMPLETE' : 'INCOMPLETE — ' + baselineMissing.join(', ')}
    build_hash:      ${buildInfo.hash ?? '(integration artifact not found)'}
    signing:         ${signingNote}${versionConflicts.length > 0 ? '\n    version_conflicts: ' + versionConflicts.join(', ') : ''}
`);

console.log('  ✓ sign-release-manifest.mjs complete');
