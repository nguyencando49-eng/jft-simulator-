# QA4 Curriculum Grounding — Integration Plan

## Existing architecture

- QA1, QA2, and QA3 are separate evidence fields on `FactoryCandidate`; Factory jobs are persisted as complete JSON payloads by both Memory and Supabase repositories.
- The three current gates are rerun at initial generation, after TTS refresh, and immediately before Question Bank approval.
- `KnowledgeUnit.status` is `draft | review | approved | rejected`. Only `approved` units are authoritative.
- A Question Plan records intended KnowledgeUnit IDs. Factory `sourceContext` carries the source, SourceChunk IDs, intended KnowledgeUnit IDs, and Question Plan ID. `QuestionProvenance` separately preserves the Question → KnowledgeUnit → SourceChunk → Source chain.
- Active Candidate questions are produced through an explicit field allowlist, so Factory QA evidence is not candidate-visible.

## QA4 extension point

Add `curriculumGroundingQa` as a fourth independent candidate evidence field and run it immediately after QA3 at all three existing checkpoints. QA1–QA3 remain unchanged. A QA4 hard failure sets aggregate Factory QA to failed and blocks approval; REVIEW remains an explicit human-review state.

The historical `curriculumQa` payload and `runCurriculumQa` helper are a shallow lexical heuristic. They remain readable for backward compatibility and existing coverage tests, but the Factory will stop invoking that helper as a production gate so that two contradictory curriculum gates do not run in parallel. QA4 becomes the specialized production curriculum gate.

## Required-knowledge flow

1. Build a specialized question input containing learner-visible content, section/category/level, intended Can-do/topic, and listening script where applicable.
2. Retrieve only approved KnowledgeUnits at the target level or lower. Include intended units, same-source neighbors, and independently relevant approved units.
3. For a small approved catalog, send the complete catalog. For a larger catalog, cap evidence and mark retrieval incomplete.
4. Provider independently extracts REQUIRED, SUPPORTING, and INCIDENTAL knowledge and maps semantic support.
5. Strict application validation verifies every claimed KnowledgeUnit and SourceChunk ID against supplied approved evidence.
6. Deterministic post-processing calculates coverage and applies FAIL/REVIEW/PASS policy.

## Negative-evidence policy

- Unsupported essential knowledge may hard-fail only when the approved-curriculum search is complete.
- If retrieval is capped, failed, or otherwise incomplete, unsupported mappings produce `CURRICULUM_SEARCH_INCOMPLETE` and REVIEW.
- No approved evidence, non-approved intended units, partial/ambiguous support, low confidence, and incomplete provenance produce REVIEW rather than an invented PASS or false FAIL.

## Retrieval and provenance

- Enumerate Source Documents through the repository and scan their KnowledgeUnits locally.
- Filter authority to `status === approved` before provider input.
- Prefer eligible intended IDs, then score independent relevance against question/topic/Can-do, while respecting a configurable evidence cap. Higher-level units are not authority for a lower-level question.
- Load only SourceChunks referenced by selected units.
- Preserve per-knowledge mapping IDs plus retrieval metadata, searched source IDs, and missing intended IDs in QA4 evidence.

## Provider and validation

- Add vendor-neutral `CurriculumGroundingProvider` with deterministic/mock and HTTP implementations.
- Version prompt and audit metadata as `JFT_CURRICULUM_GROUNDING_V1`.
- Validate enums, roles, support states, coverage consistency, approved IDs, provenance IDs, evidence text, and normalized release policy.
- Provider never sees QA1–QA3 judgments and never rewrites a question.

## Tests and UI

- Add adversarial unit tests for grammar, vocabulary, kanji, expressions, external knowledge, distractors, safe names/numbers, incidental content, passage/audio facts, partial support, provenance, retrieval completeness, low confidence, invalid output, and provider failure.
- Add an integration assertion that QA1–QA3 PASS plus QA4 FAIL blocks aggregate approval.
- Extend Candidate projection security coverage for QA4 evidence.
- Add a compact Admin QA4 panel with coverage, grouped knowledge mappings, outside knowledge, provenance, and retrieval status; raw JSON remains hidden.
