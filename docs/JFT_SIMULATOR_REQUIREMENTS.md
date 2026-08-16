# JFT Simulator Requirements

## Product goal
Build an unofficial CBT practice simulator that reproduces the *interaction model* of JFT-Basic while using independently authored questions, audio and visual assets.

## Current official constraints used by this project
- CBT examination.
- Approximately 50 questions / 60 minutes in the production target.
- Four sections: Script and Vocabulary; Conversation and Expression; Listening Comprehension; Reading Comprehension.
- From August 2026 the assessment reports A1, A2.1 and A2.2 (A2); the Japan Foundation states this does not change the test method, structure, or question level.

Official references:
- https://www.jpf.go.jp/jft-basic/e/about/index.html
- https://www.jpf.go.jp/jft-basic/e/notice/
- https://www.prometric-jp.com/en/ssw/test_list/archives/1
- https://www.prometric-jp.com/en/examinee/procedure/

## MVP acceptance criteria
1. Candidate can start a timed test.
2. Refresh restores current answer state and original expiration time.
3. Candidate can answer multiple-choice questions across all four sections.
4. Listening question type supports an audio source field.
5. Candidate can move Back/Next in demo mode.
6. Timer auto-submits when it reaches zero.
7. Result screen reports total score, estimated practice level, and per-section performance.
8. UI clearly says it is unofficial and must not use protected JFT/Prometric branding assets.

## Production backlog
- Exact navigation behavior per official navigation supplements.
- Admin question editor and import/export JSON.
- PostgreSQL + Prisma question bank.
- Secure server-side exam sessions.
- Audio replay limits and preload policy.
- Image-choice questions.
- Your Language translation overlay.
- Question blueprint generator (~50 questions).
- Tag/difficulty analysis.
- Auth, payments, entitlement and exam history.
- Anti-cheat telemetry appropriate for practice mode.
