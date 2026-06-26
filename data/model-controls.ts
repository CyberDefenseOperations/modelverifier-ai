/**
 * model-controls.ts
 *
 * TypeScript type definitions for the Apeiris AI Model & System Assurance
 * Control Matrix (modelverifier.ai).
 *
 * These interfaces match the JSON Schema defined in:
 *   schema/model-controls.schema.json
 *   schema/model-assurance-extension.schema.json
 *
 * Naming conventions follow agentic-controls.ts from securitycontrols.ai
 * with model-assurance-specific extensions for monitoring, capability risk,
 * obligations, assurance targets, and the 7 split status fields.
 *
 * All interfaces are runtime-safe: they describe the shape of data as stored
 * in controls/*.json and served from integration/controls.json. No class
 * methods, no decorators — plain TypeScript interfaces for zero runtime
 * dependency consumption.
 *
 * Generated: 2026-06-26
 * Schema version: 1.0.0
 */

// ---------------------------------------------------------------------------
// Core enumerations
// ---------------------------------------------------------------------------

/** The six layer codes for the model assurance matrix. */
export type Layer = 'LI' | 'TG' | 'EV' | 'OA' | 'BH' | 'CR';

/**
 * Runtime plane assignment for a control.
 * control = policy, governance, identity, configuration.
 * data = inference requests, training data, model outputs, tool calls.
 * lifecycle = training-through-retirement arc.
 * both = control plane and data plane simultaneously.
 */
export type Plane = 'control' | 'data' | 'lifecycle' | 'both';

/**
 * The eight deployment profiles for the model assurance matrix.
 * A deployment may belong to multiple profiles simultaneously.
 * The 15-control baseline applies to all deployments regardless of profile.
 */
export type Profile =
  | 'general-predictive-ml'
  | 'generative-ai'
  | 'hosted-api'
  | 'continuously-learning'
  | 'high-impact-decision'
  | 'us-regulated-banking'
  | 'eu-high-risk'
  | 'frontier-capability';

/**
 * The eight framework mapping keys for the model assurance matrix.
 * Differs from securitycontrols.ai by including sr262, aicm, and
 * replacing imda_mgf and aws_agentic with sr262.
 */
export type FrameworkKey =
  | 'nist_rmf'
  | 'iso_42001'
  | 'eu_ai_act'
  | 'sr262'
  | 'aisvs'
  | 'llm10'
  | 'aicm'
  | 'mitre';

/** Maturity level on a 0-5 CMMI-aligned progression. */
export type MaturityLevel =
  | 'none'
  | 'initial'
  | 'developing'
  | 'defined'
  | 'managed'
  | 'optimizing';

/** Editorial readiness state for a control record. */
export type Readiness = 'draft' | 'review' | 'approved' | 'deprecated';

/** Control function taxonomy. */
export type ThesisType =
  | 'preventive'
  | 'detective'
  | 'corrective'
  | 'deterrent'
  | 'compensating'
  | 'directive'
  | 'recovery';

// ---------------------------------------------------------------------------
// Source schema
// ---------------------------------------------------------------------------

/**
 * Source type classification.
 * Accurately represents the legal and editorial character of the source.
 * supervisory-guidance is never binding-law — SR 26-2 and OCC 2026-13
 * must use supervisory-guidance.
 */
export type SourceType =
  | 'binding-law'
  | 'regulation'
  | 'supervisory-guidance'
  | 'voluntary-standard'
  | 'certification-standard'
  | 'industry-framework'
  | 'threat-knowledge-base'
  | 'academic-research'
  | 'vendor-framework'
  | 'product-documentation'
  | 'apeiris-thesis';

/** Legal or normative force of a source document. */
export type NormativeForce = 'binding-law' | 'guidance' | 'voluntary' | 'informative';

/** Source record currency. */
export type SourceStatus = 'current' | 'deprecated' | 'withdrawn' | 'draft' | 'final-review';

/**
 * Authoritative source backing a control's existence, necessity, or design.
 * Conforms to apeiris-control-core/source.schema.json.
 *
 * Key differences from securitycontrols.ai:
 * - artifact_hash (sha256:...) enables content-addressed freshness checking.
 * - supersedes links deprecated sources to their replacement.
 * - license is required for CC-licensed sources to enforce AISVS constraint.
 */
