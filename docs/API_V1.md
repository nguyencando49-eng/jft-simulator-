# API v1 examples

## Publish an exam
`POST /api/v1/exams` with `{ "examId": "JFT-MOCK-001" }`.

## Start a candidate session
`POST /api/v1/sessions` with `{ "examVersionId": "JFT-MOCK-001-v1" }`.
The response intentionally excludes correct answers and explanations.

## Autosave
`PUT /api/v1/sessions/<session-id>/answers` with `{ "questionId": "VOC-001", "choice": 1, "currentIndex": 3 }`.

## Submit and score
`POST /api/v1/sessions/<session-id>/submit`. Scoring uses server-only frozen answers and returns aggregate/section scores.

## Import JSON
`POST /api/v1/import/questions` with either an array of questions or `{ "questions": [...] }`.

## Import CSV
Send `Content-Type: text/csv`. Array fields (`choices`, `tags`) are JSON strings inside CSV cells.
