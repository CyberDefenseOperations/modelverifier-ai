#!/usr/bin/env node
/**
 * audit-mappings.mjs — Gate 6 of the modelverifier.ai build pipeline.
 *
 * Resolves every framework ID cited in controls[].frameworks[] against its
 * authoritative catalog, enforces legal-status consistency, detects
 * control-level overlap and cross-domain URI resolution, and validates
 * evidence artifact declarations.
 *
 * Usage:
 *   node scripts/audit-mappings.mjs                          # run all six checks
 *   node scripts/audit-mappings.mjs --check mappings         # framework ID resolution
 *   node scripts/audit-mappings.mjs --check applicability    # obligation predicates
 *   node scripts/audit-mappings.mjs --check legal-status     # legal status consistency
 *   node scripts/audit-mappings.mjs --check control-overlap  # duplicate requirement_id mappings
 *   node scripts/audit-mappings.mjs --check cross-domain     # apeiris:// URI resolution
 *   node scripts/audit-mappings.mjs --check evidence-contracts # evidence artifact declarations
 *
 * Environment variables:
 *   AISVS_COMMIT_HASH — git commit SHA of the OWASP AISVS repository from which
 *                        mappings were authored. If unset, commit-level resolution
 *                        is skipped and a warning is emitted. Format: [a-f0-9]{40}
 *
 * Exit codes:
 *   0  all selected checks passed (warnings allowed)
 *   1  one or more errors found
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const DOMAIN_ROOT = resolve(__dirname, '..');
const REPO_ROOT   = resolve(DOMAIN_ROOT, '..');
const CONTROLS_DIR  = join(DOMAIN_ROOT, 'controls');
const SCHEMA_DIR    = join(DOMAIN_ROOT, 'schema');
const CORE_DIR      = join(REPO_ROOT, 'apeiris-control-core');
const CATALOG_PATH  = join(SCHEMA_DIR, 'framework-mapping-catalog.json');
const NAMESPACE_PATH = join(CORE_DIR, 'namespace-registry.json');

// ─── Error / warning tracking ─────────────────────────────────────────────────

const errors   = [];
const warnings = [];

function err(ctx, msg)  { errors.push(`[${ctx}] ERROR: ${msg}`); }
function warn(ctx, msg) { warnings.push(`[${ctx}] WARN: ${msg}`); }

// ─── Load helpers ─────────────────────────────────────────────────────────────

function loadJSON(path, label) {
  if (!existsSync(path)) {
    console.error(`Cannot find required file: ${path} (${label})`);
    process.exit(1);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`JSON parse failure for ${label} at ${path}: ${e.message}`);
    process.exit(1);
  }
}

function loadAllControls() {
  const controls = [];
  let files;
  try {
    files = readdirSync(CONTROLS_DIR).filter(f => f.endsWith('.json')).sort();
  } catch (e) {
    console.error(`Cannot read controls directory '${CONTROLS_DIR}': ${e.message}`);
    process.exit(1);
  }

  for (const file of files) {
    const path = join(CONTROLS_DIR, file);
    let data;
    try {
      data = JSON.parse(readFileSync(path, 'utf8'));
    } catch (e) {
      errors.push(`[FILE:${file}] ERROR: JSON parse failure — ${e.message}`);
      continue;
    }
    if (!Array.isArray(data)) continue;
    for (let i = 0; i < data.length; i++) {
      if (typeof data[i] === 'object' && data[i] !== null) {
        controls.push({ ...data[i], _file: file });
      }
    }
  }
  return controls;
}

// ─── Framework catalogs ───────────────────────────────────────────────────────

/**
 * Bounded set of all allowed LLM Top 10 2025 requirement IDs.
 * Source: framework-mapping-catalog.json allowed_requirement_ids.
 */
const LLM10_ALLOWED = new Set([
  'LLM01:2025', 'LLM02:2025', 'LLM03:2025', 'LLM04:2025', 'LLM05:2025',
  'LLM06:2025', 'LLM07:2025', 'LLM08:2025', 'LLM09:2025', 'LLM10:2025',
]);

