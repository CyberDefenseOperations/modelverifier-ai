#!/usr/bin/env node
/**
 * check-freshness.mjs — Gate 12 of the modelverifier.ai build pipeline.
 *
 * Flags stale reviewed_on dates on high-confidence framework mappings and
 * stale retrieved_on dates on source records.
 *
 * Staleness thresholds (overridable via environment variables):
 *   FRESHNESS_MAPPING_DAYS   — reviewed_on age limit for high/verified mappings (default: 90)
 *   FRESHNESS_SOURCE_DAYS    — retrieved_on age limit for sources (default: 365)
 *   FRESHNESS_BINDING_DAYS   — retrieved_on age limit for binding-law sources (default: 180)
 *   FRESHNESS_REF_DATE       — ISO date string used as "today" for testing (default: system date)
 *
 * Exit codes:
 *   0  no freshness violations (warnings allowed)
 *   1  one or more freshness errors found
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname    = dirname(fileURLToPath(import.meta.url));
const DOMAIN_ROOT  = resolve(__dirname, '..');
const CONTROLS_DIR = join(DOMAIN_ROOT, 'controls');

// ─── Date helpers (must be defined before configuration that calls them) ───────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(str) {
  if (!str || !DATE_RE.test(str)) return null;
  const d = new Date(str + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

/** Return the number of whole calendar days between two Date objects (a - b). */
function daysBetween(a, b) {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

// ─── Configuration ────────────────────────────────────────────────────────────

/**
 * Parse an integer from env with a fallback.
 * Fails loudly if the value is set but not a positive integer.
 */
function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 1) {
    console.error(`Environment variable ${name}='${raw}' must be a positive integer`);
    process.exit(1);
  }
  return n;
}

const MAPPING_STALE_DAYS = envInt('FRESHNESS_MAPPING_DAYS', 90);
const SOURCE_STALE_DAYS  = envInt('FRESHNESS_SOURCE_DAYS', 365);
const BINDING_STALE_DAYS = envInt('FRESHNESS_BINDING_DAYS', 180);

/** Reference date for all age calculations. Override for deterministic CI runs. */
const TODAY_STR = process.env.FRESHNESS_REF_DATE ?? new Date().toISOString().slice(0, 10);
const TODAY     = parseDate(TODAY_STR);

if (!TODAY) {
  console.error(`FRESHNESS_REF_DATE='${TODAY_STR}' is not a valid YYYY-MM-DD date`);
  process.exit(1);
}

// ─── Error / warning tracking ─────────────────────────────────────────────────

const errors   = [];
const warnings = [];

function err(ctx, msg)  { errors.push(`[${ctx}] ERROR: ${msg}`); }
function warn(ctx, msg) { warnings.push(`[${ctx}] WARN: ${msg}`); }

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

// ─── Staleness checks ─────────────────────────────────────────────────────────

/**
 * HIGH_CONFIDENCE_LEVELS: mapping_confidence values that require an up-to-date
 * reviewed_on date. Low-confidence or speculative mappings are more tolerant
 * because they may not have a clear reachable source.
 */
const HIGH_CONFIDENCE = new Set(['verified', 'high']);

/**
 * BINDING_LAW_SOURCE_TYPES: source types where retrieved_on freshness is
 * especially important because legislation can be amended without notice.
 */
const BINDING_LAW_TYPES = new Set(['binding-law', 'regulation', 'supervisory-guidance']);

function checkMappingFreshness(controls) {
  let staleCount = 0;
  let missingCount = 0;

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;

    if (!Array.isArray(ctrl.frameworks)) continue;

    for (const fw of ctrl.frameworks) {
      const fwKey  = fw.framework ?? 'UNKNOWN';
      const ctx    = `${id}.frameworks[${fwKey}]`;

      // reviewed_on: required on all mappings
      if (!fw.reviewed_on) {
        warn(ctx, `reviewed_on is not set — cannot check freshness`);
        missingCount++;
        continue;
      }

      const reviewed = parseDate(fw.reviewed_on);
      if (!reviewed) {
        err(ctx, `reviewed_on '${fw.reviewed_on}' is not a valid YYYY-MM-DD date`);
        continue;
      }

      // Only enforce the staleness window on high/verified confidence mappings
      if (!fw.mapping_confidence || !HIGH_CONFIDENCE.has(fw.mapping_confidence)) {
        // Medium/low/speculative: just warn if very old (3× threshold)
        const days = daysBetween(TODAY, reviewed);
        if (days > MAPPING_STALE_DAYS * 3) {
          warn(ctx, `reviewed_on '${fw.reviewed_on}' is ${days} days old (> ${MAPPING_STALE_DAYS * 3} days). Consider re-reviewing even for lower-confidence mappings.`);
        }
        continue;
      }

      const days = daysBetween(TODAY, reviewed);
      if (days > MAPPING_STALE_DAYS) {
        err(ctx, `reviewed_on '${fw.reviewed_on}' is ${days} days old (threshold: ${MAPPING_STALE_DAYS} days). High/verified mappings must be re-reviewed within ${MAPPING_STALE_DAYS} days.`);
        staleCount++;
      }
    }
  }

  if (staleCount > 0 || missingCount > 0) {
    console.log(`  ─ mapping freshness: ${staleCount} stale, ${missingCount} missing reviewed_on`);
  }
}

