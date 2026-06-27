# Apeiris Domain Template Guide

This guide walks through creating a new Apeiris verifier/matrix site using modelverifier.ai as the template. Follow the steps in order — each step has a concrete prerequisite in the step before it.

**The core principle**: the control data (JSON files in `controls/`) is the hard editorial work. The template engine — the SPA in `public/index.html`, the build pipeline, and the deployment machinery — handles everything else and requires only targeted changes to domain-specific constants.

---

## What is an Apeiris domain?

Each domain is an independent Git repository named after its public site (e.g., `privacycontrols.ai/`, `compliancecontrols.ai/`). A domain contains:

| Path | Purpose |
|---|---|
| `controls/<LAYER>.json` | One JSON file per layer; each file is an array of control objects |
| `schema/<domain>-extension.schema.json` | Domain-specific schema extension over the core |
| `schema/<domain>-controls.schema.json` | Combined schema (core + extension) used by validate scripts |
| `schema/framework-mapping-catalog.json` | Catalog of frameworks used in this domain's mappings |
| `schema/profiles.json` | Deployment profiles with trigger conditions and control sets |
| `public/index.html` | Single-file SPA — the entire UI with inlined CSS and JS |
| `public/_headers` | Cloudflare Pages security headers (copy verbatim) |
| `build-integration.mjs` | Build pipeline — reads controls/, writes integration/ |
| `package.json` | npm scripts for validate, build, audit, ci |
| `.github/workflows/deploy.yml` | CI/CD pipeline to Cloudflare Pages |
| `integration/` | Build output — the published JSON bundle consumed by the UI and external integrators |

The shared foundation lives in `apeiris-control-core/` (a sibling repository). Its schemas define the base control shape, and its `namespace-registry.json` is the single source of cross-domain truth for layer prefixes, framework keys, lens vocabularies, and profile names.

---

## Step 1: Prerequisites

**Knowledge requirements**

- Familiarity with JSON Schema draft-07
- Understanding of the domain's regulatory landscape (which frameworks apply, what obligations exist)
- Subject-matter expertise sufficient to write defensible control text — this is not boilerplate generation

**Tools**

- Node.js 20 LTS or later (the build pipeline uses ESM and `node:crypto`)
- Git
- A Cloudflare account with Pages enabled
- Access to the `apeiris-control-core` repository (required for schema validation)

**Repository setup**

```
# Clone modelverifier.ai as the starting template
git clone https://github.com/CyberDefenseOperations/modelverifier.ai.git privacycontrols.ai
cd privacycontrols.ai
git remote remove origin
git remote add origin https://github.com/CyberDefenseOperations/privacycontrols.ai.git

# Ensure apeiris-control-core is a sibling directory
ls ../apeiris-control-core/namespace-registry.json  # must exist
```

The validate scripts resolve `apeiris-control-core/` as a sibling of the domain repository. This path is not configurable — keep the directory layout flat.

---

## Step 2: Register your namespace

**Before writing a single control**, register your domain in `apeiris-control-core/namespace-registry.json`. The build validation step `validate:namespaces` will reject any control whose prefix is not registered here.

Open `apeiris-control-core/namespace-registry.json` and make three edits:

**2a. Add a domain entry** under `domains`:

```json
"privacy": {
  "display_name": "Apeiris Privacy Controls",
  "site": "https://privacycontrols.ai",
  "schema_base": "https://schema.apeiris.io/privacy/v1/",
  "corpus_base": "https://privacycontrols.ai/integration/",
  "status": "in-development",
  "description": "Privacy and data governance control matrix covering GDPR, CCPA, PIPL, and emerging data governance frameworks.",
  "layers": {
    "PC": { "name": "Privacy by Design and Consent",        "plane": "control",   "ordinal": 1 },
    "DC": { "name": "Data Collection and Minimisation",     "plane": "data",      "ordinal": 2 },
    "DR": { "name": "Data Rights and Subject Requests",     "plane": "control",   "ordinal": 3 },
    "DT": { "name": "Data Transfer and Third-Party Sharing","plane": "data",      "ordinal": 4 },
    "SC": { "name": "Security and Breach Notification",     "plane": "both",      "ordinal": 5 },
    "PA": { "name": "Privacy Assurance and Accountability", "plane": "lifecycle", "ordinal": 6 }
  },
  "lenses": {
    "canonical_keys": ["engineering", "legal", "dpo", "grc", "product"],
    "descriptions": {
      "engineering": "Privacy engineering and data protection by design perspective.",
      "legal": "Legal compliance and regulatory obligation perspective.",
      "dpo": "Data Protection Officer oversight and accountability perspective.",
      "grc": "Governance, risk, and compliance programme perspective.",
      "product": "Product management and user-experience privacy design perspective."
    }
  },
  "frameworks": {
    "canonical_keys": ["gdpr", "ccpa", "pipl", "iso_27701", "nist_privacy"],
    "registry": {
      "gdpr": { "display_name": "EU General Data Protection Regulation (2016/679)", "authority": "European Parliament and Council" },
      "ccpa": { "display_name": "California Consumer Privacy Act", "authority": "California Legislature" }
    }
  },
  "profiles": {
    "canonical_keys": ["gdpr-controller", "gdpr-processor", "ccpa-business"]
  }
}
```

