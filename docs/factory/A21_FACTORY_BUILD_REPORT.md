# A2.1 Factory Build Report

Status: `A21_FACTORY_BUILD_IN_PROGRESS`

This work starts the A2.1 level factory by generalizing the closed A1 V1 architecture. It does not generate A2.1 questions yet, does not machine-accept content, and does not create a release candidate.

## Phase ledger

| Phase | Status | Output |
|---|---:|---|
| Phase 0 safety | COMPLETE | A1 tag/hash/count verified; A1 release files untouched |
| Phase 1 reverse-engineer A1 factory | COMPLETE | `docs/factory/A1_FACTORY_REFERENCE.md` |
| Phase 2 generic level factory design | COMPLETE | `lib/server/level-factory.ts` |
| Phase 3 A2.1 curriculum grounding | PARTIAL | `data/curriculum/a21/a21-curriculum-catalog.json` |
| Phase 4 A2.1 bank targets | COMPLETE | `data/production/a21-bank-targets.json` |
| Phase 5 generation contract | PARTIAL | Existing `generator-v2` contract mapped through `getLevelDefinition('A2.1')`; no candidates generated |
| Phase 6 QA1-QA7 audit | PARTIAL | A1 failure lessons captured in A1 reference; deeper code-level gate matrix still needed before running A2.1 generation |
| Phase 7 machine acceptance | PARTIAL | Existing zero-human contract reusable; no A2.1 evidence generated |
| Phase 8 auto repair | NOT_STARTED | Requires A2.1 candidate failures |
| Phase 9 duplicate control | NOT_STARTED | Requires A2.1 candidate pool |
| Phase 10 coverage recovery | NOT_STARTED | Requires first accepted A2.1 bank |
| Phase 11 exam assembler validation | NOT_STARTED | Reusable assembler exists; no A2.1 bank to simulate |
| Phase 12 release gate | NOT_STARTED | Requires machine-accepted A2.1 bank |
| Phase 13 immutable release | NOT_STARTED | Requires passing release gate |
| Phase 14 runtime provider | DESIGN_READY | Must generalize A1 static-import provider only after A2.1 release artifact exists |
| Phase 15 release E2E factory | DESIGN_READY | Temporary A1 Playwright harness lessons captured; reusable implementation pending |
| Phase 16 testing | COMPLETE_FOR_SCAFFOLD | TypeScript/tests/build run after scaffold |

## Safety result

A1 V1 remains immutable:

- tag: `a1-machine-bank-v1`
- tag commit: `dc3fc90699c85f8de0b2c01d8e802d2ff827a36d`
- release count: 486
- release hash: `3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079`

The A2.1 scaffold does not import, edit, rewrite, or re-freeze the A1 release artifacts.

## Generic factory architecture

New module:

- `lib/server/level-factory.ts`

It defines:

- `LevelDefinition`
- `SectionTarget`
- `buildExamDraftForLevel()`
- `calculateSectionTargets()`
- `getLevelDefinition()`
- `getCurriculumForLevel()`
- level definitions for A1, A2.1, and A2.2

The module is intentionally configuration-first. It keeps proven A1 ideas reusable without duplicating A1-specific scripts wholesale.

## A2.1 curriculum coverage

New catalog:

- `data/curriculum/a21/a21-curriculum-catalog.json`

Current catalog coverage:

- level: A2.1
- units: 18
- source family: Irodori 初級1
- source documents present in repo: `TAI LIEU SACH/初級1第1課.docx` through `TAI LIEU SACH/初級1第18課.docx`
- primary machine evidence: checked-in `data/production/curriculum-catalog.ts`

Important limitation:

`data/curriculum/a21/a21-curriculum-catalog.json` is a planning catalog, not persisted APPROVED SourceChunk evidence. A2.1 QA4 must not treat this as fake approved persistence.

## A2.1 bank targets

New target file:

- `data/production/a21-bank-targets.json`

Current assumed simulator composition:

- total: 50
- SV: 13
- CE: 12
- Listening: 13
- Reading: 12

Exposure policy:

- max average exposure: 20%
- development simulation: 100 forms
- release-gate simulation: 1000 forms

Minimum pools:

- SV: 65
- CE: 60
- Listening: 65
- Reading: 60
- total minimum: 250

Preferred pools:

- SV: 87
- CE: 80
- Listening: 87
- Reading: 80
- total preferred: 334 by the 20% + 4/3 safety calculation in `data/production/a21-bank-targets.json`
- conservative factory helper preferred total: 500 by `calculateSectionTargets()` using 10x per-form section quota

HUMAN_CONFIRMATION_REQUIRED:
Confirm whether A2.1 production exams should keep the current simulator composition SV13 / CE12 / Listening13 / Reading12 or use a distinct A2.1 composition. The scaffold assumes the proven 50-question simulator composition until an explicit product spec overrides it.

## Candidate generation status

Candidate count: 0

No A2.1 candidates were generated in this scaffold pass. That is intentional: the current task is to build the reusable level factory foundation without faking curriculum evidence or machine acceptance.

Next safe generation step:

1. Build or import A2.1 approved KnowledgeUnits from the checked-in 初級1 source documents.
2. Generate A2.1 blueprints from those KnowledgeUnits.
3. Generate candidates into `data/production/a21/a21-machine-candidates-rc0.json` or equivalent.
4. Keep generated state separate from QA and acceptance.

## QA pipeline status

Reusable A1 gates exist, but A2.1 needs a formal gate matrix before use:

- QA1: structural checks are level-agnostic; policy findings must remain non-blocking if structural gates pass.
- QA2: must preserve semantic cluster logic for negation, changed date/time, target binding, sequence, timetable, lexical SV, and pragmatic CE.
- QA3: must calibrate naturalness/difficulty to A2.1, not A1.
- QA4: must distinguish planning catalog, persisted approved evidence, missing evidence, and technical failure.
- QA5: must auto-realign metadata when curriculum evidence supports it.
- QA6: must evaluate A2.1 difficulty and distractor quality without human review.
- QA7: must compare semantic tuples and allow pedagogically valid template reuse.

## Duplicate control status

No duplicate scan has been run because there is no A2.1 candidate pool yet.

Planned duplicate corpora:

- A2.1 internal candidates
- A2.1 accepted candidates
- A1 V1 release bank where cross-level learner-equivalent duplication is possible

## Runtime integration status

Design ready, not implemented for A2.1 release.

A2.1 must use the same serverless-safe principle as A1:

- static server-side JSON dependency for release artifact and manifest
- runtime validation against hash/count/state
- no relative runtime filesystem lookup for default production provider
- no full-bank client bundle import

## Preview E2E readiness

Design ready, not implemented as a committed reusable harness yet.

The temporary A1 Preview harness proved these checks should be parameterized:

- Preview URL
- level
- expected release hash/count
- section composition
- admin/candidate auth
- release identity
- exam creation
- perfect score
- wrong-answer score
- A/B/C/D displayed answer scoring
- refresh/resume
- 10-form runtime sample
- UI/listening rendering
- console/API errors

## Verification

- `npx.cmd tsc --noEmit --pretty false`: PASS
- `npm.cmd test`: PASS, 53 files / 318 tests
- `npm.cmd run build`: PASS on retry. The first build compiled successfully but hit a transient missing generated `.next/types` file; the second run completed page generation and build tracing.
- Focused A1/factory regression: `npx.cmd vitest run tests/a1-production-release-v1.test.ts tests/level-factory.test.ts`: PASS, 12 tests
- Frozen A1 release artifacts: no diff

## Final scaffold metrics

- A1 regression status: PASS
- generic factory architecture status: COMPLETE
- A2.1 curriculum coverage: 18 planning units
- candidate count: 0
- MACHINE_ACCEPTED count: 0
- AUTO_REJECTED count: 0
- per-section accepted counts: none yet
- coverage recovery result: not started
- duplicate result: not started
- 100/1000-form simulation result: not started
- A/B/C/D distribution: not applicable yet
- release candidate count: 0
- release hash: not frozen
- runtime integration status: design ready
- Preview E2E readiness: design ready
- TypeScript: PASS
- tests: PASS
- build: PASS on retry

Final classification:

`A21_FACTORY_BUILD_IN_PROGRESS`
