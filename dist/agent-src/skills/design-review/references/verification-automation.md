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
