# Controlled A1 QA Gate Integrity Audit

Generated: 2026-08-27T05:14:35.339Z

No questions were generated, edited, approved, or published by this audit. Historical QA evidence remains in `controlled-a1-1320-qa-rerun.json`.

## Current counts

TECHNICAL is an overlapping diagnostic count; it does not replace or rewrite the persisted verdict.

| Gate | PASS | REVIEW | FAIL | TECHNICAL / evidence affected |
|---|---:|---:|---:|---:|
| QA1 | 0 | 393 | 927 | 1320 |
| QA2 | 426 | 0 | 894 | 0 |
| QA3 | 1320 | 0 | 0 | 0 |
| QA4 | 0 | 1319 | 1 | 1320 |
| QA5 | 0 | 751 | 569 | 1097 |
| QA6 | 777 | 542 | 1 | 330 |
| QA7 | 47 | 446 | 827 | 0 |

### QA1

| Issue code | Occurrences |
|---|---:|
| INSUFFICIENT_EVIDENCE | 856 |
| CATEGORY_MISMATCH | 598 |
| CAN_DO_MISMATCH | 302 |
| LEVEL_MISMATCH | 240 |
| ANSWER_LEAKAGE | 53 |
| ANSWER_KEY_MISMATCH | 31 |
| OUT_OF_CURRICULUM | 4 |
| DISTRACTOR_QUALITY_LOW | 1 |

### QA2

| Issue code | Occurrences |
|---|---:|
| None | 0 |

### QA3

| Issue code | Occurrences |
|---|---:|
| None | 0 |

### QA4

| Issue code | Occurrences |
|---|---:|
| AMBIGUOUS_SUPPORT | 3318 |
| LOW_CONFIDENCE | 1320 |
| PROVENANCE_INCOMPLETE | 1210 |
| INSUFFICIENT_CURRICULUM_EVIDENCE | 20 |
| DISTRACTOR_OUT_OF_CURRICULUM | 4 |
| REQUIRED_GRAMMAR_UNSUPPORTED | 1 |
| OUT_OF_CURRICULUM | 1 |

### QA5

| Issue code | Occurrences |
|---|---:|
| TASK_TYPE_EVIDENCE_INCOMPLETE | 979 |
| CATEGORY_MISMATCH_CRITICAL | 831 |
| REFERENCE_EVIDENCE_INCOMPLETE | 457 |
| UNCERTAIN_CATEGORY | 457 |
| QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL | 380 |
| CAN_DO_MISMATCH_CRITICAL | 379 |
| SECTION_MISMATCH_CRITICAL | 370 |
| MULTIPLE_PLAUSIBLE_CATEGORIES | 312 |
| PARTIAL_CAN_DO_MATCH | 228 |
| TASK_TYPE_MISMATCH | 179 |
| WEAK_CAN_DO_MATCH | 97 |
| TASK_TYPE_PARTIAL_MATCH | 69 |
| ALIGNMENT_UNASSESSABLE_MISSING_VISUAL | 3 |
| LISTENING_NOT_REQUIRED | 3 |
| CONSTRUCT_UNDERREPRESENTED | 3 |
| CONSTRUCT_IRRELEVANT_CLUE | 3 |

### QA6

| Issue code | Occurrences |
|---|---:|
| ACOUSTIC_DIFFICULTY_NOT_ASSESSED | 330 |
| LEVEL_SLIGHTLY_HARDER | 247 |
| MIXED_DIFFICULTY_SIGNAL | 90 |
| EXTREME_LEVEL_MISMATCH | 1 |

### QA7

| Issue code | Occurrences |
|---|---:|
| DUPLICATE_RISK | 5929 |
| NEAR_DUPLICATE_HIGH | 3434 |
| EXACT_DUPLICATE | 1537 |

## Root causes — ranked

1. **QA_POLICY (1,320):** QA1's documented PASS threshold was 90, but its implemented maximum was 89. PASS was impossible.
2. **CURRICULUM_RETRIEVAL + QA_INPUT_BINDING (1,320):** frozen artifacts persist planning-catalog IDs, but not APPROVED KnowledgeUnit records or real SourceChunk provenance. The V1 rerun incorrectly synthesized approval/chunks and claimed complete retrieval.
3. **ORIGINALITY / GENERATOR TEMPLATE COLLAPSE (1,273 non-PASS; 827 FAIL):** QA7 has no provider/evidence technical errors; high same-batch structural reuse is real deterministic evidence.
4. **GENERATOR_CONTENT (894):** QA2 independently reports 616 no-answer, 258 multiple-answer, 19 answer-key mismatch, and 1 hidden-context failure.
5. **GENERATOR_CONTENT / BLUEPRINT alignment (831 category mismatches; 370 section mismatches):** QA5 receives non-empty metadata unchanged, but the independently detected task often differs.
6. **QA_PROVIDER / REFERENCE LIMITATION (979 task-type evidence incomplete; 457 reference incomplete):** the local deterministic QA5 classifier cannot certify many semantic task boundaries.
7. **DIFFICULTY calibration (543 non-PASS):** 247 slightly harder, 90 mixed signals, 1 extreme mismatch; 330 Listening items lack acoustic evidence.

