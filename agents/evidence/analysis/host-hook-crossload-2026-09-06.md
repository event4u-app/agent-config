<!-- evidence-type: analysis -->

# Does a second host execute the Claude-shaped hook entry?

Phase 4.1 of `road-to-host-enforcement-truth`. The drafts treated cross-loading
as established. This round confirmed only the tree-side half — no environment
guard exists anywhere in `src/` — and set out to observe the host-side half.

## Method

An isolated scratch git repository outside any real project, carrying a
project-scope `.claude/settings.json` and nothing else. Its three hook entries
(`SessionStart`, `UserPromptSubmit`, `PreToolUse`) each append one line to a
marker file outside the workspace. One turn is then run under each available
host, from that workspace, and the marker file is read.

A line in the marker file means the host executed a hook entry it found in
`.claude/settings.json`. Zero lines after a turn that demonstrably ran means it
did not.

The marker file replaces the dispatcher journal the step names. The journal is
default-OFF (`hooks.runtime_journal.enabled`) and writes under the repository's
git-common-dir, so enabling it would have added a second variable to a probe
whose whole question is "did this entry execute at all". A marker file answers
that question and nothing else, which is the property wanted.

## The control makes the nulls readable

Without it, "no lines appeared" and "the probe never ran" are the same
observation. Run under Claude Code — the host the entry is shaped for — the
three hooks fired, once each, on one turn.

## Per-host record

| Host | Version | Date | Turn ran? | Second firing observed? |
|---|---|---|---|---|
| claude (control) | Claude Code 2.1.263 | 2026-09-06 | yes | n/a — this is the host the entry targets; it fired, as designed |
| codex | codex-cli 0.148.0 | 2026-09-06 | yes | **NO** — zero marker lines |
| gemini | Gemini CLI 0.50.0 | 2026-09-06 | **no** | not observed — see below |
| augment | auggie 0.16.1 | 2026-09-06 | **no** | not observed — see below |
| cursor | — | 2026-09-06 | **no** | not observed — see below |
| cline · windsurf · cowork · copilot | — | 2026-09-06 | **no** | not observed — not installed |

### codex — a real null, and the only one here

`codex exec` completed a turn in the scratch workspace and printed its own
lifecycle hooks firing (`hook: SessionStart`, `hook: UserPromptSubmit`,
`hook: Stop`) from the operator's own global `~/.codex/` configuration. The
scratch workspace's `.claude/settings.json` entries produced **zero** marker
lines in the same run. So codex fires hooks, and does not fire these ones.

Bounded to what it is: one version, one turn, one workspace, project scope only.
It is evidence that this host did not cross-load here, not that it never can.

### The three hosts that could not run a turn

- **gemini** — the CLI is installed and aborts before any turn with
  `IneligibleTierError: This client is no longer supported for Gemini Code
  Assist for individuals`. Reproduced twice, in two scratch workspaces.
- **augment** — `auggie --print` exits 1 with `No auth provided`.
- **cursor** — the IDE is installed; no CLI binary (`cursor-agent`) exists on
  this machine, and a headless turn is what the probe needs.

An unrunnable probe establishes nothing in either direction. None of these three
rows may be read as "does not cross-load".

### The gap that matters most is the one still open

Cursor is the documented cross-load candidate: this package's own platform
context records that Cursor "also reads `.claude/settings.json` so Claude hooks
transparently apply". It is precisely the host no probe here could reach. So the
proposition Phase 4 exists to test remains untested on its likeliest subject,
and 4.2 emits no guard for it — a guard emitted on an unmeasured host is the
same over-claim in the other direction.

## What this licenses

Phase 4.2 adds an environment guard only for a host where a second firing was
observed. That set is **empty**: one host was measured and measured negative,
and five could not be measured at all. No guard is emitted, and the single
concatenated command string in `_lib/claude_settings_hooks.ts` is unchanged.

## Re-establishing this

Any row above becomes real with: an authenticated or IDE-driven turn under that
host in a scratch workspace carrying the same `.claude/settings.json`, the host
version, the date, and an expiry — the five-part citation in
`contexts/execution/host-capability-manifest.md`.