export interface Source {
  /** Unique source identifier within this control. Lowercase, underscored. */
  id: string;
  /** Full document title as it appears on the official source. */
  title: string;
  /** Issuing organization. */
  authority: string;
  source_type: SourceType;
  normative_force: NormativeForce;
  /** Version string as it appears in the document. */
  version: string;
  /** ISO 8601 publication date. */
  published_on?: string;
  /** ISO 8601 retrieval date. Freshness check: warn >180d, fail >365d. */
  retrieved_on?: string;
  /**
   * SHA-256 hash of the retrieved document.
   * Format: sha256:<64-hex-chars>
   * Required for mapping_confidence: verified.
   */
  artifact_hash?: string;
  /** Canonical URL from which the document is retrievable. */
  canonical_url?: string;
  /** License identifier (e.g., CC BY-SA 4.0, Apache-2.0, public-domain). */
  license?: string;
  /** Document(s) this source supersedes. Used for SR 26-2 → SR 11-7 chain. */
  supersedes?: string;
  status: SourceStatus;
  /**
   * Exactly one source per control should carry flagship: true.
   * The primary normative source grounding the control's existence.
   */
  flagship?: boolean;
  /**
   * True only for apeiris-thesis source_type entries.
   * Requires source_type: apeiris-thesis.
   */
  claim?: boolean;
}

// ---------------------------------------------------------------------------
// Mapping schema — 7 split status fields
// ---------------------------------------------------------------------------

/**
 * Mapping fit — how well the control satisfies the requirement.
 * direct: fully satisfies under stated applicability.
 * partial: satisfies meaningful portion; uncovered_portion required.
 * adjacent: thematically related but different obligation.
 * supporting: contributes evidence alongside other controls.
 * none: no substantive mapping; used for ATLAS when no technique applies.
 */
export type MappingFit = 'direct' | 'partial' | 'adjacent' | 'supporting' | 'none';

/** Logical direction of the mapping relationship. */
export type MappingDirection =
  | 'control-supports-requirement'
  | 'requirement-subsumes-control'
  | 'bidirectional'
  | 'tangential';

/**
 * Per-mapping source status — recency and authority of source at mapping time.
 * authoritative: current, active source.
 * deprecated: newer version exists.
 * withdrawn: no longer valid.
 */
export type MappingSourceStatus =
  | 'authoritative'
  | 'draft'
  | 'proposed'
  | 'deprecated'
  | 'withdrawn';

/**
 * Confidence that the mapping accurately reflects the requirement.
 * verified: confirmed by SME with source_locator.
 * speculative: untested inference requiring review.
 */
export type MappingConfidence = 'verified' | 'high' | 'medium' | 'low' | 'speculative';

/** Legal force of the mapped obligation in the deployment jurisdiction. */
export type MappingLegalStatus = 'binding' | 'guidance' | 'voluntary' | 'pending' | 'not-applicable';

/** Editorial readiness of the control for the mapped requirement. */
export type ControlReadiness = 'not-started' | 'in-design' | 'in-review' | 'approved' | 'published';

/** Most recent assurance outcome for this control-requirement pair. */
export type AssuranceResult =
  | 'not-assessed'
  | 'pass'
  | 'pass-with-findings'
  | 'fail'
  | 'not-applicable';

/** Currency and completeness of supporting evidence. */
export type EvidenceStatus = 'no-evidence' | 'partial' | 'sufficient' | 'verified' | 'expired';

/** Precise location within a source document. */
export interface SourceLocator {
  section?: string;
  clause?: string;
  page?: number;
  url?: string;
}

/**
 * Framework mapping object.
 * Conforms to model-assurance-extension.schema.json mapping_object.
 *
 * Key differences from securitycontrols.ai:
 * - 7 split status fields (source_status, mapping_confidence, legal_status,
 *   control_readiness, implementation_maturity, assurance_result, evidence_status)
 * - source_locator required when fit: direct
 * - uncovered_portion required when fit: partial
 * - source_hash for content-addressed mapping verification
 */
