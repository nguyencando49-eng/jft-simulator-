# A1 Real Curriculum Pilot

Status: 20 question candidates created; awaiting Listening audio and human question review.

## Source inventory

- Source folder: `TAI LIEU SACH`.
- 43 DOCX files (10.50 MB) and 7 PDF files (225.22 MB).
- Primary structured curriculum groups include `入門` and `初級1` lesson documents.
- Practice-test documents and sample exams are excluded as curriculum sources; they may inform format review only.

## Selected pilot

- Source: `入門第3課.docx`.
- Target: A1.
- Lesson: 第3課「私のこと」.
- Scope: one lesson, below the 20-KnowledgeUnit and 30-question pilot limits.
- Extracted text size: 93 non-empty paragraphs, approximately 3,824 characters.

## Proposed KnowledgeUnits

1. First-meeting greeting and self-introduction.
2. Name and nationality using `N は N です`.
3. Negative identity using `N は N じゃありません`.
4. Yes/no confirmation using `N は N ですか`.
5. Shared attributes using `N も N です`.
6. Origin using `～から来ました` and `出身`.
7. Basic association/possession using `N の N`.
8. Polite name/origin questions.

## Copyright and QA boundary

Only lesson knowledge, objectives, vocabulary, kanji, grammar, expressions, and situations were abstracted. No exercise bank or answer key was copied. Question generation must introduce new contexts and remain subject to curriculum, originality, duplicate, semantic and human QA.

## Pilot batch result

- 20 original A1 candidates created: 5 Script/Vocabulary, 5 Conversation/Expression, 5 Listening, and 5 Reading.
- All 20 pass pre-audio structural validation and retain the declared curriculum KnowledgeUnit ID.
- Internal prompt similarity is below the pilot threshold of 0.82; no near-duplicate pair was detected.
- The 5 Listening candidates correctly remain ineligible for approval until fixed playable WAV files exist.
- No candidate has been inserted into the APPROVED Question Bank. Human approval remains mandatory.

## Azure audio checkpoint

Azure audio generation requires `TTS_PROVIDER=azure`, `AZURE_SPEECH_KEY`, and `AZURE_SPEECH_REGION` in a server-only environment such as `.env.local` or Vercel Environment Variables. Secrets must never be placed in `.env.example` or committed.

## Next checkpoint

Rotate the exposed Azure key, configure the replacement safely, generate and validate the five fixed WAV assets, then submit the 20 candidates for human review. Stop after this pilot; do not begin mass generation.
