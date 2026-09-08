# A1 Fresh 800 QA Pipeline Audit

Generated: 2026-09-07T15:08:55.429Z

The 800 source questions and Gold anchors were not modified. Nothing was approved, published, staged, committed, or pushed. All candidates remain `PENDING`.

## Stratified control

The corrected pipeline first processed **80 items**: 20 Script/Vocabulary, 20 Conversation/Expression, 20 Listening, and 20 Reading. All nine named QA2 clusters were represented. Unexpected technical failures: **0**. The full rerun proceeded only after these invariants passed.

## Gate results — before vs after

Counts are PASS / REVIEW / FAIL / TECHNICAL_FAILURE.

| Gate | Before | After |
|---|---:|---:|
| QA1 | 97/385/318/0 | 97/385/318/0 |
| QA2 | 204/0/596/0 | 316/453/31/0 |
| QA3 | 800/0/0/0 | 800/0/0/0 |
| QA4 | 0/0/0/800 | 0/800/0/0 |
| QA5 | 0/589/211/0 | 0/589/211/0 |
| QA6 | 419/380/1/0 | 419/380/1/0 |
| QA7 | 7/181/612/0 | 667/131/2/0 |

## QA2 failure audit

All 596 previous failures were classified.

| Classification | Count |
|---|---:|
| CONTENT_FAILURE | 31 |
| ORACLE_FALSE_NEGATIVE | 112 |
| AMBIGUOUS | 83 |
| UNKNOWN | 370 |

| Corrected false-negative cluster | Count |
|---|---:|
| CHANGED_DATE_OR_TIME | 2 |
| FINAL_AGREEMENT | 7 |
| NEGATION_OR_X_NOT_Y | 18 |
| PRAGMATIC_RESPONSE_NOT_LITERAL_EVIDENCE | 43 |
| SEQUENCE_FIRST_NEXT_AFTER | 1 |
| TARGET_ENTITY_BINDING | 11 |
| TARGET_PERSON_BINDING | 2 |
| TIMETABLE_ROW_COLUMN_BINDING | 9 |
| UNCLUSTERED | 19 |

Unresolved lexical or pragmatic knowledge is retained as `UNKNOWN`; it is not forced to PASS and does not become REAUTHOR without confirmed semantic evidence.

## QA4 grounding states

| State | Count |
|---|---:|
| GROUNDING_VALIDATED_FROM_CATALOG | 800 |
| GROUNDING_PERSISTED_APPROVED | 0 |
| GROUNDING_EVIDENCE_MISSING | 0 |
| TECHNICAL_FAILURE | 0 |

Catalog-grounded pre-persistence validation is distinct from persisted APPROVED evidence. No approval or SourceChunk provenance was fabricated.

## QA5 cause classification

| Cause | Count |
|---|---:|
| CONTENT_MISMATCH | 1 |
| METADATA_MISMATCH | 316 |
| QA_INPUT_BINDING_ERROR | 0 |
| CATALOG_MAPPING_LIMITATION | 483 |

The invalid `category -> taskType` binding was removed. Metadata-only mismatches route to `REALIGN_METADATA`, not REAUTHOR.

## QA7 semantic audit

| Classification | Count |
|---|---:|
| EXACT_DUPLICATE | 0 |
| NEAR_DUPLICATE | 2 |
| TEMPLATE_SIMILARITY | 131 |
| PEDAGOGICALLY_VALID_REUSE | 185 |
| QA7_FALSE_POSITIVE | 482 |

Shared JFT stems such as time/place/floor questions are not duplicate content by themselves. Gold anchors retain precedence against genuine duplicates.

## Decisions — before vs after

| Decision | Before | After |
|---|---:|---:|
| KEEP_CANDIDATE | 0 | 391 |
| QA_PIPELINE_ONLY | 138 | 0 |
| REVISE_PRESENTATION | 0 | 66 |
| REVISE_DISTRACTORS | 0 | 0 |
| REALIGN_METADATA | 59 | 278 |
| REAUTHOR | 603 | 65 |
| REJECT | 0 | 0 |

## Material outcomes

- Confirmed learner-visible content failures: **63**
- Confirmed QA2 false negatives: **112**
- Confirmed QA7 false positives: **482**
- Metadata-only defects: **278**
- Genuine duplicates: **2**
- Actual REAUTHOR after correction: **65**
- Items retained for human review: **800**

REAUTHOR is assigned only where the rerun records confirmed learner-visible evidence or a genuine semantic duplicate. Technical/retrieval limitations alone never produce REAUTHOR.