## QA1 zero-pass explanation

The zero is not proof that all content failed. The score maxima were 18+12+13+15+7+9+5+5+5 = **89**, while PASS starts at 90. This is a confirmed QA contract bug. The fix restores the documented maxima (20/15/15/15/10/10/5/5/5) without changing the 90 threshold. QA1 still reports real answer leakage, answer mismatch, category, Can-do, level, and distractor failures.

## QA1 representative sample and QA5 end-to-end comparison

### A1-CB001-SV-01

- Question: 「住所」の よみかたは どれですか。
- Choices: じゅうしょ | じゅしょ | じゅうじょ | すみしょ
- QA1 input: section=script_vocabulary; category=kanji_reading; Can-do=Can recognize the reading of the common A1 word 住所.; KnowledgeUnit=A1-N03; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE; score=73/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: script_vocabulary / kanji_reading / Can recognize the reading of the common A1 word 住所. / controlled-a1:kanji-reading:address
- QA5 received: script_vocabulary / kanji_reading / Can recognize the reading of the common A1 word 住所. / controlled-a1:kanji-reading:address
- QA5 independent: script_vocabulary / kanji_reading / Recognize the reading of a Japanese kanji. / kanji_reading
- QA5 issues: PARTIAL_CAN_DO_MATCH
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB017-SV-03

- Question: このシャツの＿＿＿はいくらですか。
- Choices: サイズ | 会計 | 値段 | 色
- QA1 input: section=script_vocabulary; category=kanji_meaning_usage; Can-do=ask prices and buy quantities of goods; KnowledgeUnit=A1-N16; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE, CAN_DO_MISMATCH; score=65/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: script_vocabulary / kanji_meaning_usage / ask prices and buy quantities of goods / SV-KMU-03
- QA5 received: script_vocabulary / kanji_meaning_usage / ask prices and buy quantities of goods / SV-KMU-03
- QA5 independent: conversation_expression / grammar / Choose a grammatical form that completes a sentence. / grammar
- QA5 issues: SECTION_MISMATCH_CRITICAL, CATEGORY_MISMATCH_CRITICAL, CAN_DO_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE, QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### A1-CB033-SV-05

- Question: 店員さん、＿＿＿をお願いします。
- Choices: ハンバーガー | コーヒー | サラダ | ピザ
- QA1 input: section=script_vocabulary; category=word_usage; Can-do=order simple food and drinks at a shop or restaurant; KnowledgeUnit=A1-N06; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE, CAN_DO_MISMATCH, CATEGORY_MISMATCH; score=62/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: script_vocabulary / word_usage / order simple food and drinks at a shop or restaurant / SV-WU-A1-CB033-05
- QA5 received: script_vocabulary / word_usage / order simple food and drinks at a shop or restaurant / SV-WU-A1-CB033-05
- QA5 independent: conversation_expression / grammar / Choose a grammatical form that completes a sentence. / grammar
- QA5 issues: SECTION_MISMATCH_CRITICAL, CATEGORY_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE, QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### A1-CB050-SV-02

- Question: 私の＿＿＿は東京に住んでいます。
- Choices: 友達 | 家族 | 父 | 母
- QA1 input: section=script_vocabulary; category=kanji_meaning_usage; Can-do=talk simply about family and where people live; KnowledgeUnit=A1-N04; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE, CAN_DO_MISMATCH; score=65/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: script_vocabulary / kanji_meaning_usage / talk simply about family and where people live / sentence
- QA5 received: script_vocabulary / kanji_meaning_usage / talk simply about family and where people live / sentence
- QA5 independent: conversation_expression / grammar / Choose a grammatical form that completes a sentence. / grammar
- QA5 issues: SECTION_MISMATCH_CRITICAL, CATEGORY_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE, QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### GR2-A1-SV-10

- Question: 「新幹線」の よみかたは どれですか。
- Choices: にいかんせん | しんかんせん | しんかんぜん | しんせんかん
- QA1 input: section=script_vocabulary; category=kanji_reading; Can-do=Can recognize the reading of the common A1 word 新幹線.; KnowledgeUnit=A1-N18; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE; score=73/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: script_vocabulary / kanji_reading / Can recognize the reading of the common A1 word 新幹線. / script_vocabulary:kanji_reading:v2
- QA5 received: script_vocabulary / kanji_reading / Can recognize the reading of the common A1 word 新幹線. / script_vocabulary:kanji_reading:v2
- QA5 independent: script_vocabulary / kanji_reading / Recognize the reading of a Japanese kanji. / kanji_reading
- QA5 issues: PARTIAL_CAN_DO_MATCH
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB001-CE-01

