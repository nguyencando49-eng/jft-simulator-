# A1 Fresh 800 Processing Report

Generated: 2026-09-07T14:38:01.884Z

No source or Gold item was edited. No candidate was approved or published; all remain `PENDING`.

## Coverage

| Metric | Count |
|---|---:|
| Source files found | 4/4 |
| Total loaded | 800 |
| Total valid schema | 800 |
| Preflight PASS | 572 |
| Total processed | 800 |
| Items queued for human review | 800 |

Sources:
- `data/CONTROLLED_A1_FRESH_200_V3.json` — 200 (script_vocabulary=50, conversation_expression=50, listening=50, reading=50), SHA-256 `31b6e1e984073b0d8232b7b2b0e86135e56d7f122fd5057c122b73dcc2839456`
- `data/CONTROLLED_A1_FRESH_200_V4.json` — 200 (script_vocabulary=50, conversation_expression=50, listening=50, reading=50), SHA-256 `5100042ebbb59b2c657b333f578591f1695f33403c419e68f290bdd40ae2b40f`
- `data/CONTROLLED_A1_FRESH_200_V5.json` — 200 (script_vocabulary=50, conversation_expression=50, listening=50, reading=50), SHA-256 `4ffe69afdfe38caf7a9332d4bfd99437b4648677179b7101f0427492c11a5144`
- `data/CONTROLLED_A1_FRESH_200_V6.json` — 200 (script_vocabulary=50, conversation_expression=50, listening=50, reading=50), SHA-256 `f0556f88277083e8cc82df0cbf812cdd919dc10fb9b2ec623f11b935981c4379`

## Decisions

| Decision | Count |
|---|---:|
| KEEP_CANDIDATE | 0 |
| QA_PIPELINE_ONLY | 138 |
| REVISE_PRESENTATION | 0 |
| REVISE_DISTRACTORS | 0 |
| REALIGN_METADATA | 59 |
| REAUTHOR | 603 |
| REJECT | 0 |

## Duplicate

| Classification | Count |
|---|---:|
| UNIQUE | 624 |
| NEAR_DUPLICATE | 45 |
| EXACT_DUPLICATE | 0 |
| TEMPLATE_COLLAPSE | 131 |

Comparison corpus: 800 fresh items, 80 signed Recovery Pilot Gold anchors, 1240 Controlled A1 records, 12 Gold seed-bank questions, and 2100 other current-bank questions. Existing Gold always wins; only fresh candidates are routed for revision or rejection.

## QA1–QA7

| Gate | PASS | REVIEW | FAIL | TECHNICAL_FAILURE |
|---|---:|---:|---:|---:|
| QA1 | 97 | 385 | 318 | 0 |
| QA2 | 204 | 0 | 596 | 0 |
| QA3 | 800 | 0 | 0 | 0 |
| QA4 | 0 | 0 | 0 | 800 |
| QA5 | 0 | 589 | 211 | 0 |
| QA6 | 419 | 380 | 1 | 0 |
| QA7 | 7 | 181 | 612 | 0 |

QA2 suspected false negatives: **522**. These are deterministic-oracle blind-spot signals, not automatic content passes.

| QA2 false-negative cluster | Count |
|---|---:|
| CHANGED_DATE_OR_TIME | 4 |
| FINAL_AGREEMENT | 16 |
| LEXICAL_KNOWLEDGE_NOT_LITERAL_EVIDENCE | 191 |
| NEGATION_OR_X_NOT_Y | 45 |
| PRAGMATIC_RESPONSE_NOT_LITERAL_EVIDENCE | 186 |
| SEQUENCE_FIRST_NEXT_AFTER | 8 |
| TARGET_ENTITY_BINDING | 27 |
| TARGET_PERSON_BINDING | 2 |
| TIMETABLE_ROW_COLUMN_BINDING | 43 |

QA4 is reported as `TECHNICAL_FAILURE` because the fresh sources provide planning IDs but no persisted APPROVED KnowledgeUnit/SourceChunk evidence. Planning IDs were still checked against the catalog. This is not counted as content failure.

## Root causes

| Root cause | Count |
|---|---:|
| CONTENT | 26 |
| ANSWER_ORACLE | 3 |
| METADATA | 0 |
| CURRICULUM_BINDING | 0 |
| SERIALIZATION | 0 |
| DUPLICATE | 176 |
| QA_PROVIDER | 800 |
| QA_POLICY | 0 |
| UNKNOWN | 0 |

Counts are item associations and may overlap. Detailed evidence is in the JSON reports and review queue.

## Final recommendation

**PARTIALLY_READY**

All non-rejected items are retained in the human-review queue as `PENDING`. Decision routes and technical failures must be resolved before approval.
