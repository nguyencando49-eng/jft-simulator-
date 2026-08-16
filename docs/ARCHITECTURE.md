# Architecture

## Current MVP
Next.js App Router -> local question bank -> client exam session -> localStorage persistence -> scoring engine.

## Target
Web UI -> Exam API -> Exam Engine -> Blueprint Generator -> Question Bank (PostgreSQL) -> Attempt/Answer store -> Scoring/Analytics.

### Boundaries
- `data/questions.ts`: demo content only.
- `lib/types.ts`: canonical domain schema.
- `lib/scoring.ts`: deterministic scoring; replace estimated thresholds with validated practice model before marketing claims.
- `components/ExamClient.tsx`: CBT interaction shell.

## Copyright / identity boundary
Do not copy real exam questions, leaked content, logos, CSS, screenshots, or proprietary assets. Reproduce generic CBT behavior only and label product as unofficial.
