# Solution-minimalism — Phase 0 verification spikes

> Read-only evidence for the three Phase-0 spikes of
> [`road-to-solution-minimalism`](../../roadmaps/road-to-solution-minimalism.md).
> Measured 2026-08-02 against `origin/main` @ `8aaacb665`. Every claim below
> carries its own command or `file:line`; nothing is asserted from memory.

## S0.1 — Overlap sweep: 12 EXTEND / 2 NEW

Fourteen candidate clauses swept against `src/rules/`, `src/skills/`,
`docs/guidelines/` and `docs/contracts/`. The disjointness test was applied
literally: a clause is **NEW** only if it fires at a different decision point
than every existing statement **and** the existing statement is not merely a
weaker phrasing of the same obligation.

| # | Clause | Verdict | Colliding artefact (verbatim, ≤20 words) |
|---|---|---|---|
| R1 | need-to-exist | **EXTEND** | `src/rules/improve-before-implement.md:39` — "## Demand gate — should this exist? (build / defer)" |
| R2 | reuse-in-repo | **EXTEND** | `docs/guidelines/component-oriented-and-oop-development.md:25` — "**Reuse before you build** (every paradigm). Compose from units that already exist" |
| R3 | stdlib / framework | **EXTEND** | `src/rules/architecture.md:29` — "Use the framework's request-validation primitive (Laravel `FormRequest`, Symfony validator, Zod …)" |
| R4 | **native platform** | **NEW** | none — greps for `native platform`, `the OS already`, `runtime already`, `platform primitive` return only stack carve-outs |
| R5 | installed dependency | **EXTEND** | `src/skills/supply-chain-intake/SKILL.md:33` — "Procedure — intake gate (run in order before adding a dependency)" |
| R6 | smallest working form | **EXTEND** | `src/rules/minimal-safe-diff.md:21` — "THE DIFF CONTAINS THE SMALLEST CHANGE THAT SOLVES THE STATED PROBLEM." |
| R7 | shape axis | **EXTEND** | `docs/guidelines/code-clarity.md:69` — "**Less cognitive load.** Readers don't track an identifier whose…" |
| R8 | precedence table | **EXTEND** | `docs/contracts/rule-interactions.yml:16-18` — linted pairwise relations `overrides \| narrows \| defers_to \| restates \| gates \| complements` |
| R9 | Rule of Three | **EXTEND** | `docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md:26` — "**Three similar lines beat a premature abstraction.**" |
| R10 | known-constraints-only | **EXTEND** | `minimal-safe-diff-mechanics.md:30-33` — "**No speculative features.** Nothing beyond what was asked…" |
| R11 | reversibility | **EXTEND** | `src/skills/decision-record/SKILL.md:57-59` — "**Mental model 10 — Reversible vs irreversible.** Two-way doors get a one-page record…" |
| R12 | Hyrum's Law rationale | **EXTEND** | `src/rules/downstream-changes.md:92-97` — the public/internal split it would justify already exists |
| R13 | **second-system rewrite context** | **NEW** | the string "rewrite trigger" is taken at `minimal-safe-diff-mechanics.md:34` but means *mid-diff: your own diff is bloated* — a different decision point |
| R14 | profiler-gated optimization | **EXTEND** | `src/skills/performance/SKILL.md:26` — "Don't optimize prematurely — measure first." |

**Tally: 12 EXTEND / 2 NEW (86 % extend).** Per the roadmap's own rule — *"A
majority-extend outcome re-scopes Phase 1 into an edit of the colliding
artefacts"* — Phase 1 is re-scoped. The re-scope is dictated by the evidence,
not chosen.

Corroboration from the repo's own meta-gate:
`docs/guidelines/agent-infra/artifact-drafting-protocol-mechanics.md:73-97`
carries a "Complexity budget — the six questions before a new artefact", whose
own text (`:78`) reads *"adding a gate to enforce 'add less' would be the very
inflation it guards against"*. A new minimalism rule fails its questions 1
(Replaces?) and 2 (Overlaps?).

### Three latent contradictions the extension must settle

1. **Two vs three repetitions.** `component-oriented-and-oop-development.md:50`
   and `src/rules/architecture.md:43` both say **two** real repetitions before
   extracting; the borrowed Rule of Three says three.
