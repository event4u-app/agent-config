# Roadmap-Process Loop — Branches (run)

Branch-only body of [`roadmap-process-loop`](roadmap-process-loop.md), moved
out verbatim so the core stays a single read. Each section below is loaded
from the pointer line the core carries at the moved section's place, and only
when a run reaches that branch; the Iron-Law fences stay in the core.

## 5. Step loop

   ```
   parallel:
     - view agents/roadmaps/<file>.md     (the step's section)
     - view <files cited in the step text>
     - codebase-retrieval (only if the step is vague)
   ```

   Anti-pattern: `view step` → think → `view file A` → think →
   `view file B`. That's 3 round-trips for what should be 1.

   Fire/no-fire pair (falsifiable — the discriminator is whether a
   call's *input* depends on another call's *output*, never the count):

   - **Fires (batch these):** a step says "update the hook, its test,
     and the manifest entry" → `view src/scripts/hooks/foo_hook.ts` +
     `view tests/scripts/foo_hook.test.ts` +
     `view src/scripts/hook_manifest.yaml` are three independent reads
     whose paths are all known BEFORE the first call — dispatch all
     three in ONE parallel block. Issuing them serially is the
     violation: each extra round-trip re-transmits the accumulated
     context as input for zero new information.
   - **Does NOT fire (stays serial):** `grep -rn "buildAdvisoryLine"
     src/` → then `view <the file the grep found>`. The second call's
     path IS the first call's output — batching would mean guessing the
     path, and a guessed read is worse than a round-trip. Dependent
     calls stay serial; only the independent remainder batches.

   - **Council on** (toggled manually, or auto-enabled for the run by
     an accepted execution contract — § 3) → invoke per
     [`ai-council`](../../skills/ai-council/SKILL.md), integrate
     convergence, proceed. Token spend was opted in (the contract
     summary named the members). `high_impact` / `user_required`
     classifications still escalate to the user per
     [`ask-when-uncertain`](../../rules/ask-when-uncertain.md).
   - **Second-model rung, when the class declares one**
     (`decision_resolution.classes.<cls>.second_model`, UOTL Phase 4.1)
     → one local vendor-CLI pass under subscription auth. **The rung is
     MODEL-CARRIED: the key is declared and schema-validated, and no
     TypeScript path reads it at runtime** — so "bounded by the
     `cli_call_budget` counter" is what the rung must respect, never
     something a booking consumer enforces (`cli_call_budget.ts` declares
     its consumer set closed at two, and this is not one of them). Stated
     rather than implied after R2 round 4 finding 4 found the coupling
     asserted on three surfaces at once. Available
     to `trivial` / `low_impact` / `medium_impact` only; the config
     schema REFUSES the key on `high_impact` and `user_required`, so no
     locked question can reach it.

   - **No self-adversarial fallback.** With neither a council nor a
     second-model rung available, the ambiguity halt STANDS. The gap is
     never filled by the agent arguing both sides of the question to
     itself: a monologue produces a verdict with no independent
     observer, which is the failure
     [`evaluator-independence`](../../rules/evaluator-independence.md)
     exists over, and reads as convergence to whoever finds it later.
     Halting costs one turn; a manufactured verdict costs the trust in
     every other verdict the run produced.
   - **A resolution taken WITHOUT contacting the user is recorded** —
     `agent-config decision:memo write --run <id> …` (question, chosen
     option, reasoning, resolver, confidence). The run's PR description
     links the directory. Not a gate: the memo is what makes an
     autonomous resolution reviewable after the fact, which is the
     condition under which it is legitimate at all.

   The failure this catches is quiet: "nothing to do here" reads identically to
   "already done", and one of those is a closed step while the other is a lost
   one. A step citing no paths is unaffected — there is nothing to check, and
   inventing a doubt would fire this on every prose step.