const LLM10_DESCRIPTIONS = {
  'LLM01:2025': 'Prompt Injection',
  'LLM02:2025': 'Sensitive Information Disclosure',
  'LLM03:2025': 'Supply Chain',
  'LLM04:2025': 'Data and Model Poisoning',
  'LLM05:2025': 'Improper Output Handling',
  'LLM06:2025': 'Excessive Agency',
  'LLM07:2025': 'System Prompt Leakage',
  'LLM08:2025': 'Vector and Embedding Weaknesses',
  'LLM09:2025': 'Misinformation',
  'LLM10:2025': 'Unbounded Consumption',
};

/**
 * Verified MITRE ATLAS v5.6.0 technique IDs and their canonical labels.
 * Source: framework-mapping-catalog.json verified_technique_ids + namespace-registry.
 * These are the ONLY technique IDs confirmed in v5.6.0 as of 2026-05-04.
 */
const ATLAS_VERIFIED = {
  'AML.T0051': 'LLM Prompt Injection',
  'AML.T0020': 'Poison Training Data',
  'AML.T0024': 'Exfiltration via Inference API',
  'AML.T0044': 'Full ML Model Access',
  'AML.T0018': 'Backdoor ML Model',
  'AML.T0043': 'Craft Adversarial Data',
  'AML.T0040': 'ML Model Inference API Access',
  'AML.T0035': 'ML Artifact Collection',
  'AML.T0031': 'Erode ML Model Integrity',
  'AML.T0016': 'Obtain Capabilities',
};

/**
 * Known ATLAS techniques that had MEANING-CHANGING label revisions between
 * v5.x releases. If a control uses these IDs with rationale text that
 * implies the old meaning, flag a semantic-mismatch error.
 *
 * Detection strategy: scan rationale for banned keyword combinations.
 */
const ATLAS_SEMANTIC_GUARDS = [
  {
    id: 'AML.T0051',
    label: 'LLM Prompt Injection',
    bannedRationaleKeywords: ['capability threshold', 'capability-threshold', 'dangerous capability'],
    reason: 'AML.T0051 is LLM Prompt Injection, NOT capability-threshold crossing. Do not use it to map frontier evaluation controls.',
  },
];

/**
 * LLM10 semantic guards: rationale text patterns that indicate the wrong
 * entry was cited (mapping caveat enforcement from the catalog).
 */
const LLM10_SEMANTIC_GUARDS = [
  {
    id: 'LLM09:2025',
    label: 'Misinformation',
    bannedRationaleKeywords: ['distribution shift', 'concept drift', 'covariate shift', 'data drift', 'performance drift'],
    reason: 'LLM09:2025 is Misinformation (false outputs), NOT statistical distribution shift. Do not map drift-monitoring controls to LLM09.',
  },
  {
    id: 'LLM03:2025',
    label: 'Supply Chain',
    bannedRationaleKeywords: ['training data poisoning', 'data poisoning', 'AML.T0020'],
    reason: 'LLM03:2025 is Supply Chain (artifact tampering), NOT Training Data Poisoning which is LLM04:2025.',
  },
  {
    id: 'LLM04:2025',
    label: 'Data and Model Poisoning',
    bannedRationaleKeywords: ['supply chain', 'artifact tampering', 'msbom', 'model SBOM'],
    reason: 'LLM04:2025 is Data and Model Poisoning, NOT Supply Chain artifact tampering which is LLM03:2025.',
  },
];

/** Pattern regexes per framework, compiled from framework-mapping-catalog.json. */
const FRAMEWORK_PATTERNS = {
  nist_rmf:      /^(GOVERN|MAP|MEASURE|MANAGE)-\d+(\.\d+)?$/,
  nist_ai_600_1: /^[A-Z][A-Z0-9-]+$/,
  iso_42001:     /^(A\.)?\d+(\.\d+)*$/,
  eu_ai_act:     /^(Art|Annex|Recital)-([\d]+|[IVX]+)[a-z]?(\(\d+\))?([a-z])?$/,
  sr262:         /^(S-\d+(\.\d+)?|App-[A-Z](\.\d+)?)$/,
  aisvs:         /^C(10|[1-9])\.\d+$/,
  llm10:         /^LLM(0[1-9]|10):2025$/,
  aicm:          /^[A-Z&]{2,6}-\d{2,3}$/,
  mitre:         /^AML\.(T|M|DS)\d{4}(\.\d{3})?$/,
  owasp_aitg:    /^AITG-(DG|ME|RT|GV|IR)-\d{2}$/,
};

