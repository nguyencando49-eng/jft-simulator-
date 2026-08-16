# V4.2 — Authentication & Accounts

## Goal
V4.2 turns the API-backed simulator into an account-aware application. Authentication is handled through server routes so browser code never needs the Supabase service-role key and no access token is stored in localStorage/sessionStorage.

## Authentication flow

```text
/login
  -> POST /api/v1/auth/login
  -> Supabase Auth password grant (production)
  -> HttpOnly access + refresh cookies
  -> /api/v1/auth/me
  -> role guard
      admin     -> /admin/*
      candidate -> /candidate, /exam, /result
```

`AUTH_DISABLED=true` activates development auth emulation. The login page lets the developer switch between candidate/admin roles and stores only development identity cookies.

## New API routes
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/admin/candidates`
- `GET /api/v1/sessions` (candidate-owned attempt history)

## Account model
`profiles` stores a server-managed projection of authenticated users:
- `id`
- `email`
- `display_name`
- `role`
- `created_at`
- `last_seen_at`

Roles come from Supabase `app_metadata.role`. Any user without `admin` is treated as `candidate`.

## Candidate portal
`/candidate` shows:
- latest published exam
- active attempt / resume action
- completed attempt count
- best score
- attempt history

The exam bootstrap first tries a local session hint, then asks the server for the authenticated candidate's active session. Therefore refresh and cross-device resume no longer depend on one browser's localStorage.

## Admin candidates
`/admin/candidates` aggregates profile and session data. It reports attempts, active sessions, completed sessions, average score and last attempt time.

## Security decisions
- access token: HttpOnly cookie
- refresh token: HttpOnly cookie
- service role: server only
- answer key: never returned to candidate browser
- candidate session ownership: checked by authenticated `userId`
- admin routes: require `app_metadata.role=admin`

## Migration
Run `supabase/migrations/0002_v4_2_auth_profiles.sql` after the V4 core migration.
