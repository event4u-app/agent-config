---
recommended_model: inherit
name: roadmap:ai-council
tier: 2
cluster: roadmap
sub: ai-council
skills: [ai-council, agent-docs-writing, roadmap-management]
description: Challenge a roadmap with the AI council (deep tier) and refactor from convergence findings. Wraps `/council default` pinned to `--input-mode roadmap --depth deep`; patches surface as numbered options.
council_depth: deep
suggestion:
  eligible: true
  trigger_description: "council on roadmap, challenge this roadmap, stress-test the plan, refactor roadmap from council findings"
  trigger_context: "existing agents/roadmaps/*.md the user wants reviewed before execution"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /roadmap:ai-council

Council-driven challenge + refactor scope of the
[`/roadmap`](../roadmap.md) cluster. Pins the input mode to
`roadmap` and the depth tier to `deep` (architecture / refactor
artefact), then drives the user through applying convergence
findings as numbered patches against the roadmap file.

**Source of truth:** `.agent-src.uncondensed/` — never read or edit
`.agent-src/` or `.augment/` directly.

## Instructions

### 1. Resolve the target roadmap

Parse the argument as a roadmap path or filename:

- `/roadmap:ai-council agents/roadmaps/<name>.md` — explicit path.
- `/roadmap:ai-council <name>` — fuzzy match against
  `agents/roadmaps/*.md`; if multiple match, list and ask
  (one question per turn per `ask-when-uncertain`).
- No argument → list `agents/roadmaps/*.md` and ask.

