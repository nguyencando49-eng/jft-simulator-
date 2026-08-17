# Curriculum factory QA report

## Controlled 2,100-question production run (2026-08-18)

- Total repository production set: 2,100 questions.
- Per level: A1 700, A2.1 700, A2.2 700.
- Per section within each level: 175 Script/Vocabulary, 175 Conversation/Expression, 175 Listening, 175 Reading.
- Existing approved seed: 50 questions. The A1 pilot contributes 20 additional review candidates to the production set.
- New mass-production candidates: 2,030, all held at `REVIEW`; AI did not self-approve them.
- Curriculum catalog: 52 KnowledgeUnits sourced from `入門`, `初級1`, and `初級2` materials. Mapping these books to A1/A2.1/A2.2 is a simulator design decision.
- Provenance: every mass candidate records one KnowledgeUnit ID and its source document.
- Structural QA: pass for 2,030/2,030 before audio and after fixed audio generation.
- Exact duplicate prompts: 0.
- Near-duplicate prompts at n-gram Jaccard 0.82: 0.
- Listening: 508 new fixed MP3 assets generated with Azure `ja-JP-NanamiNeural`, rate `-5%`; existing seed and pilot audio remain unchanged.
- Audio format: 24 kHz, 48 kbit/s mono MP3; total generated size approximately 53.46 MB.
- Release status: human review required. These are unofficial simulator questions with uncalibrated practice difficulty.

### Independent JFT_CONTENT_QA_V1 audit

The stronger independent judge supersedes structural-pass language as a release decision. It audited all 2,100 questions without editing them:

- PASS: 0.
- REVIEW: 965.
- FAIL: 1,135.
- Hard failures: 640.
- Eligible for automatic Question Bank admission: 0.
- Major evidence: 456 answer-leakage findings, 251 answer-key mismatches, 507 low-quality distractor findings, 44 out-of-curriculum findings, and missing source-originality evidence for all 2,100 items.
- Release decision: BLOCKED. Structural, audio and n-gram duplicate checks passed, but they are insufficient evidence of valid assessment quality.
- Machine-readable report: `data/qa/jft-content-qa-v1-report.json`.

Implemented: canonical taxonomy; enriched KnowledgeUnits; approved-only multi-unit planning; provenance; curriculum hard-fail QA; originality; coverage/deficits; readiness; seeded assembly; reuse/overlap measurement; Azure Japanese WAV TTS; admin summary; migration and focused tests.

## QA run — 2026-08-17

- Typecheck: PASS.
- Unit/integration: 37/37 PASS across 12 files.
- Production build: PASS; 41 pages/routes generated.
- Browser E2E: 4/4 PASS after installing the Playwright Chromium runtime. Candidate navigation/submit, timeout, listening TTS/approval/publish, and Source → Knowledge → Plan → Existing Factory passed.

## Small A1 synthetic pilot

- One synthetic source; one small source range; deterministic mock provider; within the 20-KnowledgeUnit/30-question limits.
- Extraction returned structured knowledge without answer keys. Human approval was required before planning.
- Four plans/candidates reached Existing Factory Review. Nothing was auto-approved or mass-generated.
- Automated originality/duplicate/curriculum gates ran. Final naturalness and human rejection metrics require a Japanese reviewer; mock-provider monetary cost is zero and is not a production cost estimate.

## Current inventory and readiness

The bundled approved seed bank contains A1: 17, A2.1: 19, A2.2: 14. It predates curriculum provenance, so all levels are `NOT_READY` for a grounded 20-exam release. To reach the simulator design target floor of 700 approved questions, the simple quantity gaps are A1: 683, A2.1: 681, A2.2: 686; actual needs may be higher after section/category/Can-do/audio constraints.

Mass generation has not started and awaits human pilot approval.
