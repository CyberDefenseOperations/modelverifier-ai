# Contributing to modelverifier.ai

The AI Model & System Assurance Control Matrix is a public knowledge corpus maintained by Apeiris. Contributions that improve accuracy, expand coverage, or correct errors are welcome. The editorial standards below are non-negotiable — they exist to protect the matrix from misinformation and to maintain its usability as a regulatory and assurance reference.

---

## Table of Contents

1. [The Foundational Rules](#1-the-foundational-rules)
2. [How to Add or Update a Control](#2-how-to-add-or-update-a-control)
3. [How to Add a New Source](#3-how-to-add-a-new-source)
4. [How to Update Framework Mappings](#4-how-to-update-framework-mappings)
5. [Obligation Object Requirements](#5-obligation-object-requirements)
6. [AISVS License Constraint](#6-aisvs-license-constraint)
7. [Review Process](#7-review-process)
8. [Schema and Build Pipeline](#8-schema-and-build-pipeline)

---

## 1. The Foundational Rules

These rules apply to every contribution. Violations are grounds for immediate rejection without discussion.

### 1.1 Cite or Flag — No Exceptions

Every substantive claim in a control record must either:
- **Cite a verifiable primary source** in the `sources[]` array with a `canonical_url`, `version`, and `retrieved_on` date; or
- **Be flagged as an Apeiris thesis** using `source_type: apeiris-thesis`, `claim: true`, and a corresponding entry in `matrix_thesis`.

A claim is substantive if it asserts that a standard, regulation, or threat model requires or recommends a specific control behavior. Implementation steps, anti-patterns, and lens guidance may draw on practitioner knowledge, but any step that references a specific framework expectation (e.g., "SR 26-2 expects...") must cite the source.

If you are uncertain whether a claim can be sourced, default to labeling it as thesis. Do not present a guess as a citation.

### 1.2 No Fabricated Framework IDs

Never invent, guess, or paraphrase a framework requirement ID. This includes:
- NIST AI RMF subcategory numbers (GOVERN-X.X, MAP-X.X, MEASURE-X.X, MANAGE-X.X)
- ISO/IEC 42001 clause numbers (A.6.1, 8.4, etc.)
- EU AI Act article numbers (Art-9, Art-14, etc.)
- SR 26-2 section codes (S-1.1, S-3.2, etc.)
- OWASP AISVS requirement IDs (C1.1, C5.3, etc.)
- OWASP LLM Top 10 entries (LLM01:2025 through LLM10:2025)
- CSA AICM control IDs (MG-01, GOV-03, etc.)
- MITRE ATLAS technique IDs (AML.T####)
- OWASP AI Testing Guide requirement IDs (AITG-XX-NN format, e.g., AITG-OT-01)

Verify each ID against the primary source before submitting. The `schema/framework-mapping-catalog.json` file defines the allowed `requirement_id` patterns for each framework. The `audit:mappings` build step validates all IDs against these patterns and will fail on any unrecognized ID. If a valid ID does not match the catalog pattern, update the catalog first with a documented rationale.

**MITRE ATLAS exception:** If no ATLAS technique directly applies to a control, use `fit: none` and document the absence in `rationale`. Do not map to a nearby technique to fill the gap.

### 1.3 Verify Against the Primary Source

For every framework ID you cite, retrieve the primary source document at the `canonical_url` listed in `schema/framework-mapping-catalog.json` and confirm:
1. The ID exists in the version cited.
2. The requirement content is accurately represented by the mapping `rationale`.
3. The `source_version` in the mapping object matches the framework version in the catalog.

Do not rely on secondary summaries, blog posts, or prior versions of the framework. Requirements shift between versions, and citing a superseded clause is misleading.

### 1.4 Original Ideas Labeled as Thesis

If a control represents a practice that Apeiris believes is necessary but that is not yet required or recommended by any external framework, it must be labeled `thesis_type` appropriately and carry a `matrix_thesis` field explaining the editorial rationale. The `sources[]` array must include an entry with `source_type: apeiris-thesis` and `claim: true`. Thesis controls are valued — they are how the corpus anticipates emerging practice — but they must be clearly distinguished from standard-backed controls.

---

## 2. How to Add or Update a Control

### 2.1 Choosing the Control ID

Control IDs are stable and permanent. A retired control is marked `readiness: deprecated`, not deleted. When adding a control:

1. Identify the correct layer (LI, TG, EV, OA, BH, or CR).
2. Find the next available sequence number in that layer's control file (`controls/<LAYER>.json`).
3. Assign the ID `<LAYER>-<NN>` with a zero-padded two-digit sequence number.
4. Confirm that no deprecated control in that layer occupies that ID.

### 2.2 Required Fields

Every control record must include these fields (defined in `schema/model-controls.schema.json`):

```
id, layer, plane, name, plain, threat, sources, implementation,
validation, lenses (all 5 keys), maturity, coverage_note, capability_risk
```

Recommended but not required for initial submission: `matrix_thesis`, `thesis_type`, `frameworks[]`, `obligations[]`, `cross_domain`, `monitoring_schema`, `tiers[]`, `meta`.

### 2.3 Writing a Control Name

The `name` field names the mechanism or property being established, not the threat it addresses. Maximum 80 characters.

- Correct: "Training Data Source Authorization and Consent Governance"
- Incorrect: "Preventing Unauthorized Training Data Use"

### 2.4 Writing the `plain` Field

One sentence, maximum 200 characters, for a non-specialist audience. Must not assume ML or security domain knowledge. State what the control requires and why, not how.

- Correct: "Before any dataset is used to train a model, its source is verified and any required consent or license is on record."
- Incorrect: "Implements RBAC-based governance for training data pipelines using data catalog integration."

### 2.5 Filling Out the Five Lenses

Every control requires exactly five lens keys: `engineering`, `evaluation`, `red_team`, `grc`, `mlops`. Each lens must include at minimum a `summary` and `failure_signals`.

**engineering:** Written for ML engineers, platform engineers, and system architects. Focus on concrete implementation tasks, tooling choices, and CI/CD integration.

**evaluation:** Written for independent validators and model evaluators. Focus on what must be assessed, what benchmarks apply, and what independence requirements exist. Evaluation is distinct from development — do not assume the lens reader has access to training infrastructure.

**red_team:** Written for adversarial testers, structured elicitation teams, and safety evaluators. Focus on what attack surfaces the control addresses, what bypass attempts should be attempted, and what constitutes a successful adversarial finding. Include ATLAS technique references where applicable.

**grc:** Written for governance, risk, and compliance officers, legal counsel, and auditors. Focus on regulatory obligations, metric thresholds, evidence expectations, and audit artifact requirements. Include explicit references to framework provisions and their normative force.

**mlops:** Written for ML operations engineers managing the production deployment lifecycle. Focus on operational monitoring, retraining triggers, rollback procedures, and coordination with SecOps. Note: MLOps owns behavior-state changes; securitycontrols.ai Security domain owns runtime enforcement, attack detection, and tool/action authorization — do not duplicate scope.

### 2.6 Writing `coverage_note`

The coverage note must be non-empty and must address at minimum:
- What this control covers.
- What it explicitly does not cover (and where that coverage exists, if anywhere in the matrix).
- Any known coverage gaps that are unaddressed.

Silence on coverage gaps is an editorial error.

### 2.7 Setting `capability_risk`

The `capability_risk` object is required on every control. For controls where the capability risk dimensions do not vary by control (e.g., a documentation control applies identically across all capability levels), set `capability_level: low` and document that the control applies uniformly. For controls with specific capability-level conditions, populate all relevant dimensions.

The `capability_risk.capability_level` field is used by the profile trigger evaluation engine. Set it accurately — do not inflate to `frontier` unless the control specifically addresses frontier-level concerns.

### 2.8 Filling `monitoring_schema`

`monitoring_schema` is required for controls in the BH and CA layers. It is recommended for EV and DT controls with production monitoring implications. It is not appropriate for pure documentation or governance controls (LI-04, OA-01, etc.) — omit rather than provide an empty object.

Each `metric_object` in `monitoring_schema.metrics[]` must be independently executable by the Apeiris Model Verifier against a production inference stream. Metrics that cannot be evaluated without human judgment are not valid monitoring metrics — express them as validation checks instead.

---

## 3. How to Add a New Source

Sources are cited at the control level in `sources[]` and referenced by `id` from `frameworks[]` mapping objects.

### 3.1 Source Object Requirements

Every source object must include:

```json
{
  "id": "snake_case_identifier",
  "title": "Full document title as it appears on the official source",
  "authority": "Issuing organization",
  "source_type": "one of the allowed enum values",
  "normative_force": "binding-law | guidance | voluntary | informative",
  "version": "version string as it appears in the document",
  "published_on": "YYYY-MM-DD",
  "retrieved_on": "YYYY-MM-DD",
  "canonical_url": "https://...",
  "license": "license identifier",
  "status": "current | deprecated | withdrawn | draft | final-review"
}
```

`artifact_hash` (sha256:...) is strongly recommended and required for `status: verified` mapping confidence levels. Compute it over the canonical document file (PDF or HTML) at `canonical_url`.

`flagship: true` must be set on exactly one source per control — the primary normative source grounding the control's existence.

### 3.2 Allowed `source_type` Values

```
binding-law          — Enacted statute or regulation with direct legal force
regulation           — Delegated regulation or statutory instrument
supervisory-guidance — Regulatory or supervisory guidance (not binding; SR 26-2, OCC 2026-13)
voluntary-standard   — Standard with no binding force (NIST AI RMF, ISO 42001 in non-certified deployments)
certification-standard — Standard enabling third-party certification (ISO 42001 when certified)
industry-framework   — Industry body framework (CSA AICM, OWASP LLM Top 10)
threat-knowledge-base — Threat taxonomy (MITRE ATLAS)
academic-research    — Peer-reviewed research (e.g., Mitchell et al. model card paper)
vendor-framework     — Vendor-published framework (RSP, FSF, Preparedness Framework)
product-documentation — Product or platform documentation
apeiris-thesis       — Apeiris editorial thesis; no external source. Requires claim: true.
```

### 3.3 `normative_force` Accuracy

This field must accurately represent the legal character of the source:

- **SR 26-2** is `supervisory-guidance`, not `binding-law`. OCC 2026-13 is `supervisory-guidance`.
- **EU AI Act** is `binding-law` for its substantive provisions. High-risk Annex III obligations are enacted but not yet enforceable — this is handled by `effective_from` in the `obligation_object`, not by changing `normative_force`.
- **NIST AI RMF** is `voluntary` — the US government has not mandated its use by statute.
- **ISO 42001** is `voluntary-standard` or `certification-standard` depending on whether the organization is pursuing certification.
- **OWASP AISVS, LLM Top 10, CSA AICM, MITRE ATLAS** are `voluntary` or `informative`.

Overstating normative force is a material error. It misleads compliance professionals about their legal obligations.

---

## 4. How to Update Framework Mappings

### 4.1 Per-Mapping Status Fields

Each object in `frameworks[]` carries 7 split status fields. These must be set on every mapping:

| Field | Allowed Values | Notes |
|---|---|---|
| `source_status` | authoritative, draft, proposed, deprecated, withdrawn | Recency and authority of the source document at time of this mapping |
| `mapping_confidence` | verified, high, medium, low, speculative | Confidence that this mapping accurately reflects the requirement |
| `legal_status` | binding, guidance, voluntary, pending, not-applicable | Legal force in the deployment jurisdiction |
| `control_readiness` | not-started, in-design, in-review, approved, published | Editorial readiness of the control for this requirement |
| `implementation_maturity` | none, initial, developing, defined, managed, optimizing | Typical maturity of this control-requirement pair |
| `assurance_result` | not-assessed, pass, pass-with-findings, fail, not-applicable | Most recent assurance outcome |
| `evidence_status` | no-evidence, partial, sufficient, verified, expired | Currency of supporting evidence |

For new mappings that have not yet been assessed, use:
```json
{
  "assurance_result": "not-assessed",
  "evidence_status": "no-evidence"
}
```

### 4.2 Mapping Rationale Standards

The `rationale` field must:
- State the specific claim being made (what does this control do that relates to this requirement?).
- Cite the requirement by ID and explain the relationship.
- Not imply "implement this control and you comply" — the correct framing is "this control supports satisfaction of the requirement under the stated applicability conditions."
- Be minimum 30 characters (enforced by schema); aim for 2-4 substantive sentences.

When `fit: partial`, `uncovered_portion` is required. Describe specifically what the framework requirement covers that this control does not address.

When `fit: direct`, `source_locator` is required with at least a `section` field.

### 4.3 Mapping Direction

`direction` describes the logical relationship between the control and the requirement:

- `control-supports-requirement`: The control is evidence toward satisfying the requirement but does not exhaust it.
- `requirement-subsumes-control`: The requirement is broader; this control is one implementation mechanism among several.
- `bidirectional`: Implementing this control and satisfying the requirement are essentially equivalent for this specific clause.
- `tangential`: Related but different obligation; document the relationship but not as evidence of satisfaction.

### 4.4 When No Mapping Exists

For MITRE ATLAS: if no technique applies, use `fit: none` and explain the gap in `rationale`. Do not map to an adjacent technique to fill the field.

For other frameworks: if a control has no substantive relationship to a framework, omit that framework from `frameworks[]`. The `audit:mappings` step enforces only that covered controls have mappings to at least `nist_rmf` and `iso_42001` (FWMAP-009, severity: warning). This requirement applies to all 6 layers, including BH and CR. As of the v1.0 release, all controls across all layers satisfy this requirement with 0 build warnings.

### 4.5 NIST AI 600-1 Mappings — Always Provisional

All `nist_ai_600_1` mappings must carry `provisional: true` and a `provisional_note` field explaining that only category-level IDs are available. The eight category-level IDs are: CONFABULATION, CBRN, DATA-PRIVACY, INFO-INTEGRITY, INFO-SECURITY, IP, HUMAN-AI-CONFIG, OBSCENE-DEGRADING.

Action-level IDs within each category have not been published by NIST. Until they are, no `nist_ai_600_1` mapping may claim higher granularity than the category level, and `mapping_confidence` must be set to `"medium"` at most. Do not use `mapping_confidence: high` or `verified` for any `nist_ai_600_1` entry regardless of how well the control aligns with the category description.

Example:
```json
{
  "framework": "nist_ai_600_1",
  "requirement_id": "CONFABULATION",
  "fit": "direct",
  "provisional": true,
  "provisional_note": "Category-level mapping only. NIST AI 600-1 does not yet publish action-level IDs within each category.",
  "mapping_confidence": "medium"
}
```

### 4.6 OWASP AI Testing Guide Fit Values

`owasp_aitg` mappings use three specific `fit` values. Do not use `partial` for AITG entries.

| Fit value | Meaning |
|---|---|
| `direct` | The AITG requirement directly names the test this control enables. The test procedure in the AITG document describes what this control must demonstrate. |
| `supporting` | This control creates the precondition or evidence structure that the AITG test procedure depends on, but the test itself covers more than this control alone. |
| `adjacent` | The control and the AITG requirement address the same threat domain but from different angles — implementing the control does not directly satisfy the AITG test. |

All `owasp_aitg` mappings must carry `mapping_confidence: medium` because the OWASP AI Testing Guide is a pre-release document that may change before stable v1.0 publication.

### 4.7 AICM Domain Prefix Conventions

CSA AICM v1.1 (247 control objectives, 18 domains) mappings span all 6 layers of this matrix. When adding or updating `aicm` mappings, follow these domain prefix conventions:

| Domain Prefix | Domain Name | mapping_confidence |
|---|---|---|
| GOV | Governance | high |
| DM | Data Management | high |
| EVA | Evaluation and Auditing | high |
| SEC | Security Controls | high |
| PRV | Privacy | high |
| SUP | Supply Chain | high |
| MON | Monitoring and Alerting | medium |
| IR | Incident Response and Recovery | medium |
| HO | Human Oversight and Control | medium |
| TE | Transparency and Explainability | medium |
| CL | Compliance and Legal Obligations | medium |
| RM | Risk Management | medium |
| DP | Deployment and Change Management | medium |

**Confidence rules:**

- Use `mapping_confidence: "high"` for the six confirmed-domain prefixes (GOV, DM, EVA, SEC, PRV, SUP). These domains are well-established in the AICM v1.1 document and have been fully verified.
- Use `mapping_confidence: "medium"` for the seven new v1.1 domain prefixes (MON, IR, HO, TE, CL, RM, DP) until each individual mapping has been fully verified against the published AICM v1.1 document.
- `source_locator.section` is required for every `fit: "direct"` AICM mapping.
- Do not invent domain prefixes not listed in this table. If you believe a new domain prefix is warranted, add it to this table in the same PR and justify the mapping against the AICM v1.1 source document.

---

## 5. Obligation Object Requirements

### 5.1 When Obligations Are Required

An `obligations[]` entry is required for every control that maps to `eu_ai_act` or `sr262` with `fit: direct` or `fit: partial`. Build step FWMAP-006 enforces this.

### 5.2 Required Fields

Every `obligation_object` must include:

```json
{
  "authority": "Issuing body",
  "instrument": "Full instrument name",
  "provision": "Specific provision identifier",
  "jurisdiction": ["jurisdiction codes"],
  "normative_force": "binding-law | supervisory-guidance | ...",
  "legal_status": "enacted | pending-adoption | proposed | ...",
  "source_ref": "framework key from framework-mapping-catalog.json",
  "reviewed_on": "YYYY-MM-DD"
}
```

### 5.3 Effective Date Requirement

Every obligation with `normative_force: binding-law` must include `effective_from`. For EU AI Act high-risk Annex III provisions:
- Standalone high-risk systems: `"effective_from": "2027-12-02"` (Parliament-approved; Council adoption pending as of 2026-06-26)
- Product-embedded high-risk systems: `"effective_from": "2028-08-02"`

Track the EU AI Act Official Journal publication for final confirmation before publishing controls with these dates as final.

### 5.4 Actor Role Scoping

The `actor_roles` field must reflect which actors the obligation binds. EU AI Act Art-9 through Art-17 typically bind `provider`. Deployer obligations are separate and must not be conflated with provider obligations. A control that implements a provider obligation cannot be cited as satisfying a deployer obligation without explicit analysis.

### 5.5 Machine-Executable Applicability

The `applicability` object contains boolean predicates evaluated against `assurance_target` by the Apeiris runtime. Predicates must reference valid `assurance_target` field paths as they appear in `schema/model-controls.schema.json`. The `audit:applicability` build step validates predicate field references.

Use `all[]` for conditions that must all be true, `any[]` for at-least-one conditions, and `none[]` for exclusion conditions.

Example for a control that applies only to EU-jurisdiction high-risk systems:
```json
{
  "applicability": {
    "all": [
      { "field": "assurance_target.jurisdiction", "op": "contains", "value": "eu" },
      { "field": "assurance_target.eu_ai_act_classification", "op": "in",
        "value": ["high-risk-annex-iii", "high-risk-product-embedded"] }
    ]
  }
}
```

### 5.6 SR 26-2 Obligations

SR 26-2 and OCC 2026-13 must always carry:
- `normative_force: "supervisory-guidance"` — never `binding-law`
- `legal_status: "enacted"` (the letter has been issued)
- No `effective_from` — supervisory guidance does not have a prospective enforcement date in the same sense as a statute

The build step FWMAP-007 enforces that sr262 obligations never carry `legal_status: "binding"`.

---

## 6. AISVS License Constraint

OWASP AISVS v1.0 is published under CC BY-SA 4.0 (ShareAlike). The modelverifier.ai matrix is published under CC BY-NC 4.0. These licenses are **not compatible** for derivative works that reproduce AISVS content.

The following is permitted:
- Mapping to an AISVS requirement_id (e.g., C5.3) in the `frameworks[]` array.
- Writing an independent `rationale` that explains the relationship without quoting the AISVS requirement text.
- Stating the requirement category title (e.g., "Model Evaluation") without quoting the specific requirement.

The following is prohibited:
- Copying verbatim text from any AISVS requirement into any field of a control record.
- Paraphrasing an AISVS requirement so closely that it is effectively a reproduction.

If a contribution includes AISVS text that appears to be copied verbatim, it will be returned for rewriting before review. This constraint applies regardless of attribution — ShareAlike requires the derivative work to carry the same license, which is structurally incompatible with the CC BY-NC 4.0 corpus license.

The same constraint applies to OWASP LLM Top 10 (CC BY-SA 4.0) and CSA AICM (CC BY-SA 4.0). Map by identifier and write original rationale.

The OWASP AI Testing Guide (owasp_aitg) is a pre-release document. All owasp_aitg mappings must carry `mapping_confidence: medium` until a stable v1.0 release is published. Do not set `mapping_confidence: high` or `verified` for owasp_aitg entries regardless of how well the control aligns with the draft text — draft documents can change substantially before publication.

---

## 7. Review Process

### 7.1 Submitting a Contribution

1. Fork the repository.
2. Create a branch named `control/<LAYER>-<NN>-<short-description>` for new controls or `fix/<LAYER>-<NN>-<short-description>` for corrections.
3. Make your changes to the relevant `controls/<LAYER>.json` file.
4. Run the full validation pipeline locally: `npm run ci`
5. Open a pull request against `main` with a description that includes:
   - The control ID(s) affected
   - The primary source(s) cited
   - A brief statement of what changed and why
   - Confirmation that all framework IDs were verified against primary sources

### 7.2 Review Criteria

Pull requests are reviewed against these criteria in order:

1. **Schema validity.** `npm run validate` passes with no errors.
2. **Build pipeline.** `npm run ci` passes with no errors. Warnings may be accepted with documented rationale.
3. **Source accuracy.** Every framework ID cited exists in the version of the framework documented in `schema/framework-mapping-catalog.json`.
4. **Normative force accuracy.** Obligation objects correctly represent binding law vs. supervisory guidance vs. voluntary standards.
5. **License compliance.** No verbatim AISVS, LLM Top 10, or CSA AICM requirement text.
6. **Coverage note completeness.** All coverage gaps are documented.
7. **Lens completeness.** All five lenses include at minimum `summary` and `failure_signals`.
8. **Rationale quality.** Mapping rationale makes a defensible claim about the control-requirement relationship without overstating compliance implications.

### 7.3 What Gets Rejected

The following will result in rejection without extended discussion:

- Framework IDs that do not exist in the cited source version.
- Normative force misclassification (e.g., SR 26-2 as binding-law).
- Verbatim AISVS requirement text.
- ATLAS technique IDs that do not exist in MITRE ATLAS v5.6.0 or later.
- EU AI Act obligation objects without `effective_from`.
- Controls with empty `coverage_note`.
- Controls failing `npm run validate` or `npm run ci`.

### 7.4 What Gets Flagged for Author Revision

The following will be returned to the author with specific feedback:

- Mapping rationale that implies "implement this control → you comply."
- Monitoring metrics that cannot be executed without human judgment.
- Capability risk levels that are inflated or deflated relative to the control's actual scope.
- Lenses that duplicate content rather than providing a stakeholder-specific perspective.
- Sources with `retrieved_on` dates more than 90 days old (freshness warning).

### 7.5 Turnaround

Editorial reviews aim for a first response within 10 business days. Legal review of obligations (EU AI Act, SR 26-2) may take longer. Complex controls that require counsel review will be so noted.

---

## 8. Schema and Build Pipeline

### 8.1 Local Setup

```bash
cd modelverifier.ai
npm install
```

### 8.2 Build Commands

| Command | Purpose |
|---|---|
| `npm run validate` | JSON Schema validation of all controls in `controls/` |
| `npm run audit:mappings` | Validate requirement_id patterns against `schema/framework-mapping-catalog.json` |
| `npm run audit:namespaces` | Validate layer and plane assignments against `apeiris-control-core/namespace-registry.json` |
| `npm run audit:applicability` | Validate obligation predicate field paths against `assurance_target` schema |
| `npm run check:freshness` | Warn on source `retrieved_on` dates older than 180 days |
| `npm run validate:baselines` | Enforce all 15 baseline controls are present with `readiness: approved` |
| `npm run audit` | Run all audit steps |
| `npm run build` | Generate `integration/` bundle from validated controls |
| `npm run ci` | Full pipeline: validate + audit + build |

### 8.3 Framework Keys

`FRAMEWORK_KEYS` in `build-integration.mjs` contains 10 entries:

```
nist_rmf  nist_ai_600_1  iso_42001  eu_ai_act  sr262
aisvs     llm10          aicm       mitre       owasp_aitg
```

When adding a mapping to `owasp_aitg`, use the AITG-XX-NN format (e.g., `AITG-OT-01`, `AITG-ML-03`). The framework has 52 total mappings across all 6 layers. Because the OWASP AI Testing Guide is a pre-release document, all owasp_aitg mappings must carry `mapping_confidence: medium`. Use `fit: direct`, `fit: supporting`, or `fit: adjacent` — not `fit: partial`. See section 4.6 for fit value criteria.

When adding a mapping to `nist_ai_600_1`, always set `provisional: true` and `mapping_confidence: "medium"`. See section 4.5 for required fields and the rationale.

Adding a new framework requires updating `FRAMEWORK_KEYS` and `FRAMEWORK_DISPLAY` in `build-integration.mjs`, `VALID_FRAMEWORK_KEYS` in `scripts/validate.mjs`, the `frameworks[].framework` enum in `schema/model-controls.schema.json`, allowed patterns in `schema/framework-mapping-catalog.json`, and the `fillFrameworks()` renderer in `public/index.html`. See the "Adding a framework mapping key" section in ARCHITECTURE.md for the full checklist.

### 8.4 Control File Format

Control records are stored as JSON arrays in `controls/<LAYER>.json`. Each file contains all controls for that layer ordered by sequence number. Do not split controls into individual files — the per-layer file structure matches securitycontrols.ai.

The `$schema` field at the top of each control object must reference `https://schema.apeiris.ai/model-assurance/v1/model-controls.schema.json`. This enables IDE validation via the schema file at `schema/model-controls.schema.json`.

### 8.5 Schema Files

Do not edit `schema/model-controls.schema.json` or `schema/model-assurance-extension.schema.json` in a control contribution PR. Schema changes require a separate PR, a migration plan for any controls that become invalid, and explicit sign-off.

Do not edit `apeiris-control-core/*.schema.json` files in any domain-specific PR. Changes to the shared core require coordination across all Apeiris domains.
