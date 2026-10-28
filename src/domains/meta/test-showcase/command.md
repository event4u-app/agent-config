---
model_tier: medium
name: test-showcase
argument-hint: "[quick|full|replay|render] [--max-usd <usd>]"
pack: meta
intent: "Run the with/without agent-config showcase benchmark at a stated budget and report what its bundles say"
routes_to: [verify-completion-evidence]
replaces: []
visibility: advanced
cluster: test-showcase
skills: [verify-completion-evidence]
description: Run the with/without showcase benchmark and report it
suggestion:
  eligible: false
  rationale: "Owner-invoked and cost-bearing — never suggested; spend is owner-reserved."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /test-showcase

## Instructions

The front door to the showcase benchmark: plan the run, launch the Taskfile
target, read what it wrote, report. **This command never produces a number.**
Every figure in the report is quoted from harness output, a bundle or a rendered
page — never computed, rounded or estimated here.

### 1. Plan — tier, host, budget

| Form | Target | Spend |
|---|---|---|
| `replay` (default) | `task bench:showcase:replay` | 0 USD — re-grades kept artifacts |
| `render` | `task bench:showcase:render -- --check` | 0 USD |
| `quick` | `task bench:showcase:quick -- --max-usd <usd>` | paid — 3 tasks × 2 arms × k=3, host `claude` |
| `full` | `task bench:showcase -- --max-usd <usd>` | paid — every artifact task, 3 arms |

For a paid form, print the plan first — it spends nothing:

```bash
./scripts-run src/scripts/showcase_run --tier quick --plan
```

Show the user the plan's call count and host. **No budget given → ask once for
`--max-usd`; never choose one.** In CI, refuse a paid form outright (the harness
refuses too).

### 2. Launch

Run the one Taskfile target from the table with the user's budget. Do not
re-implement it, add flags it did not name, or retry a refused run with a
different budget unasked.

### 3. Read and report

- **replay / render** — quote the `verdict:` line or the `clean` / `DRIFT` lines.
  `INDETERMINATE` means nothing was re-graded; say so, it is not a pass.
- **quick / full** — quote the plan, the harness's final line (the
  `artifact runs →` JSONL path, or the sweep-cap stop line) and its exit code.
  A run with no committed bundle has no page yet; say that rather than
  summarising the JSONL into numbers.
- Link `docs/examples/bench/index.md` and, per task with a bundle, its page.
- Five lines at most. Cite a claim id from `docs/CLAIMS.md` beside any figure;
  a figure without one is not reported.

## Examples

```text
/test-showcase                       # replay at 0 USD
/test-showcase quick --max-usd 15    # plan, then the paid quick tier
/test-showcase render                # drift check of docs/examples/bench/
```

**Why it works:** (`self-check-loop`) the budget is stated before anything runs and
every reported figure is quoted from a harness line or a committed bundle, so the
report can be checked against its source.
