# model-controls-full.json — Developer Reference

**AI Model & System Assurance Control Matrix** | modelverifier.ai

54 AI model assurance controls across 6 layers.
Mappings to 8 frameworks. 11 deployment profiles. 15-control baseline.

---

## Quick Start

```bash
# Fetch
curl https://modelverifier.ai/integration/model-controls-full.json | jq '.dataset.meta'
```

```javascript
const { dataset } = await fetch(
  'https://modelverifier.ai/integration/model-controls-full.json'
).then(r => r.json());

dataset.meta.control_count    // 54
dataset.meta.version          // "1.0.0"
dataset.controls.length       // 54
dataset.profiles.length       // 8
```

**CORS:** enabled — fetch from any origin, no API key required.

---

## Endpoint

| URL | Description |
|-----|-------------|
| `https://modelverifier.ai/integration/model-controls-full.json` | Full dataset |
| `https://modelverifier.ai/integration/release-manifest.json` | Release manifest with content hash |

---

## Dataset Shape

```
dataset.meta                  Build metadata, version, hash, counts
dataset.controls[]            54 control records (sorted LI→CR, then by number)
dataset.references[]          Deduplicated source documents cited by controls
dataset.layers[]              6 layer definitions with control lists
dataset.planes[]              4 assurance plane definitions
dataset.gaps[]                Controls with partial/adjacent framework mappings
dataset.profiles[]            11 deployment profiles with trigger conditions
dataset.patterns[]            Implementation pattern summaries per control
dataset.threat_scenarios[]    Aggregated threat tags across all controls
dataset.framework_coverage[]  Per-framework mapping statistics
dataset.regulatory_coverage[] Per-instrument obligation statistics
dataset.capability_coverage[] Controls indexed by capability level / domain
dataset.lifecycle[]           Ordered 6-stage model assurance lifecycle
```

---

## Controls

Each control has a stable `id` (`LI-01` through `CR-08`), never reused.

### Key fields

| Field | Description |
|-------|-------------|
| `id` | `LI-01` … `CR-08` — stable, permanent |
| `layer` | `LI` `TG` `EV` `OA` `BH` `CR` |
| `plane` | `control` `data` `both` `lifecycle` |
| `name` | Short title (≤ 80 chars) |
| `plain` | One-sentence plain-language summary |
| `threat.tags[]` | Machine-indexable threat tags |
| `tiers[]` | Profile IDs this control applies to |
| `frameworks[]` | Framework mapping objects (8 frameworks, 7 status fields each) |
| `obligations[]` | Executable regulatory obligation objects |
| `monitoring_schema` | Structured metric definitions (BH/CR layers) |
| `capability_risk` | Multidimensional capability risk object |
| `lenses` | 5 stakeholder views: `engineering` `evaluation` `red_team` `grc` `mlops` |

### Layers

| Layer | Name | Plane | Controls |
|-------|------|-------|----------|
| `LI` | AI Asset, Lineage & Applicability | control | 10 |
| `TG` | Training & Data Governance | data | 8 |
| `EV` | Evaluation, Independent Validation & Release | both | 10 |
| `OA` | Governance, Accountability & Use-Case Oversight | control | 8 |
| `BH` | Deployment & Runtime Assurance | data | 10 |
| `CR` | Continuous Risk, Incident & Evidence Assurance | lifecycle | 8 |

### 15-Control Baseline

These controls apply to every deployment regardless of profile:

```
LI-01  LI-04  LI-06     (Asset lineage)
TG-01  TG-05             (Data governance)
EV-01  EV-06  EV-07  EV-09  (Evaluation)
OA-01  OA-07             (Governance)
BH-03  BH-05             (Runtime)
CR-01  CR-02             (Continuous assurance)
```

---

## Profiles

10 deployment profiles with machine-evaluable `trigger_conditions` against
the `assurance_target`. Profiles are additive to the baseline.

