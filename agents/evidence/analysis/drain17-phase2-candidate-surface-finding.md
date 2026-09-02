<!-- evidence-type: analysis -->

# Drain run 17 — the cheap-evaluator path is closed by a committed guard, not by a corpus choice

**Date:** 2026-09-02. **Branch:** `drain/gep-phase2-run`. **Zero metered calls
at the time of writing this section.**

## What was established

Drain 16 recorded three legs for why the frozen corpus cannot move the
pre-registered cheap evaluator. Its leg 1 ("Path") reads: *"A mutation to a
corpus member never reaches the catalogue."* That is true and it is **narrower
than the fact**.

The stronger fact, confirmed by reading two committed constants:

1. **The candidate surface is an allowlist of four heads.**
   `CANDIDATE_OWNED_PATHS = ['.claude', '.augment', 'AGENTS.md', 'CLAUDE.md']`
   (`src/scripts/_lib/candidate_record.ts:262`). A nested path is owned only
   when its head is `.claude` or `.augment` (`:285`).
   `assertMutationPathsOwned` (`:314`) throws `PathOwnershipError` on the first
   unowned path, and the error text states the reason: *"A candidate that writes
   a task-target file is not a harness variant — it is a different experiment,
   and the paired verdict would attribute its effect to the harness."*

2. **The pre-registered cheap evaluator reads outside that surface.**
   `loadCatalogue` (`src/scripts/description_route_check.ts:386`) reads
   `dist/agent-src/skills/<name>/SKILL.md` (`:398`) and
   `dist/agent-src/rules/*.md` (`:406`), and nothing else. `catalogueHash`
   (`:81`) folds `name` plus `description` only.

**Therefore:** no admissible candidate mutation — on the current corpus, or on
any re-cut corpus, in the repository or in a clone — can change
`description_route_check`'s catalogue. The `root` parameter (`:386`) means a
clone can have its own `dist/agent-src`, but a candidate may not write it.

## Why this matters to the open decision

Drain 16's option **2B** was *"re-cut the corpus onto a surface a cheap
evaluator measures"*. The drain-16 council refused it on the ground that it
*"changes the question from 'Are rule bodies stable?' to 'Are rule frontmatters
stable?'"*. The finding above refuses it on a stronger ground that was not
before that council: **there is no cheap-evaluator surface inside the candidate
surface at all.** 2B is not a worse experiment; it is unconstructible without
also amending `CANDIDATE_OWNED_PATHS`, which is the guard that keeps a candidate
from writing its own task target.

The pre-registered budget's own First cut names
*"3-5 deterministic candidate descriptions for `code-intelligence` activation,
evaluated against its existing 10-query evals/triggers.json"*
(`src/config/harness-evolution-budget.json`, `why_these_numbers.max_candidates`
and `max_spend_cents`). That subject exists
(`src/skills/code-intelligence/evals/triggers.json`, 10 queries) and its
projection is what `loadCatalogue` reads. So the pre-registration was internally
coherent — and it is incoherent with the *candidate-surface guard*, because a
candidate may not write `dist/agent-src/`. The incoherence is between the
pre-registered evaluation surface and a guard committed later, not between the
evaluator and the Phase-2 corpus alone.

Also: all three committed recipes rewrite a BODY
(`src/scripts/_lib/candidate_proposer.ts:166-189` — `keepLeadingBand`,
`appendRoutePointer`, `appendHonestEnforcement`), so no committed recipe
mutates a description even where one were permitted to.

## The 2A surface has no runner either — the gap is one layer up from where drain 16 left it

Drain 16 named the A/B bench as *"the one committed evaluator a rule-body
mutation COULD move"*, citing `bench_ab_clone --candidate-record`
(`src/scripts/bench_ab_clone.ts:449`). That citation is correct about the
**clone**. It is not a claim about a measurement, and the measurement does not
exist.

Traced this run:

- `bench_ab_clone` materialises a candidate clone at `clones/candidate-<id>`
  (`:319`, `:344`, `CANDIDATE_PREFIX` `:84`), and `--variant candidate` requires
  at least one `--candidate-record` (`:499-503`).
