# design-review — verification automation

> Section-level entry point of the `design-review` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

## Visual QA with browser automation

When Playwright MCP or browser tools are available, use them for automated visual verification:

### Before/After comparison

1. **Capture baseline** — screenshot before changes at all 3 viewports.
2. **Apply changes** — deploy or hot-reload.
3. **Capture after** — screenshot at the same viewports and states.
4. **Compare** — visually diff the screenshots, flag regressions.

### Scroll evidence — the machine-readable half of the comparison

The step above compares screenshots **by eye**, which is the whole of W2: no
number leaves the comparison, so nothing downstream can act on it. For a
scroll-driven surface the missing artefact is small and specific — the scroll
position, the beat that position belongs to, and the element states asserted
there. Emit it as `scroll_evidence` on the review envelope; `design-review`
reads it in Phase 2 alongside the viewport sweep.

```json
{
  "schema_version": 1,
  "ledger_ref": "path to the story-beat ledger these ids come from",
  "samples": [
    {
      "scroll": 0.42,
      "beat_id": "b2-reveal",
      "element_states": [
        { "selector": "#panel", "state": "pinned", "observed": "pinned" },
        { "selector": "#caption", "state": "visible", "observed": "offscreen" }
      ]
    }
  ]
}
```

`beat_id` references the ledger at
[`wireframe/references/story-beat-ledger.schema.json`](../../wireframe/references/story-beat-ledger.schema.json),
which is what makes a sample checkable against an intent rather than against a
remembered screenshot: a row whose `state` and `observed` disagree is a finding,
and a reviewer can diff two runs of this file.

**Build no verifier beside this.** The artefact is consumed by the review flow
already described on this page — the async verifier captures it in the same pass
that captures the screenshots. Sampling positions come from the ledger's
`enters_at` values, so the sample set is derived from the beats, not from an
arbitrary scroll grid. Where no capture primitive is available the samples are
absent and the verdict is static-scoped, per `verdict_scope`
(`directives/ui/review.ts`) — an empty `samples` array is a recorded null, never
a pass.

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

**Branch on what the artifact actually is before you open anything.** The two
kinds carry different workflows, and running the image workflow over a code
artifact is the failure this branch exists to prevent — it rebuilds from pixels
what was handed over as source.

**Code artifact** — an HTML/JSX/Vue file, an archive, a repo, a live page whose
DOM you can reach:

1. **Read the code** — it is the data basis (`design-fidelity-mechanics`
   § Data-basis ladder, rungs 1–2). Markup, styles, scripts.
2. **Implement** — adapting the artifact's own code where it is
   stack-compatible; a from-scratch re-derivation is a deviation, not a default.
3. **Screenshot afterwards** — for an after-the-fact visual diff only, never as
   the input you built from.
4. **Flag deviations** — including behaviour: a handler or keyframe that did not
   survive is a deviation, not an implementation detail.

**Image artifact** — a PNG/JPG screenshot, a Figma export you cannot open as
source, a photograph of a whiteboard:

1. **Open the mockup** — use the provided image/screenshot.
2. **Implement** — build the UI component.
3. **Side-by-side** — compare mockup vs. implementation at the same viewport.
4. **Flag deviations** — spacing, colors, typography, alignment differences.

This is especially useful when the user provides a screenshot or Figma export as a reference.

> **Near-miss worth naming:** an HTML file *opened in a browser* is still a code
> artifact. The browser makes it look like an image; the file on disk is rung 1.
> Take the code path.

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
build on state established by earlier ones, so they are not cleanly independent;
and the expensive part — browser probing / screenshots — is already offloaded by
the async verifier above, which captures the fan-out's main win without spinning
up four separate views. Reconsider only when `design-review` runs as a standalone
heavy batch over many *independent* surfaces, where per-surface
`do-in-parallel` genuinely pays.

## Appearance verification — what a clean render does not answer

The skill body carries the floor: appearance verification is mandatory wherever
appearance can be affected, its trigger is identical to the two capture steps it
replaces, and presence-and-sanity comes before pixel comparison. This section is
the part a reviewer looks up rather than obeys — the division of labour between a
render and the probe's four dimensions.

A render is a resting frame. It can only show what the surface looks like with
nothing driving it, which is why a clean one says nothing about:

| The question | Why the render cannot answer it | What does |
|---|---|---|
| Does hover / focus / active feedback exist? | the state is never entered | `interaction` |
| Does the keyboard reach it, and does the handler fire? | no input is delivered | `interaction` |
| Did the breakpoint change the layout, or did the media query silently not fire? | the same picture comes back either way | `viewport_matrix` |
| Is the resolved value the token intended, after cascade and fallback? | a wrong value can look plausible | `computed_style` |
| Is `prefers-reduced-motion` honoured, and with *what* instead? | the preference is never emulated | `media_emulation` |

Reading a clean render as though it covered a row of this table is the
substitution the appearance-only marking exists to prevent, and it is the reason
the floor lists its two jobs separately rather than as one "visual check": the
first job is the one no probe dimension replaces, and the second is the one the
probe supersedes for behavior.

**The converse holds and is the less obvious half.** No probe dimension covers
presence and sanity. A `computed_style` row can be green on a node that is
off-screen, transparent, zero-height or painted under an overlay — correct
resolved values on something nobody can see. That asymmetry is why demoting the
image from *primary evidence* is not the same as removing it, and why an unrun
appearance check is reported as unrun rather than folded into a probe verdict.
