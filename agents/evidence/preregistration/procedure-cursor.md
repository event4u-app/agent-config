<!-- evidence-type: analysis -->

# Pre-registration — does the procedure cursor add anything the split alone does not?

**Written 2026-10-19, before any arm has run and before any spend is authorised.**
Steps 6.1, 6.3 and 6.4 of `road-to-steps-the-skill-cannot-skip`; the frame for 6.2
and the rule 6.5 applies. Read at `main@e8b36d7ce`.

The ordering is the point. A pre-registration written after the first numbers is a
results section; one written after a budget is approved is written by someone who
already expects something. D17 (AI council 2026-10-18, 2/2) put the order in
writing: this file states its computed maximum first, and the authorisation is
decided with that figure in hand. Nothing below authorises a run.

## The question

> On tasks where the pre-split monolith demonstrably fails, does splitting a pilot
> into a head and step files raise task success (arm B against arm A), and does
> handing those steps out one at a time through `agent-config work --procedure`
> raise it further (arm C against arm B)?

The design and its decision rules are own analysis of the plans this roadmap's
source round carried; no external source is cited for them.

## Arms — three plugin directories, one difference each

The eval tool's own baseline arm is *no plugin*, not the monolith, so the three
arms are three plugin directories, each run with `--ablation none`. Each holds
exactly one pilot skill and nothing else from this package.

| Arm | Skill content | Cursor |
|---|---|---|
| **A — monolith** | `SKILL.md` = the committed pre-split body, byte for byte (`tests/skills/fixtures/procedure_conservation/<pilot>.pre-split.txt`) | none — no sidecar, no step files |
| **B — split, no cursor** | head `SKILL.md` + `procedure.yaml` + `references/steps/*.md`, byte for byte from `src/skills/<pilot>/` at the commit that freezes the corpus | refused: the run environment sets `AGENT_CONFIG_PROCEDURE_OFF=1`, so the head's cursor sentence fails closed and the agent follows the head's step table itself |
| **C — split, cursor** | identical files to arm B | available: the kill switch is unset |

B and C differ in **one environment variable** and nothing else — same files, same
prompt, same fixture, same model. A and B differ in the skill files only. That is
what lets B isolate the split's own effect and C isolate the cursor's (K12).

The task prompt is identical across arms and invokes the skill explicitly by name,
so the activation rate — which nobody has measured — does not confound the result.

**Precondition, checked before calibration and not counted as a run:** in a
scratch copy of each arm directory the `agent-config` binary resolves inside the
eval sandbox, `agent-config work --procedure <pilot>` hands out step 1 in arm C's
environment and refuses in arm B's. A precondition that fails stops the
programme; it is not worked around inside a run.

## Pilots

Two, per D16: `existing-ui-audit` (12 steps; 6 `check:` exits, 6 `judgement`) and
`project-analyzer` (10 steps; 1 `check:`, 6 `exists:`, 3 `judgement`).

**Exit classes are reported separately, never only pooled (D15).** A step whose
exit is `check:` corroborates its output against the repository and is
**verified**. A step whose exit is `exists:` or `judgement` is **sequenced**: the
cursor holds its position, but its exit proves that something was written, not
that it is right. Every metric below that is per-exit is reported per pilot and per
class.

## Corpus (6.2) — the frame; the admitted list is written after calibration

**Size, fixed, not a floor:** ten admitted tasks per pilot, twenty in all (D16
amended the original thirty). The workload is the spend ceiling's input (D13), so
the count does not grow to chase significance.

**Admission rule:** a candidate task is admitted only if arm A fails it — task
success false in at least two of three calibration runs. This is the condition the
skill-DAG lock sets for its own reopen, so both decisions speak one language.

**Regression to the mean, stated before it can be used as an excuse.** Selecting
on arm A failing biases a re-run of arm A upward. Two mitigations are frozen here:
calibration runs are never reused as measured runs (arm A is run again, fresh, in
the measurement), and the calibration pass rate of every candidate — admitted or
not — is published beside the result, so a reader can see how much of A's
measured failure is selection.

**Candidate pool:** fifteen per pilot. Each candidate is a fixture repository
committed under `tests/fixtures/procedure-cursor-eval/<id>/` together with its
deterministic success criterion before calibration starts; the criterion is part
of the frozen text and is not edited after the first calibration run.

Candidates for `existing-ui-audit`:

