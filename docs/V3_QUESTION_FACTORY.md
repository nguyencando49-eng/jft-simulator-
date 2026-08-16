# JFT Simulator V3 — Question Factory

## Goal
V3 converts the simulator from a static mock exam into a local-first exam production prototype.

## Implemented

### 1. Admin Dashboard
Route: `/admin`

Shows question readiness, production pipeline, sample attempt metrics and links to production tools.

### 2. Question Bank
Route: `/admin/questions`

Lifecycle:

`draft -> review -> approved -> archived`

Each state-changing content operation must increment `QuestionRecord.version`. Only `approved` questions can enter an exam version.

The V3 browser prototype persists changes through `localStorage` via `lib/admin-store.ts`. This is an adapter boundary, not the final database design.

### 3. Exam Builder
Route: `/admin/exams`

An `ExamDraft` contains section rules:
- section
- number of questions
- navigation rule
- accepted CEFR levels

Before publishing, `generateExamVersion()` validates that every section has enough approved questions.

### 4. Immutable publish
Publishing creates an `ExamVersion`.

Each selected item becomes a `FrozenQuestion` containing:
- original question ID
- original question version
- full snapshot of the question at publish time

Never make a candidate session resolve question content from the mutable Question Bank.

### 5. Attempts
Route: `/admin/attempts`

V3 contains sample analytics only. The next backend phase should persist attempts and answers against `examVersionId`.

## Production invariant

```
QuestionRecord (mutable)
        |
        | QA + approve
        v
ExamDraft / Blueprint
        |
        | validate + generate
        v
ExamVersion (immutable)
        |
        v
CandidateSession
        |
        v
Answer records
        |
        v
Result / analytics
```

## V4 backend target
Recommended tables:

- questions
- question_versions
- assets
- exam_drafts
- exam_versions
- exam_version_questions
- candidate_sessions
- answers
- results

Recommended persistence: PostgreSQL/Supabase. Replace `adminStore` with repository implementations without changing admin UI domain types.

## QA gates before publish

1. Schema valid.
2. Exactly one correct answer.
3. Required assets exist.
4. Audio is playable for listening questions.
5. Explanation exists for practice mode.
6. CEFR/difficulty metadata reviewed.
7. Duplicate/similarity check passes.
8. Human/content QA status = approved.
9. Blueprint has enough approved inventory per section.
10. Generated exam is frozen and assigned an immutable version ID.