2. **Fewest lines vs least cognitive load.** `docs/guidelines/code-clarity.md:67`
   sells a refactor with the payoff *"**Smaller diffs.** Two lines … become one"*
   — the keystroke axis the shape clause explicitly rejects.
3. **Profiler-gate vs a shipped pack floor.** `src/rules/scale-discipline.md:50-51`
   (R-A2 index-parity) *mandates* an index on every FK / WHERE column with no
   measurement required, and `:54-55` (R-A4) handles denormalisation by waiver.

### Routing-collision check — the gate the roadmap asked for does not exist

| Tool | Compares | Gates? |
|---|---|---|
| `src/scripts/audit_overlap.ts` | rule **descriptions** + path prefixes (Jaccard / keyword overlap) | no — report only |
| `src/scripts/audit_skill_overlap.ts` | skill **bodies** (cosine) | **yes**, `--strict`, same-pack ≥ 0.70 fails the build |
| `src/scripts/skill_overlap.ts` | description **+ triggers** — the only trigger-aware tool | no — and see below |
| `src/scripts/lint_rule_interactions.ts` | precedence relations, not overlap | yes |

**No linter compares `triggers:` frontmatter across `src/rules/*.md`.** A new
rule re-using `keyword: "refactor"` / `"rewrite"` / `"implement"` — already
carried by `minimal-safe-diff`, `improve-before-implement`,
`active-remediation`, `senior-engineering-discipline` — would be flagged by
nothing.

**Gate shipped with this change:** `tests/scripts/rule_trigger_collisions.test.ts`
— trigger-set Jaccard across `src/rules/*.md`, failing at ≥ 0.40 without a
capped, reasoned waiver, with a dead-scan floor and a mutation self-test that
proves the gate can fail. Measured baseline: 94 rules carry triggers, 50 pairs
share ≥ 1 trigger, worst pair 0.375 (`improve-before-implement` ×
`senior-engineering-discipline`, sharing `refactor|implement|migration`). The
threshold sits above the measured worst case — a ratchet, not a retro-fit.

**A subset check was built and removed.** "Rule A's whole trigger set is inside
rule B's" looks like the shape a redundant rule takes, and the first run flagged
that same pair: `improve-before-implement`'s three triggers are a strict subset
of `senior-engineering-discipline`'s. That is **not** a defect — both rules
should fire on those prompts, because their obligations are disjoint (a
pre-implementation demand gate vs. the invisible-controls checklist). The defect
the roadmap named is a duplicate *obligation*, and the obligation half is not
machine-checkable, so a subset gate can only see the harmless half. It was
dropped rather than waived: an allowlist entry would have been the gate tuned
around its own false positive.

**Side finding, dead-scan class.** `src/scripts/skill_overlap.ts:26` roots at
`.agent-src.uncondensed/skills` — a source container retired by ADR-051. Its
twin `audit_skill_overlap.ts:12-19` documents that exact defect for itself and
repaired it; this one still points at the dead root, so it scans nothing and
exits green. Recorded here, **not fixed in this roadmap** — it is a separate
defect on a separate tool (see the gates-that-can-fail class).

## S0.2 — Subagent rule-propagation probe

Two questions, in the roadmap's order.

### Q1 — Does the host expose a subagent-start event at all?

**YES.** Verified against the installed host binary, not the docs:

```bash
claude --version
# 2.1.220 (Claude Code)

P=/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
grep -a -c SubagentStart "$P"   # 25
grep -a -c SubagentStop  "$P"   # 49
```

The embedded event enum, extracted verbatim from the binary:

```
"PreToolUse","PostToolUse","PostToolUseFailure","PostToolBatch","Notification",
"UserPromptSubmit","UserPromptExpansion","SessionStart","SessionEnd","Stop",
"StopFailure","SubagentStart","SubagentStop","PreCompact","PostCompact",
"PermissionRequest","PermissionDenied","Setup","TeammateIdle","TaskCreated",
"TaskCompleted","Elicitation",…
```

`SubagentStart` is a first-class dispatch, with a context-injection payload —
the binary carries both an executor and a schema literal:

```
executeSubagentStartHooks
E.object({hookEventName:E.literal("SubagentStart"),additionalContext:E.string().optional()})
```

