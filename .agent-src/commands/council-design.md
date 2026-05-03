---
name: council-design
cluster: council
sub: design
skills: [ai-council]
description: Run the council on a design document, ADR, or architecture proposal — surfaces hidden coupling, missing rollback, and sequencing risk before commitment.
disable-model-invocation: true
suggestion:
  eligible: true
  trigger_description: "council on this design, second opinion on the ADR, external review of architecture proposal"
  trigger_context: "user has a design doc / ADR / architecture proposal and wants an external review before commitment"
superseded_by: council design
deprecated_in: "1.17.0"
---

> ⚠️  /council-design is deprecated; use /council design instead.
> This shim is retained for one release cycle (1.17.0 → next minor) and forwards to the same instructions below. See [`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

# council-design

## Instructions

Specialised council mode for **design documents, ADRs, and
architecture proposals**. Wraps `/council files:<paths>` (or
`/council prompt:"…"`) with the `design` mode neutrality preamble that
focuses members on architectural risk rather than line-level
correctness.

### 1. Resolve the artefact

The user invoked `/council-design <path>` or `/council-design`. If no
path was supplied, ask (one question per turn):

> Which design artefact should the council review?
>
> 1. A file path (ADR, design doc, RFC)
> 2. Multiple files / a directory (the bundler will gather them)
> 3. A free-form proposal in the chat — paste it now

Pick **1** or **2** → use `files:` mode of `/council`.
Pick **3** → use `prompt:` mode of `/council`.

### 2. Capture the originating ask

Look for the artefact's stated goal — the first paragraph after the
title, or a `## Goal` / `## Problem` section if present. That goal is
the `original_ask` for the handoff preamble. If the artefact has no
goal section, ask the user (one question per turn):

> What is the goal of this design? (one sentence — used as neutral
> framing for the council, not their analysis)

### 3. Run /council with the design mode preamble

Invoke the matching `/council` form:

- `files:` → `/council files:<paths>` with `mode_override=design`.
- `prompt:` → `/council prompt:"<artefact text>"` with
  `mode_override=design`.

The `design` mode addendum from `scripts/ai_council/prompts.py`
focuses council members on:

- Trust-boundary and module-coupling risk.
- Rollback / kill-switch criteria the design omits.
- Sequencing risk (does step N really not block step N+1?).
- Open questions disguised as decisions.

The cost gate from `/council` Step 3 still applies.

### 4. Render the report

Use the standard stacked + Convergence/Divergence layout. Add a
one-line header at the top so reviewers know the lens:

```
## Council on <artefact path or "free-form proposal"> — design lens
```

### 5. Hand back to the user

The council is **advisory**. Do **not** rewrite the design based on
findings. Surface convergent + divergent points and let the user
decide which to fold in via `/feature plan` or `/feature refactor`.

### Hard floor (restated)

`/council-design` produces **text only**. It does NOT edit the
design file, open ADR PRs, or modify the codebase.

## Failure modes

- **No artefact resolvable** → ask once; if still empty, stop.
- **Artefact too large** → bundler raises `BundleTooLarge`; suggest
  splitting (`/council files:<single-file>` per section).

## See also

- `/council` — base orchestration entry point.
- `/feature plan` / `/feature refactor` — where design changes get
  written, after the council surfaces issues.
- `ai-council` skill — neutrality guidelines.
