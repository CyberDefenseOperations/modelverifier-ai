#!/usr/bin/env node
/**
 * build-integration.mjs
 * AI Model & System Assurance Control Matrix — modelverifier.ai
 *
 * Reads the canonical model-controls source (per-layer JSON files under
 * controls/ or a pre-merged controls/model-controls.json) and emits
 * integration/model-controls-full.json — the machine-readable dataset
 * consumed by the Apeiris Model Assurance Verifier and external integrators.
 *
 * Zero runtime dependencies. Uses only Node.js built-ins.
 * Tested against Node.js 20 LTS (ESM + crypto + fs/promises).
 *
 * Usage:
 *   node build-integration.mjs [--controls-dir <path>] [--out-dir <path>] [--strict]
 *
 * Options:
 *   --controls-dir <path>   Directory containing layer JSON files.
 *                           Defaults to: ./controls
 *   --out-dir <path>        Output directory for integration artifacts.
 *                           Defaults to: ./integration
 *   --strict                Fail the build on any validation warning
 *                           (recommended for CI).
 *   --dry-run               Run all transforms and validation but do not
 *                           write output files.
 *
 * Exit codes:
 *   0  Success — integration JSON written
 *   1  Fatal error — see stderr for details
 *   2  Validation warnings present and --strict was set
 */

import { createHash, sign as cryptoSign } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

const SCHEMA_VERSION = '1.0.0';
const DATASET_VERSION = '1.0.0';

/** Canonical layer order. Controls are sorted by this order then by id number. */
const LAYER_ORDER = ['LI', 'TG', 'EV', 'OA', 'BH', 'CR'];

/** Canonical layer metadata matching namespace-registry.json. */
const LAYER_DEFINITIONS = {
  LI: {
    code: 'LI',
    name: 'AI Asset, Lineage and Applicability',
    plane: 'control',
    ordinal: 1,
    description:
      'Controls governing unique model identity, provenance chains, supply-chain ' +
      'integrity, structured documentation, training data lineage, version management, ' +
      'risk classification, license obligations, system-level composition, and ' +
      'applicability determination.',
    baseline_controls: ['LI-01', 'LI-04', 'LI-06'],
  },
  TG: {
    code: 'TG',
    name: 'Training and Data Governance',
    plane: 'data',
    ordinal: 2,
    description:
      'Controls governing dataset quality, documentation, provenance, data poisoning ' +
      'prevention, training/evaluation separation and contamination prevention, ' +
      'sensitive-data handling, and continuously-learning feedback-loop integrity.',
    baseline_controls: ['TG-01', 'TG-05'],
  },
  EV: {
    code: 'EV',
    name: 'Evaluation, Independent Validation and Release',
    plane: 'both',
    ordinal: 3,
    description:
      'Controls governing pre-release evaluation, fitness and safety assessment, ' +
      'dangerous capability assessment, adversarial red-team testing, fairness ' +
      'evaluation, reproducible evaluation design, regression testing, independent ' +
      'validation, impact and applicability classification, and evaluation evidence ' +
      'integrity.',
    baseline_controls: ['EV-01', 'EV-06', 'EV-07', 'EV-09'],
  },
  OA: {
    code: 'OA',
    name: 'Governance, Accountability and Use-Case Oversight',
    plane: 'control',
    ordinal: 4,
    description:
      'Controls governing named accountable ownership, human oversight adequacy, ' +
      'AI governance committee structure, autonomy and agency controls, model-use ' +
      'policy, incident decision authority, escalation paths, and notice and ' +
      'contestability mechanisms for affected parties.',
    baseline_controls: ['OA-01', 'OA-07'],
  },
  BH: {
    code: 'BH',
    name: 'Deployment and Runtime Assurance',
    plane: 'data',
    ordinal: 5,
    description:
      'Controls governing deployment authorization, input distribution monitoring, ' +
      'production performance monitoring, behavioral boundary enforcement, audit ' +
      'logging, immutable rollback capability, rate and cost controls, ' +
      'feedback-loop integrity, synthetic content provenance, and provider change ' +
      'monitoring.',
    baseline_controls: ['BH-03', 'BH-05'],
  },
  CR: {
    code: 'CR',
    name: 'Continuous Risk, Incident and Evidence Assurance',
    plane: 'lifecycle',
    ordinal: 6,
    description:
      'Controls governing periodic and event-driven re-evaluation, incident ' +
      'investigation and corrective action, material-change determination, ' +
      'outcomes and disparate-impact analysis, long-term evidence integrity, ' +
      'continuous risk monitoring, model decommissioning, and cross-domain ' +
      'compliance evidence.',
    baseline_controls: ['CR-01', 'CR-02'],
  },
};