Capture the **original ask** verbatim — the user's framing sentence
that triggered this council run (e.g. *"review this roadmap before
I execute it"*). This flows into `--original-ask`.

### 2. Run the `/council default` flow with these pinned flags

Follow [`/council default`](../council/default.md) Steps 2–4
**verbatim**, with these arguments fixed:

- `--input-mode roadmap`
- `--depth deep` (this command declares `council_depth: deep` in
  frontmatter; the host translates it into `--depth deep`)
- `--output agents/runtime/council/responses/<roadmap-stem>-roadmap.json`
  (overwrite if it exists; the previous run is the predecessor for
  this iteration)
- `--original-ask "<captured-ask>"`

`--depth deep` floors rounds at
`max(ai_council.deep_min_rounds, ai_council.min_rounds)` (default
`3`). Do **not** pass `--rounds` unless the user explicitly asked
for a different count.

The cost gate from `/council default` Step 3 still applies — billable
members require user confirmation **even under `personal.autonomy: on`**
(per the deep tier surcharge — typical cost ~$0.05–0.13 vs. ~$0.02
for the standard tier).

### 3. Render the report

Run `./agent-config council:render <output.json>` and write the
**Convergence / Divergence** section per
[`/council default § Render`](../council/default.md). Do **not** end
with `/council default`'s generic numbered-options block — the
refactor flow in Step 4 replaces it.

### 4. Append a Council review block to the roadmap

Open the roadmap file and append (do **not** overwrite existing
content):

```markdown

## Council review (<UTC date>)

<Convergence section verbatim>

### Convergence findings

1. **<Finding 1 title>** — <one-line summary> · trace: §<member-section>
2. **<Finding 2 title>** — <one-line summary> · trace: §<member-section>
…

### Divergences (no consensus)

- **<Topic>** — <Member A says X, Member B says Y; user decides>

### Predecessor council trace

`agents/runtime/council/responses/<roadmap-stem>-roadmap.json` (this run).
```

Run `./agent-config roadmap:progress` after the append. The block
adds no `[ ]` checkboxes, so the dashboard counts stay flat.

### 5. Apply the critical-evaluation lens, then surface verdicted patches

Before drafting any patch, run every finding from Step 4 through the
*Critical evaluation* checklist from the
[`ai-council` skill](../../skills/ai-council/SKILL.md#critical-evaluation--convener-skeptic-stance):

- **Codebase fit** — does the finding match the actual roadmap content, file paths, scripts, contracts cited in the roadmap? (`view` / `codebase-retrieval`)
- **Locked-decision conflict** — does it contradict an ADR (`docs/decisions/`), a contract (`docs/contracts/`), a kernel rule, or an earlier locked decision in **this** roadmap?
- **Already addressed** — is the finding already covered by an existing step, AC, or phase in the roadmap?
- **Cost / benefit** — does the patch's scope vs. roadmap value clear the bar?
- **Hallucination** — does the finding cite a file, function, phase, or step that does not exist?

For every finding, attach a verdict — **`accept`**, **`accept-with-modification`**, **`reject`**, or **`needs-input`** — with a one-line reason citing host evidence (file:line, ADR, contract, roadmap step).

Append a **Host verdict** sub-block under the Council review block in the roadmap:

```markdown
### Host verdict

| # | Finding | Verdict | Reason |
|---|---|---|---|
| 1 | <one-line> | `accept` | matches `agents/roadmaps/<this>.md` Phase X step Y |
| 2 | <one-line> | `accept-with-modification` | narrow scope to phase Z — global change contradicts AC §N |
| 3 | <one-line> | `reject` | contradicts ADR `docs/decisions/<adr>.md` |
| 4 | <one-line> | `needs-input` | open question — user picks below |
```

Then surface a single numbered-options block per [`user-interaction`](../../rules/user-interaction.md), carrying the verdict per option:

> 1. `[accept]` Apply finding 1 — <one-line patch summary>
> 2. `[accept-with-modification]` Apply finding 2 (modified) — <one-line patch summary + adjustment>
> 3. `[reject]` Skip finding 3 — <one-line reason> (override available below)
> 4. `[needs-input]` <open question for finding 4>
> …
> N. Apply all `accept` findings (recommended only if non-conflicting)
> N+1. Override host verdict — apply a finding the host rejected (specify number)
> N+2. Skip — leave Council review block + Host verdict as advisory only

The user picks one or more numbers (`1,3,5` is allowed). Apply each selected patch via `str-replace-editor` against the roadmap, then re-run `./agent-config roadmap:progress` once at the end so the dashboard reflects the new step / AC count.

**Verdict ≠ filter.** Every finding stays visible in the Host verdict block with its verdict and reason — the user can override at any time. The host filters its **own** recommendation; it does not hide council output.

### 6. Hard floor — text + roadmap edits only

`/roadmap:ai-council` may:

- write `agents/runtime/council/responses/<…>.json`
- append the Council review block to the named roadmap
- apply user-picked patches to the same roadmap
- regenerate `agents/roadmaps-progress.md`

It does **NOT**:

- edit any other roadmap, command, rule, or skill file
- commit, push, or open a PR
- run `git` beyond `git diff` (read-only)

## Rules

- **One roadmap per invocation.** Re-run for the next file.
- **Critical evaluation is mandatory** — every council finding gets
  a host verdict (`accept` / `accept-with-modification` / `reject` /
  `needs-input`) with one-line evidence before any patch is drafted.
  Convergence ≠ correctness; the council never saw the codebase. See
  [`ai-council § Critical evaluation`](../../skills/ai-council/SKILL.md#critical-evaluation--convener-skeptic-stance).
- **Decline = silence** ([`scope-control`](../../rules/scope-control.md)) —
  if the user picks "Skip — advisory only", the Council review block
  + Host verdict stay in the roadmap, but no patches are applied. Do
  not re-ask the question on the same task.
- **Cost gate is non-negotiable** — the deep tier costs more than
  standard; confirm before every billable run, even with
  `personal.autonomy: on`.
- **No commit.** Patches land in the working tree only; commit
  decisions stay with the user per
  [`commit-policy`](../../rules/commit-policy.md).

## See also

- [`/roadmap`](../roadmap.md) — cluster orchestrator
- [`/council default`](../council/default.md) — base flow this command wraps
- [`ai-council`](../../skills/ai-council/SKILL.md) — neutrality, redaction, deep tier
- [`scripts/council_cli.py`](../../../scripts/council_cli.py) — CLI entry point
