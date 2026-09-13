---
stability: beta
keep-beta-until: 2026-11-24
keep-beta-reason: >-
  Beta review 2026-09-05. It is the anchor of its pair, not the dependant, and
  the four criteria are met — but the contract describes a three-stage rollout
  whose third stage has demonstrably not landed: no verification gate is
  default-on anywhere, and `design-review-after-ui-write` declares itself
  `instruction-only` with a self-reported verdict. Promoting a rollout plan with
  an open final stage would freeze that stage as authoritative. Anchor:
  `lapsed-beta-baseline.json` `clear_by: 2026-11-23`, restated in STABILITY.md as
  "not a soft target: if the list is not empty by then, the 90-day cadence itself
  is reassessed"; 2026-11-24 is the first date that reads that outcome. Disclosed
  weakness: this anchor is a fact about the review regime the contract sits in,
  not about its content — the file carries no dated clause of its own. Before the
  window ends: the stage-3 decision is recorded, default-on or struck.
---

# Design-Artifact Verification — Host-Capability & Degrade Contract

Phase 0 substrate for `road-to-design-artifact-fidelity`.
Design work is only production-grade if the agent **verifies the rendered
artifact** — but a verification step the host cannot run must degrade honestly,
never block the work or fake a green check.

This is the **design-verification** sibling of
[`host-capability-manifest`](../../src/agent-src/contexts/execution/host-capability-manifest.md)
(which covers *subagent* primitives). Same philosophy: resolve once per session,
**unknown host assumes nothing**, a missing capability degrades to "prove or
caveat" rather than a hard block.

## Iron Law — prove or caveat, never fake

```
A DESIGN ARTIFACT IS "VERIFIED" ONLY BY A CHECK THE HOST ACTUALLY RAN.
A CAPABILITY THE HOST LACKS DEGRADES TO AN HONEST CAVEAT — NEVER A
FABRICATED "LOOKS GOOD", NEVER A HARD BLOCK ON ALL DESIGN WORK.
UNKNOWN HOST → ASSUME STATIC-INSPECTION ONLY.
```

## Verification primitives

Each design-verification gate needs one of these host primitives:

| Primitive | What it proves | Typical mechanism |
|---|---|---|
| `local_browser` | The artifact opens + paints in a real engine | launch a browser on a local URL/file |
| `playwright` | Automated open + interact + assert, headless | Playwright / Puppeteer runner |
| `screenshot` | Captured pixels for visual diff / review | Playwright `screenshot`, OS capture |
| `console_inspect` | No runtime JS errors / warnings on load | devtools / Playwright console API |
| `canvas_pixel` | Canvas/WebGL actually drew (not blank) | pixel read-back on a screenshot |
| `pdf_render` | A PDF paginates + renders without error | headless render / `pdftoppm` / lib |
| `deck_export` | A slide deck exports to the target format | deck tool export path |
| `doc_export` | A document exports (DOCX/MD/PDF) + re-reads | office/markdown export + readback |
| `image_decode` | An image decodes to real dimensions/format | image lib / the host's image reader |
| `computed_style` | A node's **resolved** style matches the intent — after the cascade, tokens and fallbacks, not as authored | read `getComputedStyle` in a live engine |
| `interaction` | A state the resting frame cannot contain — hover, focus, active, keyboard, a handler that fires | drive the state, then read the resolved style or the DOM effect |
| `viewport_matrix` | The layout property that is supposed to change at a breakpoint actually changes | resize, then read the resolved property at each declared width |
| `media_emulation` | A media-preference branch is honoured — `prefers-reduced-motion`, `prefers-color-scheme` | emulate the preference, then read the resolved style |
| `static_inspect` | Source/markup read without rendering | file read + parse (always available) |

**Why these four are separate primitives and not `screenshot` used harder.** A
screenshot proves what a frame looked like. Hover, focus, keyboard, a breakpoint
crossing and a media-preference branch are not properties of a frame — they are
properties of a *transition into a state*, and the resting capture that a review
actually takes contains none of them. The distinction is measurable rather than
theoretical: over
[`tests/design-artifacts/fixtures/ui-conformance/`](../../tests/design-artifacts/fixtures/ui-conformance/README.md),
two of four planted behavioural defects are invisible to any resting capture at
any viewport, and a pixel comparison additionally has no channel through which a
deviation can be *declared*, so it reports an approved change as a difference.
Both figures are pre-registered in that fixture's README.

All four resolve to `❌` wherever `playwright` does — they are that primitive's
dependants, never a second capability. A host that has `playwright` has these;
a host that does not cannot fake them from markup.

## Host-class capability table

Precise per-host support varies with what is installed (Playwright is a dev
dependency, not a guarantee). Resolve the **actual** row at session start; when
unsure, take the lower capability. Classes, not brand promises:

