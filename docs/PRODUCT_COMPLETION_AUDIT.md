# JFT Simulator Product Completion Audit

Audit date: 2026-08-16  
Scope: repository at `main`/`897fa20`, deployed demo at `https://jft-simulator.vercel.app`  
Method: source-first review, documentation comparison, static content inventory, live production smoke test, GitHub Actions inspection. No production code or production data was changed for this audit.

## 1. Executive Summary

The repository is a credible **technical prototype** of an account-aware CBT and content-production pipeline, not yet a learner-ready JFT practice product. The strongest part is the exam integrity boundary: immutable `ExamVersion` snapshots, candidate-safe payloads, server scoring, ownership checks, timer enforcement, autosave, resume, and Listening no-back rules are implemented. The weakest parts are content volume/quality, real Listening assets, production configuration, and truthful product-facing UI.

Estimated overall completion: **38%** toward a product that real learners can use repeatedly.

| Area | Approx. readiness | Evidence-based assessment |
|---|---:|---|
| CBT/session engine | 75% | Core journey works in live smoke test; invariants in `lib/server/session-invariants.ts`, routes under `app/api/v1/sessions`, and candidate E2E. |
| Admin/content pipeline | 55% | Question lifecycle, factory, QA, approval, and publish exist; editor/import UI and production providers are incomplete. |
| Question content | 10% | Only 8 seed questions, exactly one 8-item exam, no real audio, narrow topic coverage. |
| Learning/result UX | 35% | Aggregate and section score exist; no item review, rationale review, study recommendations, or content feedback loop. |
| Production readiness | 20% | Current live runtime is intentionally `memory` + `disabled-dev` + mock AI/TTS; CI is red. |
| Automated QA | 60% | Unit/integrity coverage is useful and Candidate E2E passes; Admin Factory E2E currently fails and there is no Supabase integration suite. |

### Five largest problems

1. **P0 — Live deployment is development mode.** `/api/v1/system` reports `repository=memory`, `authentication=disabled-dev`, `assetStorage=inline-dev`, and mock generation/semantic/TTS providers. All demo candidates share the fixed identity `dev-candidate` (`lib/server/auth.ts`, `app/api/v1/auth/login/route.ts`).
2. **P0 — Listening is unusable as learning content.** The bank references `/audio/sample-01.mp3` and `/audio/sample-02.mp3`, but `public/audio` contains only `README.txt`; both production URLs return HTTP 404. Mock TTS generates a tone, not Japanese speech (`lib/server/tts-provider.ts`).
3. **P0/P1 — Content is far below useful scale.** The bank has 8 questions, 2 per section. The single blueprint consumes all 8, so there is effectively no alternate-form diversity.
4. **P0 — Release gate is red.** The latest four GitHub Actions runs failed. On run `31956719843`, Candidate E2E tests passed, but Admin Factory E2E failed because `Render TTS audio` did not appear, including retry.
5. **P1 — Product UI still exposes prototype internals and fake metrics.** `app/admin/page.tsx` renders seed/sample attempts and `Published exams = 0`; Candidate screens show version, QA, API, server, and development terminology; the audio check is a non-functional placeholder.

### Go/no-go

**No-go for real users today.** The engine can support controlled internal demos, but public learner usage should wait until P0 removes development auth/memory persistence, provides real playable Listening audio, makes CI green, and establishes a minimally varied reviewed content bank.

## 2. Architecture Current State

### Components that actually exist

