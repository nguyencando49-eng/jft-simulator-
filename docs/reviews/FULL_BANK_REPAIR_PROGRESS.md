# Full Question Bank Repair Progress

Baseline: `4806c09f2edac09516717684a4691626a31694a4`
Branch: `content/full-bank-manual-repair`
Target queue: 973 unpublished AI questions in signed `KEEP_REVIEW` state

| Batch | Range | Reviewed | KEEP | REVISE | REVIEW_LEVEL | HOLD_AUDIO | REMOVE | Applied | Tests | Status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| BATCH-001 | queue 0–24 | 25 | 3 | 1 | 0 | 5 | 16 | 1 repository repair; 0 promotions | 243 unit/integrity + build + relevant E2E PASS | VERIFIED |
| BATCH-002 | queue 25–74 | 50 | 0 | 0 | 0 | 0 | 50 | 0 status mutations | 243 unit/integrity + build + relevant E2E PASS | VERIFIED |
| BATCH-003 | queue 75–124 | 50 | 0 | 0 | 0 | 0 | 50 | 0 status mutations | 243 unit/integrity + build + relevant E2E PASS | VERIFIED |
| BATCH-004 | queue 125–174 | 50 | 0 | 0 | 0 | 0 | 50 | 0 status mutations | 243 unit/integrity + build + relevant E2E PASS | VERIFIED |
| BATCH-005 | queue 175–224 | 50 | 3 | 0 | 0 | 0 | 47 | 0 status mutations | 243 unit/integrity + build + relevant E2E PASS | VERIFIED |

## Current totals

Reviewed: 225 / 973
Remaining: 748
Approved: 0

Production mutation remains blocked until an authenticated live inventory can be compared with the signed baseline snapshot. Existing published ExamVersions remain untouched.
