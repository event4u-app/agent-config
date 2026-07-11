---
model_tier: high
name: design-review
description: "Use when the user says \"review the design\", \"check the UI\", or wants a comprehensive UI/UX review. Uses a 7-phase methodology covering interaction, responsiveness, accessibility, and more."
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# design-review

## When to use

> **Render-verification gate.** A UI verdict is gated on the
> [design-artifact verification checklist](../../../docs/contracts/design-artifact-verification.md#verification-checklist):
> where render capability exists, do not pass a design task without render
> evidence (checklist steps 1–5); where it is absent, scope the verdict to what
> was statically checked and say so — never "looks good" without evidence.

Use this skill when:
- Reviewing pull requests with UI changes
- Auditing frontend components for design quality
- Verifying responsive design across viewports
- Checking accessibility compliance (WCAG 2.1 AA)
- Testing interaction flows and user experience
- Conducting visual QA on new features

Do NOT use when:
- Creating new designs (use `fe-design` skill instead)
- Reviewing backend/API code only
- Quick syntax checks (use linters)

## Prerequisites

One of the following browser automation tools:
- **Playwright MCP** (recommended) — browser automation, screenshots, viewport testing
- **Chrome DevTools** — screenshot capture, performance analysis

A **live preview URL** is required for testing.

## Procedure: Design review

1. **Inspect the PR and preview** — Read the PR description, diff, and identify changed components/pages; capture a baseline screenshot of the preview URL.
2. **Walk the interactions** — Run Phase 1; cover hover/focus/active/disabled, keyboard, loading, and form error states.
3. **Cover responsiveness, polish, a11y, robustness** — Run Phases 2–5 in order; record findings per phase.
4. **Audit code-health and content** — Run Phases 6–7; check tokens, dead styles, copy, console warnings.
5. **Verify and report** — Consolidate findings in the report structure; classify each as Blocker / High / Medium / Nit before posting.

### Phase 0: Preparation

- Read PR description and git diff.
- Identify changed components and affected pages.
- Navigate to preview URL.
- Take baseline screenshot.

### Phase 1: Interaction

- Test user flows end-to-end.
- **Six interaction states — every interactive element asserts each one** (single
  canonical states checklist; no other review phase repeats it):
  1. **default** — resting state is a deliberate style, not the browser default.
  2. **hover** — pointer feedback present (not the *only* affordance — see focus).
  3. **active** — pressed/engaged state visibly distinct from hover.
  4. **disabled** — unmistakably non-interactive (a contrast dip a user cannot read
     as "disabled" is a WCAG 1.4.1 failure — see `accessibility-auditor`).
  5. **focus** — visible `:focus-visible` indicator (Q6 floor, `lint_design_quality`).
  6. **loading** — explicit pending state (skeleton/spinner/disabled-submit), never a dead frozen control.
- **Transition timing** between these states follows the motion bands in
  [`fe-design`](../fe-design/SKILL.md) § Motion (micro-feedback ~100–200 ms;
  structural open/close ~200–500 ms) — the timing source of truth; do not restate
  a competing band set here. Every animated transition carries a
  `prefers-reduced-motion` alternative (M5 / Q4).
- Test keyboard navigation (Tab, Enter, Escape, Arrow keys).
- Verify form submission and error recovery.

### Phase 2: Responsiveness

Test at three viewports:

| Viewport | Width | Device |
|---|---|---|
| Desktop | 1440px | Standard monitor |
| Tablet | 768px | iPad |
| Mobile | 375px | iPhone SE |

- Take screenshots at each viewport.
- Check layout shifts, overflow, and content reflow.
- Verify touch targets are at least 44x44px on mobile.

### Phase 3: Visual Polish

- **Typography:** Font sizes, weights, line heights, hierarchy.
- **Spacing:** Consistent margins, padding, alignment.
- **Colors:** Contrast ratios, brand consistency, dark mode.
- **Alignment:** Grid alignment, visual balance.
- **Icons:** Consistent size, style, and spacing.

### Phase 4: Accessibility (WCAG 2.1 AA)

| Criterion | Check |
|---|---|
| **1.1.1** | All images have meaningful alt text |
| **1.3.1** | Semantic HTML (headings, landmarks, lists) |
| **1.4.3** | Color contrast ≥ 4.5:1 (text), ≥ 3:1 (large text) |
| **1.4.11** | Non-text contrast ≥ 3:1 (UI components, borders) |
| **2.1.1** | All functionality available via keyboard |
| **2.4.3** | Focus order is logical and predictable |
| **2.4.7** | Focus indicator is visible |
| **3.3.1** | Error messages identify the field and describe the error |
| **3.3.2** | Labels and instructions for form inputs |
| **4.1.2** | ARIA roles, states, and properties are correct |

### Phase 5: Robustness

- **Empty states:** What happens with no data?
- **Error states:** What happens when things fail?
- **Content overflow:** Long text, many items, large numbers.
- **Loading states:** Skeleton screens, spinners, progressive loading.
- **Boundary values:** Min/max inputs, special characters.

### Phase 6: Code Health

- Component reuse — are existing components used where possible?
- Design tokens — are colors, spacing, fonts from the design system?
- CSS patterns — utility classes vs. custom CSS, consistency.
- Accessibility in code — semantic HTML, ARIA attributes.

### Phase 7: Content & Console

- Grammar and spelling in UI text.
- Consistent terminology and tone.
- No placeholder text left in production.
- Check browser console for JavaScript errors or warnings.

## Reviewer posture

**Approval is earned, not assumed. Default to flagging.**

A design review is a skeptic's pass. The default verdict for every element
is "this needs to justify itself" — not "this is probably fine." Approve
explicitly when you have examined the evidence and found it sound.

This posture prevents the failure of "nothing to report" reviews that miss
real issues because the reviewer defaulted to charitable assumptions.

## Subtraction-first remedial hierarchy

When a finding warrants a remediation recommendation, prefer in this order:

1. **Delete** — remove the element, animation, pattern, or copy entirely
2. **Reduce** — make it smaller, shorter, subtler, less frequent
3. **Fix the specific issue** — change easing, origin, duration, contrast, font
4. **Make it interruptible** (for motion) — switch to transition/spring
5. **Move to GPU** (for motion) — animate only transform/opacity
6. **Polish** — the lowest-leverage fix; only if the above don't apply

*"Delete the animation" is always the first option to consider, even before
suggesting a different easing curve.* The same applies to decorative elements,
excessive copy, and redundant UI chrome.

## Before / After / Why output format

When reporting a finding with a specific remediation, use this table format:

| Field | Content |
|---|---|
| **Before** | The current state (quote the code, value, or describe the pattern) |
| **After** | The corrected state (specific value or alternative) |
| **Why** | The mechanism: why is Before wrong and After better? (one sentence, states the principle) |

**Wrong format** (do not use):
```
Before:
  button { transition: all 0.3s ease; }
After:
  button { transition: transform 0.2s ease-out, opacity 0.2s ease-out; }
```

**Right format:**

| | |
|---|---|
| **Before** | `transition: all 0.3s ease` |
| **After** | `transition: transform 0.2s ease-out, opacity 0.2s ease-out` |
| **Why** | `transition: all` animates layout properties on every state change, causing browser reflow; enumerate only the properties that move. |

The Why column carries the reasoning — it's the part that teaches the developer
and prevents the same finding from recurring.

## Communication principles

### Problems over prescriptions

Describe **what's wrong and why it matters**, not how to fix it.

```
❌ "Change margin to 16px"
✅ "Spacing feels inconsistent with adjacent elements, creating visual clutter near the CTA."
```

### Triage matrix

Every issue gets a severity:

| Severity | Meaning | Action |
|---|---|---|
| **Blocker** | Must fix before merge | Blocks PR |
| **High** | Should fix before merge | Strong recommendation |
| **Medium** | Consider for follow-up | Suggestion |
| **Nitpick** | Optional polish | Prefix with "Nit:" |

### Evidence-based

Screenshots required for all visual issues. Reference specific viewport and state.

### Start positive

Acknowledge what works well before listing issues.

## Report structure

```markdown
## Design Review Summary
[Positive opening + overall assessment]

### 🚫 Blockers
[Critical issues — must fix]

### ⚠️ High Priority
[Significant issues — should fix]

### 💡 Suggestions
[Improvements for follow-up]

### ✨ Nitpicks
[Minor aesthetic details]

### Testing Evidence
[Screenshots: Desktop, Tablet, Mobile]

### Next Steps
1. [Fix blockers]
2. [Address high-priority]

**Overall: [Ready to merge | Needs revisions]**
```


## Visual QA with browser automation

When Playwright MCP or browser tools are available, use them for automated visual verification:

### Before/After comparison

1. **Capture baseline** — screenshot before changes at all 3 viewports.
2. **Apply changes** — deploy or hot-reload.
3. **Capture after** — screenshot at the same viewports and states.
4. **Compare** — visually diff the screenshots, flag regressions.

### State-based verification

Don't just screenshot the default state. Capture:

| State | How to trigger |
|---|---|
| Empty | Remove data, check empty state UI |
| Loading | Throttle network, capture skeleton/spinner |
| Error | Force an error response, check error UI |
| Overflow | Add very long text, many items |
| Interactive | Hover, focus, open dropdowns |

### Mockup-to-code verification

When implementing from a design mockup or screenshot:

1. **Open the mockup** — use the provided image/screenshot.
2. **Implement** — build the UI component.
3. **Side-by-side** — compare mockup vs. implementation at the same viewport.
4. **Flag deviations** — spacing, colors, typography, alignment differences.

This is especially useful when the user provides a screenshot or Figma export as a reference.

## Output format

1. Design review report following the Report structure section
2. Severity-rated findings (blocker, suggestion, nit)
3. Accessibility and responsive compliance summary

## Auto-trigger keywords

- design review
- UI review
- UX audit
- accessibility
- WCAG
- responsive

## Async-verifier pattern (keep the main context clean)

For a review that needs browser probing, use an **async background verifier**
rather than self-screenshotting inline: fork a verifier subagent with its own
view — it takes the screenshots, probes viewports, and checks states, then
**stays silent on pass and surfaces only real, actionable problems** (never
nitpicks). The main agent does not self-screenshot, so its context stays clean
for the actual review reasoning. This is an orchestration pattern —
dispatch it via [`subagent-orchestration`](../subagent-orchestration/SKILL.md)
and position it against [`verify-repair-loop`](../verify-repair-loop/SKILL.md)
(the existing verify skill); it complements them, it does not duplicate them.

**Why the audit passes stay serial (not a parallel-4 fan-out).** A fan-out of
a11y + slop + hierarchy + states across four subagents was evaluated and
deferred: the passes share one live browser/navigation session and later phases
build on state established by earlier ones — not cleanly independent; and the
expensive part (browser probing / screenshots) is already offloaded by the async
verifier above, which captures the fan-out's main win without four separate
views. Reconsider only when `design-review` runs as a standalone heavy batch over
many *independent* surfaces, where per-surface `do-in-parallel` genuinely pays.

## Gotcha

- Don't review design without understanding the user's constraints (time, resources, scope).
- The model tends to suggest accessibility improvements that break the existing design system.
- "Best practice" is not always the right choice — sometimes "good enough" ships faster.

## Anti-slop scan

Hybrid: a deterministic detector does the mechanical pattern-matching (zero
token cost, no catalog reload); you do the judgment it cannot. After the
structured review phases, add an explicit **Anti-Slop Check** section:

1. **Run the deterministic detector first** — it catches the pattern-detectable
   tells so you don't eyeball or re-derive them:
   ```
   npx tsx src/scripts/lint_design_slop.ts --dir <consumer-ui-path> --json
   ```
   Each finding carries `rule` (e.g. `slop-v1-side-stripe`), `catalogId`
   (`V1`), `severity` (`P0`–`P3`), `file:line`, and a `message`. **Cite these
   verbatim** (rule-id + catalogId + file:line) — do not re-describe them from
   the prose catalog. Findings are *rebuttable presumptions*: a finding the
   consumer's `DESIGN.md` gate suppresses is already filtered out; a remaining
   finding means the project has not declared the pattern as intentional.
   `lint_design_slop` is **flags, never a block** (default exit 0; CI opts into
   failure via `--fail-on`).
2. **Judge what the detector cannot** — load
   [`docs/guidelines/design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md)
   for the tells that need structural/aesthetic judgment (e.g. T3 icon-tile
   stack, L2 three-identical-card grid, V2 glassmorphism intent). List any that
   appear, cite by entry ID, and check the override condition.
3. Run the AI-slop originality self-test on the overall aesthetic direction.
   Report the result (pass / flag / fail) with one sentence of evidence — this
   is the human judgment the detector deliberately does not make.

For the **objective quality floors** (WCAG contrast, font-size, line-length,
reduced-motion, heading hierarchy, focus indicator), do NOT eyeball them —
cite [`lint_design_quality`](../../../src/scripts/lint_design_quality.ts)
output for the consumer project (Q1–Q6 in the catalog). The review owns the
*subjective* anti-slop judgment (Visual / Typography / Color / Layout taste);
the linter owns the *objective* floors; `accessibility-auditor` owns the WCAG
*audit method*. Cite, don't re-derive.

## Do NOT

- Do NOT skip accessibility testing — it's not optional.
- Do NOT report issues without evidence (screenshots, specific elements).
- Do NOT prescribe solutions — describe problems and impact.
- Do NOT block PRs on nitpicks.
- Do NOT test only at desktop resolution.