| Primitive | A · local-with-tooling<br>(Claude Code, Cursor, Windsurf, Augment, Cline, Zed on a dev machine) | B · cloud / sandboxed<br>(claude.ai web, Skills API) | C · CI / headless<br>(GitHub Actions, containers) |
|---|---|---|---|
| `local_browser` | ⚠️ if a browser is installed | ❌ | ❌ |
| `playwright` | ⚠️ if the Playwright dep is present | ❌ | ✅ (headless, deps installed) |
| `screenshot` | ⚠️ via Playwright / OS capture | ❌ | ✅ via Playwright |
| `console_inspect` | ⚠️ via Playwright | ❌ | ✅ via Playwright |
| `canvas_pixel` | ⚠️ via a screenshot read-back | ❌ | ✅ via screenshot read-back |
| `pdf_render` | ⚠️ if a renderer/lib is present | ❌ | ✅ if the lib is installed |
| `deck_export` | ⚠️ if the deck tool is present | ❌ | ⚠️ if the tool is installed |
| `doc_export` | ⚠️ if the office/md tool is present | ❌ | ⚠️ if the tool is installed |
| `image_decode` | ✅ (image lib / host image reader) | ⚠️ if the host renders images | ✅ (image lib) |
| `computed_style` | ⚠️ via Playwright | ❌ | ⚠️ only where the browser binaries are installed |
| `interaction` | ⚠️ via Playwright | ❌ | ⚠️ only where the browser binaries are installed |
| `viewport_matrix` | ⚠️ via Playwright | ❌ | ⚠️ only where the browser binaries are installed |
| `media_emulation` | ⚠️ via Playwright | ❌ | ⚠️ only where the browser binaries are installed |
| `static_inspect` | ✅ | ✅ | ✅ |

Legend: ✅ available · ⚠️ available **only if** the named dependency is present
(probe first, never assume) · ❌ not available → degrade.

**The four behavioural rows are `⚠️` in class C where `playwright` is `✅`, and
the difference is deliberate.** A CI runner having the Playwright *package* is
not the same fact as it having the *browser binaries*, and these four cannot
degrade to anything — there is no static reading of a hover transition. This
repository is its own worked example: `@playwright/test` is a devDependency, no
workflow runs `playwright install`, so every one of these four resolves `❌` in
this package's own CI and the probe that consumes them reports not-applicable
rows there rather than a clean pass. Read the row as a claim about binaries,
never about `package.json`.

