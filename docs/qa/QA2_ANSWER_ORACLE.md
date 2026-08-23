# QA2 — Independent Answer Oracle

## Purpose

QA2 answers one question only: can an independent solver determine exactly one defensible answer? It does not replace QA1 and does not judge overall content quality.

Pipeline position:

`Generator → Q0 → QA1 → QA2 → future specialized gates → Human Review`

## Input boundary and answer blinding

Stage A receives only learner-visible semantic evidence: instruction, stem/passage, choices, and (for listening semantic review) the QA audio script. Its TypeScript input has no answer, explanation, QA1 result, curriculum hint, generator reasoning, or hidden metadata fields.

The listening script remains QA-only and is never added to Candidate exam payloads. QA2 does not certify TTS pronunciation or audio quality.

Stage B is deterministic application code. Only after Stage A returns does it compare `derivedCorrectOptions` with the declared answer index.

## Output and validation

The versioned solve contract is `JFT_ANSWER_ORACLE_V1`. It includes derived options, defensible-answer count, confidence, analysis of every choice, ambiguity, hidden-context status, and solver notes.

Validation rejects invalid indexes, duplicate indexes, missing choice analysis, inconsistent `CORRECT` classifications, invalid confidence, mismatched question IDs, and invalid versions with `QA_ORACLE_INVALID_OUTPUT`. Dangerous fields are not coerced.

## Deterministic outcomes

- One matching answer at or above threshold: `ORACLE_MATCH` → PASS.
- One matching answer below threshold: `LOW_CONFIDENCE` → REVIEW.
- Different answer: `ANSWER_KEY_MISMATCH` → FAIL.
- Two or more answers: `MULTIPLE_DEFENSIBLE_ANSWERS` → FAIL.
- No answer: `NO_DEFENSIBLE_ANSWER` → FAIL.
- Missing learner context: `HIDDEN_CONTEXT_REQUIRED` → FAIL.
- Invalid output or provider failure: REVIEW; never PASS.

All FAIL outcomes above are hard failures. QA2 never rewrites a candidate.

The default confidence threshold is 0.85 and can be set with `ANSWER_ORACLE_CONFIDENCE_THRESHOLD`. This is a **SIMULATOR_DESIGN_DECISION**, not an official JFT rule.

## Provider abstraction

`AnswerOracleProvider.solve(input)` is vendor-neutral. Local/test operation uses a deterministic learner-visible evidence provider. HTTP mode uses:

- `ANSWER_ORACLE_PROVIDER=http`
- `ANSWER_ORACLE_ENDPOINT` (falls back to `AI_QA_ENDPOINT`)
- `ANSWER_ORACLE_API_KEY` (falls back to `AI_QA_API_KEY`)
- `ANSWER_ORACLE_MODEL`

The HTTP payload contains only task, prompt version, and the blinded input.

## Persistence and Admin review

QA2 evidence is stored separately as `FactoryCandidate.answerOracleQa` inside the existing Factory job payload. This preserves QA1 evidence and works with both Memory and Supabase repositories without a new table.

Admin Factory review shows verdict, derived and declared answers, confidence, defensible count, outcome, and expandable per-choice evidence. Provider/model metadata remains secondary audit information.

## Security

Factory jobs are Admin-only. Active Candidate questions use an explicit allowlist projection, excluding answers, explanations, QA evidence, oracle notes, and future internal fields.

## Tests

Synthetic tests cover match, mismatch, multiple answers, no answer, low confidence, hidden context, strict invalid output, provider failure, grammar construction, reading evidence, listening scripts, adversarial fixtures, HTTP answer blinding, QA1 PASS overridden by QA2 FAIL, and Candidate payload isolation.

## Known limitations

The bundled deterministic provider is intentionally conservative and intended for reproducible local workflows. Production-quality semantic solving should use a separately configured independent HTTP model/provider and should later be calibrated against human reviewer verdicts. QA2 does not assess curriculum grounding, originality, Japanese quality generally, or audio rendering quality.
