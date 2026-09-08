# A1 Fresh 800 Zero-Human QA Report

Generated: 2026-09-08T11:08:02.024Z

The pipeline made no Gold or publish decision. It persisted machine-derived curriculum evidence, reloaded and hash-verified it, then applied the strict machine acceptance contract. No final REVIEW or PENDING state exists.

## Final result

- Total processed: **800**
- MACHINE_ACCEPTED: **447**
- AUTO_REJECTED: **353**
- Auto-repaired successfully: **313**
- Auto-repair failed: **353**
- Acceptance rate: **55.87%**
- Average machine confidence: **0.8021**
- Minimum accepted machine confidence: **1**

## By section

| Section | Processed | Accepted | Rejected |
|---|---:|---:|---:|
| script_vocabulary | 200 | 154 | 46 |
| conversation_expression | 200 | 41 | 159 |
| listening | 200 | 138 | 62 |
| reading | 200 | 114 | 86 |

## Final QA results

| Gate | PASS | FAIL |
|---|---:|---:|
| QA1 | 800 | 0 |
| QA2 | 487 | 313 |
| QA3 | 800 | 0 |
| QA4 | 800 | 0 |
| QA5 | 800 | 0 |
| QA6 | 719 | 81 |
| QA7 | 775 | 25 |

## Repair and rejection diagnostics

- Answer-uniqueness / semantic-consensus failures: **313**
- Metadata auto-realign count: **508**
- Duplicate repair attempts: **25**

| Most common rejection reason | Count |
|---|---:|
| ADVERSARIAL_SEMANTIC_UNRESOLVED | 270 |
| SEMANTIC_UNRESOLVED | 204 |
| ANSWER_NOT_UNIQUE | 91 |
| DISTRACTOR_IMPLAUSIBLE | 81 |
| PROMPT_TARGET_IMPLICIT | 32 |
| NEAR_DUPLICATE | 25 |
| SECOND_PLAUSIBLE_ANSWER | 11 |
| ANSWER_KEY_MISMATCH | 6 |

## Contract notes

- QA1 structural findings are blocking; policy-only findings are retained as non-blocking evidence.
- QA2 has only PASS/FAIL. An unresolved interpretation is a FAIL and cannot be accepted.
- QA4 PASS requires both checked-in catalog resolution and a persisted evidence record whose catalog payload and curriculum source-file hashes survive reload verification. Evidence uses `MACHINE_APPROVED_CATALOG_EVIDENCE`, not human APPROVED or Gold.
- QA5 has only PASS/FAIL after deterministic metadata normalization.
- QA6 and QA7 have only PASS/FAIL. Template similarity alone is permitted; exact and semantic near duplicates are blocked.
- Acceptance requires both semantic Judge A and adversarial Judge B, every hard gate, and machineConfidence >= 0.98.

## Outputs

- `data/qa/a1-fresh-800-machine-acceptance-report.json`
- `data/qa/a1-fresh-800-machine-evidence.json`
- `data/production/a1-fresh-800-machine-accepted-v1.json`
- `data/reviews/a1-fresh-800-auto-rejected-v1.json`
- `data/production/a1-fresh-800-machine-grounding-evidence-v1.json`
- `docs/reviews/A1_FRESH_800_ZERO_HUMAN_QA_REPORT.md`
