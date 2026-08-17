# UI Rebuild Report

Date: 2026-08-17

## Routes rebuilt

| Experience | Routes | Desktop | Tablet | Mobile | Loading | Empty | Error | Auth |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public | `/` | PASS | PASS | PASS | Static | N/A | N/A | Public |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password` | PASS | PASS | PASS | Button state | N/A | Safe alert | Public/redirect-safe |
| Candidate | `/candidate` | PASS | PASS | PASS | Skeleton | Actionable | Safe alert | Candidate |
| CBT | `/exam` | PASS | PASS | Advisory layout | Skeleton | Published-exam state | Safe retry | Candidate |
| Result | `/result` | PASS | PASS | PASS | Skeleton | N/A | Safe alert | Candidate |
| History | `/candidate/history/:id` | PASS | PASS | PASS | Skeleton | N/A | Safe alert | Candidate |
| Profile | `/candidate/profile` | PASS | PASS | PASS | Skeleton | N/A | Safe alert | Candidate |
| Admin shell | `/admin/**` | PASS | Usable grouped rail | Scrollable grouped nav | Per-client | Existing states | Admin detail allowed | Admin |
| Admin dashboard | `/admin` | PASS | PASS | Usable | Skeleton | Live zero values | Safe alert | Admin |
| Question Bank | `/admin/questions` | PASS | Scrollable table | Scrollable table | Skeleton | Actionable | Safe alert | Admin |
| Factory | `/admin/factory` | PASS | Stacked | Stacked | Existing busy state | Existing state | Existing detail | Admin |

Source Library, Content Production, Exam Builder, Attempts, Candidates and System retain their API behavior and screen composition, but inherit the rebuilt Admin shell, tokens, focus states, spacing, status colors and responsive rules.

## Design system introduced

- Centralized semantic tokens for brand, neutral surfaces, status colors, spacing, radius, shadows and content width.
- Japanese-first typography stack supporting kana, kanji, Vietnamese, English and numbers.
- `PageHeader`, `Card`, `Alert`, `Badge`, `EmptyState`, `Skeleton`, `Progress`, and `StatCard` primitives.
- Public, Candidate, dedicated CBT and grouped Admin shells.
- Visible focus rings, disabled states, reduced-motion behavior and screen-reader-only utility.

## Candidate experience

- Homepage now explains audience, A1/A2.1/A2.2 practice levels, four sections and unofficial status.
- Auth pages remove backend terminology, add safe errors, loading states, autocomplete and password visibility.
- Dashboard prioritizes resume/start, real attempts, real scores, available practice and next action. No fake analytics were added.
- History, attempt detail and profile use learner language and hide roles, session internals, provider names and IDs from primary UI.
- Result is explicitly labeled `Practice Score` and states that it is not an official JFT score or calibrated level.

## CBT environment

- Dedicated navigation-free exam mode with readable Japanese, section/progress/timer hierarchy and desktop/tablet focus.
- Small-mobile advisory explains that computer/tablet gives the closest CBT experience.
- Autosave status is learner-friendly and announced through a status region.
- Section-exit confirmation prevents accidental irreversible navigation.
- Listening enforces and displays the two-play limit without showing the script or raw URL.
- Palette preserves same-section navigation and disables forbidden Listening back navigation.
- Timeout, connectivity and submission states avoid technical exceptions.
- A bootstrap race found by browser E2E under React Strict Mode was fixed without changing session rules.

## Admin experience

- Sidebar is grouped into Overview, Content, Production, Quality, Users and System.
- Dashboard no longer renders seed/sample metrics; it reads current Question Bank, attempts, candidates, sources and production readiness from existing APIs.
- Question Bank no longer creates demo questions from a production action. It provides search plus level/section/status filters, keyboard-openable rows, accessible detail dialog semantics and controlled review actions.
- Factory provider/model/prompt metadata moved from primary presentation into an audit disclosure.
- Existing Source, production, exam, QA-adjacent and user operations remain intact.

## Legacy UI removed or superseded

- Prototype homepage and version/QA-heavy learner copy.
- Repeated Candidate top bars.
- Developer-oriented CBT instructions and result copy.
- Static seed metrics on Admin dashboard.
- Direct “New question” demo insertion from Question Bank.
- Flat Admin navigation.

## Regression QA

- TypeScript: PASS.
- Unit/integrity tests: 37/37 PASS across 12 files.
- Production build: PASS; 41 routes/pages generated.
- Browser E2E: 4/4 PASS. Candidate login → start → autosave → resume → Listening restrictions → submit → result; Admin login → Factory/TTS/approval → Exam publish; Source → Knowledge → Plan → Factory Review.

## Known UX debt

- Backend currently exposes only the latest published exam, so a multi-exam catalog with level/status filters cannot be truthful yet.
- There are no dedicated Knowledge Units, Exam Sets, QA Dashboard or Analytics routes/API summaries. The navigation does not advertise unsupported screens.
- Source KnowledgeUnit reject/edit actions require explicit backend contracts; only safe existing approval behavior is presented.
- Attempt API does not expose submitted answer review, so active answer protection remains intact and per-question post-submit review is not fabricated.
- Admin table pagination remains client-side debt for a large production bank.
- A full localization message catalog was intentionally not introduced.

## Human visual review required

- Long Japanese prompts and choices at 200% zoom.
- Real iOS Safari audio playback and two-play behavior.
- Admin Source/Factory pages with large production batches.
- Question Bank with thousands of rows.
- Tablet landscape CBT and small-phone advisory layout.
- Windows/macOS font rendering where Noto Sans JP is not installed.
