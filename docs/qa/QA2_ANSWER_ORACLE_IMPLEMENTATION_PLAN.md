# QA2 Independent Answer Oracle — Implementation Plan

## Current architecture

- Deterministic Q0 validation and semantic checks populate `FactoryCandidate.qa`.
- QA1 (`JFT_CONTENT_QA_V1`) runs in `factory-service.ts` after curriculum/originality checks, after listening audio refresh, and again immediately before approval.
- Factory jobs are persisted as JSON payloads through the existing `Repository`; Memory and Supabase implementations therefore preserve additional candidate evidence without a schema migration.
- Admin Factory review renders candidate QA evidence. Candidate sessions are built only from frozen `ExamVersion` snapshots, with answer and explanation stripped from active-session responses.

## Extension point

QA2 will be added to the existing Factory service immediately after QA1. It will not alter QA1. A separate `answerOracleQa` field on `FactoryCandidate` will preserve auditable QA2 evidence without overwriting any earlier gate.

## Data flow

1. Build a learner-visible `AnswerOracleInput` from stem, choices, section, and any visible passage or QA-only listening script.
2. Send that input to an `AnswerOracleProvider`. The input type and HTTP payload cannot contain the declared answer, explanation, QA1 evidence, curriculum hints, or generator reasoning.
3. Strictly validate the provider's independent solve result.
4. Deterministic application code compares derived options with the declared answer key.
5. Normalize the outcome to PASS, REVIEW, or FAIL and merge only the gate status into aggregate Factory QA.
6. Persist the complete QA2 evidence inside the existing Factory job payload.

## Provider design

- `AnswerOracleProvider` is vendor-neutral.
- A deterministic provider supports local development and reproducible tests.
- An HTTP provider follows the repository's existing provider/env configuration pattern.
- Prompt version is fixed as `JFT_ANSWER_ORACLE_V1` and stored with provider, model, timestamp, and question ID.

## Gate policy

- Hard fail: answer-key mismatch, multiple defensible answers, no defensible answer, or hidden required context.
- Review: matching answer below the configurable confidence threshold (default 0.85), invalid provider output, or provider failure.
- Pass: exactly one derived answer, matching the declared answer, at or above the confidence threshold.
- The default threshold is a `SIMULATOR_DESIGN_DECISION`, not an official JFT rule.

## UI and security

- Admin Factory review will show QA2 result, derived/declared answers, confidence, defensible answer count, and expandable per-choice evidence.
- Candidate APIs remain isolated from Factory jobs. Tests will confirm active exam payloads contain neither answers nor QA evidence.

## Tests

- Strict schema and provider failure behavior.
- Match, mismatch, multiple, none, low confidence, and hidden context.
- Grammar, reading, and listening learner-visible input handling.
- Adversarial synthetic fixtures.
- A capture-provider test proving answer-key blinding.
- Integration test proving QA2 failure overrides QA1 pass.
- Candidate API projection/security regression.

## Documentation and verification

- Add `docs/qa/QA2_ANSWER_ORACLE.md` and update the main QA architecture documentation.
- Run typecheck, unit/integration tests, and production build.
- QA3 is explicitly out of scope.