| Component | Current implementation | State | Evidence |
|---|---|---|---|
| Web application | Next.js 15 App Router, React 19 | Implemented | `package.json`, `app/` |
| Auth BFF | Password login/signup/recovery/refresh via Supabase REST; HttpOnly cookies; dev role emulation | Implemented but production-unverified | `app/api/v1/auth/*`, `lib/server/auth.ts` |
| Authorization | Client route gates plus server role checks | Implemented | `components/auth/AuthGate.tsx`, `requireAuth()` |
| Persistence | `MemoryRepository` or service-role PostgREST `SupabaseRepository` | Implemented adapters; live uses memory | `lib/server/repository.ts`, both repository files, live `/api/v1/system` |
| Question Bank | Mutable `QuestionRecord`, status/source/version, API list/upsert | Partial | `lib/admin-types.ts`, `/api/v1/questions`, `QuestionBankClient.tsx` |
| Exam Builder | One hard-coded draft ID; counts, levels in model, immutable publish | Partial | `ExamBuilderClient.tsx`, `generateExamVersion()` |
| Exam delivery | Candidate-safe frozen snapshots, server-owned sessions | Implemented | `/api/v1/sessions`, `CandidateExam` in `lib/api-client.ts` |
| Scoring | Frozen-version server scoring and section aggregates | Implemented | `scoreFrozenExam()` |
| AI Factory | Synchronous mock/HTTP generation adapter | Partial | `factory-provider.ts`, `factory-service.ts` |
| Semantic QA | Heuristic mock or HTTP adapter | Partial | `semantic-qa-provider.ts` |
| Duplicate QA | Character trigram Jaccard threshold | Implemented basic gate | `duplicate-detection.ts` |
| TTS | Development tone or generic HTTP provider; Supabase/public URL storage | Partial; no production speech | `tts-provider.ts`, `asset-storage.ts` |
| Database schema | Four SQL migrations for questions, drafts, versions, sessions, profiles, jobs, constraints/RPC | Implemented but not integration-tested | `supabase/migrations/0001..0004` |
| CI | typecheck → unit → build → Playwright | Configured but red | `.github/workflows/qa.yml`, Actions run `31956719843` |

### Data flow actually used

`QuestionRecord → ExamDraft → generateExamVersion() → frozen ExamVersion → CandidateSession → atomic answer merge → scoreFrozenExam()`.

This is the active V4/V5 path. `lib/admin-store.ts`, `lib/scoring.ts`, `data/exam.ts`, and parts of older architecture docs describe legacy/local implementations and are not the current source of truth. `app/admin/page.tsx` still imports seed/sample data directly, creating a duplicate truth source for dashboard metrics.

### Important architecture limitations

- `MemoryRepository` stores process-local module state and intentionally does not bind it to `globalThis` in production. It is unsuitable for Vercel persistence or concurrent users (`lib/server/memory-repository.ts`).
- The dev identity is role-wide (`dev-candidate`/`dev-admin`), not unique per email. Multiple public demo users can see or resume the same role's sessions.
- Factory generation runs synchronously inside a request, with no timeout, retry policy, queue, idempotency key, cost limit, or provider circuit breaker.
- `SupabaseRepository` uses the service role for every table operation; RLS is enabled but there are no policies because the browser never accesses tables directly. Correctness therefore depends entirely on BFF authorization.
- Published versions are insert-only through application code and `(exam_id, version)` uniqueness, but database-level immutability is not enforced against privileged updates.
- Migrations use several `NOT VALID` constraints and do not subsequently validate existing rows.
- No custom `not-found.tsx`, `error.tsx`, or `global-error.tsx` exists; error handling is mainly component/API-local.

## 3. Candidate Journey Audit

