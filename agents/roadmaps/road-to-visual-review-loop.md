# Roadmap: Visual Review Loop + A11y

> **Status: stub — not started.** Anchored on the dashboard so the product arc is visible. Do not pull steps from here until R3 is merged. Content is deliberately thin until the build of R3 surfaces what shape this needs.

## Mission

Add objective, machine-checkable polish to the UI track. R3's polish loop terminates after 2 rounds based on subjective findings; R4 introduces **visual preview** (headless-browser screenshots) and **accessibility tooling** (axe-core, pa11y) as the only objective signals in the engine, and **rewrites part of R3's polish-termination contract** so that no run ships with unresolved a11y violations regardless of the round counter.

A11y is the lever, not the screenshot. Code-review and visual-review are subjective; axe/pa11y findings are not. R4's identity is *"objective polish anchoring"*, not *"prettier UI"*.

## Prerequisites

- [ ] **Roadmap 3 (`road-to-product-ui-track.md`) merged** — this roadmap modifies R3's polish contract; doing it before R3 is wrong-order
- [ ] R1, R2 goldens green
- [ ] UI-track goldens (GT-U1..GT-U12) green

## Context

After R3, the UI track produces components that match a design brief and respect existing tokens, but the polish loop's termination is a hard 2-round ceiling — it stops because we ran out of rounds, not because the UI is objectively done. Lovable solves this with screenshots + iteration; we want something stronger and more disciplined: **objective findings drive the loop, not subjective rounds**.

R4's two pillars:

- **Visual preview** — headless-browser render of the changed component(s), screenshot capture, baseline diff. Not pixel-perfect regression; presence + sanity check that nothing renders broken.
- **A11y tooling** — axe-core or pa11y wired into `directives/ui/review.py` and `polish.py`. Findings become first-class polish targets with automatic refactor (missing aria, contrast violations, keyboard-trap detection).

- **Feature:** objective polish anchoring for the UI track
- **Jira:** none
- **Depends on:** R3

## Non-goals

- **No** pixel-perfect visual-regression testing (deferred indefinitely per R3)
- **No** screenshot-to-code, Figma import (deferred indefinitely per R3)
- **No** UI-quality scoring / dashboard
- **No** removal of R3's 2-round ceiling — the ceiling stays as a *time* limit; a11y findings add a separate *correctness* limit that overrides termination

## Phase 0: Stub — build trigger and contract

> Single placeholder phase so this roadmap appears on the dashboard arc. Expand into full phase breakdown only when R3 merges.

- [ ] **Build trigger:** R3 (`road-to-product-ui-track.md`) is merged AND a11y tooling decision (axe-core via Playwright vs. pa11y) is locked in `Open decisions` below. Do not start before both hold.

## Acceptance preview (authoritative shape, not full list)

- [ ] Polish loop terminates ONLY when both conditions hold: (a) ≤ 2 rounds run AND (b) a11y findings list is empty (zero unresolved axe/pa11y violations of severity ≥ moderate). If a11y findings remain after round 2, engine halts to user with the findings — does not silently ship.
- [ ] Headless-browser render is captured as a delivery-report artifact for every UI run (screenshot + DOM dump); failure to render is a hard error, not a warning.
- [ ] A11y findings are surfaced in the design-brief review halt (Phase 2/3 of R3) — user sees and accepts known violations explicitly when they cannot be auto-fixed.

## R3 contract amendments (referenced from R4 build, not edited until then)

This roadmap will, on build, rewrite the following R3 acceptance items:

- "Polish loop has 2-round ceiling; engine halts to user if findings remain after round 2" → "Polish loop terminates after 2 rounds OR when zero unresolved a11y findings remain, whichever is *later*; round 2 with remaining findings is a halt, not a ship"
- "Microcopy in shipped components matches the design-brief verbatim" → unchanged, but adds a11y-audit pass on microcopy (alt-text, aria-label content)

The R3 polish-loop tests (GT-U4) will gain an a11y-finding fixture variant.

## Open decisions (deferred to build-start)

- **Tooling choice** — axe-core (browser-based) vs. pa11y (CLI) vs. both. Lean: axe-core via Playwright; pa11y as fallback for non-React stacks if axe-core proves heavy
- **Severity threshold** — block on `moderate+` (default) vs. `serious+` only. Lean: `moderate+`; the entire point is objective discipline
- **Render target** — Playwright (default, already required by E2E skill) vs. Puppeteer vs. native browser. Lean: Playwright

## Risks (sketch only, sharpened on build)

- **A11y tooling produces noise on existing components** — audit-time baselining: only NEW or CHANGED components in the diff are subject to the gate; pre-existing violations are tracked separately as tech-debt
- **Headless render is slow** — only run on `directive_set="ui"` AND when changed files include component templates; trivial-path runs skip it
- **R3 contract drift while R4 is dormant** — R3 acceptance criteria reference this roadmap by path; CI cross-ref check enforces the pointer stays valid

## Future-track recipe (deferred indefinitely)

- Visual-regression baselining with pixel diffs
- Screenshot-to-code generation
- Figma import / design-system sync
- UI-quality numeric scoring

## Notes for the builder

This stub exists to anchor the dashboard arc and lock the *identity* of R4 (objective polish anchoring via a11y, not subjective screenshot review). The actual phase breakdown lands at build-start. Do not expand this file until R3 ships — premature expansion is the failure mode this stub explicitly guards against.