- Grepping every `src/scripts/*.ts` and `src/scripts/_lib/*.ts` for candidate-clone
  consumption returns exactly two modules: `bench_ab_clone.ts` (the producer) and
  `bench_ab_integrity.ts` (`CANDIDATE_PREFIX` `:65`), which asserts byte-wise that
  a candidate clone did not escape the surface. **Nothing runs a candidate clone
  as an arm.**
- The runner that could is `src/scripts/bench_ab_v2_run.ts`. Its arm table
  `ARMS` (`:160-172`) has eleven members — `vanilla`, `package`, `package-rdp`,
  `placebo`, `package-recursive`, `hardened`, `hardened-placebo`,
  `rules-kernel-dc`, `rules-balanced`, `package-ladder`, `bare-principle` — and
  **no `candidate`**. An `ArmSpec` carries `setting_sources` and `inject`; it has
  no field that can name a candidate record.
- The workspace it measures is built by `reset_fixture`
  (`src/scripts/_lib/bench_ab_workspace.ts:103-120`), which copies the pristine
  fixture tree into a per-`(task, arm, seed)` directory and **copies no
  agent-config surface at all**. The `package` arm's treatment is the REAL
  installed plugin reached through default `setting_sources`
  (`bench_ab_v2_run.ts:161`, and the arm comment at `:15-25`), not a `.claude/`
  directory inside the clone. So a candidate's mutated `.claude/rules/*.md`
  is not on the path the v2 bench measures.
- `bench_ab_size_claim.ts` — the tree's only live `decidePairedVerdict` caller —
  reads `direction_wins` / `direction_losses` off a **v2 paired report**
  (`directionVerdict`, `:96-105`), i.e. off `bench_ab_v2_stats` output. Its
  population is v2 task×seed pairs under the arms above.

**So 2A as adopted is not "expensive but available". It requires new apparatus:**
a `candidate` arm whose workspace carries the candidate surface and whose
`setting_sources` scopes the session onto it, plus the sweep. Building that arm
is an amendment to the measurement apparatus by construction — the same class of
change the drain-16 council ruled owner-reserved.

*Confirmed by reading source at this commit. Not established: what such an arm
would cost to run, because no arm of that shape exists to estimate from.*

## What a 2A sweep would actually cost, measured on the dry path

The v2 runner is scriptable and its host CLI is present here
(`which claude` → `/opt/homebrew/bin/claude`). Its dry mode prices the sweep by
shape (`bench_ab_v2_run.ts:1137-1144`):

```
$ ./scripts-run src/scripts/bench_ab_v2_run --mode dry-run --arms vanilla,package --seeds 1
bench_ab_v2: DRY — 34 tasks × 2 arms × 1 seeds = 68 runs (model=claude-sonnet-4-6, budget=1.0, sweep cap=none). No spend.
```

34 tasks is the committed v2 corpus (`internal/bench/corpora/ab-trackb-v2.yaml`,
34 `- id:` entries). A proposer comparison needs one arm per candidate on each
side — 5 deterministic + 5 metered, the corpus size being `max_candidates` 5 —
so **10 arms × 34 tasks × 1 seed = 340 live `claude --print` runs**, each a real
agent session on a fixture. There is a `--max-usd` sweep cap
(`:1129-1135`), a `--budget` per-run cap, and JSONL checkpoint/resume
(`:36-42`), so the sweep is interruptible rather than all-or-nothing.

The 340 figure is a **shape** computed from committed constants, not a spend
estimate: the pricing row is per-model and the actual token cost per run was not
measured this run. Drain 14's "about two cents" covered the *proposal* half only
and must not be read as this.

## The corpus identity, reproduced — and the one cheap body-sensitive evaluator has ZERO overlap with it

Generated the projection in this worktree (`task sync && task generate-tools`,
both exit 0, `101 rule(s) skipped` — the same figure drain 14 and drain 16
recorded) and captured the pin:

```
corpus_manifest: subject_digest=860eaf2dee7f35df · 5 subject(s) · 13 produced
projection mode: dual-layer/partitioned — host layer verified at 14.13.0
```

