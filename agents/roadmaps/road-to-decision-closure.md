---
complexity: structural
status: draft
execution:
  mode: phase-checkpoints
owner: maintainer
depends:
  - road-to-typed-grants-that-persist
relates:
  - slug: road-to-typed-grants-that-persist
    relation: depends
    note: consumes the grant object and ADR-268 § 5's interrupt semantics
  - slug: road-to-adversarial-verification-and-long-runs
    relation: extends
    note: the recovery ladder there is the runtime twin of the ownership routing here
estate_growth_exempt: >-
  Second of the three receiver roadmaps ADR-260 § Consequences records as missing; it owns
  ADR-268 § 10's ownership axis, which neither sibling can hold without splitting the routing
  table from the grant model. Owner-recorded precedence, ADR-268 § 11, 2026-09-08.
estate_offset_exempt: >-
  Second of the same three-roadmap set. Offsetting it individually is not possible without
  splitting the set, and the set is the unit ADR-268 section 11 gives precedence to. The
  three-versus-one shape was argued in ADR-268 Alternatives: one file would separate no owner
  question from another and could not be reviewed.
design_validated: >-
  Owner rulings of 2026-09-08 transcribed in ADR-268 § 10 and §§ 5-7; the native-ask form
  directive of 2026-09-05.
capability_gap: none
---
# Road to decision closure

