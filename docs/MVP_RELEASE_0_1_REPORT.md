# MVP Release 0.1 Report

## 1. MVP readiness before work

The repository already had a usable public landing page, Supabase/HttpOnly-cookie
authentication, immutable exam snapshots, server-owned candidate sessions, CBT
navigation, atomic answer persistence, server scoring, timeout submission, result
summaries, history records and an Admin publication flow.

The learner journey was not release-complete. The dashboard exposed only one
global latest version, the exam route could not reliably start a selected exam,
autosave had no bounded retry feedback, repeated submission returned a conflict,
submitted attempts had no item-level answer review, candidate session projection
contained unnecessary internal metadata, and legacy ownerless sessions could be
opened by any candidate. The detailed pre-change status is recorded in
`docs/MVP_RELEASE_0_1_PLAN.md`.

## 2. Major gaps found

### P0 gaps resolved in code

- Added a catalog containing the latest published immutable version of every exam.
- Bound the Start/Resume action to an explicit `examVersionId`.
- Added server-authoritative, post-submission answer review.
- Denied candidate access to sessions without exact candidate ownership.

### P1 gaps resolved in code

- Added serialized autosave with bounded retry and visible saving/retrying/saved/error states.
- Made submit idempotent and returned the already-frozen result on a repeated request.
- Reduced the active Candidate question/session API to explicit learner-visible allowlists.
- Added audio loading/play/error feedback and learner-safe failures.
- Added learner identity, per-exam status and recent attempts to the dashboard.
- Added correct, incorrect, unanswered, answered and total result counts.
- Added focused ownership, leakage, selected-exam, mobile and review regressions.

### Content gap closed without mass approval

Production now contains the 50 canonical authored seed questions as approved.
The remaining 2,050 mass-production items stay in `review` and none was
automatically approved. Five distinct eight-question A1 ExamVersions were
published as `JFT-A1-01-v1` through `JFT-A1-05-v1`.

## 3. Files changed

### Candidate/API/security

- `app/api/v1/auth/login/route.ts`
- `app/api/v1/auth/signup/route.ts`
- `app/api/v1/exams/published/route.ts`
- `app/api/v1/sessions/route.ts`
- `app/api/v1/sessions/[id]/route.ts`
- `app/api/v1/sessions/[id]/result/route.ts`
- `app/api/v1/sessions/[id]/submit/route.ts`
- `lib/api-client.ts`
- `lib/server/auth.ts`
- `lib/server/candidate-exam.ts`
- `lib/server/candidate-question.ts`
- `lib/server/server-scoring.ts`
- `lib/server/session-invariants.ts`

### Candidate/Admin UI

- `components/ExamClient.tsx`
- `components/ResultClient.tsx`
- `components/auth/LoginClient.tsx`
- `components/candidate/AnswerReview.tsx`
- `components/candidate/AttemptDetailClient.tsx`
- `components/candidate/CandidateDashboard.tsx`
- `components/admin/ExamBuilderClient.tsx`
- `app/rebuild.css`
- `data/admin/seed.ts`

### Tests and documentation

- `tests/candidate-mvp.test.ts`
- `tests/e2e-safety.test.ts`
- `tests/server-scoring.test.ts`
- `tests/session-invariants.test.ts`
- `e2e/jft-factory.e2e.spec.ts`
- `playwright.config.ts`
- `docs/MVP_RELEASE_0_1_PLAN.md`
- `docs/MVP_RELEASE_0_1_REPORT.md`

QA1–QA7 were not changed or expanded.

## 4. Candidate journey implemented

The verified local release journey is:

```text
Landing
  -> Register / Login
  -> Candidate dashboard and published-exam catalog
  -> Select A1 exam
  -> Create or resume an owned server session
  -> Audio check
  -> CBT sections and sequential Listening navigation
  -> Serialized server autosave with bounded retry
  -> Reload without localStorage and recover the saved answer
  -> Manual or timeout submit
  -> Practice result and section breakdown
  -> Incorrect-first answer review
  -> Logout / login as the same learner
  -> Persistent attempt history and owned attempt detail
```

The browser test also exercises the critical learner screens without horizontal
overflow at 375, 390 and 430 pixels.

## 5. Backend/API changes

- `GET /api/v1/exams/published` now returns `versions`, the newest published
  immutable version per `examId`, while retaining the legacy `version` property.
- Session creation accepts the catalog-selected version and preserves existing
  owned-active-session reuse.
- Candidate session responses pass through a dedicated session allowlist.
- Active questions pass through a strict content allowlist and exclude answer,
  explanation, QA, provider, source, status and lifecycle metadata.
- Result and submit responses expose item review only after exact ownership and
  submitted-status checks.
- Repeated submit returns HTTP 200 with the same frozen score/review and
  `alreadySubmitted: true`.