const PLANE_DEFINITIONS = [
  {
    id: 'control',
    name: 'Control Plane',
    description:
      'Governs identity, documentation, governance policies, accountability ' +
      'assignments, and assurance state. These controls define what the system ' +
      'is and who is responsible for it.',
    layers: ['LI', 'OA'],
  },
  {
    id: 'data',
    name: 'Data Plane',
    description:
      'Governs what flows into and out of the model — training data, runtime ' +
      'inputs, inference outputs, and behavioral signals. Controls prevent ' +
      'data poisoning, monitor drift, enforce logging, and protect runtime ' +
      'integrity.',
    layers: ['TG', 'BH'],
  },
  {
    id: 'both',
    name: 'Control and Data Plane',
    description:
      'Controls that span both the control plane (governance of evaluation ' +
      'decisions, release authorization) and the data plane (measurement of ' +
      'model behavior, evaluation datasets). EV controls gate release and ' +
      'produce evidence consumed by both planes.',
    layers: ['EV'],
  },
  {
    id: 'lifecycle',
    name: 'Lifecycle Plane',
    description:
      'Governs the ongoing assurance lifecycle: periodic re-evaluation, incident ' +
      'response, corrective action, evidence validity, and decommissioning. ' +
      'These controls are event-driven rather than deployment-point controls.',
    layers: ['CR'],
  },
];

const BASELINE_CONTROLS = [
  'LI-01', 'LI-04', 'LI-06',
  'TG-01', 'TG-05',
  'EV-01', 'EV-06', 'EV-07', 'EV-09',
  'OA-01', 'OA-07',
  'BH-03', 'BH-05',
  'CR-01', 'CR-02',
];

const FRAMEWORK_KEYS = ['nist_rmf', 'nist_ai_600_1', 'iso_42001', 'eu_ai_act', 'sr262', 'aisvs', 'llm10', 'aicm', 'mitre', 'owasp_aitg'];

const FRAMEWORK_DISPLAY = {
  nist_rmf:       { name: 'NIST AI RMF 1.0',                           authority: 'NIST' },
  nist_ai_600_1:  { name: 'NIST AI 600-1 GenAI Profile',               authority: 'NIST' },
  iso_42001:      { name: 'ISO/IEC 42001:2023',                         authority: 'ISO/IEC JTC 1/SC 42' },
  eu_ai_act:      { name: 'EU AI Act (Regulation 2024/1689)',           authority: 'European Parliament and Council' },
  sr262:          { name: 'SR 26-2 — Model Risk Management',            authority: 'Federal Reserve Board' },
  aisvs:          { name: 'OWASP AI Security Verification Standard v1.0', authority: 'OWASP' },
  llm10:          { name: 'OWASP LLM Top 10 2025',                      authority: 'OWASP' },
  aicm:           { name: 'CSA AI Controls Matrix v1.1',                authority: 'Cloud Security Alliance' },
  mitre:          { name: 'MITRE ATLAS v5.6.0',                         authority: 'MITRE Corporation' },
  owasp_aitg:     { name: 'OWASP AI Testing Guide v1',                  authority: 'OWASP' },
};

const PROFILE_IDS = [
  'general-predictive-ml',
  'generative-ai',
  'multimodal',
  'hosted-api',
  'continuously-learning',
  'high-impact-decision',
  'us-regulated-banking',
  'eu-high-risk',
  'gpai-provider',
  'gpai-systemic-risk',
  'frontier-capability',
];

/** Fields to strip from each control record before publishing.
 *  These are build/authoring-only fields that consumers do not need. */
const STRIP_FIELDS = new Set(['$schema']);

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    controlsDir: resolve(__dirname, 'controls'),
    outDir: resolve(__dirname, 'integration'),
    strict: false,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--controls-dir':
        args.controlsDir = resolve(argv[++i]);
        break;
      case '--out-dir':
        args.outDir = resolve(argv[++i]);
        break;
      case '--strict':
        args.strict = true;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      default:
        if (argv[i].startsWith('--')) {
          console.error(`[build-integration] Unknown argument: ${argv[i]}`);
          process.exit(1);
        }
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Source loading
// ---------------------------------------------------------------------------

/**
 * Load and merge all control records from the controls directory.
 *
 * Resolution order:
 *   1. controls/model-controls.json  — pre-merged canonical source
 *   2. controls/LI.json, TG.json, EV.json, OA.json, BH.json, CR.json
 *      — per-layer files, merged in LAYER_ORDER sequence
 *
 * Returns a flat array of raw control objects (not yet transformed).
 */