**Resolution rule.** Before a design-verification gate runs, confirm the
primitive is actually present (e.g. `npx playwright --version`, a renderer on
`PATH`, the host's image reader). A `⚠️` that fails the probe resolves to `❌`
for that session — exactly the safe-default of the subagent manifest.

## Honest-degrade behavior

When the needed primitive is `❌` (or a `⚠️` probe fails):

1. **Do the work anyway** — never block design work because a check can't run.
2. **State the caveat explicitly** in the handoff: *"Not render-verified on this
   host (no `playwright`); static-inspected only — open `X` locally to confirm
   Y."* Name the specific unverified property, not a blanket disclaimer.
3. **Offer the fallback check** the host *can* run (static inspection of the
   markup, a structural assertion, an image-decode dimension check).
4. **Never emit a fabricated verification claim** ("renders correctly", "no
   console errors") for a check that did not run — that is an invented fact
   ([`direct-answers`](../../src/rules/direct-answers.md) Iron Law 2).

**The four behavioural primitives degrade by exactly these four steps — no
second vocabulary.** They are named here only because their failure mode has a
shape the earlier primitives do not: each one's honest degrade is a *missing
count*, and a missing count is easy to render as a zero.

- `computed_style` → *"Resolved styles not read on this host (no `playwright`
  binaries); the stylesheet was static-inspected, which cannot see the cascade,
  token resolution or a font fallback."*
- `interaction` → *"Hover, focus, active and keyboard states not exercised; a
  handler's presence in the source is not evidence that it fires."*
- `viewport_matrix` → *"Breakpoints not crossed; the media query was read, not
  applied."*
- `media_emulation` → *"`prefers-reduced-motion` / `prefers-color-scheme` not
  emulated; the block's presence says nothing about what it presents."*

```
A DIMENSION THAT DID NOT RUN HAS NO FINDING COUNT. IT REPORTS NOT-APPLICABLE
AND THE REASON. NEVER ZERO — A ZERO READS AS "RAN AND FOUND NOTHING", WHICH IS
THE FABRICATED GREEN THIS CONTRACT EXISTS TO PREVENT.
```

Machine-checked, not only asserted: the artefact these primitives feed carries
`findings: null` on a not-applicable row and a required non-empty `reason`, and
[`tests/scripts/ui_conformance_probe.test.ts`](../../tests/scripts/ui_conformance_probe.test.ts)
fails if a zero ever appears in that position.

## Verification checklist

Run before claiming a design artifact done. Each step is gated by the primitive
it needs — a step whose primitive is absent is **skipped with a caveat**, never
faked (§ Honest-degrade). "Looks good" is not a verification result.

1. **Open the artifact** (`local_browser` / `playwright` / `pdf_render` / `doc_export`) — it opens and paints; a static-only host inspects the source instead.
2. **Console / load errors** (`console_inspect`) — no runtime errors or failed loads on open.
3. **Desktop + mobile viewport** (`screenshot`) — inspect a desktop width and ~375px; no overflow / clipping.
4. **Text fit / no overlap** (`screenshot`, degrade `static_inspect`) — no collisions or truncation at the target breakpoints.
5. **Referenced assets decode** (`image_decode`) — every referenced image / font resolves and decodes (no broken `src`).
6. **Every interaction the change introduces or touches** (`playwright`) — each one behaves: open, submit, toggle, and every view mode, filter and drag the change ships. Description-only where unavailable.
7. **Capture evidence only when supported** (`screenshot`) — attach a screenshot / diff when the host can; otherwise cite what was statically checked.

**Completion contract.** A design task with render capability present cannot
claim "done" without at least steps 1–**6** as evidence.

**Step 6 moved INTO the mandatory range on 2026-09-11, and it read "the PRIMARY
interaction" until then — both halves were the defect.** A contract whose
mandatory range ends at step 5 is satisfied by an artifact that opens, paints,
fits its viewports and decodes its assets while every button on it is dead;
"primary", singular, then excused every interaction after the first. Measured
consequence, reported by the maintainer: a feature whose detail view crashed on
open and whose flyouts never fired, after which the states that should have been
exercised — every view mode, every CRUD verb, drag-and-drop, the filters — had to
be enumerated by hand. Steps 1-5 would all have passed on that page. Where capability is absent
(no browser / renderer), report that plainly (§ Rollback language) and keep the
completion claim scoped to what was actually checked. The checklist is exercised
by the verification golden tasks in
[`eval-fixtures.md`](../../tests/design-artifacts/eval-fixtures.md)
(`daf-nonblank-canvas`, `daf-mobile-fit`, `daf-missing-asset`,
`daf-overlapping-text`, `daf-broken-interaction`, `daf-export-readback-failure`).

Skills wire this in: [`playwright-testing`](../../src/skills/playwright-testing/SKILL.md)
runs it when a browser primitive is present; [`design-review`](../../src/skills/design-review/SKILL.md)
gates its verdict on it; static decks / documents use the deck / PDF / document
verification path ([`html-deck`](../../src/skills/html-deck/SKILL.md),
[`markitdown`](../../src/skills/markitdown/SKILL.md) readback).

## Staged rollout

Design-artifact fidelity rolls out in three stages so nothing becomes a hard
gate before its capability + evals exist:

1. **Advisory** — the lifecycle contract + these capability rows ship as
   guidance the design skills reference. No gate; agents follow the workflow
   and caveat honestly.
2. **Routed** — the design skills (`fe-design`, `design-review`,
   `existing-ui-audit`, `ui-component-architect`, …) are updated to point at
   the lifecycle stages + the eval fixtures. Still no default block.
3. **Default gates where capability exists** — a verification gate becomes
   default-on **only** for host classes whose row shows the primitive `✅`/`⚠️`
   present; classes without it stay advisory + caveat. A gate is never
   default-on for a class that can only `static_inspect`.

## Rollback language for a default-on gate

Any default-on verification gate carries this escape, so a host without render
support degrades instead of blocking every design task:

> **Render verification unavailable on this host.** `<gate>` needs `<primitive>`,
> which this host class (`<class>`) does not provide. Proceeding without the
> render check; the artifact is **static-inspected only**. Unverified: `<named
> property>`. To verify, run `<fallback>` or open the artifact on a
> local-with-tooling host.

A gate that cannot degrade this way is misconfigured — fix the gate, do not
strand the user.

## Eval baseline

The design-artifact eval fixtures (the nine cases this phase seeded — the file has grown since; see its Notes for which surface gates which id) live in
[`tests/design-artifacts/eval-fixtures.md`](../../tests/design-artifacts/eval-fixtures.md).
Each fixture names the primitive it needs, so a fixture is scored on a host only
when that primitive resolves present — and skipped-with-caveat otherwise. Phase 1
links the lifecycle branches to these fixture ids.

## Related

- [`host-capability-manifest`](../../src/agent-src/contexts/execution/host-capability-manifest.md) — the subagent-primitive sibling manifest (same resolve-once / safe-default shape).
- [`capability-boundary`](capability-boundary.md) — the broader capability-vs-pack boundary.
- [`playwright-testing`](../../src/skills/playwright-testing/SKILL.md) — the runner most design gates use when `playwright` is present.
- [`design-review`](../../src/skills/design-review/SKILL.md), [`existing-ui-audit`](../../src/skills/existing-ui-audit/SKILL.md), [`fe-design`](../../src/skills/fe-design/SKILL.md) — the design skills the routed stage updates.
