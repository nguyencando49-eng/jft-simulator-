# Curriculum-Grounded JFT Content Factory — Implementation Plan

Status: implementation plan based on repository source audit on 2026-08-17.

This plan distinguishes **OFFICIAL_JFT_FACT** from **SIMULATOR_DESIGN_DECISION**. Source code is the current technical truth. The system remains an unofficial practice product.

## Current architecture

- Next.js 15 App Router with server BFF routes under `app/api/v1`.
- Admin/candidate authorization is enforced through `requireAuth`; Supabase service-role access stays server-side.
- `Repository` abstracts `MemoryRepository` and `SupabaseRepository`.
- Approved `QuestionRecord` objects feed `ExamDraft`; `generateExamVersion` creates frozen immutable snapshots used by candidate sessions and server scoring.
- Existing Question Factory flow: `FactoryRequest → FactoryProvider → semantic QA → structural QA → duplicate QA → optional TTS → human approval → Question Bank`.
- Existing source pilot: `SourceDocument → SourceChunk → KnowledgeUnit → human approval → QuestionPlan → runFactoryJob`.
- Existing originality V1 uses normalized trigram Jaccard against source chunks, current batch, and Question Bank.
- Existing TTS supports mock tone and a provider-neutral HTTP adapter. Production Japanese neural synthesis is not yet implemented directly.
- Existing CI is `typecheck → unit tests → build → Playwright E2E`.

## Reusable components

- Repository/service boundary and admin-only route pattern.
- Source document, chunk, knowledge, plan, and provenance persistence from migration `0005`.
- Mock/HTTP provider pattern for extraction, planning, generation, semantic QA, and TTS.
- Existing FactoryProvider and human Factory Review UI.
- Existing duplicate/source similarity primitives.
- Existing immutable ExamVersion and seeded shuffle primitives.
- Existing Supabase asset storage and Listening approval guard.
- Existing browser E2E fixtures and development auth mode.

## Missing or incomplete components

1. Canonical level/section/category/topic/difficulty constants; strings are currently scattered.
2. KnowledgeUnit fields for chapter, lesson, kanji, communication objective, and update/audit metadata.
3. Multi-KnowledgeUnit QuestionPlan/GenerationBrief contracts.
4. Hard CurriculumQA with explicit `OUT_OF_CURRICULUM` failures.
5. Provenance persisted at final question approval with reviewer/approval metadata.
6. Versioned content QA score and hard-fail model.
7. Curriculum coverage matrix, deficit ranking, and demand-driven generation.
8. Versioned ExamBlueprint, readiness analysis, ExamSet release states, overlap/reuse QA, and reproducible constrained assembly.
9. Content Production dashboard and admin APIs.
10. Azure Speech provider with Japanese neural voices and 48 kHz output.
11. Database tables for blueprints, exam sets, coverage reports, and question usage/analytics.
12. Comprehensive unit/integration/security/E2E coverage required by the master specification.
13. Required domain documentation set under `docs/jft-spec`.

## Proposed data flow

```text
SourceDocument
  → heading-aware SourceChunks
  → validated Knowledge Extraction
  → KnowledgeUnits in REVIEW
  → human APPROVED KnowledgeUnits
  → CurriculumCoverageMatrix / deficits
  → QuestionPlanningProvider
  → QuestionPlan
  → GenerationBrief
  → existing FactoryProvider
  → GeneratedCandidate
  → Structural + Semantic + JFT Format + Curriculum + Originality + Duplicate QA
  → TTS/Audio QA for Listening
  → human approval
  → controlled Question Bank + QuestionProvenance
  → readiness analysis
  → versioned ExamBlueprint
  → seeded constrained ExamSet assembly
  → ExamSet QA + human review
  → explicit publish
```

## Database changes

- Add migration `0006_curriculum_content_production.sql`.
- Extend JSON payload contracts backward-compatibly; do not destroy existing source/question rows.
- Add `exam_blueprints`, `exam_sets`, and `coverage_reports` with status checks, timestamps, indexes, and immutable/version metadata.
- Add direct indexes for level/status and source/knowledge lookup where current JSON-only storage would block coverage queries.
- Preserve service-role-only access and RLS with no candidate policies.

## API changes

- Admin-only coverage/readiness endpoints.
- Admin-only deficit-plan generation endpoint with batch max 30.
- Admin-only ExamBlueprint and ExamSet draft/QA/publish endpoints.
- Extend source detail and factory job responses with curriculum QA/provenance summaries.
- Return explicit domain error codes instead of generic errors.
- Candidate APIs remain unchanged except consuming published frozen versions.

## Admin UI changes

- Normalize `/admin/sources` into source library/detail checkpoints without auto-generation.
- Add `/admin/content-production` for level targets, coverage, deficits, audio readiness, QA failures, duplication, and ExamSet readiness.
- Extend Factory Review with CurriculumQA, provenance, hard-fail reasons, and outside-knowledge display.
- Extend Exam Builder with blueprint version, readiness, seed, constraints, and coverage report.

## QA changes

- Add CurriculumQA prompt/provider version and deterministic mock implementation.
- Hard fail: wrong key, multiple answers, broken Japanese, outside curriculum, source copying, missing audio, category mismatch, hidden context, corrupt metadata/provenance.
- Normalize a 100-point simulator content score and clearly mark its weights/thresholds as internal product decisions.
- Add coverage, diversity, reuse, pairwise overlap, and ExamSet curriculum-gap QA.
- Keep human approval mandatory; AI may never approve directly into production.

## Required tests

- Unit: taxonomy, chunking, validation, approved-only planning, brief bridge, provenance, curriculum grounding/outside knowledge, originality, duplicate detection, audio eligibility, coverage/deficits/readiness, seeded constrained selection, quotas/diversity/reuse/overlap/insufficient bank.
- Integration: source → approved knowledge → plan → existing factory → QA → provenance → bank → coverage → readiness → small ExamSet QA.
- Authorization: candidate rejection for every source/content-production/provenance/ExamSet operation.
- Browser E2E: synthetic source pilot and a three-exam content-production pilot only.
- CI: retain all existing gates; no mass generation in CI.

## Implementation phases

1. Audit and this plan.
2. Canonical taxonomy/domain contracts.
3. Complete source persistence and ingestion fields.
4. Harden extraction provider validation.
5. Human knowledge review rules.
6. Multi-unit question planning and GenerationBrief bridge.
7. Curriculum QA, provenance, originality, and content scoring.
8. Coverage matrix and deficit-driven planning.
9. Content Production dashboard/API.
10. Versioned ExamBlueprint and readiness engine.
11. Constrained ExamSet assembly and ExamSet QA.
12. Azure Speech provider and audio QA.
13. Persistence migration and repository implementations.
14. Unit/integration/security/browser tests.
15. Documentation completion.
16. Run one synthetic/small A1 pilot: ≤20 KnowledgeUnits, ≤30 candidates, no publication.

## Pilot and stop condition

Do not generate 2,100–2,700 questions or 60 exams. After one A1 pilot, report extraction quality, grounding, QA/originality/duplicate outcomes, human-review requirements, readiness deficits, and estimated production cost. Stop for human approval before mass production.