| Step | Status | Actual behavior | Gaps / risks | Evidence |
|---|---|---|---|---|
| Login | PARTIAL | Dev role login works live; production password path exists. | Current public login is explicitly development mode; real Supabase flow has no integration/E2E proof. | `LoginClient.tsx`, auth login route, live smoke test |
| Register | PARTIAL | UI/API and Supabase signup contract exist. | Dev registration overwrites shared `dev-candidate`; production email verification not tested. | `RegisterClient.tsx`, signup route |
| Recovery | PARTIAL | Request/reset routes and UI exist. | PKCE/code recovery is explicitly unsupported; provider response on recover is not checked. | `V4_3_ACCOUNT_LIFECYCLE.md`, recover/reset routes |
| Candidate Dashboard | PASS for demo | Latest exam, active resume, attempts, best score, profile. | Only one latest exam; no catalog, filters, readiness, or learner-oriented description. | `CandidateDashboard.tsx` |
| Choose exam | PARTIAL | Latest published version is selected automatically. | Candidate cannot choose among exams/levels/topics. | `/api/v1/exams/published`, `ExamClient.bootstrap()` |
| Start Exam | PASS | Creates or reuses account-owned active session with server expiry. | Public dev users share identity; memory persistence can disappear. | sessions POST route; live smoke test |
| Instructions | PARTIAL | Three-stage entry flow exists. | Text exposes V4.2, server, frozen answers; not learner copy. | `ExamClient.tsx` |
| Audio Check | FAIL | Screen and button shape exist. | Button has no handler/audio and says `Audio check placeholder`. | `ExamClient.tsx` |
| Vocabulary | PASS technically | Answering/navigation/autosave work. | Only 2 seed questions; shallow coverage. | seed data, Candidate E2E |
| Conversation/Expression | PASS technically | Same engine path works. | Only 2 seed questions. | seed data, Candidate E2E |
| Listening | FAIL as content; PASS as navigation | No-back invariant and audio player exist. | Both seed audio files 404; mock TTS is only a tone. | `data/questions.ts`, `public/audio/README.txt`, live HTTP check |
| Reading | PASS technically | Multi-line prompt and choices work. | Only 2 seed questions; no image/sign assets. | seed data, `ExamClient.tsx` |
| Autosave | PASS in tested path | API validates mutation, atomically merges progress. | No retry/backoff; UI only says `Save error`; no offline recovery or load test. | answers route, repository RPC, unit + Candidate E2E |
| Refresh/resume | PASS in tested path | Local hint plus account session discovery. | Serverless memory mode is non-durable; only dev E2E covered. | `ExamClient.bootstrap()`, Candidate E2E |
| Timeout | PASS in tested path | UI auto-submits; server finalizes only saved answers. | Failure during auto-submit can leave expired UX without guaranteed retry. | `finalizeSessionForSubmission()`, unit + E2E |
| Submit | PASS | Server scores frozen version and returns aggregates. | No explicit confirmation of pending autosave before submit. | submit route, live smoke test |
| Result | PARTIAL | Overall and per-section score, weakest section. | No validated JFT score interpretation, answer review, explanations, recommendations, or retry plan. | `ResultClient.tsx` |
| History | PARTIAL | Account-owned attempt list/detail and resume. | Detail only shows section totals; no item-by-item review. | `AttemptDetailClient.tsx` |
| Review | FAIL | No learner review route/data contract. | Candidate-safe exam payload permanently strips explanations; result API does not return post-submit reviewed items. | result route and client types |

Live smoke result on 2026-08-16: login `200`, latest exam found, 8 questions delivered with zero `answer`/`explanationVi` leak fields, autosave `200`, resume retained the answer, submit/result returned 12.5% for 1/8 answered.

## 4. Admin Journey Audit