**2b. Add prefixes to `reserved_prefixes`**:

```json
"privacy": ["PC", "DC", "DR", "DT", "SC", "PA"]
```

Every prefix must appear in exactly one domain. The `validate:namespaces` check fails if any prefix appears in more than one domain or in `reserved_prefixes` without a matching domain entry.

**2c. Add a resolver entry** under `resolver_map`:

```json
"apeiris://privacy": {
  "controls_path": "privacycontrols.ai/controls/",
  "integration_path": "privacycontrols.ai/integration/",
  "schema_path": "privacycontrols.ai/schemas/"
}
```

Commit this to `apeiris-control-core` before proceeding. All subsequent validation steps depend on it.

---

## Step 3: Design your layer structure

A layer is a functional grouping of controls — not a lifecycle stage and not an org chart. Each layer gets a two-to-six uppercase letter prefix that becomes part of every control ID in that layer.

**Design constraints**

- 6 layers is the established pattern. Fewer layers produce sparse UX; more layers make the sidebar overwhelming. 6 is not a hard limit, but diverging requires updating `LAYER_ORDER` in both `build-integration.mjs` and `index.html`.
- Prefixes must be unique across all domains. Check `reserved_prefixes` in `namespace-registry.json` before choosing.
- Each layer maps to one plane: `control`, `data`, `lifecycle`, or `both`. This is used by the UI's plane-pill display and by the build pipeline's plane summary.
- Control count guidance: aim for 8–12 controls per layer. Under 6 is too thin to be useful; over 15 makes layers hard to navigate in the UI.

**Planes**

| Plane | Meaning |
|---|---|
| `control` | Policy, governance, identity, configuration — what the system is and who owns it |
| `data` | What flows in and out — inputs, outputs, stored data |
| `lifecycle` | Event-driven, ongoing assurance — re-evaluation, incidents, decommissioning |
| `both` | Spans control and data planes simultaneously |

**Example for privacycontrols.ai** (already registered above):

| Code | Name | Plane | Ordinal | Target count |
|---|---|---|---|---|
| PC | Privacy by Design and Consent | control | 1 | 9 |
| DC | Data Collection and Minimisation | data | 2 | 8 |
| DR | Data Rights and Subject Requests | control | 3 | 9 |
| DT | Data Transfer and Third-Party Sharing | data | 4 | 7 |
| SC | Security and Breach Notification | both | 5 | 9 |
| PA | Privacy Assurance and Accountability | lifecycle | 6 | 8 |

---

## Step 4: Define your framework set

Frameworks are the external standards your controls map to. Each domain has a different set. Domains that overlap (e.g., privacy and model assurance both reference ISO/IEC 42001) register the framework independently — the keys are domain-local, not global.

**Create `schema/framework-mapping-catalog.json`**

Start from `modelverifier.ai/schema/framework-mapping-catalog.json` and replace its content. The catalog defines:

- `id` — the framework key used in control `frameworks[]` entries (lowercase, underscored)
- `title`, `authority`, `normative_force`, `version`, `canonical_url`
- `requirement_id_pattern` — regex the build audit uses to validate mapping `requirement_id` values
- `requirement_id_examples` — used by IDE plugins and documentation

For privacycontrols.ai, the catalog would cover: `gdpr`, `ccpa`, `pipl`, `iso_27701`, `nist_privacy`.

Example entry:

