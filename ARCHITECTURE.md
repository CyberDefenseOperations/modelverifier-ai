# modelverifier.ai — Architecture

AI Model & System Assurance Control Matrix  
54 controls · 6 layers · 10 frameworks · 11 profiles  
Zero runtime dependencies · Static SPA on Cloudflare Pages

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Layout](#2-repository-layout)
3. [Data Flow](#3-data-flow)
4. [Control Record Format](#4-control-record-format)
5. [Build Pipeline](#5-build-pipeline)
6. [UI Architecture](#6-ui-architecture)
7. [Deployment Pipeline](#7-deployment-pipeline)
8. [Regulatory Watch Automation](#8-regulatory-watch-automation)
9. [Schema Extension Points](#9-schema-extension-points)
10. [Adding a New Domain (Fork Guide)](#10-adding-a-new-domain-fork-guide)

---

## 1. System Overview

modelverifier.ai is a static reference site serving a machine-readable control matrix for AI model assurance. It is part of the Apeiris platform (apeiris.ai), which also includes securitycontrols.ai (the security domain matrix).

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Repository                        │
│                                                                 │
│  controls/*.json  ──►  build-integration.mjs  ──►  integration/│
│  (source of truth)      (build script)              (artifacts) │
│                                                                 │
│  schema/*.json          scripts/validate.mjs                    │
│  (JSON Schema +         scripts/audit-mappings.mjs  (CI gates) │
│   profiles, catalog)    scripts/check-freshness.mjs             │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ GitHub Actions (deploy.yml)
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Cloudflare Pages                           │
│                                                                 │
│  public/index.html          ← entire SPA (HTML+CSS+JS)         │
│  public/integration/        ← copied from integration/ at build │
│    model-controls-full.json                                     │
│    controls.json / controls.min.json                            │
│    baseline.json                                                │
│    profiles.json                                                │
│    framework-index.json                                         │
│    release-manifest.json                                        │
│  public/_headers            ← Cloudflare security headers       │
│  public/integrate.html      ← integration docs page            │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ HTTPS / same-origin fetch
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (user)                           │
│                                                                 │
│  index.html loads → fetch("/integration/model-controls-full.json│
│  → populates control matrix → user filters / assesses / exports │
└─────────────────────────────────────────────────────────────────┘
```

### Design constraints driving all architecture decisions

- **Zero runtime dependencies.** No npm packages in production. No framework. No bundler output to maintain.
- **Single deployable artifact.** The entire UI is one HTML file. Deployment = copying `public/` to Cloudflare Pages.
- **Data separated from UI.** Controls live in version-controlled JSON files, not embedded in the HTML. The build script merges them into a single fetch-able artifact.
- **Machine-readable first.** `model-controls-full.json` is the primary artifact; the HTML is a viewer for it.
- **Cite or flag.** Every substantive claim in a control must cite a primary source or be labeled as an Apeiris thesis. This is enforced at build time.

---

## 2. Repository Layout

```
modelverifier.ai/
├── controls/                    # Source of truth for all control records
│   ├── LI.json                  # 10 controls: AI Asset, Lineage & Applicability
│   ├── TG.json                  # 8 controls:  Training & Data Governance
│   ├── EV.json                  # 10 controls: Evaluation, Validation & Release
│   ├── OA.json                  # 8 controls:  Governance, Accountability & Oversight
│   ├── BH.json                  # 10 controls: Deployment & Runtime Assurance
│   └── CR.json                  # 8 controls:  Continuous Risk & Evidence Assurance
│
├── schema/
│   ├── model-controls.schema.json          # Full domain schema (draft-07)
│   ├── model-assurance-extension.schema.json  # Extension fields (monitoring_schema,
│   │                                           #  capability_risk, assurance_target)
│   ├── profiles.json                       # 11 deployment profiles with trigger conditions
│   ├── framework-mapping-catalog.json      # Authoritative allowed requirement_id patterns
│   │                                       #  per framework; used by audit:mappings
│   └── regulatory-watch.json              # Framework versions + scheduled check dates
│
├── scripts/
│   ├── validate.mjs             # Gate 1–5: schema, namespaces, sources, versions, licenses
│   ├── audit-mappings.mjs       # Gate 6:   framework ID resolution, legal-status,
│   │                            #           overlap, cross-domain URIs, evidence contracts
│   ├── check-freshness.mjs      # Warns when source retrieved_on is stale
│   ├── regulatory-watch.mjs     # Weekly: checks for framework updates, emits Markdown report
│   └── sign-release-manifest.mjs # Signs release-manifest.json with the Apeiris release key
│
├── integration/                 # Build output (pre-public copy); also served from public/integration/
│   ├── model-controls-full.json # Primary artifact — full dataset { dataset: { meta, controls, ... } }
│   ├── controls.json            # Controls array only (no aggregates)
│   ├── controls.min.json        # Minified controls array
│   ├── baseline.json            # 15-control baseline subset
│   ├── profiles.json            # Profiles array from schema/profiles.json
│   ├── framework-index.json     # Per-framework requirement-ID → control-ID index
│   ├── release-manifest.json    # Content hashes + artifact metadata
│   ├── release-manifest.sig     # Ed25519 signature of release-manifest.json
│   ├── claim.schema.json        # Evidence claim graph schema
│   ├── model-claims-example.json # Annotated claim graph examples across all 6 layers
│   ├── _headers                 # CORS headers for /integration/* (Access-Control-Allow-Origin: *)
│   ├── README.md                # Integration endpoint documentation
│   └── INTEGRATION-GUIDE.md    # Consumer guide (fetching, schema, license)
│
├── public/                      # Everything deployed to Cloudflare Pages
│   ├── index.html               # Entire SPA (~2400 lines; HTML + CSS + JS)
│   ├── _headers                 # Cloudflare security headers for all pages
│   ├── integrate.html           # Integration documentation page
│   ├── .well-known/             # Well-known URI namespace (RFC 8615)
│   │   └── apeiris-release.pub  # Ed25519 public key for release manifest verification
│   └── integration/             # Copied from integration/ by `npm run build`
│
├── build-integration.mjs        # Main build script (Node.js ESM, zero deps)
├── package.json                 # npm scripts only; devDependencies: {}
│
└── .github/workflows/
    ├── deploy.yml               # CI: validate → audit → build → sign → deploy to Cloudflare Pages
    └── weekly-regulatory-watch.yml  # Cron: Monday 08:00 UTC, creates/updates GitHub issue
```

### Authoritative source resolution order

`build-integration.mjs` loads controls in this order:

1. `controls/model-controls.json` — if present, used as the single merged source
2. Per-layer files `controls/LI.json`, `controls/TG.json`, ... `controls/CR.json` — merged in `LAYER_ORDER` sequence

Per-layer files are the normal development workflow. `model-controls.json` is a migration path if you need a flat merge first.

---

## 3. Data Flow

```
Author edits controls/EV.json
        │
        ▼
git push → main
        │
        ▼
GitHub Actions: deploy.yml
        │
        ├─ npm run validate          (scripts/validate.mjs — 5 checks)
        │   ├── schema               required fields, enums, patterns
        │   ├── namespaces           ID format, layer-plane consistency, uniqueness
        │   ├── sources              completeness, cite-or-flag invariant
        │   ├── source-versions      date format, superseded-source guard
        │   └── licenses             license field completeness
        │
        ├─ npm run audit:mappings    (scripts/audit-mappings.mjs — 6 checks)
        │   ├── mappings             every requirement_id resolved against catalog
        │   ├── applicability        obligation predicates well-formed
        │   ├── legal-status         normative_force consistency (e.g., SR 26-2 = supervisory-guidance)
        │   ├── control-overlap      duplicate requirement_id mappings across controls
        │   ├── cross-domain         apeiris:// URI resolution against namespace-registry
        │   └── evidence-contracts   evidence artifact declarations complete
        │
        ├─ npm run check:freshness   warn if source retrieved_on is stale
        │
        ├─ npm run build             build-integration.mjs + copy to public/
        │   ├── load controls/*.json
        │   ├── validate each record (in-process, same rules as Gate 1)
        │   ├── sort by LAYER_ORDER then by control number
        │   ├── strip $schema field from published records
        │   ├── build aggregated sections:
        │   │     references, layers, planes, gaps, profiles, patterns,
        │   │     threat_scenarios, framework_coverage, regulatory_coverage,
        │   │     capability_coverage, lifecycle
        │   ├── compute SHA-256 content hash
        │   ├── write integration/model-controls-full.json  { dataset: { meta, ... } }
        │   ├── write integration/release-manifest.json
        │   └── cp -r integration public/integration
        │
        └─ npm run sign:release-manifest
                writes integration/release-manifest.sig (Ed25519)
                       public/integration/release-manifest.sig

        │
        ▼
cloudflare/pages-action publishes public/ to Cloudflare Pages
        │
        ▼
Browser: GET https://modelverifier.ai/
        │
        ▼
index.html loads → JS executes:
  fetch("/integration/model-controls-full.json")
  → parse { dataset }
  → populate controls[], profileMap{}, baselineSet
  → render()
```

### Integration artifacts

| File | Purpose | Consumers |
|------|---------|-----------|
| `model-controls-full.json` | Complete dataset with all aggregates | Apeiris Verifier, external integrators |
| `controls.json` | Controls array only, no aggregates | Lightweight consumers |
| `controls.min.json` | Minified controls array | Bandwidth-sensitive contexts |
| `baseline.json` | 15-control baseline subset | Quick baseline checks |
| `profiles.json` | Profile definitions only | Profile-aware tools |
| `framework-index.json` | requirement_id → control_id index per framework | Framework cross-reference tools |
| `release-manifest.json` | Content hashes, artifact metadata | Integrity verification |
| `release-manifest.sig` | Ed25519 signature of the manifest | Cryptographic verification |
| `claim.schema.json` | Evidence claim graph schema | Tools that produce or consume evidence claims |
| `model-claims-example.json` | Annotated claim object examples across all 6 layers | Integrators building claim producers |

The Ed25519 public key for verifying `release-manifest.sig` is served separately at `/.well-known/apeiris-release.pub` (outside the `/integration/` path). The signing private key is stored only as the `MODEL_VERIFIER_SIGNING_KEY` GitHub Actions secret and is never committed to the repository.

All files under `public/integration/` are served with `Access-Control-Allow-Origin: *` (set in `integration/_headers`). They are safe to fetch from any origin.

---

## 4. Control Record Format

Each control record in `controls/*.json` is a JSON object validated against `schema/model-controls.schema.json` (JSON Schema draft-07).

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | `LAYER-NN` format (e.g., `EV-07`). Stable, never reused. |
| `layer` | enum | One of `LI TG EV OA BH CR` |
| `plane` | enum | `control` `data` `lifecycle` `both` — set by layer, not per-control |
| `name` | string | Short scannable title, max 80 chars |
| `plain` | string | One-sentence plain-English summary, max 200 chars |
| `threat` | object | `{ tags: string[], desc: string }` |
| `sources` | array | Primary source citations; at least one must have `flagship: true` |
| `implementation` | object | `{ pattern, steps[], anti_patterns[] }` |
| `validation` | object | `{ checks[], evidence[] }` |
| `lenses` | object | Exactly five keys: `engineering evaluation red_team grc mlops` |
| `maturity` | object | `{ current, target, notes }` — 6-level scale: none→initial→developing→defined→managed→optimizing |
| `coverage_note` | string | Documents framework coverage gaps or partial fits |
| `capability_risk` | object | `{ capability_level, capability_domains[] }` |

### Optional but significant fields

| Field | Description |
|-------|-------------|
| `frameworks[]` | Mappings to 10 external frameworks with fit, confidence, rationale, locator |
| `obligations[]` | Regulatory obligations (EU AI Act, SR 26-2) with normative force and effective dates |
| `monitoring_schema` | Structured monitoring metrics (required for BH and CR layer controls) |
| `assurance_target` | Deployment context predicates used by profile trigger evaluation |
| `standard[]` | Normative standard clauses the control directly implements |
| `thesis_type` | `preventive detective corrective deterrent compensating directive recovery` |
| `implementers[]` | Which teams own implementation (engineering, mlops, grc, evaluation, red_team) |
| `readiness` | `draft review approved deprecated` |

### Layer → plane assignments (fixed)

| Layer | Code | Plane | Controls |
|-------|------|-------|----------|
| AI Asset, Lineage and Applicability | LI | control | 10 |
| Training and Data Governance | TG | data | 8 |
| Evaluation, Validation and Release | EV | both | 10 |
| Governance, Accountability and Oversight | OA | control | 8 |
| Deployment and Runtime Assurance | BH | data | 10 |
| Continuous Risk and Evidence Assurance | CR | lifecycle | 8 |

### Framework keys

The 10 supported framework keys used in `frameworks[].framework`:

| Key | Framework |
|-----|-----------|
| `nist_rmf` | NIST AI RMF 1.0 |
| `nist_ai_600_1` | NIST AI 600-1 (Generative AI Profile) |
| `iso_42001` | ISO/IEC 42001:2023 |
| `eu_ai_act` | EU AI Act (Regulation 2024/1689) |
| `sr262` | SR 26-2 Model Risk Management |
| `aisvs` | OWASP AI Security Verification Standard v1.0 |
| `llm10` | OWASP LLM Top 10 2025 |
| `aicm` | CSA AI Controls Matrix v1.1 (46 mappings across all 6 layers; GOV/DM/EVA/SEC/PRV/SUP: high confidence; MON/IR/HO/TE/CL/RM/DP: medium confidence) |
| `mitre` | MITRE ATLAS v5.6.0 |
| `owasp_aitg` | OWASP AI Testing Guide v1 (pre-release; mapping_confidence: medium) |

Every control must have at least one mapping to `nist_rmf` and one to `iso_42001`. The `audit:mappings` step validates all requirement IDs against `schema/framework-mapping-catalog.json`. As of the v1.0 release, all 6 layers — including BH and CR — achieve this with 0 build warnings.

**Framework-specific conventions:**

- **`nist_ai_600_1`** — All mappings use category-level IDs only (CONFABULATION, CBRN, DATA-PRIVACY, INFO-INTEGRITY, INFO-SECURITY, IP, HUMAN-AI-CONFIG, OBSCENE-DEGRADING). Every `nist_ai_600_1` entry carries `provisional: true` and a `provisional_note` field. Action-level granularity within each category is not yet published by NIST. Do not set `mapping_confidence: high` or `verified` for any `nist_ai_600_1` entry.
- **`owasp_aitg`** — Mappings use three `fit` values: `direct` (the AITG requirement directly names what the control tests), `supporting` (the control enables the test condition), or `adjacent` (same threat domain, different concern). The `partial` fit value is not used for AITG entries. All AITG mappings carry `mapping_confidence: medium` because the OWASP AI Testing Guide remains a pre-release document.
- **`aicm`** — Covers all 6 layers with 46 total mappings against AICM v1.1. Domain prefixes GOV, DM, EVA, SEC, PRV, SUP have `mapping_confidence: high` (confirmed against the published v1.1 document). The 7 new v1.1 domain prefixes — MON, IR, HO, TE, CL, RM, DP — have `mapping_confidence: medium` pending full verification. `source_locator.section` is required for `fit: "direct"` AICM mappings.

### Baseline controls (15)

The 15 baseline controls apply to all deployments regardless of profile:

```
LI-01  LI-04  LI-06
TG-01  TG-05
EV-01  EV-06  EV-07  EV-09
OA-01  OA-07
BH-03  BH-05
CR-01  CR-02
```

Profile `required_controls` are additive on top of the baseline, never replacing it.

---

## 5. Build Pipeline

`build-integration.mjs` is a single Node.js ESM script with zero npm dependencies. It uses only Node built-ins: `node:crypto`, `node:fs/promises`, `node:path`.

### CLI flags

```
node build-integration.mjs [options]

  --controls-dir <path>   Source directory (default: ./controls)
  --out-dir <path>        Output directory (default: ./integration)
  --strict                Treat validation warnings as errors (used in CI)
  --dry-run               Transform and validate but write no files
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Fatal error (missing files, JSON parse failure, etc.) |
| 2 | Validation warnings present and `--strict` was set |

### Build steps (in order)

1. **Load controls** — reads per-layer files or `model-controls.json` canonical source
2. **Load profiles** — reads `schema/profiles.json`
3. **Load framework catalog** — reads `schema/framework-mapping-catalog.json`
4. **Validate** — calls `validateControl()` for each record; collects warnings
5. **Sort** — `LAYER_ORDER` × numeric ID sequence
6. **Strip internal fields** — removes `$schema` from published records
7. **Build aggregates** — calls individual builder functions:
   - `buildReferences()` — deduplicated source citations with `cited_by` backlinks
   - `buildLayers()` — per-layer metadata, control counts, baseline flags
   - `buildPlanes()` — control/data/lifecycle/both plane summaries
   - `buildGaps()` — controls with `partial` or `adjacent` framework mappings
   - `buildProfiles()` — enriched profile objects with control counts
   - `buildPatterns()` — implementation pattern summaries per control
   - `buildThreatScenarios()` — controls grouped by threat tag
   - `buildFrameworkCoverage()` — per-framework mapping statistics
   - `buildRegulatoryCoverage()` — per-regulatory-instrument obligation summaries
   - `buildCapabilityCoverage()` — controls grouped by capability level and domain
   - `buildLifecycle()` — ordered lifecycle stages
8. **Assemble dataset** — wraps everything in `{ dataset: { meta, controls, ... } }`
9. **Hash** — SHA-256 of serialized JSON, attached to `meta.content_hash`
10. **Write** — `integration/model-controls-full.json`, `integration/release-manifest.json`

### npm script graph

```
npm run ci
  └── npm run validate
  │     ├── validate:schema
  │     ├── validate:namespaces
  │     ├── validate:sources
  │     ├── validate:source-versions
  │     └── validate:licenses
  └── npm run audit
  │     ├── audit:mappings
  │     ├── audit:applicability
  │     ├── audit:legal-status
  │     ├── audit:control-overlap
  │     ├── audit:cross-domain
  │     └── audit:evidence-contracts
  └── npm run check:freshness
  └── npm run build:integration       (writes integration/ only)
  └── npm run sign:release-manifest

npm run build
  └── build:integration + cp -r integration public/integration
```

---

## 6. UI Architecture

The entire UI is `public/index.html` — approximately 2400 lines of HTML, CSS, and vanilla JavaScript. No framework, no bundler, no external assets.

### Startup sequence

```
DOMContentLoaded
  → applyTheme()            read localStorage mvai_theme or prefers-color-scheme
  → loadAssessState()       read localStorage mvai_assess (base64 JSON)
  → parseShareLink()        if URL hash has #a=<base64>, decode into assessState
  → load()                  fetch /integration/model-controls-full.json
      → parse { dataset }
      → populate controls[], baselineSet, profileMap{}
      → render()
      → updateAssessBar()
```

### Theme system

CSS custom properties on `:root` define the dark theme. `html[data-theme="light"]` overrides all variables. Per-layer accent colors are also custom properties (`--li`, `--tg`, `--ev`, `--oa`, `--bh`, `--cr`).

```
Theme stored in:   localStorage key "mvai_theme"  (values: "dark" | "light")
Default:           system prefers-color-scheme, fallback to dark
Applied by:        applyTheme() — sets html[data-theme] attribute
```

### Filtering and rendering

`render()` is the single render function. It reads from the `filters` object and calls `filtered()` to get the visible control array, then builds innerHTML directly (no virtual DOM, no diffing).

```javascript
filters = {
  layer:    'ALL' | 'LI' | 'TG' | 'EV' | 'OA' | 'BH' | 'CR',
  cap:      'ALL' | 'none' | 'low' | 'elevated' | 'frontier',
  profile:  '' | profile_id string,
  baseline: false | true,
  search:   string,
}
```

Filtering logic in `filtered()`:
1. Layer filter — exact match on `c.layer`
2. Capability filter — match on `c.capability_risk.capability_level`
3. Baseline filter — `baselineSet.has(c.id)`
4. Profile filter — `profileMap[profile_id].required.has(c.id) || .recommended.has(c.id)`
5. Search filter — substring match against `[id, name, plain, threat.desc, layer].join(' ')`

Rendering groups controls by layer, emitting a `<div class="layer-section">` per layer with a sticky header, then individual `<div class="control-card">` elements for each control.

### Detail drawer

`openDrawer(id)` opens a fixed side panel. The panel renders five tabs:

| Tab | Content |
|-----|---------|
| Overview | name, plain, threat, implementation pattern, maturity bar |
| Frameworks | mapping table with fit pills and rationale |
| Obligations | regulatory obligation rows |
| Sources | flagged source list with normative force chips |
| Lenses | persona-specific guidance for engineering/evaluation/red_team/grc/mlops |

Tab content is rendered by `fillOverview()`, `fillFrameworks()`, `fillObligations()`, `fillSources()`, `fillLenses()` — each writes to its `#tab-*` div.

### Tooltip engine

A single `#mvTip` div is appended to `<body>` and positioned as a fixed overlay. Tooltips are triggered by hovering any element with `class="has-tip"` and a `data-tip` attribute.

Position is computed with `getBoundingClientRect()` plus viewport boundary detection to avoid clipping at screen edges.

### Assessment mode

Assessment mode is toggled with the "Assess" button. When active, each control card shows a maturity selector.

```
Maturity levels (6):  none → initial → developing → defined → managed → optimizing
```

State is stored in:
- `assessState` object in memory: `{ controlId: maturityLevel }`
- `localStorage` key `mvai_assess`: base64-encoded JSON of `assessState`
- URL hash `#a=<base64>`: share links encode the full assessment state

The assessment summary panel (shown in assess mode) computes:
- Overall weighted average score (0.0–5.0)
- Per-layer breakdown
- Maturity distribution histogram
- Gap list (controls below target maturity)
- Export options: JSON (schema `apeiris://model/assessment/v1`), Markdown, CSV
- Import: paste a previously exported JSON to restore state

### localStorage keys

| Key | Value | Purpose |
|-----|-------|---------|
| `mvai_theme` | `"dark"` or `"light"` | Theme preference |
| `mvai_assess` | base64 JSON | Assessment state |

---

## 7. Deployment Pipeline

Two GitHub Actions workflows handle deployment.

### deploy.yml

Triggers: push to `main`, pull requests targeting `main`.

**Job 1: validate-and-build** (all pushes and PRs)
1. Checkout (shallow, depth 1)
2. Node.js 20 setup
3. `npm run validate` — 5 schema/namespace/source checks
4. `npm run audit:mappings` — 6 framework mapping checks
5. `npm run check:freshness` — stale source warning (non-fatal on PRs: `continue-on-error: true`)
6. `npm run build` — integration bundle + copy to `public/`
7. `npm run sign:release-manifest` — Ed25519 signature (requires `MODEL_VERIFIER_SIGNING_KEY` secret); public key published at `/.well-known/apeiris-release.pub`
8. Upload `public/` as GitHub artifact (`modelverifier-site`, 7-day retention)

**Job 2: deploy-production** (push to `main` only, depends on Job 1)
- Rebuilds (does not reuse artifact — Cloudflare Pages action needs the full checkout)
- Deploys `public/` to Cloudflare Pages project `modelverifier-ai`
- Requires secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

**Job 3: deploy-preview** (pull requests only, depends on Job 1)
- Same steps as production but deploys to a preview URL on Cloudflare Pages
- Branch name passed as `branch:` to `pages-action` so Cloudflare generates a unique preview URL

### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

Concurrent runs for the same branch are cancelled, so rapid pushes do not queue stale deployments.

### Required secrets

| Secret | Used for |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Pages account |
| `MODEL_VERIFIER_SIGNING_KEY` | Ed25519 private key for release manifest signing |
| `GITHUB_TOKEN` | Auto-provisioned; used by pages-action for PR status checks |

### Security headers

`public/_headers` configures Cloudflare Pages to add the following to all responses:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src data:;
  frame-ancestors 'none'; base-uri 'none'; form-action 'none'
```

`unsafe-inline` on `script-src` and `style-src` is required because all CSS and JS is inline in `index.html`. There are no external script or style loads.

---

## 8. Regulatory Watch Automation

`weekly-regulatory-watch.yml` runs every Monday at 08:00 UTC. It can also be triggered manually with optional parameters.

### What it does

1. Runs `scripts/regulatory-watch.mjs` — checks framework versions in `schema/regulatory-watch.json` against known update schedules and optionally against GitHub release APIs
2. Emits a Markdown report to `/tmp/watch-report.md`
3. Finds an open GitHub issue labeled `regulatory-watch`
4. If one exists: updates its title and body with the new report
5. If none exists: creates a new issue with the report
6. If `has_critical=true` (exit code 1 from the script): prefixes the issue title with a red indicator

The script exits 0 for no critical items, 1 for critical items (frameworks near or past their review date), and 2+ for script errors.

The workflow intentionally does not auto-close issues even when no criticals are found — the team reviews and closes manually.

### Configuring regulatory watch

Edit `schema/regulatory-watch.json` to add frameworks, update version strings, or change review cadence. The script reads this file to determine what to check.

---

## 9. Schema Extension Points

### Adding a field to a control record

1. Add the field definition to `schema/model-controls.schema.json` under `properties`
2. If the field is model-assurance-specific (not a core Apeiris field), also document it in `schema/model-assurance-extension.schema.json`
3. Add validation logic in `scripts/validate.mjs` if the field has cross-field constraints
4. Update `build-integration.mjs` to include the field in the serialized dataset (it passes through automatically unless you add it to `STRIP_FIELDS`)
5. Update `public/index.html` to render the field if it should appear in the UI drawer

### Adding a framework mapping key

1. Add the key to `FRAMEWORK_KEYS` array in `build-integration.mjs`
2. Add the display name and authority to `FRAMEWORK_DISPLAY` in `build-integration.mjs`
3. Add the framework's allowed `requirement_id` patterns to `schema/framework-mapping-catalog.json`
4. Add the framework to `VALID_FRAMEWORK_KEYS` in `scripts/validate.mjs`
5. Update `schema/model-controls.schema.json` — the `frameworks[].framework` enum
6. Add the framework to the drawer's `fillFrameworks()` renderer in `public/index.html`

### Adding a deployment profile

1. Add a profile object to `schema/profiles.json` under `profiles[]`
2. Define `trigger_conditions` (all/any/none predicate sets), `required_controls`, `recommended_controls`, `not_applicable_controls`, and `not_applicable_rationale`
3. Add the `profile_id` to `PROFILE_IDS` in `build-integration.mjs` if you need it validated during build
4. Add a short display name to `PROFILE_SHORT` in `public/index.html` for the filter label
5. Run `npm run build` to regenerate artifacts

Profile trigger logic:
```
active when:
  ALL conditions in trigger_conditions.all are true (if present)
  AND at least one condition in trigger_conditions.any is true (if present)
  AND no conditions in trigger_conditions.none are true (if present)
```

### Monitoring schema (BH and CR layers)

Controls in the BH and CR layers must include a `monitoring_schema` block. This is a machine-executable metric specification:

```json
{
  "monitoring_schema": {
    "metrics": [
      {
        "metric_id": "example-drift-rate",
        "metric_type": "drift",
        "measure": "population-stability-index",
        "population": "all-production-scored-cases",
        "comparison": {
          "operator": "gt",
          "value": 0.2,
          "window": "7d",
          "evaluation_mode": "batch"
        },
        "severity": "high",
        "actions": [...],
        "fallback": {...}
      }
    ]
  }
}
```

The Apeiris Model Verifier consumes `monitoring_schema` to drive automated threshold evaluation. The field is validated by `scripts/validate.mjs` (`validate:schema` check).

---

## 10. Adding a New Domain (Fork Guide)

modelverifier.ai is designed to be forkable. The pattern — per-layer JSON source files, a build script that assembles a machine-readable artifact, and a single-file SPA viewer — works for any assurance domain.

### Namespace reservation

The Apeiris namespace registry (`apeiris-control-core/namespace-registry.json` in the parent repo) tracks which control ID prefixes are reserved per domain:

- Security domain (securitycontrols.ai): `IA EC PT GV RT AS`
- Model domain (modelverifier.ai): `LI TG EV OA BH CR`

Before forking, register your layer codes in the namespace registry to prevent cross-domain ID collision as more domains are added. Cross-domain URIs use the `apeiris://` scheme (e.g., `apeiris://model/EV-07`) and are validated by `audit:cross-domain`.

### Minimal fork steps

1. Copy the repository structure
2. Replace `controls/*.json` with your domain's control records using new layer codes
3. Update `LAYER_ORDER`, `LAYER_DEFINITIONS`, `BASELINE_CONTROLS`, and `FRAMEWORK_KEYS` in `build-integration.mjs`
4. Update the schema `$id` URIs and enum values in `schema/model-controls.schema.json`
5. Update `VALID_LAYERS`, `LAYER_PLANE`, and enum catalogs in `scripts/validate.mjs`
6. Replace the layer-specific CSS variables and `LAYER_META` object in `public/index.html`
7. Update `schema/profiles.json` with domain-appropriate profiles
8. Update `package.json` `name` and `description`
9. Wire up a new Cloudflare Pages project and update secrets in GitHub Actions

For a detailed domain-creation walkthrough including schema authoring standards, see [`docs/TEMPLATE-GUIDE.md`](docs/TEMPLATE-GUIDE.md).

---

## Key invariants the build enforces

| Invariant | Enforced by |
|-----------|------------|
| Every control has a unique ID matching `LAYER-NN` format | `validate:namespaces` |
| Layer prefix in ID matches `layer` field | `validate:namespaces` |
| Every control's `plane` matches the layer's assigned plane | `validate:namespaces` |
| Every source has a `flagship: true` entry per control | `validate:sources` |
| Every substantive claim cites a source or is flagged thesis | `validate:sources` (cite-or-flag) |
| All framework `requirement_id` values exist in the catalog | `audit:mappings` |
| `partial` fit mappings have `uncovered_portion` | `audit:mappings` |
| `direct` fit mappings have `source_locator` | `audit:mappings` |
| SR 26-2 obligations have `normative_force: supervisory-guidance`, not `binding-law` | `audit:legal-status` |
| Baseline controls (15) are all present in the dataset | `build-integration.mjs` validation |
| BH and CR controls have `monitoring_schema` | `validate:schema` |
| NIST RMF and ISO 42001 mappings present on every control (all 6 layers, including BH and CR) | `build-integration.mjs` validation — 0 warnings in v1.0 release |
