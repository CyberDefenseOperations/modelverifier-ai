#!/usr/bin/env node
/**
 * regulatory-watch.mjs — Weekly regulatory and framework staleness report.
 *
 * Reads schema/regulatory-watch.json and schema/framework-mapping-catalog.json,
 * then produces a structured Markdown report covering:
 *   1. Upcoming enforcement milestones (next 90 days / next 365 days)
 *   2. Sources due for manual re-check (retrieved_on past threshold)
 *   3. Pre-release sources that may now be formally released
 *   4. Watchlist items that have changed status (new enactments, etc.)
 *   5. GitHub-checkable sources compared against latest release (when --check-github)
 *
 * Usage:
 *   node scripts/regulatory-watch.mjs [options]
 *
 * Options:
 *   --check-github      Fetch latest releases from GitHub API (requires GITHUB_TOKEN env)
 *   --output-json       Print JSON instead of Markdown
 *   --days-urgent N     Days ahead treated as urgent (default: 90)
 *   --days-warn N       Days ahead to show warnings for (default: 365)
 *   --ref-date YYYY-MM-DD  Use this date as today (for deterministic CI runs)
 *   --out FILE          Write output to FILE instead of stdout
 *
 * Exit codes:
 *   0  Report generated; no critical items
 *   1  Critical items found (enforcement date < 90 days, stale binding-law source)
 *   2  Script error (missing file, parse failure, etc.)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCHEMA_DIR = join(ROOT, 'schema');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);

function flagArg(name) { return argv.includes(name); }
function namedArg(name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}

const checkGitHub  = flagArg('--check-github');
const outputJson   = flagArg('--output-json');
const daysUrgent   = parseInt(namedArg('--days-urgent') ?? '', 10) || 90;
const daysWarn     = parseInt(namedArg('--days-warn')   ?? '', 10) || 365;
const refDateArg   = namedArg('--ref-date');
const outFile      = namedArg('--out');

const TODAY_STR = refDateArg ?? new Date().toISOString().slice(0, 10);
const TODAY     = new Date(TODAY_STR + 'T00:00:00Z');

if (isNaN(TODAY.getTime())) {
  console.error(`[regulatory-watch] Invalid --ref-date '${refDateArg}'. Expected YYYY-MM-DD.`);
  process.exit(2);
}

// ─── Load source files ────────────────────────────────────────────────────────

function loadJson(path) {
  if (!existsSync(path)) {
    console.error(`[regulatory-watch] File not found: ${path}`);
    process.exit(2);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`[regulatory-watch] JSON parse error in ${path}: ${e.message}`);
    process.exit(2);
  }
}

const watch   = loadJson(join(SCHEMA_DIR, 'regulatory-watch.json'));
const catalog = loadJson(join(SCHEMA_DIR, 'framework-mapping-catalog.json'));

// ─── Date helpers ─────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  return Math.floor((d.getTime() - TODAY.getTime()) / 86_400_000);
}

function daysAgo(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  return Math.floor((TODAY.getTime() - d.getTime()) / 86_400_000);
}

function urgencyLabel(days) {
  if (days === null) return 'unknown';
  if (days < 0)          return 'past';
  if (days <= 30)        return 'critical';
  if (days <= daysUrgent) return 'urgent';
  if (days <= daysWarn)  return 'watch';
  return 'future';
}

// ─── GitHub release checks ────────────────────────────────────────────────────

async function fetchLatestRelease(owner, repo) {
  if (!checkGitHub) return null;
  const token = process.env.GITHUB_TOKEN;
  const headers = { 'User-Agent': 'apeiris-regulatory-watch', 'Accept': 'application/vnd.github+json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      if (resp.status === 404) return { tag_name: null, published_at: null, no_releases: true };
      return { error: `HTTP ${resp.status}` };
    }
    const data = await resp.json();
    return { tag_name: data.tag_name, published_at: data.published_at?.slice(0, 10), name: data.name };
  } catch (e) {
    return { error: e.message };
  }
}

// ─── Build report sections ────────────────────────────────────────────────────

const findings = {
  run_date: TODAY_STR,
  critical: [],
  urgent: [],
  watch: [],
  stale_sources: [],
  pre_release_items: [],
  github_checks: [],
  watchlist_highlights: [],
  enforcement_calendar: [],
};

// 1. Enforcement calendar (next daysWarn days)
for (const event of watch.enforcement_calendar?.events ?? []) {
  const days = daysUntil(event.date);
  const urgency = urgencyLabel(days);
  const entry = { ...event, days_until: days, urgency };
  findings.enforcement_calendar.push(entry);
  if (urgency === 'critical' || urgency === 'past') findings.critical.push({ type: 'enforcement', ...entry });
  else if (urgency === 'urgent') findings.urgent.push({ type: 'enforcement', ...entry });
  else if (urgency === 'watch') findings.watch.push({ type: 'enforcement', ...entry });
}

// 2. Tracked framework staleness
const CHECK_INTERVAL_DEFAULT = 90;
for (const fw of watch.tracked_frameworks ?? []) {
  const ageOfCheck = daysAgo(fw.last_checked);
  const threshold  = fw.check_interval_days ?? CHECK_INTERVAL_DEFAULT;
  if (ageOfCheck !== null && ageOfCheck > threshold) {
    const urgency = ageOfCheck > threshold * 2 ? 'critical' : ageOfCheck > threshold * 1.5 ? 'urgent' : 'watch';
    const entry = {
      type: 'stale-source',
      id: fw.id,
      name: fw.name,
      last_checked: fw.last_checked,
      age_days: ageOfCheck,
      threshold_days: threshold,
      check_url: fw.official_url ?? fw.monitor_url,
      urgency,
    };
    findings.stale_sources.push(entry);
    if (urgency === 'critical') findings.critical.push(entry);
    else if (urgency === 'urgent') findings.urgent.push(entry);
    else findings.watch.push(entry);
  }

  // Pre-release items
  if (fw.status === 'pre-release') {
    findings.pre_release_items.push({
      id: fw.id,
      name: fw.name,
      status: fw.status,
      last_checked: fw.last_checked,
      github_releases_url: fw.github_releases_url ?? null,
      watch_for: fw.watch_for ?? [],
    });
  }

  // Upcoming milestones within daysWarn
  for (const m of fw.upcoming_milestones ?? []) {
    if (!m.date) continue;
    const days = daysUntil(m.date);
    const urgency = urgencyLabel(days);
    if (urgency === 'future') continue;
    const entry = { type: 'milestone', source: fw.id, ...m, days_until: days, urgency };
    if (urgency === 'critical' || urgency === 'past') findings.critical.push(entry);
    else if (urgency === 'urgent') findings.urgent.push(entry);
    else findings.watch.push(entry);
  }
}

// 3. Watchlist highlights (high priority items)
for (const item of watch.watchlist ?? []) {
  if (item.priority === 'high' || item.status === 'incorporate-next-cycle') {
    findings.watchlist_highlights.push({
      id: item.id,
      name: item.name,
      status: item.status,
      priority: item.priority,
      notes: item.notes,
      trigger_controls: item.trigger_controls ?? [],
    });
  }
}

// 4. GitHub release checks (async)
const githubResults = [];
if (checkGitHub) {
  for (const src of watch.github_checkable_sources ?? []) {
    const result = await fetchLatestRelease(src.github_owner, src.github_repo);
    const catalogFw = catalog.frameworks?.[src.id === 'mitre_atlas' ? 'mitre' : src.id === 'owasp_llm10' ? 'llm10' : src.id === 'owasp_aisvs' ? 'aisvs' : src.id];
    const catalogVersion = catalogFw?.version ?? null;
    let newRelease = false;
    let releaseNote = '';
    if (result?.no_releases) {
      releaseNote = `No GitHub releases found — content may be in main branch only`;
    } else if (result?.error) {
      releaseNote = `GitHub API error: ${result.error}`;
    } else if (result?.tag_name) {
      if (catalogVersion && result.tag_name !== catalogVersion) {
        newRelease = true;
        releaseNote = `Latest: ${result.tag_name} (published ${result.published_at}). Catalog has: ${catalogVersion}. VERSION MISMATCH — review needed.`;
      } else {
        releaseNote = `Latest: ${result.tag_name} — matches catalog version.`;
      }
    }
    const entry = { id: src.id, repo: `${src.github_owner}/${src.github_repo}`, catalog_version: catalogVersion, ...result, new_release: newRelease, note: releaseNote };
    githubResults.push(entry);
    if (newRelease) {
      findings.critical.push({ type: 'github-version-mismatch', ...entry });
    }
  }
}
findings.github_checks = githubResults;

// ─── Output ───────────────────────────────────────────────────────────────────

const hasCritical = findings.critical.length > 0;

if (outputJson) {
  const output = JSON.stringify(findings, null, 2);
  if (outFile) writeFileSync(outFile, output, 'utf8');
  else process.stdout.write(output + '\n');
  process.exit(hasCritical ? 1 : 0);
}

// ── Markdown report ────────────────────────────────────────────────────────────

const lines = [];

lines.push(`# Regulatory & Framework Watch Report`);
lines.push(`**Generated:** ${TODAY_STR} | **Urgent window:** ${daysUrgent} days | **Watch window:** ${daysWarn} days`);
lines.push('');

// Summary badges
const critCount  = findings.critical.length;
const urgCount   = findings.urgent.length;
const watchCount = findings.watch.length;
lines.push(`| 🔴 Critical | 🟠 Urgent | 🟡 Watch |`);
lines.push(`|---|---|---|`);
lines.push(`| ${critCount} item${critCount !== 1 ? 's' : ''} | ${urgCount} item${urgCount !== 1 ? 's' : ''} | ${watchCount} item${watchCount !== 1 ? 's' : ''} |`);
lines.push('');

// Critical section
if (findings.critical.length > 0) {
  lines.push('## 🔴 Critical — Action Required');
  lines.push('');
  for (const item of findings.critical) {
    if (item.type === 'enforcement') {
      lines.push(`### ${item.regulation}: ${item.event}`);
      lines.push(`- **Date:** ${item.date} (${item.days_until !== null ? `${Math.abs(item.days_until)} days ${item.days_until < 0 ? 'ago' : 'away'}` : 'date TBD'})`);
      if (item.matrix_impact) lines.push(`- **Matrix impact:** ${item.matrix_impact}`);
    } else if (item.type === 'stale-source') {
      lines.push(`### Stale: ${item.name}`);
      lines.push(`- **Last checked:** ${item.last_checked} (${item.age_days} days ago — threshold: ${item.threshold_days} days)`);
      lines.push(`- **Check at:** ${item.check_url}`);
    } else if (item.type === 'github-version-mismatch') {
      lines.push(`### Version mismatch: ${item.id}`);
      lines.push(`- ${item.note}`);
    } else if (item.type === 'milestone') {
      lines.push(`### ${item.source}: ${item.event}`);
      lines.push(`- **Date:** ${item.date} (${item.days_until !== null ? `${Math.abs(item.days_until)} days ${item.days_until < 0 ? 'ago' : 'away'}` : 'TBD'})`);
      if (item.matrix_impact) lines.push(`- **Matrix impact:** ${item.matrix_impact}`);
    }
    lines.push('');
  }
}

// Urgent section
if (findings.urgent.length > 0) {
  lines.push('## 🟠 Urgent — Review Within 30 Days');
  lines.push('');
  for (const item of findings.urgent) {
    if (item.type === 'enforcement') {
      lines.push(`- **${item.regulation}** — ${item.event} (${item.date}, ${item.days_until} days)`);
      if (item.matrix_impact) lines.push(`  - ${item.matrix_impact}`);
    } else if (item.type === 'stale-source') {
      lines.push(`- **Stale source:** ${item.name} — last checked ${item.last_checked} (${item.age_days}d ago)`);
    } else if (item.type === 'milestone') {
      lines.push(`- **${item.source}:** ${item.event} (${item.date}, ${item.days_until} days)`);
    }
  }
  lines.push('');
}

// Watch section (enforcement calendar)
lines.push('## Enforcement Calendar');
lines.push('');
lines.push('| Date | Days | Severity | Regulation | Event |');
lines.push('|------|------|----------|------------|-------|');
for (const event of findings.enforcement_calendar.sort((a, b) => (a.date ?? 'z').localeCompare(b.date ?? 'z'))) {
  const dStr = event.days_until !== null ? (event.days_until < 0 ? `${Math.abs(event.days_until)}d ago` : `${event.days_until}d`) : 'TBD';
  const sev = { critical: '🔴', high: '🟠', medium: '🟡', low: '⚪' }[event.severity] ?? '⚪';
  lines.push(`| ${event.date ?? 'TBD'} | ${dStr} | ${sev} ${event.severity} | ${event.regulation} | ${event.event} |`);
}
lines.push('');

// Stale sources
if (findings.stale_sources.length > 0) {
  lines.push('## Stale Source Checks');
  lines.push('');
  lines.push('| Framework | Last Checked | Age | Threshold | Action |');
  lines.push('|-----------|-------------|-----|-----------|--------|');
  for (const s of findings.stale_sources) {
    lines.push(`| ${s.name} | ${s.last_checked} | ${s.age_days}d | ${s.threshold_days}d | [Open source](${s.check_url}) |`);
  }
  lines.push('');
}

// Pre-release items
if (findings.pre_release_items.length > 0) {
  lines.push('## Pre-Release Sources — Check for Formal Release');
  lines.push('');
  for (const item of findings.pre_release_items) {
    lines.push(`### ${item.name} (\`${item.id}\`)`);
    lines.push(`- **Status:** ${item.status} | **Last checked:** ${item.last_checked}`);
    if (item.github_releases_url) lines.push(`- **GitHub releases:** ${item.github_releases_url}`);
    if (item.watch_for?.length > 0) {
      lines.push(`- **Watch for:**`);
      for (const w of item.watch_for) lines.push(`  - ${w}`);
    }
    lines.push('');
  }
}

// GitHub checks
if (findings.github_checks.length > 0) {
  lines.push('## GitHub Release Checks');
  lines.push('');
  lines.push('| Repo | Catalog Version | Latest Release | Status |');
  lines.push('|------|----------------|----------------|--------|');
  for (const g of findings.github_checks) {
    const status = g.new_release ? '⚠️ **MISMATCH**' : g.no_releases ? '– no releases' : g.error ? `error: ${g.error}` : '✓ current';
    lines.push(`| ${g.repo} | ${g.catalog_version ?? '—'} | ${g.tag_name ?? '—'} | ${status} |`);
  }
  lines.push('');
}

// Watchlist highlights
if (findings.watchlist_highlights.length > 0) {
  lines.push('## Watchlist — High Priority Items');
  lines.push('');
  for (const item of findings.watchlist_highlights) {
    const priorityEmoji = { high: '🔴', medium: '🟡', low: '⚪' }[item.priority] ?? '⚪';
    lines.push(`### ${priorityEmoji} ${item.name}`);
    lines.push(`- **Status:** \`${item.status}\` | **Priority:** ${item.priority}`);
    if (item.notes) lines.push(`- ${item.notes}`);
    if (item.trigger_controls?.length > 0) lines.push(`- **Trigger controls:** ${item.trigger_controls.join(', ')}`);
    lines.push('');
  }
}

// All tracked frameworks overview
lines.push('## Tracked Framework Status');
lines.push('');
lines.push('| Framework | Version | Last Checked | Check Interval | Status |');
lines.push('|-----------|---------|-------------|----------------|--------|');
for (const fw of watch.tracked_frameworks ?? []) {
  const age = daysAgo(fw.last_checked);
  const threshold = fw.check_interval_days ?? CHECK_INTERVAL_DEFAULT;
  const statusEmoji = age === null ? '?' : age > threshold * 2 ? '🔴' : age > threshold ? '🟠' : '✓';
  lines.push(`| ${fw.name} | ${fw.current_version ?? '—'} | ${fw.last_checked ?? '—'} | ${threshold}d | ${statusEmoji} |`);
}
lines.push('');

lines.push('---');
lines.push(`*Generated by \`scripts/regulatory-watch.mjs\` from \`schema/regulatory-watch.json\`. Update \`last_checked\` dates in \`tracked_frameworks\` after completing manual verification.*`);

const report = lines.join('\n');

if (outFile) {
  writeFileSync(outFile, report, 'utf8');
  console.log(`[regulatory-watch] Report written to ${outFile}`);
} else {
  process.stdout.write(report + '\n');
}

process.exit(hasCritical ? 1 : 0);
