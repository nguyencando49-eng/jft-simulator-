# QA5 — JFT Alignment Judge

## Purpose and pipeline position

QA5 determines whether a generated question actually measures its declared section, category, Can-do or competency, communication purpose, and task type. It distinguishes a question that merely mentions a topic from an assessment item that requires the intended learner ability.

`Generator -> Q0 -> QA1 General Content -> QA2 Answer Oracle -> QA3 Japanese Naturalness -> QA4 Curriculum Grounding -> QA5 JFT Alignment -> Human Review`

QA5 is an independent judge. It reports evidence and never rewrites the question. Its evidence is stored separately as `FactoryCandidate.jftAlignmentQa`, so a QA5 failure cannot be hidden by an earlier gate's pass or by a high aggregate score.

## Non-scope

QA5 does not determine the correct answer, judge Japanese naturalness, authorize curriculum knowledge, calibrate difficulty, detect copying, or generate replacement content. Those responsibilities remain with QA1-QA4 and other dedicated gates. QA5 may mention a malformed option only when it creates a construct-irrelevant shortcut that changes what the item measures.

## Source of truth and reference versions

QA5 keeps official-reference evidence separate from simulator policy.

| Authority | Version recorded by QA5 | What it supports |
| --- | --- | --- |
| `OFFICIAL_REFERENCE` | `JFT_OFFICIAL_SPEC_2026_08_17` | The repository's Japan Foundation-backed summary of JFT-Basic's practical-communication purpose, A1-A2 Can-do basis, four sections, and category families. |
| `SIMULATOR_DESIGN_DECISION` | `JFT_SIMULATOR_TAXONOMY_V1` | Exact lower-snake identifiers, operational category boundaries, modality-dependency rules, construct-validity policy, scoring, thresholds, and release overrides. |

`JFT_OFFICIAL_SPEC_2026_08_17` is the repository snapshot identifier derived from the verification date recorded in `docs/jft-spec/JFT_OFFICIAL_SPEC.md`; it is not a version assigned by the Japan Foundation. The repository contains links to the primary sources but does not contain archived copies or hashes of those pages.

The runtime classifier receives a frozen `JFT_REFERENCE_RUBRIC` containing the supported official-reference facts, repository source-file identifiers, verification date, and explicit limitations. Operational category boundaries and release policy remain separately identified simulator decisions.

When the repository evidence does not justify a confident official-reference claim, QA5 emits `REFERENCE_EVIDENCE_INCOMPLETE` and returns REVIEW. It does not fill the gap with an invented official rule. A clear result based on the internal taxonomy remains a simulator judgment and must be presented as such.

## Canonical taxonomy

The machine source of truth is `lib/server/content-taxonomy.ts`. QA5 uses the existing lower-snake values and does not introduce a second taxonomy.

| Section | Canonical categories |
| --- | --- |
| `script_vocabulary` | `word_meaning`, `word_usage`, `kanji_reading`, `kanji_meaning_usage` |
| `conversation_expression` | `grammar`, `expression` |
| `listening` | `conversation`, `shop_public`, `announcement_instruction` |
| `reading` | `content_comprehension`, `information_search` |

The four section and category concepts are supported by the repository's official-reference summary. Their exact identifiers and the decision rules below are simulator representations. Practical topics such as work, transport, shopping, or health are planning facets, not assessment categories and not evidence that a competency matches.

Declared categories must belong to their declared section. QA5 does not silently treat coarse KnowledgeUnit skills or legacy hyphenated tags as canonical categories. Invalid, missing, conflicting, or ambiguous declaration metadata is surfaced explicitly.

## Declared-target evidence and repository gaps

For Factory candidates, the declared section comes from the question and Factory request, while category and Can-do come from `FactoryRequest` or the originating `QuestionPlanItem`. The plan or source objective is the nearest available declared task-purpose evidence.

The current repository has no first-class `taskType` or communication-skill taxonomy. When no objective is available, QA5 may retain the declared canonical category as a documented task-type fallback, but it does not present that fallback as official terminology. A vague or absent declaration can only produce insufficient evidence, not an invented match.

The core `QuestionRecord` also has no explicit category, Can-do, objective, visual descriptor, or separate Reading-passage field. Reading material and the question are combined in `prompt`; approved Listening records retain an audio URL but do not necessarily retain a transcript. These gaps require conservative classification and are listed under Known limitations.

## Independent, blinded classification

QA5 uses two stages so generator intent cannot become proof of alignment.

### Stage A — content-only classification

`JftAlignmentProvider.classify` receives the learner-visible instruction, prompt or passage, choices, an optional QA-only audio script, optional visual-presence evidence, and the versioned taxonomy/reference definitions. It does not receive:

