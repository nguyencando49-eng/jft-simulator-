# QA6 — Difficulty Calibration Judge

## Purpose and scope

QA6 estimates the effective difficulty of a complete learner task and compares it with the declared target level. It does not solve the answer, judge Japanese naturalness, authorize curriculum knowledge, decide JFT alignment, check originality, edit content, or change a production level automatically.

The repository's canonical persisted levels are `A1`, `A2.1`, and `A2.2`. Names such as `A2_1` in agent contracts refer to the same A2.1 product level; QA6 does not create a second level taxonomy.

All numeric weights, score boundaries, tolerance rules, and sample thresholds are **SIMULATOR DESIGN DECISIONS**. The internal score is not an official JFT metric and does not claim official calibration.

## Pipeline position

QA6 extends the existing Factory pipeline:

`Q0 → QA1 → QA2 → QA3 → QA4 → QA5 → QA6 → Human review`

It runs after QA5 during initial generation, post-TTS refresh, and pre-approval revalidation. Evidence is stored separately as `FactoryCandidate.difficultyCalibrationQa`; prior QA evidence is not overwritten. QA6 cannot rescue a QA2–QA5 failure.

## Independent two-stage judgment

Stage A receives learner-visible text, choices, the semantic Listening script when applicable, section/modality context, and the frozen calibration rubric. It receives an opaque correlation ID and never receives the declared level, answer, explanation, tags, generator reasoning, or QA1–QA5 verdicts.

The provider returns only:

- six normalized profile dimensions;
- reasoning depth;
- distractor strength;
- acoustic-assessment state;
- confidence and evidence.

Stage B is deterministic application code. It validates the profile, calculates the internal score, maps the score to a canonical level, compares declared versus estimated level, evaluates empirical disagreement, and constructs PASS/REVIEW/FAIL.

## Difficulty dimensions

`DIFFICULTY_CALIBRATION_V1` uses:

- linguistic complexity: vocabulary, kanji burden, grammar, sentence and expression structure;
- cognitive complexity: recognition, matching, integration, elimination and inference;
- processing load: length, turns, facts, memory burden and competing details;
- distractor competitiveness: plausibility and grammatical/semantic similarity;
- information density: meaningful relevant and irrelevant facts;
- modality load: Listening semantic memory burden or Reading search/referent load.

Reasoning depth is independently recorded as direct recall, direct match, single-step comprehension, multi-step comprehension, simple inference, or multi-factor inference. A small versioned adjustment ensures inference depth contributes without replacing the multidimensional profile.

## Calibration policy

The profile weights sum to one. Versioned boundaries map the internal 0–1 score to A1, A2.1, or A2.2 in one centralized module. Adjacent disagreement becomes REVIEW; a two-level mismatch becomes the conservative hard fail `EXTREME_LEVEL_MISMATCH`.

Listening script analysis cannot certify speech rate, pronunciation, noise, voice quality, or recording quality. Without acoustic metadata QA6 returns `ACOUSTIC_DIFFICULTY_NOT_ASSESSED` and REVIEW. Actual audio quality remains a separate audio QA responsibility.

Mixed profile signals and LOW confidence also require review. Long text alone, advanced-looking vocabulary alone, and response time alone never determine a level.

## Providers and validation

`DifficultyCalibrationProvider` has deterministic/mock and provider-neutral HTTP implementations. The prompt version is `JFT_DIFFICULTY_CALIBRATION_V1`; the policy version is `DIFFICULTY_CALIBRATION_V1`.

The analysis-only JSON contract is strict: exact fields, enum values, nonempty evidence, and finite 0–1 dimensions. An unsupported acoustic claim or unsafe provider output becomes technical REVIEW. It never becomes PASS.

Environment configuration:

- `DIFFICULTY_CALIBRATION_PROVIDER`
- `DIFFICULTY_CALIBRATION_ENDPOINT`
- `DIFFICULTY_CALIBRATION_API_KEY`
- `DIFFICULTY_CALIBRATION_MODEL`

## Empirical aggregation

`QuestionPerformanceAggregator` is separate from the QA judge. It aggregates submitted attempts against immutable `ExamVersion` snapshots and returns:

- attempt, correct and incorrect counts;
- correct rate;
- optional median/average item response time;
- response-time sample/exclusion counts;
- sample sufficiency;
- a reserved discrimination index.

Repository-derived observations currently provide correctness but not per-item response time. The session schema stores answer selections and whole-session timestamps only, so QA6 deliberately returns null item response-time statistics instead of inventing them.

At fewer than 30 attempts, the result remains `CONTENT_ESTIMATE`; the partial sample is recorded but cannot change the judgment. At 30 or more valid attempts, the result may become `HYBRID`, but empirical disagreement only creates `CALIBRATION_DISAGREEMENT` / `DIFFICULTY_REVIEW_REQUIRED`. It never relabels the level automatically. A 100-attempt threshold is preserved as a stronger future signal.

Response-time inputs outside 500 ms–10 minutes, abandoned observations, and expired observations are excluded by the current policy. These values are simulator rules. Response time is supporting evidence because tabs, accessibility needs, pauses, and network behavior make it noisy.

Low correct rate may mean high difficulty, a wrong key, ambiguity, curriculum drift, or poor distractors. Reviewers must consider QA2–QA5 evidence before changing an expected level.

IRT and automatic production relabeling are out of scope.

## Persistence, review, and security

Factory JSON persistence already stores the complete versioned QA6 result, provider/model, checked timestamp, content estimate, empirical aggregate, and calibration status. No duplicate QA table is introduced.

REVIEW evidence is bound with SHA-256 to learner-visible input, declared level, prompt version, and calibration version. New or materially changed REVIEW evidence must return to Admin before approval. The Admin panel shows the profile and issues without raw JSON.

Candidate APIs use an explicit question allowlist. Internal scores, empirical evidence, provider metadata, and calibration reasoning are never exposed to an active CandidateSession.

## Metrics

Persisted evidence supports:

- questions by estimated level;
- declared/estimated mismatch rate;
- difficulty review rate;
- empirical calibration coverage;
- unexpectedly easy/hard rates.

Metrics include sample/evaluable/technical counts and use null rates when no denominator exists. Technical provider reviews are excluded from content-defect denominators.

## Tests

Synthetic coverage includes fixtures A–G, multidimensional score behavior, Listening and Reading load, distractor effects, declared-level blinding, strict schemas, invalid/failing providers, confidence policy, empirical sample sizes, correct-rate disagreement, response-time outlier filtering, metrics, all Factory checkpoints, approval blocking/acknowledgement, and Candidate evidence isolation.

## Known limitations

- No per-question answer timestamp or response-time event is currently persisted.
- Candidate profiles do not contain a controlled learner-level field for stratified calibration.
- Item discrimination is reserved but unavailable; IRT is not implemented.
- The deterministic provider is a bounded development estimator, not an empirically calibrated model.
- Reading passage and question share one `prompt`, limiting structural load analysis.
- Actual Listening acoustics require future duration/speech-rate metadata or a dedicated audio analyzer.
- Factory candidates are unpublished and normally have no empirical attempts; evidence accumulates only after Question Bank publication and exam use.
- Direct Question Bank imports outside the Factory remain a pre-existing path that does not run the complete staged QA pipeline.