`860eaf2dee7f35df` is **byte-identical to drain 16's digest**, so the frozen
subject reconstructs independently on this branch. The 13 projected rules, and
the first five byte-wise — which IS the corpus per the protocol's enumeration
rule (`docs/contracts/metered-proposer-protocol.md:186-190`):

1. `augment-edit-discipline.md`
2. `domain-adoption-policy.md`
3. `framework-neutrality-in-generic-skills.md`
4. `low-impact-corpus-privacy-floor.md`
5. `no-roadmap-references.md`

**Track A is the one cheap, body-sensitive, candidate-surface evaluator in the
tree, and it cannot see any of them.** `bench_ab_tracka_run.ts` greps
`expected_keywords` inside an `expected_target` path *inside the target clone*,
with no model call (`internal/bench/corpora/ab-tracka.yaml` header, and
`taskfiles/bench-ab.yml:46-47`). Its 32 cases name 28 distinct targets — 14
under `.claude/rules/` and 14 skill files. The 14 rule targets are
`ask-when-uncertain`, `commit-conventions`, `commit-policy`,
`downstream-changes`, `language-and-tone`, `minimal-safe-diff`,
`no-cheap-questions`, `non-destructive-by-default`, `preservation-guard`,
`scope-control`, `security-sensitive-stop`, `think-before-action`,
`user-interaction`, `verify-before-complete`.

**Intersection with the corpus: empty.** `preservation-guard` is the only one of
the 14 that this projection produces at all, and it sorts **7th**, outside the
first five. The other 13 are withheld by the per-host partition because the
global layer carries their names, so Track A's presence check would fail for
them on this host irrespective of any mutation.

So `keepLeadingBand` — which deletes everything after the first `## ` heading and
would therefore move a keyword grep aimed below that line — has nothing to move:
no corpus member is a Track A target.

## The corpus/fixture relevance leg, VERIFIED and narrowed — peer review was right to flag it

A council peer-review pass marked the corpus/fixture mismatch
`needs-verification`, on the ground that it looked inferred from path names
rather than read. Read this run, and the flag was warranted: the finding
survives, but **not in the categorical form it was stated in.**

**The fixture, enumerated.** `internal/bench/ab/fixture/` is exactly seven
files: `README.md`, `package.json`, `tsconfig.json`, `src/cli.ts`,
`src/formatter.ts`, `src/parser.ts`, `tests/formatter.test.ts`. The v2 fixtures
are smaller still — `internal/bench/ab/fixtures-v2/capH-debug-01/` is three
files (`package.json`, `src/window.mjs`, `tests/solve.check.mjs`).

**The five corpus rules' path triggers, read from `src/rules/*.md` frontmatter:**

| Corpus member | `path_prefix` triggers | Matchable by a fixture path? |
|---|---|---|
| `augment-edit-discipline` | `.augment/`, `src/` | **YES — `src/`** |
| `domain-adoption-policy` | `src/skills/` | no |
| `framework-neutrality-in-generic-skills` | `src/skills/`, `src/rules/`, `src/agent-src/commands/` | no |
| `low-impact-corpus-privacy-floor` | `agents/decisions/low-impact-decisions`, `data/low-impact-decisions-seed` | no |
| `no-roadmap-references` | `agents/roadmaps/` | no |

**So the correction: four of five cannot activate on any fixture path, and the
fifth CAN.** `augment-edit-discipline` carries `path_prefix: "src/"`, and the
fixture has `src/cli.ts`. The categorical claim — "none of the five is reachable
from a task on that fixture" — is therefore **withdrawn**.

**What survives is a relevance claim, not an activation claim, and it is
weaker by construction.** `augment-edit-discipline`'s two Iron Laws are *"Files
inside `.augment/` and `src/` MUST stay project-agnostic — no project names,
domains, stacks"* and *"On any add / rename / delete of skill / rule / command /
guideline, update counts and cross-references in the same edit"*
(`.claude/rules/augment-edit-discipline.md:3-5`). Neither has any bearing on a
debugging task in a seven-file TypeScript demo that contains no skills, rules,
commands or guidelines. So the rule can activate and still contribute nothing a
scorer could move — which is a *plausibility* argument about effect size, not a
structural impossibility.

