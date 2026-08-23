# QA7 — Originality & Duplicate Judge

## Purpose

QA7 determines whether a generated practice item is an original assessment derived from curriculum knowledge rather than copied source wording, and whether it duplicates the same learner decision already present in its batch or Question Bank.

QA7 is a judge, not a generator or fixer. It does not decide answer correctness, Japanese naturalness, curriculum authority, JFT alignment, difficulty, or audio quality.

## Pipeline position

QA7 runs after QA6 at initial Factory generation, after Listening TTS refresh, and immediately before approval:

`Q0 → QA1 → QA2 → QA3 → QA4 → QA5 → QA6 → QA7 → Human review`

Evidence is stored independently as `FactoryCandidate.originalityDuplicateQa`. A QA7 failure blocks Question Bank admission and cannot be overridden by earlier passes.

## Comparison domains

QA7 compares learner-visible candidate content with:

- referenced SourceChunk text;
- every other generated candidate in the same Factory batch;
- existing Question Bank items.

Source and curriculum vocabulary may overlap legitimately. Topic, grammar, vocabulary, or Can-do similarity alone is not proof of copying. QA7 looks for retained wording, passage structure, situation, learner decision, and answer-choice pattern.

## Versioned simulator policy

`ORIGINALITY_DUPLICATE_POLICY_V1` and `NORMALIZED_TRIGRAM_JACCARD_PATTERN_V1` are **SIMULATOR DESIGN DECISIONS**, not official JFT rules.

V1 calculates:

- normalized character-trigram Jaccard similarity;
- containment similarity for copied fragments inside longer source chunks;
- structural-pattern similarity after masking names and numbers;
- exact normalized equality;
- provider-classified semantic relationship for shortlisted comparisons.

Thresholds are centralized in the policy object. Exact/high-confidence source copying and high bank/batch duplicates hard-fail. Medium risk and uncertain evidence require explicit human review.

## Provider boundary

`OriginalityDuplicateProvider` supports deterministic mock and provider-neutral HTTP implementations. Application code retrieves and scores the corpus before the provider classifies only supplied comparison IDs.

The provider request excludes:

- declared answer key;
- explanation;
- QA1–QA6 evidence;
- replacement or rewritten content instructions.

Strict validation rejects fabricated IDs, missing/duplicate classifications, unknown enums, extra root fields, or empty evidence. Invalid output and provider failure produce technical REVIEW, never PASS.

## Deterministic release policy

Application code, not free-form model text:

- combines deterministic and semantic risks;
- applies source/batch/bank thresholds;
- calculates summary risks;
- applies hard-fail/review policy;
- binds REVIEW acknowledgement to content, corpus evidence, policy, algorithm, and prompt versions.

A newly produced or changed REVIEW must be inspected before approval. QA7 never rewrites the item.

## Persistence, Admin and security

Existing `factory_jobs.payload` JSON stores the complete QA7 result, comparisons without full source text, provider/model, versions, timestamp and review binding. No duplicate QA table is introduced.

Admin sees a separate QA7 panel containing source/batch/bank risk, maximum similarity, comparison metrics, evidence, issues and release blockers. Candidate projections use an explicit allowlist and exclude QA7 evidence, source IDs, comparison evidence and provider metadata.

## Metrics

The Content Production API prepares nullable, denominator-aware metrics for:

- source-copy failure rate;
- bank duplicate failure rate;
- batch duplicate failure rate;
- originality review rate;
- evaluable and technical-review sample counts.

Technical provider failures are excluded from content-defect denominators.

## Tests

Synthetic tests cover exact source copying, superficial name/number substitution, distinct shared-topic content, batch/bank duplicates, medium review, missing source evidence, strict provider validation, provider failure, blinding, preservation of QA1–QA6 evidence, metrics, all Factory checkpoints, approval blocking and Candidate non-disclosure.

## Known limitations

- V1 semantic comparison is limited to lexically shortlisted candidates; embeddings/pgvector are the planned migration path for large-bank semantic retrieval.
- Structural masking is deliberately conservative and does not identify every Japanese proper name or paraphrase.
- Human originality review remains required for medium-risk and low-confidence cases.
- Direct Question Bank imports outside Factory still do not run the complete QA1–QA7 chain.