> **Status, 2026-10-01 — 17 of 22 landed, 5 open, three causes down to two, and the one
> cause that was a decision rather than a missing artefact is now decided.** Open: steps 3.1,
> 4.1 and 5.1, and acceptance criteria AC-5 and AC-6. Two causes remain and both are
> artefacts that do not exist: the kernel-write deny on `src/rules/ask-when-uncertain.md`
> (3.1, and AC-6's first clause), and the grant object that
> `road-to-typed-grants-that-persist` Phase 2 has not built (now 4.1's **and** 5.1's fixture
> `F8`). AC-5 and AC-6's first clause are transcript claims on top, so neither closes on a
> static probe alone.
>
> **Re-read 2026-10-04 — nothing closed, two readings moved, and a SECOND obstacle to the
> kernel paragraph is now measured.** All four blockers were re-read by executing their
> conditions against this tree at `30481f660` rather than by trusting their `Status:` lines,
> and the two that read `open` still do. Two readings moved. The ask census now reads **633**
> files under `src/domains`, `src/skills` and `src/agent-src/contexts`, not the 627 of
> 2026-10-01, and both of its measurable targets are still MET — the corpus grew and the
> targets held, which is the useful half of that number. And
> `road-to-typed-grants-that-persist`'s step 3.2 — the first clause of
> `interrupt-classes-owned-by-sibling`, and the step `DC-1` allocates the interrupt classes
> to — has gone from `[ ]` to `[~]`: deferred, and refused on the control it removes rather
> than merely unstarted. `DC-1`'s revisit condition was evaluated against that and does
> **not** fire. A deferral is neither a withdrawal nor a retargeting away from
> `user-interrupt-priority.md`, the step still names that file and still carries the three
> classes, and the row says in terms that sibling slowness is not a trigger. The allocation
> stands and 5.1's cause is unchanged.
>
> **The new fact is the preamble budget, and it changes what the kernel PR costs.** 3.1's
> remaining paragraph has been recorded throughout as blocked by one thing, the kernel-write
> deny. It is blocked by two. `check_preamble_payload_budget` prints
> `measured total 137017 tok ... ceiling 137017` and the verdict
> `zero net growth, design 107646`, so the preamble sits exactly at its ceiling with no
> headroom at all: a maintainer who lifts the deny and writes the paragraph reds that gate on
> the same PR unless the paragraph is offset by an equal reduction elsewhere in the preamble,
> or the ceiling is deliberately moved. That is not a new gate and not a new rule — it is the
> same gate whose +219 tok/spawn rejection of a four-line version 3.1 already records from
> 2026-09-13, read again now that the margin is zero. It is written onto 3.1 as a hand-over,
> with the anchor line and the exact paragraph, so the kernel PR is one decision rather than a
> re-derivation.
>
> **What the 2026-10-01 drain run changed.** The third cause — *this file's 5.1 is word-for-
> word the sibling's step 3.2* — was never a missing artefact. It was an undecided ownership
> question, parked as `blocker: interrupt-classes-owned-by-sibling` with the note that it is
> *"an ownership call and not an agent's to take"*. That reading predates this file's own
> Phase 0.1, which landed the ownership axis and routes a decision of exactly this shape —
> two valid allocations of one shared artefact, reversible, no product semantics, no typed op
> — to `contested-technical`, whose resolver is *independent agent → council, CLI-first →
> team*, and **not** the owner. The run therefore did what its own Phase 0 says to do with a
> `contested-technical`: it put the question to the council rather than to the owner. The
> council converged 2/2 and the blocker is **resolved** — see `## Decisions` row `DC-1`. The
> standing lock this does **not** touch is the 2026-09-10 one: *reopen when `typed-grants`
> closes*. Deciding who owns a rule file is not closing this roadmap around an unmet
> dependency, and 5.1 stays open.
>
> **5.1 was narrowed, not closed.** Both seats were explicit that *the sibling owns the three
> interrupt classes* does not make 5.1 done: the step also carries a mission-id linkage, the
> closed-decision survival clause and the recognised state-changing vocabulary, none of which
> the sibling's 3.2 delivers. 5.1 now states only what this file genuinely owns, its
> `blocked-by:` retargets from the resolved ownership blocker to `grant-object-undelivered`
> — the same missing object 4.1 waits on — and the scan still reads `open=0, blocked=3`.
>
> **What the 2026-09-30 run changed, and it was not a status flip.** Until then the causes were
> recorded only in prose, so `scanOpenSteps` read this file as `open=3, blocked=0` and the
> continuation ladder picked **3.1** as the next runnable step — the one whose write is
> denied at tool-call time. Every run that engaged it was guaranteed to stall. The three
> steps now carry the `<!-- blocked-by: … | asked: no — … -->` annotation the tooling already
> defines, each resolving to a blocker declared below, so the scan reads `open=0, blocked=3`
> and `decideLadderAction` returns `blocked` — ADR-235's terminal outcome for exhausted
> runnable work, which is what this file actually is. The boxes stay `- [ ]`: nothing was
> deferred, cancelled or closed, and the treatment is the one
> `road-to-typed-grants-that-persist` already received for the same condition.
>
> **The interrupt fixture is renamed `F8` because `F5` collides.**
> `tests/fixtures/decision-closure/F5-unfalsifiable-verify.md` already exists in the exact
> directory this file numbers its fixtures in, belongs to the archived
> `road-to-a-verify-clause-that-can-fail`, and is asserted by `tests/scripts/closure_scan.test.ts`
> — the same test file that asserts this roadmap's `F0`, `F1`, `F2` and `F4`. A reader
> checking whether this file's `F5` ships sees that file and can close 4.1 or 5.1 against the
> wrong fixture. Renaming the not-yet-written fixture costs nothing and removes the
> mis-resolve before it happens; renaming the existing file would touch a green test and
> another roadmap's artifact. `F6`, `F7` and `F8` are unreferenced anywhere in the tree.
>
> **The paragraphs below are the 2026-09-10 screening record.** They were written when the
> file stood at 0 of 22 and are kept because their reading of the dependency is still the live
> one — but they are no longer the status, and this paragraph is.
>
> **Screening record, 2026-09-10, by an owner-delegated drain run under a 2/2 convergent AI
> council verdict.** The file was screened for execution and left untouched, deliberately
> rather than by omission — 0 of 22 at that time, and no step started. Seventeen landed on
> 2026-09-13; this record is why none had landed before then.
>
> `depends: road-to-typed-grants-that-persist`, and that roadmap cannot complete: its Phase 1
> rewrites five kernel rules, `src/scripts/hooks/block_kernel_rule_writes.ts` denies those
> writes at tool-call time with no agent-accessible override, and the deny may retire only once
> `check_platform_anchor` reads compliant — which needs three repository-settings changes only
> a forge administrator can make. The measurement and the gate landed on PR #1984; the
> settings did not, because they cannot be a diff.
>
> **UPDATE 2026-09-13 — the anchor half of that dependency is discharged, and the blocker is
> NOT.** None of the three settings changes is still wanted: two were removed from the trust
> model by owner ruling and the third is covered by a dated owner waiver, so
> `check_platform_anchor` already reads `PASS_WITH_ACCEPTED_RISK` and exits 0. What remains
> between this file and execution is therefore smaller and differently shaped than the
> paragraph above: the kernel-write deny is still in force, its retirement was refused 2/2 in
> a round-2 review over the head-controlled enforcement path and needs its own council
> decision, and the reviewing council of 2026-09-13 added a reason not to lean on the anchor
> for it — a locally invoked control an administrator may skip, and both sides of whose
> comparison an administrator may edit, is not evidence of enforced compliance. Do not read
> "the anchor is green" as "the deny may retire".
>
> **This file's own local blocker is NOT the obstacle.** `adr-266-acceptance-closure` reads
> `resolved` and its condition re-verifies: `grep -m1 '^status:' docs/decisions/ADR-268-*.md`
> reads `accepted`. The dependency is the whole of it.
>
> **The four-part independence test is what decided which steps could run.** The council set
> it: a step qualifies only if it neither consumes nor assumes the grant object or its
> behaviour, its output stays valid under any compliant implementation of the dependency, its
> acceptance criterion can be evaluated now, and recording it cannot imply that dependent
> integration was validated. openai: *"No step should be presumed independent from the
> information supplied."* anthropic: *"the council cannot declare 'execute dependency-free
> steps' without naming which those are."*
>
> **On 2026-09-10 nobody had named any, so none were run.** On 2026-09-13 they were named step
> by step, and seventeen passed all four parts and landed. The five that remain each fail a
> named part — 4.1 consumes the grant object, 5.1 is the dependency's own step, and AC-5 and
> AC-6 cannot be evaluated now — which is the test applied rather than waived.
>
> **Nothing here was descoped.** Both seats refused the drain run's terminal descope rule for
> this file: closing it around an unmet dependency would misrepresent the estate. Reopen when
> `typed-grants` closes, not before.

> **Source:** `agents/tmp.old/inbox-2026-09-w/` — an inbox round carrying two challenge-me
> interviews with the owner plus three generations of consolidated proposals. Verified against
> `main@399beecab` on 2026-09-08.

> **Proposal, not adopted — but its authority is decided.** Consolidates the two providers'
> parallel plans for front-loading decisions. ADR-268 is **accepted**, owner-directed on
> 2026-09-08, so Phase 0 is not waiting on a decision.
>
> **ADR-268 § 10 is the ruling this file implements, and § 0 is the outcome it serves.**
> `critical-technical` leaving the owner lock is the point, not a side effect: a technical
> decision does not become owner-owned because it is hard. A council may make this routing
> stricter — more independence, provider diversity where it was optional — and may not route a
> technical class back to the owner, which § 0's table names as a break rather than a
> narrowing.

## Goal

Every roadmap enters execution as an **execution contract**: every foreseeable decision
closed, the closing done council-first, the owner reached only for product, business, taste
or destructive residue, one host-native question at a time, and the answers written into the
roadmap so a twelve-hour run never meets a question that planning could have closed. When no
owner-owned residue remains, closure completes with zero owner interaction.

## Reproduced, on this tree at `399beecab`

| ID | Fact | Where |
|---|---|---|
| D1 | `planning.challenge_on_create` is read by three entrances only | `roadmap/create`, `feature/plan`, `feature/roadmap` command files |
| D2 | `implement-ticket`, `jira-ticket`, `roadmap/materialize` and `analyze/roadmap-repos` contain no closure step; `analyze/inbox` mentions challenge once | grep over `src/domains/**/command.md` |
| D3 | The gate fires at the **start** of planning as a seed-confidence check, not at the end as a plan-closure check | `roadmap/create` and `contexts/execution/plan-confidence-gate.md` |
| D4 | `/challenge-me` writes no file by design; the pitch routes forward into create with no reverse edge | `challenge-me/command.md`; `challenge-me/vision/command.md` |
| D5 | Council routing is agent-carried — no TypeScript path reads `decision_resolution.classes[*]`; `high_impact` and `user_required` are locked to the user | `docs/contracts/ai-council-config.md` § decision_resolution |
| D6 | The council offer at roadmap creation is verbosity-gated and suppressed when `personal.autonomy: on`, on the stated ground that it is billable — stale, because the council resolves CLI-first | `roadmap/create/command.md`; `src/scripts/ai_council/config.ts` |
| D7 | No host-native ask primitive is referenced anywhere in the tree; asks are numbered text blocks, one question per turn | `grep -rn AskUserQuestion src` returns 0; `src/rules/ask-when-uncertain.md` § Iron Law |
| D8 | `blocked-by:` markers park judgement calls in files; `roadmap/next` already separates a human ACTION from a judgement call | `process-full` § blocked terminal; `roadmap/next/command.md` |
| D9 | No `produces_roadmap` command metadata exists | `grep -rn produces_roadmap src` returns 0 |
| D10 | Team mode exists — the `ai_team` settings key, `/team:delegate`, `/team:adversarial`, `/team:review` — and sits on no routing path | `src/domains/meta/team/` |
| D11 | The council is configured with two enabled members and resolves user-global, never from the project tree | `agent-config council:status`; ADR-104 |

## What this roadmap is NOT

- **Not a rewrite of `/challenge-me vision`.** Its interview loop is the engine this reuses.
- **Not a TypeScript decision dispatcher.** D5 is a documented choice; a lint over the table
  is the whole mechanism.
- **Not a new top-level command.** `/challenge-me closure` is a cluster sub-command (ADR-041).
- **Not the grant model.** That is `road-to-typed-grants-that-persist`.

## Phase 0 — Ownership replaces impact

- [x] **0.1 Rewrite `decision_resolution`'s axis.** The classes gain content and the axis
      changes from impact to ownership:

      | Class | Examples | Resolver |
      |---|---|---|
      | `deterministic` | naming from convention, file placement, generated artefacts, commit split | agent |
      | `reversible-technical` | a pattern inside the stated convention, refactor shape, test organisation | agent |
      | `contested-technical` | two valid architectures, a dependency trade-off, migration design | independent agent → council, CLI-first → team |
      | `critical-technical` | security-sensitive design, authority implementation, compatibility risk | provider-diverse council; owner only where a typed op or an owner-reserved dimension is touched |
      | `product-owned` | two valid user-visible semantics, UX with no source of truth | owner, native ask, carrying the council's proposal |
      | `business-owned` | a deadline, a policy, a taste only the owner holds | owner |
      | `destructive-owned` | ADR-260's eleven-op vocabulary | owner, naming the exact object |
      | `spend-exhaustion` | a required API fallback over the configured ceiling | pause and report, never a question |

      The schema loader's Iron Law is rewritten so the **owner-owned** classes are locked to
      the owner and `critical-technical` is not.
      verify: the loader's rejection test is updated, and a new `lint_decision_classes`
      accepts only these eight names in a `## Decisions` block.
- [x] **0.2 Delete the council offer and its autonomy suppression.** Under a mission the
      council is a step, not an offer, and the billable premise behind the suppression is
      false since the transport resolved CLI-first.
      verify: `grep -c 'suppress when personal.autonomy' src/domains/product-basic/roadmap/create/command.md`
      returns 0, and `agent-config council:status` is what the command consults.

## Phase 1 — Closure at every producer, mechanically

- [x] **1.1 A `/challenge-me closure` sub-command.** Input is a roadmap path. The detector is
      `lint_roadmap_complexity`'s prose checks plus a scan for `TBD`, *decide later*, unpicked
      alternatives, unchecked assumptions, missing verify lines, ambiguous acceptance criteria,
      a missing target branch, contradictory requirements, product semantics with several
      valid outcomes, and an unresolved typed-op need. Merge intent is raised only if the
      owner already discussed merge; PR topology is never asked about. Resolution order per
      question: evidence → convention, ADR or contract → agent, if reversible → independent
      session → council → team → owner, only if owner-owned.
      verify: fixture `F1` — twelve seeded technical ambiguities produce zero owner questions
      and twelve rows in `## Decisions`.
- [x] **1.2 `produces_roadmap: true` replaces the hard-coded entrance list.** The key is added
      to `roadmap/create`, `feature/plan`, `feature/roadmap`, `roadmap/materialize`,
      `implement-ticket`, `jira-ticket`, the Linear derivation, `analyze/inbox` and
      `analyze/roadmap-repos`. A new `lint_roadmap_producers` reds a producer that does not end
      in closure. `planning.challenge_on_create` becomes `planning.closure_pass`, default
      `true`, with the old key accepted for one minor.
      verify: `grep -rl 'produces_roadmap: true' src/domains | wc -l` returns **8**, and
      removing the closure step from any one of them reds the new lint.
      **Corrected on landing, 2026-09-13: the count is 8, not 9.** "The Linear derivation"
      names no command in this tree — `grep -rn -i linear src/domains` returns ticket-system
      vocabulary in `refine-ticket`, `estimate-ticket` and `roadmap/materialize`, plus the
      `build_linear_digest` build script, and no roadmap-producing command. The eight that
      exist all carry the key and all end in closure; the ninth was a miscount at authoring
      time, not a producer this step failed to reach.
- [x] **1.3 Keep the bypass, and count it.** An explicit *just write it* still drops closure,
      is recorded, and is never inferred from a mission grant.
      verify: the ask census reports bypasses as their own axis rather than as absent closures.

## Phase 2 — The roadmap decisions contract

- [x] **2.1 A `## Decisions` section, mandatory at `status: ready`.** Columns: ID, ownership,
      resolved by, decision, evidence, revisit if. `resolved_by` is one of `evidence`, `agent`,
      `independent:<session or model>`, `council:<record>`, `team:<record>`, `owner`. Execution
      reads it before any step, and a closed decision is re-asked only when its `revisit_if`
      condition became true.
      verify: a `ready` fixture roadmap with an unresolved technical marker is red; the same
      roadmap with the marker resolved into `## Decisions` is green.
- [x] **2.2 Council and team records live where council records already live.** Under
      `agents/evidence/analysis/`, in the existing shape — question, evidence, member
      positions, convergence, verdict, confidence, revisit condition. The council output
      contract loses any mandatory owner-facing options block after a conclusive technical
      verdict.
      verify: fixture `F3` — a conclusive technical verdict produces a record with no
      owner-facing options block, and a non-convergent one still produces the proposal the
      owner confirms.
      **Corrected on landing, 2026-09-13: council records do NOT live under
      `agents/evidence/analysis/`.** They are written to `agents/runtime/council/{questions,
      responses,sessions}/`, which is gitignored and auto-pruned after
      `ai_council.session_retention_days`; `agents/evidence/analysis/` is the INPUT side that
      `/council analysis` reads. The durable record is the convergence inlined into the
      artefact the decision serves, with date and members — citing the scratch path from a
      stable artefact is forbidden by `no-roadmap-references`. Team records now follow exactly
      that, which is what "where council records already live" was reaching for.
- [x] **2.3 Retire `blocked-by:` for judgement calls.** `BLOCKED` is reached only per ADR-268
      § 7; a judgement call routes back through closure instead of parking in a file.
      verify: `grep -rc 'blocked-by:' agents/roadmaps/*.md` shows no marker whose body is a
      judgement call rather than a human ACTION.

## Phase 3 — Host-native, one at a time

- [ ] <!-- blocked-by: kernel-write-deny-ask-when-uncertain | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the deny was reproduced at tool-call time on this tree and only a maintainer can lift it --> **3.1 Asks use the host's own primitive where one exists.** `user-interaction.md` and
      `ask-when-uncertain.md` name the native tool per host — Claude Code's `AskUserQuestion`,
      and the equivalent elsewhere — with the numbered text block as the fallback. Iron Law 1's
      recommendation becomes the native default option; each ask carries the agent's or the
      council's recommendation and what changes by answer; the answer is written to
      `## Decisions` immediately.
      verify: fixture `F2` — on Claude Code, exactly one native ask is emitted for two valid
      product semantics, and its answer appears in `## Decisions` before the next step runs.
      **NOT LANDED — externally impossible for an agent, 2026-09-13. Kernel guard.**
      The step requires an edit to `src/rules/ask-when-uncertain.md`, which is one of the nine
      kernel rules (`src/scripts/_lib/kernel_rules.ts` `KERNEL_RULE_IDS`). The
      `block-kernel-rule-writes` PreToolUse guard denies every Write/Edit whose target is a
      kernel rule file, in `src/rules/` and in every projection, and its only legitimate
      bypass is a human-owned exception registry. `--no-verify` and a `core.hooksPath`
      override are separately denied by `block-no-verify` and are not bypasses.
      **What DID land, in this PR:** the non-kernel half of the contract — the ask uses the
      host's native primitive where one exists, the numbered text block is the named
      fallback, the recommendation becomes the native default option and stays single-source,
      each option carries what changes by answering it, and the answer is recorded before the
      next step runs. It lives in `user-interaction-mechanics.md`, the context
      `user-interaction.md` already loads, and **not** as prose in the rule: that rule is
      re-written into the preamble on every subagent spawn, and
      `check_preamble_payload_budget` rejected the four-line version at +219 tok/spawn. The
      rule needed no new obligation — Iron Law 1 governs the recommendation identically on
      both ask shapes — only a contract to point at, which its § Mechanics already does. The `ask: native | text` manifest
      row 3.2 landed is what that contract reads. Fixture `F2` ships and is asserted:
      `tests/fixtures/decision-closure/F2-product-semantics.md` produces exactly one
      owner question, against F1's zero for twelve technical ambiguities.
      **What remains:** one paragraph in `ask-when-uncertain.md` naming the native tool per
      host alongside its Iron Law, which a maintainer must write.
      **Re-verified 2026-09-14 by reproduction, not by reading this note.** The `Edit` was
      attempted with the paragraph in it and denied at tool-call time —
      `block-kernel-rule-writes: BLOCKED — kernel rule ask-when-uncertain is immutable`.
      `check_envelope` was then probed across every write shape an agent holds — in-place
      `sed`, redirection, `tee`, `mv`-into-place, and the `.claude/rules/` and
      `dist/agent-src/rules/` projections — and all deny, while a plain read is allowed, which
      is what makes the probe sensitive rather than uniformly red. The cause has not dissolved
      and the step stays open.
      **Re-verified 2026-09-30, third reproduction, by executing the guard rather than reading
      this note.** `block_kernel_rule_writes.ts` was fed an `Edit` envelope targeting
      `src/rules/ask-when-uncertain.md` and returned
      `BLOCKED — kernel rule ask-when-uncertain is immutable — tighten-only via the override
      exception registry`. `ask-when-uncertain` is still in `KERNEL_RULE_IDS`
      (`src/scripts/_lib/kernel_rules.ts`), and the guard's own header states the position
      plainly: *"The human-owned exception registry named in the denial message is the only
      LEGITIMATE bypass; it is not the only reachable one."* Reachable-but-illegitimate paths
      are not an agent option, so this is external impossibility and not a role excuse. The
      sibling's `kernel-guard-first-crossing` blocker also still reads `Status: open`. The step
      now carries the `blocked-by:` annotation so the continuation ladder stops picking it.
      **Evidence (2026-10-01).** Fourth reproduction, by executing the guard rather than
      reading the three notes above. An `Edit` envelope naming `src/rules/ask-when-uncertain.md`
      was piped to `src/scripts/hooks/block_kernel_rule_writes`, which exited **1** with
      `block-kernel-rule-writes: BLOCKED — kernel rule ask-when-uncertain is immutable —
      tighten-only via the override exception registry`, followed by its own statement that
      *"Legitimate change requires a human action outside the agent session"* and the two routes
      it names: the override exception registry, or removing the `block-kernel-rule-writes`
      entry from `src/scripts/hook_manifest.yaml`. Both are maintainer acts, and the second is
      a safety-floor removal an agent may not apply on its own initiative, so it is not a
      drain-run alternative either. `ask-when-uncertain` is still one of the nine
      `KERNEL_RULE_IDS` (`src/scripts/_lib/kernel_rules.ts`). The blocker's SECOND resolution
      clause was checked too, and it also fails:
      `grep -niE 'AskUserQuestion|native|primitive' src/rules/ask-when-uncertain.md` returns
      nothing, so the paragraph naming the per-host primitive does not exist. Both clauses
      negative; the cause has not dissolved and the step stays open.
      **Evidence (2026-10-04). Fifth reproduction, and the hand-over a maintainer needs.** The
      guard was executed again rather than read. An `Edit` envelope naming
      `src/rules/ask-when-uncertain.md` piped to `src/scripts/hooks/block_kernel_rule_writes`
      exited **1** with `block-kernel-rule-writes: BLOCKED - kernel rule ask-when-uncertain is
      immutable - tighten-only via the override exception registry`, followed by its own
      sentence that *"Legitimate change requires a human action outside the agent session"*.
      The second clause was checked on this run too and also still fails:
      `grep -niE 'AskUserQuestion|native|primitive' src/rules/ask-when-uncertain.md` returns
      nothing. `ask-when-uncertain` is still a member of `KERNEL_RULE_IDS`, at line 19 of
      `src/scripts/_lib/kernel_rules.ts`. Both clauses negative for the fifth time.
      **Hand-over, part 1 - where the paragraph goes.** Anchor file
      `src/rules/ask-when-uncertain.md`, section `## How to ask`, immediately after line 39,
      whose full text today is ``Numbered options (per [`user-interaction`](user-interaction.md)). Short.``
      The paragraph below discharges BOTH of the blocker's resolution clauses at once: it names
      the per-host primitive, and it makes
      `grep -niE 'AskUserQuestion|native|primitive' src/rules/ask-when-uncertain.md` non-empty.
      Verbatim, to be inserted as a new paragraph after that line:

~~~markdown
**Native where the host has one.** `hooks:status` prints `ask -> native` or `ask -> text` for
the running host. On `native` the question goes through the host's structured-ask primitive
with the recommendation as its default option; `text` is the numbered-block fallback and says
so. One question per turn on either shape - the Iron Law above does not change with the form.
~~~

      **Hand-over, part 2 - the budget, measured on this run and not previously recorded here.**
      Lifting the deny is necessary and NOT sufficient.
      `./scripts-run src/scripts/check_preamble_payload_budget --as-of 2026-10-04T00:00:00Z`
      reports `project-scope rules 121426 tok`, `measured total 137017 tok (baseline 102520,
      +34497; ceiling 137017)` and the verdict `ceiling 137017 tok = base 137017 - zero net
      growth, design 107646`. The ceiling is `max(design, payload at base ref)` and is measured
      at the base ref, so there is no per-PR headroom: any net addition to a project-scope rule
      reds the gate. The paragraph above is roughly 300 characters, about 75 tok/spawn by the
      gate's own chars/4 accounting, so the kernel PR must offset it with an equal reduction
      in the preamble, or move the ceiling deliberately. This reading is taken from the
      gate's printed verdict. The sensitivity probe that would have confirmed it by inflating a
      rule file and watching the gate go red was NOT run on this session: editing a rule file is
      itself refused here, which is the same class of refusal as the kernel deny and is recorded
      rather than worked around. The 2026-09-13 rejection at +219 tok/spawn noted above is that
      same gate observed empirically when there was still margin to reject against, and it
      agrees with this reading.
- [x] **3.2 The host manifest records which shape each host has.** `hook_manifest.yaml` host
      rows gain `ask: native | text`, and `hooks:status` prints it.
      verify: `agent-config hooks:status` prints the ask shape for the current host.
- [x] **3.3 Residue is asked now, not filed.** A closure that ends with owner-owned residue
      asks immediately, one question per turn, and records the answer. Never *the four
      questions are in file X*.
      verify: no closure run produces a roadmap whose open questions exist only as prose.

## Phase 4 — Mid-run residue

- [ ] <!-- blocked-by: grant-object-undelivered | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the missing object is another roadmap's deliverable and no owner decision is pending on it --> **4.1 The same table governs mid-run.** Technical residue resolves inline through agent,
      independent session, council or team and is appended to `## Decisions` with the step id.
      Owner-owned residue triggers a native ask only if the step cannot progress; otherwise the
      step is parked, independent phases continue, and the run returns to it. Mission-level
      `BLOCKED` only per ADR-268 § 7.
      verify: fixture `F4` — a mid-run architecture choice resolves without an ask; fixture
      `F8` — an interrupt leaves the grant and every closed decision intact.
      **NOT LANDED — half of it is the sibling roadmap's, 2026-09-13.** `F4` ships and is
      asserted (`tests/fixtures/decision-closure/F4-midrun-architecture-choice.md`: one
      finding, `contested-technical`, zero owner questions), and the mid-run ownership table
      landed in `roadmap-process-loop.md` § 5a-residue — technical residue resolves inline and
      is appended to `## Decisions` with the step id, owner-owned residue asks only when the
      step cannot progress and otherwise parks while independent phases continue, and `[~]` is
      forbidden for a parked step.
      `F8` cannot be written here. It asserts *the grant* survives an interrupt, and the grant
      object is `road-to-typed-grants-that-persist`'s — ADR-260's
      `{op, target, scope, granted_by, span, expires}`, built by that roadmap's Phase 2 and
      given `expires` / `revoked_by` by its 3.1. Neither exists in the tree. Writing `F8`
      against an object that does not exist would assert nothing; writing the object here
      would be implementing the sibling roadmap.
      **Re-verified 2026-09-14:** the sibling's 2.1, 2.2 and 3.1 all still read `[ ]`, and
      `grep -rln granted_by src tests` returns nothing — the identifier exists only in
      ADR-260, ADR-266 and ADR-268, as a specification. The cause has not dissolved.
      **Re-verified 2026-09-30, third reproduction.** `grep -rln granted_by src tests` still
      returns nothing, and the sibling's 2.1, 2.2 and 3.1 still read `[ ]` at
      `origin/main@4429b1d3d` — which is today's head, so this is a reading of the current
      tree and not of a stale checkout. The fixture is also **renamed `F5` → `F8`** in this
      run: the `F5-` slot in `tests/fixtures/decision-closure/` is already held by
      `F5-unfalsifiable-verify.md`, an archived roadmap's fixture asserted by the same
      `closure_scan.test.ts` that asserts this file's `F0`/`F1`/`F2`/`F4`. The collision was a
      live mis-close hazard — `ls` on that directory shows an `F5-*` and says nothing about
      whose it is. Nothing else about the step changed; the cause has not dissolved.
      **Evidence (2026-10-01).** Fourth reproduction, executed rather than read.
      `grep -rln granted_by src tests` exits **1** with no output at `9f2b9fb4a`, which is
      today's head of `origin/main`, so the grant object still exists only as an ADR
      specification. The sibling's 2.1, 2.2 and 3.1 all still read `[ ]` in
      `agents/roadmaps/road-to-typed-grants-that-persist.md`. One thing DID change and it is
      recorded because it widens the blocker rather than narrowing it: `F8` is now **two**
      steps' fixture, not one. The 2026-10-01 council disposition (`## Decisions` row `DC-1`)
      moved 5.1's three interrupt classes to the sibling and left 5.1 verifying `F8`, so
      `grant-object-undelivered` now blocks 4.1 and 5.1 alike. The cause has not dissolved.
- [x] **4.2 The ask census gains four axes.** `phase` (planning, execution, delivery),
      `ownership`, `avoidable`, `resolver_attempted`. Targets: zero technical owner asks in
      execution; zero commit, push, CI or conflict asks; zero repeats of an already-answered
      question.
      verify: `ask_block_census` reports the targets met, or names the rows that miss them.
      **Corrected on landing, 2026-09-13: two of the three targets are measurable here, and
      the third is not.** This census reads AUTHORED surfaces, not transcripts — a *repeat of
      an already-answered question* is a property of a transcript, so it is reported
      `NOT MEASURED` rather than as zero, on exactly the ground the native-ask rate is carried
      in through `--native-asks` rather than computed. Measured on this tree: zero technical
      owner asks in execution (MET), zero commit / push / CI / conflict asks (MET). Both
      targets are shown to be able to MISS by their own sensitivity tests — a target that
      cannot miss is not a measurement.

## Phase 5 — Interrupts

- [ ] <!-- blocked-by: grant-object-undelivered | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question; the missing object is another roadmap's deliverable and no owner decision is pending on it --> **5.1 Closure records the mission id, and what closure owns survives an interrupt.**
      Closure writes the mission id; the three interrupt classes that read it are the
      sibling's (`DC-1`, below) and are NOT specified here. What this step owns is the
      closure-side half: a closed decision and the delivery target survive an interrupt, and
      the recognised state-changing vocabulary includes the owner's own — *stop*, *abort*,
      *nicht weiter*, *stattdessen*, *ersetze die Roadmap*. <!-- md-language-check: ignore -->
      verify: fixture `F8` — the side task completes, the mission resumes with the closed
      decisions intact, and no *continue?* question is emitted.
      **Narrowed, not closed, 2026-10-01.** The clause *"a clarification is incorporated; a
      side task is paused, executed and auto-resumed; only stop, replace or revoke changes
      mission state"* was removed from this step and is now solely
      `road-to-typed-grants-that-persist`'s 3.2 — see `## Decisions` row `DC-1`. Both council
      seats were explicit that the transfer does NOT make this step done: openai recorded that
      *"step 5.1 also says closure records a mission ID, the interrupt rule reads it, and
      enumerates recognized state-changing language… Marking it `[x]` is justified only after
      every remaining clause in that step is satisfied."* Those clauses stay here, and `F8`
      stays this file's fixture. The step's `blocked-by:` therefore retargets from the now-
      resolved `interrupt-classes-owned-by-sibling` to `grant-object-undelivered`, which is
      the real remaining cause: `F8` asserts an interrupt leaves the mission intact, and the
      mission id lives on the grant object `road-to-typed-grants-that-persist` Phase 2 has not
      built. `grep -rln granted_by src tests` returns nothing at `9f2b9fb4a`.
      *The four paragraphs that follow are the 2026-09-13 → -30 record, kept in the order they
      were written and closed by the 2026-10-01 note at the end. They are history, not the
      disposition; the paragraph above is.*
      **NOT LANDED — this step IS the sibling roadmap's step 3.2, 2026-09-13.** That step
      reads: *"`user-interrupt-priority.md` gains three interrupt classes. A clarification is
      incorporated and the run continues; a side task pauses the mission and the mission
      auto-resumes; only stop, replace or revoke changes mission state. An interrupt never
      revokes a grant, a delivery target or a closed decision."* — the same rule file, the
      same three classes, the same fixture. Landing it here would be implementing
      `road-to-typed-grants-that-persist`, and doing it in both places would leave two owners
      for one rule. The half this roadmap genuinely owns — that a **closed decision** survives
      an interrupt — landed in `roadmap-process-loop.md` § 3-0: the table is read before the
      first step and a row reopens only when its `revisit if` condition became true, never
      because a context reset lost it. The mission id and the grant are the sibling's.
      **Re-verified 2026-09-14:** the sibling's 3.2 still reads `[ ]` and
      `src/rules/user-interrupt-priority.md` still carries none of the three classes, so the
      two-owners hazard is live rather than historical. The cause has not dissolved.
      **Re-verified 2026-09-30, third reproduction.** The sibling's 3.2 still reads `[ ]` at
      today's head and `src/rules/user-interrupt-priority.md` still carries none of the three
      classes. Note the asymmetry with 3.1, because it is the reason this step is `blocked`
      rather than merely unstarted: `user-interrupt-priority.md` is **not** a kernel rule, so
      no guard denies the write and the agent is technically capable of landing this step. It
      is held by ownership, not capability — the same rule file, the same three classes and
      the same fixture are the sibling's step 3.2, and writing them here would give one rule
      two owners, which is the defect the step's own note names. That is a real constraint on
      a shared artifact rather than a role preference, so it is recorded as a blocker and put
      to the maintainer rather than resolved unilaterally.
      **Superseded 2026-10-01 — "put to the maintainer" was the wrong venue, by this file's
      own Phase 0.1.** The three paragraphs above are kept as the record of how the step was
      read on 2026-09-13, -14 and -30; they are no longer the disposition. The constraint they
      describe is real and was never in doubt — one rule file, two specifications, and an
      agent capable of landing either. What was wrong is the routing. *Which of two roadmaps
      owns a shared rule file* is a reversible technical allocation with no product semantics
      and no typed op, which Phase 0.1's landed table calls `contested-technical` and routes
      to *independent agent → council, CLI-first → team* — explicitly not the owner. Routing
      it to the maintainer applied the impact axis ADR-268 § 10 replaced. The 2026-10-01 run
      put it to the council instead, which is the resolver the table names; the council
      converged 2/2 and the decision is `DC-1`.

## Phase 6 — Scope-growth ownership

- [x] **6.1 Agent-owned growth, enumerated.** A necessary internal refactor, a missing test, a
      regression on a touched path, a small dependency adjustment, a local API change inside
      defined semantics, and a Boy-Scout cleanup that is small, local, low blast radius,
      testable and carries no new product decision. Recorded as a scope delta in the PR body.
      verify: a fixture run that adds a missing test on a touched path records a scope delta
      and asks nothing.
- [x] **6.2 Council-owned and owner-owned growth, enumerated.** Council: a larger internal
      re-cut, two equal technical strategies, a risky compatibility design, an unclear boundary
      with no new product semantics. Owner: only where the work changes what the product or
      business does, or needs a typed op. Larger unrelated opportunities become a follow-up
      artefact.
      verify: a fixture run that discovers a larger unrelated refactor emits a follow-up
      artefact rather than expanding the mission.

## Kill register

| K | Killed | Why |
|---|---|---|
| K1 | A TypeScript decision dispatcher | D5 is a documented choice; a lint over the table is enough |
| K2 | Batched asks and file-parked asks | ADR-268 § 10 plus the 2026-09-05 form directive |
| K3 | The council as an offer under autonomy | the council is a step |
| K4 | A `/closure` top-level command | ADR-041 |
| K5 | A mission halt on an owner-owned mid-run question | Phase 4.1 parks the step instead |
| K6 | A hard-coded entrance list | `produces_roadmap` plus a lint |
| K7 | Topology questions at closure | the owner plans `stacked` or it does not happen |
| K8 | *high impact implies owner* as a class | the axis is ownership |

## Decisions

The section Phase 2.1 made mandatory at `status: ready`, opened early because this file
produced a decision before it reached `ready`. Columns are 2.1's contract exactly, and the
`resolved by` cell names the council round rather than a path: council questions and
responses live under `agents/runtime/council/`, which is gitignored and auto-pruned, so
citing one from a durable artefact is forbidden by `no-roadmap-references`. The convergence
is inlined instead.

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| DC-1 | `contested-technical` | `council:2026-10-01/anthropic+openai/2-of-2` | `road-to-typed-grants-that-persist` step 3.2 is the **sole** owner of the three interrupt classes in `src/rules/user-interrupt-priority.md`. This file's 5.1 is narrowed to the closure-side half — mission id, closed-decision and delivery-target survival, the state-changing vocabulary — and keeps fixture `F8`. 5.1 does **not** close when the sibling lands 3.2; it closes when its own remaining clauses are satisfied. | Council of 2026-10-01, 2 rounds, members `anthropic/claude-sonnet-4-5` and `openai/codex-default`, quorum 2/2 present of 2, threshold 1, `concluded`, $0.00 (both seats subscription-authed). Both seats independently reached *typed-grants owns the implementation*, on the declared `depends:` direction, on the blocker's own unblock condition naming the sibling's 3.2, and on the grant object being that roadmap's deliverable. Both seats also held that a lone drain agent may **not** record this allocation unilaterally and that a council decision is the authorised venue — openai: *"The governing landed taxonomy classifies this as `contested-technical`, so council/team resolution does not require the human owner."* openai added the narrowing this row carries: *"Marking it `[x]` is justified only after every remaining clause in that step is satisfied."* | The sibling's 3.2 is withdrawn or retargeted away from `user-interrupt-priority.md`, or a maintainer records a different allocation here. Not revisited merely because the sibling is slow — that is the dependency working, not the decision failing. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Closure becomes a gate that stops every producer | implementation | `lint_roadmap_producers` reds any of nine commands that does not end in closure. A detector that fires on normal prose turns nine entrances red at once, and the cheapest repair is to weaken the detector until it finds nothing. | The detector reuses `lint_roadmap_complexity`'s existing prose checks rather than inventing new ones, and Phase 1.1's fixture pins both directions — twelve seeded ambiguities must be found, and a clean roadmap must pass. A weakened detector fails the first half. | Phase 1 — Closure at every producer, mechanically |
| 2 | `critical-technical` unlocks the wrong decisions | product | Removing the owner lock from `critical-technical` moves security-sensitive design decisions to a council. Where one provider is configured, that council is one model reviewing itself. | The class routes to a *provider-diverse* council and reaches the owner whenever a typed op or an owner-reserved dimension is touched; with one provider configured, `agent-config council:status` reports it and the class degrades to owner-confirm of the agent's proposal. | Phase 0 — Ownership replaces impact |
| 3 | The native ask exists on one host and the contract assumes all | implementation | D7 records that no native primitive is referenced anywhere today. A contract written as though every host has one degrades silently to a text block that no longer says it is a fallback. | Phase 3.2 puts `ask: native \| text` in the host manifest and prints it in `hooks:status`, so the shape is a measured row rather than an assumption; the text fallback keeps its own Iron Law. | Phase 3 — Host-native, one at a time |
| 4 | Closed decisions are re-asked after a context reset | implementation | `## Decisions` is read before a step, but a compacted session that loses the roadmap path re-derives the question and asks it again — the failure the census axis *repeats of an already-answered question* is there to catch. | The continuity record in the sibling roadmap carries the decision refs, and Phase 4.2's target for repeats is zero rather than low, so a single repeat is a finding. | Phase 4 — Mid-run residue |

## Blockers

### blocker: adr-266-acceptance-closure
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** nothing further. It blocked Phase 0, which rewrites `decision_resolution`'s Iron
  Law and so changes which decisions reach the owner at all.
- **What to do:** nothing. Resolved 2026-09-08 with its sibling
  `adr-266-acceptance` in `agents/roadmaps/road-to-typed-grants-that-persist.md` — one owner
  act, recorded on both files because either could be read alone.
- **Recommendation:** none outstanding.
- **If you do nothing:** nothing — the ownership axis is decided. `critical-technical` is no
  longer owner-locked, which is ADR-268 § 10, and the direction it may not be moved back in is
  § 0's table.
- **Resolved when:** `grep -m1 '^status:' docs/decisions/ADR-268-*.md` reads `accepted` — it
  does, verified 2026-09-08, re-executed 2026-09-30, 2026-10-01 and 2026-10-04 and still
  `accepted`. This entry is read by executing its condition, never by trusting this field.
  The 2026-10-04 execution printed `status: accepted` against
  `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md`
  on this tree at `30481f660`.

### blocker: kernel-write-deny-ask-when-uncertain
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** step 3.1's remaining paragraph, and through it AC-6's first clause. Nothing
  else — the non-kernel half of 3.1's contract landed on 2026-09-13 in
  `user-interaction-mechanics.md`.
- **What to do:** write one paragraph into `src/rules/ask-when-uncertain.md` naming the
  host's native ask primitive alongside its Iron Law, using a route an agent does not hold:
  the human-owned override exception registry named in the denial message, or removal of the
  `block-kernel-rule-writes` entry from `src/scripts/hook_manifest.yaml`. Both are maintainer
  acts outside an agent session. Do **not** reach for `--no-verify` or a `core.hooksPath`
  override; `block-no-verify` denies those separately and they are not bypasses.
- **Recommendation:** leave it until the sibling's `kernel-guard-first-crossing` is settled.
  That blocker governs the same guard across five kernel rules and is still `open`; crossing
  it once for this one paragraph would spend the first crossing on the smallest of the six.
- **If you do nothing:** 3.1 and AC-6's first clause stay open. Nothing regresses — the
  contract the paragraph would point at already ships and is already pointed at from
  `ask-when-uncertain.md` § Mechanics, so the gap is a naming line, not a missing obligation.
- **Resolved when:** an `Edit` envelope targeting `src/rules/ask-when-uncertain.md`, fed to
  `src/scripts/hooks/block_kernel_rule_writes.ts`, no longer prints
  `BLOCKED — kernel rule ask-when-uncertain is immutable`; or that file's paragraph naming the
  per-host native primitive exists. Reproduced as BLOCKED on 2026-09-13, 2026-09-14,
  2026-09-30 and 2026-10-01 — four reproductions, each by feeding the envelope to the guard
  rather than by reading the previous note. The second clause was checked on 2026-10-01 too
  and also fails: `grep -niE 'AskUserQuestion|native|primitive' src/rules/ask-when-uncertain.md`
  returns nothing.
  **Fifth reproduction, 2026-10-04**, both clauses again, at `30481f660`: the guard exits 1
  with the same `BLOCKED` line, and the `grep` is still empty. A second, independent obstacle
  was measured on that run and is recorded in full on step 3.1 — the preamble payload budget
  reads `zero net growth` with the ceiling equal to the base, so the paragraph cannot simply
  be written once the deny is lifted; it must be offset by an equal reduction or the ceiling
  moved. The **What to do** above is therefore still necessary and no longer sufficient, and
  3.1 now carries the anchor line and the verbatim paragraph so the maintainer act is a
  decision rather than a re-derivation.
  **Sixth reproduction, 2026-10-10**, both clauses again, at `55360bb87`, by feeding the
  envelope to the guard rather than by reading this note: an `Edit` envelope targeting
  `src/rules/ask-when-uncertain.md` still prints `BLOCKED — kernel rule ask-when-uncertain is
  immutable`, and `grep -niE 'AskUserQuestion|native|primitive' src/rules/ask-when-uncertain.md`
  still returns **0** hits. The recommendation is unchanged and its reason is now stronger:
  `kernel-guard-first-crossing` in `road-to-typed-grants-that-persist` is still `open`, so
  crossing the guard for this one paragraph would still spend the first crossing on the
  smallest of the six.

### blocker: grant-object-undelivered
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** fixture `F8`, which is now **two** steps' fixture — step 4.1's and, since the
  2026-10-01 `DC-1` disposition, step 5.1's. 4.1's other half — the mid-run ownership table and
  fixture `F4` — landed 2026-09-13; 5.1's other half — that a closed decision survives an
  interrupt — landed the same day in `roadmap-process-loop.md` § 3-0. What `F8` still needs is
  the object itself, which is neither step's to build.
- **What to do:** nothing in this file. The grant object
  `{op, target, scope, granted_by, span, expires}` is ADR-260's and is built by
  `road-to-typed-grants-that-persist` Phase 2, with `expires` / `revoked_by` added by its 3.1.
  Those steps are themselves held by that roadmap's `kernel-guard-first-crossing` and
  `ratification-platform-anchor` blockers. Drain that roadmap, not this one.
- **Recommendation:** treat 4.1 as closed-pending-sibling rather than as work. Writing `F8`
  against an object that does not exist would assert nothing, and building the object here
  would implement the sibling roadmap under this file's name.
- **If you do nothing:** 4.1 and 5.1 stay open and correctly so. No behaviour is missing
  today, because the grant they would protect does not exist to be lost.
- **Resolved when:** `grep -rln granted_by src tests` returns at least one path. It returned
  nothing on 2026-09-13, 2026-09-14, 2026-09-30, 2026-10-01 and 2026-10-04 — the 2026-10-01
  reading taken at `9f2b9fb4a` and the 2026-10-04 one at `30481f660`, each that day's head of
  `origin/main` and not a stale checkout. The 2026-10-04 run widened the sweep once, to check
  the narrow scope is not hiding a delivery: `granted_by` appears in this file, in
  `road-to-typed-grants-that-persist`, under `agents/evidence/reviews/`, and in ADR-260,
  ADR-266 and ADR-268 — plans and records only, nothing under `src` or `tests`. The scope is
  the point: the object has to exist in code, not in prose about code.
  **The sibling moved away from delivering it, not toward it.** Its Phase 2 steps 2.1 and 2.2
  and its 3.1 — the steps this entry names as the object's builders — all read `[~]` on
  2026-10-04, deferred. The blocker holds for a slightly stronger reason than before.
  **Sixth reading, 2026-10-10 at `55360bb87`, and nothing moved in either direction.**
  `grep -rln granted_by src tests` returns **0**. The widened sweep returns the same seven
  prose files as 2026-10-04 — this roadmap, the sibling, two files under
  `agents/evidence/reviews/`, and ADR-260, ADR-266, ADR-268 — so the set did not grow either.
  The sibling's 2.1, 2.2 and 3.1 still read `[~]`. Six readings, six times nothing under
  `src` or `tests`: this is a stable negative, not a pending one, and the entry is
  unchanged rather than stale.

### blocker: interrupt-classes-owned-by-sibling
- **Status:** resolved
- **Owner:** maintainer
- **Class:** 2 — council-decidable. **Corrected from `3 — human-only` on 2026-10-01**, and the
  correction is the substance of the resolution. The entry was authored saying the allocation
  is *"an ownership call and not an agent's to take"*, which is true of an agent deciding
  alone and false of the venue it implied. This file's own Phase 0.1 landed the axis that
  governs it: *which of two roadmaps owns a shared rule file* is a reversible technical
  allocation with no product semantics and no typed op, i.e. `contested-technical`, whose
  resolver is *independent agent → council, CLI-first → team*. Class 3 applied the impact
  axis ADR-268 § 10 replaced — the exact leak K8 kills.
- **Blocks:** nothing further. It blocked step 5.1's allocation; 5.1 itself remains open under
  `grant-object-undelivered`, which is a different cause.
- **What to do:** nothing. Resolved 2026-10-01 by the council — the resolver Phase 0.1's table
  names for this class — recorded as `## Decisions` row `DC-1`:
  `road-to-typed-grants-that-persist` step 3.2 is the sole owner of the three interrupt
  classes in `src/rules/user-interrupt-priority.md`; this file's 5.1 is narrowed to the
  closure-side half and keeps `F8`. Convergence 2/2 of 2 present, threshold 1, `concluded`,
  2 rounds, members `anthropic/claude-sonnet-4-5` and `openai/codex-default`, $0.00.
- **Recommendation:** none outstanding. Do **not** read `DC-1` as *5.1 closes when the sibling
  lands 3.2* — both seats refused that reading, and 5.1's remaining clauses are listed on the
  step.
- **If you do nothing:** the allocation stands. One rule file, one owner, and the two-owners
  hazard this entry existed to prevent is removed by the decision rather than by the parking.
- **Resolved when:** `road-to-typed-grants-that-persist`'s step 3.2 reads `[x]`, **or** the
  allocation is recorded here. The first still does not hold — that step read `[ ]` on
  2026-09-13, 2026-09-14, 2026-09-30 and 2026-10-01, and on **2026-10-04 it reads `[~]`** —
  deferred, refused on the control it removes and unverifiable until the sibling's 3.1 ledger
  exists. `[~]` is not `[x]`, so the clause is unchanged in verdict while changed in fact.
  `DC-1`'s revisit condition was evaluated against that change and does **not** fire: it names
  withdrawal or retargeting away from `user-interrupt-priority.md`, and a deferral is neither
  — the step still names that file and still carries the three classes — and the row says in
  terms that sibling slowness is not a trigger. The allocation stands.
  The **second holds as of 2026-10-01**:
  `DC-1` in `## Decisions` is that record. This entry is read by executing its condition —
  `grep -n 'DC-1' agents/roadmaps/road-to-decision-closure.md` returns the row — never by
  trusting this field.

## Fixtures

`F1` twelve seeded technical ambiguities → zero owner questions, twelve `## Decisions` rows ·
`F2` two valid product semantics → exactly one native ask carrying a recommendation ·
`F3` council non-convergence on a product trade-off → the owner confirms the council's
proposal · `F4` a mid-run architecture choice → resolved without an ask · `F6` an API ceiling
→ pause and report · `F7` a producer without closure → the lint is red · `F8` an interrupt →
resumed with the grant and decisions intact.

> **`F5` is deliberately absent from this list, 2026-09-30.** This roadmap's interrupt fixture
> was numbered `F5` until this run. `tests/fixtures/decision-closure/F5-unfalsifiable-verify.md`
> already occupies that slot in the one directory this file's fixtures live in; it belongs to
> the archived `road-to-a-verify-clause-that-can-fail` and is asserted by
> `tests/scripts/closure_scan.test.ts`, which is also where `F0`, `F1`, `F2` and `F4` of this
> roadmap are asserted. Two owners in one namespace under one label is a mis-close waiting to
> happen, so the unwritten fixture moved to `F8` rather than the written one moving out of the
> way. Do not reintroduce `F5` here.

## Acceptance Criteria

- [x] AC-1 — every command carrying `produces_roadmap: true` is mechanically proven to end in
      closure, and removing the step from any one of them reds CI.
      Proven: `lint_roadmap_producers` reads the declaration from the frontmatter and reds a
      producer carrying no reference to the pass. Registered in `taskfiles/ci-fast.yml`, the
      `ci:` list and `.github/workflows/rule-backstops.yml`, so it reds CI and not only a
      local chain. Sabotage-probed on landing: the closure section was removed from
      `analyze/inbox` and the gate went red, then restored.
- [x] AC-2 — a `ready` roadmap cannot contain an unresolved technical marker.
      Proven: `lint_decision_classes`, CI-wired the same way. Fixture pair `R1` → `R2` pins
      both directions on one plan — the loose marker is red, the same marker recorded as a
      `## Decisions` row is green — and a reference to a row that does not exist stays red, so
      the cheapest repair is the record rather than a dangling pointer.
- [x] AC-3 — the council can conclude a technical decision without emitting an owner-facing
      options block.
      Proven: the block is conditional in all three places that mandated it, and
      `council_record_shape` checks a record in both directions. `F3a` (conclusive technical)
      must carry none and reds when one is added; `F3b` (non-convergent product) must carry
      the proposal and reds when it is removed.
- [x] AC-4 — `critical-technical` is not owner-locked and `spend-exhaustion` is not
      owner-routed, both provable from the loader's own tests.
      Proven in `tests/scripts/ai_council/config.test.ts`: `critical-technical` loads at
      `council` AND at `agent`, so no lock exists to find; `spend-exhaustion: user` throws
      `never owner-routed`. Sensitivity-probed on landing — adding `critical-technical` to the
      locked set reddened the suite.
- [ ] AC-5 — an `F1` `process-full` run records zero owner asks in the execution phase.
      **NOT CLAIMED, 2026-09-13.** What is proven is the static half: `F1` yields twelve
      findings and zero owner questions, and the census reports zero technical owner asks in
      execution across the authored corpus. Neither is a RUN. The criterion asks for the
      behaviour of an actual `process-full` execution over `F1`, which is a transcript
      measurement, and recording it green off two static probes would be the substitution this
      roadmap's own census axis exists to catch.
      **Re-verified 2026-09-14:** both static halves still hold on this tree —
      `tests/fixtures/decision-closure/F1-technical-ambiguities.md` ships and
      `src/scripts/ask_block_census.ts` still reports its two measurable targets — and the
      missing half is still a run, which nothing in this tree produces. Unchanged, not stalled.
      **Re-verified 2026-09-30, and the gap is now named precisely rather than as "a run".**
      The census header states where a transcript figure legitimately enters: carried IN via
      `--native-asks` / `--unblocked-asks` / `--native-source`, produced by
      `probe_unblocked_ask --limit N --store …`. So the tree does have a transcript intake —
      it simply has no producer for *this* measurement, which is the behaviour of a
      `process-full` execution over `F1`. Two things would have to be true to close it and
      neither is: `F1` is a detector fixture rather than a roadmap under `agents/roadmaps/`,
      so `process-full` has nothing to execute over it; and the only agent that could run it
      is the one that would then report its own result, which
      [`evaluator-independence`](../../src/rules/evaluator-independence.md) forbids as
      self-commissioned evidence. Closing AC-5 needs a harness that runs the fixture and a
      party other than the runner that reads the transcript. Neither is this file's to build.
      **Re-verified 2026-10-01, by running the census rather than citing the previous note.**
      `./scripts-run src/scripts/ask_block_census` reads 627 files under `src/domains`,
      `src/skills` and `src/agent-src/contexts` and reports *zero technical owner asks in
      execution* **MET**, *zero commit/push/CI/conflict asks* **MET**, and *zero repeats of an
      answered question* **NOT MEASURED (transcript axis)**. `F1-technical-ambiguities.md`
      still ships in `tests/fixtures/decision-closure/`. So both static halves hold exactly as
      before and the missing half is unchanged: the criterion asks what a `process-full`
      execution over `F1` does, and `F1` is a detector fixture rather than a roadmap under
      `agents/roadmaps/`, so there is still nothing for `process-full` to execute over. The
      2026-10-01 drain run did not attempt it, and the reason is worth recording because it is
      the same rule that bounds the criterion: this run IS the party that would have produced
      the transcript, so its own reading of that transcript would be the self-commissioned
      evidence `evaluator-independence` names. Unchanged, not stalled.
      **Re-verified 2026-10-04, by running the census again rather than citing the note above,
      and the corpus moved while the targets did not.**
      `./scripts-run src/scripts/ask_block_census` now reads **633** files under
      `src/domains`, `src/skills` and `src/agent-src/contexts` — six more than the 627 of
      2026-10-01 — and reports *zero technical owner asks in execution* **MET**, *zero
      commit/push/CI/conflict asks* **MET**, and *zero repeats of an answered question*
      **NOT MEASURED (transcript axis)**. The ask-shape breakdown was 184 single, 74 batch,
      0 count-only, 0 file-parked, 21 bypass. That the corpus grew by six files while both
      measurable targets still read MET is the useful content of this re-run: the static half
      is not drifting as the tree grows. `F1-technical-ambiguities.md` still ships in
      `tests/fixtures/decision-closure/`, and `closure_scan.test.ts` was re-run green on this
      tree, producing twelve findings over `F1` and zero owner questions.
      The missing half is unchanged, and unchanged for the same two reasons: `F1` is a detector
      fixture rather than a roadmap under `agents/roadmaps/`, so `process-full` still has
      nothing to execute over it, and the only agent that could run it is the one that would
      then read its own transcript. This run did not attempt it either, for that second reason.
      Unchanged, not stalled.
      **Re-verified 2026-10-10 at `55360bb87`, by running the census rather than citing the
      note above.** `./scripts-run src/scripts/ask_block_census` now reads **637** files —
      four more than the 633 of 2026-10-04 — and reports *zero technical owner asks in
      execution* **MET**, *zero commit/push/CI/conflict asks* **MET**, and *zero repeats of an
      answered question* **NOT MEASURED (transcript axis)**. The ask-shape breakdown is
      **unchanged at 184 single, 74 batch, 0 count-only, 0 file-parked, 21 bypass** — the
      corpus grew and the distribution did not move, which is the useful content of a fourth
      consecutive re-run.
      **One substitution was considered this run and rejected, which is worth recording
      because it is the attractive wrong answer.** A `/roadmap:process-full --all` drain ran
      over the active estate on this date and made zero owner asks during execution, routing
      every owner-reserved item into a registered blocker instead. That is NOT AC-5: the
      criterion asks for a `process-full` execution over **`F1`**, and `F1` is a detector
      fixture rather than a roadmap, so a drain over a different corpus answers a different
      question. Reading it as AC-5 would be exactly the substitution this roadmap's census
      axis exists to catch — and the drain was also its own runner, so its reading of its own
      transcript is the self-commissioned evidence `evaluator-independence` forbids. Both
      reasons are unchanged. Unchanged, not stalled.
- [ ] AC-6 — on a host with a native ask primitive, every owner ask used it; on a host without
      one, `hooks:status` says so.
      **HALF PROVEN, 2026-09-13.** The second clause holds: `ask: native | text` is a manifest
      row and `hooks:status` prints it per host, with absent reading `text` and a test pinning
      that direction. The first clause depends on 3.1, whose remaining paragraph is a kernel
      rule the write guard denies — and it is a transcript claim besides, on the same ground
      as AC-5.
      **Re-verified 2026-09-14:** the second clause still holds — `src/scripts/hook_manifest.yaml`
      still carries an `ask:` row on every host block, one `native` and the rest `text`. The
      first clause is blocked twice over, by the reproduced deny recorded on 3.1 and by being
      a transcript claim, so discharging either alone would not close it.
      **Re-verified 2026-09-30.** Second clause still holds and was re-counted, not re-read:
      `src/scripts/hook_manifest.yaml` carries eight host `ask:` rows, exactly one `native`
      and seven `text`. First clause unchanged and still blocked twice over — the deny was
      reproduced for a third time against the guard itself (see 3.1), and the transcript half
      fails for the same two reasons AC-5 does, so it is bounded by
      `kernel-write-deny-ask-when-uncertain` plus the missing harness rather than by either
      alone.
      **Re-verified 2026-10-01, both clauses, by counting rather than reading.** Second clause
      holds: `grep -c '^\s*ask:' src/scripts/hook_manifest.yaml` returns **8**, and listing the
      matches shows exactly one `native` and seven `text` — the same shape as 2026-09-30, so
      the row has not silently been dropped from a host block in the interval. First clause
      unchanged and still blocked twice over: the kernel-write deny was reproduced a fourth
      time against the guard itself, and on this run BOTH of that blocker's resolution clauses
      were checked rather than only the first — the guard still denies, and
      `grep -niE 'AskUserQuestion|native|primitive' src/rules/ask-when-uncertain.md` returns
      nothing, so the paragraph that would discharge it without touching the guard does not
      exist either. The transcript half fails on AC-5's two grounds. Discharging any one of the
      three still does not close this criterion.
      **Re-verified 2026-10-04, both clauses, by counting rather than reading.** Second clause
      holds and is unchanged in shape: `grep -c '^\s*ask:' src/scripts/hook_manifest.yaml`
      returns **8**, and listing the matches shows exactly one `native` and seven `text`, the
      same split as 2026-09-30 and 2026-10-01. `agent-config hooks:status` was run as well and
      prints the shape per host — one `native  (structured-ask tool; the recommendation is its
      default option)` and seven `text  (numbered text block — the fallback, and it says so)`
      — so the row reaches the surface that reads it and does not merely sit in the manifest.
      First clause unchanged and now blocked three ways rather than two: the kernel-write deny
      was reproduced a fifth time against the guard itself, the paragraph that would discharge
      the blocker without touching the guard still does not exist, and step 3.1 records a
      newly measured third obstacle — the preamble payload budget is at `zero net growth`, so
      even a lifted deny leaves the paragraph needing an offset or a deliberate ceiling move.
      The transcript half fails on AC-5's two grounds. Discharging any one of the four still
      does not close this criterion.