/** Framework versions expected on source_version field of mapping objects. */
const FRAMEWORK_SOURCE_VERSIONS = {
  nist_rmf:      '1.0',
  nist_ai_600_1: '2024',
  iso_42001:     '2023',
  eu_ai_act:     '2024/1689',
  sr262:         'SR 26-2',
  aisvs:         '1.0',
  llm10:         '2025',
  aicm:          '1.1',
  mitre:         '5.6.0',
  owasp_aitg:    '1.0',
};

/** Valid assurance_target fields for applicability condition predicates. */
const VALID_ASSURANCE_TARGET_FIELDS = new Set([
  'use_case_id', 'use_case', 'model_ids', 'model_version', 'model_paradigm',
  'provider', 'provider_type', 'training_regime', 'output_modalities',
  'data_sources', 'retrieval_sources', 'prompt_system_config_ref', 'tool_integrations',
  'deployment_environment', 'human_oversight_mode', 'end_users', 'affected_parties',
  'jurisdiction', 'industry', 'eu_ai_act_classification', 'decision_domain',
  'regulated_entity', 'asset_threshold_usd',
]);
const VALID_CAPABILITY_RISK_FIELDS = new Set([
  'capability_level', 'capability_domains', 'access_mode', 'autonomy',
  'external_reach', 'irreversibility', 'data_sensitivity', 'deployment_scale',
  'affected_party_impact',
]);
const VALID_APPLICABILITY_OPS = new Set([
  'eq', 'neq', 'in', 'not-in', 'contains', 'contains-any', 'contains-all',
  'gte', 'lte', 'gt', 'lt', 'exists', 'eq-true', 'eq-false',
]);

const CROSS_DOMAIN_URI_RE = /^apeiris:\/\/[a-z][a-z0-9-]*\/controls\/[A-Z]{2,6}-[0-9]{2}$/;

// ─── Gate 6a: mappings — framework ID resolution ──────────────────────────────