- **cand-ui-01** React + shadcn (`components.json` in the workspace), 14 primitives under `src/components/ui`. Success: every primitive is listed in `components` and `shadcn_inventory.primitives`.
- **cand-ui-02** Same tree with `components.json` at a nested workspace and none at the root. Success: `shadcn_inventory` describes the nested workspace, `component_root` names it.
- **cand-ui-03** Radix-only `package.json`, no `components.json`. Success: `design_system` is not `shadcn` and `shadcn_inventory` is `null`.
- **cand-ui-04** Atomic tiers `atoms/molecules/organisms`. Success: `component_taxonomy` is `atoms/molecules/organisms`.
- **cand-ui-05** Flat `components/` with no tiers. Success: `component_taxonomy` is `none`.
- **cand-ui-06** Tailwind config tokens only. Success: `design_tokens.colors` and `spacing` carry the config's named values, and no utility class string appears as a token.
- **cand-ui-07** CSS custom properties on `:root`. Success: every `--color-*` variable is under `design_tokens.colors`.
- **cand-ui-08** Vue single-file components. Success: every `.vue` component is in `components` with `kind` set.
- **cand-ui-09** Blade components and one layout. Success: Blade components listed; `greenfield` false.
- **cand-ui-10** One Blade layout, no components, no tokens, no design-system markers. Success: `greenfield` true and `greenfield_decision` set.
- **cand-ui-11** Next.js app router plus Storybook stories. Success: every component with a story is in `components`.
- **cand-ui-12** Monorepo `packages/ui` plus an app that imports it. Success: `component_root` is `packages/ui`.
- **cand-ui-13** Forms, tables and a modal in one feature folder. Success: each of the three appears under its `patterns` key.
- **cand-ui-14** Input names a "data table with filters"; two table components exist. Success: both are in `candidates`.
- **cand-ui-15** Pre-existing a11y lint config with three named violations. Success: `a11y_baseline` carries the three, and no key is written as `[]`.

Candidates for `project-analyzer`:

- **cand-pa-01** Laravel API with three models and two route files. Success: `models/` names the three models; `api/` lists every route file.
- **cand-pa-02** Express service with two routers and a queue worker. Success: `services/service-map.md` names the worker.
- **cand-pa-03** Next.js app with API routes. Success: `api/` lists every route handler.
- **cand-pa-04** Symfony app with Doctrine entities. Success: `models/` names every entity.
- **cand-pa-05** Composer library with no runtime. Success: the overview names the library's dependencies and no API surface is invented.
- **cand-pa-06** Node CLI tool. Success: the overview matches the manifests; `api/` states none.
- **cand-pa-07** Monorepo of two packages. Success: the module inventory names both packages.
- **cand-pa-08** Project with `AGENTS.md` that names a directory which does not exist. Success: the agent-docs audit names that directory.
- **cand-pa-09** Project with tests for two of four modules. Success: `testing/test-map.md` names the two untested modules.
- **cand-pa-10** Three business domains in separate folders. Success: `domains/` holds one file per domain.
- **cand-pa-11** Docker Compose with three services. Success: the infrastructure section names all three.
- **cand-pa-12** Laravel app with jobs, events and listeners. Success: the service map names each listener.
- **cand-pa-13** Project whose README contradicts `package.json` on the framework. Success: the gap analysis names the contradiction.
- **cand-pa-14** GraphQL schema plus resolvers. Success: `api/` lists every root type.
- **cand-pa-15** A repository with no manifest at all. Success: the overview says so rather than naming a framework.

If fewer than ten candidates of a pilot are admitted, that pilot's arm comparison
is **not run**, and the shortfall is the published finding for that pilot: the
monolith does not fail often enough on this pool to leave room for an effect. The
pool is not widened after calibration to reach ten, because a pool chosen after
seeing which candidates fail is a corpus chosen to produce one.

The admitted list is appended below the line `## Admitted corpus` as
`- **task-NN**` entries naming their candidate, in one commit, before the first
measured run. That commit changes nothing above that line.

## Metrics (6.3)

| Metric | Class | Definition | Source |
|---|---|---|---|
| exits_met | primary | Share of the pilot's non-`judgement` exits that hold on the run's final tree, reported per class (verified / sequenced) | a committed scorer applies the registered `check:` functions and `exists:` paths to the kept scaffold directory after the run |
| task_success | primary | The candidate's frozen success criterion holds on the final tree | the same scorer, one predicate per task |
| rounds | secondary | Assistant turns in the run trace, against the per-task baseline in `src/config/turnaround-budget.json` | the `--json` trace |
| tokens | secondary | Input, cache-read, cache-write and output tokens per run | the `--json` usage figures |
| wall_time | secondary | Seconds from run start to the final message | the `--json` timings |
| unreasoned_skips | secondary | Steps the run passed without a met exit, a recorded judgement or a recorded `skipped: <reason>`; target 0 in arm C | arm C: the procedure state file; arms A and B: the step table set against the trace (`tool_order`, `regex` graders) |
| entry_rate | secondary | Share of arm C runs that invoked `agent-config work --procedure` at least once | `regex` grader over the Bash trace |

