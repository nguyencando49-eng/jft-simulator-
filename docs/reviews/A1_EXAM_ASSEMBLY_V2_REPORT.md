# A1 Exam Assembly V2 Report

Generated: 2026-09-08T12:43:14.502Z

The 447 canonical machine-accepted questions were not modified. The fix is in exam assembly: each exam stores a deterministic choice permutation, a canonical snapshot, and a displayed snapshot with the remapped answer index used by scoring.

## Layer audit

- QUESTION_BANK layer: canonical choices and canonical answer index remain immutable.
- EXAM_ASSEMBLY layer: selects questions by section with exposure/KU/task/template penalties, then allocates balanced target answer positions.
- EXAM_INSTANCE layer: stores `canonicalSnapshot`, `choicePermutation`, displayed `snapshot.choices`, and displayed `snapshot.answer`.
- SCORING layer: scores against displayed `snapshot.answer`; replay evidence links it back to the canonical answer.

## Before vs after answer positions

| Position | Before | After |
|---|---:|---:|
| A | 3649 | 1300 |
| B | 551 | 1300 |
| C | 468 | 1200 |
| D | 332 | 1200 |

## Simulation result

- Input bank: **447**
- 100 exams before: **0 PASS / 100 FAIL**
- 100 exams after: **100 PASS / 0 FAIL**
- Scoring mismatches: **0**
- Choice-order-locked items: **17**
- Duplicate-within-form count: **0**
- Source mutations: **0**

## Coverage and exposure

- CE requested per exam: **12**
- CE available: **41**
- CE total slots across 100 exams: **1200**
- Minimum recommended CE bank size at <= 20% exposure over 100 forms: **60**
- Question exposure risk count: **41**
- CE exposure risk count: **41**
- Template exposure risk count: **41**

| High CE exposure sample | Forms | Rate |
|---|---:|---:|
| A1-F200-CE-026-M1 | 30 | 0.3 |
| A1-F200-CE-033-M1 | 30 | 0.3 |
| A1-F200-CE-042-R1 | 30 | 0.3 |
| A1-F400-CO-021-R1 | 30 | 0.3 |
| A1-F600-CO-021-R1 | 30 | 0.3 |
| A1-F500-CO-021-R1 | 30 | 0.3 |
| A1-F200-CE-019-R1 | 30 | 0.3 |
| A1-F200-CE-013-M1 | 30 | 0.3 |
| A1-F200-CE-035-M1 | 30 | 0.3 |
| A1-F200-CE-034-M1 | 30 | 0.3 |
| A1-F200-CE-010-M1 | 30 | 0.3 |
| A1-F200-CE-027-M1 | 30 | 0.3 |

Coverage blockers: **INSUFFICIENT_CE_BANK_COVERAGE, QUESTION_EXPOSURE_RISK**

Final classification: **ASSEMBLER_FIXED_BANK_COVERAGE_BLOCKED**