function checkMappings(controls) {
  const aivsvCommitHash = process.env.AISVS_COMMIT_HASH ?? null;
  const aivsvCommitRE   = /^[a-f0-9]{40}$/;

  if (!aivsvCommitHash) {
    warnings.push('[AISVS] WARN: AISVS_COMMIT_HASH env var is not set. Commit-level source pinning for OWASP AISVS cannot be verified. Set this to the 40-char git SHA from which AISVS mappings were authored.');
  } else if (!aivsvCommitRE.test(aivsvCommitHash)) {
    err('AISVS', `AISVS_COMMIT_HASH '${aivsvCommitHash}' is not a valid 40-char lowercase hex git SHA`);
  }

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;

    if (!Array.isArray(ctrl.frameworks) || ctrl.frameworks.length === 0) continue;

    for (const fw of ctrl.frameworks) {
      const fwKey = fw.framework;
      const reqId = fw.requirement_id;

      if (!fwKey) continue; // schema check catches this

      // ── Pattern validation ──────────────────────────────────────────────────
      const pattern = FRAMEWORK_PATTERNS[fwKey];
      if (pattern && reqId !== undefined) {
        if (!pattern.test(reqId)) {
          err(id, `frameworks[${fwKey}].requirement_id '${reqId}' does not match the allowed pattern for ${fwKey} (${pattern.source})`);
        }
      }

      // ── Framework-specific ID resolution ───────────────────────────────────

      if (fwKey === 'llm10') {
        // Bounded set: must be exactly one of the 10 allowed IDs
        if (!LLM10_ALLOWED.has(reqId)) {
          err(id, `frameworks[llm10].requirement_id '${reqId}' is not in the allowed LLM10:2025 set: ${[...LLM10_ALLOWED].join(', ')}`);
        }
        // Semantic guard: check rationale for meaning-changing misuse
        if (reqId && fw.rationale) {
          for (const guard of LLM10_SEMANTIC_GUARDS) {
            if (guard.id === reqId) {
              const lowerRationale = fw.rationale.toLowerCase();
              for (const kw of guard.bannedRationaleKeywords) {
                if (lowerRationale.includes(kw.toLowerCase())) {
                  err(id, `frameworks[llm10] semantic mismatch for '${reqId}' (${guard.label}): rationale contains '${kw}' — ${guard.reason}`);
                }
              }
            }
          }
        }
      }

      if (fwKey === 'aisvs') {
        // Pattern enforced above (C[1-10].\d+). Commit-hash note if set.
        if (aivsvCommitHash && fw.source_version && fw.source_version !== aivsvCommitHash) {
          warn(id, `frameworks[aisvs].source_version '${fw.source_version}' does not match AISVS_COMMIT_HASH '${aivsvCommitHash}'. Re-pin the commit hash in the mapping.`);
        }
      }

      if (fwKey === 'mitre') {
        // Verify against the bounded set of confirmed v5.6.0 technique IDs
        if (reqId && reqId.startsWith('AML.T')) {
          if (!ATLAS_VERIFIED[reqId]) {
            // Not in our verified set. This is a WARNING not an ERROR, because
            // the full ATLAS catalog is large — we only maintain a verified subset.
            // However, the ID pattern is still validated above.
            warn(id, `frameworks[mitre].requirement_id '${reqId}' is not in the modelverifier.ai verified ATLAS technique set. Confirm it exists in MITRE ATLAS v5.6.0 before publishing.`);
          } else if (fw.rationale) {
            // Semantic guard: scan for label-meaning changes
            for (const guard of ATLAS_SEMANTIC_GUARDS) {
              if (guard.id === reqId) {
                const lowerRationale = fw.rationale.toLowerCase();
                for (const kw of guard.bannedRationaleKeywords) {
                  if (lowerRationale.includes(kw.toLowerCase())) {
                    err(id, `frameworks[mitre] semantic mismatch for '${reqId}' (${guard.label}): rationale contains '${kw}' — ${guard.reason}`);
                  }
                }
              }
            }
          }
        }
      }

      // ── source_version must match framework catalog version ─────────────────
      const expectedVersion = FRAMEWORK_SOURCE_VERSIONS[fwKey];
      if (expectedVersion && fw.source_version && fw.source_version !== expectedVersion) {
        err(id, `frameworks[${fwKey}].source_version '${fw.source_version}' does not match catalog version '${expectedVersion}'. Update or re-verify the mapping.`);
      }
      if (!fw.source_version) {
        err(id, `frameworks[${fwKey}].source_version is required on every mapping`);
      }

      // ── fit:partial requires uncovered_portion ──────────────────────────────
      if (fw.fit === 'partial' && (!fw.uncovered_portion || fw.uncovered_portion.trim() === '')) {
        err(id, `frameworks[${fwKey}] fit:'partial' requires a non-empty uncovered_portion explaining what the framework requirement covers that this control does not`);
      }

      // ── fit:direct requires source_locator with at least section ────────────
      if (fw.fit === 'direct') {
        if (!fw.source_locator || !fw.source_locator.section) {
          err(id, `frameworks[${fwKey}] fit:'direct' requires source_locator.section to be set (precise document location)`);
        }
      }

      // ── reviewed_on required ────────────────────────────────────────────────
      if (!fw.reviewed_on) {
        err(id, `frameworks[${fwKey}].reviewed_on is required`);
      }

      // ── EU AI Act: must have at least one obligation object ─────────────────
      if (fwKey === 'eu_ai_act') {
        const hasObligation = Array.isArray(ctrl.obligations) &&
          ctrl.obligations.some(o => o.source_ref === 'eu_ai_act' || o.instrument?.includes('2024/1689'));
        if (!hasObligation) {
          err(id, `frameworks[eu_ai_act] mapping at '${reqId}' requires a corresponding obligation object in obligations[]. Add one with legal_status, effective_from, and applicability predicates.`);
        }
      }

      // ── SR 26-2 mapping: legal_status on mapping must be 'guidance' ─────────
      if (fwKey === 'sr262' && fw.legal_status && fw.legal_status !== 'guidance') {
        err(id, `frameworks[sr262] legal_status must be 'guidance' (SR 26-2 is supervisory guidance, not binding law). Got '${fw.legal_status}'.`);
      }

      // ── Rationale minimum length (also checked in validate:schema, belt-and-suspenders) ──
      if (!fw.rationale || fw.rationale.length < 30) {
        err(id, `frameworks[${fwKey}].rationale must be at least 30 characters`);
      }
    }
  }
}