- the declared section, category, Can-do, topic, task purpose, or difficulty;
- the declared answer key or explanation;
- generator reasoning or GenerationBrief justification;
- QA1-QA4 verdicts, scores, or reasoning.

The provider returns an analysis-only classification:

- `actualSection` and `actualCategory`;
- `actualCanDo` and a concise `actualAssessmentTarget`;
- `actualTaskType` and `communicativePurpose`;
- required modality and modality dependency;
- real-world validity, construct underrepresentation, and construct-irrelevant clues;
- uncertainty and evidence supporting the classification.

`actualAssessmentTarget` states the ability the learner must use, for example, "recognize the reading of a common workplace kanji" or "locate an opening time in a shop schedule." Topic overlap is not accepted as evidence.

The classification input builder replaces the real Question Bank ID with an opaque QA5 request ID before any provider, including the deterministic mock, receives it. This matters because generated IDs may contain a section name. Application code validates the echoed opaque ID and maps the persisted gate evidence back to the real internal question ID only after the blinded response returns.

### Stage B — deterministic comparison

Application code validates the provider output, validates declared section/category consistency, and compares the independent classification with the declarations. It calculates alignment states, normalized scores, issues, hard-fail overrides, verdict, and release status. Free-form provider prose never decides release and a provider cannot override a critical mismatch.

The validator also rejects internally inconsistent modality claims, such as classifying an item as Listening while declaring that only text is required. A complete task-type mismatch affects Task Validity and can block release; task-type uncertainty becomes REVIEW.

Invalid provider output or provider failure becomes a LOW-confidence technical REVIEW and can never become PASS.

## Section and category classification

### Script and Vocabulary

- `kanji_reading`: the learner must identify a kanji's pronunciation.
- `word_meaning`: the learner must identify an isolated word's lexical meaning.
- `word_usage`: the learner must select or recognize valid contextual or collocational use.
- `kanji_meaning_usage`: the learner must identify the meaning or appropriate use of a kanji expression.

The presence of kanji is not enough to classify an item as `kanji_reading`. A paragraph that must be understood for intent or action is not primarily vocabulary merely because it contains target words.

### Conversation and Expression

- `grammar`: the learner must select a grammatical form, particle, or construction that completes the utterance or sentence.
- `expression`: the learner must select language or a response appropriate to the speaker relationship, communicative intent, and situation.

QA5 evaluates the assessed communicative operation, not pure linguistic naturalness. A structurally sound grammar exercise may be artificial yet aligned with a declared `grammar` category; artificiality alone does not make it fail.

### Listening

An item is actually Listening only when answer-discriminating information must be processed from the audio.

- `conversation`: comprehension of an interaction or dialogue.
- `shop_public`: comprehension of a service interaction in a shop or public facility.
- `announcement_instruction`: comprehension of principally one-way announcements, directions, or instructions.

Location does not determine category. A dialogue at a station can remain `conversation`, and an announcement in a shop can be `announcement_instruction`, depending on what the learner must process.

### Reading

An item is actually Reading only when answer-discriminating information must be processed from supplied written material.

- `content_comprehension`: understand meaning, intent, action, relationship, or relevant content in a message, email, notice, memo, or other text.
- `information_search`: locate and match practical information in a schedule, menu, opening-hours display, poster, notice, table, or similar source.

An isolated kanji-reading item remains `kanji_reading` even when declared as Reading. A decorative passage that is unnecessary to answer does not establish Reading alignment.

The repository does not contain detailed official operational definitions for every borderline category. Multiple plausible classifications or an uncertain boundary therefore produce REVIEW rather than forced certainty.

## Can-do and communicative-purpose alignment

Can-do is currently free text rather than a versioned official catalogue identifier. QA5 independently describes what the learner can do to answer the item and compares semantic meaning, not exact strings.

The supported states are:

- `STRONG_MATCH`: the assessed operation and declared competency are substantively the same;
- `PARTIAL_MATCH`: the item assesses a meaningful but incomplete part of the declared competency;
- `WEAK_MATCH`: overlap exists, but the assessed operation is too narrow or indirect;
- `MISMATCH`: the learner succeeds through a different competency;
- `INSUFFICIENT_EVIDENCE`: the declaration or item evidence is too vague to compare safely.

A work-themed kanji-reading question does not measure the Can-do "understand simple workplace instructions." Shared topic, vocabulary, KnowledgeUnit membership, and generator intent do not increase the Can-do match by themselves.

QA5 extracts a communicative purpose such as request, permission, confirmation, information retrieval, instruction comprehension, schedule understanding, shopping interaction, workplace communication, public-life communication, or simple social interaction only when learner-visible evidence supports it. Otherwise the value remains unforced.

