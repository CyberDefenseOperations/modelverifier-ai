#!/usr/bin/env node
/**
 * validate.mjs — Gate 1 of the modelverifier.ai build pipeline.
 *
 * Shape + enums + cite-or-flag validation for all control records across all
 * 6 layers (LI, TG, EV, OA, BH, CR).
 *
 * Usage:
 *   node scripts/validate.mjs                        # run all five checks
 *   node scripts/validate.mjs --check schema         # required fields + all enums
 *   node scripts/validate.mjs --check namespaces     # ID format, layer-plane, uniqueness
 *   node scripts/validate.mjs --check sources        # source completeness + cite-or-flag
 *   node scripts/validate.mjs --check source-versions  # date format, superseded guard
 *   node scripts/validate.mjs --check licenses       # license field completeness
 *
 * Exit codes:
 *   0  all selected checks passed (warnings allowed)
 *   1  one or more errors found
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOMAIN_ROOT   = resolve(__dirname, '..');
const CONTROLS_DIR  = join(DOMAIN_ROOT, 'controls');
const SCHEMA_DIR    = join(DOMAIN_ROOT, 'schema');

// ─── Enum catalogs ────────────────────────────────────────────────────────────

const VALID_LAYERS  = ['LI', 'TG', 'EV', 'OA', 'BH', 'CR'];

/**
 * Authoritative layer→plane map.
 * Enforced by validate:namespaces and audit:namespaces.
 * Source of truth: model-controls.schema.json layer_plane_assignments.$comment
 */
const LAYER_PLANE   = { LI: 'control', TG: 'data', EV: 'both', OA: 'control', BH: 'data', CR: 'lifecycle' };

const VALID_PLANES      = ['control', 'data', 'lifecycle', 'both'];
const VALID_MATURITY    = ['none', 'initial', 'developing', 'defined', 'managed', 'optimizing'];
const VALID_READINESS   = ['draft', 'review', 'approved', 'deprecated'];
const VALID_THESIS_TYPES = ['preventive', 'detective', 'corrective', 'deterrent', 'compensating', 'directive', 'recovery'];

const VALID_SOURCE_TYPES = [
  'binding-law', 'regulation', 'supervisory-guidance', 'voluntary-standard',
  'certification-standard', 'industry-framework', 'threat-knowledge-base',
  'academic-research', 'vendor-framework', 'product-documentation', 'apeiris-thesis',
];
const VALID_NORMATIVE_FORCE = ['binding-law', 'guidance', 'voluntary', 'informative'];
const VALID_SOURCE_STATUS   = ['current', 'deprecated', 'withdrawn', 'draft', 'final-review'];

const VALID_METRIC_TYPES      = ['performance', 'drift', 'fairness', 'safety', 'cost'];
const VALID_EVALUATION_MODES  = ['real-time', 'batch'];
const VALID_CAPABILITY_LEVELS = ['none', 'low', 'elevated', 'frontier'];
const VALID_COMPARISON_OPS    = [
  'lt', 'lte', 'gt', 'gte', 'eq', 'neq',
  'decrease-greater-than', 'increase-greater-than',
  'outside-range', 'exceeds-absolute-difference',
];

const VALID_PROFILES = [
  'general-predictive-ml', 'generative-ai', 'multimodal', 'hosted-api', 'continuously-learning',
  'high-impact-decision', 'us-regulated-banking', 'eu-high-risk', 'gpai-provider',
  'gpai-systemic-risk', 'frontier-capability',
];

const VALID_FRAMEWORK_KEYS = ['nist_rmf', 'nist_ai_600_1', 'iso_42001', 'eu_ai_act', 'sr262', 'aisvs', 'llm10', 'aicm', 'mitre', 'owasp_aitg'];

const REQUIRED_LENSES  = ['engineering', 'evaluation', 'red_team', 'grc', 'mlops'];

