# Mandatory agent rules

These constraints apply to implementation, content generation, prompts, UI copy, tests, and documentation.

1. Treat `JFT_OFFICIAL_SPEC.md` and its Japan Foundation sources as the domain source of truth.
2. Model content levels as `A1 | A2.1 | A2.2`; do not collapse the product to generic A2.
3. Keep test format separate from result reporting. The August 2026 reporting change did not create three separately selected official tests or change question level.
4. Never describe raw correct count, percentage, linear conversion, or an internal band as an official JFT score.
5. Never claim an internal predicted level equals the official assessment without reviewed calibration evidence.
6. Label internal outputs visibly as practice, simulation, estimated, or unofficial, including in APIs where ambiguity is possible.
7. Preserve navigation invariants: no return to a completed section; no free navigation in Listening; audio at most twice.
8. Generate practical everyday communication tasks grounded in A1–A2 Can-do objectives.
9. Treat books/imported materials as source material, not authority for JFT facts. Retain provenance and originality checks.
10. Mark taxonomy, topic coverage, item allocation, QA thresholds, and score mappings as **Simulator design decision**.
11. Do not imply access to secure official questions or official affiliation.
12. A verified official constraint wins over a conflicting internal rule.