| Profile ID | Trigger |
|------------|---------|
| `general-predictive-ml` | Supervised/unsupervised ML, no elevated capability |
| `generative-ai` | Generative paradigm or text/image/code output modalities |
| `multimodal` | Non-text input modalities (image, audio, video, document); cross-modal attack surface |
| `hosted-api` | Third-party API access or open-weight provider |
| `continuously-learning` | RLHF, online-learning, continual-learning |
| `high-impact-decision` | Credit, hiring, healthcare, judicial, etc. |
| `us-regulated-banking` | US supervised financial institution, SR 26-2 scope |
| `eu-high-risk` | EU AI Act Annex III / product-embedded classification |
| `gpai-provider` | GPAI model provider (EU AI Act Ch. V, Art. 51–55); effective 2025-08-02 |
| `gpai-systemic-risk` | GPAI model with systemic risk (EU AI Act Ch. VI); ≥10²⁵ FLOPs or AI Office designation |
| `frontier-capability` | `capability_level: "frontier"` or dangerous domains |

```javascript
// Get all required controls for a profile + baseline
function required(dataset, profileId) {
  const profile = dataset.profiles.find(p => p.profile_id === profileId);
  const ids = new Set([
    ...dataset.meta.baseline_controls,
    ...(profile?.required_controls ?? []),
  ]);
  return dataset.controls.filter(c => ids.has(c.id));
}
```

---

## Frameworks

8 frameworks with per-control mapping objects carrying 7 split status fields.

| Key | Framework |
|-----|-----------|
| `nist_rmf` | NIST AI Risk Management Framework 1.0 |
| `iso_42001` | ISO/IEC 42001:2023 AI Management Systems |
| `eu_ai_act` | EU AI Act (Regulation 2024/1689) |
| `sr262` | SR 26-2 — Supervisory Guidance on Model Risk Management |
| `aisvs` | OWASP AI Security Verification Standard v1.0 |
| `llm10` | OWASP LLM Top 10 2025 |
| `aicm` | CSA AI Controls Matrix v1.1 (247 objectives, 18 domains; released 2026-06-22) |
| `mitre` | MITRE ATLAS v5.6.0 |

**SR 26-2 / OCC 2026-13 reminder:** Supervisory guidance only — not binding
law. All mappings carry `legal_status: "guidance"`.

**EU AI Act timing:** Standalone high-risk Annex III enforcement from
2027-12-02; product-embedded from 2028-08-02. Parliament-approved; Council
adoption pending as of 2026-06-26.

```javascript
// Controls with direct EU AI Act Art-14 mapping
dataset.controls.filter(c =>
  c.frameworks?.some(f =>
    f.framework === 'eu_ai_act' &&
    f.requirement_id === 'Art-14' &&
    f.fit === 'direct'
  )
);
```

---

## Cross-Domain Links (`apeiris://` URIs)

Controls reference related controls in other Apeiris domains via the
`cross_domain.references[]` array using stable `apeiris://` URIs:

```
apeiris://model/controls/LI-01        → this domain
apeiris://security/controls/IA-02     → securitycontrols.ai
```

Resolve URIs offline using `apeiris-control-core/namespace-registry.json`.

---

## Capability Risk

Every control carries `capability_risk.capability_level`:

| Level | Meaning |
|-------|---------|
| `none` | No elevated capability |
| `low` | Above baseline, no threshold crossing |
| `elevated` | Enhanced evaluation required; ~Anthropic ASL-2 |
| `frontier` | Potential for serious harm at scale; ~Anthropic ASL-3+ |

```javascript
// Controls relevant to frontier deployments
dataset.controls.filter(c => c.tiers?.includes('frontier-capability'));
```

---

## Release Manifest Verification

```javascript
const manifest = await fetch(
  'https://modelverifier.ai/integration/release-manifest.json'
).then(r => r.json());

// Compare stored hash against dataset.meta.content_hash
console.log(manifest.artifacts[0].content_hash);
```

See [INTEGRATION-GUIDE.md §6](./INTEGRATION-GUIDE.md#6-verifying-the-release-manifest)
for the full verification procedure.

---

## License

**CC BY-NC 4.0** — non-commercial use, attribution required.

AISVS content (CC BY-SA 4.0): requirement IDs used as locators only;
requirement text paraphrased, never reproduced verbatim. See
[INTEGRATION-GUIDE.md §9](./INTEGRATION-GUIDE.md#9-license-terms).

---

## Full Documentation

**[INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md)** — complete data model
reference, filtering recipes, cross-domain navigation, versioning policy,
and license terms.
