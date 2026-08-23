# Full Question Bank Repair Progress

Baseline: `4806c09f2edac09516717684a4691626a31694a4`  
Branch: `content/full-bank-manual-repair`  
Target queue: 973 unpublished AI questions in signed `KEEP_REVIEW` state

| Batch | Range | Reviewed | KEEP | REVISE | REVIEW_LEVEL | HOLD_AUDIO | REMOVE | Applied | Tests | Status |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| BATCH-001 | queue 0–24 | 25 | 3 | 1 | 0 | 5 | 16 | 1 repository repair; 0 promotions | 238 unit/integrity + build + 6 E2E PASS | VERIFIED |

## Current totals

```text
Reviewed:       25 / 973
Remaining:     948
Applied REVISE:  1
Approved:         0
```

Production mutation remains blocked until an authenticated live inventory can be compared with the signed baseline snapshot. Existing published ExamVersions remain untouched.
