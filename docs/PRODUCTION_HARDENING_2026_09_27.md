# Production Hardening Audit — 2026-09-27

## Scope

Repository: `nguyencando49-eng/jft-simulator-`  
Baseline: `main@2b8b025a87b579371db821f598f82f9cafb94509`  
Supabase project: `jft-simulator` (`wwwxzwfmlxuibsvoztnp`)  
Vercel project: `jft-simulator` (`prj_dqEkURBqnhHf3z42eGaSG1enhmkd`)

This audit supersedes the August prototype-era completion findings where they conflict with the current Production 3000 implementation.

## Current production evidence

- Latest GitHub Actions QA Gate on the baseline commit: PASS.
- GitHub Vercel commit status on the baseline commit: success.
- Supabase is ACTIVE_HEALTHY.
- Production question inventory: 3,000 approved questions, evenly split across A1, A2.1 and A2.2; 1,320 legacy A1 questions are archived.
- Current Production 3000 immutable forms exist for A1, A2.1 and A2.2.
- Production auth code cannot fall back to development identities when `NODE_ENV=production`.

## Hardening applied on 2026-09-27

Supabase migration `20260927040632_production_security_hardening` was applied and verified before this source file was committed.

### Direct Data API surface

The application repository accesses PostgREST through `SUPABASE_SERVICE_ROLE_KEY` on the server. Browser roles therefore do not need direct table access.

The migration:

- revokes public-table privileges from `anon` and `authenticated`;
- revokes direct EXECUTE on `rls_auto_enable()` and `save_session_progress(...)` from public/browser roles;
- keeps the session RPC executable by `service_role`;
- revokes permissive default privileges for future public tables, sequences and functions.

RLS remains enabled on the 14 application tables with no browser policies. In this architecture that is intentional deny-by-default defense in depth, not a request to add permissive policies.

### Data integrity

Nine constraints introduced as `NOT VALID` in V5.1.1 were checked against production data first. All violation counts were zero, then all nine constraints were validated successfully.

### Query performance

Covering indexes were added for all seven foreign keys identified by the Supabase performance advisor. The `unindexed_foreign_keys` advisor finding is now clear.

### Application error handling

The App Router now has learner-safe `error.tsx`, `global-error.tsx` and `not-found.tsx` boundaries so operational failures do not fall through to raw framework error surfaces.

## Security PR cleanup

Vercel PR #1 proposed upgrading Next.js from 15.4.6 to 15.4.10. Current `main` already runs Next.js 15.5.25, so the PR was obsolete and would have downgraded the framework. It was closed without merge.

## Remaining account-level actions

These cannot be completed with the currently authorized connectors:

1. **Supabase Auth leaked-password protection** — Supabase Security Advisor still reports it disabled. Enable it in the Supabase Auth password-security settings.
2. **Vercel observability authorization** — the connected Vercel account returns HTTP 403 for team scope `jft-simiulator`. Re-authorize that scope before relying on deployment/runtime-log inspection from ChatGPT.
3. **GitHub branch protection** — `main` is currently unprotected. Require the `QA Gate` checks before merge in repository rules/branch protection.

## Release rule

A source change is releaseable only after:

1. GitHub QA Gate passes typecheck, dependency audit, unit tests and build.
2. Playwright E2E passes.
3. Vercel status is successful.
4. Supabase advisors are reviewed after database changes.