```json
"gdpr": {
  "id": "gdpr",
  "title": "General Data Protection Regulation (EU) 2016/679",
  "short_name": "GDPR",
  "authority": "European Parliament and Council",
  "source_type": "regulation",
  "normative_force": "binding-law",
  "version": "2016/679",
  "published_on": "2016-04-27",
  "canonical_url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679",
  "license": "eu-public-sector-information",
  "status": "current",
  "requirement_id_pattern": "^Art\\.\\s*\\d+(\\(\\d+\\))?([a-z])?$",
  "requirement_id_examples": ["Art. 5(1)", "Art. 6(1)", "Art. 13", "Art. 17", "Art. 25", "Art. 33"]
}
```

The `requirement_id_pattern` is validated by `audit:mappings` for every `framework` entry in every control file. Write it carefully — a pattern that is too strict will break the build; one that is too loose will allow mapping errors.

---

## Step 5: Create the schema extension

Copy `schema/model-assurance-extension.schema.json` to `schema/<domain>-extension.schema.json` (e.g., `privacy-extension.schema.json`). Then edit it:

**What to keep from the core extension shape:**

- `monitoring_schema` definition and associated `metric_object` — keep if your domain has production monitoring controls (e.g., SC layer for breach detection)
- `mapping_object` — keep verbatim; this adds the 7 split status fields to each framework mapping entry
- `obligation_object` — keep verbatim; this is the structure for `obligations[]` entries

**What to replace:**

- `model_lens_set` definition — replace with your domain's lens vocabulary:

```json
"privacy_lens_set": {
  "description": "Privacy domain persona lens key set.",
  "required_keys": ["engineering", "legal", "dpo", "grc", "product"]
}
```

- `capability_risk` definition — this is model-assurance-specific. For privacy, remove it and replace with a domain-specific risk object if needed, or omit entirely. Most domains do not need a capability risk object — the core `control-core.schema.json` already has `tiers[]` for profile-based applicability.

- `assurance_target` definition — this is the deployment-specific binding object. Model assurance has a rich `assurance_target` because risk classification requires knowing how a model is deployed. For privacy, the equivalent would be a data subject and processing activity record. Most new domains should start without a formal `assurance_target` and add it in a later schema version once the control corpus is stable.

**Update `$id`**:

```json
"$id": "https://schema.apeiris.io/privacy/v1/privacy-extension.schema.json"
```

**Create `schema/<domain>-controls.schema.json`**

This is the combined schema used by `scripts/validate.mjs` to validate control files. It uses explicit property composition (rather than `allOf`) because `control-core.schema.json` uses `additionalProperties: false` at the root, which is incompatible with additive `allOf` extension in JSON Schema draft-07.

Copy `schema/model-controls.schema.json`, update the `$id`, and change the lens key constraint from `["engineering", "evaluation", "red_team", "grc", "mlops"]` to your domain's lens keys.

---

## Step 6: Author your baseline controls

The minimum viable corpus is 15 controls spanning all layers. This is enough for the UI to be useful and for the integration endpoint to demonstrate meaningful coverage. Target 2–3 controls per layer in the baseline set.

**Control file layout**

Each layer gets one JSON file in `controls/`. The filename is the layer prefix: `PC.json`, `DC.json`, `DR.json`, etc. Each file is a JSON array of control objects:

```json
[
  {
    "$schema": "https://schema.apeiris.io/privacy/v1/privacy-controls.schema.json",
    "id": "PC-01",
    "layer": "PC",
    "plane": "control",
    "name": "Privacy by Design Obligation and System Classification",
    "plain": "Every new system that processes personal data must be assessed for privacy risk before build, not after.",
    "threat": {
      "tags": ["unlawful-processing", "privacy-by-afterthought", "inadequate-dpia"],
      "desc": "Systems built without privacy risk assessment frequently process personal data in ways that are disproportionate, unlawful, or technically irreversible to remediate post-launch. GDPR Art. 25 imposes a design-time obligation specifically because retrofitting privacy controls after deployment is both costly and often technically impossible for systems that have already collected or exposed personal data."
    },
    "sources": [
      {
        "id": "gdpr_2016_679",
        "title": "General Data Protection Regulation (EU) 2016/679",
        "authority": "European Parliament and Council",
        "source_type": "regulation",
        "normative_force": "binding-law",
        "version": "2016/679",
        "published_on": "2016-04-27",
        "retrieved_on": "2026-06-26",
        "canonical_url": "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679",
        "license": "eu-public-sector-information",
        "status": "current",
        "flagship": true
      }
    ],
    "implementation": {
      "pattern": "Mandatory privacy impact screening gate at system initiation, with DPIA for high-risk processing.",
      "steps": [
        "Define a privacy risk screening questionnaire covering data categories, processing purposes, data subject population, and cross-border transfer intent.",
        "Require completion of the screening gate before any system architecture decisions are made — not at the end of design.",
        "For processing that meets any high-risk threshold (Art. 35 criteria), initiate a formal DPIA before processing commences.",
        "Document the screening outcome and DPIA result in the system's data processing record maintained by the DPO."
      ],
      "anti_patterns": [
        "Running a DPIA after the system is already built and only making superficial changes to the documented design.",
        "Using a checkbox questionnaire that always returns 'low risk' regardless of the processing activity."
      ]
    },
    "validation": {
      "design_check": [
        "Does the system design process include a documented privacy risk screening step before architecture sign-off?",
        "Is there a written threshold that triggers a DPIA, and is it calibrated to GDPR Art. 35 criteria?"
      ],
      "runtime_test": [
        "Attempt to create a new processing activity record without completing the screening gate — verify the process is blocked.",
        "Review the DPO's processing activity register to confirm all high-risk systems have documented DPIA outcomes."
      ],
      "evidence": [
        "Privacy impact screening records for the past 12 months",
        "DPIA reports for all high-risk processing activities",
        "Data processing register entries linking each system to its screening outcome"
      ]
    },
    "lenses": {
      "engineering": {
        "summary": "Privacy requirements must be captured as acceptance criteria before architecture begins — not as a post-build review.",
        "actions": ["Add a privacy screening step to the project initiation checklist in your engineering workflow.", "Block system creation tickets until screening is complete."],
        "tools": ["JIRA custom fields for privacy screening status", "Confluence DPIA templates", "OneTrust or TrustArc for DPIA workflow management"]
      },
      "legal": {
        "summary": "GDPR Art. 25 (data protection by design and by default) is a proactive obligation — it attaches at the time of design, not when data collection begins.",
        "actions": ["Define the organisation's DPIA threshold in writing, referencing GDPR Art. 35(1) and Art. 35(3).", "Review DPA guidance on DPIA triggers for your jurisdiction."]
      },
      "dpo": {
        "summary": "The DPO must be involved in DPIA processes and can block high-risk processing until the assessment is complete and documented.",
        "actions": ["Maintain a processing activity register (Art. 30) that records screening outcomes for every system.", "Set a calendar reminder for annual re-screening of existing high-risk systems."]
      },
      "grc": {
        "summary": "This control is a design-time gate — its absence creates compounding remediation risk across the portfolio.",
        "actions": ["Include privacy screening completion as a gate in the project governance framework.", "Track DPIA backlog as a GRC risk item."]
      },
      "product": {
        "summary": "Product decisions that involve new data types or new use of existing data require a privacy review before sprint commitment.",
        "actions": ["Add a privacy screening step to the product spec sign-off checklist.", "Treat DPIA initiation as a dependency in the project roadmap, not a post-launch task."]
      }
    },
    "maturity": {
      "current": "initial",
      "target": "defined"
    },
    "coverage_note": "This control covers the design-time obligation under GDPR Art. 25 and the DPIA trigger obligation under Art. 35. It does not cover the ongoing review of existing processing activities (see PA-02) or cross-border transfer assessments (see DT-01).",
    "readiness": "draft",
    "tiers": ["gdpr-controller", "gdpr-processor"],
    "frameworks": [
      {
        "framework": "gdpr",
        "requirement_id": "Art. 25",
        "fit": "direct",
        "direction": "control-supports-requirement",
        "rationale": "GDPR Art. 25 requires data protection by design and by default. This control directly implements that obligation by mandating privacy assessment before system design is finalised.",
        "source_version": "2016/679",
        "reviewed_on": "2026-06-26",
        "mapping_confidence": "high",
        "legal_status": "binding",
        "source_status": "authoritative"
      }
    ]
  }
]
```

**Baseline control selection guidance**

The baseline is the set every deployment must satisfy regardless of which profiles apply. Choose controls that:

- Cover something in every layer (so the baseline provides end-to-end coverage)
- Address the most universal risk in that layer — not the most edge-case
- Can be reasonably assessed without deep specialization

For privacycontrols.ai, a baseline set of 15 might be: `PC-01`, `PC-04`, `DC-01`, `DR-01`, `DR-03`, `DT-01`, `SC-01`, `SC-03`, `PA-01`, `PA-02`, and five more distributed across the higher-count layers.

Register the baseline in `namespace-registry.json` under `domains.privacy.baseline_controls`.