- Question: 受付で名前を確認しています。 / 受付：お名前は どう 書きますか。 / 客：＿＿＿＿＿＿。
- Choices: リンさんは どこですか。 | カタカナで「リン」です。 | 名前は 受付です。 | カタカナを 読みません。
- QA1 input: section=conversation_expression; category=expression; Can-do=Can spell one’s name when asked at reception.; KnowledgeUnit=A1-N03; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE; score=79/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: conversation_expression / expression / Can spell one’s name when asked at reception. / controlled-a1:expression:name-spelling
- QA5 received: conversation_expression / expression / Can spell one’s name when asked at reception. / controlled-a1:expression:name-spelling
- QA5 independent: conversation_expression / grammar / Choose a grammatical form that completes a sentence. / grammar
- QA5 issues: CATEGORY_MISMATCH_CRITICAL, TASK_TYPE_MISMATCH, QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### A1-CB017-CE-03

- Question: 初めて会う人と自己紹介する。 / 初めまして。お名前は何ですか？ / 私の名前は
- Choices: 私は日本からです。 | 私は会社員です。 | 私は友達と話します。 | 私の名前はアリです。
- QA1 input: section=conversation_expression; category=grammar; Can-do=introduce oneself and exchange basic identity information; KnowledgeUnit=A1-N03; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE; score=79/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: conversation_expression / grammar / introduce oneself and exchange basic identity information / CE-GR-03
- QA5 received: conversation_expression / grammar / introduce oneself and exchange basic identity information / CE-GR-03
- QA5 independent: script_vocabulary / word_usage / Choose language that fits a short written context. / word_usage
- QA5 issues: REFERENCE_EVIDENCE_INCOMPLETE, UNCERTAIN_CATEGORY, MULTIPLE_PLAUSIBLE_CATEGORIES, SECTION_MISMATCH_CRITICAL, CATEGORY_MISMATCH_CRITICAL, PARTIAL_CAN_DO_MATCH, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB033-CE-05

- Question: 同僚が先週の休みについて聞きます。 / この前の休み、何をしましたか。 / 私は
- Choices: 行きます。 | 買い物をしました。 | 掃除をします。 | 休みます。
- QA1 input: section=conversation_expression; category=grammar; Can-do=talk simply about past days off; KnowledgeUnit=A1-N17; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE; score=79/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: conversation_expression / grammar / talk simply about past days off / CE-GR-A1-CB033-05
- QA5 received: conversation_expression / grammar / talk simply about past days off / CE-GR-A1-CB033-05
- QA5 independent: script_vocabulary / word_usage / Choose language that fits a short written context. / word_usage
- QA5 issues: REFERENCE_EVIDENCE_INCOMPLETE, UNCERTAIN_CATEGORY, MULTIPLE_PLAUSIBLE_CATEGORIES, SECTION_MISMATCH_CRITICAL, CATEGORY_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB050-CE-02

- Question: 友達が休みの過ごし方を話す / 昨日は休みでした。買い物と掃除をして、大変でした。 / それは、
- Choices: すごいですね | わかりました | お疲れさまでした | いいですね
- QA1 input: section=conversation_expression; category=grammar; Can-do=talk simply about past days off; KnowledgeUnit=A1-N17; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: ANSWER_KEY_MISMATCH; score=79/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: GENERATOR_CONTENT plus QA_POLICY
- QA5 Blueprint declared: conversation_expression / grammar / talk simply about past days off / dialogue
- QA5 received: conversation_expression / grammar / talk simply about past days off / dialogue
- QA5 independent: script_vocabulary / word_usage / Choose language that fits a short written context. / word_usage
- QA5 issues: REFERENCE_EVIDENCE_INCOMPLETE, UNCERTAIN_CATEGORY, MULTIPLE_PLAUSIBLE_CATEGORIES, SECTION_MISMATCH_CRITICAL, CATEGORY_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### GR2-A1-CE-10

- Question: 日本でしてみたいことを話しています。 / A：日本で 何を したいですか。 / B：＿＿＿＿＿＿。
- Choices: 新幹線に 乗りました。 | 新幹線が あります。 | 新幹線を 見ません。 | 新幹線に 乗りたいです。
- QA1 input: section=conversation_expression; category=grammar; Can-do=Can say a simple travel goal in Japan.; KnowledgeUnit=A1-N18; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE, CATEGORY_MISMATCH; score=76/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: conversation_expression / grammar / Can say a simple travel goal in Japan. / conversation_expression:travel-goal
- QA5 received: conversation_expression / grammar / Can say a simple travel goal in Japan. / conversation_expression:travel-goal
- QA5 independent: conversation_expression / expression / Choose an appropriate expression for a conversational situation. / expression
- QA5 issues: CATEGORY_MISMATCH_CRITICAL, CAN_DO_MISMATCH_CRITICAL, TASK_TYPE_PARTIAL_MATCH, QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### A1-CB001-LI-01