| Step | Status | Actual behavior | Gaps / risks | Evidence |
|---|---|---|---|---|
| Admin login/guard | PARTIAL | Dev admin and role-protected APIs/pages work. | Current production enables unrestricted role switching; real admin auth untested. | `AuthGate`, `requireAuth`, live runtime |
| Dashboard | FAIL as trustworthy dashboard | Renders overview UI. | Metrics are hard-coded seed/sample data and contradict backend state. | `app/admin/page.tsx`, `seedAttempts` |
| Question Bank list/filter | PASS | API-backed search/filter and preview. | No pagination for large banks. | `QuestionBankClient.tsx` |
| Create/edit question | PARTIAL | `+ New question` creates a canned draft; status can change. | No real form editing, delete/archive action, asset selection, taxonomy fields, or revision history UI. | `addDemo()` and drawer actions |
| Import | BACKEND ONLY | JSON/CSV parser, normalization, QA, endpoint exist. | No Admin UI, collision handling, transaction/rollback, or import tests. | importer and import route |
| AI Generate | PARTIAL | Structured brief and mock/HTTP adapters. | Live provider is deterministic mock; difficulty is collected but mock output does not materially vary by difficulty. | Factory UI/provider, live system |
| Structural QA | PARTIAL | Prompt, choices, answer, duplicates, audio, explanation warning. | Does not validate section/type/level enum at QA boundary, Japanese correctness, single semantic truth, distractor plausibility, or real asset playability. | `runQuestionQa()`, `runFactoryQa()` |
| Semantic QA | PARTIAL | Mock heuristic or external HTTP score. | Live heuristic is keyword matching, not independent language review. External response is trusted with light validation. | `semantic-qa-provider.ts` |
| Duplicate QA | PARTIAL | In-batch and bank prompt similarity gates. | Prompt-only character trigrams; no stem+choices/audio semantic duplicate detection or corpus exposure logic. | `factory-service.ts`, `duplicate-detection.ts` |
| TTS | FAIL for production | State machine/storage/preview exist. | Live output is a 0.8s 440 Hz tone. Current Admin E2E cannot find render button. | `tts-provider.ts`, Actions run `31956719843` |
| Human Review | PARTIAL | Reviewer sees answer, script, semantic report, issues and selects approval. | Cannot edit/reject with reason/assign reviewer; mock candidates may be auto-selected when QA passes. | `FactoryClient.tsx` |
| Approve | PASS at service level | Re-runs QA, blocks ID collision, promotes to approved bank. | No transaction across job/question writes; no audit actor beyond job requester. | `approveFactoryCandidates()` |
| Exam Builder | PARTIAL | Counts and duration, pool readiness, seeded selection, immutable publish. | Fixed exam ID, one draft, levels not editable in UI, no topic/Can-do balancing, no preview/reorder/exposure control. | `ExamBuilderClient.tsx`, `adminApi.exam()` |
| Publish | PASS technically | Only approved items; frozen question/rules snapshot; unique version. | Admin E2E publish journey currently cannot reach this step due Factory failure. | exam route, generator tests, CI log |
| Candidate availability | PASS in demo | Latest version becomes available immediately. | No scheduling, withdrawal, entitlement, locale, cohort, or publication status beyond “latest timestamp”. | published exam route |

## 5. Question Bank Audit

Source of truth for the initial bank: `data/questions.ts` transformed by `data/admin/seed.ts`. A real Supabase database may contain additional runtime-created rows, but the deployed environment is memory mode and resets to this seed; therefore 8 is the reproducible repository-backed inventory.

### Inventory

| Metric | Count | Notes |
|---|---:|---|
| Total questions | 8 | All seed/original |
| Script & Vocabulary | 2 | `SV-001..002` |
| Conversation/Expression | 2 | `CE-001..002` |
| Listening | 2 | `LI-001..002` |
| Reading | 2 | `RE-001..002` |
| A1 | 3 | SV-001, LI-001, RE-001 |
| A2.1 | 3 | SV-002, CE-001, LI-002 |
| A2.2 | 2 | CE-002, RE-002 |
| Approved | 8 | Seed maps every item to `approved` |
| Review / draft / archived | 0 / 0 / 0 | Initial reproducible bank |
| AI-generated | 0 | Initial bank; runtime mock jobs are non-durable |
| Imported | 0 | Initial bank |
| With explanation | 8 | Explanations are short Vietnamese rationales |
| With `audioSrc` string | 2 | Both point to missing files |
| With real playable audio | 0 | Both deployed URLs return 404 |
| Exact duplicates | 0 | Normalized prompt scan |
| Near duplicates at 0.82 | 0 | Same trigram algorithm/threshold as application |
| Explicit topic field | 0 | Topic is not a `QuestionRecord` field |
| Explicit Can-do field | 0 | Only factory request/job has `canDo` |
| Explicit category field | 0 | Not in schema |
| Explicit difficulty field | 0 | Only factory request has difficulty |

Tags present: `daily-life`, `verb`, `kanji`, `usage`, `work`, `conversation`, `expression`, `time`, `listening`, `service`, `notice`, `reading`. These mix topic, skill, format, and category in one array, so reliable counts by topic/Can-do are **not possible**. A best-effort content reading shows work (3 items), time (2), daily routine (1), healthcare booking (1), service/queue (1), notice (1), with overlaps.

Answer-index distribution is 0: 4, 1: 3, 2: 1, 3: 0. This is too small to infer a stable bias, but the absence of answer index 3 and concentration in the first two positions is a content-generation warning.

### Content quality observations