## Modality dependency

Required modality describes the evidence the learner actually needs: `TEXT`, `AUDIO`, `VISUAL`, `TEXT_AUDIO`, `TEXT_VISUAL`, or `OTHER`. Artifact presence is not dependency: `audio_choice`, an audio URL, an instruction to listen, or a decorative image does not prove the modality is required.

Dependency is normalized as:

- `STRONG`: the modality contains indispensable answer-discriminating evidence;
- `MODERATE`: the modality is necessary, with material support from another modality;
- `WEAK`: the modality mainly confirms an answer that visible evidence strongly suggests;
- `NONE`: the item can be answered without that modality.

For declared Listening, dependency `NONE` produces `LISTENING_NOT_REQUIRED` and a hard FAIL. Weak dependency produces `LISTENING_DEPENDENCY_WEAK` and REVIEW. The same policy applies to Reading through `READING_NOT_REQUIRED` and `READING_DEPENDENCY_WEAK`.

Because Reading text and the question share one `prompt`, the classifier cites the written span that supplies required evidence. If the correct response is available from the question wording or choices without reading that material, the passage is decorative.

If a question requires a visual but no visual evidence is supplied, QA5 records `ALIGNMENT_UNASSESSABLE_MISSING_VISUAL` and returns REVIEW. It does not invent visual content or duplicate QA2's hidden-context analysis.

## Task validity and construct evidence

Real-world task validity is `AUTHENTIC`, `PLAUSIBLE`, `ARTIFICIAL`, or `INVALID`. This is an internal assessment-quality judgment. An artificial exercise may still validly measure grammar or vocabulary; it becomes an alignment problem when the declaration claims a different real-world task such as information search.

`CONSTRUCT_UNDERREPRESENTED` means the item touches the declared skill but collapses it into a narrower ability. For example, a workplace-instruction context that only asks for an isolated word meaning underrepresents instruction comprehension.

`CONSTRUCT_IRRELEVANT_CLUE` records a shortcut unrelated to the declared construct, such as option length, formatting, a copied number, repeated wording, a visual pattern, or one malformed distractor. QA5 records the clue's effect on assessment validity and leaves general content or Japanese-language quality to the specialized gates.

## Deterministic scoring and release policy

The score is a simulator design decision, not official JFT scoring:

| Dimension | Maximum |
| --- | ---: |
| Section alignment | 20 |
| Category alignment | 20 |
| Can-do alignment | 20 |
| Task validity | 15 |
| Modality dependency | 10 |
| Communicative authenticity | 10 |
| Metadata consistency | 5 |
| Total | 100 |

Scores of 90-100 are PASS candidates, 80-89 require REVIEW, and scores below 80 FAIL. A critical mismatch always overrides the score.

Hard-fail conditions include:

- `SECTION_MISMATCH_CRITICAL`;
- `CATEGORY_MISMATCH_CRITICAL`;
- `LISTENING_NOT_REQUIRED`;
- `READING_NOT_REQUIRED`;
- `CAN_DO_MISMATCH_CRITICAL`;
- `TASK_TYPE_MISMATCH` when independent task evidence decisively contradicts the declared task;
- `INVALID_ASSESSMENT_TARGET`;
- `QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL`.

Review conditions include:

- `PARTIAL_CAN_DO_MATCH` or weak Can-do alignment;
- `WEAK_MODALITY_DEPENDENCY`;
- `REFERENCE_EVIDENCE_INCOMPLETE`;
- `UNCERTAIN_CATEGORY` or `MULTIPLE_PLAUSIBLE_CATEGORIES`;
- `CONSTRUCT_UNDERREPRESENTED`;
- `ALIGNMENT_UNASSESSABLE_MISSING_VISUAL`;
- `LOW_CONFIDENCE`;
- invalid provider output or provider failure.

Only a normalized PASS is eligible to proceed automatically. REVIEW requires human inspection. FAIL or `hardFail: true` blocks approval even when QA1-QA4 passed and the total score is high.

The pre-approval checkpoint compares newly generated REVIEW evidence with the evidence the Admin previously saw. A new or materially changed REVIEW is not admitted during that approval call; it must first return to the review workspace.

## Validated output contract

The provider and application boundary accepts JSON only. Strict validation rejects unknown enum values, malformed issues, inconsistent section/category pairs, mismatched question/version identifiers, missing assessment evidence, invalid score ranges, and provider attempts to supply release policy.

