---
complexity: structural
status: ready
estate_offset_exempt: "adopted as the closure correction of archive/road-to-single-delivery.md, which closed 21/21 on a partition that reaches rules and skills and stops there. There is no sibling to archive against it: the two remaining families are live on a freshly regenerated tree (29 personas and 40 commands delivered from both layers, personas measured by nothing), no active roadmap owns them, and the parent is archived and must not be re-opened to carry them. The estate gains one roadmap and loses an incomplete invariant that a bound gate is waiting on."
execution:
  mode: phase-checkpoints
---
# Road to single delivery closure — the two families the partition never reached

> **Source:** `agents/tmp.old/double-rules-stale-partial/` — a stale partial
> re-drop of the inbox that produced `archive/road-to-single-delivery.md`
> (byte-identical files; the consumed copy is `agents/tmp.old/double-rules/`).
> The drop itself carried nothing new. Re-verifying its claims against a
> **freshly regenerated** tree with the partition ACTIVE did: the partition
> holds for rules and skills and stops there.
>
> **This is a closure correction, not a reopening of ADR-236.** The partition
> works. Both council seats said so independently and neither treats the
> recurrence as invalidating the earlier disposition — rules and skills reach
> zero overlap, measured. What the earlier roadmap closed on was an incomplete
> statement of its own scope.

## Measured, 2026-08-21, fresh worktree off `origin/main` after `task sync && task generate-tools`

| family | global `~/.claude` | project `<repo>/.claude` | overlap | partition gate | in a measurer |
|---|---:|---:|---:|---|---|
| rules | 103 | 13 | **0** | yes | yes |
| skills | 313 | 0 | **0** | yes | yes |
| commands | 78 | 40 | **40** | hyphen wrapper only | yes |
| **personas** | 32 | 29 | **29** | **none** | **no** |
| agents | 0 | 1 | 0 | n/a | yes — and can never overlap |

Overlap here is **basename equality within one family directory**, which is the
only identity the two measurers implement. Naming it matters: for commands the
host-visible unit is the invocation name, not the filename, so basename equality
is not obviously the right key there. Step 1.3 fixes the definition before
anything is enforced on it.

## Goal

Every artefact family the installer ships is either delivered from exactly one
layer, or carries a **measured, dated reason** why it is delivered from two —
and a family that is in neither state cannot pass unnoticed, because a family
directory no measurer knows about fails the check instead of being skipped.
`check_single_delivery --enforce` is bound to that invariant rather than to a
phase number, and every remediation string the tooling prints names a mechanism
that still exists.

## Non-goals

- **Reopening ADR-236.** The partition is the decision; this closes its edges.
- **A delivery-family manifest.** Rejected by both council seats: it becomes a
  fifth thing that can drift beside filesystem reality, the condenser, the
  installer bundle and the measurers. Discovery of unknown families is the
  forcing function instead — five lines, same effect, nothing new to keep in sync.
- **Deriving the measurers' family list from `_CLAUDE_SKILL_BUNDLE`.** Rejected
  by both seats as a common-mode failure: the verifier would inherit the
  producer's omissions, which is exactly the bug being fixed. The two lists stay
  independent and a discovery check catches their disagreement.
- **Partitioning commands on principle.** Step 2.1 measures first. A documented
  exception is a legal outcome.
