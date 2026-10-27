<!-- evidence-type: analysis -->

# Pre-registration — the routing arms for Phases 3 and 4

**Roadmap:** `road-to-routing-assurance-live-floors` 3.1–3.3 and 4.1–4.3. This
file is an addendum to `routing-baseline-protocol-20261027.md`; everything that
file froze still holds unless a row below says otherwise.
**Written:** 2026-10-27, before any arm ran a corpus case. It lands in its own
commit, and every arm's results land in later commits.

## Instrument, and what its USD figure is

Runs go through the CLI first: `claude plugin eval`, Claude Code **2.1.311**
(owner, OQ-22 as narrowed on 2026-10-27). Every USD figure below and in the
results is **the CLI's own estimate**, not billing. The ~95 USD ceiling binds
only an arm that has to use the API; none here does. `--max-cost-usd` is still
passed on every invocation, as a guard against a runaway case, not as a budget:
1.0 per pressure target (one case each), 15 for the twin arm, 60 for the MCP
arm.

## The catalogue every arm samples — the baseline's, not today's

Between the baseline (commit `9e226440b6`) and this branch's merge of
`origin/main`, six projected skills changed: `database`, `laravel-migration`,
`migration-architect`, `multi-tenancy`, `schema-review`, `sql-writing`. Today's
`dist/agent-src/skills/` hashes to `1da08f13…`, not the baseline's `1c967b17…`.
An arm compared against the baseline on a different catalogue would measure the
catalogue change, so every arm reads the **baseline commit's catalogue**,
materialised from git objects (`git ls-tree` + `git show` at `9e226440b6`) into
a scratch directory, where it reproduces `1c967b17…` exactly.
`routing_arms.ts` refuses any catalogue whose hash differs.

## Frozen for every arm

Same as the baseline: model `claude-opus-5-5` passed explicitly, `--runs 1`,
`--ablation none`, `--no-publish`, `--trust-plugin`, `--keep-temp`, prompt
frontmatter `max_turns: 10`. Each arm reuses the **baseline's 135 cases**: the
same unit and the same corpus query, under the same case name. No retries; an
errored run is UNKNOWN; units missing from an arm drop out of that comparison
only.

## 3.1 — catalogue pressure

- `N ∈ {12, 20, 50}`; `full` is the baseline itself.
- Per unit, the catalogue is `catalogueSubset(all, unit, N, "p3-20261027:" + unit)`:
  the unit plus the first `N − 1` other names in FNV-1a order of that seed.
- One target plugin per unit (a plugin carries one catalogue). Four targets run
  in parallel, each `-j 1`.
- Order of execution: N=20 first (the null needs it), then 12, then 50.

## 3.2 — near-duplicate twins

- **Twin set: the first 10 baseline units whose verdict was `fired`, in baseline
  order.** The step says "top-invoked skills"; there is no invocation evidence
  to rank by — the local trace ledger holds 2 package-skill calls in 2,858
  prompts — and confusion is only readable where the original fires.
- Twin texts are archived verbatim in `routing-twins-20261027.json` beside this
  file. Each paraphrases the original description (same meaning, different
  words, triggers paraphrased too); the twin's name is `<skill>-twin`.
- One target: the full baseline catalogue plus all ten twins. Per pair, up to 3
  corpus positives (hash order), so at most 30 cases, `-j 4`.
- Reported per pair: runs that invoked the original only, the twin only, both,
  neither. **Confusion = runs that invoked the twin / runs.**

## 3.3 — the null, resolved by a rule fixed now

> "selection accuracy at full catalogue is not worse than at N=20 by more than
> the floor delta."

- Selection accuracy = mean per-unit recall over the units measured in BOTH the
  baseline (full) and the N=20 arm.
- Floor delta = the registered tolerance, 0.10.
- **Null holds iff `acc(full) ≥ acc(20) − 0.10`.** Either way the verdict is
  archived, and its text claims no authority over tiering.

## 4.1 — the MCP delivery path

- The target carries **no `skills/` directory**. Its `.mcp.json` launches the
  lite server (`suggest_skill_for_task`, `read_skill`) from this branch's built
  `dist/cli/mcp/` modules, loaded over the frozen catalogue through a launcher:

  ```js
  import { loadContentTree } from '<worktree>/dist/cli/mcp/content.js';
  import { runStdioServer } from '<worktree>/dist/cli/mcp/stdio.js';
  const tree = loadContentTree(process.argv[2]);   // <scratch>/mcp-root, frozen skills
  await runStdioServer(tree, { name: 'agent-config-mcp', version: 'frozen-9e226440b6' });
  ```

- `--mocks off` and `--allow-tools` for exactly the two lite tools; the prompt's
  `allowed_tools` adds the same two.
- **Selection on this path = the run called `read_skill` with the unit's name**
  (`tool_used`, `input_match: '"name":"<unit>"'`).
- 135 cases, `-j 4`.

## 4.2 and 4.3 — parity

Native recall = the baseline's mean per-unit recall, MCP recall = the MCP arm's,
both over the units measured in both. `parityVerdict(native, mcp, 0.05)`. The
parity table goes in as evidence against the archived
`road-to-skill-delivery-over-mcp` outcome and adds no claim id.

## Disclosure — runs before this file

Three MCP-arm calibrations on one synthetic prompt (a KPI tile for zebra food),
no corpus query:

| Run | Server | Result | CLI estimate (USD) |
|---|---|---|---:|
| M0 | `"mcp__*"` allow pattern | refused by the CLI before running | 0.00 |
| M1 | kernel server (`dist/mcp/server.mjs`) by mistake: 29 tools, no `read_skill` | ran, used a built-in skill | 0.16 |
| M2 | lite server via `agent-config mcp-server` | both lite tools listed; ran, used a built-in skill | 0.81 |

They established the tool names
(`mcp__plugin_ac_agent-config__suggest_skill_for_task`, `…__read_skill`), that
the CLI refuses a wildcard allow entry, and that the frontmatter `allowed_tools`
does not stop a run from reaching for other built-in tools. That last point
holds for the baseline too, so it is part of the condition, not a deviation.