The persisted normalized result contains `qaVersion`, `questionId`, `verdict`, `hardFail`, `confidence`, `declared`, `independentAssessment`, `alignment`, `taskValidity`, `scores`, `issues`, and `release`, followed by audit metadata: `provider`, optional `model`, `promptVersion`, `referenceVersion`, `taxonomyVersion`, and `checkedAt`. The canonical QA and prompt version is `JFT_ALIGNMENT_V1`.

The independent-assessment portion is the provider's blinded content classification. Declared metadata, alignment comparisons, scores, verdict, hard-fail state, and release eligibility are normalized by application code after that classification; they are not trusted from free-form model output.

## Provider, persistence, and security

`JftAlignmentProvider` is vendor-neutral and has deterministic/mock and HTTP implementations. The prompt and output contract are versioned as `JFT_ALIGNMENT_V1`. The deterministic provider is intended for bounded tests and local development; production semantic classification requires a capable independent provider and human calibration.

The existing Factory job JSON payload persists:

- question ID and QA version;
- provider and model;
- prompt version;
- `JFT_OFFICIAL_SPEC_2026_08_17` reference version;
- `JFT_SIMULATOR_TAXONOMY_V1` taxonomy version;
- checked timestamp;
- the complete normalized QA5 evidence and release result.

No second QA result table is required. Existing `factory_jobs` RLS and Admin-only repository routes protect the payload. Candidate question/session APIs use an explicit allowlist and never expose QA5 classifications, Can-do mappings, reasoning, issues, provider metadata, or other internal QA evidence.

The Admin Factory review renders a compact QA5 panel after QA4: declared versus detected section/category, assessment target, Can-do match, modality dependency, real-world validity, verdict, and human-readable issues. Raw JSON is not shown by default.

## Metrics readiness

Persisted normalized fields support future calculation of `sectionMismatchRate`, `categoryMismatchRate`, `canDoMismatchRate`, `listeningDependencyFailureRate`, `readingDependencyFailureRate`, `constructUnderrepresentationRate`, and `alignmentReviewRate`. QA5 does not add a separate metrics dashboard.

The operational summary also returns total, evaluable, technical-review, Listening, and Reading QA5 sample counts. Rates are `null` when their denominator is zero, so missing QA5 evidence is not presented as a false-green 0% failure rate. Invalid-output/provider-failure reviews are excluded from content-defect denominators, while still contributing to the review-workload rate.

## Tests

Synthetic fixtures cover:

- Reading / information search declared for an isolated `病院` kanji-reading item: actual Script/Vocabulary / kanji reading and FAIL;
- Listening where an unseen departure time exists only in audio: strong audio dependency;
- Listening where visible text already supplies the complete answer: `LISTENING_NOT_REQUIRED` and FAIL;
- Reading / information search that requires locating shop opening time: PASS;
- workplace-instruction Can-do declared for isolated kanji reading: Can-do mismatch;
- a valid grammar exercise declared as `grammar`: not failed merely because it is less communicative.

Additional coverage includes semantic Can-do paraphrases, same-topic/different-competency items, station and shop category boundaries, decorative audio or passages, construct underrepresentation, construct-irrelevant clues, multiple plausible categories, missing visual/reference evidence, low confidence, invalid output, provider failure, and strict output validation.

A metamorphic blinding test evaluates identical learner-visible content under different declarations and requires the same independent classification. Integration tests verify all three Factory checkpoints, QA1-QA4 PASS plus QA5 FAIL blocking final approval, Candidate evidence isolation, and normalized metric counters.

## Known limitations

- The repository has no machine-readable official Can-do catalogue, identifiers, or semantic mappings. QA5 can compare against declared free text but cannot certify official Can-do membership.
- Fine-grained category boundary definitions are simulator rules because the repository's official-reference summary provides category families, not a complete operational rubric.
- There is no canonical task-type or communication-skill enum. Plan/source objectives are free text and category fallback is only an internal compatibility rule.
- Reading passage and question text share `QuestionRecord.prompt`, limiting deterministic passage-dependency analysis.
- The core schema has no visual asset or descriptor, so visual dependency is unassessable unless separate evidence is supplied.
- Approved Question Bank records may lack the Factory audio script and explicit category/Can-do metadata. Retrospective QA5 review can therefore require human evidence.
- Legacy category tags and coarse KnowledgeUnit skills are not canonical declarations and are not silently promoted to official taxonomy values.
- The deterministic provider is intentionally bounded. Borderline semantic classification, pragmatic purpose, and construct validity require an independent production provider plus reviewed calibration examples.
- The reference snapshot records a verification date and source links but does not archive the external pages. A future reference update must change the recorded version and preserve prior approval evidence.
- Direct Question Bank import outside the Factory remains a pre-existing path that does not run the complete staged QA pipeline.
