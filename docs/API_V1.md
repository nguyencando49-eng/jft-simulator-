# API v1 examples

## Production 3000 release

Preview authenticated production readiness:

`GET /api/v1/admin/production-release`

Idempotently import the controlled 3,000-question bank and publish the A1 / A2.1 / A2.2 v1 snapshots:

`POST /api/v1/admin/production-release`

An authenticated Admin may call these routes. One-time automation may instead send the secret `PRODUCTION_IMPORT_TOKEN` in the `x-jft-production-import-token` header.

## Publish an additional exam version

`POST /api/v1/exams` with:

```json
{ "examId": "JFT-PRACTICE-A1-001" }
```

Published versions are immutable. A new publish creates the next version rather than modifying an existing snapshot.

## Candidate catalog

`GET /api/v1/exams/published`

The initial Production 3000 catalog contains A1, A2.1 and A2.2 practice forms with 48 questions each.

## Start a candidate session

`POST /api/v1/sessions` with:

```json
{ "examVersionId": "JFT-PRACTICE-A1-001-v1" }
```

The active-session response intentionally excludes correct answers, explanations and internal QA evidence.

## Autosave

`PUT /api/v1/sessions/<session-id>/answers` with:

```json
{ "questionId": "QUESTION-ID", "choice": 1, "currentIndex": 3 }
```

## Submit and score

`POST /api/v1/sessions/<session-id>/submit`

Scoring uses the server-only frozen ExamVersion. Repeated submit is idempotent.

## Generic Question Bank import

`POST /api/v1/import/questions` with either an array of questions or `{ "questions": [...] }`.

For the controlled Production 3000 release, prefer the dedicated production-release route instead of generic import.

## CSV import

Send `Content-Type: text/csv`. Array fields (`choices`, `tags`) are JSON strings inside CSV cells.