/** Layers where monitoring_schema is mandatory. */
const MONITORING_REQUIRED_LAYERS     = ['BH', 'CR'];
/** Layers where monitoring_schema is encouraged (warn if absent on controls that are not pure-governance). */
const MONITORING_RECOMMENDED_LAYERS  = ['EV', 'TG'];

const CONTROL_ID_RE  = /^(LI|TG|EV|OA|BH|CR)-\d{2}$/;
const SOURCE_ID_RE   = /^[a-z][a-z0-9_]{1,31}$/;
const DATE_RE        = /^\d{4}-\d{2}-\d{2}$/;
const ARTIFACT_HASH_RE = /^(sha256:[a-f0-9]{64}|git:[a-f0-9]{40})$/;

/** Cite-or-flag: items must include [ref:source_id] referencing a known source. */
const CITE_REF_RE     = /\[ref:([a-z][a-z0-9_]{0,31})\]/;
/** runtime_test alternative: the item is explicitly flagged as unverified. */
const UNVERIFIED_RE   = /\[unverified\]/;

const SCHEMA_URI = 'https://schema.apeiris.ai/model-assurance/v1/model-controls.schema.json';

// Superseded source IDs that must never appear.
const BANNED_SOURCE_IDS = new Set(['sr_11_7', 'sr11_7', 'sr_21_8', 'sr21_8']);

// ─── Error / warning tracking ─────────────────────────────────────────────────

const errors   = [];
const warnings = [];

function err(ctrl, msg)  { errors.push(`[${ctrl}] ERROR: ${msg}`); }
function warn(ctrl, msg) { warnings.push(`[${ctrl}] WARN: ${msg}`); }

// ─── Load controls ────────────────────────────────────────────────────────────

/**
 * Load every JSON file in controls/ as an array of control objects.
 * Each file at this domain is an array; file-level parse errors are fatal.
 */
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
    console.error(`No .json files found in '${CONTROLS_DIR}'`);
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

    if (!Array.isArray(data)) {
      errors.push(`[FILE:${file}] ERROR: Root must be a JSON array of control objects, got ${typeof data}`);
      continue;
    }

    for (let i = 0; i < data.length; i++) {
      if (typeof data[i] !== 'object' || data[i] === null) {
        errors.push(`[FILE:${file}][${i}] ERROR: Expected object, got ${typeof data[i]}`);
        continue;
      }
      controls.push({ ...data[i], _file: file, _index: i });
    }
  }
  return controls;
}

// ─── Gate 1a: schema — required fields + enum values ─────────────────────────

