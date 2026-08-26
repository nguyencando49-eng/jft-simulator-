# UI-01 Public/Auth Report

## Changed
- `app/page.tsx` — public landing with sticky header, hero (eyebrow "JFT-BASIC PRACTICE", H1 "Thi thử JFT theo trải nghiệm CBT", primary/secondary CTA, trust line), static CBT product preview, value section (4 features), levels section (A1/A2.1/A2.2), how-it-works (3 steps), final CTA, footer with disclaimer.
- `components/auth/AuthShell.tsx` — two-column auth shell (dark brand intro panel + form panel), mobile brand fallback, trust line.
- `components/auth/LoginClient.tsx` — product-specific login presentation, password visibility toggle, dev-mode role select, error mapping.
- `components/account/RegisterClient.tsx` — product-specific register presentation, verification success state, error mapping.
- `components/account/ForgotPasswordClient.tsx` — forgot-password flow with success state, error mapping.
- `components/account/ResetPasswordClient.tsx` — reset-password flow with success state, error mapping.
- `components/auth/auth-errors.ts` — Vietnamese error mapping (invalid credentials, account exists, weak password, network, unexpected).
- `app/rebuild.css` — UI-01 design system: brand teal-green tokens (`--brand-600:#11655d`), public landing styles, auth shell styles, responsive breakpoints (980/760/480), focus-visible, reduced-motion.
- `app/layout.tsx` — loads `globals.css` + `rebuild.css`, `lang="vi"`.

## Reused
- `components/ui` primitives (Alert, Card, Badge, Skeleton, Progress, StatCard) — no new dependencies.
- Existing auth architecture, API client, session behavior — presentation-only changes.
- Existing CSS organization in `app/rebuild.css` — extended, not duplicated.

## Responsive
- 375: PASS
- 390: PASS
- 430: PASS
- 768: PASS
- 1440: PASS

## Tests
- typecheck: PASS (`tsc --noEmit`, no errors)
- unit: PASS (36 files, 236 tests)
- build: PASS (45 routes, `/`, `/login`, `/register`, `/forgot-password`, `/reset-password` all compiled)
- e2e: not run (no public/auth E2E spec in repo; `e2e/jft-factory.e2e.spec.ts` is content-factory scope)

## Remaining
- None for this scope. No fake data, no internal system terms exposed, no new dependencies, no product logic changes.

## Next
Candidate Dashboard V2