- Question: 大阪行きの 電車は 何番ホームから 出ますか。
- Choices: 5番 | 7番 | 6番 | 4番
- QA1 input: section=listening; category=announcement_instruction; Can-do=Can understand a changed train platform.; KnowledgeUnit=A1-N13; sourceDocument=resolved from planning catalog; audioEvidence=true
- QA1 issues: INSUFFICIENT_EVIDENCE, CATEGORY_MISMATCH; score=76/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: listening / announcement_instruction / Can understand a changed train platform. / controlled-a1:listening:platform-change
- QA5 received: listening / announcement_instruction / Can understand a changed train platform. / controlled-a1:listening:platform-change
- QA5 independent: listening / conversation / Understand key information in a simple conversation. / conversation
- QA5 issues: REFERENCE_EVIDENCE_INCOMPLETE, UNCERTAIN_CATEGORY, CATEGORY_MISMATCH_CRITICAL, PARTIAL_CAN_DO_MATCH, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB017-LI-03

- Question: 誰が券を買いますか？
- Choices: 温泉に入りたい人 | 景色を見たい人 | 寺に行く人 | 観光客
- QA1 input: section=listening; category=announcement_instruction; Can-do=say what one wants to do at a destination; KnowledgeUnit=A1-N14; sourceDocument=resolved from planning catalog; audioEvidence=true
- QA1 issues: CATEGORY_MISMATCH; score=80/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY
- QA5 Blueprint declared: listening / announcement_instruction / say what one wants to do at a destination / LI-ANN-03
- QA5 received: listening / announcement_instruction / say what one wants to do at a destination / LI-ANN-03
- QA5 independent: listening / announcement_instruction / Understand a simple spoken announcement or instruction. / announcement_instruction
- QA5 issues: CAN_DO_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE, QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### A1-CB033-LI-05

- Question: 誰が広島に住んでいますか？
- Choices: 兄 | 姉 | 父 | 母
- QA1 input: section=listening; category=announcement_instruction; Can-do=talk simply about family and where people live; KnowledgeUnit=A1-N04; sourceDocument=resolved from planning catalog; audioEvidence=true
- QA1 issues: CATEGORY_MISMATCH; score=80/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY
- QA5 Blueprint declared: listening / announcement_instruction / talk simply about family and where people live / tmpl-A1-CB033-LI-05
- QA5 received: listening / announcement_instruction / talk simply about family and where people live / tmpl-A1-CB033-LI-05
- QA5 independent: listening / conversation / Understand key information in a simple conversation. / conversation
- QA5 issues: REFERENCE_EVIDENCE_INCOMPLETE, UNCERTAIN_CATEGORY, CATEGORY_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB050-LI-02

- Question: 話し手は日本で何をしたいと言っていますか？
- Choices: 新幹線に乗りたい | 旅行したい | 温泉に入りたい | 富士山を見たい
- QA1 input: section=listening; category=shop_public; Can-do=say what one wants to experience in Japan; KnowledgeUnit=A1-N18; sourceDocument=resolved from planning catalog; audioEvidence=true
- QA1 issues: INSUFFICIENT_EVIDENCE, CATEGORY_MISMATCH, LEVEL_MISMATCH; score=73/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: listening / shop_public / say what one wants to experience in Japan / dialogue
- QA5 received: listening / shop_public / say what one wants to experience in Japan / dialogue
- QA5 independent: listening / conversation / Understand key information in a simple conversation. / conversation
- QA5 issues: REFERENCE_EVIDENCE_INCOMPLETE, UNCERTAIN_CATEGORY, CATEGORY_MISMATCH_CRITICAL, PARTIAL_CAN_DO_MATCH, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### GR2-A1-LI-10

- Question: Bさんは 午後、何を しましたか。
- Choices: 仕事を しました | 部屋を 掃除しました | 買い物に 行きました | 映画を 見ました
- QA1 input: section=listening; category=conversation; Can-do=Can understand a simple past activity.; KnowledgeUnit=A1-N17; sourceDocument=resolved from planning catalog; audioEvidence=true
- QA1 issues: INSUFFICIENT_EVIDENCE, LEVEL_MISMATCH; score=70/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: listening / conversation / Can understand a simple past activity. / listening:past-routine
- QA5 received: listening / conversation / Can understand a simple past activity. / listening:past-routine
- QA5 independent: listening / conversation / Understand key information in a simple conversation. / conversation
- QA5 issues: PARTIAL_CAN_DO_MATCH, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB001-RE-01

