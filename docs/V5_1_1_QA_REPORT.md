# V5.1.1 QA Report

Date: 2026-08-11

## Status

Core hardening checks: **PASS**

## Executed checks

- Backend/API/core TypeScript compile check with environment shims: PASS
- Whole-repo TS/TSX parse/transpile sanity (`tsc --noCheck`): PASS
- `git diff --check`: PASS
- Secret-pattern scan on tracked source: PASS (no committed service key/private key pattern found)
- Core QA smoke suite: **15/15 PASS**

Covered test functions/scenarios:

1. forged question ID and out-of-range choice rejection
2. forward answer+position autosave acceptance
3. no-back Listening answer mutation rejection after progression
4. no-back Listening navigation rejection
5. candidate ownership enforcement / admin override
6. expired session transition
7. deadline auto-finalizes saved answers
8. scoring ignores forged answer keys
9. seeded shuffle reproducibility
10. published versions rotate away from first-row selection
11. Question Bank ID collision detection
12. concurrent autosave merges answer keys
13. Listening QA blocks before audio render
14. Listening QA passes after valid audio render and semantic QA
15. duplicate similarity sanity (near > unrelated)

## Environment limitation

`npm install --no-audit --no-fund` timed out after 45 seconds in the current container. Therefore a real dependency-backed `vitest` run and `next build` could not be executed here. The repository now contains GitHub Actions `.github/workflows/qa.yml`; in a normal GitHub runner it installs dependencies and runs `typecheck → test → build`.

## Release blockers if CI is red

Do not publish/deploy when any of these are red:

- typecheck
- unit/integration tests
- Next build
- migration application on disposable Supabase

## Next QA work

- Playwright E2E for login → exam → autosave → timeout → result
- disposable Supabase migration/integration test
- PostgREST RPC concurrency load test
- AI Factory timeout/queue/load testing
- asset bucket authorization test
