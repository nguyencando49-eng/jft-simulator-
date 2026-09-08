# A1 Machine Bank Release Report

Generated: 2026-09-08T11:49:24.081Z

This release gate diagnosed the current machine-accepted A1 bank for automatic JFT-style exam assembly. It did not generate, repair, approve as Gold, publish, or mutate frozen source data.

## Final decision

- Final input bank size: **447**
- Release eligible: **447**
- Quarantined: **0**
- Bank state: **A1_BANK_NOT_READY**

## Blocking diagnostics

- Answer mismatches: **0**
- Answer ambiguities: **0**
- Exact duplicates: **0**
- Near duplicates: **0**
- 100 simulated exams: **0 PASS / 100 FAIL**

## Coverage by section

| Section | Count | State |
|---|---:|---|
| conversation_expression | 41 | UNDERREPRESENTED |
| listening | 138 | BALANCED |
| reading | 114 | BALANCED |
| script_vocabulary | 154 | BALANCED |

Missing KnowledgeUnits: none

## Answer position distribution across simulations

| Position | Actual | Expected | Deviation | State |
|---|---:|---:|---:|---|
| A | 3649 | 1250 | 1.9192 | FAIL |
| B | 551 | 1250 | -0.5592 | FAIL |
| C | 468 | 1250 | -0.6256 | FAIL |
| D | 332 | 1250 | -0.7344 | FAIL |

## Exposure control

- Bank size used for simulation: **447**
- Questions per exam: **50**
- Possible rotation depth: **8.94**
- High-frequency questions: **15**
- High-frequency KUs: **0**
- High-frequency templates: **1**

## Most common quarantine reasons

| Reason | Count |
|---|---:|
| None | 0 |

## Outputs

- `data/qa/a1-bank-final-release-gate.json`
- `data/qa/a1-bank-exam-simulation-report.json`
- `data/production/a1-machine-bank-release-candidate-v1.json`
- `data/reviews/a1-bank-quarantine-v1.json`
- `docs/reviews/A1_MACHINE_BANK_RELEASE_REPORT.md`
