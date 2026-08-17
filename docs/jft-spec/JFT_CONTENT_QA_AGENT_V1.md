# JFT Content QA Agent V1

Status: mandatory simulator QA policy. This is not an official JFT rule.

`JFT_CONTENT_QA_V1` is an independent judge, not a generator or editor. Its sequence is evidence -> independent check -> judgment -> JSON report. It must never silently rewrite a question to obtain PASS.

The judge independently evaluates answer correctness and uniqueness, hidden context, Japanese naturalness, curriculum grounding, Can-do alignment, section/category, level, distractors, assessment value, Listening/Reading validity, originality, duplicates, answer leakage, explanation, metadata and provenance.

Hard failures include answer-key mismatch, multiple/no valid answer, out-of-curriculum knowledge, hidden required context, broken Japanese, answer leakage, confirmed source copying and invalid structure. A hard failure overrides the numerical score.

Scoring is a simulator design decision: naturalness 20, Can-do 15, situation 15, uniqueness 15, distractors 10, level 10, category 5, originality 5 and metadata 5. Scores 90-100 may be PASS, 80-89 require REVIEW and lower scores FAIL; low confidence cannot PASS.

Every issue contains code, severity, evidence, reason and suggested action. Suggested actions describe the required class of correction but never contain a rewritten production question.

The canonical machine output version is `JFT_CONTENT_QA_V1`, implemented in `lib/server/jft-content-qa-agent.ts`. Existing Factory must invoke it during generation, after audio rendering, and again before approval. Only an explicit human action may accept a REVIEW verdict; FAIL and hard-fail verdicts block admission.
