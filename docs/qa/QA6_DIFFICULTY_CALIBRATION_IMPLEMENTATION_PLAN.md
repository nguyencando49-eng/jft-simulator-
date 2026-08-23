# QA6 Difficulty Calibration — Implementation Plan

## Current extension point

QA evidence is persisted independently inside each `FactoryCandidate` in the existing `factory_jobs.payload` JSON. QA6 will add `difficultyCalibrationQa` without replacing QA1–QA5 or adding a parallel pipeline.

QA6 will run after QA5 at the same three Factory checkpoints:

1. initial candidate generation;
2. post-TTS QA refresh;
3. pre-approval revalidation.

A QA6 FAIL blocks Question Bank admission. A newly produced or materially changed REVIEW must return to Admin review before approval.

## Content-based calibration

Stage A is blinded to the declared target level. A provider receives learner-visible content, choices, section/modality evidence, and a versioned calibration rubric. It returns only a validated multidimensional profile, reasoning depth, distractor strength, confidence, and evidence.

Stage B is deterministic application code. It calculates the normalized score, maps the score to the canonical repository levels (`A1`, `A2.1`, `A2.2`), compares it with the declared level, applies tolerance/hard-fail rules, and constructs the persisted verdict.

The versioned simulator policy centralizes weights, score boundaries, mismatch tolerance, empirical sample thresholds, and response-time bounds. These are simulator design decisions, not official JFT scoring.

## Empirical evidence

`QuestionPerformanceAggregator` will remain separate from the QA judge. It aggregates submitted-session correctness against frozen `ExamVersion` snapshots and accepts optional response-time observations for future telemetry.

The current session schema does not store per-question timestamps. QA6 will therefore return null response-time statistics for repository-derived observations rather than infer them from whole-session duration. Tiny samples never override the content estimate. Correct-rate disagreement creates human review evidence and never relabels a question automatically. IRT is out of scope.

## Persistence and security

No new QA table is required. Provider/model/prompt/calibration versions, normalized evidence, empirical aggregates, and review binding remain in the Admin-only Factory payload protected by existing RLS and route authorization. Candidate projection continues to use an explicit allowlist and will be regression-tested against QA6 leakage.

## Admin and metrics

The existing Factory review UI will receive a separate QA6 panel showing declared/estimated level, internal score, profile dimensions, reasoning depth, empirical status, issues, and audit versions. Content-production metrics will expose sample counts and nullable mismatch/review/calibration rates so missing evidence is not shown as a false green.

## Verification

Tests will cover multidimensional fixtures, score boundaries, declared-level blinding, strict provider validation, Listening/Reading load, distractor strength, empirical sample safety, response-time outlier filtering, calibration disagreement, all three Factory checkpoints, QA1–QA5 preservation, approval blocking/review acknowledgement, Admin-only evidence, full typecheck, and production build.
