# QA3 — Japanese Naturalness Judge

## Purpose

QA3 independently answers: “Would a Japanese speaker reasonably say or write this in the intended situation?” It evaluates grammar, particles, collocation, word choice, politeness, register, pragmatics, spoken/written style, conversation flow, and the Japanese in every choice.

Pipeline position:

`Generator → Q0 → QA1 General Content → QA2 Answer Oracle → QA3 Japanese Naturalness → future specialized gates → Human Review`

QA3 evidence is stored separately as `FactoryCandidate.japaneseNaturalnessQa`. It never overwrites QA1 or QA2.

## Scope and non-scope

QA3 evaluates:

- Japanese grammar and particles;
- natural collocations and word choice;
- politeness, keigo, and relationship-appropriate register;
- pragmatic/contextual fit;
- spoken Japanese in conversation and listening scripts;
- written Japanese in notices, messages, instructions, and practical reading;
- dialogue continuity and reference clarity;
- language naturalness of every answer choice.

QA3 does not solve the question, verify the answer key, judge curriculum grounding, classify JFT categories, rewrite content, or certify TTS/audio quality.

## Input

The provider receives question ID, instruction, stem/passage, every choice, declared section/category/level/context/situation, and a listening script when present. It does not receive QA1 or QA2 scores/reasoning. Answer correctness is not part of the judgment.

## Output and strict validation

The versioned contract is `JFT_JAPANESE_NATURALNESS_V1`. It includes:

- PASS, REVIEW, or FAIL;
- hard-fail status and HIGH/MEDIUM/LOW confidence;
- scores for grammar (20), naturalness (20), collocation (15), register (15), context fit (10), spoken/written fit (10), and conversation flow (10);
- declared context, detected style, and context fit;
- one language analysis entry for every choice;
- evidence-based issues and release status;
- provider, model, prompt version, and timestamp.

Validation rejects invalid versions/question IDs, missing or duplicate choice indexes, invalid enums, out-of-range scores, and an overall score inconsistent with the dimension sum. Provider-supplied verdicts are normalized deterministically from validated evidence.

## Release rules

Simulator thresholds:

- 90–100: PASS;
- 80–89: REVIEW;
- below 80: FAIL;
- LOW confidence: REVIEW even when the score is 90 or above.

These thresholds are **SIMULATOR_DESIGN_DECISIONS**, not official JFT rules.

The following are hard failures regardless of score:

- `BROKEN_JAPANESE`;
- `MEANING_CORRUPTED_BY_LANGUAGE_ERROR`;
- `SEVERE_REGISTER_MISMATCH`;
- `UNINTELLIGIBLE_DIALOGUE`;
- `LANGUAGE_ERROR_LEAKS_CORRECT_ANSWER`.

Invalid output or provider failure becomes a technical REVIEW and can never PASS automatically.

## Provider abstraction

`JapaneseNaturalnessProvider.judge(input)` is vendor-neutral. Supported modes:

- `mock`: reproducible deterministic language signals for tests/local development;
- `http`: independent external Japanese-language judge.

Configuration:

- `JAPANESE_NATURALNESS_PROVIDER`;
- `JAPANESE_NATURALNESS_ENDPOINT` (falls back to `AI_QA_ENDPOINT`);
- `JAPANESE_NATURALNESS_API_KEY` (falls back to `AI_QA_API_KEY`);
- `JAPANESE_NATURALNESS_MODEL`.

## Pipeline, persistence, and Admin review

QA3 runs after QA2 at all three existing Factory checkpoints: initial generation, post-TTS QA refresh, and pre-approval. A QA3 FAIL sets aggregate Factory QA to failed and blocks Question Bank admission. Factory jobs already persist their whole JSON payload in Memory and Supabase, so no new table is required.

Admin review displays QA3 score, verdict, confidence, detected style, dimension scores, issues, and per-choice language findings without replacing QA1/QA2 panels.

Candidate active-session APIs use an explicit allowlist projection. QA3 evidence, answers, explanations, and internal audit data are excluded.

## Tests

Synthetic tests cover natural everyday Japanese, grammatical-but-unnatural wording, particles, collocation, over-formal conversation, over-casual notices, keigo misuse, written-style listening, artificial dialogue flow, malformed distractor leakage, low confidence, invalid provider output, complete choice analysis, technical failure, QA1/QA2 integration, and Candidate evidence isolation.

## Limitations

The deterministic mock recognizes a deliberately bounded set of reproducible language signals; it is not a substitute for a strong independent Japanese model or a native human reviewer. Production calibration should later compare QA3 evidence with human verdicts. Nuanced regional usage, highly context-dependent ellipsis, and subtle keigo judgments may still require human review.