export interface Mapping {
  framework: FrameworkKey;
  /** Must match the pattern for the framework in schema/framework-mapping-catalog.json. */
  requirement_id: string;
  fit: MappingFit;
  direction: MappingDirection;
  /** Human-authored explanation. Min 30 chars. Must not imply "implement → comply." */
  rationale: string;
  /** Required when fit: partial. What the framework requirement covers that this control does not. */
  uncovered_portion?: string;
  /** Required when fit: direct. */
  source_locator?: SourceLocator;
  /** Framework version at time of mapping. Must match framework-mapping-catalog.json. */
  source_version: string;
  /** SHA-256 of the source document at time of mapping. */
  source_hash?: string;
  /** ISO 8601 date of most recent mapping review. */
  reviewed_on: string;
  reviewer_type?: 'human' | 'automated' | 'human-reviewed-automated';
  // 7 split status fields
  source_status?: MappingSourceStatus;
  mapping_confidence?: MappingConfidence;
  legal_status?: MappingLegalStatus;
  control_readiness?: ControlReadiness;
  implementation_maturity?: MaturityLevel;
  assurance_result?: AssuranceResult;
  evidence_status?: EvidenceStatus;
}

// ---------------------------------------------------------------------------
// Obligation schema
// ---------------------------------------------------------------------------

/**
 * Legal and regulatory obligation normative force.
 * Critical: supervisory-guidance is NOT binding-law.
 * SR 26-2 and OCC 2026-13 must always use supervisory-guidance.
 */
export type ObligationNormativeForce =
  | 'binding-law'
  | 'regulation'
  | 'supervisory-guidance'
  | 'voluntary-standard'
  | 'certification-standard'
  | 'industry-framework'
  | 'best-practice';

/** Legal enactment status of the obligation instrument. */
export type ObligationLegalStatus =
  | 'enacted'
  | 'pending-adoption'
  | 'proposed'
  | 'withdrawn'
  | 'not-applicable';

/** Roles to which an EU AI Act-aligned obligation attaches. */
export type ActorRole =
  | 'provider'
  | 'deployer'
  | 'importer'
  | 'distributor'
  | 'user'
  | 'operator'
  | 'developer'
  | 'authorised-representative';

/**
 * Boolean predicate operator for applicability conditions.
 * Evaluated against assurance_target fields at runtime.
 */
export type ApplicabilityOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not-in'
  | 'contains'
  | 'contains-any'
  | 'contains-all'
  | 'gte'
  | 'lte'
  | 'gt'
  | 'lt'
  | 'exists'
  | 'eq-true'
  | 'eq-false';

/**
 * A single boolean predicate evaluated against assurance_target at runtime.
 * field is a JSONPath-style reference into assurance_target or capability_risk.
 */
export interface ApplicabilityCondition {
  field: string;
  op: ApplicabilityOperator;
  value: string | number | boolean | string[] | number[];
}

/**
 * Applicability predicate set.
 * all: all conditions must be true.
 * any: at least one condition must be true.
 * none: exclusion conditions — if any is true, obligation does not apply.
 */
export interface Applicability {
  all?: ApplicabilityCondition[];
  any?: ApplicabilityCondition[];
  none?: ApplicabilityCondition[];
}

/**
 * A legal or regulatory obligation binding this control to a specific instrument.
 * Replaces the flat regulatory_scope string from prior schema generations.
 *
 * Key design: normative_force and legal_status must accurately represent
 * the source instrument. The Apeiris runtime evaluates applicability predicates
 * against assurance_target without requiring legal re-interpretation.
 */