- Question: 【空港行きバス】 / 16時20分　17時30分　18時40分 / ※18時40分が 最後です。 /  / 最後の バスは 何時ですか。
- Choices: 16時20分 | 17時30分 | 19時40分 | 18時40分
- QA1 input: section=reading; category=information_search; Can-do=Can find the last bus time in a simple timetable.; KnowledgeUnit=A1-N13; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE, CATEGORY_MISMATCH, LEVEL_MISMATCH; score=73/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: reading / information_search / Can find the last bus time in a simple timetable. / controlled-a1:reading:last-bus
- QA5 received: reading / information_search / Can find the last bus time in a simple timetable. / controlled-a1:reading:last-bus
- QA5 independent: reading / information_search / Locate and match practical information in a written schedule or notice. / information_search
- QA5 issues: TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### A1-CB017-RE-03

- Question: 空港へはバスで行きます。駅で乗り換えます。 /  / どこで乗り換えますか？
- Choices: 駅に行きます。 | 駅で乗り換えます。 | 空港で乗り換えます。 | バスで乗り換えます。
- QA1 input: section=reading; category=content_comprehension; Can-do=ask about and follow simple transportation routes; KnowledgeUnit=A1-N13; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: none; score=89/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY
- QA5 Blueprint declared: reading / content_comprehension / ask about and follow simple transportation routes / RE-CC-03
- QA5 received: reading / content_comprehension / ask about and follow simple transportation routes / RE-CC-03
- QA5 independent: reading / information_search / Locate and match practical information in a written schedule or notice. / information_search
- QA5 issues: CATEGORY_MISMATCH_CRITICAL, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### A1-CB033-RE-05

- Question: 私の名前は鈴木です。国は日本で、会社はABCです。友達は多いです。 /  / この人の会社はどこですか？
- Choices: XYZ | DEF | GHI | ABC
- QA1 input: section=reading; category=content_comprehension; Can-do=introduce oneself and exchange basic identity information; KnowledgeUnit=A1-N03; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: none; score=89/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY
- QA5 Blueprint declared: reading / content_comprehension / introduce oneself and exchange basic identity information / tmpl-A1-CB033-RE-05
- QA5 received: reading / content_comprehension / introduce oneself and exchange basic identity information / tmpl-A1-CB033-RE-05
- QA5 independent: reading / information_search / Locate and match practical information in a written schedule or notice. / information_search
- QA5 issues: CATEGORY_MISMATCH_CRITICAL, PARTIAL_CAN_DO_MATCH, TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: GENERATOR_CONTENT or BLUEPRINT classification mismatch

### A1-CB050-RE-02

- Question: 休みの日、買い物と掃除をしました。午後は友達と話しました。 /  / 休みの日に何をしましたか？
- Choices: 買い物と掃除をしました | 映画を見ました | 旅行しました | 仕事をしました
- QA1 input: section=reading; category=content_comprehension; Can-do=talk simply about past days off; KnowledgeUnit=A1-N17; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: none; score=89/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY
- QA5 Blueprint declared: reading / content_comprehension / talk simply about past days off / message
- QA5 received: reading / content_comprehension / talk simply about past days off / message
- QA5 independent: reading / content_comprehension / Understand key content and intent in a practical written text. / content_comprehension
- QA5 issues: TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

### GR2-A1-RE-10

- Question: 【私の休み】 / 午前はスーパーで買い物をしました。午後は家を掃除しました。 /  / 午後、何を しましたか。
- Choices: 買い物を しました | 映画を 見ました | 仕事を しました | 家を 掃除しました
- QA1 input: section=reading; category=content_comprehension; Can-do=Can understand a short account of a day off.; KnowledgeUnit=A1-N17; sourceDocument=resolved from planning catalog; audioEvidence=N/A
- QA1 issues: INSUFFICIENT_EVIDENCE; score=79/100 (old implementation ceiling 89)
- Expected QA1 contract: the same learner-visible item and metadata, but a reachable 100-point weighting; QA2 remains the independent answer authority.
- QA1 root: QA_POLICY + QA_PROVIDER
- QA5 Blueprint declared: reading / content_comprehension / Can understand a short account of a day off. / reading:day-off
- QA5 received: reading / content_comprehension / Can understand a short account of a day off. / reading:day-off
- QA5 independent: reading / content_comprehension / Understand key content and intent in a practical written text. / content_comprehension
- QA5 issues: TASK_TYPE_EVIDENCE_INCOMPLETE
- QA5 root: QA_PROVIDER/REFERENCE evidence or partial construct match

