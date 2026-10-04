# JFT Simulator — Production 3000

Unofficial JFT-style CBT practice simulator with a controlled 3,000-question bank, immutable exam versions, account-backed candidate sessions, and an AI-assisted Question Factory.

> This project is not affiliated with or certified by the Japan Foundation or Prometric. The A1 / A2.1 / A2.2 labels are internal practice tiers, not an official score prediction or official exam calibration. Never ingest leaked/live exam content.

## Production release

The controlled repository bank contains exactly:

- A1: 1,000 questions
- A2.1: 1,000 questions
- A2.2: 1,000 questions
- Total: 3,000 questions

The v3 release pack defines 60 immutable practice forms: 20 for each of A1, A2.1 and A2.2. IDs run from `JFT-PRACTICE-A1-001-v3` to `JFT-PRACTICE-A1-020-v3`, with equivalent ranges for `A2-1` and `A2-2`.

Within each level, forms overlap by at most one question. Non-Listening questions are not reused across forms; Listening exposure is at most two forms per question. Source deployment alone does not publish these snapshots: run the release operation and confirm the persisted catalog using the production smoke test. Existing v2 snapshots and learner attempts remain intact.

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
supabase/migrations/20260927041219_session_progress_compare_and_swap.sql
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

### Native Azure QA2–QA7

Each specialized provider supports `mock`, `http`, and `azure-openai`. Set `ANSWER_ORACLE_PROVIDER`, `JAPANESE_NATURALNESS_PROVIDER`, `CURRICULUM_GROUNDING_PROVIDER`, `JFT_ALIGNMENT_PROVIDER`, `DIFFICULTY_CALIBRATION_PROVIDER`, and `ORIGINALITY_DUPLICATE_PROVIDER` to `azure-openai` to use native Azure chat-completions without an external adapter service.

Azure uses the existing shared `AOAI_ENDPOINT`, `API_KEY`, and `AZURE_OPENAI_DEPLOYMENT` settings (or `AI_QA_ENDPOINT`, `AI_QA_API_KEY`, `AI_QA_MODEL`). Optional per-judge overrides are `<PREFIX>_AZURE_ENDPOINT`, `<PREFIX>_AZURE_API_KEY`, and `<PREFIX>_MODEL`. Generic `<PREFIX>_ENDPOINT`/`<PREFIX>_API_KEY` remain reserved for HTTP adapters.

Missing credentials block authoring readiness. Outputs still pass the existing validators and release policies; provider failures remain review/block conditions. `authoringReady` describes configuration, not a successful live provider call or human approval. Enabling real providers does not re-audit the existing bank automatically; run a controlled sample and review evidence before bulk QA.


## Publish the Production 3000 data release

After the Supabase schema and production environment are configured:

```bash
npm run release:production
```

This operation is idempotent. It imports/updates the controlled 3,000-question bank, publishes all 60 v3 production exam snapshots, skips matching snapshots that already exist, and refuses to overwrite a conflicting immutable version.

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

The smoke journey requires all 60 v3 forms across the three-level catalog, 48-question A1 exam, autosave/resume, active-answer secrecy, Listening audio, submit/idempotency, result review and history.

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

The controlled-bank release tests also enforce the 3,000-item invariant, per-level balance, metadata, audio presence, duplicate safeguards and minimum task-blueprint diversity (2 Vocabulary, 8 Conversation, 3 Listening, 4 Reading blueprints).

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
