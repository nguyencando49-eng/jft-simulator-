# Curriculum factory QA report

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