**Stated at the strength it has:** this leg is `weaker than legs 1-3`. Legs 1-3
are structural facts about committed code. This one is a judgement that a
mutation to one maintainer-workflow rule is unlikely to change a scored outcome
on a neutral fixture, and it would be refuted by a measured non-tie. It should
not be cited as a fifth blocker of the same kind, and the closure record says so.

## Two corrections from independent verification, and one adjacent gap

An independent pass was asked to rule each claim above TRUE / FALSE / NOT
ESTABLISHABLE without being told which were expected to hold. Two came back
narrowed, and both narrowings matter enough to state here rather than to absorb.

**Correction 1 — the v1 runner does NOT exclude the candidate surface. What
blocks a candidate clone is a variant allowlist, not a surface exclusion.**
`materialise_clone` layers `WITH_SURFACES` — the same four owned paths — into
the clone for `with`, `with-rdp` **and** `candidate`
(`bench_ab_clone.ts:220-234`, gated by `_layersSurface` at `:97-99`), and the v1
runner spawns with `cwd: cloneRoot` (`bench_ab_task_runner.ts:277-278`). So a
v1 session genuinely does run inside a workspace containing `.claude/` — that
presence-versus-absence **is** the v1 variable, and a runner that never saw the
four would have no treatment arm at all.

