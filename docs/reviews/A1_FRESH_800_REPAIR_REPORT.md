# A1 Fresh 800 Repair Report

Generated: 2026-09-08T04:55:54.227Z

No source pack was overwritten. No item was approved, published, staged, committed, or pushed. Every candidate remains `PENDING`.

## QA1 safety check on 391 KEEP candidates

| QA1 state | Count |
|---|---:|
| PASS | 76 |
| REVIEW | 224 |
| FAIL | 91 |

| QA1 FAIL classification | Count |
|---|---:|
| REAL_STRUCTURAL_DEFECT | 0 |
| QA1_POLICY_FALSE_POSITIVE | 91 |
| SERIALIZATION_DEFECT | 0 |
| SCHEMA_DEFECT | 0 |
| METADATA_ONLY | 0 |
| UNKNOWN | 0 |

Raw QA1 reason occurrences: `ANSWER_KEY_MISMATCH` 2, `CAN_DO_MISMATCH` 35, `CATEGORY_MISMATCH` 45, `DUPLICATE_HIGH` 7, `INSUFFICIENT_EVIDENCE` 74, `LEVEL_MISMATCH` 7, `OUT_OF_CURRICULUM` 56. Every QA1 FAIL has an item-level override recommendation and cross-gate evidence in the repair manifest.

## Repair execution

| Phase | Attempted | Succeeded | Preserved canonical | Blocked |
|---|---:|---:|---:|---:|
| REALIGN_METADATA | 278 | 278 | 0 | 0 |
| REVISE_PRESENTATION | 66 | 66 | 0 | 0 |
| REAUTHOR | 65 | 64 | 1 | 0 |

The earlier duplicate `A1-F500-CO-011` was preserved; only later `A1-F600-CO-011` was reauthored. Deterministic validation passed for all 800 resulting candidates.

## Duplicates

| State | Before | After |
|---|---:|---:|
| Exact | 0 | 0 |
| Near | 2 | 0 |

## QA1–QA7 before/after

| Gate | Before P/R/F/T | After P/R/F/T |
|---|---:|---:|
| QA1 | 97/385/318/0 | 119/420/261/0 |
| QA2 | 316/453/31/0 | 312/488/0/0 |
| QA3 | 800/0/0/0 | 800/0/0/0 |
| QA4 | 0/800/0/0 | 0/800/0/0 |
| QA5 | 0/589/211/0 | 189/611/0/0 |
| QA6 | 419/380/1/0 | 415/384/1/0 |
| QA7 | 667/131/2/0 | 752/48/0/0 |

QA4 catalog-grounded REVIEW and QA5 catalog/reference limitations are retained as limitations rather than converted into content failures. QA2 retains raw oracle results and separately records the effective status and audit classification.

## Final human-review queue

| Group | Count |
|---|---:|
| READY_FOR_HUMAN_GOLD_REVIEW | 49 |
| NEEDS_HUMAN_JUDGMENT | 751 |
| BLOCKED_CONTENT | 0 |
| BLOCKED_METADATA | 0 |
| BLOCKED_QA_PIPELINE | 0 |

- Unresolved content defects: **0**
- Unresolved metadata defects: **0**
- Unresolved QA technical failures: **0**
- QA4 persistence limitation: **800** items still lack persisted APPROVED KnowledgeUnit/SourceChunk evidence.
- QA5 catalog mapping limitations: **295**; QA input-binding reviews: **6**.

## Files created or updated by this repair execution

- `scripts/execute-a1-fresh-800-repairs.ts`
- `data/reviews/a1-fresh-800-repair-manifest-v1.json`
- `data/production/a1-fresh-800-repaired-candidates-v1.json`
- `data/qa/a1-fresh-800-post-repair-qa-v3.json`
- `data/reviews/a1-fresh-800-final-human-review-queue.json`
- `docs/reviews/A1_FRESH_800_REPAIR_REPORT.md`
