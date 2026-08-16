# Target Data Model

- Question: reusable authored content and metadata
- QuestionVersion: immutable revision used for audit
- Asset: audio/image metadata
- ExamBlueprint: selection rules per section
- ExamVersion: published immutable exam
- ExamItem: ordered question reference in an exam version
- CandidateSession: start/end/time/status
- CandidateAnswer: selected answer and timestamps
- Result: score/section diagnostics

Never render a live exam directly from mutable Question rows. Generate an immutable ExamVersion/ExamSnapshot first.
