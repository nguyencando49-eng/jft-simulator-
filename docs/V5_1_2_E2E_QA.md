# V5.1.2 Browser E2E QA

V5.1.2 adds browser-level release journeys on top of the V5.1.1 integrity/unit gate.

## Release journeys

### Candidate CBT journey

1. Development login as Candidate.
2. Start latest immutable ExamVersion.
3. Answer and wait for server autosave acknowledgement.
4. Clear the browser session hint and reload.
5. Resume from the account-backed CandidateSession.
6. Enter Listening and verify Back is disabled after moving forward.
7. Complete the remaining sections.
8. Submit and load the server-scored result.

### Deadline journey

1. Start a CandidateSession with a test-only short duration.
2. Autosave at least one answer before the deadline.
3. Wait for the server-owned deadline.
4. Verify the UI auto-submits and reaches a result page.

The short duration is controlled by `jft-e2e-duration-seconds` only when `E2E_TEST_MODE=true` and `NODE_ENV !== production`. Production ignores this cookie.

### Admin factory journey

1. Development login as Admin.
2. Generate one Listening candidate with the deterministic mock provider.
3. Confirm the candidate cannot be approved before audio render.
4. Render mock TTS audio.
5. Verify audio preview is attached and QA is recalculated.
6. Approve the candidate into Question Bank.
7. Publish a new immutable ExamVersion.

## Playwright

```bash
npm run test:e2e
```

The Playwright server starts Next on port `3100` with:

```text
AUTH_DISABLED=true
AI_FACTORY_PROVIDER=mock
AI_QA_PROVIDER=mock
TTS_PROVIDER=mock
E2E_TEST_MODE=true
```

Tests run serially against Chromium because the in-memory development repository is intentionally process-local.

## CI release gate

GitHub Actions now has two stages:

```text
qa
  -> typecheck
  -> unit/integrity tests
  -> production build

e2e (needs qa)
  -> install Chromium
  -> Candidate browser journeys
  -> Admin Factory browser journey
```

A failed E2E run uploads the Playwright HTML report for seven days.