- **Deleting anything under `~/.claude/`.** Hard Floor
  ([`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)).

## Phase 1 — Make the measurement complete before enforcing anything on it

- [x] **1.1 Measure the families the installer actually ships, and say which were skipped.**
      Both measurers declare `const TYPES = ['rules','skills','commands','agents']`
      (`src/scripts/check_single_delivery.ts:92`,
      `src/scripts/_lib/layer_overlap_notice.ts:36`) while the installer ships
      `rules, skills, commands, personas` (`_CLAUDE_SKILL_BUNDLE`,
      `src/scripts/install.ts:1916-1921`). So the measurers scan `agents`, which is
      absent globally and cannot overlap, and skip `personas`, which overlaps 29
      times. Add `personas`; keep `agents` in a separate `SKIPPED` set carrying the
      reason it cannot overlap, so the output distinguishes *compared*, *skipped by
      construction*, and *one layer absent* instead of collapsing them into
      `types_compared=2 of 4`. The two lists stay hand-written and independent on
      purpose — see Non-goals.
      verify: `check_single_delivery` on a fixture with all five directories names
      four compared families and `agents` as skipped-by-construction with its
      reason; a fixture with a persona in both layers reports it, which today's
      binary cannot.
      **DONE 2026-08-21 — and one part of the step as written was WRONG, so it was
      not built.** `personas` added, and `user-types` with it: the generator
      registry (`check_generator_output_coverage.ts:38`) declares six `.claude/*`
      families and TYPES named four. Both lists now read
      `rules · skills · commands · personas · user-types · agents`, and the ledger
      prints `types_compared=N of 6`.
      **The `SKIPPED` set this step asked for was not added, deliberately.** This
      gate carries a `ledger-exempt` marker whose own void condition is *"if a
      future version gains a real skip path — a type it declines to compare for a
      reason — this exemption is void and the ledger is the right answer"*. A
      skipped-by-construction set is exactly that, so building it would have voided
      a gate exemption and forced a per-target ledger to state something the render
      already says. And the premise was false anyway: `agents` CAN overlap — a
      consumer may hold `~/.claude/agents/` — so calling it skipped-by-construction
      would have been a claim this tree does not support. The reason it reads 0 here
      is `global absent`, which the existing render already prints.

- [x] **1.2 Fail on a family directory no measurer knows about.**
      Read the layer directories that exist and compare against the known set. An
      unrecognised family directory exits non-zero with "unknown family `<x>`: add
      measurement before it can ship" rather than being silently absent from the
      count. This is the forcing function that makes 1.1's omission
      non-recurring, and it is the whole of the drift protection this roadmap
      buys — no schema, no manifest.
      verify: a fixture with `.claude/<invented-family>/` exits non-zero and names
      the family; the same fixture without it exits as before. Mutation: deleting
      the check makes the first assertion fail.
      **DONE 2026-08-21.** `unknownProjectFamilies` in `check_single_delivery.ts`,
      plus a `unknown_families=N` ledger field.
      **Scanned on the PROJECT layer only, and that is what makes it a hard refusal
      rather than a warning.** `<repo>/.claude/` is generator-owned — its six
      entries are exactly the families this repository chose to emit. `~/.claude/`
      is the host's own directory (`plugins`, `projects`, `sessions`,
      `shell-snapshots`, `telemetry`, a dozen more), so an unrecognised name there
      would be a false-positive generator, not a check.
      **Refuses in BOTH modes, unlike every other verdict this gate produces.** The
      others are properties of one machine's two layers, which is why `--enforce`
      is opt-in; this one is true on every checkout and fixable in one line, so
      gating it behind that flag would put the only topology-independent check
      behind the flag that exists for topology-dependent ones.
      `verify:` **RAN, both directions.** `mkdir .claude/widgets` → exit **1** with
      the family named; removed → exit **0**. Four unit tests incl. a mutation
      control and a dotfile/known-family case.

- [x] **1.3 Name the identity key, per family, in the code that uses it.**
      The measurers compare basenames. For rules and personas that is the host's
      unit; for commands the host-visible unit is the invocation name
      (`/cluster:sub`), which the colon-form symlinks encode in the *path*, not the
      basename. Record which key each family is compared on and why, and make a
      family whose real unit is not the basename say so at the call site rather
      than in prose here. Where a resolved symlink target is the safer comparison,
      state whether names, resolved destinations, or bytes are being equated —
      these are materially different claims.
      verify: each family in the measurer carries its identity key in code; a test
      pins that two commands colliding on invocation name but differing on
      basename are reported, or that this case is explicitly out of scope with the
      reason at the call site.
      **DONE 2026-08-21 as a RECORDED GAP, not a closure — and the gap is moot by
      measurement.** The identity key is now written at the `TYPES` declaration,
      per family: basename equality is the host's unit for `rules`, `personas`,
      `user-types` and `agents`; for `commands` it is not, because the host
      registers `/cluster:sub` and the colon form encodes that in the PATH, so this
      gate compares cluster DIRECTORY names — a coarser key.
      Not closed, because after 2.2 the coarse key has no work to do: a machine with
      a verified host layer projects **zero** commands, and a machine without one
      has only the project layer, so the overlap is 0 in both topologies. Reading
      each command's own slug would be real work for a row that cannot disagree.
      Stated rather than silently left imprecise.

- [x] **1.4 Decide what a missing, empty, or malformed `workspaces:` means, and fail closed.**
      `isExclusivelyPackageOnly` (`src/install/partitionEligibility.ts:169`) returns
      `false` on an unreadable file, an absent list, and an empty list — all three
      resolve to *delivered globally, withheld from the project layer*. That is the
      documented direction and it is deliberate. What is undocumented is the
      malformed case: a `workspaces:` that parses to something that is neither
      absent nor a list. Establish which of the four states occur in the tree
      today, and make the one that resolves by accident resolve by decision, at
      the generator, with a named remediation.
      verify: a fixture per state (absent · empty · maintainer-only · mixed ·
      malformed) produces a recorded verdict; the malformed case does not silently
      take the same branch as the absent one.
      **DONE 2026-08-21 — RECORDED NULL. Three of the five states do not exist.**
      Counted over all 119 files in `src/rules/`:
      `absent=0 · empty=0 · maintainer-only=16 · mixed=103 · scalar-or-other=0`.
      Exactly two states occur, both deliberate, and the 16 is the figure ADR-236
      partitions on. The input is always THIS package's own `src/rules/` — never a
      consumer's — so the space is closed by that count rather than merely
      unobserved.
      **The fixtures this step asked for were considered and NOT written.** They
      would pin behaviour on inputs the only caller cannot produce, which is a test
      asserting a hypothetical. The count is recorded at the predicate instead, so
      the day a rule ships a bare or malformed `workspaces:` the number moves and
      the note is what dates.

## Phase 2 — Measure the two duplicated families, then decide each

- [x] **2.1 Probe the host-dedup claim the commands path rests on.**
      `generate_claude_project_commands` (`src/scripts/condense.ts:1781-1798`)
      states *"Claude Code dedupes project and user scope by name, so the two
      copies of `/cluster:sub` collapse."* No first-party observation is cited. The
      sibling host claim under the parent roadmap **was** probed (Phase 5.2,
      `claudeMdExcludes`) and came back negative, so an unprobed host assumption in
      the same area is not a safe default. Reuse that method — `claude -p
      --settings`, a real second process — and record the host version, the
      settings file, the auth context and the machine, because "measured" without
      those inputs is another unqualified claim. Measure **both** questions the
      council named: does the dedup happen, and is there any observable
      user-facing consequence when it does not. Two copies the host collapses and
      nobody sees is an implementation detail, not a defect.
      verify: a dated evidence note with the host version and both readings; the
      docblock either cites it or is corrected.
      **DONE 2026-08-21 — the claim HOLDS, and the half nobody had checked INVERTS
      the value of the project-layer copy.** Host: Claude Code **2.1.238**.
      Fixture: `/analyze:inbox` in both `~/.claude/commands/analyze/` and a temp
      project's `.claude/commands/analyze/`.
      | probe | result |
      |---|---|
      | entries named exactly `/analyze:inbox` | **COUNT=1** — the host dedupes |
      | control: a second, project-only `/analyze:inboxctl` | **COUNT=2** — so the 1 is an observation, not a probe that can only say one |
      | the command's description, as the session sees it | the **GLOBAL** body, not the project fixture's |
      **The precedence reading is the finding.** The docblock's reasoning was that
      the colon form buys reachability without a global deploy — true, and still
      true. What it never said is which copy wins when both exist: the global one.
      So on a machine with a verified global layer those 40 symlinks are written,
      deduped away and LOSE — dead weight, not a second listing.
      **The first probe attempt failed for a reason worth recording:** run inside
      this repository, `claude -p` answered with this package's own end-review
      obligations instead of the question. The measurement had to move to a clean
      temp project. An in-repo probe of host behaviour measures the repo's rules.
      Honest limits: self-report, n=1 per condition, one host version, one machine.

- [x] **2.2 Act on 2.1 — partition, or record the exception.**
      Fork, stated so it cannot be half-done. **(a)** dedup holds and no
      user-facing consequence → the 40 command overlaps are a documented,
      measured exception: encode it where the measurer reads it, so `--enforce`
      can pass without pretending the overlap is absent. **(b)** dedup does not
      hold, or it costs something observable → partition commands the way rules
      and skills are partitioned, and state what the colon form's reachability
      claim cost. Neither branch is chosen before 2.1 has a number.
      verify: exactly one branch is taken and dated; the other carries a
      one-line why-not.
      **DONE 2026-08-21 — fork (b), partition, and the measurement is what chose
      it.** Not "partition on principle" (the Non-goals forbid that): 2.1 showed
      the project copy LOSES wherever a verified global layer exists, which is
      exactly where `partitionActive` is true, and is the only reachable copy where
      it is false. So the existing predicate already matches the measurement and
      needed no new switch — `commandsWithheld` in `partitionEligibility.ts`, the
      symmetric twin of the gate `generate_claude_commands` already carried.
      **It exposed a second defect the roadmap had predicted only in the abstract.**
      With the generator gated, `.claude/commands` held **0 `.md` files and 40 empty
      cluster DIRECTORIES** — and this gate counts directory NAMES, so it still
      reported 40 overlapping commands against a layer delivering none. A partition
      that stops the writes and leaves the shape is invisible to the gate meant to
      confirm it. Fixed by `_lib/prune_empty_dirs.ts`, lifted from the inline loop
      `condense.ts` already carried for skills.
      `verify:` **RAN.** `task generate-tools` → `claude_commands=0`,
      `.claude/commands` **0 entries**, and the gate's commands row reads
      `BOTH 0`.

- [x] **2.3 Gate the persona writer, and reconcile what earlier runs already wrote.**
      `generate_persona_symlinks()` (`src/scripts/condense.ts:2283`, called
      `:2446`) has no `partitionActive()` check, unlike `generate_claude_commands`
      (`:1848`) and the rules and skills paths. Add it. Then the part a gate alone
      does not do: withholding a *new* write leaves a directory an earlier version
      already populated, so the generator must reconcile its own prior output —
      the same stale-link sweep `generate_claude_project_commands` already
      performs for renamed commands. `.claude/` is gitignored and generator-owned,
      so this is not the Hard Floor case; `~/.claude/` is untouched.
      **Before gating, establish that the global layer actually carries them:**
      the partition is a removal and loses its repair path, so withholding
      personas from the project layer is only safe if the 29 exist globally. They
      do today (32 global) — verify it rather than inherit it.
      verify: on a partition-active tree `.claude/personas` is empty and a
      previously populated one is emptied by a single run; on a partition-inactive
      tree it is populated as before; the global layer is confirmed to carry every
      withheld persona.
      **DONE 2026-08-21, with global carriage verified FIRST as the step required.**
      Every one of the 29 project personas is present globally (32 there, a strict
      superset; `comm -13` → 0 missing). Only then was the writer gated.
      `personaPartition` / `personaWithheldFor` in `partitionEligibility.ts`,
      scoped to `.claude/` — `partitionActive` verifies the CLAUDE host layer and
      says nothing about `~/.cursor`, so withholding a cursor persona on a claude
      fingerprint would deliver it nowhere.
      **Reconciliation is the empty list, not a second code path:** the existing
      stale-symlink sweep removes any link absent from the list given for that
      directory, so a populated tree is emptied by one run.
      `verify:` **RAN, both directions.** After `task generate-tools`:
      `.claude/personas` **0**, `.cursor/personas` **29**, `personas=29` still
      created. Five unit tests over the pure predicate, sabotage-checked — replacing
      it with `return active` reds the never-withhold-cursor assertion.

- [x] **2.4 Price the duplication honestly, including zero.**
      `.claude/personas` holds 121,041 bytes of persona prose behind 29 symlinks.
      Nothing establishes that any host reads that directory: `.claude/personas`
      appears in this repository's own generators and gates
      (`check_generator_output_coverage.ts:38`, `check_bridge_derivation.ts:44`,
      `_lib/tool_adapter_registry.ts:39`) and in no host contract. If no host
      reads it, the duplication costs nothing in context and the value of 2.3 is
      consistency and drift protection, not tokens. Say which it is, in the
      roadmap, before the enforcement flip is argued on a saving that may not
      exist.
      verify: a dated statement of the measured or absent context cost, with the
      evidence for "no host reads this" or the reading that refutes it.
      **DONE 2026-08-21 — the honest null landed, and the number is ZERO.**
      Nothing reads `.claude/personas`: it appears in this repository's own
      generators and gates (`check_generator_output_coverage.ts:38`,
      `check_bridge_derivation.ts:44`, `_lib/tool_adapter_registry.ts:39`) and in
      no host contract — Claude Code's own subagent surface is `.claude/agents/`.
      And the 40 commands were already being deduped by the host (2.1), so their
      second copy was never in anyone's context either.
      **So the context saving from this roadmap is 0 tok, both families.** 121,041
      bytes of persona prose behind 29 symlinks that no host reads, and 40 command
      symlinks the host discarded. The parent roadmap's measured 96,584-token saving
      came from rules and skills and is untouched — it is not re-attributed here.
      What this work buys is stated in § Honest null consequence and is the whole of
      it: a measurement that no longer skips a shipped family, a check that refuses
      on a family nobody taught it about, and a remediation line that names a
      mechanism that exists.

## Phase 3 — Bind enforcement to the invariant, and stop printing a dead remedy

- [x] **3.1 Retie `--enforce` to the invariant instead of to a phase.**
      `tests/scripts/preflight_single_delivery_binding.test.ts:81` asserts report
      mode *"while Phase 2 is open"*, and step 4.3 of the parent roadmap promised
      *"the flip lands with Phase 2"*. Phase 2 closed while the invariant was
      false, so the condition expired without the flip landing — a sequencing
      bug, not a scoping contradiction. **The test is doing its job and is not
      deleted:** its condition changes from a phase reference to the invariant it
      was standing in for, so the flip still has to be argued. Flip only once
      Phase 1 and Phase 2 leave zero unexplained overlap.
      verify: the test names the invariant, not a phase; the flip and the
      invariant land in one commit, or the test still refuses.
      **DONE 2026-08-21 — and the finding is that the parent roadmap's promised flip
      is STRUCTURALLY VOID, not pending.** The invariant is now true on this
      machine: `check_single_delivery` reports `duplicated=0` across all six
      families and `--enforce` exits **0**. The flip still cannot land in preflight.
      **Measured:** pointed at a one-layer topology, `--enforce` exits **1** via the
      `readNothing` branch — correct behaviour, and exactly the wrong behaviour for
      this binding. `.claude/` is gitignored, no CI leg installs at user scope, and
      a contributor without a global install has one layer, so an enforced preflight
      reds for everyone whose topology is the normal one, on an invariant their
      machine cannot express. Step 4.3 of the parent promised "the flip lands with
      Phase 2" against a design that makes it impossible there.
      So the test's condition moved from a phase reference to the structural reason,
      and it is not waiting for anything: `--enforce` belongs where BOTH layers are
      known verified — a doctor surface or an explicit maintainer run — never in a
      task every checkout runs. `verify:` the assertion names the measurement; six
      tests green.

- [x] **3.2 Remove every remediation string that names the superseded mechanism.**
      `src/scripts/check_standing_rule_delivery.ts:326-330` prints
      `install --layer=<global|project>` — not merely stale, but unusable: the
      partition mechanism is `workspaces:` frontmatter, and a maintainer
      following that line cannot fix the condition. Treat it as a class, not a
      typo: find every surface that explains the mechanism this way and point it
      at the one that exists, with a test that fails if the old flag reappears in
      a remediation string.
      verify: a test greps the remediation surfaces for the superseded flag and
      fails on reintroduction; the printed line names `workspaces:` and ADR-236.
      **DONE 2026-08-21 — two sites corrected, and the obvious test for it was
      WRONG and was not shipped.** `check_standing_rule_delivery.ts:329` and
      `routing_doctor.ts:279` both told the reader to run
      `agent-config install --layer=<global|project>`; both now name the partition
      (`agent-config install` arms the fingerprint; the next `task generate-tools`
      withholds), and both name the superseded advice so a reader who saw the old
      line knows what happened to it.
      **`install.ts:2236-2253` was left alone, and the class-wide test the review
      asked for would have broken it.** A test that fails on `--layer` anywhere in
      CLI help would fire on the installer's own flag documentation — the flag is
      not dead, the ADVICE was. `delivery_remediation_currency.test.ts` is therefore
      scoped to the two remediation surfaces, with a vacuity guard per surface.
      `verify:` **RAN — and the first version of the test was a FALSE GREEN.** Its
      regex looked for an unescaped backtick while the source escapes it inside a
      template literal, so a sabotage that restored the old advice verbatim left all
      six tests passing. Hardened, re-sabotaged, **2 assertions red**, restored,
      green. A test never seen red has unknown sensitivity, and this one had none.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Gating personas withholds them from both layers | implementation | The partition is a removal and has no repair path; if the global layer does not carry a persona the project layer stops writing, it is delivered nowhere | 2.3 confirms global carriage BEFORE gating, and the fresh-checkout branch of `partitionVerdict` still returns full projection | Phase 2 — Measure the two duplicated families, then decide each |
| 2 | `--enforce` flips on an invariant that is true only on this machine | implementation | Every figure in this roadmap is a property of one machine's two layers; a flip argued from them reds a topology no contributor has, or passes green on blindness | 1.2's unknown-family failure and the existing dead-scope refusal both fire independent of topology; the flip is gated on fixtures, not on this machine's reading | Phase 3 — Bind enforcement to the invariant, and stop printing a dead remedy |
| 3 | The command probe answers only for one host version | implementation | `claude -p` observes one binary, one config, one auth context; a dedup claim measured once becomes another unqualified claim the moment the host moves | 2.1 records host version and inputs with the reading, and 2.2(a) encodes the exception where a later contradiction reds the gate rather than being invisible | Phase 2 — Measure the two duplicated families, then decide each |
| 4 | The work is priced on a saving that does not exist | product | If no host reads `.claude/personas`, the duplication costs zero context and the roadmap's value is consistency alone — which is real but much smaller than a token figure implies | 2.4 forces the price to be stated, including zero, before 3.1 is argued | Phase 2 — Measure the two duplicated families, then decide each |
| 5 | Unknown-family failure fires on a legitimate new directory | implementation | A new family, or a host's own directory appearing under `.claude/`, reds the check for everyone until someone updates the known set | The failure names the family and the one-line fix; it is a report-mode check until 3.1, so the first occurrence cannot block a build | Phase 1 — Make the measurement complete before enforcing anything on it |

## Honest null consequence — REALISED, and it is the outcome

Both conditions fired. 2.1 found the host does dedupe commands (and that the
project copy loses); 2.4 found no host reads `.claude/personas` at all. So the
**context saving from this roadmap is 0 tok** and that is the honest headline,
not a footnote. The parent roadmap's measured 96,584-token saving stands on rules
and skills and is not re-attributed here.

What was delivered instead, and it is smaller than a token figure would have
implied:

- a delivery measurement that no longer skips two of the six families the
  generators emit — one of which (`personas`) was the only family this repository
  actually delivered twice;
- a check that **refuses** on a family nobody taught it about, so the omission
  that produced this roadmap cannot recur silently;
- two duplicated families removed at the producer, with the stale output
  reconciled rather than left standing;
- a first-party measurement of a host-dedup claim that had been carried on
  reasoning for three weeks — including the precedence half nobody had asked;
- one enforcement promise retired as structurally void instead of left pending,
  and two remediation strings that name a mechanism a reader can actually run.

And one correction that matters more than any of them: **three of this roadmap's
own steps asked for something that was wrong on contact with the code** (a
`SKIPPED` set that would void a gate exemption, fixtures for states that do not
occur, a class-wide `--layer` test that would break the installer's own help).
Each is recorded at its step with why it was not built. A roadmap executed
literally would have shipped all three.

## Acceptance Criteria

- [x] AC-1 — every family `_CLAUDE_SKILL_BUNDLE` ships is compared by the
      measurers. **Met, and wider than asked:** both lists read all SIX families the
      generator registry declares, not just the installer's four. The
      "or listed as skipped" half was dropped on purpose — see 1.1.
- [x] AC-2 — a family directory the measurers do not know about makes the check
      exit non-zero and name it. **Met**, in report mode too, sabotage-verified
      (`.claude/widgets` → exit 1; removed → exit 0).
- [x] AC-3 — `personas` is delivered from one layer on a partition-active tree,
      and a tree an earlier version populated is reconciled by one generator run.
      **Met:** `.claude/personas` 29 → 0 in one run, `.cursor/personas` untouched
      at 29, global carriage verified first (0 of 29 missing).
- [x] AC-4 — the 40 command overlaps are either gone or carry a dated,
      host-version-stamped measurement. **Met on both halves:** the measurement
      exists (host 2.1.238, with a control probe) AND the overlap is gone, because
      the measurement showed the project copy loses. No exception was needed.
- [x] AC-5 — `--enforce`'s gating condition names the reason, and no remediation
      string offers `install --layer`. **Met with a correction:** the condition is
      structural, not the invariant — the flip is void in preflight, measured.
      `install.ts`'s own flag help is untouched and must stay so.
- [x] AC-6 — the context cost of the duplication this roadmap removes is stated
      as a number, including zero. **Met: it is zero**, and § Honest null
      consequence leads with it.
