# Full Question Bank — Initial Inventory

Date: 2026-08-23  
Baseline commit: `4806c09f2edac09516717684a4691626a31694a4`  
Working branch: `content/full-bank-manual-repair`

## Data authority and drift

- Production uses `SupabaseRepository`; the repository seed and signed review artifacts are the reproducible content snapshot.
- The signed production application report at the baseline commit records `49 approved / 974 review / 1077 archived`, matching the reconstructed repository snapshot exactly.
- A fresh live Supabase query was attempted before Batch 001. Vercel CLI confirmed the linked `jft-simulator` project, but production Supabase variables are Sensitive and are not exported to this local process. The signed baseline therefore remains the comparison evidence.
- Production writes are blocked for Batch 001. If a later authenticated live read disagrees with this snapshot, content application must stop and the drift must be reconciled first.

## Inventory

```text
Total questions:              2100
Approved:                       49
Review/pending:                974
Archived/rejected:            1077

By source:
  original:                     50
  ai:                         2050

By level:
  A1:                          700
  A2.1:                        700
  A2.2:                        700

By section:
  script_vocabulary:           525
  conversation_expression:     525
  listening:                   525
  reading:                     525

Listening with audio:          525
Listening without audio:         0
Listening with script:         513
Listening without script:       12
```

The repository supports `draft`, `review`, `approved`, and `archived`; it has no separate `pending` question state. `archived` is the reversible rejected state used by the existing review workflow.

## Architecture findings

- Question records are stored through the repository abstraction. Production uses Supabase JSON payloads; development falls back to the in-memory seed.
- QA1–QA7 evidence is stored separately on Factory candidates inside persisted Factory job payloads. Question Bank records do not carry the complete specialized evidence bundle.
- Exam Builder selects only `approved` Question Bank items. Existing `ExamVersion` records are frozen snapshots and are not mutated by Question Bank repair.
- Listening Question Bank records link rendered media through `audioSrc`. Factory/pilot source records may additionally carry `audioScript`; a playable file alone is not proof that rendered speech matches that script.
- Existing utilities include production import, pending-bank audit/reconciliation, Gold Bank audit, content QA, audio generation and integrity/E2E tests.

## Queue definition

The targeted queue contains the 973 unpublished AI questions whose signed decision is `KEEP_REVIEW`. The separately audited `source: original` Gold Bank is excluded. Queue order is deterministic:

1. level: A1 → A2.1 → A2.2;
2. section: Script/Vocabulary → Conversation/Expression → Listening → Reading;
3. question ID.

Batch 001 contains the first 25 items. Because it includes Listening, the conservative 25-item batch limit is used.
