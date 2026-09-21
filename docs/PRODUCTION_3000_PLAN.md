# Production 3000 Completion Plan

Date: 2026-09-21
Branch: `fix/factory-question-quality-20260921`

## Goal

Ship a production-oriented JFT practice site with:
- 3,000 structurally valid, internally controlled practice questions.
- A reproducible 1,000-question pool for each internal level (A1 / A2.1 / A2.2).
- Four CBT sections with durable Listening assets.
- A learner-facing UI that feels like a finished product rather than an engineering demo.
- Fail-closed production configuration for AI/TTS authoring paths.
- A green typecheck, unit-test, build and Playwright release gate.

This remains an unofficial practice simulator and must not claim official JFT calibration or affiliation.

## Delivery strategy

### P0 — Content reset and 3,000-bank invariant
1. Replace the weak template generator for Script/Vocabulary, Conversation/Expression and Reading.
2. Preserve existing Listening IDs/audio paths so already-generated audio assets remain aligned.
3. Add 900 new non-Listening items without changing legacy Listening IDs.
4. Make the complete controlled bank exactly 3,000 questions:
   - A1: 1,000
   - A2.1: 1,000
   - A2.2: 1,000
5. Add deterministic bank QA: IDs, structure, answer distribution, canonical tags, duplicates and audio requirements.
6. Version the production import as JFT-3000-V2.

Acceptance:
- exactly 3,000 unique IDs;
- no exact duplicate learner-visible item;
- all four answer positions represented;
- every generated item has category/topic/Can-do/lesson/difficulty metadata;
- every Listening item has a durable local audio path;
- CI content tests pass.

### P1 — Factory quality hardening
1. Factory V2 prompt with section/category-specific authoring rules.
2. Require category and Can-do in factory requests.
3. Validate category against section taxonomy before generation.
4. Persist canonical metadata tags on generated candidates.
5. Prevent mock AI/TTS authoring providers from silently acting as production providers.
6. Remove deterministic QA false positives caused by crude category/level inference.

Acceptance:
- invalid brief is rejected before provider call;
- generated candidates cannot omit the assessment target;
- mock providers are clearly development-only;
- QA does not reject an item merely because text length differs from a level heuristic.

### P2 — Exam catalogue
1. Seed production-like 48-question practice forms for A1, A2.1 and A2.2.
2. Each form uses 12 items per section and 60 minutes.
3. Published snapshots remain immutable.
4. Candidate dashboard exposes all available levels.

Acceptance:
- three level-specific practice exams can be generated from the controlled bank;
- no pool-shortage errors;
- all Listening selections reference playable assets.

### P3 — Learner UI
1. Refresh public landing page with clear product value, level choices and content scale.
2. Improve candidate catalogue, status hierarchy, mobile behavior and CBT progress.
3. Keep result explanations and answer review after submission only.
4. Remove unnecessary prototype/version language from learner-facing pages.

Acceptance:
- mobile and desktop layouts remain usable;
- main journey is obvious: Home -> Account -> Choose level -> CBT -> Result -> Review;
- unofficial-practice disclaimer remains visible but unobtrusive.

### P4 — Production runtime safety
1. Expose a machine-readable production readiness result.
2. Production auth never falls back to development identities.
3. Production Factory/TTS never silently falls back to mock providers.
4. Add provider timeout boundaries where external HTTP calls are used.
5. Keep secrets server-side.

Acceptance:
- runtime identifies missing Supabase / provider configuration;
- admin system screen shows READY / NOT READY and blockers;
- no public role switch exists in production.

### P5 — Release
1. Open PR from this branch.
2. Run GitHub Actions: typecheck -> unit -> build -> Playwright.
3. Fix failures until green.
4. Merge only after the release gate is green.

## Definition of done

Code-side work is complete when:
- the controlled repository bank is exactly 3,000;
- all production-bank invariants and existing tests pass;
- the three CBT level forms are available in the memory/demo repository;
- Factory V2 is fail-closed and metadata-complete;
- learner UI is production-oriented;
- GitHub Actions is green.

External deployment configuration (Supabase credentials, production admin account, Azure/OpenAI/TTS keys and Vercel environment values) is infrastructure state, not source code. The application must surface those as blockers instead of pretending to be production-ready.