---

## Step 7: Customize index.html

`public/index.html` is a single-file SPA. The HTML structure, assessment mode, share links, export/import, tooltip engine, dark/light mode toggle, and responsive layout are part of the template engine — do not touch them. The changes needed for a new domain are entirely in the JS config block that starts at the comment `// ── Config ──`.

**7a. `DATA_URL`** — update the integration bundle filename:

```js
// modelverifier.ai (do not change)
const DATA_URL = '/integration/model-controls-full.json';

// privacycontrols.ai
const DATA_URL = '/integration/privacy-controls-full.json';
```

**7b. `LAYER_META`** — replace with your domain's layers:

```js
// modelverifier.ai
const LAYER_META = {
  LI: { name: 'AI Asset, Lineage & Applicability',      plane: 'control'   },
  TG: { name: 'Training & Data Governance',             plane: 'data'      },
  EV: { name: 'Evaluation, Validation & Release',       plane: 'both'      },
  OA: { name: 'Governance, Accountability & Oversight', plane: 'control'   },
  BH: { name: 'Deployment & Runtime Assurance',         plane: 'data'      },
  CR: { name: 'Continuous Risk, Incident & Evidence',   plane: 'lifecycle' },
};

// privacycontrols.ai
const LAYER_META = {
  PC: { name: 'Privacy by Design & Consent',         plane: 'control'   },
  DC: { name: 'Data Collection & Minimisation',      plane: 'data'      },
  DR: { name: 'Data Rights & Subject Requests',      plane: 'control'   },
  DT: { name: 'Data Transfer & Third-Party Sharing', plane: 'data'      },
  SC: { name: 'Security & Breach Notification',      plane: 'both'      },
  PA: { name: 'Privacy Assurance & Accountability',  plane: 'lifecycle' },
};
```

**7c. `LAYER_ORDER`** — update to match your layers in ordinal sequence:

```js
// privacycontrols.ai
const LAYER_ORDER = ['PC', 'DC', 'DR', 'DT', 'SC', 'PA'];
```

**7d. `LENS_LABELS`** — replace with your domain's lens keys and display names:

```js
// modelverifier.ai
const LENS_LABELS = {
  engineering: 'Engineering',
  evaluation:  'Evaluation',
  red_team:    'Red Team',
  grc:         'GRC',
  mlops:       'MLOps',
};

// privacycontrols.ai
const LENS_LABELS = {
  engineering: 'Engineering',
  legal:       'Legal',
  dpo:         'DPO',
  grc:         'GRC',
  product:     'Product',
};
```

**7e. `FW_NAMES`** — replace with your framework keys and display names:

```js
// privacycontrols.ai
const FW_NAMES = {
  gdpr:        'GDPR (2016/679)',
  ccpa:        'CCPA',
  pipl:        'PIPL (China)',
  iso_27701:   'ISO/IEC 27701:2019',
  nist_privacy: 'NIST Privacy Framework',
};
```

**7f. Layer color CSS variables** — each layer prefix gets three CSS custom properties in the `:root` block. The pattern is `--<prefix-lowercase>`, `--<prefix-lowercase>-bg`, `--<prefix-lowercase>-br`. Choose colors that are visually distinct and accessible:

```css
/* modelverifier.ai — keep as reference, replace with privacy domain colors */
--li: #6366f1;  --li-bg: rgba(99,102,241,0.12);  --li-br: rgba(99,102,241,0.3);
--tg: #8b5cf6;  --tg-bg: rgba(139,92,246,0.12);  --tg-br: rgba(139,92,246,0.3);

/* privacycontrols.ai */
--pc: #0ea5e9;  --pc-bg: rgba(14,165,233,0.12);   --pc-br: rgba(14,165,233,0.3);
--dc: #6366f1;  --dc-bg: rgba(99,102,241,0.12);   --dc-br: rgba(99,102,241,0.3);
--dr: #10b981;  --dr-bg: rgba(16,185,129,0.12);   --dr-br: rgba(16,185,129,0.3);
--dt: #f59e0b;  --dt-bg: rgba(245,158,11,0.12);   --dt-br: rgba(245,158,11,0.3);
--sc: #ef4444;  --sc-bg: rgba(239,68,68,0.12);    --sc-br: rgba(239,68,68,0.3);
--pa: #06b6d4;  --pa-bg: rgba(6,182,212,0.12);    --pa-br: rgba(6,182,212,0.3);
```

