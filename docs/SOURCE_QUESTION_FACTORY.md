# Source Material to AI Question Factory

## Architecture

TXT/Markdown becomes `SourceDocument`, then configurable chunks, structured `KnowledgeUnit` records, human approval, a mixed-section `QuestionPlan`, and finally `FactoryRequest` briefs executed by the existing `runFactoryJob`. Structural QA, semantic QA, duplicate checks, Listening TTS, and final human review are not bypassed.

## Contracts and configuration

`SourceKnowledgeProvider` and `QuestionPlanningProvider` each have mock and HTTP implementations. Configure `SOURCE_AI_PROVIDER`, `SOURCE_AI_ENDPOINT`, `SOURCE_AI_API_KEY`, `SOURCE_AI_MODEL`, `SOURCE_CHUNK_MAX_CHARS`, and `SOURCE_SIMILARITY_THRESHOLD`. Prompt versions are persisted as `source-extraction-v1`, `question-planner-v1`, and `source-originality-v1`.

The Memory and Supabase repositories support documents, chunks, knowledge units, plans, and provenance. Migration `0005_source_question_factory.sql` adds indexed, constrained, RLS-enabled tables. Source routes are admin-only and no candidate-facing RLS policies are created.

## Originality and provenance

Generation briefs require new contexts and prohibit reproducing source wording. Normalized trigram Jaccard compares candidates against source chunks, the Question Bank, and their batch. Threshold failures become blocking factory QA errors. The service boundary can later use embeddings, pgvector, and cosine similarity without changing orchestration.

Provenance records source document/chunks, knowledge unit, plan, factory job, generator/QA provider, model, prompt versions, and timestamp. It is visible through admin source detail APIs only.

## Admin workflow

`/admin/sources`: import and preview-confirm, chunk, extract, approve knowledge, create a pilot plan, then generate through the existing factory. Pilot limits are 20 Knowledge Units and 30 questions. Generated candidates remain in Factory Review.

PDF/OCR, scraping, vector storage, and bulk generation are intentionally out of scope. PDF is rejected with a typed error until an extraction adapter is configured.
