# Integration Guide — AI Model & System Assurance Control Matrix

**modelverifier.ai — Apeiris Model Assurance Verifier**
Version: 1.0.0 | License: CC BY-NC 4.0

---

## Table of Contents

1. [Overview](#1-overview)
2. [Fetching the Dataset](#2-fetching-the-dataset)
3. [Data Model Reference](#3-data-model-reference)
   - 3.1 [meta](#31-meta)
   - 3.2 [controls](#32-controls)
   - 3.3 [references](#33-references)
   - 3.4 [layers](#34-layers)
   - 3.5 [planes](#35-planes)
   - 3.6 [profiles](#36-profiles)
   - 3.7 [obligations](#37-obligations)
   - 3.8 [monitoring_schema](#38-monitoring_schema)
   - 3.9 [capability_risk](#39-capability_risk)
   - 3.10 [sources](#310-sources)
   - 3.11 [gaps](#311-gaps)
   - 3.12 [threat_scenarios](#312-threat_scenarios)
   - 3.13 [framework_coverage](#313-framework_coverage)
   - 3.14 [regulatory_coverage](#314-regulatory_coverage)
   - 3.15 [capability_coverage](#315-capability_coverage)
   - 3.16 [lifecycle](#316-lifecycle)
4. [Filtering and Querying](#4-filtering-and-querying)
   - 4.1 [Filter by Profile](#41-filter-by-profile)
   - 4.2 [Filter by Layer](#42-filter-by-layer)
   - 4.3 [Filter by Capability Tier](#43-filter-by-capability-tier)
   - 4.4 [Filter by Obligation Jurisdiction](#44-filter-by-obligation-jurisdiction)
   - 4.5 [Filter by Framework](#45-filter-by-framework)
   - 4.6 [The 15-Control Baseline](#46-the-15-control-baseline)
5. [Cross-Domain Navigation via Namespace Registry](#5-cross-domain-navigation-via-namespace-registry)
6. [Verifying the Release Manifest](#6-verifying-the-release-manifest)
7. [Stable Join Keys Across Apeiris Domains](#7-stable-join-keys-across-apeiris-domains)
8. [Versioning Policy and Changelog](#8-versioning-policy-and-changelog)
9. [License Terms](#9-license-terms)

---

## 1. Overview

`model-controls-full.json` is the machine-readable integration artifact for the
**AI Model & System Assurance Control Matrix** — the second Apeiris public
knowledge domain, served at **modelverifier.ai**.

The dataset is consumed by:

- The **Apeiris Model Assurance Verifier** — the runtime component that
  evaluates deployed AI systems against the control matrix.
- External integrators building compliance dashboards, model governance
  toolchains, and ML risk management platforms.
- The Apeiris runtime's cross-domain namespace resolver, which links model
  assurance controls to security controls from securitycontrols.ai and future
  domains (privacy, compliance, finance).

The dataset is **static JSON** — no API key, no authentication, no rate limit.
It is hosted on Cloudflare Pages with CORS enabled, allowing any origin to
fetch it directly from client-side code.

**54 controls** across **6 layers** with mappings to **8 frameworks**:
NIST AI RMF, ISO/IEC 42001:2023, EU AI Act, SR 26-2, OWASP AISVS v1.0,
OWASP LLM Top 10 2025, CSA AICM, and MITRE ATLAS v5.6.0.

---

## 2. Fetching the Dataset

### Primary endpoint

```
GET https://modelverifier.ai/integration/model-controls-full.json
```

**CORS:** `Access-Control-Allow-Origin: *` — fetch from any origin.

**Content-Type:** `application/json; charset=utf-8`

**Cache-Control:** `public, max-age=3600, stale-while-revalidate=86400`

### Example — browser fetch

```javascript
const resp = await fetch('https://modelverifier.ai/integration/model-controls-full.json');
const { dataset } = await resp.json();

console.log(dataset.meta.control_count);   // 54
console.log(dataset.meta.version);         // "1.0.0"
```

### Example — Node.js / server-side

```javascript
import { createHash } from 'node:crypto';

const resp = await fetch('https://modelverifier.ai/integration/model-controls-full.json');
const body = await resp.text();

// Optional: verify content hash before parsing
const { dataset } = JSON.parse(body);
const storedHash = dataset.meta.content_hash;
// Remove the hash field to recompute the pre-hash body
// (see §6 for full verification procedure)

console.log(`Loaded ${dataset.controls.length} controls`);
```

### Release manifest endpoint

```
GET https://modelverifier.ai/integration/release-manifest.json
```

The manifest contains the content hash of the current `model-controls-full.json`
and (for signed production releases) a detached signature URL. See
[§6 Verifying the Release Manifest](#6-verifying-the-release-manifest).

---

## 3. Data Model Reference

The top-level structure of the JSON response:

```jsonc
{
  "dataset": {
    "meta": { ... },           // Build metadata and summary counts
    "controls": [ ... ],       // 54 control records
    "references": [ ... ],     // Deduplicated source documents
    "layers": [ ... ],         // 6 layer definitions
    "planes": [ ... ],         // 4 assurance plane definitions
    "gaps": [ ... ],           // Framework coverage gaps
    "profiles": [ ... ],       // 8 deployment profiles
    "patterns": [ ... ],       // Implementation pattern summaries
    "threat_scenarios": [ ... ],       // Aggregated threat tag entries
    "framework_coverage": [ ... ],     // Per-framework coverage statistics
    "regulatory_coverage": [ ... ],    // Per-instrument obligation statistics
    "capability_coverage": [ ... ],    // Coverage by capability level
    "lifecycle": [ ... ]               // Ordered lifecycle stage summary
  }
}
```

### 3.1 `meta`

Top-level build metadata. All fields are stable across patch releases; new
fields may be added in minor releases.

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Human-readable dataset title |
| `domain` | string | Always `"model"` |
| `namespace` | string | Always `"apeiris://model"` |
| `site` | string | Always `"https://modelverifier.ai"` |
| `corpus_url` | string | Canonical URL for this file |
| `version` | string | Dataset semantic version (SemVer) |
| `schema_version` | string | Schema version used to produce this release |
| `generated_at` | ISO 8601 | Build timestamp |
| `generated_by` | string | Always `"build-integration.mjs"` |
| `content_hash` | string | `sha256:` prefixed hash of the JSON body |
| `license` | string | `"CC BY-NC 4.0"` |
| `license_url` | string | Creative Commons license URL |
| `aisvs_compatibility_note` | string | AISVS CC BY-SA 4.0 compatibility note |
| `release_manifest_url` | string | URL of the release manifest |
| `cors` | string | Always `"enabled"` |
| `control_count` | integer | Total controls in this release |
| `baseline_control_count` | integer | Always `15` |
| `baseline_controls` | string[] | The 15 universal baseline control IDs |
| `layer_count` | integer | Always `6` |
| `profile_count` | integer | Always `8` |
| `framework_count` | integer | Always `8` |
| `frameworks` | string[] | Canonical framework key list |
| `profiles` | string[] | Canonical profile ID list |
| `planes` | string[] | Canonical plane ID list |
| `has_warnings` | boolean | True when the build had validation warnings |
| `warning_count` | integer | Number of validation warnings at build time |

### 3.2 `controls`

Array of 54 control records, sorted by layer ordinal then by control number.
Each record conforms to `model-controls.schema.json`.

**Key fields per control:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Control ID — `LI-01` through `CR-08`. Stable, never reused. |
| `layer` | string | Layer code: `LI`, `TG`, `EV`, `OA`, `BH`, or `CR` |
| `plane` | string | Assurance plane: `control`, `data`, `both`, or `lifecycle` |
| `name` | string | Short scannable title (≤ 80 chars) |
| `plain` | string | Plain-language one-sentence summary (≤ 200 chars) |
| `threat` | object | `{tags[], desc}` — threat tags and narrative |
| `standard` | array | Normative standard clauses this control implements |
| `sources` | array | Authoritative sources; see [§3.10](#310-sources) |
| `implementation` | object | `{pattern, steps[], anti_patterns[]}` |
| `validation` | object | `{design_check[], runtime_test[], evidence[]}` |
| `lenses` | object | Five stakeholder views: `engineering`, `evaluation`, `red_team`, `grc`, `mlops` |
| `maturity` | object | `{current, target, notes}` — maturity level tracking |
| `coverage_note` | string | Narrative on gaps and scope boundaries |
| `matrix_thesis` | string | Editorial rationale for the control's inclusion |
| `thesis_type` | string | `preventive`, `detective`, `corrective`, `directive`, etc. |
| `readiness` | string | `draft`, `review`, `approved`, or `deprecated` |
| `tiers` | string[] | Profile IDs to which this control applies |
| `implementers` | string[] | Organizational roles responsible for implementation |
| `frameworks` | array | Framework mapping objects; see below |
| `obligations` | array | Regulatory obligation objects; see [§3.7](#37-obligations) |
| `monitoring_schema` | object | Structured monitoring spec; see [§3.8](#38-monitoring_schema) |
| `capability_risk` | object | Capability risk assessment; see [§3.9](#39-capability_risk) |
| `cross_domain` | object | Navigation pointers and evidence artifacts |
| `meta` | object | `{authored_on, schema_version, changelog[]}` |

**Framework mapping objects** within `frameworks[]`:

Each mapping carries the 7 split status fields tracking source recency,
mapping confidence, legal status, implementation maturity, and assurance state
for that specific framework-requirement pair.

| Field | Type | Description |
|-------|------|-------------|
| `framework` | string | One of 10 canonical framework keys |
| `requirement_id` | string | Framework-specific requirement identifier |
| `fit` | string | `direct`, `partial`, `adjacent`, `supporting`, or `none` |
| `direction` | string | `control-supports-requirement`, `bidirectional`, etc. |
| `rationale` | string | Human-authored explanation of the mapping |
| `uncovered_portion` | string | Required when `fit: "partial"` |
| `source_locator` | object | `{section, clause, page, url}` for direct mappings |
| `source_version` | string | Version of the framework document at mapping time |
| `source_status` | string | `authoritative`, `draft`, `deprecated`, `withdrawn` |
| `mapping_confidence` | string | `verified`, `high`, `medium`, `low`, `speculative` |
| `legal_status` | string | `binding`, `guidance`, `voluntary`, `not-applicable` |
| `control_readiness` | string | `not-started`, `in-design`, `in-review`, `approved`, `published` |
| `implementation_maturity` | string | CMM-style: `none` through `optimizing` |
| `assurance_result` | string | `not-assessed`, `pass`, `pass-with-findings`, `fail` |
| `evidence_status` | string | `no-evidence`, `partial`, `sufficient`, `verified`, `expired` |

### 3.3 `references`

Deduplicated array of all source documents cited across the 54 controls.
One entry per unique `id` (e.g., `nist_ai_rmf_1_0`, `sr262_2026`, `owasp_aisvs_v1`).

Each entry includes the full source metadata plus a `cited_by` array of all
control IDs that cite the source. Use this to navigate from a source document
to the controls grounded in it.

```jsonc
{
  "id": "sr_26_2",
  "title": "SR 26-2 — Supervisory Guidance on Model Risk Management",
  "authority": "Board of Governors of the Federal Reserve System",
  "source_type": "supervisory-guidance",
  "normative_force": "guidance",
  "version": "SR 26-2",
  "published_on": "2026-04-01",
  "retrieved_on": "2026-06-26",
  "artifact_hash": null,
  "canonical_url": "https://www.federalreserve.gov/supervisionreg/srletters/sr2602.htm",
  "license": "us-government-public-domain",
  "supersedes": "SR 11-7, SR 21-8",
  "status": "current",
  "flagship": false,
  "cited_by": ["LI-01", "LI-04", "TG-01", ...]
}
```

**Critical legal note:** SR 26-2 is supervisory guidance, not binding law.
Controls mapped to SR 26-2 carry `legal_status: "guidance"` in their mapping
objects. Do not represent SR 26-2 compliance as legal compliance. The same
applies to OCC 2026-13.

### 3.4 `layers`

Six layer definitions, ordered by lifecycle sequence. Each layer entry
describes the layer's assurance function and lists the controls within it.

| Field | Type | Description |
|-------|------|-------------|
| `code` | string | `LI`, `TG`, `EV`, `OA`, `BH`, `CR` |
| `name` | string | Full layer name |
| `plane` | string | Assigned assurance plane |
| `ordinal` | integer | Lifecycle position 1–6 |
| `description` | string | Layer scope and control function summary |
| `control_count` | integer | Controls in this layer in the current release |
| `baseline_control_count` | integer | Baseline controls in this layer |
| `baseline_controls` | string[] | Baseline control IDs in this layer |
| `controls` | string[] | All control IDs in this layer |

**Layer overview:**

| Code | Name | Plane | Controls |
|------|------|-------|----------|
| `LI` | AI Asset, Lineage and Applicability | control | 10 |
| `TG` | Training & Data Governance | data | 8 |
| `EV` | Evaluation, Independent Validation and Release | both | 10 |
| `OA` | Governance, Accountability and Use-Case Oversight | control | 8 |
| `BH` | Deployment and Runtime Assurance | data | 10 |
| `CR` | Continuous Risk, Incident and Evidence Assurance | lifecycle | 8 |

### 3.5 `planes`

Four assurance planes that cross-cut the layers:

| Plane | Description |
|-------|-------------|
| `control` | Identity, documentation, governance, accountability (LI, OA) |
| `data` | Training data, runtime inputs, outputs, behavioral signals (TG, BH) |
| `both` | Spans control and data planes — evaluation decisions and evidence (EV) |
| `lifecycle` | Event-driven assurance: re-evaluation, incidents, evidence (CR) |

### 3.6 `profiles`

Eight deployment profiles that filter and prioritize the 54-control matrix
based on deployment context. A deployment may belong to multiple profiles
simultaneously.

| Profile ID | Trigger Condition Summary |
|------------|--------------------------|
| `general-predictive-ml` | Supervised/unsupervised ML, no elevated capability or generative output |
| `generative-ai` | Generative paradigm or text/image/code/audio/video output modalities |
| `hosted-api` | Third-party API access mode or open-weight provider type |
| `continuously-learning` | RLHF, online-learning, continual-learning, or adaptive-fine-tuning regime |
| `high-impact-decision` | Consequential decision domains or high/critical affected_party_impact |
| `us-regulated-banking` | US jurisdiction + regulated_entity: true + banking/financial-services industry |
| `eu-high-risk` | EU jurisdiction + EU AI Act high-risk Annex III/product-embedded classification |
| `frontier-capability` | capability_level: "frontier" or dangerous capability domains |

Each profile object includes:
- `trigger_conditions` — machine-evaluable predicates against the `assurance_target`
- `required_controls` — controls that must pass for in-profile compliance
- `recommended_controls` — controls that should be assessed (findings noted, not blocking)
- `not_applicable_controls` — controls explicitly excluded with rationale
- `profile_specific_notes` — per-control implementation notes for this profile
- `enforcement_gating` — effective dates (eu-high-risk profile)

**Profile evaluation semantics:**

A profile is active when ALL conditions in `trigger_conditions.all` are true
AND at least one condition in `trigger_conditions.any` is true AND no condition
in `trigger_conditions.none` is true.

Profile `required_controls` are additive to the 15-control baseline. They
never replace baseline controls.

### 3.7 `obligations`

Each control may carry an `obligations[]` array with executable regulatory
obligation objects. These replace the flat `regulatory_scope` string from
earlier schema generations.

Each obligation object includes:

| Field | Type | Description |
|-------|------|-------------|
| `authority` | string | Issuing body |
| `instrument` | string | Full instrument name |
| `provision` | string | Specific provision (Art-11, S-2.1, etc.) |
| `jurisdiction` | string[] | Jurisdiction codes (e.g., `["eu"]`, `["us"]`) |
| `sector` | string[] | Applicable sectors |
| `actor_roles` | string[] | `provider`, `deployer`, `operator`, etc. |
| `normative_force` | string | `binding-law`, `supervisory-guidance`, `voluntary-standard`, etc. |
| `legal_status` | string | `enacted`, `pending-adoption`, `proposed` |
| `effective_from` | date | When obligation becomes enforceable |
| `applicability` | object | `{all, any, none}` — predicates against `assurance_target` |
| `mapping_fit` | string | `direct`, `partial`, `adjacent`, `supporting` |
| `source_ref` | string | Framework key for cross-referencing |
| `notes` | string | Caveats and pending legal developments |

**Critical legal notes:**

- **EU AI Act high-risk obligations:** `effective_from: "2027-12-02"` for
  standalone Annex III systems; `"2028-08-02"` for product-embedded systems.
  Status: Parliament-approved; Council adoption pending as of 2026-06-26.
- **SR 26-2:** `normative_force: "supervisory-guidance"`. This is NOT binding
  law. Noncompliance alone will not result in supervisory action.
- **OCC 2026-13:** Same supervisory-guidance designation. See SR 26-2 note.

**Evaluating applicability at runtime:**

The Apeiris Model Verifier evaluates `obligation.applicability` predicates
against the live `assurance_target` to determine whether each obligation
applies to a specific deployment. The predicate schema uses the following
operators: `eq`, `neq`, `in`, `not-in`, `contains`, `contains-any`,
`contains-all`, `gte`, `lte`, `gt`, `lt`, `exists`, `eq-true`, `eq-false`.

Example: An EU AI Act Art-11 obligation with `applicability.all` predicates
`[{field: "assurance_target.jurisdiction", op: "contains", value: "eu"}, ...]`
is only applicable when the deployment's jurisdiction includes `"eu"` AND the
EU AI Act classification is `"high-risk-annex-iii"` or equivalent.

### 3.8 `monitoring_schema`

The `monitoring_schema` field is present on controls in the `BH` and `CR`
layers, and on `TG` and `EV` controls with production monitoring implications.
It is absent on pure governance or documentation controls (e.g., `LI-04`,
`OA-01`).

**Structure:**

```jsonc
{
  "monitoring_schema": {
    "sampling_rate": "10%",
    "window_context": "P7D",
    "metrics": [
      {
        "metric_id": "production-f1-weekly",
        "metric_type": "performance",
        "measure": "f1-score",
        "population": "all-production-scored-cases",
        "segments": ["region", "customer-segment"],
        "baseline_ref": "eval-run-2026-06-001",
        "comparison": {
          "operator": "decrease-greater-than",
          "value": 0.05,
          "window": "P7D",
          "evaluation_mode": "batch"
        },
        "minimum_sample_size": 500,
        "confidence_level": 0.95,
        "severity": "critical",
        "actions": ["alert-model-owner", "increase-human-review-rate"],
        "fallback": "previous-approved-version",
        "evidence_retention": "P7Y"
      }
    ]
  }
}
```

**Field reference:**

| Field | Description |
|-------|-------------|
| `sampling_rate` | `"all"`, a percentage, ratio, or stratified sampling spec |
| `window_context` | Default evaluation window (ISO 8601 duration or label) |
| `metrics[]` | One or more independently-evaluated metric definitions |
| `metric_id` | Unique identifier within this control's monitoring schema |
| `metric_type` | `performance`, `drift`, `fairness`, `safety`, or `cost` |
| `measure` | Canonical metric name (e.g., `f1-score`, `jensen-shannon-divergence`) |
| `population` | Dataset or inference population for evaluation |
| `segments` | Population slices for disaggregated evaluation |
| `baseline_ref` | Immutable reference baseline (eval-run ID, hash, or date) |
| `comparison.operator` | Comparison operator; `decrease-greater-than`, `outside-range`, etc. |
| `comparison.value` | Threshold — scalar, string, or `{min, max}` range |
| `comparison.window` | Override for the metric-specific evaluation window |
| `comparison.evaluation_mode` | `"real-time"` or `"batch"` |
| `minimum_sample_size` | Minimum inferences for statistically valid evaluation |
| `confidence_level` | Required statistical confidence (0.0–1.0) |
| `severity` | `"info"`, `"warning"`, or `"critical"` |
| `actions` | Ordered response actions when threshold is breached |
| `fallback` | Fallback state or system when the model is suspended |
| `evidence_retention` | Retention period for evaluation results (ISO 8601 duration) |

**Important statistical note:** Drift metrics (Jensen-Shannon divergence,
Population Stability Index) require a minimum window of data — do not use
`evaluation_mode: "real-time"` or `window: "per-request"` for these. The
`minimum_sample_size` field must be set for all `drift` and `fairness` metrics.

**Hosted API note:** For third-party API deployments, `trigger-retraining-pipeline`
is not an available action. Use provider-agnostic responses: `switch-provider`,
`rollback-to-previous-version`, `restrict-to-supervised-mode`, or
`increase-human-review-rate`.

### 3.9 `capability_risk`

Required on every control record. The `capability_risk` object on a control
record documents the capability risk context in which the control's
requirements apply — distinct from the deployment-specific
`assurance_target.capability_risk` that the Verifier evaluates at runtime.

**Structure:**

```jsonc
{
  "capability_risk": {
    "capability_level": "elevated",
    "capability_domains": ["cyber", "code-generation"],
    "access_mode": "agentic",
    "autonomy": "semi-autonomous",
    "external_reach": true,
    "irreversibility": "partially-reversible",
    "data_sensitivity": "confidential",
    "deployment_scale": "enterprise",
    "affected_party_impact": "high",
    "frontier_framework_refs": [
      {
        "framework": "Anthropic RSP",
        "version": "v3.3",
        "assessed_on": "2026-06-26",
        "asl_level": "ASL-3"
      }
    ]
  }
}
```

**Capability levels:**

| Level | Description |
|-------|-------------|
| `none` | Indistinguishable from widely available models; no elevated domains |
| `low` | Above baseline but no threshold crossings requiring enhanced evaluation |
| `elevated` | Capability thresholds requiring enhanced evaluation and access controls; ~Anthropic ASL-2 |
| `frontier` | State-of-the-art with potential for serious harm at scale; ~Anthropic ASL-3+ |

**Capability domains:** `cyber`, `bio`, `chemical`, `nuclear-radiological`,
`autonomous-ai-rd`, `persuasion-manipulation`, `self-proliferation`,
`code-generation`, `reasoning`, `tool-use`, `multimodal`,
`long-horizon-planning`, `knowledge-synthesis`, `social-engineering`.

**Critical risk multiplier:** `access_mode: "agentic"` combined with
`capability_level: "elevated"` or `"frontier"` is a critical risk multiplier
regardless of other dimensions. This combination triggers the
`frontier-capability` profile.

### 3.10 `sources`

Each control carries a `sources[]` array. Sources are also deduplicated in the
top-level `references[]` array for cross-control queries.

Rich source objects include:

| Field | Description |
|-------|-------------|
| `id` | Stable source identifier (e.g., `nist_ai_rmf_1_0`) |
| `title` | Full document title |
| `authority` | Issuing organization |
| `source_type` | `binding-law`, `supervisory-guidance`, `voluntary-standard`, `certification-standard`, `industry-framework`, `threat-knowledge-base`, `academic-research`, `vendor-framework`, `apeiris-thesis` |
| `normative_force` | `binding-law`, `guidance`, `voluntary`, `informative` |
| `version` | Document version or edition |
| `published_on` | ISO 8601 publication date |
| `retrieved_on` | ISO 8601 retrieval date for freshness tracking |
| `artifact_hash` | `sha256:` prefixed hash when available |
| `canonical_url` | Authoritative source URL |
| `license` | License under which the source is published |
| `supersedes` | Superseded instruments (e.g., `"SR 11-7, SR 21-8"` for SR 26-2) |
| `status` | `current`, `deprecated`, `withdrawn`, `draft`, `final-review` |
| `flagship` | `true` for the primary normative source grounding the control |

### 3.11 `gaps`

Array of controls with partial or adjacent framework mappings, or where the
`uncovered_portion` documents what the mapped requirement covers beyond this
control's scope.

Use the gaps array to:
- Understand where additional controls or compensating controls are needed
- Identify framework requirements that are only partially satisfied
- Flag controls with `fit: "none"` (documented as "frontier assurance gap"
  where no MITRE ATLAS technique directly applies)

```jsonc
{
  "control_id": "LI-03",
  "control_name": "Supply Chain Integrity — Third-Party Model Verification",
  "layer": "LI",
  "gaps": [
    {
      "framework": "mitre",
      "requirement_id": "AML.T0018",
      "fit": "partial",
      "uncovered_portion": "AML.T0018 includes backdoor injection at training time or by a malicious publisher — LI-03 only detects post-signing substitution."
    }
  ]
}
```

### 3.12 `threat_scenarios`

Aggregated threat tag entries derived from all controls' `threat.tags` arrays.
Each entry shows how many controls address a given threat and provides excerpt
samples from control threat narratives.

Sorted by `control_count` descending — the highest-frequency threat tags
appear first. Use this to navigate from a threat concern to the controls that
address it.

### 3.13 `framework_coverage`

Per-framework coverage statistics across all 54 controls.

| Field | Description |
|-------|-------------|
| `framework` | Framework key |
| `display_name` | Human-readable framework name |
| `total_mappings` | Total mapping entries for this framework |
| `controls_mapped_count` | Distinct controls with at least one mapping |
| `coverage_pct` | `(controls_mapped / total_controls) * 100` |
| `by_fit` | Breakdown by fit: `{direct, partial, adjacent, supporting, none}` |
| `by_layer` | Mapping count per layer |
| `by_confidence` | Breakdown by confidence: `{verified, high, medium, low, speculative}` |
| `controls_mapped` | Array of control IDs with a mapping to this framework |

**Coverage note:** `coverage_pct` measures what fraction of controls have a
mapping to the framework — not what fraction of the framework's requirements
are satisfied. This is the correct interpretation: the matrix addresses a
control set; framework coverage is a navigation aid, not a compliance claim.

### 3.14 `regulatory_coverage`

Per-instrument obligation statistics. Each entry summarizes how many controls
carry obligations for a given regulatory instrument.

**Important:** The presence of an obligation in a control record indicates that
the control supports satisfaction of the obligation **under the stated
applicability conditions** — it does not imply universal applicability or
complete compliance.

### 3.15 `capability_coverage`

Coverage of controls by capability level (`none`, `low`, `elevated`, `frontier`)
and by individual capability domain. Use this to filter controls relevant to
a specific capability risk context.

The `_by_domain` entry enumerates controls relevant to each individual
capability domain (e.g., all controls relevant to `cyber` capability domains).

### 3.16 `lifecycle`

Ordered lifecycle stages mapping the model assurance lifecycle to the 6-layer
sequence. Each stage includes the layer code, name, plane, control count, and
the set of baseline controls required at that lifecycle stage.

---

## 4. Filtering and Querying

All filtering is done client-side against the static JSON. The dataset is small
enough to load entirely in memory (< 2 MB).

### 4.1 Filter by Profile

To find all controls required by a specific profile:

```javascript
// Load the dataset
const { dataset } = await fetch('...').then(r => r.json());

// Find all required controls for the eu-high-risk profile
const profile = dataset.profiles.find(p => p.profile_id === 'eu-high-risk');
const requiredIds = new Set([
  ...dataset.meta.baseline_controls,    // Always include baseline
  ...(profile?.required_controls ?? [])
]);

const requiredControls = dataset.controls.filter(c => requiredIds.has(c.id));
```

**Multi-profile intersection:** A deployment in multiple profiles should union
the required_controls from all active profiles and add the baseline.

```javascript
function getRequiredControls(dataset, activeProfileIds) {
  const ids = new Set(dataset.meta.baseline_controls);
  for (const profileId of activeProfileIds) {
    const profile = dataset.profiles.find(p => p.profile_id === profileId);
    for (const id of profile?.required_controls ?? []) {
      ids.add(id);
    }
  }
  return dataset.controls.filter(c => ids.has(c.id));
}
```

### 4.2 Filter by Layer

```javascript
const liControls = dataset.controls.filter(c => c.layer === 'LI');
```

Or using the `layers` summary:

```javascript
const liLayer = dataset.layers.find(l => l.code === 'LI');
const liControlIds = liLayer.controls;  // ["LI-01", "LI-02", ...]
```

### 4.3 Filter by Capability Tier

```javascript
// All controls applicable to frontier capability deployments
const frontierControls = dataset.controls.filter(c =>
  c.tiers?.includes('frontier-capability')
);

// Or via the capability_coverage summary
const frontierSummary = dataset.capability_coverage.find(
  c => c.capability_level === 'frontier'
);
// frontierSummary.controls = ["EV-03", "EV-04", ...]
```

### 4.4 Filter by Obligation Jurisdiction

```javascript
// All controls with EU AI Act obligations
const euControls = dataset.controls.filter(c =>
  c.obligations?.some(o =>
    o.source_ref === 'eu_ai_act' &&
    o.jurisdiction?.includes('eu')
  )
);

// All controls with binding obligations (not guidance)
const bindingControls = dataset.controls.filter(c =>
  c.obligations?.some(o => o.normative_force === 'binding-law')
);
```

**Effective date filtering** — exclude obligations not yet in force:

```javascript
const today = new Date('2026-06-26');
const inForceControls = dataset.controls.filter(c =>
  c.obligations?.some(o => {
    if (!o.effective_from) return true;
    return new Date(o.effective_from) <= today;
  })
);
```

### 4.5 Filter by Framework

```javascript
// Controls with a direct mapping to NIST AI RMF GOVERN functions
const governControls = dataset.controls.filter(c =>
  c.frameworks?.some(f =>
    f.framework === 'nist_rmf' &&
    f.requirement_id.startsWith('GOVERN') &&
    f.fit === 'direct'
  )
);

// Coverage of a specific EU AI Act requirement across all controls
const art11Controls = dataset.controls.filter(c =>
  c.frameworks?.some(f =>
    f.framework === 'eu_ai_act' && f.requirement_id === 'Art-11'
  )
);
```

### 4.6 The 15-Control Baseline

The baseline applies to every deployment regardless of profile.

```javascript
const baselineIds = new Set(dataset.meta.baseline_controls);
const baseline = dataset.controls.filter(c => baselineIds.has(c.id));
```

The 15 baseline controls are:

| Layer | Controls |
|-------|----------|
| LI | LI-01, LI-04, LI-06 |
| TG | TG-01, TG-05 |
| EV | EV-01, EV-06, EV-07, EV-09 |
| OA | OA-01, OA-07 |
| BH | BH-03, BH-05 |
| CR | CR-01, CR-02 |

---

## 5. Cross-Domain Navigation via Namespace Registry

The Apeiris namespace registry (`apeiris-control-core/namespace-registry.json`)
defines the `apeiris://` URI scheme used in `cross_domain.references[]` across
all Apeiris domains.

**URI format:** `apeiris://<domain>/controls/<LAYER>-<NN>`

**Examples:**

```
apeiris://model/controls/LI-01      → modelverifier.ai, control LI-01
apeiris://security/controls/IA-02   → securitycontrols.ai, control IA-02
apeiris://model/layers/LI           → modelverifier.ai, LI layer
apeiris://model/profiles/eu-high-risk
apeiris://model/frameworks/nist_rmf
```

**Resolving a cross-domain reference:**

```javascript
function resolveApeiriUri(uri, registry) {
  // uri: "apeiris://security/controls/IA-02"
  const match = uri.match(/^apeiris:\/\/([^\/]+)\/controls\/([A-Z]+-\d+)$/);
  if (!match) return null;
  const [, domain, controlId] = match;
  const domainEntry = registry.domains?.[domain];
  if (!domainEntry) return null;
  return {
    corpus_url: domainEntry.corpus_base,
    control_id: controlId,
    site: domainEntry.site,
    fetch_hint: `${domainEntry.corpus_base}${domain}-controls-full.json`,
  };
}
```

**Cross-domain references in model controls:**

Each control's `cross_domain.references[]` array lists navigation pointers to
related controls in other Apeiris domains. Current relationships include:

- Model controls referencing `apeiris://security/controls/*` for access
  control, runtime enforcement, and artifact integrity controls owned by
  securitycontrols.ai.
- Evidence artifacts declared by model controls that securitycontrols.ai
  verifiers are authorized to consume (e.g., `model:registry-entry`,
  `model:evaluation-scorecard`).

**Cross-domain evidence pattern:**

The `cross_domain.evidence_artifacts[]` array declares evidence artifacts this
control produces that other domain verifiers can consume without repeating the
test. Each artifact specifies:

| Field | Description |
|-------|-------------|
| `artifact_type` | Canonical artifact type (e.g., `model:evaluation-scorecard`) |
| `producer_verifier` | `apeiris://model-assurance` — the producing verifier |
| `consumer_verifiers` | Other verifiers authorized to rely on this artifact |
| `schema_ref` | JSON Schema URI for the artifact's structure |
| `retention` | Required retention period (ISO 8601 duration, e.g., `P7Y`) |

---

## 6. Verifying the Release Manifest

Each release of `model-controls-full.json` includes a `content_hash` in
`dataset.meta` and a corresponding entry in `release-manifest.json`.

### Fetching the manifest

```
GET https://modelverifier.ai/integration/release-manifest.json
```

### Verifying the content hash

```javascript
import { createHash } from 'node:crypto';

// 1. Fetch and parse the dataset
const resp = await fetch('https://modelverifier.ai/integration/model-controls-full.json');
const bodyText = await resp.text();
const dataset = JSON.parse(bodyText);

// 2. Extract the stored hash
const storedHash = dataset.dataset.meta.content_hash;

// 3. Recompute: temporarily null out the hash field, re-serialize, hash
const datasetCopy = JSON.parse(bodyText);
datasetCopy.dataset.meta.content_hash = null;
const recomputed = 'sha256:' + createHash('sha256')
  .update(JSON.stringify(datasetCopy, null, 2))
  .digest('hex');

// Note: The hash is computed over the JSON body with content_hash set to
// the hash value itself (two-pass). This is intentional — the manifest
// is the ground truth for verification. Compare against the manifest.
```

**Recommended verification flow:**

1. Fetch `release-manifest.json` from the canonical URL.
2. Compare the `artifacts[0].content_hash` in the manifest against the
   `dataset.meta.content_hash` in the dataset JSON.
3. For signed production releases, verify the detached signature at
   `release-manifest.json.sig` against the Apeiris release public key at
   `https://modelverifier.ai/.well-known/apeiris-release.pub`.

---

## 7. Stable Join Keys Across Apeiris Domains

The following keys are stable across Apeiris domains and releases, enabling
joins between the model assurance matrix and other Apeiris datasets.

| Key | Location | Description |
|-----|----------|-------------|
| `control.id` | Every control record | Stable control identifier (`LI-01`, etc.). Never reused. |
| `source.id` | `sources[]`, `references[]` | Stable source identifier (e.g., `nist_ai_rmf_1_0`). |
| `framework` key | `frameworks[]` mapping objects | One of 10 canonical framework keys shared across domains. |
| `apeiris://` URI | `cross_domain.references[].uri` | Decentralized namespace URI resolvable via namespace-registry.json. |
| `artifact_type` | `cross_domain.evidence_artifacts[].artifact_type` | Canonical evidence artifact type (e.g., `model:registry-entry`). |
| `profile_id` | `profiles[]` | Canonical profile identifier shared across integrators. |
| `obligation.instrument` | `obligations[]` | Full regulatory instrument name (join on this for cross-control obligation queries). |

**Joining model controls with security controls:**

```javascript
// model-controls-full.json: controls with cross_domain references to security domain
const modelWithSecRefs = modelDataset.controls.filter(c =>
  c.cross_domain?.references?.some(r => r.uri.startsWith('apeiris://security/'))
);

// For each model control, find the referenced security control IDs
const crossRefs = modelWithSecRefs.flatMap(c =>
  (c.cross_domain?.references ?? [])
    .filter(r => r.uri.startsWith('apeiris://security/'))
    .map(r => ({
      model_control: c.id,
      security_control: r.uri.split('/').pop(),
      relationship: r.relationship,
    }))
);
```

---

## 8. Versioning Policy and Changelog

### Semantic Versioning

`model-controls-full.json` uses Semantic Versioning (`dataset.meta.version`).

| Change type | Version bump | Description |
|-------------|-------------|-------------|
| Patch (`x.x.N`) | No breaking changes | Corrected mapping rationale, updated source retrieved_on dates, fixed typos, added missing fields |
| Minor (`x.N.0`) | New fields or controls added | Additional controls in any layer, new optional top-level fields in the dataset, new profile-specific notes |
| Major (`N.0.0`) | Breaking changes | Field renames, schema changes that break existing parsers, removal of fields |

**Stability guarantees for stable fields:**

- `control.id` values are **permanent** — never renamed or reused across any version.
- `layer` codes (`LI`, `TG`, `EV`, `OA`, `BH`, `CR`) are permanent.
- `profile_id` values are permanent once published.
- `framework` keys are permanent once published.
- `meta.baseline_controls` list is stable across minor versions; additions
  require a major version bump.

### Changelog Policy

Every release increments `meta.generated_at`. Material changes to control
content (new evidence requirements, updated mapping rationale, corrected legal
status) are documented in the affected control's `meta.changelog[]` array.

**Consuming new versions safely:**

```javascript
// Cache the version you have loaded
const loadedVersion = dataset.meta.version;
// Check periodically (e.g., daily)
const freshMeta = await fetch('https://modelverifier.ai/integration/release-manifest.json')
  .then(r => r.json());
if (freshMeta.dataset_version !== loadedVersion) {
  // Reload dataset
}
```

---

## 9. License Terms

### Dataset License

`model-controls-full.json` and all content in the `integration/` directory are
published under **Creative Commons Attribution-NonCommercial 4.0 International
(CC BY-NC 4.0)**.

- You may copy, adapt, and share this data for non-commercial purposes.
- You must give appropriate credit to Apeiris (modelverifier.ai).
- Commercial use requires a separate license from Apeiris.
- Full license: https://creativecommons.org/licenses/by-nc/4.0/

**Attribution requirement:**

When using this dataset, include:

```
AI Model & System Assurance Control Matrix — modelverifier.ai
© Apeiris. Licensed under CC BY-NC 4.0.
https://modelverifier.ai/integration/model-controls-full.json
```

### OWASP AISVS Compatibility Note

OWASP AI Security Verification Standard v1.0 is published under
**CC BY-SA 4.0 (ShareAlike)**. Because this dataset is published under
CC BY-NC 4.0 (incompatible with the ShareAlike requirement for derivative
works), the following practice is strictly observed:

- AISVS requirement identifiers (e.g., `C1.1`, `C5.3`) are used as **locators
  only** — navigation pointers to the AISVS source document.
- AISVS requirement text is **never reproduced verbatim** in this dataset.
- All mapping rationale text is independently authored by Apeiris editors.
- Mapping `direction: "bidirectional"` to AISVS requirements means the control
  satisfies an AISVS requirement, independently described — not that AISVS
  text is incorporated.

Consumers who need the AISVS requirement text should obtain it directly from:
https://github.com/OWASP/www-project-ai-security-verification-standard

### MITRE ATLAS License

MITRE ATLAS is published under **Apache 2.0**. Technique IDs (e.g.,
`AML.T0051`) and names are used as threat references. No ATLAS technique
description text is reproduced verbatim in this dataset.

### Other Sources

- NIST AI RMF: Public domain (US Government)
- EU AI Act: EU public sector information license
- SR 26-2, OCC 2026-13: US Government public domain
- OWASP LLM Top 10 2025: CC BY-SA 4.0 (requirement IDs used as locators only)
- CSA AICM v1.1: CC BY-SA 4.0 (requirement IDs used as locators only)
- ISO/IEC 42001:2023: Proprietary paid — not reproduced; cited by ID only

---

*This guide covers `model-controls-full.json` schema version 1.0.0.*
*For the short-form developer reference, see [README.md](./README.md).*
