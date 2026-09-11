# A2.1 Staging Release Candidate Local Gate

Classification: A21_LOCAL_STAGING_READY_FOR_CHECKPOINT

- Count: 334
- Unique IDs: 334
- Release hash: 698860254d6a7a50e33aa214b4e908fce4de7cc8a789a9c185dba056ead069d7
- Sections: {"script_vocabulary":87,"conversation_expression":80,"listening":87,"reading":80}
- Runtime provider: A21ReleaseBankProvider via loadReleaseBankForDraft()
- A1 regression: PASS
- TypeScript: PASS
- Tests: PASS (57 files / 340 tests)
- Build: PASS

## Listening runtime status

87 Listening records include prompt scripts and audioSrc placeholders. No audio was fabricated; this matches current product behavior for script-backed generated Listening records.

## Simulations

100 forms: 100 PASS / 0 FAIL.

1000 forms: 1000 PASS / 0 FAIL, 50000 instances, scoring mismatch 0, duplicate-within-form 0.