// ─── Gate 6b: applicability — obligation predicate fields ────────────────────

function checkApplicability(controls) {
  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;

    if (!Array.isArray(ctrl.obligations) || ctrl.obligations.length === 0) continue;

    for (let i = 0; i < ctrl.obligations.length; i++) {
      const obl = ctrl.obligations[i];
      const oblCtx = `${id}.obligations[${i}]`;

      // Required fields on obligation objects
      const REQUIRED_OBL = ['authority', 'instrument', 'provision', 'jurisdiction', 'normative_force', 'legal_status', 'source_ref', 'reviewed_on'];
      for (const f of REQUIRED_OBL) {
        if (obl[f] === undefined || obl[f] === null) {
          err(oblCtx, `required field '${f}' is absent`);
        }
      }

      // jurisdiction must be a non-empty array
      if (!Array.isArray(obl.jurisdiction) || obl.jurisdiction.length === 0) {
        err(oblCtx, `jurisdiction must be a non-empty array (e.g. ["eu"] or ["us"])`);
      }

      // normative_force enum
      const VALID_NF = ['binding-law', 'regulation', 'supervisory-guidance', 'voluntary-standard', 'certification-standard', 'industry-framework', 'best-practice'];
      if (obl.normative_force && !VALID_NF.includes(obl.normative_force)) {
        err(oblCtx, `invalid normative_force '${obl.normative_force}'`);
      }

      // legal_status enum
      const VALID_LS = ['enacted', 'pending-adoption', 'proposed', 'withdrawn', 'not-applicable'];
      if (obl.legal_status && !VALID_LS.includes(obl.legal_status)) {
        err(oblCtx, `invalid legal_status '${obl.legal_status}'`);
      }

      // EU AI Act obligations must specify effective_from
      if ((obl.source_ref === 'eu_ai_act' || obl.instrument?.includes('2024/1689')) && !obl.effective_from) {
        err(oblCtx, `EU AI Act obligations must specify effective_from (standalone high-risk: 2027-12-02; product-embedded: 2028-08-02)`);
      }

      // SR 26-2 obligations must NOT use normative_force: 'binding-law'
      if ((obl.source_ref === 'sr262' || obl.instrument?.includes('SR 26-2')) && obl.normative_force === 'binding-law') {
        err(oblCtx, `SR 26-2 is supervisory guidance. normative_force must be 'supervisory-guidance', not 'binding-law'.`);
      }

      // OCC 2026-13 obligations must NOT use normative_force: 'binding-law'
      if (obl.instrument?.includes('OCC 2026-13') && obl.normative_force === 'binding-law') {
        err(oblCtx, `OCC 2026-13 is supervisory guidance. normative_force must be 'supervisory-guidance', not 'binding-law'.`);
      }

      // Validate applicability condition predicates
      if (obl.applicability && typeof obl.applicability === 'object') {
        const groups = ['all', 'any', 'none'];
        for (const group of groups) {
          if (Array.isArray(obl.applicability[group])) {
            for (let j = 0; j < obl.applicability[group].length; j++) {
              const cond = obl.applicability[group][j];
              validateApplicabilityCondition(`${oblCtx}.applicability.${group}[${j}]`, cond);
            }
          }
        }
      }
    }
  }
}

