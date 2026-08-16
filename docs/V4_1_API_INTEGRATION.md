# V4.1 — UI ↔ API Integration

V4.1 removes localStorage as the source of truth for admin content and candidate answers.

## Candidate flow

1. `GET /api/v1/exams/published` resolves the latest immutable ExamVersion.
2. `POST /api/v1/sessions` creates a server-timed CandidateSession.
3. The response strips `answer` and `explanationVi` from every question.
4. `PUT /api/v1/sessions/:id/answers` autosaves answers and current position.
5. Refresh uses `GET /api/v1/sessions/:id` to resume the same session.
6. `POST /api/v1/sessions/:id/submit` scores against the frozen answer key on the server.
7. `GET /api/v1/sessions/:id/result` returns the reproducible result.

Only the opaque active `sessionId` is cached in browser localStorage. It is a resume pointer, not exam state.

## Admin flow

- Question Bank loads and writes through `/api/v1/questions`.
- Exam Builder loads/saves/publishes through `/api/v1/exams`.
- Attempts reads real `candidate_sessions` through `/api/v1/attempts`.
- System reads runtime mode through `/api/v1/system`.

`lib/admin-store.ts` remains only as a V3 migration/legacy artifact and is no longer imported by V4.1 UI.

## Immutable behavior

`ExamVersion` now snapshots both question content and section rules. Navigation behavior such as `allowBack` is therefore versioned together with the questions.

## Production note

The browser API client currently assumes development auth or same-origin auth plumbing. Before public deployment with Supabase Auth, add a client session/token provider that attaches the candidate/admin bearer token to `lib/api-client.ts` requests.

### Upgrade compatibility

V4 ExamVersion payloads did not contain `rules`. V4.1 candidate routes fall back to the original section behavior when reading those old payloads, while every newly published V4.1 ExamVersion freezes `rules` explicitly.

### Auth token plumbing

`lib/api-client.ts` exports `setApiAccessToken(token)`. A later login screen can hand its Supabase access token to this function without changing any Admin/Candidate API call site.