**What the eval tool cannot grade, said here so it is not discovered later:** it has
no grader that runs a script or reads an exit code. A `check:` exit is therefore
graded by the committed scorer over the kept scaffold directory (`--keep-temp`),
never by an `llm` grader. No metric uses an `llm` grader, so no judge model is in
the loop and the implementer authors no verdict prompt (evaluator-independence).
The scorer and every per-task predicate are committed before calibration and run
unchanged on all three arms.

## Instrument and frozen settings (6.4)

Invocation, per arm and pilot:

```
claude plugin eval <arm-dir> --ablation none --runs 3 --model claude-sonnet-5-5 \
  --concurrency 1 --keep-temp --no-publish --trust-plugin \
  --max-cost-usd <the invocation's share below> --json <results-path>
```

**Transport, established 2026-10-19:** each run is a full `claude` child on the
operator's own credential. `claude auth status` on the operator's machine reports
`authMethod: claude.ai`, `subscriptionType: team` — a subscription transport, not a
metered API key. Whether runs past the plan's included usage are billed depends on
the organisation's extra-usage setting, which this repository cannot read; the
monetary maximum below is therefore computed at list API price as if every token
were billed, and is the figure the authorisation decides on.

**Host:** Claude Code 2.1.303. **Effort:** the host default for the pinned model.
**Per case:** `max_turns: 40`, `timeout_seconds: 1800`, `allowed_tools: [Read, Glob,
Grep, Write, Edit, Bash, Skill]`. **Concurrency 1**, so the programme never holds
more than one seat's worth of the shared rate limit.

runs_per_case: 3
model_pin: claude-sonnet-5-5 (list price $2 input, $10 output, $0.20 cache read, $2.50 cache write per million tokens)
retry_policy: none — a run that errors, times out or is rate-limited is scored as failed on every metric and counted as an infrastructure failure; above 10 % infrastructure failures in any arm the result is published as inconclusive, never re-run
max_tokens: 1,123,200,000 for the whole programme — 270 runs (90 calibration + 180 measured) × 40 turns × (100,000 input + 4,000 output) per turn
max_cost_usd: 2592 for the whole programme — 270 runs × $9.60 worst case (40 turns × $0.20 uncached input + 40 × $0.04 output); split as 864 for calibration and 576 per measured arm, each passed to `--max-cost-usd`
aggregation: per task, the success rate over its three runs; per arm, the mean over tasks; an arm difference is the paired mean difference over the same tasks with a 95 % percentile bootstrap interval (10,000 resamples over tasks, seed 20261019); pooled over both pilots for the decision, reported per pilot and per exit class

**Workload:** calibration 2 pilots × 15 candidates × 3 runs = 90 runs of arm A;
measurement 3 arms × 3 runs × 20 admitted tasks = 180 runs. The token figure is a
planning ceiling, not an enforced one — per-turn context is not capped by any
setting. The **enforced** bound is `--max-cost-usd`, which aborts an invocation
and reports partial results; a partial invocation is published as partial and is
not topped up. With prompt caching the expected spend is a fraction of the
maximum; the maximum is what is authorised.

## Decision rule (6.5) — frozen

The bar is D8's: **at least 20 percentage points of task success**, and **added
rounds no more than the pilot's step count** (12 and 10).

"X beats Y by the bar" means all three: the pooled paired difference in task
success is at least 20 points, its bootstrap interval lies wholly above zero, and
X's mean rounds exceed Y's by no more than the step count. "X ≈ Y" means the
interval includes zero.

| Outcome | Verdict value | What follows |
|---|---|---|
| B beats A by the bar, and C ≈ B | `split` | the split ships; the cursor stays opt-in and undocumented (D3) |
| C beats B by the bar | `cursor` | the cursor default for procedure skills is put to the council with the result |
| neither | `null` | an honest null; a pilot split stays only where its head shrank (4.4) |

When B beats A but C neither beats nor matches B (C below B with an interval
excluding zero), the value is `split` and the cursor's regression is published
beside it. When the two pilots disagree in sign, the pooled value stands and each
pilot's own estimate is printed next to it.

The verdict is written into `procedure-cursor-result.md` beside this file as a
single line naming one of the three values. Nothing is default-on before that line
exists, and a `null` is published with the same prominence as either positive
value (AC-7).

## What this file does not authorise

Running anything — calibration included. The figures above are frozen so they
cannot move to meet a result; they are not a budget approval. The authorisation of
the stated maximum is a separate decision, recorded beside this file.

## Admitted corpus

*Empty until calibration has run under an authorisation.*
