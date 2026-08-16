# V4 Backend Architecture

V4 moves persistence and exam delivery behind server APIs. The browser no longer needs to know whether data is in memory or PostgreSQL.

## Runtime modes

- **Development fallback:** no Supabase environment variables -> process-local `MemoryRepository` seeded from V3 data.
- **Production:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` -> `SupabaseRepository` through PostgREST.
- Service role keys are server-only and must never be exposed through `NEXT_PUBLIC_*` variables.

## API contract

- `GET /api/v1/questions` admin list
- `POST /api/v1/questions` admin upsert after deterministic QA
- `GET /api/v1/exams?id=...` draft + immutable versions
- `PUT /api/v1/exams` save draft
- `POST /api/v1/exams` publish immutable version
- `POST /api/v1/sessions` candidate starts a versioned exam
- `PUT /api/v1/sessions/:id/answers` server autosave with expiry/ownership checks
- `POST /api/v1/sessions/:id/submit` server-side scoring against frozen answers
- `POST /api/v1/import/questions` JSON or CSV bulk import + QA
- `POST /api/v1/assets` admin upload to Supabase Storage

## Security boundary

Candidate session creation strips `answer` and `explanationVi` before returning question snapshots. Correct answers remain server-side in the frozen exam version. Production auth resolves Supabase access tokens and enforces `app_metadata.role` for admin routes.

## QA gate

Imported/saved questions are checked for required prompt, choice count, valid answer index, duplicate choices, required listening audio, and explanation warning. Only rows without QA errors are accepted by bulk import.

## Persistence invariant

Published `ExamVersion` is insert-only. Question edits never mutate historical versions. Candidate sessions reference an exact version and keep autosaved answers server-side.

## V5 boundary

V5 should add AI-assisted question generation/TTS as producers into the existing `draft -> QA -> review -> approved` pipeline; it should not bypass V4 APIs or immutable publishing.