- Most non-Listening items are understandable A1/A2 practice prompts, but there is no evidence of independent native-speaker review or calibration against an official content specification.
- `SV-002` uses `病院を予約しました`, which is at least pedagogically awkward compared with `病院の予約をしました` or booking an examination; the keyed option remains uniquely plausible only because distractors are clearly invalid.
- Listening explanations say “Audio mẫu sẽ…” rather than explain evidence in an actual recording. Since the recordings do not exist, Listening language, speed, accent, noise, and answer alignment cannot be audited.
- Distractors are often obviously wrong by semantic category, reducing discrimination. The bank has no empirical difficulty, exposure, discrimination, or distractor-selection data.
- The mock factory repeats four templates and appends numeric suffixes, so scaling it would create synthetic-looking content rather than a reviewed corpus.
- The project correctly labels itself unofficial. Nothing in the repository proves that questions reproduce real JFT items, and no such claim should be made.

### Capacity conclusion

The current bank can produce exactly one 8-question version using the default rules. Later versions can shuffle order/selection seeds but cannot create meaningful alternate forms because each section pool size equals its required count (2). It is **not sufficient** for repeated practice, realistic 50-question simulation, exposure control, or topic/level balancing.

## 6. Content Gap Analysis and Canonical Taxonomy

### Proposed canonical taxonomy

| Canonical field | Current mapping | Gap / migration approach |
|---|---|---|
| `section` | `Question.section` | Already canonical; keep enum. |
| `category` | Sometimes implied by tags (`verb`, `kanji`, `conversation`, `notice`) | Add controlled vocabulary; migrate from reviewed tag mapping, not automatic guesses. |
| `level` | `Question.level` | Present; add calibration provenance/reviewer later. |
| `topic` | Mixed into tags; factory request has `topic` but it is discarded as a distinct field | Add explicit controlled topic; backfill only after content review. |
| `canDo` | Factory request/job only; candidate question receives it as an undifferentiated tag | Persist explicit Can-do ID/text on QuestionRecord. |
| `difficulty` | Factory request only | Persist authored difficulty, later separate from empirical difficulty. |
| `source` | `QuestionRecord.source` = original/imported/ai | Present; extend with source reference/license/provenance, never real-exam claims. |
| `status` | draft/review/approved/archived | Present; add reviewer/approval evidence and transition policy. |
| `tags` | Free-form strings | Retain for secondary facets; normalize casing/language and prevent use as a substitute for canonical fields. |

Do not change schema until controlled vocabularies and mapping rules are approved. First create a taxonomy reference and an eight-row reviewed mapping sheet, then update domain/schema/import/factory/UI together.

### Missing content foundation

- A content blueprint specifying target counts per section/category/level/topic/Can-do.
- Native-speaker language review rubric and recorded reviewer decisions.
- Sufficient pool depth. A practical first target is at least 3–5 times each exam slot per selection cell before claiming alternate-form variety.
- Real Japanese audio scripts, recordings/TTS, voice metadata, duration, transcript, replay policy, and listening QA.
- Image/sign/notice assets where useful; current type system supports only text choice and audio choice.
- Item-level learning explanations and post-submit review content.
- Performance metrics and an exposure/retirement process.

## 7. Production Gap Analysis

### DEV ONLY in the current deployment

- `AUTH_DISABLED=true`: public Candidate/Admin role switching and fixed role-wide identities.
- `MemoryRepository`: non-durable, instance-local data.
- `AI_FACTORY_PROVIDER=mock`: deterministic templates.
- `AI_QA_PROVIDER=mock`: keyword heuristic.
- `TTS_PROVIDER=mock`: tone, not speech.
- `inline-dev` asset storage.
- Seed question bank, single `JFT-MOCK-001`, sample admin metrics.
- Technical labels (`V5.1.2`, `QA-hardened`, API/server/frozen/version terminology) in learner-facing UI.

### Implemented but not proven production-ready

- Supabase password auth, signup, refresh, role management, recovery.
- Four migrations and PostgREST repository.
- Supabase Storage upload/generated-audio path.
- HTTP AI/semantic/TTS adapters.
- Cross-device resume and concurrent autosave against real Supabase.

### Production blockers and risks