## QA4 zero-pass explanation

Representative trace (all 1,320 follow the same persistence shape):

1. Generation uses `blueprint.knowledgeUnitIds` such as `A1-N03`.
2. IDs are persisted in Blueprint and question tags.
3. Rerun loads those IDs correctly.
4. The checked-in planning catalog has matching IDs, but it has no APPROVED status and is not the repository's approved KnowledgeUnit store.
5. Frozen artifacts contain no real SourceChunk IDs/text.
6. Therefore authoritative `retrieval.complete` cannot truthfully be true.
7. Provenance cannot be complete from Question → approved KnowledgeUnit → SourceChunk → Source.
8. QA4 V1 was blocked for every item by provider LOW confidence and mostly by ambiguous mappings/provenance; only one item received an apparent content hard fail, but that hard fail relied on the incorrectly asserted complete search and is not reliable.

Conclusion: QA4=0 is primarily **EVIDENCE_PIPELINE_INCOMPLETE**, not 1,320 proven out-of-curriculum items. The integrity control now refuses to fabricate approved units/chunks and returns REVIEW rather than false PASS/FAIL.

## QA5 zero-pass explanation

- Empty declared category: 0
- Empty declared Can-do: 0
- Empty declared taskType: 0
- Category changed in transport: 0
- Can-do changed in transport: 0
- Binding used: `blueprint.templateId`

Metadata is not lost. The Blueprint lacks a dedicated semantic `taskType`; the rerun uses the existing template ID. A 40-item experiment substituting `taskIntent` did not improve verdicts and weakened some strong matches, so it was rejected and not retained as a fix. QA5=0 combines real construct mismatches with deterministic-provider/reference limitations. Thresholds were unchanged.

## QA7 low-pass explanation

No `SOURCE_EVIDENCE_MISSING`, invalid-output, or provider-failure code occurred. QA7 is therefore an actual originality signal in this run: 1,537 exact-duplicate issue occurrences, 3,434 high near-duplicate occurrences, and 5,929 medium duplicate-risk occurrences. Occurrences exceed item count because one item may match several comparisons.

| Structural family | Items | QA7 P/R/F | Examples |
|---|---:|---:|---|
| conversation_expression|expression|appropriate-response|dialogue | 169 | 4/93/72 | GR-A1-CE-01, GR-A1-CE-02, GR-A1-CE-04, GR-A1-CE-05 |
| conversation_expression|grammar|appropriate-response|dialogue | 161 | 3/111/47 | GR-A1-CE-03, GR-A1-CE-06, GR-A1-CE-09, GR-A1-CE-10 |
| script_vocabulary|kanji_reading|direct-recognition|isolated-term | 101 | 0/1/100 | GR-A1-SV-01, GR-A1-SV-02, GR-A1-SV-03, GR-A1-SV-04 |
| listening|conversation|single-step-comprehension|dialogue | 101 | 0/10/91 | GR-A1-LI-08, GR-A1-LI-10, GR2-A1-LI-03, GR2-A1-LI-07 |
| listening|shop_public|single-step-comprehension|dialogue | 91 | 1/9/81 | GR-A1-LI-02, GR2-A1-LI-02, GR2-A1-LI-06, A1-CB001-LI-02 |
| reading|information_search|single-information-retrieval|message | 87 | 2/34/51 | A1-CB005-RE-02, A1-CB005-RE-04, A1-CB006-RE-05, A1-CB007-RE-02 |
| script_vocabulary|word_usage|direct-recognition|sentence | 79 | 1/14/64 | A1-CB001-SV-03, A1-CB001-SV-04, A1-CB002-SV-03, A1-CB002-SV-04 |
| reading|content_comprehension|single-information-retrieval|notice | 76 | 8/42/26 | GR-A1-RE-05, GR-A1-RE-09, GR2-A1-RE-02, GR2-A1-RE-05 |
| script_vocabulary|word_meaning|direct-recognition|isolated-term | 73 | 0/9/64 | A1-CB001-SV-05, A1-CB005-SV-04, A1-CB006-SV-03, A1-CB007-SV-02 |
| script_vocabulary|kanji_meaning_usage|direct-recognition|sentence | 70 | 1/12/57 | A1-CB006-SV-02, A1-CB007-SV-01, A1-CB007-SV-05, A1-CB008-SV-04 |
| listening|announcement_instruction|single-step-comprehension|announcement | 66 | 1/18/47 | GR-A1-LI-01, GR-A1-LI-03, GR-A1-LI-04, GR-A1-LI-05 |
| reading|information_search|single-information-retrieval|notice | 65 | 7/23/35 | GR-A1-RE-01, GR-A1-RE-10, GR2-A1-RE-08, A1-CB001-RE-05 |
| reading|content_comprehension|single-information-retrieval|message | 65 | 5/40/20 | GR-A1-RE-04, GR2-A1-RE-04, GR2-A1-RE-10, A1-CB001-RE-04 |
| listening|announcement_instruction|single-step-comprehension|dialogue | 48 | 1/4/43 | A1-CB005-LI-03, A1-CB008-LI-03, A1-CB009-LI-02, A1-CB009-LI-05 |
| listening|shop_public|single-step-comprehension|announcement | 19 | 1/7/11 | GR-A1-LI-06, GR2-A1-LI-09, A1-CB002-LI-02, A1-CB002-LI-03 |
| reading|content_comprehension|single-information-retrieval|schedule | 19 | 0/10/9 | A1-CB005-RE-03, A1-CB006-RE-02, A1-CB010-RE-02, A1-CB011-RE-05 |
| reading|information_search|single-information-retrieval|schedule | 18 | 12/6/0 | GR-A1-RE-02, GR-A1-RE-03, GR-A1-RE-06, GR-A1-RE-07 |
| listening|conversation|single-step-comprehension|announcement | 5 | 0/2/3 | GR-A1-LI-07, A1-CB004-LI-05, A1-CB008-LI-01, A1-CB028-LI-05 |
| script_vocabulary|kanji_meaning_usage|direct-recognition|isolated-term | 5 | 0/1/4 | A1-CB002-SV-05, A1-CB003-SV-05, A1-CB004-SV-05, A1-CB005-SV-03 |
| script_vocabulary|word_usage|direct-recognition|isolated-term | 2 | 0/0/2 | A1-CB005-SV-01, A1-CB054-SV-04 |

