# V5 — AI Question Factory

V5 changes the project from a manually curated question bank into a controlled content-production pipeline.

## Goal

Generate new JFT-style practice candidates from a structured brief, run automatic QA, require human review, then promote only approved candidates into the existing Question Bank.

## Pipeline

```text
Generation Brief
  section + level + topic + Can-do + difficulty + count
        ↓
Factory Provider
        ↓
Generated drafts
        ↓
Normalization → QuestionRecord(status=review, source=ai)
        ↓
Schema QA + Language QA + Pedagogy QA + JFT-style QA + Audio QA
        ↓
Human review queue
        ↓
Approve selected
        ↓
Question Bank(status=approved)
        ↓
Existing Exam Builder / immutable ExamVersion
```

## Safety boundary

AI output is never published directly into an exam. Generated candidates start in review state. Candidates with blocking QA errors cannot be approved by the V5 approve endpoint.

## Provider abstraction

V5 intentionally avoids a provider SDK dependency.

- `AI_FACTORY_PROVIDER=mock` — deterministic local development provider.
- `AI_FACTORY_PROVIDER=http` — POSTs a provider-neutral generation contract to `AI_FACTORY_ENDPOINT`.
- `AI_FACTORY_PROVIDER=azure-openai` — calls a deployed Azure OpenAI model through the native JSON adapter.

Optional variables:

```env
AI_FACTORY_PROVIDER=http
AI_FACTORY_ENDPOINT=https://your-provider-adapter.example/generate
AI_FACTORY_API_KEY=...
AI_FACTORY_MODEL=...
```

For Azure OpenAI, the endpoint and API key are not sufficient by themselves: the Azure resource must also contain a model deployment. Configure either the scoped values above or these shared fallbacks:

```env
AI_FACTORY_PROVIDER=azure-openai
AI_QA_PROVIDER=azure-openai
AOAI_ENDPOINT=https://YOUR-RESOURCE.openai.azure.com
API_KEY=...
AZURE_OPENAI_DEPLOYMENT=jft-gpt-5-4-mini
```

`AI_FACTORY_*` overrides the shared values for generation, and `AI_QA_*` overrides them for semantic QA. An Azure `DeploymentNotFound` response means the model has not been deployed; changing only the provider label is not a working integration.

The HTTP endpoint receives:

```json
{
  "task": "jft_question_generation",
  "promptVersion": "v5.0",
  "input": {
    "section": "listening",
    "level": "A2.1",
    "topic": "仕事",
    "canDo": "職場で簡単な指示を理解できる",
    "count": 5,
    "difficulty": "balanced",
    "includeExplanation": true,
    "generateAudioScript": true
  }
}
```

It must return `{ "questions": [...] }` where each item contains `instruction`, `prompt`, `choices`, `answer`, `explanationVi`, `tags`, and optional `audioScript`.

## Persistence

Migration `0003_v5_ai_factory.sql` adds `factory_jobs`. Each job stores the request, candidates, QA reports, provider/model metadata, prompt version, approval timestamps, and status as JSON payload. This provides generation traceability.

## API

- `GET /api/v1/factory/jobs`
- `POST /api/v1/factory/jobs`
- `GET /api/v1/factory/jobs/:id`
- `POST /api/v1/factory/jobs/:id/approve`

All endpoints require `admin` role.

## Admin UI

`/admin/factory` provides:

- generation brief editor;
- batch generation up to 20 candidates;
- job history;
- QA score and issue display;
- listening audio-script preview;
- multi-select human approval;
- promotion into Question Bank.

## V5.1 candidates

- LLM-based semantic QA using a second independent reviewer model;
- duplicate/near-duplicate detection using embeddings;
- real TTS asset generation and storage;
- prompt template/version registry;
- cost/token accounting;
- background queue rather than synchronous generation;
- retry policies and provider fallbacks;
- question performance feedback loop from real attempts.
