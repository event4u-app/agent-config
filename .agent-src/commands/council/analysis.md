---
name: council:analysis
tier: 2
cluster: council
sub: analysis
skills: [ai-council]
description: Run the council on a local analysis output (project-analyze, audit script, codebase scan) — critiques the analysis itself for dedup, evidence quality, and roadmap-readiness.
suggestion:
  eligible: true
  trigger_description: "council on this analysis, critique the project-analyze output, second opinion on the audit findings, turn analysis into roadmap"
  trigger_context: "user has a local analysis artefact (agents/evidence/analysis/*.md|json) and wants an external critique of the analysis quality + roadmap-ready follow-ups"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /council analysis

## Instructions

Specialised council mode for **local analysis artefacts** — `/project-analyze`
output, audit reports, codebase scans under `agents/evidence/analysis/`. Wraps
`/council default files:<path>` with the `analysis` neutrality preamble that
focuses members on **critiquing the analysis itself** (dedup, evidence
quality, roadmap-readiness) rather than re-reviewing the underlying code.

The synthesis output is shaped for direct consumption by
`/roadmap-create` — Top-N consensus findings + per-finding metadata
(`evidence-grade`, `roadmap-ready`, `supporting-citation`).

### 1. Resolve the analysis artefact

The user invoked `/council analysis <path>` or `/council analysis`. If
no path was supplied, ask (one question per turn, per
`ask-when-uncertain`):

> Which analysis artefact should the council review?
>
> 1. A file path under `agents/evidence/analysis/` (`.md` or `.json`)
> 2. Multiple files (one analysis split across sections)
> 3. Free-form analysis text in the chat — paste it now

Pick **1** or **2** → use `files:` mode of `/council default`.
Pick **3** → use `prompt:` mode of `/council default`.

### 2. Capture the upstream-analysis goal

Look for the artefact's stated goal — the first paragraph after the
title, a `## Goal` / `## Scope` section, or the analyzer command that
produced it (often in the file header). That goal is the `original_ask`
for the handoff preamble. If absent, ask the user (one question per
turn):

> What was the goal of this analysis? (one sentence — used as neutral
> framing for the council, not their critique)

A follow-up question MAY also be supplied as part of the invocation
(e.g. `/council analysis <path> "which findings warrant a roadmap?"`).
Append it to `original_ask` so members see both the analyzer goal and
the consumer question.

### 3. Run /council default with the analysis mode preamble

Invoke the matching `/council default` form:

- `files:` → `/council default files:<paths>` with `--prompt-mode analysis`.
- `prompt:` → `/council default prompt:"<artefact text>"` with
  `--prompt-mode analysis`.

`--prompt-mode` is the CLI flag (`scripts/council_cli.py`) that
swaps the lens addendum after the bundler has run. The bundle shape
stays as the resolved `--input-mode` (prompt | roadmap | files).

The `analysis` mode addendum from `scripts/ai_council/prompts.py`
focuses council members on:

- Deduplicating findings restated under different headings.
- Scoring evidence quality (confirmed / inferred / speculative).
- Separating roadmap-ready findings from ones that need a discovery
  loop first.
- Proposing 3–5 ranked follow-up actions with supporting citations.

The cost gate from `/council default` Step 3 still applies. Render via
Step 5/5a/5b of `/council default`.

### 4. Render the report (analysis-shaped header + Top-N consensus)

Use the standard stacked + Convergence/Divergence layout. Add a
one-line analysis header at the top so reviewers know the lens:

```
## Council on <artefact path> — analysis lens
```

After the standard Convergence / Divergence blocks, append a
**Top-N consensus** block in the shape consumed by `/roadmap-create`:

```
## Top-N consensus findings (roadmap-ready first)

1. <finding title>
   - evidence-grade: confirmed | inferred | speculative
   - roadmap-ready: yes | needs-discovery
   - cited by: <member names — anonymised post-render is fine>
   - supporting citation: <file:line | section heading from the upstream analysis>

2. ...
```

Order: roadmap-ready findings first, ranked by member-consensus count;
then `needs-discovery` items. Cap at N=10 unless the upstream analysis
has fewer findings.

### 5. Hand back to the user

The council is **advisory**. Do **not** rewrite the analysis or open
roadmap files based on findings. Surface the Top-N block and offer:

> 1. Feed the Top-N block into `/roadmap create` to draft a roadmap.
> 2. Discard — keep findings in chat only.
> 3. Re-run with a narrower scope.

### Hard floor (restated)

`/council analysis` produces **text only**. It does NOT edit the
analysis file, write roadmap files, or modify the codebase. Roadmap
authoring is the explicit downstream step, not a side-effect.

## Failure modes

- **No artefact resolvable** → ask once; if still empty, stop.
- **Artefact too large** → bundler raises `BundleTooLarge`; suggest
  splitting (`/council default files:<single-section>` per heading).
- **Analysis has zero citations** → flag in the rendered report; every
  finding will score as `speculative`. The council will say so loudly
  and the Top-N block will be empty of `confirmed` rows — that is the
  signal to re-run the upstream analyzer with stricter evidence rules.

## See also

- `/council default` — base orchestration entry point.
- `/project-analyze` — primary upstream producer of analysis artefacts.
- `/roadmap create` — primary downstream consumer of the Top-N block.
- `ai-council` skill — neutrality guidelines.