function checkSourceFreshness(controls) {
  // Collect all unique sources across all controls to avoid double-reporting
  const seenSources = new Map(); // source_id → { retrieved_on, source_type, _ctrl }

  for (const ctrl of controls) {
    if (!Array.isArray(ctrl.sources)) continue;

    for (const src of ctrl.sources) {
      if (!src.id) continue;
      // First occurrence wins for reporting purposes
      if (!seenSources.has(src.id)) {
        seenSources.set(src.id, {
          retrieved_on: src.retrieved_on,
          source_type: src.source_type,
          _ctrl: ctrl.id ?? ctrl._file,
        });
      }
    }
  }

  let staleCount = 0;
  let missingCount = 0;

  for (const [srcId, meta] of seenSources) {
    const ctx = `SRC:${srcId}`;

    if (!meta.retrieved_on) {
      warn(ctx, `retrieved_on is not set (first seen in ${meta._ctrl}). Freshness cannot be verified.`);
      missingCount++;
      continue;
    }

    const retrieved = parseDate(meta.retrieved_on);
    if (!retrieved) {
      err(ctx, `retrieved_on '${meta.retrieved_on}' is not a valid YYYY-MM-DD date (first seen in ${meta._ctrl})`);
      continue;
    }

    const days = daysBetween(TODAY, retrieved);

    // Binding law / supervisory guidance: tighter threshold
    if (BINDING_LAW_TYPES.has(meta.source_type)) {
      if (days > BINDING_STALE_DAYS) {
        err(ctx, `retrieved_on '${meta.retrieved_on}' is ${days} days old (binding/guidance threshold: ${BINDING_STALE_DAYS} days). Re-retrieve and update the record — ${meta.source_type} sources may have been amended.`);
        staleCount++;
      }
      continue;
    }

    // All other sources: standard threshold
    if (days > SOURCE_STALE_DAYS) {
      err(ctx, `retrieved_on '${meta.retrieved_on}' is ${days} days old (threshold: ${SOURCE_STALE_DAYS} days). Re-retrieve and confirm currency (first seen in ${meta._ctrl}).`);
      staleCount++;
    }
  }

  if (staleCount > 0 || missingCount > 0) {
    console.log(`  ─ source freshness: ${staleCount} stale, ${missingCount} missing retrieved_on`);
  }
}

/**
 * Check obligation reviewed_on dates.
 * Obligations referencing enacted binding law should be reviewed more frequently
 * because enforcement timelines can change (e.g., EU AI Act effective dates).
 */
function checkObligationFreshness(controls) {
  const OBLIGATION_STALE_DAYS = MAPPING_STALE_DAYS * 2; // 180d default

  for (const ctrl of controls) {
    const id = ctrl.id ?? `UNKNOWN(${ctrl._file})`;

    if (!Array.isArray(ctrl.obligations)) continue;

    for (let i = 0; i < ctrl.obligations.length; i++) {
      const obl = ctrl.obligations[i];
      const ctx = `${id}.obligations[${i}:${obl.provision ?? 'UNKNOWN'}]`;

      if (!obl.reviewed_on) {
        warn(ctx, `reviewed_on is not set on obligation`);
        continue;
      }

      const reviewed = parseDate(obl.reviewed_on);
      if (!reviewed) {
        err(ctx, `reviewed_on '${obl.reviewed_on}' is not a valid YYYY-MM-DD date`);
        continue;
      }

      const days = daysBetween(TODAY, reviewed);
      if (days > OBLIGATION_STALE_DAYS) {
        err(ctx, `reviewed_on '${obl.reviewed_on}' is ${days} days old (obligation threshold: ${OBLIGATION_STALE_DAYS} days). Obligations may be affected by enforcement date changes or legislative amendments.`);
      }

      // EU AI Act effective_from: if the effective date has now passed, flag for review
      if (obl.effective_from) {
        const effective = parseDate(obl.effective_from);
        if (effective && TODAY >= effective) {
          // The obligation has become enforceable — flag if not recently re-reviewed
          if (days > 30) {
            warn(ctx, `obligation effective_from '${obl.effective_from}' has passed (today: ${TODAY_STR}), but reviewed_on '${obl.reviewed_on}' is ${days} days ago. Re-review to confirm assurance posture.`);
          }
        }
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`check-freshness.mjs — reference date: ${TODAY_STR}`);
console.log(`  thresholds: mapping=${MAPPING_STALE_DAYS}d, source=${SOURCE_STALE_DAYS}d, binding-source=${BINDING_STALE_DAYS}d`);

const controls = loadAllControls();
console.log(`  loaded ${controls.length} controls from ${CONTROLS_DIR}`);

if (errors.length > 0) {
  for (const e of errors) console.error(e);
  process.exit(1);
}

console.log(`  ─ checking mapping reviewed_on freshness`);
checkMappingFreshness(controls);

console.log(`  ─ checking source retrieved_on freshness`);
checkSourceFreshness(controls);

console.log(`  ─ checking obligation reviewed_on freshness`);
checkObligationFreshness(controls);

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

console.log(`\n  ✓ check-freshness.mjs passed (${controls.length} controls, ${warnings.length} warnings)`);
