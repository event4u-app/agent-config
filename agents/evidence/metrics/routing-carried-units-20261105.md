<!-- evidence-type: analysis -->

# The five units the canary left unresolved — traces, host vs catalogue, repair

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.1–1.3.
**Input:** `routing-canary-rerun-20261103.json` (today's catalogue `59abaf19…`,
host 2.1.316, three runs per unit).
**New rows:** `routing-carried-frozen-rerun-20261105.json` (1.2) and
`routing-carried-repaired-20261105.json` (the 1.3 trial).
All runs: `claude plugin eval`, host **2.1.316**, `claude-opus-5-5`,
`--runs 3`, `--ablation none`, through the subscription CLI. CLI estimates
2.43 and 2.57 USD. No run errored.

## 1.1 — what the missed runs invoked instead

From each run's kept trace (`invokedFromTrace`), canary rerun, catalogue
`59abaf19024a…`:

| Unit | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| `type-design` | none | none | none |
| `react-shadcn-ui` | none | none | none |
| `project-analysis-core` | none | none | none |
| `dependency-upgrade` | none | fired | fired |
| `wireframe` | fired | none | fired |

No miss invoked a competing skill. Every miss invoked no skill at all.

## 1.2 — host or catalogue

The same five cases (same names, same query sha256) at three runs each on the
**frozen baseline catalogue** (`1c967b17…`, materialised from commit
`9e226440b6` as a detached worktree, hash checked before the run) on today's
host:

| Unit | Baseline (2.1.311, frozen) | Canary (2.1.316, today) | 1.2 (2.1.316, frozen) | Verdict |
|---|---|---|---|---|
| `type-design` | 1/1 | 0/3 | 1/3 | host |
| `react-shadcn-ui` | 1/1 | 0/3 | 0/3 | host |
| `project-analysis-core` | 1/1 | 0/3 | 0/3 | host |
| `dependency-upgrade` | 1/1 | 2/3 | 2/3 | not the catalogue; host or noise |
| `wireframe` | 1/1 | 2/3 | 3/3 | noise |

On the frozen catalogue the units fail as they do on today's, so the catalogue
change is not the cause; the host change is.

## Run ledger

| Series | Catalogue | Runs | Fired | Missed |
|---|---|---:|---:|---:|
| 1.2, frozen | `1c967b17…` | 15 | 6 | 9 |
| 1.3 trial, edited | `fe4298b3…` | 15 | 7 | 8 |

## What the host change is — read from the traces

All 17 missed runs of the two series above share one shape. The run first
globs the working directory, finds the eval sandbox empty, and ends by asking
for the material the prompt refers to — the logo SVG, the existing
`components/ui` Button and tokens, the project to bump, the codebase to map —
without choosing a skill. `wireframe`, whose prompt needs no file, fires 3/3 on
the frozen catalogue.

The 2.1.316 host checks the workspace before it routes. On a prompt that names
absent material it asks first, so routing never happens. The baseline host
routed first.

## 1.3 — the repair tried, and why it was reverted

Three descriptions (`type-design`, `react-shadcn-ui`, `project-analysis-core`)
were rewritten to open with a general "Use when …" trigger, each shorter than
before (catalogue `fe4298b3…`, otherwise the commit named in the artefact).
Result at three runs each: `type-design` 0/3, `project-analysis-core` 0/3,
`react-shadcn-ui` 2/3, with every miss again of the shape above. A description
cannot reach a run that stops before routing, so the edits were reverted rather
than landed on a result they did not cause.

The repair that addresses the cause is in the instrument, not the catalogue: a
case whose prompt names workspace material needs that material scaffolded into
the sandbox, or the prompt restated so it does not depend on it. Either one
changes what the baseline measured on those cases, so it needs a fresh baseline
row for each case it touches.

## The fixture pilot (discovery, not certification)

Both council seats asked for it before any instrument change. The same three
stable units on the frozen catalogue and today's host, three runs each, with a
`context.scaffold_script` (`case.yaml`, run with `--scaffold`) that seeds the
material each prompt names and nothing else — no skill name, no task hint: an
SVG wordmark; `components/ui/button.tsx` with four `cva` variants plus a tokens
file; a five-file Express repository with one commit. CLI estimate 2.31 USD.

| Unit | Empty sandbox | With fixture | What the misses did |
|---|---|---|---|
| `type-design` | 0/3 | **3/3** | — |
| `react-shadcn-ui` | 0/3 | 0/3 | read both files, wanted to edit, had no Edit/Write in `allowed_tools`, delegated the edit to a subagent |
| `project-analysis-core` | 0/3 | 0/3 | one run invoked `analysis-skill-router`, which did not dispatch; all three judged five one-line files too small to need a skill |

So the fixture restores routing where the empty sandbox was the only obstacle
(`type-design`). For the other two it uncovers the next confound: withheld
write tools, and a fixture small enough that direct reading is the sensible
answer.

**AI council, second round (2026-11-05, both seats: a staged option (b)).**
Version the fixture cases as a new series and keep the old one; for
`react-shadcn-ui` grant write tools as a declared experimental condition; pilot
`dependency-upgrade` with a fixture too; move the `project-analysis-core`
positive to the router only if a trace shows the router dispatching to it, which
the one router run above did not. Before any measuring run, freeze the measurement
contract: target and pass rule per unit, whether indirect dispatch counts,
baseline source per unit, catalogue, prompts, fixture checksums, allowed tools
and run count. Editing the corpus in this session before that freeze is
permitted.
