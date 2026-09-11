# A1 Factory Reference

Reference release: `a1-machine-bank-v1` at `dc3fc90699c85f8de0b2c01d8e802d2ff827a36d`

A1 V1 is closed. The release bank and manifest are immutable reference artifacts:

- `data/production/releases/a1-machine-bank-v1.json`
- `data/production/releases/a1-machine-bank-v1.manifest.json`

Release identity:

- question count: 486
- release hash: `3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079`

## Component map

| Component | Purpose | Input | Output | Gate / validation | Failure mode | Reusability | A2.1 adaptation |
|---|---|---|---|---|---|---|---|
| Curriculum catalog | Defines level/unit/topic/Can-do anchors | `data/production/curriculum-catalog.ts`, source docs | level-scoped unit catalog | QA4 grounding, KU checks | missing/ambiguous source evidence | SHOULD_BE_GENERALIZED | Create level-scoped catalog and later persist approved evidence |
| Candidate source batches | Supply frozen generated candidates | A1 V3-V6 fresh JSON and repair artifacts | candidate bank | preflight / schema / duplicate / QA | frozen-source mutation, serialization leakage | A1_SPECIFIC | A2.1 must use its own generated candidate paths |
| Generator V2 | Generates from immutable blueprints | `QuestionPlanItem`, `KnowledgeUnit`, provider | `GeneratedBlueprintItem` | generator preflight | metadata mutation, duplicate choices, missing listening script | LEVEL_AGNOSTIC | Use with A2.1 level contract and A2.1 KUs |
| QA1 structural check | Basic schema and audio integrity | `QuestionRecord` | `QaReport` | no structural errors | policy finding treated as structural | LEVEL_AGNOSTIC with policy split | Keep structural failures blocking; split policy separately |
| QA2 answer oracle | Semantic answer validation | prompt/stimulus/choices/task | PASS/FAIL/REVIEW evidence | answer uniqueness and target binding | false negatives on lexical/pragmatic/timetable/negation | SHOULD_BE_GENERALIZED | A2.1 must preserve cluster handling and avoid literal-only lexical checks |
| QA3 Japanese quality | Naturalness/A1-level suitability | learner-visible Japanese | naturalness gate | PASS required | provider technical failures or overstrict level judgment | SHOULD_BE_GENERALIZED | Calibrate to A2.1 without weakening grammar/naturalness |
| QA4 curriculum grounding | Required knowledge supported by approved evidence | candidate + approved KUs + chunks | grounding result | source/KU evidence trace | missing persisted evidence misclassified as content fail | SHOULD_BE_GENERALIZED | Distinguish planning catalog from persisted approved evidence |
| QA5 JFT alignment | section/category/taskType/KU/Can-do alignment | declared metadata + content | alignment gate | PASS or metadata repair | metadata defect treated as learner-visible defect | LEVEL_AGNOSTIC | Auto-realign metadata only when evidence supports it |
| QA6 difficulty | Level and distractor quality | candidate + performance catalog | difficulty gate | A1/A2 suitability | uncertainty overblocking or underblocking | SHOULD_BE_GENERALIZED | Adjust difficulty rubric to A2.1 |
| QA7 originality | Duplicate/source-copy risk | candidate + bank/source corpus | originality gate | exact/near duplicate detection | template similarity treated as duplicate | LEVEL_AGNOSTIC with semantic tuple | Include A1 bank as cross-level reference where learner-equivalent |
| Machine acceptance | Zero-human final state | deterministic gates + QA + judges | MACHINE_ACCEPTED or AUTO_REJECTED | all hard gates pass, confidence >= .98 | REVIEW converted mechanically | LEVEL_AGNOSTIC | Parameterize by level but keep hard gates |
| Auto repair | Targeted repair of failed candidates | failed candidate + diagnosis | derived candidate | rerun affected gates | broad rewrite, hidden mutation | SHOULD_BE_GENERALIZED | Preserve source slot/provenance and max attempts |
| Coverage recovery | Fill section/KU deficits only | accepted/rejected candidate pools | recovered candidates | exposure simulation | mass regenerate all rejected content | LEVEL_AGNOSTIC | Prioritize A2.1 underrepresented KUs/sections |
| Exam generator | Builds frozen exam versions | `ExamDraft`, approved bank | `ExamVersion` | section quotas, no insufficient pool | legacy bank fallback | LEVEL_AGNOSTIC | Use release provider for level-specific banks |
| Choice permutation | Separates canonical answer from displayed answer | canonical question + seed + form | snapshot + permutation evidence | balanced A/B/C/D, scoring replay | inherited canonical answer bias | LEVEL_AGNOSTIC | Reuse unchanged |
| Release freeze | Immutable bank and manifest | accepted bank + evidence | release JSON + manifest | hash/count/state integrity | in-place mutation | SHOULD_BE_GENERALIZED | Add A2.1 release paths; never overwrite A1 |
| Server runtime provider | Loads release bank safely on Vercel | static JSON import + validation | runtime `QuestionRecord[]` | manifest hash validation | runtime relative FS ENOENT | SHOULD_BE_GENERALIZED | Use server-only static imports per level |
| Preview E2E | Validates deployed runtime before prod | preview URL + credentials + release config | E2E evidence | auth, creation, scoring, resume, UI | external browser cannot pass protection | SHOULD_BE_GENERALIZED | Parameterize temporary harness by level |
| Production smoke | Minimal real runtime proof | production deployment | smoke evidence | release identity + one exam/session | unnecessary production data | LEVEL_AGNOSTIC | Same small smoke for A2.1 after release gate |

## A1 production-critical files

SHOULD_NOT_BE_TOUCHED for A2.1 factory work:

- `data/production/releases/a1-machine-bank-v1.json`
- `data/production/releases/a1-machine-bank-v1.manifest.json`
- tag `a1-machine-bank-v1`

Runtime-critical but generalizable with regression tests:

- `lib/server/a1-release-bank.ts`
- `app/api/v1/exams/route.ts`
- `lib/exam-generator.ts`
- `lib/server/exam-choice-permutation.ts`
- `lib/server/server-scoring.ts`
- `tests/a1-production-release-v1.test.ts`

Factory/QA architecture to reuse:

- `lib/server/generator-v2.ts`
- `lib/server/factory-service.ts`
- `lib/server/factory-qa.ts`
- `lib/server/machine-acceptance-contract.ts`
- `lib/server/curriculum-grounding.ts`
- `lib/server/jft-alignment.ts`
- `lib/server/difficulty-calibration.ts`
- `lib/server/originality-duplicate.ts`
- `scripts/run-a1-fresh-800-machine-acceptance.ts`
- `scripts/execute-a1-fresh-800-repairs.ts`
- `scripts/run-a1-ce-recovery.ts`
- `scripts/run-a1-machine-bank-release-gate.ts`
- `scripts/freeze-a1-production-release-v1.ts`

## Non-negotiable lessons for A2.1

1. Generation, QA pass, machine acceptance, release, and publish are separate states.
2. QA technical failures are not learner-visible content failures.
3. Metadata repair is not content reauthoring.
4. Template similarity is allowed when the semantic tuple differs.
5. Canonical answer index must never dictate displayed exam answer position.
6. Release-bank loading must be serverless-safe and validated against a manifest.
7. Preview E2E must use the actual deployed runtime, not local-only assumptions.
