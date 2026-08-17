# UI Rebuild Audit

Date: 2026-08-17

## Route inventory

- Public: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`.
- Candidate: `/candidate`, `/candidate/profile`, `/candidate/history/:id`, `/exam`, `/result`.
- Admin: `/admin`, `/admin/sources`, `/admin/factory`, `/admin/questions`, `/admin/content-production`, `/admin/exams`, `/admin/attempts`, `/admin/candidates`, `/admin/system`.

There are no separate `/exams`, `/history`, `/admin/knowledge`, `/admin/exam-sets`, `/admin/qa`, or `/admin/analytics` routes. Existing backend contracts expose only the current published exam, candidate sessions/results, source detail, factory jobs, Question Bank, content-production summary, exam draft/version, attempts, candidates, and system status. The rebuild will improve current routes without inventing unsupported data.

## Existing shells and reusable behavior

- `AuthGate` correctly protects candidate/admin routes and must remain unchanged.
- `UserMenu` provides account/logout behavior but is visually coupled to dark headers/sidebar.
- Candidate pages independently repeat the same top bar instead of using a candidate shell.
- Admin uses a sticky sidebar in `AdminNav`, but all links are flat and the tablet layout turns it into an overflowing row.
- `ExamClient` correctly preserves autosave, server timeout, frozen exam behavior, section transitions, and Listening no-back rules.
- Admin clients already use accessible form controls and repository-backed APIs; their presentation is mostly class-based and reusable.

## Styling audit

- All styling is accumulated in one large `app/globals.css` file with historical V3–V5 sections, duplicated values, one-off selectors, and no normalized spacing/type/radius/focus/motion tokens.
- Generic classes (`card`, `primary`, `secondary`, `metric`, `notice`, `empty`) are useful foundations but lack consistent variants, disabled states, focus rings, skeletons, dialog semantics, and responsive rules.
- Candidate and Admin reuse the same density/card styling, causing Candidate to feel like an admin prototype.
- Japanese font fallback starts with Arial; Japanese should prefer a Japanese-capable system/Noto stack.
- Many strings are mojibake (for example Vietnamese and Japanese rendered as `Ä...`/`ã...`), which is a production-blocking readability issue.
- Several buttons are nested inside links, which is invalid interactive markup.
- Inline styles appear in Result and question previews.

## Public and authentication

- Homepage is a single prototype card with version/QA terminology and Admin CTA presented as prominently as learner practice.
- It does not explain levels, sections, benefits, or the unofficial-product disclaimer clearly.
- Auth forms are structurally simple but expose implementation terms such as server role checks and `AUTH_DISABLED` in the main learner experience.
- Password visibility controls, deliberate loading skeletons, and field-level help are missing.

## Candidate application

- Dashboard answers basic start/resume/history questions but exposes “Candidate Portal V5.1.2”, “server scored”, “latest published version”, sessions, and other technical wording.
- It has no coherent Candidate navigation, level presentation, recommendations, or learner-friendly empty states.
- History has no filters and uses admin panel styling.
- Attempt detail safely avoids active answer leakage but exposes session terminology and has no loading skeleton.
- Profile exposes role and account implementation details unnecessarily.

## CBT exam environment

- Core rules are correct and must be preserved.
- Instructions expose architecture and answer-protection implementation rather than learner instructions.
- Loading/error/timeout copy is technical and mojibake-damaged.
- Listening replay count is not surfaced; the product rule allows up to two plays but current UI does not enforce/count it client-side.
- Question palette is hidden on mobile rather than presented safely; no compact progress substitute exists.
- Focus states and screen-reader status for autosave/audio are insufficient.
- Section exit happens immediately on Next; no confirmation is shown even though returning is forbidden.
- Very small screens have no CBT suitability notice.

## Result, history, and profile

- Result emphasizes a raw percentage without explicitly labeling it “Practice Score”.
- It exposes frozen ExamVersion/server implementation language.
- No deliberate next-action cards or unofficial-calibration wording.
- Loading and error states are plain text cards.

## Admin console

- Navigation is flat; Content, Production, Quality, Users, and System hierarchy is absent.
- Dashboard imports static seed data and sample attempts, producing demo metrics instead of live operational data. This must be removed or clearly replaced by repository-backed views.
- Source Library combines import, source list, source detail, knowledge review, planning, and generation in one dense screen with minimal hierarchy.
- KnowledgeUnits omit visible vocabulary/kanji/grammar/expression detail and only offer Approve.
- Factory candidate cards expose provider/model metadata directly instead of an audit disclosure.
- Question Bank has search/basic filters but no pagination, level/category/topic/source/QA filters; “New question” creates demo content directly, which is inappropriate for production.
- Content Production is functional but visually minimal; readiness and deficits need clearer progress/status hierarchy.
- Exam Builder reveals internal Exam ID prominently and only discovers some insufficiency through pool counts; it lacks a consolidated readiness summary.
- System page necessarily contains technical data but needs separation from learner-facing UI.

## Loading, empty, error, and feedback states

- Most pages display literal “Loading…” and allow layout shift; no Skeleton primitive exists.
- Empty states are muted paragraphs without action/context.
- API errors are rendered verbatim, potentially exposing technical details to Candidate.
- Feedback uses scattered alert blocks; no normalized live-region/toast component.
- Admin can retain expandable technical details, but Candidate messages need translation into safe, actionable language.

## Responsive and accessibility risks

- Public/candidate pages are broadly responsive but not composed around reusable shells.
- Admin tablet navigation overflows horizontally and loses grouping.
- Tables depend on horizontal scrolling without compact/mobile alternatives.
- Drawer lacks dialog role, focus management, Escape handling, and labelled title.
- Visible keyboard focus is not consistently defined.
- Status relies heavily on badge color; text is present in most places, but palette legend and progress need stronger non-color cues.
- Reduced-motion behavior is undefined.

## Implementation direction

1. Normalize design tokens and primitives without adding a UI dependency.
2. Introduce PublicHeader, CandidateShell, Admin grouped navigation, PageHeader, Card, Alert, Badge, EmptyState, Skeleton, Progress, and StatCard primitives.
3. Rebuild Public/Auth, then Candidate/CBT, then Admin screens while preserving API calls and E2E-accessible names where practical.
4. Fix all mojibake in user-visible strings.
5. Use only real API data; remove seed/demo metrics and direct “add demo question” behavior from production UI.
6. Update E2E selectors only where accessible wording intentionally changes.