| Priority | Gap | Evidence / impact |
|---|---|---|
| P0 | Dev auth enabled publicly | Anyone can become Admin; shared identities and sessions. |
| P0 | Memory persistence | Data can reset or diverge across serverless instances. |
| P0 | Missing Listening files / mock tone | Exam contains unanswerable Listening questions. |
| P0 | CI red | Release gate cannot be trusted; Admin critical journey failing. |
| P0 | Empty/unverified Supabase production | No durable accounts, bank, attempts, or storage. |
| P1 | No rate limiting/abuse controls | Auth, generation, TTS, imports, autosave and publish endpoints are unthrottled. |
| P1 | No provider timeouts/retries | External AI/TTS `fetch` calls can occupy serverless requests indefinitely. |
| P1 | Synchronous Factory request | Up to 20 sequential semantic calls plus generation can exceed function limits. |
| P1 | Generic API error mapping | Most operational/domain failures become status 400; internal provider/database messages may be exposed. |
| P1 | No asset authorization test | Generated URLs assume a public bucket/CDN; upload endpoint returns metadata but has no UI. |
| P1 | Recovery compatibility gap | PKCE/code recovery callback is absent. |
| P1 | No Supabase integration tests | RLS/service-role, migrations, RPC concurrency, role changes, and storage are unverified. |
| P1 | Missing app-level error boundaries/logging | No structured logs, correlation IDs, alerting, custom 404/500, or error telemetry. |
| P2 | No lockfile | CI uses `npm install`, making dependency resolution less reproducible. |

Tracked secret scan found only empty variable names/examples, not literal service keys or private keys. `.env` and `.env.local` are ignored. This is necessary but not sufficient; Vercel/Supabase secret rotation and least-privilege review remain operational tasks.

## 8. QA Coverage Matrix

Legend: PASS = meaningful automated evidence; PARTIAL = some layer covered; FAIL = missing or currently red.

| Requirement | Implementation | Unit / integrity | Integration | E2E | Current status |
|---|---|---|---|---|---|
| Forged answer keys ignored | `scoreFrozenExam()` filters frozen IDs | `server-scoring.test.ts` | None | Not adversarial | PASS unit |
| Forged question ID rejected | `validateSessionMutation()` | `session-invariants.test.ts` | None | None | PASS unit |
| Invalid choice rejected | `validateSessionMutation()` | `session-invariants.test.ts` | None | None | PASS unit |
| Session ownership | `canAccessSession()` on resume/save/submit/result | Candidate/admin cases in unit | None with Supabase | Candidate E2E only same owner | PARTIAL |
| Autosave | `saveSessionProgress()` memory/RPC | Memory concurrent merge test | No Postgres RPC test | Candidate autosave PASS | PARTIAL/PASS demo |
| Refresh/resume | account session lookup + resume route | None | None | Candidate E2E PASS | PASS demo |
| Timeout | expiry guards + finalization | Unit PASS | None | Timeout E2E PASS | PASS demo |
| Server scoring | frozen snapshots | Unit PASS | Live smoke PASS | Result reached in E2E | PASS |
| Listening no-back | server invariant + disabled UI | Unit PASS | None | Candidate E2E PASS | PASS demo |
| Candidate answer-key secrecy | strips `answer`/`explanationVi` | No dedicated test | Live smoke: 0 leak fields | Implicit | PARTIAL/PASS smoke |
| Question ID collision | approval check | `question-integrity.test.ts` | None | None | PASS unit only |
| Duplicate questions | trigram similarity | Basic near-vs-far test | No full factory test | None | PARTIAL |
| Semantic QA | mock/HTTP provider | Factory QA fixture only | None | Admin E2E does not assert semantic behavior | PARTIAL |
| TTS approval gate | audio render error + QA | `factory-qa.test.ts` PASS | No real TTS/storage | Admin E2E FAILS before render | FAIL release gate |
| Admin publish | seeded generator/frozen save | Generator unit PASS | No DB immutability test | Intended journey currently blocked/fails | PARTIAL |
| Candidate full exam | ExamClient + APIs | Supporting units | Live smoke PASS | Candidate E2E PASS | PASS demo |
| Registration/login/refresh/recovery | auth BFF routes | None | No disposable Supabase | Dev login only | FAIL production confidence |
| Migrations/RLS/RPC/storage | SQL + repository | None | None | None | FAIL production confidence |
| Import validation | parser/QA endpoint | None | None | No Admin UI | FAIL coverage |
| Rate limiting/provider timeout | Not implemented | None | None | None | FAIL |