### 5b. Flip-guard — deterministic

   (`git status --porcelain`, not `git diff` — a roadmap file that is
   still **untracked**, e.g. in a fresh worktree, is invisible to
   `git diff` and would false-halt; `--porcelain` reports both `M`
   and `??`.)

   **One deterministic self-fix, contract mode only.** A forgotten flip is the
   one halt class whose repair is mechanical — the work is on disk, the step is
   named, and the glyph follows from the outcome. Halting a contract run on it
   spends a user contact to retype something the run can derive. So inside an
   accepted contract the run may attempt the flip **once**, and only when all
   four hold:

   1. **The work is citable.** The step's landed change is identifiable in this
      iteration's own output — a diff, a file path, a command result. No
      evidence, no flip: that is a genuine halt, not a forgotten one.
   2. **The glyph is unambiguous.** `[x]` only for a step whose evidence is
      present and, where the step carries a `verify:` field, whose fresh green
      run is in this reply. Anything that would be `[~]` or `[-]` is a
      *disposition*, never a repair — those halt exactly as before, because a
      deferral and a cancellation are decisions.
   3. **Exactly one attempt, per run.** Not per step. A second forgotten flip
      in the same run halts: one is a slip, two is a broken loop, and the
      difference is the whole justification for allowing the first.
   4. **The attempt is verified, then re-guarded.** Re-run the
      `git status --porcelain` probe above after the flip. Still empty → halt
      loudly as before. A self-fix that cannot prove itself is
      indistinguishable from the failure it was repairing.

   The attempt is recorded as a decision memo (§ 4 handling), so an auto-flip is
   reviewable after the fact rather than invisible. **Kill criterion, from the
   originating roadmap and repeated here because a flip is a write to the source
   of truth: one wrong auto-flip removes this allowance** and returns the guard
   to halt-always. Reversibility is the deletion of this block — the guard
   underneath it never changed.

   This guard is the deterministic counterpart to the rule's
   pre-send self-check — it catches a forgotten flip per step, not
   only at run end. It runs in every scope (`process-step`,
   `process-phase`, `process-full`); the cost is one `git diff` per
   step.

   **`verify:` gate (when a step carries one).** If the step declares a
   named `verify:` command (roadmap step-field convention, see
   [`templates/roadmaps.md`](../../templates/roadmaps.md)), a `[x]` flip
   additionally requires a **fresh green run of that exact command this
   iteration** — its passing output present in this reply or an earlier
   one this run. Flipping a `verify:`-bearing step to `[x]` without that
   fresh green run is the same class of violation as a forgotten flip:
   **halt loudly** ("step \<N\> flipped without its `verify:` run —
   \`<cmd>\`"), do not auto-fix. This is a check on existing output, not a
   new loop or a new script — the agent runs the step's own command, the
   same way `think-before-action`'s `step → verify:` planning already
   asks. Steps with no `verify:` field are governed by the flip-guard
   above unchanged (agent-decidable exit/acceptance criteria remain the
   default; `verify:` is the opt-in machine-checkable tightening).

6. **Dashboard regen — fixed cadence** (§ 4). Run
   `./agent-config roadmap:progress`:
   - after the 5th, 10th, … closed step **of this run**, or when the
     reply ends with closed steps pending regen;
   - at a phase boundary — the boundary handler in § 5 wrapper / § 6
     runs it;
   - on any file-shape touch (rename / phase add / archive — Iron Law 1)
     → run immediately regardless of cadence.

   Skipped regens accumulate into the next due regen — the markdown
   file is the source of truth between regens.
7. Run quality pipeline if cadence is `per_step`.

### 5d. Resuming a run whose previous session died

A session above the recycle threshold and inside a running contract leaves a
**deterministic checkpoint** at
`agents/runtime/state/checkpoints/<run>.json` — open / done / parked counts,
the next open step, and the commit the tree was on. Every field is recomputed
from the roadmap on disk rather than summarised, which is what makes the next
line possible.

The first act of a resumed run is `agent-config run:supervise --verify <slug>`:
it looks the checkpoint up **by roadmap slug**, re-verifies it against the
current tree and prints the per-field report, naming any newer checkpoint file
that does not read. Exit 1 means a field moved — a signal, not a halt (below).
The slug, not the run id: a relaunched session has a NEW
session id, so the run-id-keyed `readCheckpoint` cannot find the checkpoint the
DYING session wrote, and this instruction named an unreachable path until the
R2 review's finding 7. The slug is the one key a resumed run holds by
definition, because claiming the same roadmap is what makes it a resume.

The per-field report then names WHICH claim went stale, which is what a bare
"stale/fresh" verdict cannot. **A disagreement is not an error**: work landing
between the checkpoint and the resume is the normal case (a human committed, a
sibling worktree moved, the dying session finished a step it never recorded),
and the `actual` column is what to resume from. Treating progress as corruption
would refuse every healthy resume.

**The checkpoint carries a repository fingerprint too, not only roadmap counts.**
`context_fingerprint` is the `roadmap:context --fingerprint` value the dying run
last held. Every other field on the checkpoint reports **roadmap** drift; none
reported **repository** drift, so a run resumed after a long gap trusted a context
reading it never re-took — the exact staleness § 4's refresh exists to end,
reappearing across the one boundary a mid-run cadence cannot see.

A resumed run therefore re-probes and passes the fresh fingerprint to the
verification — `run:supervise --verify <slug> --fingerprint <value>`. A disagreement forces a full re-probe and the § 5e reactions
**before the first step**. A `null` or absent value on either side reads as *not
known* and never as a disagreement — the same rule `head` already follows, and for
the same reason: a false alarm on the field whose job is to say whether anything
moved trains the reader to skip the line.

`agent-config run:supervise --once` reports which runs died with open steps
left. It never merges, pushes, or closes anything — that boundary is a named
rejection, not a missing feature.

### 5e. Context refresh — four reactions, enumerated and closed

At each due point (§ 4 — fingerprint differs) re-probe and act. **These four rows
are the whole set.** Nothing here is a halt: none of them appears on the halt list
and none of them is a `blocked` outcome.

| # | What the refresh found | Reaction |
|---|---|---|
| a | A PR touching my owned paths **merged** since the last refresh | Run `agent-config git:convention sync --base origin/<this branch's PR base>` now — already the documented resolution, only push-bound until this row existed. Re-read the current step's files, continue. |
| b | An **open** PR touches my owned paths | Continue. Name the collision in the PR description and in the final report. **Never rebase onto a foreign branch.** |
| c | A peer session shows `PATH OVERLAP` | Take disjoint steps first if ordering allows; otherwise name it and continue. The register is advisory, never a lock. |
| d | The roadmap itself was **archived on `origin/main`** | Stop. The same **selection error** as § 1, detected late — not a halt, and no checkbox is flipped to reach it. |

Deliberately NOT a drift-level taxonomy. A severity ladder over these four would
invite a fifth row for every new shape of surprise, and the value here is that the
set is closed: an agent that meets something outside it has met an ordinary step,
not a new reaction.

Row (a) is the one that changes behaviour mid-run rather than only reporting. Rows
(b) and (c) exist to make the collision **visible in the artefact** — a run that
silently produces a conflicting PR has spent the reviewer's time, not its own.

### Forbidden non-halt reasons — agent-invented cautions

The halt list above is **exhaustive**. An agent running `process-full` (or any
wrapper) must **never** stop the run for a reason it invented that is not on
that list. In particular these are NOT halt conditions and stopping for them is
a violation of the command and the user's will:

- "running low on context / token budget" — keep landing complete steps until
  context actually runs out; never announce a boundary-stop by choice.
- "quality would degrade / this deserves a fresh focused run later"
- "avoid a PR pile-up" / "let the open PRs merge first"
- "this phase is large / touches a deep subsystem"
- "phase-checkpoints mode, so I'll checkpoint and wait" — under `process-full`
  a phase boundary emits a non-blocking status line and the run **continues**;
  the stop-and-wait reading of `phase-checkpoints` applies only to
  `process-phase`.
- **"this step looks human-gated"** — the `blocked` outcome above is reached by
  the § 3c test, never by a judgement about how a step feels. A step with no
  qualifying blocker citation is runnable, and writing the citation yourself does
  not make it one. This entry exists because the terminal outcome is the single
  most abusable thing on this page.
- **"the branch is not protected" / "a branch must be created" / "a PR must be
  opened" / "a GitHub setting must change" / "CI must be re-run" / "the merge
  base needs updating" / "there are conflicts" / "tests fail"** — every one is
  remediation work the invocation authorised (ADR-237 § 1). Do it.
- **"a paid service is needed"** — authorised inside the configured
  `cost.budgets` windows, and with none configured there is no ceiling to be
  outside of (§ Spend in the wrapper). A crossing of a configured window pauses
  and reports; it does not ask. Uncertainty about the exact cost is explicitly
  NOT a reason to ask.
- **"a maintainer should do this"** when the agent can perform the same action
  through git, `gh`, an API or a CLI. **Capability before role**: the role of the
  person who conventionally does a thing is not a property of the thing.

If the work genuinely cannot continue, it will be because one of the five real
halt conditions fired, or because every remaining step is externally impossible
by the § 3c test — surface THAT, with the specific impossibility named, not a
manufactured caution and not a convention mistaken for a constraint.