- Result scoring now reports correct, incorrect, answered, unanswered and total.
- Development identities are stable per email, enabling meaningful multi-user
  ownership testing without altering production Supabase identity behavior.

No database migration was required.

## 6. UI changes

- Candidate dashboard now shows learner identity, every available exam, real
  level/question/duration/section metadata, active attempts and recent history.
- Exam actions distinguish Start, Resume, Retry and View result.
- The CBT screen now starts the selected version, serializes writes, reports
  autosave states, waits for pending writes before submit and recovers transient
  route/network failures with bounded retry.
- Listening exposes loading, playback count and an actionable unavailable-audio
  state without showing the raw asset URL or transcript.
- Result and attempt detail pages show clear practice-only totals, section scores
  and post-submit answer review with incorrect/unanswered items first.
- Admin Exam Builder can constrain each section pool by A1, A2.1, A2.2 or all
  levels; this does not auto-approve content or relax publication gates.

## 7. Security and integrity checks

- HttpOnly-cookie authentication remains intact; no auth token was moved into
  localStorage.
- Server scoring, expiration, immutable ExamVersion snapshots and answer-index
  validation remain authoritative.
- Candidate ownership now requires an exact session owner; an ownerless legacy
  session is not candidate-accessible.
- Listening no-back questions must be completed sequentially; clients cannot
  skip arbitrarily forward within the restricted section.
- Active Candidate APIs contain no answer key, explanation, QA evidence,
  provider/source metadata or candidate owner ID.
- Submitted review cannot be read before submission or by another learner.
- Supabase migrations `0001` through `0007` are present. Migration `0007`
  preserves RLS protection for Factory QA payloads.
- `.env`, `.env.local`, `.vercel`, source books and generated test artifacts are
  excluded by `.gitignore`/`.vercelignore`.

## 8. Tests added or extended

- Catalog deduplication and learner-safe summary metadata.
- Stable, distinct per-email development identities.
- Server result totals and safe submitted-review projection.
- Exact-owner access and ownerless-session denial.
- Sequential no-back Listening enforcement.
- Exact active-question/session API allowlists.
- Registration, selected-exam start, autosave, reload/resume, Listening playback,
  submit, answer review, idempotent submit, logout/login history persistence,
  timeout finalization and cross-user ownership denial.
- Mobile horizontal-overflow checks at 375, 390 and 430 pixels.
- Existing Admin Factory/TTS/approval/publication and Source Factory journeys remain covered.

## 9. Test results

Run on 2026-08-23:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm test` | PASS — 29 files, 203 tests |
| `npm run build` | PASS — 42 pages/routes generated |
| `npm run test:e2e` | PASS — 6 Chromium journeys |
| `git diff --check` | PASS; Windows CRLF conversion warnings only |

## 10. Remaining blockers

There is no blocker for the first usable A1 MVP. The following limitations remain:

1. The five released exams contain eight questions each and up to 37.5% pairwise
   overlap because only 17 A1 questions have completed approval.
2. Listening play count is enforced in the current browser session, not persisted
   across devices. This is explicitly deferred unless product policy requires it.
3. Next.js dev E2E reports a future `allowedDevOrigins` warning; it does not affect
   the production build or current tests.

The public A1 MVP release status is **READY**. Production smoke passed against
`https://jft-simulator.vercel.app` and all temporary release/smoke secrets were removed.

## 11. Deployment checklist

1. Confirm production Supabase backup and verify migrations `0001`–`0007`.
2. Configure Vercel server variables from `.env.example`, including
   `AUTH_DISABLED=false`, Supabase URL/anon/service-role values, Azure provider
   configuration, `TTS_PROVIDER=azure`, Azure Speech settings and asset bucket.
   Never create `NEXT_PUBLIC_` variants for private keys.
3. In Admin, human-review enough approved A1 items, validate every Listening asset,
   assemble five distinct A1 drafts and publish immutable ExamVersions. Do not
   publish the 2,100 review items automatically.
4. Run `npm run qa:full` against the release commit.
5. Push the reviewed commit to the Vercel-linked `main` branch or run the existing
   Vercel production deployment workflow.
6. Verify `/api/v1/system` reports production auth, Supabase persistence and the
   intended AI/TTS providers without exposing secrets.
7. Production smoke test: landing, signup/email flow, login, catalog, selected A1
   start, audio, autosave/reload, submit, review, logout/login and history.
8. Test a second account against the first account's session/result and confirm
   access is denied.
9. Confirm the Candidate catalog shows only published exams and at least five A1 exams.
10. Monitor initial server/API errors and audio failures before announcing release.

## 12. Exact recommended next task

**A1 Bank Expansion Pilot:** create and human-review enough new original A1 items
to reduce pairwise overlap below 15% while preserving QA1–QA7, curriculum
provenance and complete Azure Listening audio. Do not mass-approve the 2,050
remaining review questions.
