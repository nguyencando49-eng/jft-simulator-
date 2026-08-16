# Exam Engine V2

## State machine
`instructions -> audio_check -> section_intro -> testing -> section_intro ... -> final_confirm -> result`

## Session invariants
- `startedAt` and `expiresAt` are persisted to localStorage.
- Reload restores the same session and does not reset time.
- Timeout triggers submission.
- Answers are stored by stable question ID.

## Navigation policy
Navigation is defined by the exam blueprint rather than hard-coded into question UI.
Current demo policy:
- Script/Vocabulary: back allowed within section.
- Conversation/Expression: back allowed within section.
- Listening: back disabled within section.
- Reading: back allowed within section.
- Section boundary always shows a transition screen.

## Next architecture step
Replace the static question array with:
`QuestionRepository -> ExamGenerator -> ExamSnapshot -> CandidateSession`.
The ExamSnapshot must freeze IDs/order so a question-bank edit cannot mutate an active attempt.

## Admin backlog
1. Question CRUD
2. JSON/CSV import validation
3. Audio/image asset upload
4. Blueprint editor
5. Generate/publish immutable exam version
6. Attempt analytics
7. Question quality metrics: exposure, difficulty, discrimination, error rate