### Current automated-run status

- Local pre-audit QA previously completed with typecheck, 18/18 unit tests, and production build on the same source family before the Next.js patch.
- Vercel production build for current `main` succeeds.
- GitHub Actions run `31956719843`: `qa` stage passed sufficiently for `e2e` to run; Candidate normal and timeout journeys passed; Admin Factory journey failed twice at `Render TTS audio` visibility.
- Therefore the repository's own definition of a green release is **not currently met**.

## 9. Technical Debt and UI Classification

### P0 — directly affects taking an exam / safe operation

- Missing Listening audio and non-functional Audio Check.
- Dev authentication and shared identities on public production.
- Non-durable production repository.
- Red CI Admin Factory/Publish journey.
- Only 8 questions; no repeatable/realistic exam inventory.
- Autosave failure has no robust retry/submit synchronization.

### P1 — product quality

- No post-submit question review/explanations.
- Admin Dashboard fake/stale metrics.
- Question Bank lacks actual editor, taxonomy, import UI, revision/audit workflow.
- Factory human review cannot edit or reject with structured reasons.
- One hard-coded exam ID/latest-only candidate experience.
- Basic heuristic QA cannot substantiate Japanese naturalness, level, ambiguity, or distractor quality.
- No real-provider, Supabase, storage, migration, load, or recovery integration coverage.
- No rate limits, structured logs, monitoring, provider timeout/retry/queue.

### P2 — polish

- Learner-facing version/build/API/server/QA terminology.
- Mixed Vietnamese/English/Japanese interface copy without a deliberate localization model.
- Generic loading/empty/error screens and no custom 404/500.
- Legacy dead/duplicate modules and stale docs (`admin-store`, client `scoring`, old localStorage architecture claims).
- Repository includes a redundant source ZIP and lacks a package lockfile.

## 10. Product Completion Roadmap

No milestone below authorizes implementation. Each should begin only after this audit is reviewed.

### P0 — Production blockers

- **Objective:** make the deployed system safe, durable, playable, and release-green.
- **Files/modules affected:** Vercel env; `lib/server/auth.ts`, repositories, auth/session routes, `ExamClient.tsx`, `public/audio`/storage, E2E/CI.
- **Tasks:** configure disposable then production Supabase; apply/validate migrations; disable dev auth; establish real admin; verify storage; replace/bypass broken Listening items until real audio exists; implement working audio check; diagnose Admin E2E; add autosave retry/pending-submit guard; add lockfile.
- **Acceptance:** `/api/v1/system` reports Supabase auth/repository/storage and non-mock production providers as applicable; no role switch; all Listening items play; CI fully green; data survives redeploy/concurrency.
- **Tests:** Supabase auth/ownership/RPC/storage integration, full Candidate/Admin Playwright, asset HTTP checks, migration smoke.
- **Risk:** high—auth/data migration and accidental public dev access.
- **Complexity:** L.

### P1 — Content foundation

- **Objective:** establish a defensible taxonomy, editorial rubric, and content plan before bulk authoring.
- **Files/modules affected:** new taxonomy/content docs, `lib/types.ts`, `lib/admin-types.ts`, import templates, QA rules, Admin Question Bank/Factory.
- **Tasks:** approve controlled categories/topics/Can-do/difficulty; map 8 items; define Japanese/native review checklist, provenance/license fields, approval roles, answer-position and distractor rules; specify target matrix.
- **Acceptance:** every approved item has complete canonical metadata and review evidence; no free-form tag is used as a substitute for core taxonomy.
- **Tests:** schema/import validation, lifecycle transition tests, taxonomy fixture validation.
- **Risk:** medium—premature schema design can encode a poor content model.
- **Complexity:** M.

### P2 — Question Bank expansion