This **supersedes** finding 4 of
[`elder-ponytail-harvest-cut`](../../settings/contexts/elder-ponytail-harvest-cut.md)
("whether the host exposes such an event is itself unverified"). The other half
of that finding stands unchanged: `hooks/hooks.json` in this repo dispatches six
events and registers **no** `SubagentStart` / `SubagentStop` entry.

### Q2 — Do this package's rules reach a subagent's context today?

**YES.** Live probe, one subagent, tools forbidden so the answer could only come
from its own context. Transcript in
[`solution-minimalism-s02-subagent-probe.md`](solution-minimalism-s02-subagent-probe.md).

The subagent enumerated ~105 rule names unprompted and reproduced two Iron Laws
**verbatim** without reading a file — `minimal-safe-diff` ("THE DIFF CONTAINS THE
SMALLEST CHANGE THAT SOLVES THE STATED PROBLEM. …") and `commit-policy` ("NEVER
COMMIT. NEVER ASK ABOUT COMMITTING."). It also reported seeing the project
`CLAUDE.md` and the `dist/agent-src/rules/` projection.

### Verdict, and why the escape clause does not fire

The roadmap's escape clause reads: *if the event exists **and** rules do not
reach subagents, this leaves as its own change.* The event exists, but rules
**do** reach subagents — so there is no propagation gap, nothing to hand back,
and no `SubagentStart` hook is needed for F1 (projected rule text already
arrives in a subagent's context by the ordinary projection path).

One honest boundary: the probe proves propagation on **this** host at **this**
version (Claude Code 2.1.220, project + user instruction files). It says nothing
about other hosts, and nothing about *adherence* — only that the text is present.

## S0.3 — Harness feasibility + cost sheet

**Verdict: GO WITH CHANGES.** `internal/bench/ab` cannot run a pinned-public-repo
sweep today, but every gap has a named seam and none is architectural.

### What already works

- **Nine arms** with a real length-matched inert placebo —
  `src/scripts/bench_ab_v2_run.ts:108-118` (`ARMS`), `:127-143` (`placebo_prose`,
  constrained at `:124-126` to avoid priming vocabulary), `:861-863` (length-match
  to the RDP injection).
- **Two injection mechanisms**: plugin on/off via `--setting-sources project,local`
  (`bench_ab_task_runner.ts:60-70`, `:263-265`) and text via
  `--append-system-prompt-file` (`bench_ab_v2_run.ts:479-489`).
- **Headless execution** is Claude Code `--print --output-format json` through
  `spawnSync` (`bench_ab_task_runner.ts:243-275`); a second host (`codex exec`)
  exists with 4 legal arms.
- **Paired non-parametric stats**: McNemar exact on the binary capability axis,
  Wilcoxon signed-rank on the [0,1] discipline axis
  (`bench_ab_v2_stats.ts:13-15`, `:142`, `:172`), paired by `(task, seed)`.
- **Deterministic scorer, no LLM judge** (`_lib/bench_ab_scoring_v2.ts:12`).
- **Arm-isolation discipline learned the hard way** — `bench_ab_v2_run.ts:69-77`
  records that clones once lived inside the repo, so the `vanilla` arm inherited
  ~126k tokens of the package through project scope and *"invalidated every prior
  null"*. The fix is a `/tmp` path constant with **no runtime assertion behind it**.

### The five requirements, scored

| Requirement | State |
|---|---|
| Arm-isolated | **met** (by convention, unasserted) |
| Headless | **met** |
| Per-trial injection audit, both directions | **absent** |
| Pinned external repo | **absent** — `FIXTURES_ROOT` is `internal/bench/ab` (`:66`, `:214`); zero `git clone` / `sha` support |
| Cost sheet | **absent** — `internal/bench/pricing.yaml` is wired only to `bench_run.ts:64`, never to the A/B path |

The injection audit is the load-bearing gap. The only related field is
`injected_chars` (`:503`) — the `String.length` of a file the harness itself
wrote, which proves nothing about the model, and which is **0** for the
`package` arm because that arm arrives through global settings. If the plugin
were disabled or version-drifted mid-sweep, every treatment run would silently
degrade to `vanilla` and the report would look identical. Transcripts and the
`tokens_breakdown` split are both discarded (`:243-257`, `:496-504`), so the
audit cannot even be reconstructed post-hoc.

### Cost sheet

Price table: `internal/bench/pricing.yaml`, per 1M tokens, `sourced_on:
2026-05-14` — sonnet 3.00 in / 15.00 out / 3.75 cache-write / 0.30 cache-read;
haiku 0.25 / 1.25 / 0.30 / 0.03.

Observed totals per run (all four buckets summed) from stored reports under
`internal/bench/reports/ab-v2/`:

| Report | Model | vanilla mean | treatment mean |
|---|---|---|---|
| `2026-07-05T07-00-31Z` (30×3) | sonnet | 185,584 | 867,735 (`package`) |
| `2026-07-07T07-04-39Z` (30×3) | haiku-4-5 | 132,036 | 225,956 (`rules-kernel-dc`) |
| `2026-06-15T03-29-39Z` (6×6) | haiku-4-5 | 118,963 | 807,249 (`package`) |

**Working estimate, 30 tasks × 4 arms × 3 seeds on sonnet = 360 runs, mean
~500k tokens ≈ 180M tokens ≈ $150–250.** Treat it as a **floor**: a real OSS
repo raises per-run tokens (bigger context, more reads, longer test cycles).
The estimate carries a ~10× spread on the treatment arm because the v2 record
throws away the bucket split, and the four buckets differ in price by up to
125×. Closing that spread is delta #2 below and costs nothing.

Budget control today is `--max-budget-usd` **per run** (default 1.0,
`bench_ab_v2_run.ts:962`, applied at `bench_ab_task_runner.ts:252-255`). There
is **no sweep-level cap**: 30×4×3 at `--budget 3.5` has a $1,260 ceiling with
nothing to stop it.

### Deltas required before a paid run

| # | Delta | Size |
|---|---|---|
| 1 | Per-trial injection audit — assert the arm's expected footprint from `tokens_breakdown` before it is discarded; persist an `activation` verdict; hard-fail on violation. Shape to copy: `bench_ab_tracka_run.ts:120-134` `integrity_check`. | small |
| 2 | Preserve `tokens_breakdown` in the v2 record (one field). Unblocks #1 and #6. | small |
| 3 | Model-id verification — read the model back from the CLI envelope, refuse on mismatch, reject bare aliases (`"sonnet"` appears in a stored report). | small |
| 4 | Sweep-level `--max-usd` abort (pattern exists in `bench_quality_rerun.ts`). | small |
| 5 | Record the errored-pair drop count per arm-pair and per `status_bucket` — attrition is not missing-at-random; budget caps fire preferentially on the arm doing more work. | small |
| 6 | Cost sheet — wire `load_pricing` into `bench_ab_v2_stats.ts`, price the four buckets separately, re-source the 2026-05-14 prices. | medium |
| 7 | Preserve per-run workspaces + transcripts (key the work dir by `task\|arm\|seed`, not task alone) — prerequisite for offline re-scoring, and therefore for retro-fitting the complexity endpoint. | medium |
| 8 | A real `--selftest` — today's `--mode dry-run` returns at `:844-851` before the CLI check, the fixtures, the scorer, and the report writer. The injectable seams (`:767`, `:534`) already exist. | medium |
| 9 | Pinned-repo fixture source — `repo`/`sha` corpus keys, a branch in `reset_fixture` (`:213-222`), `repo+sha` in `checkpoint_key` (`:644-665`), build-artefact exclusions in the scorer, configurable 60s `_runShell` timeout. | medium |
| 10 | Task authoring against the target repo — ~30 hand-written capability/discipline oracles. The actual bulk of the work. | large |
| 11 | Cognitive/cyclomatic complexity endpoint — **nothing exists** (`grep -rniE "cognitive\|cyclomatic\|halstead" src/` finds no implementation; the only `cognitive:` hit is a hand-authored corpus stratum label). Needs a per-language analyser plus language-neutral aggregation. | large |

**Sequencing:** #1–#5 are cheap and are the difference between a publishable run
and an unpublishable one — they land before any spend. #9 and #10 ship together
(a harness pointed at a real repo with no oracles runs nothing). #11 is
separable but the roadmap's metric-pair acceptance criterion depends on it.

### Consequence for Phase 3

Phase 3 stays blocked on `benchmark-spend-authorization` (owner: user), and the
cost sheet above is what that authorization can now be granted against. Deltas
#10 and #11 mean the paid run is not one step behind the grant — it is a
harness-extension project of its own.
