# JFT Simulator — Production 3000

Unofficial JFT-style CBT practice simulator with a controlled 3,000-question bank, immutable exam versions, account-backed candidate sessions, and an AI-assisted Question Factory.

> This project is not affiliated with or certified by the Japan Foundation or Prometric. The A1 / A2.1 / A2.2 labels are internal practice tiers, not an official score prediction or official exam calibration. Never ingest leaked/live exam content.

## Production release

The controlled repository bank contains exactly:

- A1: 1,000 questions
- A2.1: 1,000 questions
- A2.2: 1,000 questions
- Total: 3,000 questions

The initial production catalog contains three immutable practice forms:

- `JFT-PRACTICE-A1-001-v1`
- `JFT-PRACTICE-A2-1-001-v1`
- `JFT-PRACTICE-A2-2-001-v1`

Each form contains 48 questions (12 per section) and has a 60-minute practice timer.

## Candidate product

- registration, login, recovery and profile lifecycle
- practice catalog filtered by A1 / A2.1 / A2.2
- CBT flow across Script/Vocabulary, Conversation/Expression, Listening and Reading
- server-backed timer, autosave and session resume
- Listening no-back rule and bounded playback
- server-side scoring
- post-submit answer review
- account-scoped history
- learner APIs never expose the answer key while an attempt is active

## Admin product

- role-protected `/admin/*`
- Question Bank lifecycle
- Production 3000 release control
- immutable ExamVersion publishing
- Question Factory v5.2
- QA1–QA7 evidence gates
- TTS/audio generation
- source/curriculum pipeline
- attempts and candidate analytics
- explicit runtime readiness screen at `/admin/system`

## Local development

```bash
cp .env.example .env.local
npm install
npm run dev
```

With `AUTH_DISABLED=true`, local development uses the in-memory repository and a development role switch.

Useful routes:

- `/login`
- `/candidate`
- `/admin`
- `/admin/system`
- `/api/v1/system`

## Production infrastructure

Apply all SQL migrations in order from:

```text
supabase/migrations/0001_v4_core.sql
...
supabase/migrations/0007_factory_qa_evidence_rls.sql
```

Create the Supabase Storage bucket `exam-assets`, then configure the server-only values from `.env.production.example`, including:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- real Factory / semantic QA providers
- real QA2–QA7 providers
- real TTS provider
- `AUTH_DISABLED=false`

The service-role key and all provider secrets must remain server-side.

## Publish the Production 3000 data release

After the Supabase schema and production environment are configured:

```bash
npm run release:production
```

This operation is idempotent. It imports/updates the controlled 3,000-question bank, publishes the three v1 production exam snapshots, skips matching snapshots that already exist, and refuses to overwrite a conflicting immutable version.

The same operation is available to an authenticated admin at:

```text
GET  /api/v1/admin/production-release
POST /api/v1/admin/production-release
```

A server-side `PRODUCTION_IMPORT_TOKEN` may also authorize one-time release automation through the dedicated import-token header.

## Production smoke

Configure `PRODUCTION_SMOKE_TOKEN` and optionally `PRODUCTION_URL`, then run:

```bash
npm run smoke:production
```

The smoke journey verifies the real three-level catalog, 48-question A1 exam, autosave/resume, active-answer secrecy, Listening audio, submit/idempotency, result review and history.

## Release gate

GitHub Actions blocks release on:

```text
npm ci
→ TypeScript typecheck
→ production dependency security audit
→ unit/integration tests
→ Next.js production build
→ Playwright browser E2E
```

The controlled-bank release tests also enforce the 3,000-item invariant, per-level balance, metadata, audio presence and duplicate safeguards.

## Architecture

```text
Supabase Auth
  -> HttpOnly session cookies
  -> role boundary
      -> Candidate -> CandidateSession -> autosave -> immutable ExamVersion -> server scoring
      -> Admin -> Source/Factory -> QA1..QA7 -> Question Bank -> Production Release

GitHub
  -> QA Gate
  -> main
  -> Vercel deployment
```

Published ExamVersion snapshots are insert-only. Later edits to Question Bank content never mutate an existing published attempt contract.

## Key docs

- `docs/PRODUCTION_3000_PLAN.md`
- `docs/JFT_SIMULATOR_REQUIREMENTS.md`
- `docs/EXAM_ENGINE_V2.md`
- `docs/V4_BACKEND.md`
- `docs/V4_2_AUTH_ACCOUNTS.md`
- `docs/V5_AI_QUESTION_FACTORY.md`
- `docs/V5_1_LISTENING_FACTORY.md`
- `docs/V5_1_1_QA_FACTORY.md`
- `docs/V5_1_2_E2E_QA.md`
