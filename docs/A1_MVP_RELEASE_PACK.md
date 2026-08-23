# A1 MVP Content Release Pack

## Release status

**READY and published on 2026-08-23.**

- Production URL: `https://jft-simulator.vercel.app`
- Repository commit used for the successful smoke run: `44ab707`
- Blueprint: `JFT_A1_MVP_5X8_V1`
- Published immutable versions: `JFT-A1-01-v1` through `JFT-A1-05-v1`
- Five exams, eight questions per exam, two questions per section
- 17 unique approved A1 questions
- Maximum question reuse: three exams
- Maximum pairwise overlap: 3/8 (37.5%)

The eight-question composition, reuse ceiling and overlap ceiling are explicit
MVP simulator design decisions. They are not official JFT-Basic rules and these
mini exams do not claim to reproduce the official exam length or score scale.

## Approved content boundary

The release operation promoted exactly the 50 canonical independently authored
seed questions already marked approved in the repository. It did not approve AI
mass-production content.

Production status after synchronization:

- Approved authored seed: 50
- Approved A1 seed: 17
- Mass-production items remaining in human review: 2,050
- Mass items automatically approved: 0

The synchronization is idempotent and preserves an existing `approved` or
`archived` authored question. It hard-stops if a required A1 question is absent,
not approved, belongs to another level/section, or lacks Listening audio.

## Published exam snapshots

| Version | Question IDs |
| --- | --- |
| JFT-A1-01-v1 | SV-001, SV-003, CE-003, CE-004, LI-001, LI-005, RE-004, RE-005 |
| JFT-A1-02-v1 | SV-003, SV-004, CE-005, CE-012, LI-001, LI-003, RE-001, RE-004 |
| JFT-A1-03-v1 | SV-004, SV-005, CE-003, CE-005, LI-004, LI-005, RE-001, RE-005 |
| JFT-A1-04-v1 | SV-005, SV-012, CE-004, CE-012, LI-001, LI-004, RE-003, RE-005 |
| JFT-A1-05-v1 | SV-012, SV-001, CE-003, CE-012, LI-003, LI-005, RE-001, RE-003 |

## Azure Listening assets

`LI-001`, `LI-003`, `LI-004` and `LI-005` were synthesized again with Azure
Speech using `ja-JP-NanamiNeural` at `-5%`. The committed manifest records SHA-256
for every file. Automated release tests verify RIFF/WAVE, mono, 48 kHz, 16-bit PCM,
non-empty content and exact hash agreement.

## Production publication controls

Publication used a random 256-bit one-time Vercel secret. The endpoint required
either normal Admin authentication or an exact timing-safe match. The secret was
removed immediately after publication and production was redeployed without it.

The production learner smoke used a separate one-time Candidate-only secret. It
could not call Admin operations, did not create a fake Supabase profile and was
removed immediately after the smoke run. Production was redeployed again after
removal. Both secret names were confirmed absent from the final Vercel environment.

## Production smoke evidence

The headless browser exercised the stable production alias and passed:

- public landing page;
- Candidate dashboard with all five A1 cards;
- four public Azure audio assets;
- selected exam start;
- server autosave;
- reload and account-backed resume;
- Listening playback;
- active-session answer/QA leakage checks;
- full eight-question completion;
- result and answer review;
- repeated-submit idempotency;
- Candidate attempt history.

Final unauthenticated checks:

- landing: HTTP 200;
- Candidate catalog without authentication: HTTP 401;
- repository: Supabase;
- authentication: Supabase;
- providers: `azure-openai · semantic:azure-openai · tts:azure`.

## Remaining content limitation

The five exams are intentionally small and have up to 37.5% pairwise ID overlap
because only 17 A1 questions have completed approval. Reducing overlap and moving
toward full-length practice exams requires additional original A1 questions to
pass QA1–QA7 and explicit human review. The 2,050 mass-review items are not a safe
shortcut.