function checkSchema(controls) {
  const REQUIRED_TOP = [
    'id', 'layer', 'plane', 'name', 'plain',
    'threat', 'sources', 'implementation', 'validation',
    'lenses', 'maturity', 'coverage_note', 'capability_risk',
  ];

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file}:${ctrl._index})`;

    // Required top-level fields
    for (const field of REQUIRED_TOP) {
      if (ctrl[field] === undefined || ctrl[field] === null) {
        err(id, `Required field '${field}' is absent or null`);
      }
    }

    // $schema declaration
    if (ctrl.$schema && ctrl.$schema !== SCHEMA_URI) {
      warn(id, `$schema should be '${SCHEMA_URI}', got '${ctrl.$schema}'`);
    }

    // layer enum
    if (ctrl.layer !== undefined && !VALID_LAYERS.includes(ctrl.layer)) {
      err(id, `Invalid layer '${ctrl.layer}'. Allowed: ${VALID_LAYERS.join(', ')}`);
    }

    // plane enum
    if (ctrl.plane !== undefined && !VALID_PLANES.includes(ctrl.plane)) {
      err(id, `Invalid plane '${ctrl.plane}'. Allowed: ${VALID_PLANES.join(', ')}`);
    }

    // name / plain length guards
    if (typeof ctrl.name === 'string') {
      if (ctrl.name.length < 4)   err(id, `name is too short (min 4 chars, got ${ctrl.name.length})`);
      if (ctrl.name.length > 80)  err(id, `name exceeds 80-char limit (got ${ctrl.name.length})`);
    }
    if (typeof ctrl.plain === 'string') {
      if (ctrl.plain.length < 20)  err(id, `plain is too short (min 20 chars, got ${ctrl.plain.length})`);
      if (ctrl.plain.length > 500) err(id, `plain exceeds 500-char limit (got ${ctrl.plain.length})`);
    }

    // threat
    if (ctrl.threat && typeof ctrl.threat === 'object') {
      if (!Array.isArray(ctrl.threat.tags) || ctrl.threat.tags.length === 0) {
        err(id, 'threat.tags must be a non-empty array');
      }
      if (typeof ctrl.threat.desc !== 'string' || ctrl.threat.desc.length < 40) {
        err(id, `threat.desc must be a string of at least 40 chars`);
      }
    }

    // maturity
    if (ctrl.maturity && typeof ctrl.maturity === 'object') {
      if (!VALID_MATURITY.includes(ctrl.maturity.current)) {
        err(id, `Invalid maturity.current '${ctrl.maturity.current}'. Allowed: ${VALID_MATURITY.join(', ')}`);
      }
      if (!VALID_MATURITY.includes(ctrl.maturity.target)) {
        err(id, `Invalid maturity.target '${ctrl.maturity.target}'. Allowed: ${VALID_MATURITY.join(', ')}`);
      }
    }

    // readiness
    if (ctrl.readiness !== undefined && !VALID_READINESS.includes(ctrl.readiness)) {
      err(id, `Invalid readiness '${ctrl.readiness}'. Allowed: ${VALID_READINESS.join(', ')}`);
    }

    // thesis_type
    if (ctrl.thesis_type !== undefined && !VALID_THESIS_TYPES.includes(ctrl.thesis_type)) {
      err(id, `Invalid thesis_type '${ctrl.thesis_type}'. Allowed: ${VALID_THESIS_TYPES.join(', ')}`);
    }

    // sources: source_type + normative_force + status enums
    if (Array.isArray(ctrl.sources)) {
      for (const src of ctrl.sources) {
        const sid = src.id ?? 'UNKNOWN';
        if (src.source_type !== undefined && !VALID_SOURCE_TYPES.includes(src.source_type)) {
          err(id, `sources['${sid}'].source_type '${src.source_type}' is not a valid source_type`);
        }
        if (src.normative_force !== undefined && !VALID_NORMATIVE_FORCE.includes(src.normative_force)) {
          err(id, `sources['${sid}'].normative_force '${src.normative_force}' is invalid`);
        }
        if (src.status !== undefined && !VALID_SOURCE_STATUS.includes(src.status)) {
          err(id, `sources['${sid}'].status '${src.status}' is invalid. Allowed: ${VALID_SOURCE_STATUS.join(', ')}`);
        }
      }
    }

    // capability_risk.capability_level enum
    if (ctrl.capability_risk && typeof ctrl.capability_risk === 'object') {
      if (!VALID_CAPABILITY_LEVELS.includes(ctrl.capability_risk.capability_level)) {
        err(id, `capability_risk.capability_level '${ctrl.capability_risk.capability_level}' is invalid. Allowed: ${VALID_CAPABILITY_LEVELS.join(', ')}`);
      }
    }

    // tiers: each value must be a valid profile id
    if (Array.isArray(ctrl.tiers)) {
      const seen = new Set();
      for (const tier of ctrl.tiers) {
        if (!VALID_PROFILES.includes(tier)) {
          err(id, `tiers[]: '${tier}' is not a valid profile. Allowed: ${VALID_PROFILES.join(', ')}`);
        }
        if (seen.has(tier)) {
          err(id, `tiers[]: duplicate profile '${tier}'`);
        }
        seen.add(tier);
      }
    }

    // lenses: exactly the 5 required keys, no extras
    if (ctrl.lenses && typeof ctrl.lenses === 'object') {
      for (const key of REQUIRED_LENSES) {
        if (!ctrl.lenses[key]) {
          err(id, `lenses is missing required key '${key}'`);
        }
      }
      for (const key of Object.keys(ctrl.lenses)) {
        if (!REQUIRED_LENSES.includes(key)) {
          err(id, `lenses has unexpected key '${key}'. Only ${REQUIRED_LENSES.join(', ')} are permitted`);
        }
      }
    }

    // implementation
    if (ctrl.implementation && typeof ctrl.implementation === 'object') {
      if (typeof ctrl.implementation.pattern !== 'string' || ctrl.implementation.pattern.length < 10) {
        err(id, 'implementation.pattern must be a string of at least 10 chars');
      }
      if (!Array.isArray(ctrl.implementation.steps) || ctrl.implementation.steps.length === 0) {
        err(id, 'implementation.steps must be a non-empty array');
      }
    }

    // validation block
    if (ctrl.validation && typeof ctrl.validation === 'object') {
      const v = ctrl.validation;
      if (!Array.isArray(v.design_check)) {
        err(id, 'validation.design_check must be an array');
      }
      if (!Array.isArray(v.runtime_test)) {
        err(id, 'validation.runtime_test must be an array');
      }
      if (!Array.isArray(v.evidence)) {
        err(id, 'validation.evidence must be an array');
      }
    }

    // frameworks enum check (full pattern validation is in audit-mappings)
    if (Array.isArray(ctrl.frameworks)) {
      for (const fw of ctrl.frameworks) {
        if (fw.framework !== undefined && !VALID_FRAMEWORK_KEYS.includes(fw.framework)) {
          err(id, `frameworks[].framework '${fw.framework}' is not a valid key. Allowed: ${VALID_FRAMEWORK_KEYS.join(', ')}`);
        }
        if (fw.rationale && typeof fw.rationale === 'string' && fw.rationale.length < 30) {
          err(id, `frameworks[${fw.framework}].rationale must be at least 30 chars`);
        }
      }
    }

    // monitoring_schema: required for BH and CA; validate structure when present
    if (ctrl.layer && MONITORING_REQUIRED_LAYERS.includes(ctrl.layer) && !ctrl.monitoring_schema) {
      err(id, `monitoring_schema is required for ${ctrl.layer}-layer controls`);
    }

    if (ctrl.monitoring_schema) {
      validateMonitoringSchema(id, ctrl.monitoring_schema);
    }
  }
}

function validateMonitoringSchema(id, ms) {
  // Presence checks: window_context and sampling_rate are structural requirements
  if (!ms.window_context) {
    warn(id, 'monitoring_schema.window_context is recommended (e.g., "rolling-7d")');
  }
  if (!ms.sampling_rate) {
    warn(id, 'monitoring_schema.sampling_rate is recommended (e.g., "100%")');
  }

  // Metrics array must be present and non-empty when monitoring_schema is declared
  const metricsKey = ms.metrics ?? ms.metric_objects ?? ms.kpis;
  if (!Array.isArray(metricsKey) || metricsKey.length === 0) {
    warn(id, 'monitoring_schema.metrics should be a non-empty array of metric objects');
    return;
  }

  // Per-metric checks are advisory — MLOps teams adapt these to their stack
  const metricIds = new Set();
  for (const metric of metricsKey) {
    const mid = metric.metric_id ?? metric.name ?? metric.id ?? 'UNKNOWN';

    // Warn on missing canonical fields (not error — metric schema evolves per deployment)
    for (const f of ['metric_id', 'metric_type', 'measure', 'population', 'comparison', 'severity']) {
      if (metric[f] === undefined || metric[f] === null) {
        warn(id, `monitoring_schema metric '${mid}': recommended field '${f}' is absent`);
      }
    }

    // metric_id uniqueness within this control (warn only)
    if (metricIds.has(mid) && mid !== 'UNKNOWN') {
      warn(id, `monitoring_schema metric '${mid}': duplicate metric_id within this control`);
    }
    metricIds.add(mid);

    // metric_type enum (error if present and invalid)
    if (metric.metric_type !== undefined && !VALID_METRIC_TYPES.includes(metric.metric_type)) {
      warn(id, `monitoring_schema metric '${mid}': metric_type '${metric.metric_type}' is not canonical. Allowed: ${VALID_METRIC_TYPES.join(', ')}`);
    }
  }
}

// ─── Gate 1b: namespaces — ID format, layer-plane assignment, uniqueness ──────

function checkNamespaces(controls) {
  const seenIds = new Map(); // id → file

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file}:${ctrl._index})`;

    // id field must exist
    if (!ctrl.id) {
      err(id, 'Control has no id field');
      continue;
    }

    // ID format: {LAYER}-{NN}
    if (!CONTROL_ID_RE.test(ctrl.id)) {
      err(ctrl.id, `Control ID '${ctrl.id}' does not match pattern {LAYER}-{NN} (e.g., LI-01, CR-08)`);
    }

    // ID uniqueness across the entire corpus
    if (seenIds.has(ctrl.id)) {
      err(ctrl.id, `Duplicate control ID — also appears in '${seenIds.get(ctrl.id)}'`);
    } else {
      seenIds.set(ctrl.id, ctrl._file);
    }

    // Layer prefix in ID must match the layer field
    if (ctrl.id && ctrl.layer) {
      const prefix = ctrl.id.split('-')[0];
      if (prefix !== ctrl.layer) {
        err(ctrl.id, `ID prefix '${prefix}' does not match layer field '${ctrl.layer}'`);
      }
    }

    // Layer-plane assignment (authoritative: LAYER_PLANE map above)
    if (ctrl.layer && ctrl.plane) {
      const expected = LAYER_PLANE[ctrl.layer];
      if (expected && ctrl.plane !== expected) {
        err(ctrl.id, `Layer '${ctrl.layer}' requires plane '${expected}' but control declares '${ctrl.plane}'`);
      }
    }

    // cross_domain references: validate URI pattern
    if (ctrl.cross_domain?.references && Array.isArray(ctrl.cross_domain.references)) {
      const CROSS_DOMAIN_URI_RE = /^apeiris:\/\/[a-z][a-z0-9-]*\/controls\/[A-Z]{2,6}-[0-9]{2}$/;
      for (const ref of ctrl.cross_domain.references) {
        if (ref.uri && !CROSS_DOMAIN_URI_RE.test(ref.uri)) {
          err(ctrl.id, `cross_domain.references[].uri '${ref.uri}' does not match apeiris://<domain>/controls/<LAYER>-<NN>`);
        }
      }
    }
  }
}