async function loadControls(controlsDir) {
  const canonical = join(controlsDir, 'model-controls.json');

  if (existsSync(canonical)) {
    console.log(`[load] Reading canonical source: ${canonical}`);
    const raw = await readFile(canonical, 'utf8');
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { throw new Error(`Failed to parse ${canonical}: ${e.message}`); }
    const controls = Array.isArray(parsed) ? parsed : parsed.controls ?? parsed.dataset?.controls;
    if (!Array.isArray(controls)) {
      throw new Error(`model-controls.json must export an array of controls or {controls: [...]}. Got: ${typeof controls}`);
    }
    console.log(`[load] Loaded ${controls.length} controls from canonical source.`);
    return controls;
  }

  // Fall back to per-layer files
  console.log(`[load] No model-controls.json found. Scanning per-layer files in: ${controlsDir}`);
  const allControls = [];
  for (const layer of LAYER_ORDER) {
    const layerFile = join(controlsDir, `${layer}.json`);
    if (!existsSync(layerFile)) {
      console.warn(`[load] WARNING: Layer file not found: ${layerFile}`);
      continue;
    }
    const raw = await readFile(layerFile, 'utf8');
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { throw new Error(`Failed to parse ${layerFile}: ${e.message}`); }
    const layerControls = Array.isArray(parsed) ? parsed : [];
    console.log(`[load]   ${layer}.json — ${layerControls.length} controls`);
    allControls.push(...layerControls);
  }

  if (allControls.length === 0) {
    throw new Error(`No controls loaded. Ensure controls/ contains model-controls.json or per-layer files (LI.json, TG.json, ...).`);
  }

  console.log(`[load] Loaded ${allControls.length} controls from per-layer files.`);
  return allControls;
}

/**
 * Load the profiles definition from schema/profiles.json.
 * Falls back to an empty profiles array with a warning if not found.
 */
async function loadProfiles(schemaDir) {
  const profilesFile = join(schemaDir, 'profiles.json');
  if (!existsSync(profilesFile)) {
    console.warn(`[load] WARNING: profiles.json not found at ${profilesFile}. profiles[] will be empty.`);
    return { profiles: [], profile_matrix: null };
  }
  const raw = await readFile(profilesFile, 'utf8');
  try { return JSON.parse(raw); } catch (e) { throw new Error(`Failed to parse ${profilesFile}: ${e.message}`); }
}

/**
 * Load the framework mapping catalog from schema/framework-mapping-catalog.json.
 */