- **Objective:** create enough reviewed non-Listening inventory for varied forms.
- **Files/modules affected:** Question Bank data/database, editor/import UI, factory prompts/providers, duplicate QA.
- **Tasks:** build real editor/import preview; author by target matrix; independent language/content review; expand duplicate detection; balance answer positions; capture provenance.
- **Acceptance:** at least 3–5× pool depth for every intended exam selection cell; zero blocking QA; sampled native review pass; multiple versions show controlled variety.
- **Tests:** bulk import transaction/collision tests, generator balance/exposure tests, content lint reports.
- **Risk:** high—quantity can outrun editorial quality.
- **Complexity:** L.

### P3 — Listening content

- **Objective:** deliver real Japanese listening practice with traceable scripts and playable assets.
- **Files/modules affected:** TTS provider/storage, asset metadata/schema, Factory review, Exam audio UX.
- **Tasks:** select licensed voice/provider; define speech-speed/voice rubric; create scripts; render/store audio; verify transcript-answer alignment; set replay/preload/failure policy; real audio check.
- **Acceptance:** 100% approved Listening items have playable durable audio, reviewed scripts, voice/duration metadata, and no mock tones/sample paths.
- **Tests:** provider contract, storage authorization, audio MIME/duration/playability, browser playback/fallback, TTS gate E2E.
- **Risk:** high—cost, pronunciation, licensing, and CDN access.
- **Complexity:** L.

### P4 — Exam realism

- **Objective:** assemble representative, varied practice forms without claiming official equivalence.
- **Files/modules affected:** blueprint/domain/generator, Admin Exam Builder, candidate exam catalog/instructions.
- **Tasks:** support multiple blueprints; target approximately 50 items/60 minutes only where content supports it; balance taxonomy cells; add exposure controls and preview; validate navigation/replay rules against documented public sources.
- **Acceptance:** multiple forms meet approved blueprint constraints, contain no duplicates, and have adequate pool headroom; all claims remain “unofficial practice”.
- **Tests:** deterministic constraints, property tests for selection balance, multi-version exposure tests, full 50-item E2E/performance.
- **Risk:** medium/high—false realism claims and pool exhaustion.
- **Complexity:** L.

### P5 — Result and Learning UX

- **Objective:** turn scores into safe, useful learning feedback.
- **Files/modules affected:** result API/domain, `ResultClient`, `AttemptDetailClient`, Question explanations.
- **Tasks:** post-submit item review contract; show response/correct answer/explanation only after authorization and submission; topic/Can-do breakdown; retry/study recommendations; feedback/report-content workflow.
- **Acceptance:** learners can understand errors without pre-submit leakage; history reproduces the frozen version and explanation used for that attempt.
- **Tests:** result ownership/leakage, submitted-only review, frozen explanation regression, accessibility/browser tests.
- **Risk:** medium—answer exposure and unsupported score interpretation.
- **Complexity:** M/L.

### P6 — Production hardening

- **Objective:** make operation observable, resilient, abuse-resistant, and maintainable.
- **Files/modules affected:** API middleware/helpers, providers, CI, monitoring, error boundaries, deployment/runbooks.
- **Tasks:** rate limits; request size limits; provider timeouts/retries/idempotency/background jobs; structured logs/correlation IDs; alerts; custom 404/500; backup/restore; secret rotation; migration promotion; load tests; dependency update policy; remove legacy code/stale labels.
- **Acceptance:** documented SLOs and runbooks; load and failure-injection targets pass; no secrets in client/build; recovery and rollback rehearsed.
- **Tests:** abuse/rate-limit, timeout/fallback, queue/idempotency, load/concurrency, backup restore, security regression.
- **Risk:** medium—operational complexity.
- **Complexity:** L.

## Audit Definition of Done

- Important conclusions cite concrete source functions/files, schemas, live responses, or CI runs.
- Implemented, mock, planned, and production-unverified behavior are separated.
- Repository-backed Question Bank statistics and duplicate scan are recorded.
- Production blockers and DEV ONLY behavior are explicit.
- QA coverage matrix includes the requested integrity and journey requirements.
- Roadmap is prioritized with objective, scope, tasks, acceptance, tests, risk, and complexity.
- No production code, schema, migration, or production data was changed during the audit.

