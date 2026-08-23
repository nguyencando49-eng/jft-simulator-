# MVP Release 0.1 Implementation Plan

## Scope and source of truth

This release completes the public learner journey only. QA1–QA7, scoring policy,
Question Factory, Supabase authentication, immutable `ExamVersion` snapshots and
the Admin information architecture remain unchanged. Source code is the current
technical truth; older documentation is used only as supporting context.

## Current state

| Stage | Status | Evidence and gap |
| --- | --- | --- |
| Landing | READY | `/` explains the unofficial CBT practice product in Vietnamese, has signup/login CTAs and responsive sections. |
| Signup | READY | `/register` and `POST /api/v1/auth/signup` support Supabase email verification and HttpOnly-cookie sessions. |
| Login | READY | `/login`, refresh-cookie flow and role-safe redirects exist. No token is stored in browser storage. |
| Dashboard | PARTIAL | `/candidate` shows an active attempt and recent history, but only one latest exam and no learner identity. |
| Exam list | PARTIAL | `GET /api/v1/exams/published` returns only the latest version instead of the latest published version of every exam. Level/question-count metadata is missing. |
| Exam start | PARTIAL | Session creation and duplicate-active-session resume work, but `/exam` always starts the globally latest exam rather than a selected exam. |
| CBT | READY | Server-timed focused UI, section transitions, constrained navigation, answer choices and progress are implemented. |
| Listening | PARTIAL | Audio playback and the two-play UI exist, but asset-load failure feedback is incomplete and playback count is client-only. No new official playback rule will be invented. |
| Autosave | PARTIAL | Answers/current index are written atomically to the server and restored on reload, but the UI has no retrying state or bounded retry. |
| Resume | READY | The opaque local session ID is only a hint; account-owned active sessions are rediscovered from the server. |
| Submit | PARTIAL | Server scoring and timeout submission work, but a repeated submit returns a conflict instead of the already-finalized result. |
| Result | PARTIAL | Practice score and section breakdown exist, but incorrect/answered summary and item review are absent. |
| Review | MISSING | Submitted candidates cannot yet inspect their answer, correct answer and explanation. |
| History | PARTIAL | Owned attempts are listed and detail routes exist, but completed detail has no answer review. |

## Blocking issues

### P0 — prevents the defined MVP journey

1. Candidate publication API and dashboard do not provide a selectable exam catalog.
2. `/exam` cannot reliably start the exam selected by the learner.
3. Submitted-result APIs do not provide post-submission question review, so incorrect-answer review is impossible.
4. Legacy ownerless sessions are accepted by `canAccessSession`; candidate access must require exact ownership.

### P1 — harms reliability or usability

1. Autosave has no bounded retry and no `Retrying` state.
2. Repeated submission is not idempotent.
3. Candidate question projection includes status/source/version/timestamp metadata that is not learner-visible content.
4. Listening asset failure is not surfaced reliably.
5. Candidate dashboard does not show the learner identity or per-exam status.
6. Result summary does not explicitly show incorrect and unanswered counts.
7. Existing browser E2E combines several behaviors but does not independently prove catalog selection, wrong-answer review or ownership denial.

### P2 — future enhancement, not part of this release

1. Persist listening playback counts server-side if product policy later requires cross-device enforcement.
2. Add a dedicated `/history` catalog route if attempt volume outgrows the dashboard list.
3. Add analytics event infrastructure beyond existing session/profile records.
4. Produce and human-approve enough A1 content to publish five distinct A1 exam sets.

## Existing modules to reuse

- Auth boundary: `lib/server/auth.ts`, `components/auth/AuthGate.tsx`, `app/api/v1/auth/**`.
- Repository abstraction: `lib/server/domain.ts`, `lib/server/memory-repository.ts`, `lib/server/supabase-repository.ts`.
- Immutable publication: `lib/exam-generator.ts`, `app/api/v1/exams/route.ts`.
- Candidate projection: `lib/server/candidate-question.ts`.
- Session ownership/navigation: `lib/server/session-invariants.ts`.
- Atomic autosave: `saveSessionProgress` and migration `0004_v5_1_1_hardening.sql`.
- Server scoring: `lib/server/server-scoring.ts`.
- Candidate APIs: `app/api/v1/exams/published`, `app/api/v1/sessions/**`.
- Candidate UI: `CandidateDashboard`, `ExamClient`, `ResultClient`, `AttemptDetailClient`.
- Existing browser release journey: `e2e/jft-factory.e2e.spec.ts`.

## Planned data flow

```text
Published ExamVersions
  -> latest version per examId
  -> Candidate exam catalog
  -> selected examVersionId
  -> create/resume owned CandidateSession
  -> server autosave with bounded client retry
  -> idempotent server submit
  -> server result + post-submission review projection
  -> Result / owned Attempt Detail
```

The active-exam projection will continue to exclude answers and explanations.
The submitted-result projection will expose answer review only after ownership and
submitted-status checks succeed.

## Files expected to change

- `lib/server/candidate-question.ts`
- `lib/server/session-invariants.ts`
- `lib/server/server-scoring.ts`
- `lib/api-client.ts`
- `app/api/v1/exams/published/route.ts`
- `app/api/v1/sessions/route.ts`
- `app/api/v1/sessions/[id]/submit/route.ts`
- `app/api/v1/sessions/[id]/result/route.ts`
- `components/candidate/CandidateDashboard.tsx`
- `components/ExamClient.tsx`
- `components/ResultClient.tsx`
- `components/candidate/AttemptDetailClient.tsx`
- `app/rebuild.css` and/or `app/globals.css`
- focused unit/integration tests and `e2e/jft-factory.e2e.spec.ts`
- `docs/MVP_RELEASE_0_1_REPORT.md`

No database migration is expected for the MVP integration itself. The production
content target remains a data/review operation: the application must not silently
fabricate five exams.

## Implementation phases

1. Tighten candidate projections and session ownership.
2. Add published exam catalog and selected-exam start/resume.
3. Add autosave retry, audio error state and idempotent submit.
4. Add submitted review projection and wrong-answer UI.
5. Add focused unit/API/browser regressions.
6. Run typecheck, unit tests, production build and Playwright.
7. Record actual production content/readiness blockers and deployment steps.
