# Content QA standard

## SIMULATOR DESIGN DECISION

The 100-point model weights naturalness 20, Can-do 15, realism 15, answer uniqueness 15, distractors 10, level 10, category 5, originality 5, and metadata 5. Suggested gate: 90 pass, 80–89 human review, below 80 fail.

Hard failures override score: wrong/multiple answers, broken Japanese, outside-curriculum required knowledge, source copying, missing listening audio, category mismatch, hidden context, corrupted metadata, or invalid provenance. AI never approves directly into production.