The dominant families reuse the same stem, reasoning, and distractor contracts while changing target terms, people, locations, or numbers. This is **GENERATOR TEMPLATE COLLAPSE**; no repair is made in this audit.

## QA2 and QA6

### QA2 outcomes

| Outcome | Count |
|---|---:|
| ANSWER_KEY_MISMATCH | 19 |
| HIDDEN_CONTEXT_REQUIRED | 1 |
| MULTIPLE_DEFENSIBLE_ANSWERS | 258 |
| NO_DEFENSIBLE_ANSWER | 616 |
| ORACLE_MATCH | 426 |

### QA2 by section

| Section / outcome | Count |
|---|---:|
| conversation_expression / NO_DEFENSIBLE_ANSWER | 303 |
| script_vocabulary / NO_DEFENSIBLE_ANSWER | 277 |
| listening / ORACLE_MATCH | 219 |
| reading / ORACLE_MATCH | 191 |
| reading / MULTIPLE_DEFENSIBLE_ANSWERS | 117 |
| listening / MULTIPLE_DEFENSIBLE_ANSWERS | 93 |
| script_vocabulary / MULTIPLE_DEFENSIBLE_ANSWERS | 44 |
| listening / NO_DEFENSIBLE_ANSWER | 18 |
| reading / NO_DEFENSIBLE_ANSWER | 18 |
| conversation_expression / ORACLE_MATCH | 12 |
| conversation_expression / ANSWER_KEY_MISMATCH | 11 |
| script_vocabulary / ANSWER_KEY_MISMATCH | 5 |
| conversation_expression / MULTIPLE_DEFENSIBLE_ANSWERS | 4 |
| script_vocabulary / ORACLE_MATCH | 4 |
| reading / ANSWER_KEY_MISMATCH | 3 |
| reading / HIDDEN_CONTEXT_REQUIRED | 1 |

### QA2 by category

| Category / outcome | Count |
|---|---:|
| expression / NO_DEFENSIBLE_ANSWER | 152 |
| grammar / NO_DEFENSIBLE_ANSWER | 151 |
| content_comprehension / ORACLE_MATCH | 102 |
| information_search / ORACLE_MATCH | 89 |
| shop_public / ORACLE_MATCH | 80 |
| kanji_reading / NO_DEFENSIBLE_ANSWER | 78 |
| word_usage / NO_DEFENSIBLE_ANSWER | 78 |
| information_search / MULTIPLE_DEFENSIBLE_ANSWERS | 72 |
| conversation / ORACLE_MATCH | 71 |
| announcement_instruction / ORACLE_MATCH | 68 |
| kanji_meaning_usage / NO_DEFENSIBLE_ANSWER | 66 |
| word_meaning / NO_DEFENSIBLE_ANSWER | 55 |
| content_comprehension / MULTIPLE_DEFENSIBLE_ANSWERS | 45 |
| announcement_instruction / MULTIPLE_DEFENSIBLE_ANSWERS | 37 |
| conversation / MULTIPLE_DEFENSIBLE_ANSWERS | 30 |
| shop_public / MULTIPLE_DEFENSIBLE_ANSWERS | 26 |
| kanji_reading / MULTIPLE_DEFENSIBLE_ANSWERS | 23 |
| word_meaning / MULTIPLE_DEFENSIBLE_ANSWERS | 17 |
| content_comprehension / NO_DEFENSIBLE_ANSWER | 10 |
| announcement_instruction / NO_DEFENSIBLE_ANSWER | 9 |
| expression / ANSWER_KEY_MISMATCH | 8 |
| information_search / NO_DEFENSIBLE_ANSWER | 8 |
| grammar / ORACLE_MATCH | 7 |
| conversation / NO_DEFENSIBLE_ANSWER | 5 |
| expression / ORACLE_MATCH | 5 |
| expression / MULTIPLE_DEFENSIBLE_ANSWERS | 4 |
| kanji_meaning_usage / ANSWER_KEY_MISMATCH | 4 |
| kanji_meaning_usage / MULTIPLE_DEFENSIBLE_ANSWERS | 4 |
| shop_public / NO_DEFENSIBLE_ANSWER | 4 |
| content_comprehension / ANSWER_KEY_MISMATCH | 3 |

