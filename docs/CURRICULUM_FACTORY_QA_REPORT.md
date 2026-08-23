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

## Live Supabase pilot — 2026-08-23

This pilot exercised the deployed persistence path after Supabase migrations `0001`–`0007` were applied. It used the synthetic `Hospital reception pilot` source and the configured deterministic mock providers; it did not use copyrighted textbook content.

- Source: 1 selected document (a duplicate import remains untouched).
- Chunking: 1 chunk.
- Knowledge extraction: 1 A1 KnowledgeUnit. The raw deterministic extraction was rejected at the human checkpoint because it split Japanese words and omitted grammar/expressions.
- Human review: the KnowledgeUnit was corrected against the synthetic source, retained its mock-provider provenance, and was explicitly approved.
- Planning: 4 items, one per canonical section, with canonical categories `word_usage`, `expression`, `conversation`, and `information_search`.
- Existing Factory: 4 jobs and 4 candidates; no candidate was approved into the Question Bank.
- Listening: 1 candidate; production audio was not generated because earlier QA gates blocked release.

| Gate | Pass | Review | Fail |
| --- | ---: | ---: | ---: |
| QA1 General Content | 0 | 1 | 3 |
| QA2 Answer Oracle | 0 | 0 | 4 |
| QA3 Japanese Naturalness | 4 | 0 | 0 |
| QA4 Curriculum Grounding | 0 | 1 | 3 |
| QA5 JFT Alignment | 0 | 2 | 2 |
| QA6 Difficulty Calibration | 1 | 3 | 0 |
| QA7 Originality / Duplicate | 4 | 0 | 0 |

Pilot release decision: **BLOCKED**. The deterministic generator produces generic questions that do not reliably measure the reviewed Can-do, while the deterministic QA2 provider only recognizes literal answer evidence and cannot independently solve these item forms. No score or QA failure was silently relaxed, and the 2,100-question review set was not imported into the live Question Bank.

Two implementation defects found by the pilot were fixed:

- the mock planner now emits canonical section/category pairs;
- the QuestionPlan bridge keeps originality instructions in `sourceGuidance` instead of leaking them into the learner-visible topic.

Production remains blocked until a production-capable generation/judge provider is configured and a new small pilot produces human-reviewable candidates without QA2/QA4/QA5 hard failures.

## Live review-bank import — 2026-08-23

After explicit human authorization to continue beyond the pilot, batch `JFT-2100-V1` was imported into the production Supabase Question Bank:

- Total imported: 2,100.
- A1: 700; A2.1: 700; A2.2: 700.
- Status after import: 2,100 `review`, 0 automatically approved.
- The import is idempotent and preserves any question that is already `approved` or `archived` on a later rerun.
- Q0 structural validation must pass before any database write.
- The stronger independent audit remains: PASS 0, REVIEW 965, FAIL 1,135, hard failures 640. Import into the review workspace does not override those verdicts.
- Admin Console was localized to Vietnamese and Question Bank rendering was paginated at 50 rows per page for this inventory size.
- The one-time automation token used for the production import was removed immediately after completion; normal Admin authentication remains required.

This import makes the candidates human-reviewable in production. It does **not** make the level banks exam-ready and does not authorize mass approval or publication.
