# Gold Bank 50 Fix Report

Date: 2026-08-23  
Audit version: `JFT_GOLD_BANK_50_AUDIT_2026_08_23`

## Scope and policy

Applied only the 15 high-confidence `REVISE` decisions from the manual audit. The 24 `KEEP` items were not edited. The 10 `REVIEW_LEVEL` items retain their declared levels pending QA6/human calibration. `LI-002` retains its question and audio file but is held in `review` because no independent canonical transcript has been verified.

No QA1–QA7 implementation was changed. No review/archived production question was mass-approved.

## Revised questions

| ID | Before | After | Answer verification |
|---|---|---|---|
| SV-001 | Short stem allowed weak competing verbs. | Added the 8:00 company context and audited distractors. | `おきます` remains at the stored answer index. |
| SV-002 | `病院を予約しました` plus absurd examples. | Uses `来週の病院の診察を予約しました` and plausible particle/usage errors. | Correct usage remains at the stored answer index. |
| SV-003 | Asked where `入口` is; Can-do overstated navigation. | Explicitly asks the meaning of `入口`; Can-do is meaning recognition. | `入る ところ` verified. |
| SV-004 | Can-do described requesting water. | Content unchanged; Can-do now targets reading `水`. | `みず` verified. |
| SV-005 | Tagged as word meaning. | Category tag changed to `word-usage`. | `かいます` verified. |
| SV-006 | Nonsensical noun-object distractors. | Replaced with realistic `に/を/へ/が` learner errors. | `急げば 電車に間に合います。` verified. |
| SV-007 | Can-do described meeting at a station. | Can-do now targets reading `改札`. | `かいさつ` verified. |
| SV-011 | Machine-like nonsense distractors. | Replaced with plausible object-particle errors. | `住所をもう一度確認してください。` verified. |
| SV-012 | Can-do described following directions. | Can-do now targets reading `右`. | `みぎ` verified. |
| CE-004 | `ドアのとなり` was a weak location cue. | Uses `エレベーターのとなり`. | `となり` verified. |
| CE-006 | Condition was under-specified. | Adds an explicit `もし` rule context and condition-form competitors. | `降ったら` verified. |
| CE-007 | Distractors were malformed Japanese. | Uses natural but pragmatically irrelevant replies. | The direct copying instruction remains uniquely best. |
| CE-009 | Included `電車を食べてください`. | Uses grammatical but contextually wrong replies. | The arrival/contact response remains uniquely best. |
| CE-010 | Obligation was not established. | Adds the supervisor's explicit same-day instruction. | `なければなりません` verified. |
| CE-011 | Distractors were nonsense honorific fragments. | Uses four plausible appointment intents. | Only `変更したい` matches the stated intent. |

## Metadata changes

- `SV-003`: `can-do:recognize-entrance-meaning`
- `SV-004`: `can-do:read-kanji-water`
- `SV-005`: `category:word-usage`
- `SV-007`: `can-do:read-kanji-ticket-gate`
- `SV-012`: `can-do:read-kanji-right`

Question IDs are unchanged. Persisted Question Bank records increment their version only when learner-visible content or audited metadata changes. Existing workflow status is preserved except `LI-002`, which is explicitly moved to `review` for the audio hold.

## Level review left unchanged

No level was changed for: `CE-002`, `RE-002`, `SV-009`, `SV-010`, `LI-009`, `LI-010`, `LI-011`, `RE-009`, `RE-010`, `RE-011`.

## LI-002 verification status

`public/audio/sample-02.wav` exists and is non-empty, but the audit did not locate an independent canonical transcript. The item therefore remains blocked from Gold approval as `review`. QA3/QA6 cannot infer actual acoustic correctness from the question metadata alone.

## QA rerun

- Deterministic integrity and answer-index regression tests cover all 15 revised IDs.
- Content QA V1 was rerun diagnostically for all 2,100 source questions. It produced no automatic Gold approval because originality/provenance and specialized QA evidence remain incomplete; this evidence limitation was not converted into a false PASS. The historical signed pending-bank QA snapshot was intentionally preserved instead of being overwritten by this Gold-only audit.
- QA1–QA7 architecture was not modified.

## Published ExamVersions

Existing ExamVersions remain immutable and retain their historical snapshots. Revised Question Bank records do not silently alter already-published exams. A new ExamVersion is required if the product owner wants the revised A1 items to replace their historical snapshots in the five published A1 exams.