### QA6 level match

| Signal | Count |
|---|---:|
| MATCH | 1072 |
| SLIGHTLY_HARDER | 247 |
| TOO_HARD | 1 |

### QA6 by section

| Section / signal | Count |
|---|---:|
| script_vocabulary / MATCH | 327 |
| conversation_expression / MATCH | 314 |
| listening / MATCH | 227 |
| reading / MATCH | 204 |
| reading / SLIGHTLY_HARDER | 126 |
| listening / SLIGHTLY_HARDER | 102 |
| conversation_expression / SLIGHTLY_HARDER | 16 |
| script_vocabulary / SLIGHTLY_HARDER | 3 |
| listening / TOO_HARD | 1 |

Full template and batch breakdowns are preserved in `data/qa/controlled-a1-qa-gate-integrity-summary.json`.

## Cross-gate matrix

The full 1,320-row matrix is `data/qa/controlled-a1-1320-cross-gate-matrix.csv`.

- Persisted all-gate PASS: **0/1,320**
- Diagnostic `contentEligibleIgnoringInfrastructureFailures`: **0/1,320**

This diagnostic is never used for approval or publishing. It removes only identified evidence/infrastructure blockers; QA2, QA3, real QA5 construct issues, real QA6 level issues, and QA7 originality remain enforced.

## Real generator problems

- 894 QA2 hard failures are substantive answer-design defects.
- 827 QA7 failures and 446 reviews indicate severe repetition/template collapse.
- 831 QA5 category mismatches and 370 section mismatches show the generated learner task often does not realize its Blueprint.
- 543 QA6 non-PASS results indicate A1 load inconsistency.

## QA infrastructure problems

- QA1 89-point ceiling made PASS impossible; fixed without lowering threshold.
- QA4 approved KnowledgeUnit/SourceChunk provenance is absent from frozen artifacts; the V1 rerun's synthesized evidence was invalid.
- QA4 local mock always returns LOW confidence and cannot certify release.
- QA5 has no first-class semantic taskType in Blueprint and the local classifier is explicitly a bounded development provider.
- 330 Listening items have semantic scripts/audio files, but QA6 has no acoustic evidence input.

## 40-item control rerun

The exact control contains 10 items per section. Format below is PASS/REVIEW/FAIL.

| Gate | Before | After integrity fixes |
|---|---:|---:|
| QA1 | 0/8/32 | 1/28/11 |
| QA2 | 9/0/31 | 9/0/31 |
| QA3 | 40/0/0 | 40/0/0 |
| QA4 | 0/40/0 | 0/40/0 |
| QA5 | 0/20/20 | 0/20/20 |
| QA6 | 21/19/0 | 21/19/0 |
| QA7 | 2/15/23 | 2/15/23 |

QA1 now has a reachable PASS and genuine failures remain. QA2, QA3, QA5, QA6, and QA7 are unchanged. QA4 now reports the real missing evidence instead of using synthetic approval/provenance.

## Final 1320 rerun

**Not run.** The control correctly exposed that approved KnowledgeUnit and SourceChunk evidence is still unavailable. The task requires evidence/contract failures to disappear before a full rerun; rerunning 1,320 now would only reproduce a known QA4 infrastructure REVIEW. Historical V1 evidence remains untouched.

## Decision

# BOTH

The QA pipeline had confirmed integrity defects, and the generator corpus also contains major independent answer, alignment, difficulty, and originality failures. Generation must remain frozen. Before another full rerun, persist/retrieve real APPROVED KnowledgeUnits and SourceChunks and configure independently certifying QA4/QA5 providers; do not weaken any gate.
