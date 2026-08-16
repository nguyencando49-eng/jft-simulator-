# V5.1 Listening Factory

V5.1 closes the Listening production loop while keeping AI output behind human approval.

## Pipeline

Generation Brief → Generation Provider → Structural QA → Semantic QA → Similarity/Duplicate QA → TTS Render → Asset Storage → Human Preview → Approval → Question Bank.

## Approval gates

A Listening candidate cannot be approved unless all of these are true:

1. Base question schema passes.
2. Semantic QA passes (minimum provider score 65).
3. No near-duplicate collision is found inside the batch or against Question Bank.
4. An audio script exists.
5. The script has been rendered and `question.audioSrc` points to a playable asset.
6. Human reviewer explicitly selects and approves the candidate.

## Provider adapters

- `AI_FACTORY_PROVIDER`: question generation (`mock` or `http`).
- `AI_QA_PROVIDER`: second-model/semantic review (`mock` or `http`).
- `TTS_PROVIDER`: audio synthesis (`mock` or `http`).

The mock TTS produces a short WAV tone only to validate the end-to-end state machine. It is not Japanese speech and must never be used for published production content.

An HTTP TTS provider may return raw `audio/*` bytes, `{ audioUrl }`, or `{ audioBase64, contentType }`.

## Storage

When Supabase service credentials are configured, generated audio is uploaded to `EXAM_ASSET_BUCKET` and `audioSrc` uses the public storage URL (or `EXAM_ASSET_PUBLIC_BASE_URL`). The exam asset bucket must therefore be readable by candidates, or a CDN/public proxy must be supplied.

In `AUTH_DISABLED=true` development mode, audio is stored as an inline data URL so the full flow can run without infrastructure.

## Duplicate detection

V5.1 uses normalized character trigram Jaccard similarity. It checks:

- candidate vs candidate inside the current job;
- candidate vs existing Question Bank prompts.

This is intentionally a QA gate, not a perfect plagiarism detector. A future release can replace it with embedding similarity without changing the Factory API contract.