Then find every `.layer-badge.LI`, `.ctrl-id.LI`, `.chip[data-layer="LI"].active` etc. block in the CSS and replace the layer codes throughout. This is a global find-and-replace — do it with your editor's multi-cursor or a sed command.

**7g. Site title and metadata** — update the `<title>`, `<meta name="description">`, `<link rel="canonical">`, and Open Graph tags at the top of `<head>`:

```html
<title>privacycontrols.ai — Privacy & Data Governance Control Matrix</title>
<meta name="description" content="50 machine-readable privacy controls across 6 layers. Citation-backed, obligation-linked. GDPR, CCPA, PIPL, ISO 27701, NIST Privacy Framework.">
<link rel="canonical" href="https://privacycontrols.ai/">
```

**7h. `TAG_LABELS`** — update the tag label and tooltip dictionary. The model domain uses MITRE ATLAS and OWASP LLM Top 10 prefixed tags. The privacy domain would use GDPR article references, privacy threat taxonomy tags, and ISO 27701 clause references:

```js
const TAG_LABELS = {
  'unlawful-processing':      { label: 'Unlawful Processing',        tip: 'Processing of personal data without a valid legal basis under GDPR Art. 6 or equivalent.' },
  'inadequate-dpia':          { label: 'Inadequate DPIA',            tip: 'Failure to conduct or adequately document a DPIA for high-risk processing under GDPR Art. 35.' },
  'data-subject-right-denial':{ label: 'Data Subject Right Denied',  tip: 'Failure to fulfil a data subject access, erasure, rectification, or portability request within the statutory period.' },
  'cross-border-transfer':    { label: 'Unlawful Cross-Border Transfer', tip: 'Transfer of personal data to a third country without an adequate safeguard mechanism under GDPR Chapter V.' },
};
```

Kebab-case tags that are not in `TAG_LABELS` are humanized automatically by `tagHtml()` — you do not need to register every tag, only the ones where you want a precise label and tooltip.

**7i. `PROFILE_SHORT`** — update the profile short-name map used by the profile filter dropdown. Find the `PROFILE_SHORT` constant in the script and replace with your domain's profiles:

```js
const PROFILE_SHORT = {
  'gdpr-controller':      'GDPR Controller',
  'gdpr-processor':       'GDPR Processor',
  'ccpa-business':        'CCPA Business',
  'cross-border-transfer':'Cross-Border Transfer',
  'special-category-data':'Special Category Data',
};
```

**7j. localStorage key** — change `LS_KEY` to prevent collision if a user has both sites open:

```js
// modelverifier.ai
const LS_KEY = 'mvai_assess_v1';

// privacycontrols.ai
const LS_KEY = 'pcai_assess_v1';
```

**7k. About / stats text** — search for the `wordmark-sub` text, the footer about-text, and the stats-bar labels. Update them to reflect the new domain count and name.

---

## Step 8: Set up the build pipeline

Copy `build-integration.mjs` from modelverifier.ai into the new repository. Make the following targeted changes:

**8a. `LAYER_ORDER` constant** — replace the model layer prefixes:

```js
// modelverifier.ai
const LAYER_ORDER = ['LI', 'TG', 'EV', 'OA', 'BH', 'CR'];

// privacycontrols.ai
const LAYER_ORDER = ['PC', 'DC', 'DR', 'DT', 'SC', 'PA'];
```

**8b. `LAYER_DEFINITIONS` constant** — replace the full layer metadata block, following the same shape. Each entry needs `code`, `name`, `plane`, `ordinal`, `description`, and `baseline_controls`.

**8c. `FRAMEWORK_KEYS` and `FRAMEWORK_DISPLAY`** — replace with your framework keys:

```js
const FRAMEWORK_KEYS = ['gdpr', 'ccpa', 'pipl', 'iso_27701', 'nist_privacy'];

const FRAMEWORK_DISPLAY = {
  gdpr:        { name: 'GDPR (2016/679)',             authority: 'EU' },
  ccpa:        { name: 'California Consumer Privacy Act', authority: 'California Legislature' },
  pipl:        { name: 'PIPL (China)',                 authority: "National People's Congress" },
  iso_27701:   { name: 'ISO/IEC 27701:2019',           authority: 'ISO/IEC' },
  nist_privacy:{ name: 'NIST Privacy Framework 1.0',   authority: 'NIST' },
};
```

**8d. `BASELINE_CONTROLS`** — replace with your baseline control IDs.