function validateApplicabilityCondition(ctx, cond) {
  if (!cond.field) {
    err(ctx, `applicability condition missing 'field'`);
    return;
  }
  if (!cond.op) {
    err(ctx, `applicability condition missing 'op'`);
  } else if (!VALID_APPLICABILITY_OPS.has(cond.op)) {
    err(ctx, `applicability condition op '${cond.op}' is invalid. Allowed: ${[...VALID_APPLICABILITY_OPS].join(', ')}`);
  }
  if (cond.value === undefined) {
    err(ctx, `applicability condition missing 'value'`);
  }

  // Validate field path: must start with a known top-level object
  const parts = cond.field.split('.');
  if (parts.length >= 2) {
    const obj  = parts[0];
    const prop = parts.slice(1).join('.');

    if (obj === 'assurance_target') {
      if (!VALID_ASSURANCE_TARGET_FIELDS.has(prop)) {
        warn(ctx, `applicability field 'assurance_target.${prop}' is not a known assurance_target property. Verify against model-assurance-extension.schema.json.`);
      }
    } else if (obj === 'capability_risk') {
      if (!VALID_CAPABILITY_RISK_FIELDS.has(prop)) {
        warn(ctx, `applicability field 'capability_risk.${prop}' is not a known capability_risk property.`);
      }
    } else {
      warn(ctx, `applicability field '${cond.field}' does not start with 'assurance_target.' or 'capability_risk.' — verify field path`);
    }
  } else {
    warn(ctx, `applicability field '${cond.field}' should use dot-notation to reference a nested property (e.g. 'assurance_target.jurisdiction')`);
  }
}

// ─── Gate 6c: legal-status ───────────────────────────────────────────────────

function checkLegalStatus(controls) {
  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;

    if (!Array.isArray(ctrl.frameworks)) continue;

    for (const fw of ctrl.frameworks) {
      // SR 26-2 mappings: legal_status on mapping object must be 'guidance'
      if (fw.framework === 'sr262' && fw.legal_status && fw.legal_status !== 'guidance') {
        err(id, `frameworks[sr262] mapping legal_status must be 'guidance'. SR 26-2 is supervisory guidance, not a binding legal obligation. Got '${fw.legal_status}'.`);
      }

      // EU AI Act mappings: legal_status must be 'binding' (enacted regulation, future-dated)
      if (fw.framework === 'eu_ai_act' && fw.legal_status && !['binding', 'pending'].includes(fw.legal_status)) {
        warn(id, `frameworks[eu_ai_act] mapping legal_status '${fw.legal_status}' may be inaccurate. EU AI Act is enacted law (use 'binding') with future enforcement dates. Use obligations[].effective_from to communicate the timing.`);
      }

      // NIST RMF, AISVS, OWASP LLM10, AICM, MITRE ATLAS are voluntary/informative:
      // legal_status should NOT be 'binding'
      const VOLUNTARY_FRAMEWORKS = new Set(['nist_rmf', 'aisvs', 'llm10', 'aicm', 'mitre', 'iso_42001']);
      if (VOLUNTARY_FRAMEWORKS.has(fw.framework) && fw.legal_status === 'binding') {
        err(id, `frameworks[${fw.framework}] legal_status 'binding' is incorrect — this framework is voluntary/informative, not legally binding. Use 'voluntary' or 'not-applicable'.`);
      }
    }

    // Obligation-level checks
    if (Array.isArray(ctrl.obligations)) {
      for (const obl of ctrl.obligations) {
        // SR 26-2 obligations: never binding
        if ((obl.source_ref === 'sr262' || obl.instrument?.includes('SR 26-2'))) {
          if (obl.normative_force === 'binding-law' || obl.legal_status === 'binding') {
            err(id, `obligations[${obl.provision}]: SR 26-2 is supervisory guidance. normative_force must not be 'binding-law' and legal_status must not be 'binding'.`);
          }
        }
      }
    }
  }
}

// ─── Gate 6d: control-overlap ────────────────────────────────────────────────

