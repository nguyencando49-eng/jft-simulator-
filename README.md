# JFT Simulator V5.1.2 E2E QA Factory

Unofficial JFT-style CBT practice simulator + versioned Question Factory + server backend + account authentication.

> This project is not affiliated with Japan Foundation or Prometric. Demo questions are original practice content and the project must not ingest leaked/live exam content.

## Current production-oriented scope

### Candidate
- Candidate registration and password recovery
- Profile/settings and per-attempt history detail
- `/login` account sign-in
- `/candidate` portal with available exam, active-session resume and exam history
- CBT flow with server timer/session recovery
- answer autosave and server-side scoring
- candidate ownership checks on every session/result mutation

### Admin
- Admin role management for user profiles
- role-protected `/admin/*`
- Question Bank lifecycle and QA gate
- Exam Builder + immutable ExamVersion publish
- Attempts analytics
- `/admin/candidates` candidate/account activity
- `/admin/system` runtime/backend status

### Backend
- Repository abstraction: in-memory dev fallback or Supabase/PostgreSQL
- Supabase Auth password login through server BFF routes
- HttpOnly access/refresh cookies; browser storage does not hold auth tokens
- automatic access-token refresh
- `profiles` projection for account/admin analytics
- server-only service-role access
- immutable exam snapshots and server scoring

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

With `AUTH_DISABLED=true`, the simulator intentionally uses the in-memory repository and `/login` provides a development role switch (Candidate/Admin).

Open:
- Login: `http://localhost:3000/login`
- Candidate portal: `http://localhost:3000/candidate`
- Admin: `http://localhost:3000/admin`
- Runtime: `http://localhost:3000/admin/system`

## Production setup

1. Run `supabase/migrations/0001_v4_core.sql`.
2. Run `supabase/migrations/0002_v4_2_auth_profiles.sql`.
3. Create Supabase Storage bucket `exam-assets`.
4. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Set `AUTH_DISABLED=false`.
6. Assign `app_metadata.role=admin` only to administrative Supabase users. All other users are treated as candidates.

The service-role key is server-only. Never expose it via `NEXT_PUBLIC_*`.

## Core architecture

```text
Supabase Auth
    -> HttpOnly session cookies
    -> role boundary
        -> Candidate Portal -> CandidateSession -> autosave -> server scoring
        -> Admin -> Question QA -> Exam Blueprint -> immutable ExamVersion
```

Published exam versions are insert-only snapshots. Editing Question Bank content or navigation rules does not mutate an already-published exam.

## Documentation
- `docs/JFT_SIMULATOR_REQUIREMENTS.md`
- `docs/EXAM_ENGINE_V2.md`
- `docs/V3_QUESTION_FACTORY.md`
- `docs/V4_BACKEND.md`
- `docs/V4_1_API_INTEGRATION.md`
- `docs/V4_2_AUTH_ACCOUNTS.md`
- `docs/V4_3_ACCOUNT_LIFECYCLE.md`
- `docs/API_V1.md`
- `docs/V5_AI_QUESTION_FACTORY.md`
- `docs/V5_1_LISTENING_FACTORY.md`
- `docs/V5_1_1_QA_FACTORY.md`
- `docs/V5_1_1_QA_REPORT.md`
- `docs/V5_1_2_E2E_QA.md`
- `docs/V5_1_2_E2E_QA_REPORT.md`


## V4.3

V4.3 adds candidate registration, email-verification-ready signup, password recovery, profile settings, account-backed attempt detail, admin role management, and explicit session-expiration UX. See `docs/V4_3_ACCOUNT_LIFECYCLE.md`.

## V5 — AI Question Factory

Admin route `/admin/factory` adds a controlled Generate → Automated QA → Human Review → Question Bank pipeline. The default `mock` provider requires no API key. Production AI can be connected through the provider-neutral HTTP adapter documented in `docs/V5_AI_QUESTION_FACTORY.md`.

## V5.1 Listening Factory

V5.1 adds a second semantic QA pass, near-duplicate detection, TTS rendering, generated-audio storage and listening preview. AI-generated questions remain in human review and Listening items cannot be approved until a playable audio asset exists. See `docs/V5_1_LISTENING_FACTORY.md`.

## V5.1.1 QA gate

V5.1.1 hardens exam/session integrity and introduces an automated release gate (`typecheck → test → build`). See `docs/V5_1_1_QA_FACTORY.md`.


## V5.1.2 browser E2E gate

V5.1.2 adds Playwright journeys for Candidate CBT, timeout auto-finalize, and Admin Factory → TTS → approve → publish. CI now runs browser E2E only after typecheck/unit/build are green. See `docs/V5_1_2_E2E_QA.md`.
