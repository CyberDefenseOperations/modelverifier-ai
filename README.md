# modelverifier.ai — AI Model & System Assurance Control Matrix

**Version:** 1.0.0 | **Status:** Public Beta | **Controls:** 54 across 6 layers | **Frameworks:** 10 | **Profiles:** 11 | **Build:** 0 warnings

The AI Model & System Assurance Control Matrix is the second Apeiris public knowledge domain, complementing [securitycontrols.ai](https://securitycontrols.ai). It provides a machine-readable, citation-backed corpus of controls for assessing, evaluating, and governing AI models and AI systems across their full lifecycle — from lineage and training data governance through deployment, runtime assurance, and continuous evidence collection.

This matrix feeds the **Model Assurance Verifier** in the Apeiris runtime. The same verifier schema used to evaluate security controls at securitycontrols.ai is domain-parameterized here for model risk management, independent validation, and frontier capability assurance.

---

## What This Matrix Is

modelverifier.ai is a structured, citable, machine-consumable corpus of AI model assurance controls. Each of the 54 controls is:

- **Citation-backed.** Every control traces to at least one verifiable source: NIST AI RMF, NIST AI 600-1, ISO/IEC 42001, EU AI Act, SR 26-2, OWASP AISVS v1.0, OWASP LLM Top 10 2025, CSA AICM v1.1, or MITRE ATLAS v5.6.0. No control may exist without a supporting source or an explicit `apeiris-thesis` source type.
- **Multi-lens.** Each control includes five stakeholder views: engineering (ML engineers, platform engineers), evaluation (independent validators), red_team (adversarial testers), grc (governance, risk, compliance officers), and mlops (ML operations engineers).
- **Profile-aware.** Controls are tagged to one or more of the 11 deployment profiles. The baseline 15-control set applies to every deployment regardless of profile.
- **Obligation-linked.** Controls with EU AI Act or SR 26-2 mappings carry structured `obligations[]` objects with machine-evaluable applicability predicates — the Apeiris runtime evaluates these against your `assurance_target` without requiring legal re-interpretation.
- **Integration-ready.** The `/integration/` endpoint serves all 54 controls as CORS-enabled JSON. Any runtime, CI pipeline, or GRC tool can consume the matrix without installation.

This is not a compliance checklist. It is a structured knowledge corpus for the Apeiris Model Assurance Verifier.

---

## Using the Web Interface

The matrix at [modelverifier.ai](https://modelverifier.ai) is a zero-dependency static web application. No account, no installation, no data leaves your browser.

### Dark / Light Mode

Click **◑ Dark** in the header to toggle light mode. The preference is persisted in `localStorage`.

### Filtering and Search

- **Profile** — filter to controls required by a specific deployment profile (e.g. `eu-high-risk`, `frontier-capability`)
- **Framework** — show only controls mapped to a specific standard (NIST AI RMF, NIST AI 600-1, ISO 42001, EU AI Act, SR 26-2, AISVS, LLM Top 10, AICM, MITRE ATLAS, OWASP AI Testing Guide)
- **Layer** — jump to a specific layer (LI, TG, EV, OA, BH, CR)
- **Search** — full-text search across control names, descriptions, and framework IDs

Click any control card to open the detail drawer with full implementation guidance, framework mappings, obligation tables, and stakeholder lenses.

### Self-Assessment Mode

Click **✓ Assess** in the header to enter assessment mode. Every control card shows a maturity dropdown:

| Level | Description |
|---|---|
| `none` | Not started |
| `initial` | Ad-hoc, reactive |
| `developing` | Documented intent; inconsistent execution |
| `defined` | Consistent, documented process |
| `managed` | Measured; metrics tracked |
| `optimizing` | Continuously improving; automated |

As you rate controls, the progress bar at the top shows how many of 54 controls are rated, your weighted maturity score (0.0–5.0), and how many controls are at or above their target maturity level.

Click **⊞ Summary** to open the full assessment dashboard with per-layer breakdown, maturity distribution, priority gap list, and multi-format export. Assessment data is stored in `localStorage` only — never transmitted. Use **⛓ Share** to generate a URL encoding your assessment state in the URL hash fragment.

---

## Documentation

| Document | Purpose |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the system works: file layout, data flow, UI architecture, build pipeline, deployment |
| [SECURITY.md](SECURITY.md) | Security posture, vulnerability reporting, data privacy policy |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to add or update controls, sources, and framework mappings |
| [docs/TEMPLATE-GUIDE.md](docs/TEMPLATE-GUIDE.md) | How to create a new Apeiris verifier domain using this codebase as a template |

---

## Relationship to securitycontrols.ai and the Apeiris Platform

**securitycontrols.ai** covers the security domain: identity and authority, environment and containment, inter-agent tool protocols, agentic runtime governance, runtime supervision, and continuous security assurance. Its controls address the question: "Is this AI agent authorized to take this action and can it be proven?"

**modelverifier.ai** covers the model assurance domain: AI asset lineage, training data governance, evaluation and independent validation, use-case governance, deployment runtime behavior, and continuous risk assurance. Its controls address the question: "Is this model fit for this use, and can that fitness be proven?"

Both domains share the `apeiris-control-core/` schema package — the same base control shape, source schema, mapping schema, evidence pattern, and namespace registry. The domains extend the shared core for their specific vocabularies.

**Cross-domain evidence:** When a model assurance control produces an evidence artifact (e.g., a model evaluation scorecard), that artifact can be declared as consumable by the security verifier. The `cross_domain.evidence_artifacts[]` block on each control record declares these sharing relationships. This is the mechanism by which the Apeiris platform avoids duplicate evidence collection across domains.

**The Apeiris runtime:** Both matrices feed a single runtime engine. The runtime is domain-parameterized — point it at the model assurance corpus and it becomes the Model Assurance Verifier; point it at the security corpus and it becomes the Security Verifier. This architecture enables an enterprise to run both verifiers on the same agent deployment from the same evidence infrastructure.

**Apeiris domain portfolio:** The confirmed set of Apeiris-owned domains:

- **apeiris.com / apeiris.ai** — Platform brand and runtime
- **securitycontrols.ai** — Agentic Security Control Matrix
- **modelverifier.ai** — AI Model & System Assurance Control Matrix (this domain)
- **complianceverifier.ai**, **privacyverifier.ai**, **identitycontrols.ai**, **agenticverifier.ai** — Planned future verifier domains

All domains share the `apeiris-control-core/` schema package and the `apeiris://` cross-domain URI namespace.

---

## Layer Structure

The matrix organizes 54 controls across 6 layers, each assigned to a runtime plane.

### LI — AI Asset, Lineage & Applicability (10 controls | plane: control)

Establishes the identity, provenance, and deployment scope of every model artifact. Controls cover:

- Unique model identity and content-addressed version hash (LI-01)
- Model provenance chain: base model, fine-tune, merge, and adapter lineage (LI-02)
- Supply chain integrity: third-party model verification and cryptographic model SBOMs (LI-03)
- Structured model documentation: complete model card with all required sections (LI-04)
- Training data lineage pointer from model registry to TG-layer dataset record (LI-05)
- Artifact immutability and rollback capability (LI-06)
- Model system-prompt and RAG corpus versioning (LI-07)
- License and IP obligation registry (LI-08)
- Composite system identity: model + system prompt + RAG + tool integrations (LI-09)
- Use-case applicability boundary documentation (LI-10)

### TG — Training & Data Governance (8 controls | plane: data)

Governs the data used to train, evaluate, and fine-tune models. Controls cover:

- Training data source authorization and consent governance (TG-01)
- Dataset versioning and immutable snapshot management (TG-02)
- Sensitive and protected attribute data handling (TG-03)
- Training data poisoning detection and integrity verification (TG-04)
- Benchmark contamination and evaluation data separation (TG-05)
- Controlled use of protected attributes for bias testing and fairness evaluation (TG-06)
- Frontier model training data governance for dangerous-capability domains (TG-07)
- Synthetic data provenance and use governance (TG-08)

### EV — Evaluation, Independent Validation & Release (10 controls | plane: both)

Establishes evaluation and validation requirements before model deployment and after material changes. Controls cover:

- Pre-release evaluation gate: fitness, safety, and performance criteria (EV-01)
- Generative model quality and safety evaluation (EV-02)
- Dangerous capability assessment for frontier and elevated-capability models (EV-03)
- Adversarial red-team testing for policy bypass and harmful output elicitation (EV-04)
- Fairness and demographic performance evaluation (EV-05)
- Independent validation: organizational independence and scope requirements (EV-06)
- Evaluation reproducibility and benchmark integrity (EV-07)
- SR 26-2 independent model validation for supervised financial institutions (EV-08)
- Use-case risk assessment and impact analysis (EV-09)
- Post-deployment evaluation cadence and re-validation triggers (EV-10)

### OA — Governance, Accountability & Use-Case Oversight (8 controls | plane: control)

Establishes governance structures, accountability chains, and human oversight for model deployments. Controls cover:

- AI model risk policy and governance framework (OA-01)
- Human oversight adequacy evaluation: meaningful, not nominal (OA-02)
- AI governance committee and model risk oversight (OA-03)
- Autonomy scope and agentic authority boundary governance (OA-04)
- Model risk appetite and tolerance threshold documentation (OA-05)
- Third-party and vendor model governance (OA-06)
- Affected party notice, explanation, and contestability (OA-07)
- Incident escalation paths and model suspension authority (OA-08)

### BH — Deployment & Runtime Assurance (10 controls | plane: data)

Governs model behavior in production, including monitoring, anomaly detection, and runtime guardrails. Controls cover:

- Output Anomaly Detection (BH-01)
- Concept and Data Drift Detection (BH-02)
- Production Performance Degradation Alerting (BH-03)
- Behavioral Boundary Enforcement (BH-04)
- Usage and Decision Logging (BH-05)
- Injection-Resistance Monitoring (BH-06)
- Resource and Cost Anomaly Detection (BH-07)
- Canary Deployment Governance (BH-08)
- Synthetic Content Provenance (BH-09)
- Feedback Loop Integrity (BH-10)

### CR — Continuous Risk, Incident & Evidence Assurance (8 controls | plane: lifecycle)

Provides ongoing risk assurance, incident response, and evidence collection across the model lifecycle. Controls cover:

- Continuous Production Monitoring and Risk Aggregation (CR-01)
- Model Evidence Archive and Audit Trail (CR-02)
- Model Re-evaluation Scheduling and Triggers (CR-03)
- Incident Response Management (CR-04)
- Outcomes and Disparate Impact Analysis (CR-05)
- Regulatory Notification and Market Surveillance Reporting (CR-06)
- Model Retirement and Decommissioning (CR-07)
- Cross-Domain Compliance Evidence (CR-08)

---

## The 11 Deployment Profiles

Profiles allow the 54-control matrix to be filtered to the controls that apply to a specific deployment context. A deployment may belong to multiple profiles simultaneously. The 15-control baseline applies to all deployments regardless of profile.

Profile membership is determined by evaluating `trigger_conditions` against the `assurance_target` object. All condition evaluation is machine-executable — the Apeiris runtime does this automatically.

| Profile | Trigger Summary | Additional Required Controls Beyond Baseline |
|---|---|---|
| **general-predictive-ml** | Supervised, unsupervised, time-series, or tabular models with no elevated capability | LI-01, LI-04, TG-01, EV-01, OA-01, CR-01 |
| **generative-ai** | Any model with generative output modalities (text, image, audio, video, code) | LI-01, LI-04, LI-06, TG-01, TG-05, EV-01, EV-02, EV-06, EV-07, OA-01, BH-03, BH-05, BH-09 |
| **hosted-api** | Model accessed via external API; provider_type is third-party or open-weight | LI-01, LI-04, LI-06, BH-03, BH-05, BH-10, CR-01, OA-01 |
| **continuously-learning** | Training regime includes online-learning, RLHF, continual-learning, or adaptive fine-tuning | TG-01, TG-04, TG-05, EV-01, EV-06, EV-07, CR-01, CR-02, CR-03, BH-05, BH-08 |
| **high-impact-decision** | Decisions affecting credit, hiring, healthcare, benefits, housing, law enforcement, or judicial outcomes | LI-01, LI-04, LI-06, EV-01, EV-05, EV-06, EV-09, OA-01, OA-02, OA-07, OA-08, CR-01, CR-02 |
| **us-regulated-banking** | US supervised banking institution (SR 26-2 scope; heightened for $30B+ assets); banking only — SR 26-2 does not apply to GenAI or agentic AI systems | LI-01, LI-04, LI-05, TG-01, EV-01, EV-06, EV-08, EV-09, OA-01, OA-03, CR-01, CR-02 |
| **eu-high-risk** | EU AI Act Annex III system or product-embedded high-risk system in EU jurisdiction | LI-01, LI-04, LI-06, LI-07, TG-01, TG-03, TG-06, EV-01, EV-05, EV-06, EV-09, OA-01, OA-02, OA-07, OA-08, BH-05, CR-01, CR-02 |
| **frontier-capability** | capability_level: frontier, or dangerous capability domains detected in EV-03 | Full set — 24 required controls; all 54 recommended |

The table above shows 8 of the 11 deployment profiles. Profile trigger conditions are defined in `schema/profiles.json` as machine-executable JSON predicates. See that file for the full set of 11 profiles, their trigger logic, and `required_controls` / `recommended_controls` lists.

---

## The 15-Control Baseline

Every deployment, regardless of profile, must implement these 15 controls. The baseline is the minimum viable assurance set covering at least one control from each of the 6 layers.

| ID | Layer | Name |
|---|---|---|
| LI-01 | LI | Unique Model Identity and Content-Addressed Version Hash |
| LI-04 | LI | Structured Model Documentation — Complete Model Card |
| LI-06 | LI | Artifact Immutability and Rollback Capability |
| TG-01 | TG | Training Data Source Authorization and Consent Governance |
| TG-05 | TG | Benchmark Contamination and Evaluation Data Separation |
| EV-01 | EV | Pre-Release Evaluation Gate |
| EV-06 | EV | Independent Validation: Organizational Independence and Scope |
| EV-07 | EV | Evaluation Reproducibility and Benchmark Integrity |
| EV-09 | EV | Use-Case Risk Assessment and Impact Analysis |
| OA-01 | OA | AI Model Risk Policy and Governance Framework |
| OA-07 | OA | Affected Party Notice, Explanation, and Contestability |
| BH-03 | BH | Production Performance Degradation Alerting |
| BH-05 | BH | Usage and Decision Logging |
| CR-01 | CR | Continuous Production Monitoring and Risk Aggregation |
| CR-02 | CR | Model Evidence Archive and Audit Trail |

The 15-control baseline is validated by the `validate:baselines` build step, which enforces that all baseline controls are present and have `readiness: approved` before the integration bundle is published.

---

## Using the Integration JSON

The `/integration/` endpoint provides the full matrix as machine-readable JSON with CORS enabled. No API key, no SDK, no installation required.

### Endpoints

```
GET https://modelverifier.ai/integration/controls.json
GET https://modelverifier.ai/integration/controls.min.json
GET https://modelverifier.ai/integration/baseline.json
GET https://modelverifier.ai/integration/profiles.json
GET https://modelverifier.ai/integration/framework-index.json
```

### Example: Fetch all controls

```javascript
const res = await fetch('https://modelverifier.ai/integration/controls.json');
const matrix = await res.json();
// matrix.controls — array of 54 ModelControl objects
// matrix.meta.version — semver string
// matrix.meta.generated_at — ISO 8601 timestamp
```

### Example: Fetch the baseline subset

```javascript
const res = await fetch('https://modelverifier.ai/integration/baseline.json');
const baseline = await res.json();
// baseline.controls — array of 15 ModelControl objects
// baseline.profile_ids — always ["baseline"]
```

### Example: Filter controls by profile

```javascript
const res = await fetch('https://modelverifier.ai/integration/controls.json');
const { controls } = await res.json();

const euHighRisk = controls.filter(c =>
  c.tiers.includes('eu-high-risk')
);
```

### Example: Evaluate profile membership in code

```javascript
// Use the trigger_conditions from profiles.json to filter controls
// for a specific assurance_target
import { evaluateProfile } from './build-integration.mjs';

const target = {
  model_paradigm: 'generative',
  eu_ai_act_classification: 'high-risk-annex-iii',
  jurisdiction: ['eu'],
};

const activeProfiles = profiles.filter(p => evaluateProfile(p, target));
```

### `_headers` — CORS configuration

The `integration/_headers` file configures Cloudflare Pages to serve the integration endpoint with permissive CORS headers:

```
/integration/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
  Content-Type: application/json
```

### Manifest signing and integrity verification

Every integration bundle ships with a release manifest and an Ed25519 digital signature:

```
GET https://modelverifier.ai/integration/release-manifest.json
GET https://modelverifier.ai/integration/release-manifest.sig
```

The signature is produced using the `MODEL_VERIFIER_SIGNING_KEY` CI secret (an Ed25519 private key that exists only as a GitHub Actions secret and is never committed to the repository). The corresponding public key is published at:

```
GET https://modelverifier.ai/.well-known/apeiris-release.pub
```

Verify the signature with any Ed25519-capable tool:

```bash
# Using OpenSSL (Ed25519 support requires OpenSSL 1.1.1 or later)
openssl pkeyutl -verify -pubin -inkey apeiris-release.pub \
  -sigfile release-manifest.sig -in release-manifest.json
```

### Dataset content hash

`model-controls-full.json` includes `dataset.meta.content_hash` — a SHA-256 hash of the dataset. The hash is **non-self-referential**: it is computed over the serialized JSON with the `content_hash` field itself excluded. To verify independently:

```javascript
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const raw = readFileSync('model-controls-full.json', 'utf8');
const parsed = JSON.parse(raw);
const storedHash = parsed.dataset.meta.content_hash;

// Strip the hash field before re-hashing
delete parsed.dataset.meta.content_hash;
const recomputed = createHash('sha256')
  .update(JSON.stringify(parsed, null, 2))
  .digest('hex');

console.log(recomputed === storedHash); // true if the file is unmodified
```

### Evidence claim graph

The integration endpoint also includes the schema and examples for the Apeiris evidence claim graph, enabling structured machine-readable evidence declarations linked to specific controls:

```
GET https://modelverifier.ai/integration/claim.schema.json
GET https://modelverifier.ai/integration/model-claims-example.json
```

`claim.schema.json` defines the schema for a structured claim object that links an evidence artifact to one or more control IDs with a confidence assertion. `model-claims-example.json` provides annotated worked examples of valid claim objects across all six layers. Use these when building tools that produce or consume evidence against the matrix.

---

## Schema Differences from securitycontrols.ai

modelverifier.ai introduces the following schema extensions beyond the shared `apeiris-control-core/` vocabulary:

| Feature | securitycontrols.ai | modelverifier.ai |
|---|---|---|
| **Lenses** | engineering, detection, secops, grc, architect | engineering, evaluation, red_team, grc, mlops |
| **Framework set** | nist_rmf, iso_42001, eu_ai_act, aisvs, llm10, aicm, mitre, imda_mgf, aws_agentic | nist_rmf, nist_ai_600_1, iso_42001, eu_ai_act, sr262, aisvs, llm10, aicm, mitre, owasp_aitg |
| **Obligation model** | Not used | `obligations[]` array with `applicability` predicates; replaces `regulatory_scope` string |
| **Capability classification** | `capability_tier` string | `capability_risk` object (capability_level, capability_domains, access_mode, autonomy, irreversibility, deployment_scale, affected_party_impact) |
| **Monitoring spec** | `detection_schema` (log-centric) | `monitoring_schema` with structured `metric_object[]`, `sampling_rate`, `window_context` |
| **Status fields** | Single `status` field | 7 split status fields per mapping: source_status, mapping_confidence, legal_status, control_readiness, implementation_maturity, assurance_result, evidence_status |
| **Source objects** | Basic source references | Rich source objects with authority, source_type, artifact_hash, license, supersedes |
| **Mapping objects** | Direction + rationale | Direction, rationale, uncovered_portion, source_locator, source_version, source_hash, plus 7 split status fields |
| **Profiles** | 3 blast-radius tiers | 11 deployment profiles with machine-executable trigger_conditions |
| **Assurance target** | Not used | `assurance_target` object binding model to use case, deployment context, affected parties, and jurisdiction |
| **Cross-domain** | Not used | `cross_domain.references[]` navigation pointers + `evidence_artifacts[]` sharing declarations |

**Framework mapping notes:**

- **NIST AI 600-1** mappings use category-level IDs only (CONFABULATION, CBRN, DATA-PRIVACY, INFO-INTEGRITY, INFO-SECURITY, IP, HUMAN-AI-CONFIG, OBSCENE-DEGRADING). All `nist_ai_600_1` entries carry `provisional: true` and a `provisional_note` because action-level IDs within each category are not yet published. Do not set `mapping_confidence: high` or `verified` for `nist_ai_600_1` entries.
- **OWASP AI Testing Guide** (`owasp_aitg`) mappings use three `fit` values: `direct` (the AITG requirement directly names what the control tests), `supporting` (the control enables the test condition), or `adjacent` (same threat domain, different concern). Do not use `partial` for AITG entries — use `adjacent` instead.
- **CSA AICM** (`aicm`) covers all 6 layers with 46 total mappings against AICM v1.1 (247 objectives, 18 domains). Domain prefix conventions: GOV, DM, EVA, SEC, PRV, SUP use `mapping_confidence: high` (confirmed). The 7 new v1.1 domain prefixes — MON (Monitoring and Alerting), IR (Incident Response and Recovery), HO (Human Oversight and Control), TE (Transparency and Explainability), CL (Compliance and Legal Obligations), RM (Risk Management), DP (Deployment and Change Management) — use `mapping_confidence: medium` pending full verification against the published v1.1 document. `source_locator.section` is required for `fit: "direct"` AICM mappings. See CONTRIBUTING.md section 4.7 for the full domain prefix table.

---

## How to Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guidelines.

**Summary rules:**

1. **Cite or flag.** Every claim must trace to a verifiable source. If a claim cannot be cited to a primary source, use `source_type: apeiris-thesis` and document the reasoning in `matrix_thesis`. Uncited claims that are not flagged as thesis are rejected.
2. **No fabricated IDs.** Never invent a framework requirement ID, ATLAS technique number, or OWASP entry. Verify all IDs against the primary source before submitting.
3. **No verbatim AISVS text.** AISVS is CC BY-SA 4.0 (ShareAlike). The modelverifier.ai matrix is CC BY-NC 4.0. Copying AISVS requirement text verbatim creates a license incompatibility. Map by requirement_id and write original rationale.
4. **Obligation accuracy.** SR 26-2 and OCC 2026-13 are supervisory guidance, not binding law. EU AI Act high-risk provisions are enacted but have future effective dates. Obligation objects must accurately represent normative_force and effective_from.
5. **Schema validity.** All control records must validate against `schema/model-controls.schema.json`. Run `npm run validate` before submitting.

---

## Build Instructions

### Prerequisites

- Node.js 20 or later
- `npm` (no other runtime dependencies)

### Install

```bash
cd modelverifier.ai
npm install
```

### Validate all controls

```bash
npm run validate
```

Validates all 54 control records in `controls/` against `schema/model-controls.schema.json`. Exits non-zero on any schema violation.

### Run all audits

```bash
npm run audit
```

Runs the full audit suite:
- `audit:mappings` — validates requirement_id patterns against `schema/framework-mapping-catalog.json`
- `audit:namespaces` — validates layer/plane assignments against `apeiris-control-core/namespace-registry.json`
- `audit:applicability` — validates obligation predicates reference valid `assurance_target` fields
- `check:freshness` — warns on source `retrieved_on` dates older than 180 days
- `validate:baselines` — enforces all 15 baseline controls are present with `readiness: approved`

The v1.0 release builds with **0 warnings**. All 6 layers — including BH and CR — have complete NIST RMF and ISO 42001 framework mappings on every control.

### Build integration bundle

```bash
npm run build:integration
```

Merges all control records from `controls/*.json`, validates the merged set, and generates `integration/model-controls-full.json` with all 54 controls, profiles, coverage statistics, and gap analysis.

### Full pipeline (validate + audit + build)

```bash
npm run ci
```

This is the command the Cloudflare Pages deployment runs on every push to `main`.

### Run locally

After `npm run build`, serve the `public/` directory from any static file server:

```bash
# Python (no install required)
cd public && python3 -m http.server 8080

# Node.js
npx serve public

# Or any other static server
```

Open `http://localhost:8080`. The site fetches `/integration/model-controls-full.json` at runtime, so the integration bundle must be built first.

---

## License

The modelverifier.ai control matrix is published under **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)**.

- **Free to use** for non-commercial research, education, compliance programme development, and internal enterprise use.
- **Attribution required.** Cite as: "AI Model & System Assurance Control Matrix, Apeiris (modelverifier.ai), version 1.0.0."
- **Commercial use** — including embedding the matrix in commercial products, SaaS platforms, or professional services — requires a RiskOne commercial license. Contact licensing@apeiris.ai.

AISVS (CC BY-SA 4.0) mappings in this matrix are by requirement_id and independently authored rationale only. No AISVS requirement text is reproduced verbatim. Framework mapping rationale is original editorial work and is not a derivative of AISVS content.

MITRE ATLAS (Apache 2.0), OWASP LLM Top 10 (CC BY-SA 4.0), and CSA AICM (CC BY-SA 4.0) are referenced by identifier and independently authored rationale. No requirement text is reproduced.

---

## Future Domains

modelverifier.ai is the second Apeiris public knowledge domain. The roadmap includes:

- **privacyverifier.ai** — GDPR, CCPA, PIPL, and data governance controls. Privacy domain lens vocabulary: engineering, legal, dpo, grc, product.
- **complianceverifier.ai** — SOX, HIPAA, PCI-DSS, and industry-specific frameworks. Compliance domain lens vocabulary: engineering, audit, legal, grc, finance.
- **identitycontrols.ai** — Identity governance, access management, and authentication controls for AI systems and agentic workflows.
- **agenticverifier.ai** — Delegated authority, tool authorization, and multi-agent workflow enforcement controls.

All future domains share the `apeiris-control-core/` schema package. Adding a new domain requires: a domain registration in `apeiris-control-core/namespace-registry.json`, a domain-specific extension schema, a framework mapping catalog, and a profiles definition file. The build pipeline and deployment workflow are identical across domains.

---

## Verified Source Facts

The following source versions are pinned at the time of initial authoring. Contributors must verify version currency before updating any mapping that references these sources.

| Source | Version | Published | Notes |
|---|---|---|---|
| MITRE ATLAS | v5.6.0 | 2026-05-04 | AML.T0051=LLM Prompt Injection; AML.T0020=Poison Training Data; AML.T0024=Exfiltration via Inference API; AML.T0044=Full ML Model Access |
| OWASP LLM Top 10 | 2025 | 2025-01-01 | LLM01=Prompt Injection; LLM03=Supply Chain; LLM04=Data and Model Poisoning; LLM09=Misinformation |
| OWASP AISVS | v1.0 | 2026-06-24 | CC BY-SA 4.0; no formal GitHub release tag — reference by commit hash |
| Anthropic RSP | v3.3 | 2026-05-26 | Responsible Scaling Policy |
| Google DeepMind FSF | v3.1 | 2026-04-17 | Frontier Safety Framework |
| EU AI Act | 2024/1689 | 2024-07-12 | Standalone high-risk: 2027-12-02; product-embedded: 2028-08-02. Parliament-approved; Council adoption pending as of 2026-06-26 |
| SR 26-2 | SR 26-2 | 2026-04-01 | Supersedes SR 11-7 and SR 21-8. Supervisory guidance, not binding law. Heightened for $30B+ asset institutions |
| OCC 2026-13 | 2026-13 | 2026 | NOT binding; supervisory guidance only |
| ISO/IEC 42005:2025 | 2025 | 2025-05-01 | AI system impact assessment |
| ISO/IEC 42001 | 2023 | 2023-12-18 | AI management system |
| NIST AI RMF | 1.0 | 2023-01-26 | NIST AI 100-1 |
| CSA AICM | 1.1 | 2026-06-22 | Cloud Security Alliance AI Controls Matrix (247 control objectives, 18 domains) |