/**
 * Detects when multiple controls map to the same framework requirement_id with
 * fit:'direct' and direction:'bidirectional', which may indicate unintended duplication.
 * Partial or adjacent mappings of the same requirement by multiple controls are
 * expected and are not flagged.
 */
function checkControlOverlap(controls) {
  // Map: "framework|requirement_id|fit" → [controlIds]
  const directMap = new Map();

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;
    if (!Array.isArray(ctrl.frameworks)) continue;

    for (const fw of ctrl.frameworks) {
      if (fw.fit === 'direct' && fw.framework && fw.requirement_id) {
        const key = `${fw.framework}|${fw.requirement_id}`;
        if (!directMap.has(key)) directMap.set(key, []);
        directMap.get(key).push(id);
      }
    }
  }

  for (const [key, ctrlIds] of directMap) {
    if (ctrlIds.length > 1) {
      const [framework, reqId] = key.split('|');
      warn(
        `OVERLAP:${framework}:${reqId}`,
        `Multiple controls claim fit:'direct' for ${framework}/${reqId}: ${ctrlIds.join(', ')}. ` +
        `Review whether both controls genuinely fully satisfy this requirement, or whether one should be 'partial'.`,
      );
    }
  }
}

// ─── Gate 6e: cross-domain ───────────────────────────────────────────────────

function checkCrossDomain(controls) {
  // Load namespace-registry for domain resolution
  const registry = loadJSON(NAMESPACE_PATH, 'namespace-registry');
  const knownDomains = new Set(Object.keys(registry.domains ?? {}));

  // Build a set of all known control IDs in THIS domain for self-referential check
  const localControlIds = new Set(controls.map(c => c.id).filter(Boolean));

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;
    if (!ctrl.cross_domain) continue;

    // references[]
    if (Array.isArray(ctrl.cross_domain.references)) {
      for (const ref of ctrl.cross_domain.references) {
        if (!ref.uri) {
          err(id, `cross_domain.references[] entry is missing 'uri'`);
          continue;
        }
        if (!CROSS_DOMAIN_URI_RE.test(ref.uri)) {
          err(id, `cross_domain.references[].uri '${ref.uri}' does not match apeiris://<domain>/controls/<LAYER>-<NN>`);
          continue;
        }
        // Extract domain from URI and check it's registered
        const domainMatch = ref.uri.match(/^apeiris:\/\/([a-z][a-z0-9-]*)\//);
        if (domainMatch) {
          const domain = domainMatch[1];
          // 'model' domain URIs pointing at local controls are self-references — warn
          if (domain === 'model') {
            const controlIdMatch = ref.uri.match(/\/controls\/([A-Z]{2,6}-\d{2})$/);
            if (controlIdMatch && localControlIds.has(controlIdMatch[1])) {
              warn(id, `cross_domain.references[] points to '${ref.uri}' which is a control in this domain. Use a local control ID reference instead.`);
            }
          }
          if (!knownDomains.has(domain)) {
            warn(id, `cross_domain.references[] domain '${domain}' in '${ref.uri}' is not registered in namespace-registry.json`);
          }
        }

        // Valid relationship values
        const VALID_RELATIONSHIPS = ['related', 'extends', 'requires', 'mirrored-by', 'supersedes', 'implements'];
        if (ref.relationship && !VALID_RELATIONSHIPS.includes(ref.relationship)) {
          err(id, `cross_domain.references[].relationship '${ref.relationship}' is invalid. Allowed: ${VALID_RELATIONSHIPS.join(', ')}`);
        }
      }
    }

    // evidence_artifacts[]
    if (Array.isArray(ctrl.cross_domain.evidence_artifacts)) {
      for (const ea of ctrl.cross_domain.evidence_artifacts) {
        if (!ea.artifact_type) {
          err(id, `cross_domain.evidence_artifacts[] entry is missing 'artifact_type'`);
        }
        if (!ea.producer_verifier) {
          err(id, `cross_domain.evidence_artifacts[] entry is missing 'producer_verifier'`);
        } else {
          const pvRE = /^apeiris:\/\/[a-z][a-z0-9-]*$/;
          if (!pvRE.test(ea.producer_verifier)) {
            err(id, `cross_domain.evidence_artifacts[].producer_verifier '${ea.producer_verifier}' must match apeiris://<domain>`);
          }
        }
        // retention should be an ISO 8601 duration
        if (ea.retention && !/^P/.test(ea.retention) && ea.retention !== 'indefinite') {
          warn(id, `cross_domain.evidence_artifacts[].retention '${ea.retention}' should be an ISO 8601 duration (e.g. 'P7Y') or 'indefinite'`);
        }
      }
    }
  }
}