async function loadFrameworkCatalog(schemaDir) {
  const catalogFile = join(schemaDir, 'framework-mapping-catalog.json');
  if (!existsSync(catalogFile)) {
    console.warn(`[load] WARNING: framework-mapping-catalog.json not found.`);
    return { frameworks: {} };
  }
  const raw = await readFile(catalogFile, 'utf8');
  try { return JSON.parse(raw); } catch (e) { throw new Error(`Failed to parse ${catalogFile}: ${e.message}`); }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a single control record and return an array of warning strings.
 * Warnings are non-fatal in non-strict mode.
 */
function validateControl(ctrl) {
  const warnings = [];
  const id = ctrl.id ?? '(unknown)';

  const requiredFields = ['id', 'layer', 'plane', 'name', 'plain', 'threat', 'sources', 'implementation', 'validation', 'lenses', 'maturity', 'coverage_note', 'capability_risk'];
  for (const f of requiredFields) {
    if (ctrl[f] === undefined || ctrl[f] === null) {
      warnings.push(`${id}: missing required field '${f}'`);
    }
  }

  if (ctrl.id && !/^(LI|TG|EV|OA|BH|CR)-[0-9]{2}$/.test(ctrl.id)) {
    warnings.push(`${id}: invalid id format (expected LAYER-NN)`);
  }

  if (ctrl.layer && !LAYER_ORDER.includes(ctrl.layer)) {
    warnings.push(`${id}: unknown layer '${ctrl.layer}'`);
  }

  if (ctrl.layer && ctrl.id && !ctrl.id.startsWith(ctrl.layer + '-')) {
    warnings.push(`${id}: layer '${ctrl.layer}' does not match id prefix`);
  }

  if (ctrl.readiness === 'draft') {
    warnings.push(`${id}: readiness is 'draft' — control will be included but flagged`);
  }

  if (ctrl.sources && ctrl.sources.length > 0) {
    const hasFlagship = ctrl.sources.some(s => s.flagship === true);
    if (!hasFlagship) {
      warnings.push(`${id}: no source has flagship: true`);
    }
  }

  if (ctrl.frameworks && Array.isArray(ctrl.frameworks)) {
    const hasNist = ctrl.frameworks.some(f => f.framework === 'nist_rmf');
    const hasIso = ctrl.frameworks.some(f => f.framework === 'iso_42001');
    if (!hasNist) warnings.push(`${id}: no nist_rmf framework mapping`);
    if (!hasIso) warnings.push(`${id}: no iso_42001 framework mapping`);

    for (const mapping of ctrl.frameworks) {
      if (mapping.fit === 'partial' && !mapping.uncovered_portion) {
        warnings.push(`${id}: mapping to '${mapping.framework}/${mapping.requirement_id}' has fit:'partial' but no uncovered_portion`);
      }
      if (mapping.fit === 'direct' && !mapping.source_locator) {
        warnings.push(`${id}: mapping to '${mapping.framework}/${mapping.requirement_id}' has fit:'direct' but no source_locator`);
      }
      if (mapping.rationale && mapping.rationale.length < 30) {
        warnings.push(`${id}: mapping rationale to '${mapping.framework}' is too short (< 30 chars)`);
      }
    }
  }

  if (ctrl.obligations && Array.isArray(ctrl.obligations)) {
    for (const obl of ctrl.obligations) {
      if (['eu_ai_act', 'sr262'].includes(obl.source_ref)) {
        if (!obl.effective_from && obl.normative_force === 'binding-law') {
          warnings.push(`${id}: obligation from '${obl.source_ref}' is binding-law but has no effective_from`);
        }
      }
      if (obl.source_ref === 'sr262' && obl.normative_force === 'binding-law') {
        warnings.push(`${id}: SR 26-2 obligation must have normative_force:'supervisory-guidance', not 'binding-law'`);
      }
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Transform: strip internal fields from a control
// ---------------------------------------------------------------------------

function stripInternalFields(ctrl) {
  const out = {};
  for (const [key, value] of Object.entries(ctrl)) {
    if (!STRIP_FIELDS.has(key)) {
      out[key] = value;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

function controlSortKey(ctrl) {
  const layerIdx = LAYER_ORDER.indexOf(ctrl.layer ?? '');
  const num = parseInt((ctrl.id ?? '').split('-')[1] ?? '99', 10);
  return layerIdx * 1000 + num;
}

// ---------------------------------------------------------------------------
// Aggregate builders
// ---------------------------------------------------------------------------

/**
 * Build the deduplicated references array from all sources across all controls.
 * Each reference is uniquely keyed by its `id` field.
 * Controls that cite the same source (e.g., nist_rmf_100_1) share one entry.
 */
function buildReferences(controls) {
  const seen = new Map();
  for (const ctrl of controls) {
    for (const src of ctrl.sources ?? []) {
      if (!seen.has(src.id)) {
        seen.set(src.id, {
          id: src.id,
          title: src.title,
          authority: src.authority,
          source_type: src.source_type,
          normative_force: src.normative_force,
          version: src.version,
          published_on: src.published_on ?? null,
          retrieved_on: src.retrieved_on ?? null,
          artifact_hash: src.artifact_hash ?? null,
          canonical_url: src.canonical_url ?? null,
          license: src.license ?? null,
          supersedes: src.supersedes ?? null,
          status: src.status,
          flagship: src.flagship ?? false,
          cited_by: [],
        });
      }
      seen.get(src.id).cited_by.push(ctrl.id);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Build the layers array: one entry per layer with control counts,
 * baseline flagging, and a list of control ids in that layer.
 */
function buildLayers(controls) {
  return LAYER_ORDER.map(code => {
    const def = LAYER_DEFINITIONS[code];
    const layerControls = controls
      .filter(c => c.layer === code)
      .map(c => c.id)
      .sort();
    const baselineInLayer = BASELINE_CONTROLS.filter(b => b.startsWith(code + '-'));
    return {
      code,
      name: def.name,
      plane: def.plane,
      ordinal: def.ordinal,
      description: def.description,
      control_count: layerControls.length,
      baseline_control_count: baselineInLayer.length,
      baseline_controls: baselineInLayer,
      controls: layerControls,
    };
  });
}

/**
 * Build the planes array: summary of each assurance plane.
 */
function buildPlanes(controls) {
  return PLANE_DEFINITIONS.map(plane => {
    const planeControls = controls
      .filter(c => {
        const layerPlane = LAYER_DEFINITIONS[c.layer]?.plane;
        return layerPlane === plane.id || (plane.id === 'both' && layerPlane === 'both');
      })
      .map(c => c.id);
    return {
      ...plane,
      control_count: planeControls.length,
      controls: planeControls,
    };
  });
}

/**
 * Build the gaps array: controls with partial or adjacent framework mappings,
 * or that have documented uncovered_portions. These represent assurance gaps
 * that consumers should be aware of.
 */
function buildGaps(controls) {
  const gaps = [];
  for (const ctrl of controls) {
    const controlGaps = [];
    for (const mapping of ctrl.frameworks ?? []) {
      if (mapping.fit === 'partial' && mapping.uncovered_portion) {
        controlGaps.push({
          framework: mapping.framework,
          requirement_id: mapping.requirement_id,
          fit: mapping.fit,
          uncovered_portion: mapping.uncovered_portion,
        });
      } else if (mapping.fit === 'adjacent' || mapping.fit === 'none') {
        controlGaps.push({
          framework: mapping.framework,
          requirement_id: mapping.requirement_id,
          fit: mapping.fit,
          uncovered_portion: mapping.uncovered_portion ?? null,
          note: mapping.rationale?.substring(0, 200) ?? null,
        });
      }
    }
    if (controlGaps.length > 0) {
      gaps.push({
        control_id: ctrl.id,
        control_name: ctrl.name,
        layer: ctrl.layer,
        gaps: controlGaps,
      });
    }
  }
  return gaps;
}

/**
 * Build the profiles array for the integration output.
 * Derives from the loaded profiles.json, enriching each profile with
 * a control count and full control applicability summary.
 */
function buildProfiles(profilesData, controls) {
  if (!profilesData?.profiles) return [];
  const controlIds = new Set(controls.map(c => c.id));

  return profilesData.profiles.map(profile => {
    // Verify that referenced controls exist in the loaded dataset
    const unknownRequired = (profile.required_controls ?? []).filter(id => !controlIds.has(id));
    const unknownRecommended = (profile.recommended_controls ?? []).filter(id => !controlIds.has(id));
    if (unknownRequired.length > 0) {
      console.warn(`[profiles] Profile '${profile.profile_id}' references unknown required controls: ${unknownRequired.join(', ')}`);
    }

    return {
      profile_id: profile.profile_id,
      name: profile.name,
      description: profile.description,
      version: profile.version,
      trigger_conditions: profile.trigger_conditions ?? null,
      heightened_trigger: profile.heightened_trigger ?? null,
      enforcement_gating: profile.enforcement_gating ?? null,
      required_controls: profile.required_controls ?? [],
      recommended_controls: profile.recommended_controls ?? [],
      not_applicable_controls: profile.not_applicable_controls ?? [],
      not_applicable_rationale: profile.not_applicable_rationale ?? null,
      required_control_count: (profile.required_controls ?? []).length,
      recommended_control_count: (profile.recommended_controls ?? []).length,
      profile_specific_notes: profile.profile_specific_notes ?? null,
      eu_ai_act_mapping: profile.eu_ai_act_mapping ?? null,
      // Validation metadata (not published to consumers)
      _unknown_required: unknownRequired.length > 0 ? unknownRequired : undefined,
      _unknown_recommended: unknownRecommended.length > 0 ? unknownRecommended : undefined,
    };
  }).map(p => {
    // Strip internal validation metadata
    const { _unknown_required, _unknown_recommended, ...pub } = p;
    return pub;
  });
}

/**
 * Build the patterns array: one entry per control, extracting the
 * implementation.pattern summary for quick consumption.
 */
function buildPatterns(controls) {
  return controls.map(ctrl => ({
    control_id: ctrl.id,
    layer: ctrl.layer,
    name: ctrl.name,
    pattern: ctrl.implementation?.pattern ?? null,
    anti_patterns: ctrl.implementation?.anti_patterns ?? [],
    implementers: ctrl.implementers ?? [],
    thesis_type: ctrl.thesis_type ?? null,
  }));
}

/**
 * Build the threat_scenarios array: deduplicated and aggregated threat entries
 * across all controls, grouped by threat tag.
 */
function buildThreatScenarios(controls) {
  const tagMap = new Map();

  for (const ctrl of controls) {
    const threat = ctrl.threat;
    if (!threat?.tags) continue;
    for (const tag of threat.tags) {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, {
          tag,
          controls: [],
          desc_samples: [],
        });
      }
      const entry = tagMap.get(tag);
      entry.controls.push(ctrl.id);
      if (entry.desc_samples.length < 3 && threat.desc) {
        // Include a short excerpt per tag for context
        entry.desc_samples.push({
          control_id: ctrl.id,
          excerpt: threat.desc.substring(0, 300),
        });
      }
    }
  }

  return Array.from(tagMap.entries())
    .map(([tag, data]) => ({
      tag,
      control_count: data.controls.length,
      controls: data.controls,
      desc_samples: data.desc_samples,
    }))
    .sort((a, b) => b.control_count - a.control_count);
}

/**
 * Build the framework_coverage array: per-framework statistics derived from
 * all controls' frameworks[] mappings.
 */
function buildFrameworkCoverage(controls) {
  const stats = {};
  for (const fk of FRAMEWORK_KEYS) {
    stats[fk] = {
      framework: fk,
      display_name: FRAMEWORK_DISPLAY[fk]?.name ?? fk,
      authority: FRAMEWORK_DISPLAY[fk]?.authority ?? null,
      total_mappings: 0,
      fit_distribution: { direct: 0, partial: 0, adjacent: 0, supporting: 0, none: 0 },
      by_layer: Object.fromEntries(LAYER_ORDER.map(l => [l, 0])),
      by_confidence: { verified: 0, high: 0, medium: 0, low: 0, speculative: 0 },
      controls_mapped: [],
    };
  }

  for (const ctrl of controls) {
    for (const mapping of ctrl.frameworks ?? []) {
      const fk = mapping.framework;
      if (!stats[fk]) continue;
      stats[fk].total_mappings++;
      stats[fk].fit_distribution[mapping.fit] = (stats[fk].fit_distribution[mapping.fit] ?? 0) + 1;
      stats[fk].by_layer[ctrl.layer] = (stats[fk].by_layer[ctrl.layer] ?? 0) + 1;
      if (mapping.mapping_confidence) {
        stats[fk].by_confidence[mapping.mapping_confidence] =
          (stats[fk].by_confidence[mapping.mapping_confidence] ?? 0) + 1;
      }
      if (!stats[fk].controls_mapped.includes(ctrl.id)) {
        stats[fk].controls_mapped.push(ctrl.id);
      }
    }
  }

  return FRAMEWORK_KEYS.map(fk => ({
    ...stats[fk],
    controls_mapped_count: stats[fk].controls_mapped.length,
    coverage_pct: controls.length > 0
      ? Math.round((stats[fk].controls_mapped.length / controls.length) * 100)
      : 0,
  }));
}

/**
 * Build the regulatory_coverage array: summarises which controls carry
 * obligations[] entries for each regulatory instrument.
 */
function buildRegulatoryCoverage(controls) {
  // Derive instrument from obligation.instrument (new format) or obligation.id (old format)
  function deriveInstrument(obl) {
    if (obl.instrument) return obl.instrument;
    const id = (obl.id ?? '').toLowerCase();
    if (id.startsWith('eu-aia-') || id.startsWith('eu-ai-act') || id.startsWith('eu_ai_act') || id.startsWith('eu_aia') || id === 'ob-cr-01-eu') {
      return 'Regulation (EU) 2024/1689';
    }
    if (id.startsWith('sr262-') || id.startsWith('sr26-') || id === 'sr262-effective-challenge' || id === 'ob-cr-01-sr') {
      return 'SR 26-2';
    }
    if (id.startsWith('gdpr')) return 'Regulation (EU) 2016/679';
    if (id.startsWith('ccpa')) return 'California Consumer Privacy Act';
    if (id.startsWith('us-fcra')) return 'Fair Credit Reporting Act';
    if (id.startsWith('c2pa')) return 'C2PA Content Credentials';
    if (id.startsWith('nist-ai-100-4')) return 'NIST AI 100-4';
    return null; // skip unknown
  }

  // Map instrument → framework_key
  const INSTRUMENT_TO_FRAMEWORK_KEY = {
    'Regulation (EU) 2024/1689': 'eu_ai_act',
    'SR 26-2': 'sr262',
    'Regulation (EU) 2016/679': null, // GDPR — not in our framework_keys
    'California Consumer Privacy Act': null,
    'Fair Credit Reporting Act': null,
    'C2PA Content Credentials': null,
    'NIST AI 100-4': null,
  };

  const instrumentMap = new Map();

  for (const ctrl of controls) {
    for (const obl of ctrl.obligations ?? []) {
      const instrument = deriveInstrument(obl);
      if (!instrument) continue;
      if (!instrumentMap.has(instrument)) {
        instrumentMap.set(instrument, {
          framework_key: INSTRUMENT_TO_FRAMEWORK_KEY[instrument] ?? null,
          instrument,
          authority: obl.authority ?? (instrument === 'Regulation (EU) 2024/1689' ? 'European Union' : obl.jurisdiction ?? null),
          normative_force: obl.normative_force ?? (obl.binding ? 'binding-law' : 'supervisory-guidance'),
          legal_status: obl.legal_status ?? 'enacted',
          effective_from: obl.effective_from ?? obl.effective_date ?? null,
          jurisdiction: Array.isArray(obl.jurisdiction) ? obl.jurisdiction : (obl.jurisdiction ? [obl.jurisdiction] : []),
          sector: obl.sector ?? [],
          controls: [],
          provision_count: 0,
        });
      }
      const entry = instrumentMap.get(instrument);
      entry.provision_count++;
      if (!entry.controls.includes(ctrl.id)) {
        entry.controls.push(ctrl.id);
      }
    }
  }

  return Array.from(instrumentMap.values())
    .map(e => ({
      ...e,
      control_count: e.controls.length,
    }))
    .sort((a, b) => b.control_count - a.control_count);
}

/**
 * Build the capability_coverage array: summarises controls by capability_risk
 * levels to support filtering by capability tier.
 */
function buildCapabilityCoverage(controls) {
  const levels = ['universal', 'low', 'elevated', 'frontier'];
  const result = [];

  for (const level of levels) {
    const matched = controls.filter(c =>
      (level === 'universal')
        ? (!c.capability_risk || c.capability_risk.capability_level === 'none' || c.capability_risk.capability_level === 'universal')
        : c.capability_risk?.capability_level === level
    );
    result.push({
      capability_level: level,
      control_count: matched.length,
      controls: matched.map(c => c.id),
      by_layer: Object.fromEntries(
        LAYER_ORDER.map(l => [l, matched.filter(c => c.layer === l).length])
      ),
    });
  }

  // Also report by individual capability_domain
  const domainMap = new Map();
  for (const ctrl of controls) {
    for (const domain of ctrl.capability_risk?.capability_domains ?? []) {
      if (!domainMap.has(domain)) domainMap.set(domain, []);
      domainMap.get(domain).push(ctrl.id);
    }
  }

  return { by_level: result, by_domain: Object.fromEntries(
    Array.from(domainMap.entries()).map(([domain, ids]) => [domain, { control_count: ids.length, controls: ids }])
  )};
}

/**
 * Build the lifecycle array: ordered lifecycle stages representing the model
 * assurance lifecycle, derived from the layer sequence.
 */
function buildLifecycle(controls) {
  return LAYER_ORDER.map((code, idx) => {
    const def = LAYER_DEFINITIONS[code];
    const layerControls = controls.filter(c => c.layer === code);
    return {
      stage: idx + 1,
      layer: code,
      name: def.name,
      plane: def.plane,
      control_count: layerControls.length,
      thesis_types: [...new Set(layerControls.map(c => c.thesis_type).filter(Boolean))],
      required_for_baseline: BASELINE_CONTROLS.filter(id => id.startsWith(code + '-')),
    };
  });
}

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

function sha256(content) {
  return 'sha256:' + createHash('sha256').update(content).digest('hex');
}

// ---------------------------------------------------------------------------
// Main build
// ---------------------------------------------------------------------------

async function build(args) {
  const schemaDir = resolve(__dirname, 'schema');
  const warnings = [];

  console.log('[build-integration] Starting build...');
  console.log(`[build-integration] Controls dir:  ${args.controlsDir}`);
  console.log(`[build-integration] Output dir:    ${args.outDir}`);
  console.log(`[build-integration] Strict mode:   ${args.strict}`);
  console.log(`[build-integration] Dry run:       ${args.dryRun}`);

  // 1. Load source data
  const rawControls = await loadControls(args.controlsDir);
  const profilesData = await loadProfiles(schemaDir);
  const frameworkCatalog = await loadFrameworkCatalog(schemaDir);

  // 2. Validate
  console.log('[validate] Validating controls...');
  for (const ctrl of rawControls) {
    const ctrlWarnings = validateControl(ctrl);
    warnings.push(...ctrlWarnings);
  }
  if (warnings.length > 0) {
    console.warn(`[validate] ${warnings.length} validation warning(s):`);
    for (const w of warnings) {
      console.warn(`  WARNING: ${w}`);
    }
  } else {
    console.log('[validate] All controls passed validation.');
  }

  // 3. Sort and transform controls
  const sortedControls = [...rawControls].sort((a, b) => controlSortKey(a) - controlSortKey(b));
  const publicControls = sortedControls.map(stripInternalFields);

  // 4. Build aggregated sections
  console.log('[build] Building aggregated sections...');
  const references      = buildReferences(sortedControls);
  const layers          = buildLayers(sortedControls);
  const planes          = buildPlanes(sortedControls);
  const gaps            = buildGaps(sortedControls);
  const profiles        = buildProfiles(profilesData, sortedControls);
  const patterns        = buildPatterns(sortedControls);
  const threatScenarios = buildThreatScenarios(sortedControls);
  const frameworkCov    = buildFrameworkCoverage(sortedControls);
  const regulatoryCov   = buildRegulatoryCoverage(sortedControls);
  const capabilityCov   = buildCapabilityCoverage(sortedControls);
  const lifecycle       = buildLifecycle(sortedControls);

  // 5. Assemble the dataset
  const generatedAt = new Date().toISOString();

  const dataset = {
    meta: {
      title: 'AI Model & System Assurance Control Matrix',
      subtitle: 'modelverifier.ai — Apeiris Model Assurance Verifier',
      domain: 'model',
      namespace: 'apeiris://model',
      site: 'https://modelverifier.ai',
      corpus_url: 'https://modelverifier.ai/integration/model-controls-full.json',
      version: DATASET_VERSION,
      schema_version: SCHEMA_VERSION,
      generated_at: generatedAt,
      generated_by: 'build-integration.mjs',
      source_schema: 'https://schema.apeiris.ai/model-assurance/v1/model-controls.schema.json',
      license: 'CC BY-NC 4.0',
      license_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
      aisvs_compatibility_note:
        'Portions of this dataset reference OWASP AI Security Verification Standard ' +
        'v1.0 (CC BY-SA 4.0). Requirement text is paraphrased under fair use and ' +
        'independent authorship — not reproduced verbatim. Mapping identifiers ' +
        '(e.g., C1.1) are used as locators only. See INTEGRATION-GUIDE.md §License.',
      release_manifest_url: 'https://modelverifier.ai/integration/release-manifest.json',
      cors: 'enabled',
      control_count: publicControls.length,
      baseline_control_count: BASELINE_CONTROLS.length,
      baseline_controls: BASELINE_CONTROLS,
      layer_count: LAYER_ORDER.length,
      profile_count: profiles.length,
      framework_count: FRAMEWORK_KEYS.length,
      frameworks: FRAMEWORK_KEYS,
      profiles: PROFILE_IDS,
      planes: PLANE_DEFINITIONS.map(p => p.id),
      has_warnings: warnings.length > 0,
      warning_count: warnings.length,
    },
    controls: publicControls,
    references,
    layers,
    planes,
    gaps,
    profiles,
    patterns,
    threat_scenarios: threatScenarios,
    framework_coverage: frameworkCov,
    regulatory_coverage: regulatoryCov,
    capability_coverage: capabilityCov.by_level,
    capability_coverage_by_domain: capabilityCov.by_domain,
    lifecycle,
  };

  // 6. Serialize — wrap in {dataset: ...} for consumer destructuring
  const root = { dataset };

  // Compute hash of the JSON WITHOUT content_hash embedded, then embed it.
  // Verification: parse file → delete dataset.meta.content_hash → JSON.stringify(parsed, null, 2) → sha256 → compare to meta.content_hash
  const jsonWithoutHash = JSON.stringify(root, null, 2);
  const contentHash = sha256(jsonWithoutHash);
  root.dataset.meta.content_hash = contentHash;
  const finalJson = JSON.stringify(root, null, 2);

  console.log(`[build] Dataset assembled.`);
  console.log(`[build]   Controls:         ${publicControls.length}`);
  console.log(`[build]   References:       ${references.length}`);
  console.log(`[build]   Framework gaps:   ${gaps.length} controls with partial/adjacent mappings`);
  console.log(`[build]   Profiles:         ${profiles.length}`);
  console.log(`[build]   Threat tags:      ${threatScenarios.length}`);
  console.log(`[build]   Content hash:     ${contentHash}`);

  if (args.dryRun) {
    console.log('[build-integration] Dry run — no files written.');
    return { warnings, contentHash };
  }

  // 7. Write output
  await mkdir(args.outDir, { recursive: true });

  const outPath = join(args.outDir, 'model-controls-full.json');
  await writeFile(outPath, finalJson, 'utf8');
  console.log(`[build-integration] Written: ${outPath}`);

  // 8. Sign the content hash with the Ed25519 release key (if available)
  let signature = null;
  const privKeyPem = process.env.MODEL_VERIFIER_SIGNING_KEY;
  if (privKeyPem) {
    try {
      const sigBuffer = cryptoSign(null, Buffer.from(contentHash, 'utf8'), privKeyPem.trim());
      signature = sigBuffer.toString('base64');
      console.log(`[sign] Manifest signed with Ed25519. Sig: ${signature.substring(0, 20)}...`);
    } catch (e) {
      console.warn(`[sign] WARNING: Ed25519 signing failed: ${e.message}`);
    }
  } else {
    console.log('[sign] MODEL_VERIFIER_SIGNING_KEY not set — unsigned build (normal for local dev).');
  }

  // 9. Write release manifest
  const manifest = {
    manifest_version: '1.0.0',
    domain: 'model',
    dataset_version: DATASET_VERSION,
    generated_at: generatedAt,
    artifacts: [
      {
        artifact_id: 'model-controls-full.json',
        filename: 'model-controls-full.json',
        url: 'https://modelverifier.ai/integration/model-controls-full.json',
        content_hash: contentHash,
        content_length_hint: finalJson.length,
        encoding: 'utf-8',
        media_type: 'application/json',
      },
    ],
    signature: signature ? {
      algorithm: 'Ed25519',
      signed_field: 'content_hash',
      value: signature,
      public_key_url: 'https://modelverifier.ai/.well-known/apeiris-release.pub',
      signed_at: generatedAt,
    } : null,
    warnings: warnings.length > 0 ? warnings : null,
  };
  const manifestPath = join(args.outDir, 'release-manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[build-integration] Written: ${manifestPath}`);

  return { warnings, contentHash };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv);

try {
  const { warnings } = await build(args);

  if (warnings.length > 0 && args.strict) {
    console.error(`[build-integration] STRICT MODE: ${warnings.length} warning(s) treated as errors.`);
    process.exit(2);
  }

  console.log('[build-integration] Done.');
  process.exit(0);
} catch (err) {
  console.error('[build-integration] FATAL:', err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
}
