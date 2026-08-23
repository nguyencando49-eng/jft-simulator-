# QA4 — Curriculum Grounding Judge

## Purpose and pipeline position

QA4 determines the exact knowledge needed to solve a question and whether every essential item is supported by approved curriculum evidence.

`Generator → Q0 → QA1 → QA2 → QA3 → QA4 Curriculum Grounding → Question QA Gate → Human Review`

QA4 is not an answer oracle, Japanese-naturalness judge, difficulty/JFT-format judge, generator, or fixer. Its evidence is stored separately as `FactoryCandidate.curriculumGroundingQa`.

## Required, supporting, and incidental knowledge

The provider classifies vocabulary, kanji, grammar, expressions, pragmatic functions, cultural/background knowledge, task strategy, and other knowledge as:

- `REQUIRED`: necessary to understand the prompt/evidence, distinguish choices, or derive the answer;
- `SUPPORTING`: affects processing or option quality but is not essential;
- `INCIDENTAL`: replaceable surface context that does not determine the answer.

New names, dates, times, prices, numbers, simple places, and fictional organizations are normally incidental. Reading/listening facts supplied to the learner do not have to be memorized curriculum knowledge; the language needed to understand those facts does.

## Curriculum authority

Only persisted `KnowledgeUnit.status === "approved"` evidence authorizes knowledge. Authority is also scoped to the target level or lower (`A1 < A2.1 < A2.2`), so an A2.2 unit cannot authorize required knowledge in an A1 question. Draft, review, rejected, higher-level, static/unverified catalog content, generator reasoning, and unsupplied inference are excluded from provider authority.

Every support claim carries KnowledgeUnit IDs and SourceChunk IDs where available. Application validation rejects fabricated IDs, non-approved IDs, and chunks that do not belong to both the claimed units and their SourceDocument. Missing authority and partial/ambiguous mappings without trace IDs make provenance incomplete.

## Retrieval behavior

QA4 independently enumerates persisted Source Documents and their KnowledgeUnits. Intended plan units receive highest priority; same-source and question/Can-do/topic-relevant approved units are then ranked independently. Level scoping is a curriculum-boundary rule, not a QA4 difficulty judgment.

- If the approved catalog fits `CURRICULUM_GROUNDING_MAX_UNITS` (default 100), QA4 sends the complete approved catalog and may treat absence as negative evidence.
- If the catalog exceeds the cap or repository enumeration is incomplete, only intended plus relevant evidence is sent and the search is marked incomplete.
- Draft/rejected intended IDs appear as missing intended evidence; their content is never sent as authority.

This is the negative-evidence rule: absence from an incomplete subset cannot prove `OUT_OF_CURRICULUM`. Such cases become `CURRICULUM_SEARCH_INCOMPLETE` and REVIEW, never an absence-based hard FAIL.

## Provider and deterministic policy

The vendor-neutral `CurriculumGroundingProvider` has deterministic/mock and HTTP implementations. The versioned prompt is `JFT_CURRICULUM_GROUNDING_V1`. The bounded mock is deliberately conservative and LOW-confidence: unknown quoted targets and unrecognized kanji compounds can only produce REVIEW/FAIL, never an unsupported automatic PASS. Production semantic mapping uses the HTTP provider plus human calibration.

The provider independently extracts knowledge and maps semantic support. It does not receive QA1–QA3 verdicts, answer/explanation, or generator reasoning. Application code strictly validates the analysis and deterministically recalculates:

- required/supported/partial/unsupported counts;
- coverage ratio from REQUIRED items only;
- outside knowledge;
- provenance completeness;
- hard-fail policy;
- normalized PASS/REVIEW/FAIL and release status.

Provider-supplied policy cannot override application policy.

## Hard failures

With sufficient approved-curriculum retrieval, these essential unsupported conditions hard-fail:

- `REQUIRED_GRAMMAR_UNSUPPORTED`;
- `REQUIRED_VOCABULARY_UNSUPPORTED`;
- `REQUIRED_KANJI_UNSUPPORTED`;
- `REQUIRED_EXPRESSION_UNSUPPORTED`;
- `EXTERNAL_KNOWLEDGE_REQUIRED`;
- `CURRICULUM_CONTRADICTION`;
- `OUT_OF_CURRICULUM`.

An unsupported advanced distractor also produces `DISTRACTOR_OUT_OF_CURRICULUM`; it becomes hard-failing when understanding it is required for solving/elimination.

## Review conditions

QA4 returns REVIEW for partial or ambiguous support, missing/insufficient approved evidence, incomplete search, uncertain mapping, incomplete provenance, low confidence, invalid provider output, or provider failure. Technical failure can never become PASS.

All non-PASS results remain human-reviewable, but only PASS is eligible to proceed automatically.

## Provenance and persistence

The preferred trace is:

`Question → required knowledge → approved KnowledgeUnit → SourceChunk → SourceDocument`

Factory source context supplies intended plan/source IDs during generation; full `QuestionProvenance` is written later by the existing Source Factory. QA4 preserves per-claim unit/chunk IDs, evaluated unit IDs, retrieval strategy, provider/model/prompt version, and timestamp inside the existing Factory job JSON payload. No QA result table migration is required.

Migration `0007_factory_qa_evidence_rls.sql` enables RLS on `factory_jobs`, whose payload contains internal answers and QA evidence. Server-side service-role repository access remains supported; no browser policy is added.

## Admin and Candidate boundaries

Admin Factory review shows verdict, required coverage, confidence, retrieval/provenance status, knowledge mappings, outside knowledge, issues, and the KnowledgeUnit → SourceChunk trace without raw JSON by default.

Active Candidate APIs use an explicit allowlist. QA4 reasoning, KnowledgeUnit/SourceChunk IDs, answer evidence, and all other internal gate data remain excluded.

## Tests

Synthetic tests cover complete support, unsupported grammar/vocabulary/kanji/expression, safe names/numbers/dates, incidental versus required unknown words, hidden versus learner-supplied legal facts, passage/audio facts, advanced distractors, partial support, provenance gaps, cross-source chunk rejection, incomplete and level-scoped retrieval, low confidence, invalid/failing providers, approved-only authority, capped retrieval, HTTP input boundaries, QA1–QA3 integration, all three Factory checkpoints (generation, post-TTS, pre-approval), real Question Bank approval blocking, and Candidate evidence isolation.

## Known limitations

The deterministic mock recognizes a bounded set of Japanese patterns and curriculum strings. It deliberately reports LOW confidence, detects unknown quoted expressions/kanji and kanji compounds conservatively, and therefore cannot auto-PASS when exhaustive vocabulary/kanji/expression coverage is uncertain. Legal or cultural facts explicitly supplied in learner-visible text are not treated as hidden background knowledge. Production semantic equivalence and exhaustive knowledge extraction require a capable independent HTTP model plus human calibration. There is no embedding/vector retrieval yet; large catalogs therefore use a conservative lexical relevance subset and REVIEW-safe incomplete-search policy.