// ─── Gate 1c: sources — completeness + cite-or-flag ───────────────────────────

/**
 * Cite-or-flag rules:
 *   design_check items MUST include [ref:source_id] where source_id resolves to sources[].
 *   runtime_test items MUST include either [ref:source_id] or [unverified].
 *   evidence items: no citation requirement (they declare artifact types, not claims).
 */
function checkSources(controls) {
  const REQUIRED_SRC_FIELDS = ['id', 'title', 'authority', 'source_type', 'normative_force', 'version', 'status'];

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file}:${ctrl._index})`;

    if (!Array.isArray(ctrl.sources) || ctrl.sources.length === 0) {
      err(id, 'sources[] must be a non-empty array');
      continue;
    }

    // Build the set of valid source IDs for this control
    const sourceIds = new Set();
    let flagshipCount = 0;

    for (const src of ctrl.sources) {
      const sid = src.id ?? '(missing-id)';

      // Required source fields
      for (const f of REQUIRED_SRC_FIELDS) {
        if (src[f] === undefined || src[f] === null || src[f] === '') {
          err(id, `sources['${sid}'].${f} is required and must be non-empty`);
        }
      }

      // ID format
      if (src.id) {
        if (!SOURCE_ID_RE.test(src.id)) {
          err(id, `sources[].id '${src.id}' must match ^[a-z][a-z0-9_]{1,31}$ (lowercase, underscores only)`);
        }
        sourceIds.add(src.id);

        // Superseded source guard
        if (BANNED_SOURCE_IDS.has(src.id)) {
          err(id, `sources['${src.id}'] is superseded by SR 26-2. Remove it and use sr_26_2 instead.`);
        }
      }

      if (src.flagship === true) flagshipCount++;
    }

    if (flagshipCount === 0) {
      warn(id, 'No source has flagship: true — exactly one should be the primary normative anchor');
    }
    if (flagshipCount > 1) {
      warn(id, `${flagshipCount} sources have flagship: true — only one should be primary`);
    }

    // ── Cite-or-flag: design_check ──
    if (Array.isArray(ctrl.validation?.design_check)) {
      for (let i = 0; i < ctrl.validation.design_check.length; i++) {
        const item = ctrl.validation.design_check[i];
        const match = item.match(CITE_REF_RE);
        const hasUnverified = UNVERIFIED_RE.test(item);
        if (!match && !hasUnverified) {
          err(id, `validation.design_check[${i}]: missing annotation. Must end with [ref:SOURCE_ID] or [unverified].`);
        } else if (match) {
          const refId = match[1];
          if (!sourceIds.has(refId)) {
            err(id, `validation.design_check[${i}]: [ref:${refId}] does not resolve — not found in sources[] of this control. Available IDs: ${[...sourceIds].join(', ')}`);
          }
        } else if (hasUnverified) {
          warn(id, `validation.design_check[${i}]: marked [unverified] — add a source reference before publishing.`);
        }
      }
    }

    // ── Cite-or-flag: runtime_test ──
    if (Array.isArray(ctrl.validation?.runtime_test)) {
      for (let i = 0; i < ctrl.validation.runtime_test.length; i++) {
        const item = ctrl.validation.runtime_test[i];
        const match = item.match(CITE_REF_RE);
        const hasUnverified = UNVERIFIED_RE.test(item);

        if (!match && !hasUnverified) {
          err(id, `validation.runtime_test[${i}]: missing annotation. Must end with [ref:SOURCE_ID] or [unverified].`);
        } else if (match) {
          const refId = match[1];
          if (!sourceIds.has(refId)) {
            err(id, `validation.runtime_test[${i}]: [ref:${refId}] does not resolve — not found in sources[] of this control. Available IDs: ${[...sourceIds].join(', ')}`);
          }
        }
        // [unverified] is accepted without further validation
      }
    }
  }
}

// ─── Gate 1d: source-versions ────────────────────────────────────────────────

/**
 * Validates:
 * - published_on and retrieved_on are valid YYYY-MM-DD dates
 * - artifact_hash follows sha256:<64-hex> or git:<40-hex> format when present
 * - source_hash on framework mappings follows same format
 * - The EU AI Act source version must be 2024/1689
 * - MITRE ATLAS version must reference v5.6.0
 * - Superseded source IDs blocked (belt-and-suspenders, also caught in checkSources)
 */
function checkSourceVersions(controls) {
  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file}:${ctrl._index})`;

    if (!Array.isArray(ctrl.sources)) continue;

    for (const src of ctrl.sources) {
      const sid = src.id ?? 'UNKNOWN';

      // Date format validation
      if (src.published_on && !DATE_RE.test(src.published_on)) {
        err(id, `sources['${sid}'].published_on '${src.published_on}' is not a valid YYYY-MM-DD date`);
      }
      if (src.retrieved_on && !DATE_RE.test(src.retrieved_on)) {
        err(id, `sources['${sid}'].retrieved_on '${src.retrieved_on}' is not a valid YYYY-MM-DD date`);
      }

      // retrieved_on must not precede published_on
      if (src.published_on && src.retrieved_on && DATE_RE.test(src.published_on) && DATE_RE.test(src.retrieved_on)) {
        if (src.retrieved_on < src.published_on) {
          err(id, `sources['${sid}'].retrieved_on '${src.retrieved_on}' is before published_on '${src.published_on}'`);
        }
      }

      // artifact_hash format
      if (src.artifact_hash && !ARTIFACT_HASH_RE.test(src.artifact_hash)) {
        err(id, `sources['${sid}'].artifact_hash must be sha256:<64 hex> or git:<40 hex>`);
      }

      // Version-specific guards
      if (src.source_type === 'binding-law' && src.authority?.includes('European') && src.version !== '2024/1689') {
        warn(id, `sources['${sid}']: EU AI Act version should be '2024/1689', got '${src.version}'`);
      }
      if (src.source_type === 'threat-knowledge-base' && src.authority?.includes('MITRE')) {
        if (src.version && src.version !== '5.6.0') {
          err(id, `sources['${sid}']: MITRE ATLAS version must be '5.6.0', got '${src.version}'. Older versions (5.5.0 and below) are superseded.`);
        }
      }
    }

    // Validate source_hash on framework mapping objects
    if (Array.isArray(ctrl.frameworks)) {
      for (const fw of ctrl.frameworks) {
        if (fw.source_hash && !ARTIFACT_HASH_RE.test(fw.source_hash)) {
          err(id, `frameworks[${fw.framework}].source_hash must be sha256:<64 lowercase hex chars>`);
        }
        if (fw.reviewed_on && !DATE_RE.test(fw.reviewed_on)) {
          err(id, `frameworks[${fw.framework}].reviewed_on '${fw.reviewed_on}' is not a valid YYYY-MM-DD date`);
        }
      }
    }
  }
}

