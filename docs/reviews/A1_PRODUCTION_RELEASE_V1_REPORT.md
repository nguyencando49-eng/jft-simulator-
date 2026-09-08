# A1 Production Release V1 Report

Generated: 2026-09-08T14:58:31.926Z

No questions were generated, repaired, human-approved, published, staged, committed, or pushed. The release freezes the existing 486-question machine bank.

## Release

- Release bank count: **486**
- Release bank hash: `3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079`
- CE count: **80**
- Runtime source before: repository listQuestions from legacy seedQuestions or Supabase questions table
- Runtime source after: A1-only exam publish uses A1ReleaseBankProvider -> a1-machine-bank-v1.json

## Runtime path audit

| Layer | File | Classification |
|---|---|---|
| QUESTION_BANK | data/production/releases/a1-machine-bank-v1.json | ACTIVE_PRODUCTION_PATH |
| QUESTION_PROVIDER | lib/server/a1-release-bank.ts | ACTIVE_PRODUCTION_PATH |
| EXAM_ASSEMBLY | app/api/v1/exams/route.ts | ACTIVE_PRODUCTION_PATH |
| EXAM_ASSEMBLY | lib/exam-generator.ts | ACTIVE_PRODUCTION_PATH |
| EXAM_INSTANCE | lib/server/exam-choice-permutation.ts | ACTIVE_PRODUCTION_PATH |
| SESSION | app/api/v1/sessions/route.ts | ACTIVE_PRODUCTION_PATH |
| FRONTEND_PAYLOAD | lib/server/candidate-question.ts | ACTIVE_PRODUCTION_PATH |
| SCORING | lib/server/server-scoring.ts | ACTIVE_PRODUCTION_PATH |
| LEGACY_BANK | data/questions.ts | MIGRATION_REQUIRED |
| LEGACY_BANK | data/question-bank-expansion.ts | MIGRATION_REQUIRED |
| LEGACY_BANK | data/production/mass-question-candidates.ts | MIGRATION_REQUIRED |
| TEST_DATA | data/CONTROLLED_A1_FRESH_200_V3.json through V6 | LEGACY_UNUSED |

## 1000-form stress

- PASS / FAIL: **1000 / 0**
- Total instances: **50000**
- A/B/C/D: **{"A":13000,"B":13000,"C":12000,"D":12000}**
- Scoring mismatches: **0**
- Duplicate-within-form: **0**
- Canonical mutations: **0**
- Replay failures: **0**
- Max question exposure: **169**
- Max CE exposure: **169**
- Choice-order-locked instances: **1819**

## Safety tests

- Full-session smoke: **8 PASS / 0 FAIL**
- Negative safety tests: **10 PASS / 0 FAIL**
- Production bank identity: **PASS**

Final decision: **A1_PRODUCTION_CANDIDATE_READY**