**8e. `PROFILE_IDS`** — replace with your profile IDs.

**8f. Output filename** — find the line that writes the output JSON and change the filename:

```js
// modelverifier.ai
const outPath = join(args.outDir, 'model-controls-full.json');

// privacycontrols.ai
const outPath = join(args.outDir, 'privacy-controls-full.json');
```

**8g. `validateControl` function** — update the regex that validates control IDs:

```js
// modelverifier.ai
if (ctrl.id && !/^(LI|TG|EV|OA|BH|CR)-[0-9]{2}$/.test(ctrl.id)) {

// privacycontrols.ai
if (ctrl.id && !/^(PC|DC|DR|DT|SC|PA)-[0-9]{2}$/.test(ctrl.id)) {
```

Also update the `LAYER_ORDER.includes(ctrl.layer)` check and any hardcoded framework key lists within `validateControl`.

**8h. `dataset.meta` block** — update the title, subtitle, domain, namespace, site, and corpus_url fields:

```js
const dataset = {
  meta: {
    title: 'Privacy & Data Governance Control Matrix',
    subtitle: 'privacycontrols.ai — Apeiris Privacy Controls Verifier',
    domain: 'privacy',
    namespace: 'apeiris://privacy',
    site: 'https://privacycontrols.ai',
    corpus_url: 'https://privacycontrols.ai/integration/privacy-controls-full.json',
    ...
  }
}
```

**8i. Release manifest** — update the artifact `url` in the manifest output to match the new corpus URL.

---

## Step 9: Update package.json

Copy `modelverifier.ai/package.json`. Change:

- `"name"` → `"@apeiris/privacycontrols-ai"`
- `"description"` → the new domain description and control count
- The `"build"` script output filename in the `cp` command:

```json
"build": "node build-integration.mjs && rm -rf public/integration && cp -r integration public/integration"
```

This script is the same for all domains — no changes needed unless you rename the build script itself.

---

## Step 10: Configure deployment

Copy `.github/workflows/deploy.yml`. Change three values:

**10a. `projectName`** — this must match the Cloudflare Pages project name you create in the Cloudflare dashboard:

```yaml
# modelverifier.ai
projectName: modelverifier-ai

# privacycontrols.ai
projectName: privacycontrols-ai
```

**10b. Environment URL** — update in the `deploy-production` job:

```yaml
environment:
  name: production
  url: https://privacycontrols.ai
```

**10c. Artifact name** — update the `upload-artifact` step name to avoid collision if you run multiple domain pipelines in the same GitHub org:

```yaml
name: privacycontrols-site
```

**10d. GitHub secrets** — the following secrets must exist in the new repository's GitHub settings:

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create Token (Pages edit permission) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → right sidebar of any page |
| `MANIFEST_SIGNING_KEY` | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

**10e. Create the Cloudflare Pages project** — in the Cloudflare dashboard, create a new Pages project named `privacycontrols-ai` with:

- Production branch: `main`
- Build command: _(leave empty — GitHub Actions handles the build)_
- Build output directory: `public`
- Custom domain: `privacycontrols.ai`

---

## Step 11: Set up security headers

