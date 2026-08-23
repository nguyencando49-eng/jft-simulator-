# QA7 Originality & Duplicate — implementation plan

## Existing architecture

- Factory candidates already run deterministic batch, Question Bank and source-text similarity checks.
- Character trigram Jaccard comparison is centralized in `duplicate-detection.ts`; source/bank/batch comparison is centralized in `source-similarity.ts`.
- QA1–QA6 persist independent evidence inside the existing `factory_jobs.payload` JSON and rerun at generation, post-TTS refresh and pre-approval.
- Source provenance is available through `FactoryJob.sourceContext`; the Question Bank and same-batch candidates are available from the repository/job.

## Integration

QA7 will extend the existing Factory pipeline after QA6. It will replace the release authority of the legacy ad-hoc source/bank/batch issue mutations while reusing their normalization and Jaccard primitives. Historical issue codes remain readable.

At all three Factory checkpoints QA7 will receive:

- learner-visible candidate content;
- source chunks referenced by the Factory job;
- all other candidates in the same batch;
- current Question Bank questions.

Evidence will be stored separately as `FactoryCandidate.originalityDuplicateQa`. QA1–QA6 evidence will not be modified or trusted as originality evidence.

## Policy

- exact normalized copies and high-confidence near copies are hard failures;
- superficial name, number or schedule substitutions are compared with a normalized structural pattern;
- medium similarity and uncertain semantic relationships require explicit human review;
- shared curriculum vocabulary/topic alone is not proof of copying;
- technical/provider failure cannot become PASS;
- thresholds and algorithms are versioned simulator design decisions, not official JFT rules.

## Provider boundary

Deterministic application code retrieves and scores comparisons. A vendor-neutral provider may classify only the shortlisted relationships. Provider IDs must reference supplied comparisons, and application code determines the final verdict. The HTTP request excludes answer keys, explanations and QA1–QA6 evidence.

## Persistence and security

Existing Factory JSON persistence is sufficient; no duplicate QA table is added. The Admin Factory panel will show QA7 separately. Candidate projections remain allowlisted and must exclude QA7 evidence and comparison text.

## Tests

Tests will cover source copying, superficial substitutions, batch/bank duplicates, shared-vocabulary false positives, threshold review, provider validation/failure, all three Factory checkpoints, approval blocking, review acknowledgement, persistence, Admin evidence and Candidate non-disclosure.

## Production safety discovered during smoke test

Production currently honors disabled authentication and exposes a default Admin context. The smallest safe change is to forbid disabled authentication when `NODE_ENV=production`; production without Supabase configuration must fail closed.
