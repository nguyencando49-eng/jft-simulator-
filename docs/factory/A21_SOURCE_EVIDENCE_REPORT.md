# A2.1 Source Evidence Layer Report

Final classification: `A21_SOURCE_EVIDENCE_READY`

This task builds the source evidence layer only. It does not generate A2.1 questions, blueprints, machine-accepted candidates, recovery queues, release artifacts, or deployments.

## Inputs

Local source documents processed:

- `TAI LIEU SACH/初級1第1課.docx`
- `TAI LIEU SACH/初級1第2課.docx`
- `TAI LIEU SACH/初級1第3課.docx`
- `TAI LIEU SACH/初級1第4課.docx`
- `TAI LIEU SACH/初級1第5課.docx`
- `TAI LIEU SACH/初級1第6課.docx`
- `TAI LIEU SACH/初級1第7課.docx`
- `TAI LIEU SACH/初級1第8課.docx`
- `TAI LIEU SACH/初級1第9課.docx`
- `TAI LIEU SACH/初級1第10課.docx`
- `TAI LIEU SACH/初級1第11課.docx`
- `TAI LIEU SACH/初級1第12課.docx`
- `TAI LIEU SACH/初級1第13課 .docx`
- `TAI LIEU SACH/初級1第14課.docx`
- `TAI LIEU SACH/初級1第15課.docx`
- `TAI LIEU SACH/初級1第16課.docx`
- `TAI LIEU SACH/初級1第17課.docx`
- `TAI LIEU SACH/初級1第18課.docx`

No web content was used as substitute evidence.

## Outputs

Created:

- `data/curriculum/a21/source-documents.json`
- `data/curriculum/a21/source-chunks.json`
- `data/curriculum/a21/knowledge-units.json`
- `data/curriculum/a21/curriculum-evidence-map.json`
- `scripts/build-a21-source-evidence.py`
- `tests/a21-source-evidence.test.ts`

## Extraction summary

- documents processed: 18
- lessons covered: 1–18
- SourceChunk count: 1884
- KnowledgeUnit count: 18

KnowledgeUnit status counts:

- `SOURCE_VERIFIED`: 18
- `INFERRED_REVIEW_REQUIRED`: 0
- `UNSUPPORTED`: 0

Planning catalog mapping:

- `CONFIRMED_BY_SOURCE`: 18
- `PARTIALLY_SUPPORTED`: 0
- `UNSUPPORTED`: 0
- `MISMATCH`: 0

## Schema

The generated `SourceChunk` records include:

- `sourceDocumentId`
- `lessonId`
- `chunkId`
- `chunkType`
- `sourceText`
- `sourceLocation`
- `normalizedText`
- `tags`
- `extractionConfidence`

Allowed chunk types:

- `CAN_DO`
- `VOCABULARY`
- `EXPRESSION`
- `GRAMMAR`
- `DIALOGUE`
- `READING`
- `LISTENING`
- `TASK`
- `OTHER`

The generated `KnowledgeUnit` records include:

- KU id
- lesson/unit
- type
- normalized concept
- linked SourceChunk IDs
- communicative purpose
- prerequisite relation
- confidence
- evidence status
- generation approval flag

Only `SOURCE_VERIFIED` units are marked `approvedForGeneration=true`.

## Section coverage

Supported generation coverage by lesson evidence:

- SV: 18 lessons
- CE: 11 lessons
- Listening: 9 lessons
- Reading: 6 lessons

This report does not force equal coverage across sections. Later generation planning must use this coverage honestly and prioritize gaps/underrepresented modalities.

## Quality gates

Passed:

- source linkage present
- chunk IDs unique
- lesson IDs match
- no unsupported content marked approved
- no planning catalog claims exceed source evidence
- all 18 planning units confirmed by source evidence

## A1 regression

A1 V1 remains closed and unchanged:

- question count: 486
- release hash: `3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079`
- release manifest hash matches

## Next stage

The next stage may begin blueprint/candidate generation for A2.1, using only:

- `CONFIRMED_BY_SOURCE` curriculum mappings
- `SOURCE_VERIFIED` KnowledgeUnits
- linked local SourceChunk evidence

Generation must still remain separate from QA, machine acceptance, release, and publish.