Copy `public/_headers` verbatim. No changes are needed — the security headers work for any Apeiris domain as-is:

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-Permitted-Cross-Domain-Policies: none
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src data:; font-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'; worker-src 'none'
```

The CSP `connect-src 'self'` is intentional — the SPA fetches the integration bundle from the same origin only. If you add external analytics or CDN-hosted fonts, extend the policy explicitly.

Also copy `integration/_headers` — this sets CORS headers on the `/integration/` endpoint so external integrators can fetch the JSON bundle:

```
/integration/*
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
```

---

## Step 12: Validate and launch

**12a. Validate schemas**

```bash
npm run validate
```

This runs five checks in sequence: `validate:schema`, `validate:namespaces`, `validate:sources`, `validate:source-versions`, `validate:licenses`. The `validate:namespaces` check reads `apeiris-control-core/namespace-registry.json` from the sibling directory — it will fail if you skipped Step 2.

**12b. Audit framework mappings**

```bash
npm run audit:mappings
```

This checks every `frameworks[]` entry in every control against the `framework-mapping-catalog.json`. It will flag:
- `requirement_id` values that don't match the catalog's `requirement_id_pattern`
- `fit: "partial"` mappings without `uncovered_portion`
- `fit: "direct"` mappings without `source_locator`
- Mapping rationale under 30 characters

Fix all warnings before shipping. In CI, the deploy workflow runs `audit:mappings` as a blocking step.

**12c. Build the integration bundle**

```bash
npm run build
```

This writes `integration/privacy-controls-full.json` and copies it into `public/integration/`. Open `public/index.html` in a browser (via `npx serve public` or any static server) and verify:

- The stats bar shows the correct control count, layer count, and framework count
- Each layer appears in the sidebar with the correct name and color
- The framework filter dropdown shows your frameworks, not the model assurance frameworks
- Clicking a control opens the detail drawer with the correct lens tabs
- The lens tab labels match your `LENS_LABELS` (e.g., "DPO" not "MLOps")
- The framework mapping section shows your framework names from `FW_NAMES`

**12d. Full CI run**

```bash
npm run ci
```

This runs: `validate` → `audit` → `check:freshness` → `build:integration` → `sign:release-manifest`. All steps must pass before merging to main.

**12e. Integration endpoint test**

After deploying to Cloudflare Pages, verify the integration endpoint:

```bash
curl -I https://privacycontrols.ai/integration/privacy-controls-full.json
# Expected: HTTP/2 200, Access-Control-Allow-Origin: *, Content-Type: application/json
```

Then fetch and spot-check the content:

```bash
curl -s https://privacycontrols.ai/integration/privacy-controls-full.json \
  | python3 -m json.tool \
  | grep -E '"domain"|"control_count"|"layer_count"'
```

---

## Checklist

Copy this checklist into the new domain repository's initial PR description.

- [ ] Domain entry added to `apeiris-control-core/namespace-registry.json` (Step 2)
- [ ] Layer prefixes added to `reserved_prefixes` in namespace-registry (Step 2)
- [ ] Resolver entry added to `resolver_map` in namespace-registry (Step 2)
- [ ] `schema/framework-mapping-catalog.json` created with at least one framework (Step 4)
- [ ] `schema/<domain>-extension.schema.json` created (Step 5)
- [ ] `schema/<domain>-controls.schema.json` created (Step 5)
- [ ] At least 15 controls authored across all layers (Step 6)
- [ ] Baseline control set defined and registered in namespace-registry (Step 6)
- [ ] `public/index.html` updated: `DATA_URL`, `LAYER_META`, `LAYER_ORDER`, `LENS_LABELS`, `FW_NAMES`, `TAG_LABELS`, `PROFILE_SHORT`, `LS_KEY`, layer CSS variables, site title, meta description (Step 7)
- [ ] `build-integration.mjs` updated: `LAYER_ORDER`, `LAYER_DEFINITIONS`, `FRAMEWORK_KEYS`, `FRAMEWORK_DISPLAY`, `BASELINE_CONTROLS`, `PROFILE_IDS`, output filename, validateControl regex, dataset.meta fields (Step 8)
- [ ] `package.json` updated: name, description (Step 9)
- [ ] `.github/workflows/deploy.yml` updated: `projectName`, environment URL, artifact name (Step 10)
- [ ] GitHub secrets configured: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `MANIFEST_SIGNING_KEY` (Step 10)
- [ ] Cloudflare Pages project created with correct name (Step 10)
- [ ] `public/_headers` copied verbatim (Step 11)
- [ ] `integration/_headers` copied verbatim (Step 11)
- [ ] `npm run validate` passes with zero errors (Step 12)
- [ ] `npm run audit:mappings` passes with zero errors (Step 12)
- [ ] `npm run build` produces a valid integration bundle (Step 12)
- [ ] UI visually verified in browser: correct layer colors, names, frameworks, lens tabs (Step 12)
- [ ] Integration endpoint accessible with correct CORS headers after deployment (Step 12)

---

## What takes a day vs. what takes longer

**One day is achievable for:**

- Steps 1–3: prerequisites, namespace registration, layer design
- Steps 7–12: all the template engine customization — this is mechanical given a clear layer structure and framework set

**The bottleneck is Step 6 — the controls themselves.**

Writing 15 baseline controls with accurate threat descriptions, defensible framework mappings, sourced citations, and five lens perspectives per control is a minimum of one to two weeks of focused subject-matter editorial work. The template engine costs a day. The intellectual work of the corpus is the project.

Plan accordingly. Launch with 15 well-sourced baseline controls rather than 50 thin ones. The framework mapping audit (`audit:mappings`) and source freshness check (`check:freshness`) are specifically designed to enforce quality gates that prevent shipping low-confidence work — use them.
