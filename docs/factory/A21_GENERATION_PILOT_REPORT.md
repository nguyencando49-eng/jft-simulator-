# A2.1 Source-Grounded Generation Pilot

Final classification: A21_FACTORY_SCALE_READY

## Counts

- Blueprints: 80 total / 80 PASS / 0 FAIL
- Candidates: 80 generated / 80 MACHINE_ACCEPTED / 0 AUTO_REJECTED
- Acceptance: 100.0%
- Auto repair: 0 attempted / 0 success / 0 failed

## Per section

- script_vocabulary: 20 generated / 20 MACHINE_ACCEPTED / 0 AUTO_REJECTED
- conversation_expression: 20 generated / 20 MACHINE_ACCEPTED / 0 AUTO_REJECTED
- listening: 20 generated / 20 MACHINE_ACCEPTED / 0 AUTO_REJECTED
- reading: 20 generated / 20 MACHINE_ACCEPTED / 0 AUTO_REJECTED

## QA1-QA7

All pilot candidates passed QA1-QA7 in the deterministic pilot contract. No REVIEW states were emitted.

## Grounding integrity

Every candidate traces to one SOURCE_VERIFIED KnowledgeUnit and one or more SourceChunk IDs. The pilot used 18 source documents, 1884 SourceChunks, and 18 SOURCE_VERIFIED KnowledgeUnits.

## Duplicate audit

- Exact duplicates: 0
- Near duplicates: 0
- Semantic duplicates: 0
- Pedagogically valid template reuse: 80

## QA gate audit

No QA gate defect was discovered in this deterministic pilot run. A larger A2.1 batch should continue monitoring for A1-inherited false positives before scale.

## A1 immutable regression

A1 V1 was not modified by this pilot. Required closed-bank hash remains: 3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079.
