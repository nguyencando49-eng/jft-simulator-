# V5.1.1 QA Factory Hardening

This release inserts a mandatory QA gate before adding more product features.

## Release gate

Every pull request and push to `main` runs:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

A release is not considered green unless all four pass.

## Exam integrity invariants

- Answer writes are accepted only for question IDs frozen into the current `ExamVersion`.
- Choice indexes must be inside that frozen question's choices.
- Future questions cannot be answered before the server-side current position reaches them.
- Sections with `allowBack=false` reject navigation and answer mutation after the candidate moves past a question.
- Expired sessions reject answer writes. Submit then auto-finalizes only the answers already saved before the deadline, using `expiresAt` as the submission timestamp.
- Scoring counts only frozen ExamVersion question IDs; forged answer keys do not affect `answered` or score.
- Result URLs use an explicit account-owned `sessionId` rather than browser session storage.

## Concurrency

`Repository.saveSessionProgress()` is an atomic answer-merge abstraction. Supabase uses the `save_session_progress` Postgres function so two independent autosaves update different JSONB keys instead of replacing the whole answers object.

## Question Factory integrity

AI candidates cannot overwrite an existing Question Bank record. Approval detects `questionId` collision and blocks the candidate with a QA error.

## Exam generation

Publishing no longer uses `pool.slice(0, count)`. A deterministic seeded shuffle is derived from exam ID, version, and section. The same version is reproducible while later versions rotate the selected pool.

## Database constraints

Migration `0004_v5_1_1_hardening.sql` adds constraints for question/session/factory status, level/section/version, session time ordering, submission timestamp integrity, and the atomic progress RPC.

## Test coverage introduced

- session ownership and navigation invariants
- expired session behavior
- forged question/choice rejection
- frozen server scoring
- seeded exam generation
- question ID collision detection
- concurrent autosave answer merge

## Remaining production gates

- Run the full GitHub Actions workflow with real `npm ci`.
- Add end-to-end browser tests against a disposable Supabase project.
- Add load tests for high-frequency autosave and large AI Factory batches.
- Move long-running Factory generation to a background job/queue before scaling serverless traffic.