// ─── Gate 1e: licenses ────────────────────────────────────────────────────────

/**
 * Every source must declare a license. ShareAlike (CC BY-SA 4.0) sources
 * trigger a warning reminding authors not to reproduce requirement text.
 */
function checkLicenses(controls) {
  const SHAREALIKES = new Set(['CC BY-SA 4.0', 'CC BY-SA 3.0']);

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file}:${ctrl._index})`;

    if (!Array.isArray(ctrl.sources)) continue;

    for (const src of ctrl.sources) {
      const sid = src.id ?? 'UNKNOWN';

      // License is required on every source
      if (!src.license) {
        err(id, `sources['${sid}'].license is required — specify e.g. 'public-domain', 'CC BY-SA 4.0', 'proprietary-paid'`);
        continue;
      }

      // CC BY-SA ShareAlike warning
      if (SHAREALIKES.has(src.license)) {
        warn(id, `sources['${sid}'] is ${src.license} (ShareAlike). Do not copy requirement text verbatim — map by requirement_id and independent rationale only.`);
      }

      // Proprietary-paid sources: retrieved_on is especially important for staleness tracking
      if (src.license === 'proprietary-paid' && !src.retrieved_on) {
        warn(id, `sources['${sid}'] is proprietary-paid; retrieved_on is strongly recommended for staleness tracking`);
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const CHECK_MAP = {
  schema:           checkSchema,
  namespaces:       checkNamespaces,
  sources:          checkSources,
  'source-versions': checkSourceVersions,
  licenses:         checkLicenses,
};

const args        = process.argv.slice(2);
const flagIdx     = args.indexOf('--check');
const checkTarget = flagIdx >= 0 ? args[flagIdx + 1] : null;

const controls = loadAllControls();
console.log(`validate.mjs — loaded ${controls.length} controls from ${CONTROLS_DIR}`);

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
  // Run all checks in gate order
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

console.log(`\n  ✓ validate.mjs passed (${controls.length} controls, ${warnings.length} warnings)`);
