# QA5 JFT Alignment — Integration Plan

## Current architecture

- Factory candidates preserve QA1, QA2, QA3, and QA4 as separate evidence fields inside the existing persisted `FactoryJob` payload.
- The Factory reruns specialized gates at initial generation, after Listening TTS refresh, and immediately before Question Bank approval.
- `lib/server/content-taxonomy.ts` is the canonical machine taxonomy: lower-snake `SectionId` values and the category lists in `JFT_CATEGORIES`.
- Declared section/category/Can-do come from `FactoryRequest` and `QuestionPlanItem`. The plan/source objective is the nearest declared task-purpose evidence.
- Active Candidate APIs use the explicit `toCandidateQuestion` allowlist; internal Factory evidence is Admin-only.

## Reference authority

The repository authority order is:

1. `docs/jft-spec/JFT_OFFICIAL_SPEC.md` and its Japan Foundation sources;
2. `docs/jft-spec/AGENT_RULES.md`;
3. rules explicitly labelled as simulator design decisions.

The official reference snapshot currently recorded by the repository was verified on 2026-08-17. It supports the four sections, category families, practical-communication purpose, and A1–A2 Can-do philosophy. Exact lower-snake identifiers, detailed boundary heuristics, construct-validity policy, scoring, thresholds, and modality-dependency rules are simulator design decisions.

QA5 will persist an official-reference snapshot version and a separate simulator-taxonomy version. It will return `REFERENCE_EVIDENCE_INCOMPLETE` and REVIEW whenever repository evidence cannot justify certainty.

## Known metadata gaps

- There is no machine-readable official Can-do catalogue; Can-do is free text.
- There is no first-class `taskType` taxonomy. QA5 will use the plan/source generation objective when present and the declared canonical category as a documented fallback. It will not claim either is official terminology.
- `QuestionRecord.prompt` combines Reading material and question text. Passage dependency can be inferred conservatively, but not perfectly.
- The core Question schema has no visual asset/descriptor. Text that requires an absent visual becomes `ALIGNMENT_UNASSESSABLE_MISSING_VISUAL` REVIEW.
- Existing legacy tags contain noncanonical aliases, and the mock planner currently produces coarse skill labels as categories. QA5 will surface invalid/missing declarations rather than silently remap them as official categories.

## Independent two-stage design

### Stage A — blinded classification

`JftAlignmentProvider.classify` receives only learner-visible instruction, prompt/question text, choices, optional QA audio script, optional visual-presence evidence, and the versioned taxonomy/reference definitions. It does not receive:

- declared section/category/Can-do/task purpose;
- topic;
- answer key or explanation;
- generator reasoning;
- QA1–QA4 evidence.

It returns an analysis-only classification: actual section/category/Can-do/assessment target/task type, required modality, modality dependency, communicative purpose, real-world validity, construct underrepresentation, construct-irrelevant clues, uncertainty, and evidence.

### Stage B — deterministic comparison

Application code validates category/section consistency and then compares the independent result against the declared target. It calculates all alignment states, scores, issues, hard-fail overrides, verdict, and release status. Provider-supplied policy cannot approve a candidate.

## Pipeline integration

Add `FactoryCandidate.jftAlignmentQa` and run QA5 immediately after QA4 at all three checkpoints:

`Q0 → QA1 → QA2 → QA3 → QA4 → QA5 → Human Review`

A QA5 FAIL/hard fail sets aggregate Factory QA to failed and has an explicit pre-approval guard. REVIEW remains separately inspectable and requires explicit human handling under the existing Factory review policy.

## Provider and persistence

- Add vendor-neutral deterministic/mock and HTTP providers.
- Prompt version: `JFT_ALIGNMENT_V1`.
- Persist provider, model, prompt version, question ID, official-reference version, simulator-taxonomy version, and timestamp in the existing Factory job JSON payload.
- No new QA result table or migration is required; existing `factory_jobs` RLS protects the evidence.

## Deterministic policy

Hard fail confident critical section/category/Can-do mismatch, Listening or Reading not being required, an invalid assessment target, or a question that does not measure its declared skill. Review partial/weak/insufficient alignment, weak dependency, incomplete references, uncertain/multiple categories, construct underrepresentation, missing visual evidence, low confidence, invalid provider output, or provider failure.

The 100-point weights and 90/80 thresholds are simulator design decisions. Critical mismatches override every numeric score.

## Admin, security, and metrics

- Add a separate Admin QA5 panel after QA4 with declared vs detected target, Can-do match, modality dependency, task validity, construct evidence, and expandable issues.
- Extend Candidate projection regression coverage with secret QA5 fields/provider metadata.
- Derive the requested section/category/Can-do/dependency/underrepresentation/review metrics from persisted QA5 evidence without building a new analytics subsystem.

## Test plan

- Fixtures A–F from the task plus adversarial station-dialogue, shop announcement, decorative passage/audio, semantic Can-do paraphrase, same-topic/different-competency, multiple-category, missing reference/visual, low-confidence, invalid-output, and provider-failure cases.
- Metamorphic blinding test: identical learner-visible content under different declarations must produce identical independent classification.
- Cross-QA test: QA1–QA4 PASS plus QA5 FAIL blocks aggregate QA.
- Checkpoint tests for initial generation, post-TTS refresh, and pre-approval Question Bank blocking.
- Candidate evidence-isolation and metrics tests.
- Full typecheck, unit/integration suite, production build, and diff checks.

## Scope boundary

QA5 will not alter QA1–QA4, calibrate difficulty, judge answers/naturalness/curriculum/originality, rewrite questions, create QA6, or expand direct Admin import routes into a second QA pipeline. Direct Question Bank import bypassing Factory remains a documented pre-existing limitation.
