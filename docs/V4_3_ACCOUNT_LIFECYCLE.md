# V4.3 Account Lifecycle & Exam History

V4.3 completes the first production-oriented account lifecycle around the V4.2 HttpOnly-cookie authentication boundary.

## Added flows

- Candidate registration (`/register`) with Supabase email verification support.
- Forgot-password request (`/forgot-password`).
- Recovery password update (`/reset-password`) for recovery links carrying an access token.
- Candidate profile/settings (`/candidate/profile`).
- Account-backed exam history detail (`/candidate/history/:sessionId`).
- Admin role management with server-side Supabase Admin API update.
- Stale active sessions are marked `expired` when read after `expiresAt`.
- Explicit expired-session UX in the CBT client.

## Security boundary

Browser credentials remain behind HttpOnly cookies. Candidate pages never receive the service-role key or answer keys. Role mutation is an admin-only server endpoint and writes both `auth.users.app_metadata.role` and the local profile mirror.

## Production recovery note

This repository intentionally avoids the Supabase JavaScript SDK. The reset page accepts a recovery `access_token` delivered in the redirect URL fragment. If the Supabase project is configured for PKCE/code-based recovery, add a server-side code exchange callback before production launch.

## Routes

- `POST /api/v1/auth/signup`
- `POST /api/v1/auth/recover`
- `POST /api/v1/auth/reset`
- `GET/PATCH /api/v1/profile`
- `PATCH /api/v1/admin/candidates/:id`

## Next milestone

V5 should focus on the AI Question Factory rather than adding more account plumbing: generation, distractors, audio scripts/TTS, automated QA, review, approval and exam assembly.
