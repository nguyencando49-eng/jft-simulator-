# Full Bank Manual Repair — Batch 001

Date: 2026-08-23  
Baseline: `4806c09f2edac09516717684a4691626a31694a4`  
Range: deterministic queue positions 0–24  
Level: A1  
Sections: 2 Script/Vocabulary, 4 Conversation/Expression, 17 Listening

## Decision summary

| Decision | Count |
|---|---:|
| KEEP | 3 |
| REVISE | 1 |
| REVIEW_LEVEL | 0 |
| HOLD_AUDIO | 5 |
| REMOVE | 16 |
| Total | 25 |

The item-level contract, exact evidence and the `before`/`after` repair are stored in `data/reviews/full-bank/BATCH-001-DECISIONS.json`.

## Item decisions

| ID | Decision | Confidence | Primary reason |
|---|---|---|---|
| A1P3-SV-001 | KEEP | HIGH | Direct, unique A1 word-meaning task; specialized evidence remains incomplete. |
| A1P3-SV-002 | REVISE | HIGH | Prompt asked the learner to tell a name instead of selecting the reading. |
| A1P3-CE-003 | KEEP | HIGH | The reply makes the polite name question uniquely appropriate. |
| A1P3-CE-005 | KEEP | HIGH | Natural and unique first-introduction response. |
| PROD-A1-CO-0184 | REMOVE | HIGH | Broken particles, Can-do mismatch, stock distractors. |
| PROD-A1-CO-0214 | REMOVE | HIGH | Broken Japanese and no identity-exchange construct. |
| PROD-A1-CO-0233 | REMOVE | HIGH | Broken Japanese and no restaurant-ordering construct. |
| PROD-A1-CO-0278 | REMOVE | HIGH | Unclear Japanese, Can-do mismatch and duplicated template. |
| A1P3-LI-001 | HOLD_AUDIO | MEDIUM | Script is valid; rendered audio was not audibly compared with it. |
| A1P3-LI-002 | HOLD_AUDIO | MEDIUM | Script is valid; rendered audio was not audibly compared with it. |
| A1P3-LI-003 | HOLD_AUDIO | MEDIUM | Script is valid; rendered audio was not audibly compared with it. |
| A1P3-LI-004 | HOLD_AUDIO | MEDIUM | Script is valid; rendered audio was not audibly compared with it. |
| A1P3-LI-005 | HOLD_AUDIO | MEDIUM | Script is valid; rendered audio was not audibly compared with it. |
| PROD-A1-LI-0332 | REMOVE | HIGH | Announcement action task does not measure identity exchange. |
| PROD-A1-LI-0333 | REMOVE | HIGH | Generic action sequence does not measure family/residence. |
| PROD-A1-LI-0334 | REMOVE | HIGH | Does not measure food/drink preference; template distractors. |
| PROD-A1-LI-0335 | REMOVE | HIGH | Not a conversation or restaurant ordering task. |
| PROD-A1-LI-0336 | REMOVE | HIGH | Does not assess describing a home or its rooms. |
| PROD-A1-LI-0337 | REMOVE | HIGH | Does not assess locating a person at work. |
| PROD-A1-LI-0338 | REMOVE | HIGH | Broken `始まりますについて` and category/Can-do mismatch. |
| PROD-A1-LI-0339 | REMOVE | HIGH | Broken `貸してくださいについて` and request mismatch. |
| PROD-A1-LI-0340 | REMOVE | HIGH | Does not assess hobbies or manga preference. |
| PROD-A1-LI-0341 | REMOVE | HIGH | One-way procedure does not assess invitation/outing. |
| PROD-A1-LI-0342 | REMOVE | HIGH | Does not require understanding a transportation route. |
| PROD-A1-LI-0343 | REMOVE | HIGH | Broken `入りたいについて` and destination-intent mismatch. |

## Applied repair

Only the HIGH-confidence `REVISE` was applied to repository source:

```text
A1P3-SV-002
before: 「名前」を おしえてください。
after:  「名前」の よみかたは どれですか。
```

The choices, answer index and correct answer text `なまえ` are unchanged. No status was promoted. `REMOVE`, `HOLD_AUDIO`, and KEEP decisions were not applied to production in this batch.

## Listening evidence

All 17 Listening records contain a canonical script and a local audio path. Every local file exists and every deployed URL returned HTTP 200. This is technical availability evidence only. Because the rendered files were not audibly reviewed end-to-end, the five otherwise sound pilot items remain `HOLD_AUDIO`. The 12 mass-generated Listening items are `REMOVE` for independent content defects, regardless of audio availability.

## Quality-control second pass

Ten items were re-read after the decision pass: `A1P3-SV-001`, `A1P3-SV-002`, `A1P3-CE-003`, `A1P3-CE-005`, `PROD-A1-CO-0184`, `A1P3-LI-001`, `A1P3-LI-005`, `PROD-A1-LI-0332`, `PROD-A1-LI-0338`, and `PROD-A1-LI-0343`.

The sample covers every decision represented, all three represented sections, and Listening. No wrong answer, second defensible answer, introduced Japanese defect, incorrect level change, answer leakage or released-exam mutation was found. The batch does not require a second pass.

## Publication status

Nothing in Batch 001 is newly approved. KEEP and repaired REVISE records still require complete provenance and QA2–QA7 evidence. HOLD_AUDIO records require audible human verification. REMOVE records remain unpublished; no replacement questions were generated.

## Verification

- Typecheck: PASS.
- Unit/integrity tests: 36 files, 238 tests PASS.
- Production build: PASS.
- Browser E2E: 6/6 PASS.
- Batch reconciliation: 25 unique IDs, exact deterministic queue positions 0–24, decision counts reconcile.
- Answer rotation: `A1P3-SV-002` still resolves to `なまえ` at the stored answer index.
- Published ExamVersions: untouched.
