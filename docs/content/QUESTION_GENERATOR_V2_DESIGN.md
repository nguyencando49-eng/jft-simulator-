# Question Generator V2 Design

Date: 2026-08-24

## Objective

Generator V2 optimizes for **Human Gold Yield**, not generated volume or machine-pass volume. Mass generation remains frozen until two consecutive 40-item pilots reach at least 70% independently confirmed Human Gold Yield.

## Pipeline

```text
Approved KnowledgeUnit
  -> QuestionPlan
  -> immutable ItemBlueprint
  -> core stimulus/question/answer stage
  -> independent distractor stage
  -> deterministic preflight
  -> QA1-QA7
  -> frozen human review
  -> failure taxonomy and generator metrics
```

The existing Question Factory and QA1-QA7 remain in place. Source-grounded QuestionPlan jobs now attach `ItemBlueprint[]` to the existing `FactoryRequest`; `runFactoryJob` uses the V2 path only when those blueprints are present. Legacy requests remain readable for backward compatibility.

## Immutable ItemBlueprint

`lib/server/generator-v2.ts` defines `JFT_ITEM_BLUEPRINT_V1`. The blueprint owns level, section, category, Can-do, topic, KnowledgeUnit IDs, target knowledge, task intent, stimulus format and limits, reasoning pattern, answer contract, distractor contract, template and seed.

The generation provider receives a clone and cannot silently mutate metadata. The application constructs Question metadata from the original blueprint, not from provider output. A changed correct answer is rejected before item construction.

## Answer-first design

The blueprint establishes `correctValue`, `answerSource` and `evidenceKey` before Japanese surface generation. The core stage must return the same contracted answer and point to learner-visible evidence. Listening preflight checks that the script contains the evidence; visible Listening text may not reveal the keyed answer.

## Distractor stage

The core stage cannot create choices. A separate provider call receives the frozen blueprint and accepted core, then returns exactly three distractors and the unchanged correct answer. Contracts require the same answer type, named learner misconceptions or nearby facts, natural language, distinct meanings and no nonsense.

The Azure adapter uses two versioned prompts:

- `JFT_GENERATOR_V2_CORE_V1`
- `JFT_GENERATOR_V2_DISTRACTOR_V1`

The deterministic adapter is a contract compiler for tests and the reproducible recovery pilot. It does not auto-approve content.

## Level contracts

`LEVEL_GENERATION_CONTRACTS` centralizes stimulus length, sentence/fact load, permitted reasoning patterns and distractor similarity for A1, A2.1 and A2.2. These are simulator design decisions, not official JFT calibration. QA6 remains the independent difficulty judge.

## Deterministic preflight

`JFT_GENERATOR_PREFLIGHT_V1` blocks:

- metadata mutation or invalid section/category;
- missing KnowledgeUnit/Can-do/topic/target knowledge;
- missing/invalid/duplicated answer;
- duplicate or dangerously near-identical choices;
- wrong question type;
- Listening without script or script evidence;
- visible Listening answer leakage;
- Reading without a separate stimulus;
- level-contract length overflow;
- known malformed Japanese structures.

Preflight never edits a candidate. The provider may retry at most three times. Exhaustion raises `GENERATION_FAILED`, so no candidate or Question Bank record exists.

## Approval safety

Generated V2 questions have `status=review`. Pilot generation writes only repository review artifacts. It does not call Question Bank insertion, Supabase, TTS publication, ExamVersion assembly or approval APIs. Existing QA hard failures retain authority and later QA cannot rescue an earlier failure.

## Failure feedback

Human decisions are stored separately from generated content. A future completed review can aggregate Gold/Revise/Reject by section, category, Can-do and template without rewriting the frozen pilot. Substantive edits count as non-Gold.

## Known limitations

- The repository curriculum catalog contains abstract lesson anchors, not complete approved SourceChunk coverage. QA4 therefore reports incomplete retrieval rather than fabricating certainty.
- Deterministic QA2 cannot independently solve every kanji/pragmatic item; those outcomes remain FAIL/REVIEW until an independent semantic provider or human judge completes them.
- Structural QA7 is intentionally strict and can flag shared category forms as near-duplicates. Human originality review remains necessary; thresholds were not lowered.
- No empirical QA6 calibration is available for new items.

