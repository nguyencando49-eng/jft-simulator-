# V5.1.2 E2E QA Report

## Scope

This release adds real-browser coverage for the two critical product paths: Candidate CBT and Admin Question Factory.

## Added gates

- Playwright Chromium configuration.
- Candidate autosave + account-backed resume journey.
- Listening no-back browser assertion.
- Deadline auto-finalize browser journey.
- Server-scored result browser assertion.
- Admin AI Factory generation → TTS → approval journey.
- Admin Exam Builder publish browser assertion.
- CI E2E job that runs only after the existing QA job succeeds.

## Test-only production safety

`E2E_TEST_MODE` defaults to false. Session-duration override is ignored whenever `NODE_ENV=production`, even if the environment flag is accidentally present.

## Validation in this build environment

The source and workflow are statically reviewed and `git diff --check` is expected to pass. Full Playwright execution requires installing Next/React/Playwright dependencies and the Chromium binary. The current artifact environment has no `node_modules`, so the definitive browser execution is delegated to the GitHub Actions E2E job or a local machine with dependencies installed.