What actually makes a candidate clone unreachable from v1 is narrower and
stronger: `reset_clone` accepts only `['with','without','with-rdp','both','all']`
(`bench_ab_task_runner.ts:898`) — **`candidate` is not an accepted variant**, and
there is no flag that points the runner at an arbitrary clone directory. The
`:822-823` comment cited earlier (*"Fixture-only working dir, identical for
every arm"*) describes **one** v1 code path, which calls `reset_clone('without')`
for every arm and puts activation in an injected system prompt; it is not a
property of the v1 runner as a whole. Citing it as though it were was the error.

The v2 half is unchanged and is documented on its own terms:
`reset_fixture` copies a `fixtures-v2/<task>` tree under `os.tmpdir()`
(`_lib/bench_ab_workspace.ts:45`, `:103-120`) and none of the 33 fixtures carries
any of the four paths. The `CRITICAL (2026-06-15)` comment at
`bench_ab_v2_run.ts:81-88` gives the reason: a clone under the repository let the
`vanilla` arm inherit the package by walking up from `cwd` — measured 150k
in-repo against 24k in `/tmp` — which invalidated every prior null.

**Leg 1's conclusion is unaffected and better supported.** No runner measures a
candidate clone, and the reason is now a named allowlist rather than an inferred
surface exclusion.

**Correction 2 — the pre-registered spend ceiling would NOT abort a bench
sweep, because no bench runner checks it.** `assertWithinBudget` does throw
rather than truncate (`_lib/harness_evolution_guards.ts:140-150`; spend branch
`:148`), and the ceiling is 500 cents
(`src/config/harness-evolution-budget.json`). But its complete caller set in
`src/` is `evolution_lab.ts:666` (`verbPropose`), `evolution_lab.ts:749` (`run`),
`_lib/evaluation_cascade.ts:355`, and `llm_propose.ts:128` — **no
`bench_ab_*` runner appears.** Worse for the ceiling: `verbPropose` hardcodes
`estimatedSpendCents: 0` (`:656-664`), `llm_propose` hardcodes it too
(`:123-128`), and `run` reads it from an operator flag defaulting to zero
(`:747`). So the spend branch is unreachable on every committed call site unless
an operator volunteers a number above 500, and the only ceiling binding anything
today is `max_candidates`.

**So leg 4 must not be stated as "the guard aborts the sweep".** What is true —
and what the council itself identified as the decisive fact — is that **no
approved, powered plan fits the pre-registered ceiling**. The 1,700-6,800-session
shape stands; the `$47-$190` extrapolation stands as an order of magnitude and
as nothing more; and the enforcement that would have stopped an over-budget
bench sweep does not exist on that path.

**An adjacent gap, spotted and NOT fixed here** — recorded because it is a real
defect on the candidate path and this change is a roadmap disposition, not a
code fix. `clone_candidate` joins `record.id` straight into a path
(`bench_ab_clone.ts:332`), and `id` is validated only as a non-empty string
(`_lib/candidate_record.ts:464`, `:508`, `:582`). An id containing a path
separator or `..` would place the clone outside `CLONES`, where
`discover_candidate_clones` (`bench_ab_integrity.ts:179-190`, direct children
only) would not find it. Nothing executes there, so it does not weaken leg 1 —
but the mutation-path allowlist that guards the *contents* of a candidate clone
has no counterpart guarding *where the clone lands*. Surfaced rather than
patched, per `active-remediation`'s note-and-ask tier.

## One consequence of the park is UNRESOLVED and is escalated to the owner, not decided

Parking the roadmap takes `agents/roadmaps/` top level from two files to one — the
`status: carrier` roadmap, which cannot be removed. That reds one CI gate:

```
❌ check_requirements_trace: scanned 1, floor 2 — a gate inspecting this little cannot certify the corpus
❌ check_gate_coverage: 1 gate(s) failed the coverage floor.
```

`check_gate_coverage` runs in remote CI (`.github/workflows/consistency.yml:359`),
so this is a real red on the PR and not a local-only artefact. It was green
before the park at zero margin (scanned 2 == floor 2).

**The floor's own note in `src/config/gate-coverage.yml` predicts this red** and
calls it *"the gate firing on the drain WORKING"*; it has already been lowered
twice for exactly this reason (15 → 10 → 2, both on 2026-08-23). Its `Revisit-if`
anticipates the estate stabilising **above** 2 and forbids re-deriving the floor
**from the live count**. The estate stabilised **below** 2, which the clause does
not cover — a gap, recorded rather than read through.

**A third AI council of this run was asked and SPLIT 1-1 on authority, which is
an escalation condition rather than a verdict.** *2026-09-02, same two members,
1 round, standard depth, blind chairman, quorum 2/2 present — concluded,
subscription transport, `billable=0`, `$0.0000`. Two prior transport failures on
the same question (`exit_1`, `os_error: ENOBUFS`) returned 0/2 and are recorded
as failures rather than as refusals; the third attempt answered.*

- Both seats agree the technically correct move is **F1 — lower `min_scanned` to
  1**: the only signal this floor exists to catch is a moved or broken scan root,
  which reports **0**, and 0 < 1 preserves it intact. One seat accepted the
  derivation of 1 as an *invariant* rather than a live reading, because the sole
  remaining file is a carrier whose deletion `lint_carrier_integrity` reds on at
  zero tolerance with 38 broken destinations.
- They disagree on **who may do it.** One seat: within the delegation, "barely",
  because a coverage floor on a listing gate is threshold maintenance rather than
  removal of a protection — while explicitly flagging that the asymmetry is real
  and that a reading under which all floor adjustments are owner-reserved should
  stop. The other seat: **F5, owner-reserved, stop** — *"Reducing that floor
  weakens the gate's sole enforced threshold, regardless of whether the change is
  called recalibration"*, and this run's own earlier ruling already held that the
  delegation does not reach decisions that weaken a recorded floor.

**So the floor was NOT lowered.** A split council resolves to the conservative
side, and the restrictive seat's reasoning is the one that protects the owner:
an agent that lowers a check because a council was one vote short of forbidding
it is doing the thing the boundary exists to prevent. The three alternatives were
refused for reasons both seats supplied — F2 (unpark) reverses a 2/2 verdict of
this run and leaves a blocked roadmap in the active tree against an Iron Law; F3
(redefine the corpus) changes what the gate certifies rather than its threshold;
F4 (ship red without escalating) is knowingly shipping a red nobody was asked
about.

**What the owner is being asked for, in the restrictive seat's own terms** —
this is a narrow, four-line proposal and nothing broader:

1. Approve F1 and lower `check_requirements_trace`'s `min_scanned` from 2 to 1.
2. Record that 1 derives from the independently enforced carrier invariant and
   its 38 dependent references, not from today's file count.
3. Record the coupling: if carrier-integrity enforcement changes, that derivation
   must be revisited.
4. Amend the `Revisit-if` clause to cover stabilisation at any structurally
   justified minimum, including below 2.

Until that is answered the PR carries one red gate, and it is named here and in
the PR body rather than left for CI to announce.