export interface Obligation {
  authority: string;
  instrument: string;
  provision: string;
  jurisdiction: string[];
  sector?: string[];
  actor_roles?: ActorRole[];
  subject_types?: string[];
  classification?: string[];
  normative_force: ObligationNormativeForce;
  legal_status: ObligationLegalStatus;
  /** Date obligation becomes enforceable. Required for binding-law. */
  effective_from?: string;
  effective_until?: string;
  applicability?: Applicability;
  mapping_fit?: MappingFit;
  /** Framework key from schema/framework-mapping-catalog.json. */
  source_ref: string;
  reviewed_on: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Capability risk schema
// ---------------------------------------------------------------------------

/**
 * Functional capability domain classification.
 * Empty array means no elevated capability domain identified during EV-03.
 */
export type CapabilityDomain =
  | 'cyber'
  | 'bio'
  | 'chemical'
  | 'nuclear-radiological'
  | 'autonomous-ai-rd'
  | 'persuasion-manipulation'
  | 'self-proliferation'
  | 'code-generation'
  | 'reasoning'
  | 'tool-use'
  | 'multimodal'
  | 'long-horizon-planning'
  | 'knowledge-synthesis'
  | 'social-engineering';

/**
 * Summary capability level classification.
 * none: indistinguishable from widely available models.
 * low: above baseline but no threshold crossings requiring enhanced evaluation.
 * elevated: maps approximately to Anthropic ASL-2 or equivalent.
 * frontier: maps approximately to Anthropic ASL-3+ or equivalent.
 */
export type CapabilityLevel = 'none' | 'low' | 'elevated' | 'frontier';

/** How the model is accessed in this deployment. */
export type AccessMode =
  | 'api'
  | 'embedded'
  | 'on-device'
  | 'agentic'
  | 'open-weight'
  | 'restricted-research';

/** Degree of autonomous operation without human review. */
export type Autonomy = 'none' | 'supervised' | 'semi-autonomous' | 'autonomous';

/** Whether model-influenced actions can be undone. */
export type Irreversibility = 'reversible' | 'partially-reversible' | 'irreversible';

/** Highest data sensitivity classification processed in this deployment. */
export type DataSensitivity = 'public' | 'internal' | 'confidential' | 'restricted' | 'secret';

/** Breadth of deployment. */
export type DeploymentScale = 'individual' | 'team' | 'enterprise' | 'public';

/** Potential severity of harm to affected individuals or groups. */
export type AffectedPartyImpact = 'low' | 'moderate' | 'high' | 'critical';

/** Frontier safety framework reference for capability level assessment. */
export interface FrontierFrameworkRef {
  /** e.g., "Anthropic RSP", "Google DeepMind FSF", "OpenAI Preparedness Framework" */
  framework: string;
  /** e.g., "v3.3", "v3.1", "v2" */
  version: string;
  assessed_on: string;
  /** ASL or equivalent level designation from the framework. */
  asl_level?: string;
}

/**
 * Multidimensional capability risk object.
 * Replaces the flat capability_tier string from securitycontrols.ai.
 *
 * Separates five distinct risk drivers that must not be conflated:
 * model capability, use-case consequence, agent autonomy, deployment scale,
 * and irreversibility.
 *
 * capability_level is the summary classification used by profile triggers.
 * The other fields provide dimensional evidence for how it was determined.
 */
export interface CapabilityRisk {
  capability_level: CapabilityLevel;
  capability_domains?: CapabilityDomain[];
  frontier_framework_refs?: FrontierFrameworkRef[];
  access_mode?: AccessMode;
  autonomy?: Autonomy;
  external_reach?: boolean;
  irreversibility?: Irreversibility;
  data_sensitivity?: DataSensitivity;
  deployment_scale?: DeploymentScale;
  affected_party_impact?: AffectedPartyImpact;
}

// ---------------------------------------------------------------------------
// Monitoring schema — structured metric objects
// ---------------------------------------------------------------------------

/** Type of monitoring metric. */
export type MetricType = 'performance' | 'drift' | 'fairness' | 'safety' | 'cost';

/** Alert severity when the comparison threshold is breached. */
export type MetricSeverity = 'info' | 'warning' | 'critical';

/** Evaluation timing mode for a metric. */
export type EvaluationMode = 'real-time' | 'batch';

/** Comparison operator for threshold evaluation. */
export type ComparisonOperator =
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'eq'
  | 'neq'
  | 'decrease-greater-than'
  | 'increase-greater-than'
  | 'outside-range'
  | 'exceeds-absolute-difference';

/** Threshold comparison specification. */
export interface MetricComparison {
  operator: ComparisonOperator;
  /** Threshold value. Number, string, or {min, max} for outside-range. */
  value: number | string | { min: number; max: number };
  /** Evaluation time window. ISO 8601 duration or descriptive label. */
  window: string;
  evaluation_mode: EvaluationMode;
}

/**
 * A single structured monitoring metric independently evaluated by the
 * Apeiris Model Verifier. Designed to be machine-executable rather than
 * log-centric.
 *
 * Replaces the log-centric detection_schema from securitycontrols.ai with
 * a model-domain-specific monitoring specification covering performance,
 * drift, fairness, safety, and cost metrics.
 */
export interface MonitoringMetric {
  /** Unique identifier within this control's monitoring_schema. */
  metric_id: string;
  metric_type: MetricType;
  /** Canonical ML metric name: f1-score, accuracy, jensen-shannon-divergence, etc. */
  measure: string;
  /** Dataset or inference population this metric is evaluated over. */
  population: string;
  /** Population slices for disaggregated evaluation. Required for fairness metrics. */
  segments?: string[];
  /** Baseline measurement reference (immutable: eval-run ID, release tag, hash, or date). */
  baseline_ref?: string;
  comparison: MetricComparison;
  /** Minimum data points for statistically valid evaluation. */
  minimum_sample_size?: number;
  /** Required confidence level, 0.0–1.0. */
  confidence_level?: number;
  severity: MetricSeverity;
  /** Ordered response actions when threshold is breached. */
  actions?: string[];
  /** Fallback state when model is suspended. Must be operationally available. */
  fallback?: string;
  /** Minimum retention period for metric results. ISO 8601 duration or label. */
  evidence_retention?: string;
}

/**
 * Structured monitoring specification for a control.
 * Required for BH and CR layer controls.
 * Recommended for EV and TG controls with production monitoring implications.
 * Omit for pure governance or documentation controls.
 */
export interface MonitoringSchema {
  metrics: MonitoringMetric[];
  /**
   * Sampling rate for inference population.
   * "all" = every inference included.
   * Must be sufficient to achieve minimum_sample_size within the window.
   */
  sampling_rate: string;
  /**
   * Default evaluation window for metrics without their own comparison.window.
   * ISO 8601 duration or descriptive label.
   * Statistical drift metrics require at minimum P7D.
   */
  window_context: string;
}

// ---------------------------------------------------------------------------
// Lenses — stakeholder-specific views
// ---------------------------------------------------------------------------

/**
 * Stakeholder-specific view of a control.
 * All five model-assurance lens keys are required: engineering, evaluation,
 * red_team, grc, mlops.
 *
 * Key differences from securitycontrols.ai lens vocabulary:
 * - evaluation replaces detection (model validators, not detection engineers)
 * - red_team replaces architect (adversarial testers, not security architects)
 * - mlops replaces secops (ML operations, not security operations)
 */
export interface LensContent {
  /** What this control means from this stakeholder's perspective. 1-3 sentences. */
  summary: string;
  /** Specific actions this stakeholder takes to implement or maintain the control. */
  actions?: string[];
  /** Tools, platforms, or systems relevant to this lens. */
  tools?: string[];
  /** KPIs, effectiveness metrics, or monitoring signals for this stakeholder. */
  metrics?: string[];
  /** Observable indicators that the control is failing from this vantage point. */
  failure_signals?: string[];
  notes?: string;
}

/**
 * The five stakeholder lenses for the model assurance domain.
 * engineering: ML engineers, platform engineers, system architects.
 * evaluation: Independent validators, benchmark designers.
 * red_team: Adversarial testers, structured elicitation teams.
 * grc: Governance, risk, compliance officers, legal counsel.
 * mlops: ML operations engineers managing production deployment.
 */
export interface Lenses {
  engineering: LensContent;
  evaluation: LensContent;
  red_team: LensContent;
  grc: LensContent;
  mlops: LensContent;
}

// ---------------------------------------------------------------------------
// Maturity schema
// ---------------------------------------------------------------------------

/**
 * Implementation maturity tracking.
 * current: assessed state at most recent assurance cycle.
 * target: goal for the next assurance cycle.
 */
export interface Maturity {
  current: MaturityLevel;
  target: MaturityLevel;
  assessment_date?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Assurance target schema
// ---------------------------------------------------------------------------

/**
 * ML paradigm for the deployed model.
 * Used by profile trigger evaluation for general-predictive-ml and generative-ai.
 */
export type ModelParadigm =
  | 'supervised'
  | 'unsupervised'
  | 'semi-supervised'
  | 'reinforcement-learning'
  | 'generative'
  | 'time-series'
  | 'tabular'
  | 'multimodal'
  | 'hybrid'
  | 'rules-ensemble';

/** Provider type for the deployed model. */
export type ProviderType = 'first-party' | 'third-party' | 'open-weight' | 'open-source' | 'hybrid';

/** Training approach applied to the model. */
export type TrainingRegime =
  | 'supervised-learning'
  | 'unsupervised-learning'
  | 'rlhf'
  | 'online-learning'
  | 'continual-learning'
  | 'adaptive-fine-tuning'
  | 'prompt-tuning'
  | 'retrieval-augmented'
  | 'distillation'
  | 'pre-trained-frozen';

/** Output modality produced by the model. */
export type OutputModality =
  | 'text'
  | 'code'
  | 'image'
  | 'audio'
  | 'video'
  | 'structured-data'
  | 'embeddings'
  | 'decision'
  | 'action';

/** Deployment environment tier. */
export type DeploymentEnvironment =
  | 'production'
  | 'staging'
  | 'sandbox'
  | 'research'
  | 'pilot';

/** Degree of meaningful human oversight. */
export type HumanOversightMode = 'full' | 'meaningful' | 'limited' | 'none';

/**
 * EU AI Act risk classification.
 * Derived from use case, jurisdiction, actor role, and effective dates.
 * Not an intrinsic model property — the same model may be minimal-risk
 * in one context and high-risk in another.
 */
export type EuAiActClassification =
  | 'prohibited'
  | 'high-risk-annex-iii'
  | 'high-risk-product-embedded'
  | 'gpai'
  | 'gpai-systemic-risk'
  | 'minimal-risk'
  | 'excluded'
  | 'not-yet-determined';

/** Consequential decision domains. */
export type DecisionDomain =
  | 'credit'
  | 'hiring'
  | 'healthcare'
  | 'benefits'
  | 'education'
  | 'law-enforcement'
  | 'housing'
  | 'insurance'
  | 'judicial'
  | 'immigration'
  | 'government-services'
  | 'critical-infrastructure'
  | 'financial-markets'
  | 'other-consequential';

/**
 * Assurance target — the composite object that Apeiris verifies.
 *
 * A model cannot be risk-classified independently of how it is deployed
 * and used. The same model may be low-risk in internal summarization and
 * high-risk in employment screening. AssuranceTarget binds the model artifact
 * to its use case, deployment context, and affected parties, enabling correct
 * profile assignment and obligation applicability evaluation.
 *
 * Key addition relative to securitycontrols.ai: this entire object is new.
 * securitycontrols.ai does not have a concept of assurance_target because
 * agentic security controls are context-independent at the control level.
 * Model assurance controls are inherently context-dependent.
 */
export interface AssuranceTarget {
  /** Unique use case identifier in the organizational model inventory. */
  use_case_id: string;
  /** Human-readable description of the intended use case and business outcome. */
  use_case: string;
  /** Model identifiers from the model registry. Supports ensembles. */
  model_ids?: string[];
  model_version?: string;
  model_paradigm?: ModelParadigm;
  provider?: string;
  provider_type?: ProviderType;
  training_regime?: TrainingRegime[];
  output_modalities?: OutputModality[];
  data_sources?: string[];
  /** RAG corpus or retrieval index identifiers used at inference time. */
  retrieval_sources?: string[];
  /** Reference to the versioned system prompt configuration. */
  prompt_system_config_ref?: string;
  /** External tools, APIs, or systems the model can invoke. */
  tool_integrations?: string[];
  deployment_environment?: DeploymentEnvironment;
  /**
   * meaningful: human has time, information, authority, competence, and
   * a genuine ability to override — not merely nominal presence.
   */
  human_oversight_mode?: HumanOversightMode;
  end_users?: string[];
  /** Individuals or groups affected by model outputs, even without direct interaction. */
  affected_parties?: string[];
  jurisdiction?: string[];
  industry?: string[];
  eu_ai_act_classification?: EuAiActClassification;
  /** Consequential decision domains. Presence triggers high-impact-decision profile. */
  decision_domain?: DecisionDomain[];
  /** Whether the deploying organization is a supervised financial institution. */
  regulated_entity?: boolean;
  /** Total assets in USD. SR 26-2 heightened expectations apply for $30B+. */
  asset_threshold_usd?: number;
}

// ---------------------------------------------------------------------------
// Evidence artifact schema
// ---------------------------------------------------------------------------

/**
 * Cross-domain evidence artifact declaration.
 * Declares what evidence this control produces that other domain verifiers
 * are authorized to consume without re-collecting.
 *
 * producer_verifier owns collection; consumer_verifiers declare reliance.
 * This is the mechanism for cross-domain evidence sharing between
 * modelverifier.ai and securitycontrols.ai.
 */
export interface EvidenceArtifact {
  /** Canonical artifact type identifier. e.g., "model:evaluation-scorecard" */
  artifact_type: string;
  /** Apeiris domain URI that produces this artifact. e.g., "apeiris://model-assurance" */
  producer_verifier: string;
  /** Domain URIs authorized to rely on this artifact without re-collecting. */
  consumer_verifiers?: string[];
  /** Optional URI of the artifact schema if formally specified. */
  schema_ref?: string;
  /** Minimum retention period. ISO 8601 duration or regulatory label. */
  retention?: string;
}

/** Cross-domain navigation pointer to a related control in another domain. */
export interface CrossDomainReference {
  /** Apeiris URI for the target control. e.g., "apeiris://security/controls/CM-02" */
  uri: string;
  relationship:
    | 'related'
    | 'extends'
    | 'requires'
    | 'mirrored-by'
    | 'supersedes'
    | 'implements';
  /** One-sentence rationale for the cross-domain relationship. */
  note?: string;
}

/** Cross-domain navigation and evidence-sharing declarations. */
export interface CrossDomain {
  /** Navigation pointers to related controls in other Apeiris domain matrices. */
  references?: CrossDomainReference[];
  /** Evidence artifact types this control produces that other verifiers may consume. */
  evidence_artifacts?: EvidenceArtifact[];
}

// ---------------------------------------------------------------------------
// Control-level status fields
// ---------------------------------------------------------------------------

/**
 * Seven split status dimensions at the control level.
 * Per-mapping status is tracked on each frameworks[] item.
 * These control-level fields reflect the editorial and assurance state
 * of the control record as a whole.
 */
export interface StatusFields {
  source_status?: 'verified' | 'pending-verification' | 'unverified' | 'superseded' | 'disputed';
  mapping_confidence?: 'high' | 'medium' | 'low' | 'not-mapped';
  legal_status?: 'clear' | 'under-review' | 'contested' | 'counsel-required';
  control_readiness?: 'ready' | 'gap-identified' | 'not-ready' | 'waived';
  implementation_maturity?: MaturityLevel;
  assurance_result?: 'pass' | 'fail' | 'partial' | 'not-assessed' | 'exception-granted';
  evidence_status?: 'current' | 'stale' | 'missing' | 'exception';
}

// ---------------------------------------------------------------------------
// Standard clause reference
// ---------------------------------------------------------------------------

/** A normative standard clause this control was purpose-built to implement. */
export interface StandardClause {
  id: FrameworkKey;
  section: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// Control lifecycle metadata
// ---------------------------------------------------------------------------

/** A changelog entry for material changes to a control. */
export interface ChangelogEntry {
  date: string;
  summary: string;
  author?: string;
}

/** Control lifecycle and editorial metadata. */
export interface ControlMeta {
  authored_on?: string;
  authored_by?: string;
  reviewed_on?: string;
  published_on?: string;
  /** Must be "1.0.0" — the version of model-controls.schema.json. */
  schema_version?: string;
  changelog?: ChangelogEntry[];
}

// ---------------------------------------------------------------------------
// ModelControl — the root interface
// ---------------------------------------------------------------------------

/**
 * A single control record in the AI Model & System Assurance Control Matrix.
 *
 * This interface is the TypeScript representation of the JSON Schema at
 * schema/model-controls.schema.json, which is itself a composition of:
 * - apeiris-control-core/control-core.schema.json (shared base)
 * - schema/model-assurance-extension.schema.json (domain-specific extensions)
 *
 * Key differences from agentic-controls.ts (securitycontrols.ai):
 *
 * 1. Lenses: engineering, evaluation, red_team, grc, mlops
 *    vs. engineering, detection, secops, grc, architect
 *
 * 2. obligations[] array (machine-evaluable applicability predicates)
 *    vs. regulatory_scope string
 *
 * 3. capability_risk object (multidimensional)
 *    vs. capability_tier string
 *
 * 4. monitoring_schema with structured MonitoringMetric[] objects,
 *    window_context, and sampling_rate
 *    vs. detection_schema (log-centric)
 *
 * 5. 7 split status fields per mapping (source_status, mapping_confidence,
 *    legal_status, control_readiness, implementation_maturity, assurance_result,
 *    evidence_status) vs. single status field
 *
 * 6. Rich Source objects with authority, source_type, artifact_hash, license, supersedes
 *    vs. basic source references
 *
 * 7. Mapping objects with direction, rationale, uncovered_portion, source_locator,
 *    source_version, source_hash vs. simpler mapping objects
 *
 * 8. profiles[] (tiers[]) — 8 deployment profiles with machine-executable
 *    trigger_conditions vs. 3 blast-radius tiers
 *
 * 9. assurance_target object (new — no equivalent in securitycontrols.ai)
 *
 * 10. cross_domain as navigation pointers + evidence artifact pattern
 *     from shared core
 */
export interface ModelControl {
  /** JSON Schema URI for IDE validation. */
  $schema?: string;
  /** Control identifier. Format: {LAYER}-{NN}. Pattern: ^(LI|TG|EV|OA|BH|CR)-[0-9]{2}$ */
  id: string;
  layer: Layer;
  plane: Plane;
  /**
   * Short, scannable control name in title case. Maximum 80 characters.
   * Names the mechanism being established, not the threat.
   */
  name: string;
  /**
   * One-sentence plain-language summary for a non-specialist audience.
   * Maximum 200 characters. Must not assume ML or security domain knowledge.
   */
  plain: string;
  threat: {
    tags: string[];
    desc: string;
  };
  /** Normative standard clauses this control was purpose-built to implement. */
  standard?: StandardClause[];
  sources: Source[];
  implementation: {
    pattern: string;
    steps: string[];
    anti_patterns?: string[];
  };
  validation: {
    design_check: string[];
    runtime_test: string[];
    evidence: string[];
  };
  lenses: Lenses;
  maturity: Maturity;
  /**
   * Narrative on coverage gaps, partial implementation caveats, or known
   * limitations. Must be non-empty. Silence on gaps is an editorial error.
   */
  coverage_note: string;
  /**
   * Apeiris editorial thesis motivating this control's inclusion.
   * Not what the control does, but why the matrix authors believe it is
   * necessary and insufficient without it.
   */
  matrix_thesis?: string;
  thesis_type?: ThesisType;
  readiness?: Readiness;
  /**
   * Profile membership tags. Populated by the build pipeline from profiles.json.
   * Do not manually set on individual control records.
   */
  tiers?: Profile[];
  implementers?: string[];
  frameworks?: Mapping[];
  /**
   * Legal and regulatory obligations.
   * Required for controls with eu_ai_act or sr262 mappings (fit: direct or partial).
   * Each obligation carries machine-evaluable applicability predicates.
   */
  obligations?: Obligation[];
  status_fields?: StatusFields;
  cross_domain?: CrossDomain;
  /**
   * Structured monitoring specification.
   * Required for BH and CR layer controls.
   * Recommended for EV and TG controls with production monitoring implications.
   * Omit for pure governance or documentation controls.
   */
  monitoring_schema?: MonitoringSchema;
  /**
   * Multidimensional capability risk assessment. Required on all controls.
   * Enables profile trigger evaluation.
   */
  capability_risk: CapabilityRisk;
  /**
   * Optional binding to a specific deployment assurance target.
   * Used when a control is instantiated for a specific deployment rather than
   * expressed generically in the matrix.
   */
  assurance_target?: AssuranceTarget;
  meta?: ControlMeta;
}

// ---------------------------------------------------------------------------
// Integration bundle types
// ---------------------------------------------------------------------------

/** Metadata block attached to the integration bundle. */
export interface IntegrationMeta {
  /** Semver string for this bundle release. */
  version: string;
  /** ISO 8601 timestamp of bundle generation. */
  generated_at: string;
  /** Git commit SHA of the build. */
  commit_sha?: string;
  /** Total number of control records in this bundle. */
  control_count: number;
  /** Layer summary: counts of controls per layer. */
  layers: Record<Layer, number>;
  /** Schema version. */
  schema_version: string;
}

/** The full integration bundle as served from integration/controls.json. */
export interface IntegrationBundle {
  meta: IntegrationMeta;
  controls: ModelControl[];
}

/** The baseline bundle as served from integration/baseline.json. */
export interface BaselineBundle {
  meta: IntegrationMeta & { profile_ids: ['baseline'] };
  /** The 15 baseline controls: LI-01, LI-04, LI-06, TG-01, TG-05, EV-01, EV-06, EV-07, EV-09, OA-01, OA-07, BH-03, BH-05, CR-01, CR-02 */
  controls: ModelControl[];
}

// ---------------------------------------------------------------------------
// Profile definition types (from schema/profiles.json)
// ---------------------------------------------------------------------------

/**
 * A deployment profile definition.
 * Profiles filter the 54-control matrix to the controls applicable to a
 * specific deployment context. A deployment may belong to multiple profiles.
 */
export interface ProfileDefinition {
  profile_id: Profile;
  name: string;
  description: string;
  version: string;
  trigger_conditions: {
    all?: ApplicabilityCondition[];
    any?: ApplicabilityCondition[];
    none?: ApplicabilityCondition[];
  };
  required_controls: string[];
  recommended_controls: string[];
  not_applicable_controls?: string[];
  not_applicable_rationale?: string;
  profile_specific_notes?: Record<string, string>;
  notes?: string;
}