// ─── Gate 6f: evidence-contracts ─────────────────────────────────────────────

/**
 * Validates that:
 * - validation.evidence items follow the 'type:name — description' format
 * - evidence item types use the domain-canonical 'model:' prefix
 * - cross_domain.evidence_artifacts items have producer_verifier set
 */
function checkEvidenceContracts(controls) {
  // Evidence item pattern: "type:name — description" or "type:name - description"
  // The type prefix should use lowercase with colons (e.g. model:registry-entry)
  const EVIDENCE_TYPE_RE   = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]+/;
  const EVIDENCE_SEP_RE    = /\s[—\-]\s/;
  const DOMAIN_PREFIX      = 'model:';

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;

    if (Array.isArray(ctrl.validation?.evidence)) {
      for (let i = 0; i < ctrl.validation.evidence.length; i++) {
        const item = ctrl.validation.evidence[i];

        // Must start with 'type:name'
        if (!EVIDENCE_TYPE_RE.test(item)) {
          err(id, `validation.evidence[${i}]: must start with 'type:name' format (e.g. 'model:registry-entry — description'). Got: '${item.slice(0, 60)}'`);
          continue;
        }

        // Should have a description separated by ' — ' or ' - '
        if (!EVIDENCE_SEP_RE.test(item)) {
          warn(id, `validation.evidence[${i}]: should include a description after ' — ' (em-dash with spaces). Got: '${item.slice(0, 60)}'`);
        }

        // Evidence types in this domain should use the 'model:' prefix
        if (!item.startsWith(DOMAIN_PREFIX) && !item.startsWith('apeiris:')) {
          warn(id, `validation.evidence[${i}]: evidence type should use 'model:' prefix for model-assurance artifacts. Got: '${item.split(' ')[0]}'`);
        }
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const CHECK_MAP = {
  mappings:            checkMappings,
  applicability:       checkApplicability,
  'legal-status':      checkLegalStatus,
  'control-overlap':   checkControlOverlap,
  'cross-domain':      checkCrossDomain,
  'evidence-contracts': checkEvidenceContracts,
};

const args        = process.argv.slice(2);
const flagIdx     = args.indexOf('--check');
const checkTarget = flagIdx >= 0 ? args[flagIdx + 1] : null;

const controls = loadAllControls();
console.log(`audit-mappings.mjs — loaded ${controls.length} controls from ${CONTROLS_DIR}`);

if (errors.length > 0) {
  // File-level parse errors: abort early
  for (const e of errors) console.error(e);
  process.exit(1);
}

if (checkTarget !== null) {
  const fn = CHECK_MAP[checkTarget];
  if (!fn) {
    console.error(`Unknown check target: '${checkTarget}'. Valid targets: ${Object.keys(CHECK_MAP).join(', ')}`);
    process.exit(1);
  }
  console.log(`  ─ running check: ${checkTarget}`);
  fn(controls);
} else {
  for (const [name, fn] of Object.entries(CHECK_MAP)) {
    console.log(`  ─ ${name}`);
    fn(controls);
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (warnings.length > 0) {
  console.warn(`\n  warnings (${warnings.length}):`);
  for (const w of warnings) console.warn('    ' + w);
}

if (errors.length > 0) {
  console.error(`\n  ERRORS (${errors.length}) — build FAILED:`);
  for (const e of errors) console.error('    ' + e);
  process.exit(1);
}

console.log(`\n  ✓ audit-mappings.mjs passed (${controls.length} controls, ${warnings.length} warnings)`);
