---
complexity: lightweight
review_by: 2026-09-19
---

# Stub: road to the per-turn hook-economy host reproduction

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated stub.
> Created 2026-08-20 when
> [`road-to-per-turn-hook-economy`](../road-to-per-turn-hook-economy.md) was
> drained: its whole Phase 0 is gated on **a machine this run does not have** —
> specifically the machine that produced the slowdown report, at the version that
> was installed on it when the report was made. The work could be neither
> completed nor honestly cancelled, so it is transferred. Framework of record:
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md).
> Outcome state recorded on the parent: **transferred** — chosen so that
> "archived" can never read as "achieved".

## The criteria, verbatim from the parent

Three steps, quoted whole rather than summarised, because the whole point of a
transfer is that the next reader does not have to reconstruct them.

> **0.1** On the affected machine, record: the prior installed version
> (lockfile history), the node version, the OS, and whether
> `AGENT_CONFIG_HOOKS_ISOLATED=1` is set anywhere — env, shell profile, or CI.
> That flag alone restores the retired ~1.6 s/event class, which would explain
> the entire report by itself.
> `verify:` a one-page note per machine with all four values filled in.

> **0.2** Run the § 2 matrix on that machine at the installed version and at
> 11.0.0. Decidable outcome: a per-event p50 delta above a declared threshold
> across two or more slots means the regression is confirmed and localisable;
> otherwise the latency claim closes as environment or workload, and the
> investigation moves to turn shape (`road-to-stop-gate-honesty`) and context
> (`road-to-standing-context-40k`).
> `verify:` the matrix table, both versions, at least three runs per cell.
> **Fixture sizes, so the run is reproducible rather than merely instructed**
> (from the source draft's own container run): a `post_tool_use` event with a
> 2,000,000-character `tool_response`; a `stop` event against a 3.5 MB
> synthetic JSONL transcript; a `user_prompt_submit` against a workspace
> carrying the full projected skill set. The draft's absolute cell values are
> deliberately **not** carried over — § 2's verdict already refuses to treat
> one container's milliseconds as a repo fact — but a comparison needs the
> same fixtures on both arms, and those are specifiable without claiming a
> number.

> **0.3** Read the turn-end-gate refusal state for the affected sessions and
> count refusals per session. A median above one refusal per session means the
> perceived slowness is extra model turns rather than hook wall clock.
> `verify:` the per-session counts, with the split before and after the local
> 12.1 install date.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| The four-value environment note | Phase 0 Step 0.1 | Every one of the four values is a property of **the affected machine**. Recording this machine's four values answers a different question. |
| The two-version § 2 matrix | Phase 0 Step 0.2 | "On that machine, at the installed version and at 11.0.0" — the installed version is the report's, not this tree's, and the comparison is worthless on a machine that never showed the symptom. |
| The turn-end-gate refusal census | Phase 0 Step 0.3 | "For the affected sessions." Those sessions are on that machine; this workspace holds none of them. |
| The `road-to-stop-gate-honesty` / `road-to-standing-context-40k` hand-off | Phase 0 Step 0.2's own decidable outcome | It is the *else* branch of 0.2 and cannot be taken before 0.2 runs. Carried so the branch is not lost with the parent. |

Nothing else transfers. Every other step of the parent is satisfied, narrowed,
abandoned, or deferred by an explicit decision — see its `## Outcome`. Step 0.0
already **ran** on this machine and is `[x]`; it is not part of this stub, and
its result is the reason the stub exists rather than a cancellation (below).

## Producer and probe — named, not wished

- **Producer:** the **reporter of the original slowdown**, operating **their own
  machine** at **the version that was installed on it when they reported the
  slowdown**. That is the named party — the report is what defines "affected",
  and no other person or machine can supply it. Anyone else running this matrix
  produces a different measurement with the same shape, which is exactly the
  cross-machine comparison § 2 of the parent refuses.
- **Probe — three readings, all cheap, all taken on THAT machine:**
  1. `AGENT_CONFIG_HOOKS_ISOLATED` — set in env, shell profile, or CI, yes or no.
     A single `=1` closes the whole report by itself and makes 0.2 unnecessary.
  2. The version that was installed at report time, from lockfile history.
  3. A `verify-before-complete.json` (or per-session successor) carrying a
     **non-zero** refusal count for sessions on that machine.
- **Measured on THIS machine, 2026-08-20, so a later reader can tell movement
  from noise** — every reading is the *wrong-machine* control, recorded to make
  the gap explicit rather than to pretend it is data:
  - Installed version **14.6.0**; node **v26.7.0**; OS **Darwin 24.6.0**;
    arch **arm64**. None of these is the report's environment.
  - `AGENT_CONFIG_HOOKS_ISOLATED` in this environment: **unset**. It appears in
    **7** tracked files, all of them code and docs that read or document the
    flag — no shell profile, no CI export. So the flag hypothesis is **untested**
    here rather than refuted: this machine never had it, which says nothing about
    the machine that did.
  - Turn-end-gate refusal state on this checkout: **absent**. The parent checkout
    holds exactly one `verify-before-complete.json`, and it is a **May smoke
    fixture** (`session_id: "smoke-cowork-1"`, dated 2026-05-05, every counter
    `0`). Two consequences, and the second is the sharper one: there are **zero**
    real refusal records to census, and the schema present on this machine
    carries `verifications_this_turn` / `verifications_this_session` and **no
    refusal counter at all** — so 0.3's "count refusals per session" is not
    derivable from this shape even with the right sessions. Whoever promotes this
    stub should expect to add the counter, not just read it.
  - 673 per-session dispatcher feedback directories exist under the parent
    checkout's state tree. They are this machine's sessions, which is why the
    number is recorded and then set aside.
- **Nothing but the affected machine moves this stub.** A faster or slower
  machine, a fresh install at the same version, or a CI runner all produce a
  measurement of something else. This is a capability gate in the strict sense:
  the scope decision was made when the roadmap was adopted, the work is wanted,
  and the missing thing is an environment.

## Carried forward so the reasoning is not lost with the parent

**The parent's § 3 finding, and it is the most valuable thing in this stub.**
The reported "fast before 12.\*, slow since 12.1.\*" **does not reproduce at the
dispatcher level** between 11.0.0 and 13.0.0 in the source draft's environment,
and the parent states plainly that **the current best candidate is not in that
file at all** — it is the **mixed-trigger activation flip** owned by
[`road-to-mixed-trigger-activation-cost`](../later/road-to-mixed-trigger-activation-cost.md).
Read the two together or the wrong one gets the work:

- Every fix in the parent is justified by **structural** cost (per-turn
  summation, payload-proportional churn, two escaping spawns), never by a
  version regression. Those fixes landed on their own merits and two of the
  three phases returned measured **nulls**.
- Phase 0 exists to find what the reporter actually hit. It is a **different
  question** from the structural one, and it is the question this stub holds.
- So if this stub is ever promoted and 0.2 comes back **negative**, that is not
  a failure — it is 0.2's own declared outcome, and it routes to turn shape and
  standing context, not to another latency phase.

**Step 0.0 already narrowed the field, and its result is why 0.1-0.3 are a
transfer rather than a cancellation.** The rule-activation census ran here on
2026-08-18 at both projection scopes: 117 rule files, 25 declaring a path-shaped
trigger, **17 mixed** and **8 path-only**; the projection reads 111 files with
**8** declaring `paths:`, equal to the source's scoped count. So the flip is
**not** live on this machine and the latency matrix does **not** become
secondary. Had the flip been live here, 0.1-0.3 would have been cancellable on
the parent's own terms. It was not, so they had to move.

**One caution the parent records and this stub inherits:** the `grep -l
'^paths:'` one-liner is **refuted** as a discriminator — it returns zero on a
maintainer machine regardless of the flip, because the local projection emits no
`paths:` for any rule. Use the census. A promoter who reaches for the one-liner
will get a confident wrong answer.

## Promotion gates

The README's shared promotion criteria (recruited customer, funded security
audit, ADR sign-off) **do not govern this stub** — see that file's
`## Drain-run transfers` section. These do:

1. **The named producer runs the probe on the affected machine.** Reading 1
   alone can close the whole thing: `AGENT_CONFIG_HOOKS_ISOLATED=1` anywhere in
   that environment explains the report and retires 0.2 unrun.
2. **Reading 1 comes back negative AND the installed version at report time is
   recoverable from lockfile history.** Without the version there is no second
   arm, and a one-armed matrix is not the comparison 0.2 specifies.

Gate 2 is deliberately an `AND`: a matrix run against a guessed prior version
would produce a number nobody can attribute, which is the shape § 2 of the
parent refuses as a repo fact.

## Seed content on promotion

- Write the 0.1 one-page note with all four values filled in **for that
  machine**. Four values, not three — the flag is the one that can end the
  investigation on its own.
- Run the § 2 matrix at both versions with the fixture sizes quoted above
  (2,000,000-char `tool_response`; 3.5 MB synthetic JSONL transcript;
  full-projected-skill-set workspace), at least three runs per cell, and declare
  the p50 threshold **before** the run rather than after it.
- For 0.3, expect to **add** a refusal counter before censusing one: the schema
  observed on a maintainer machine has no such field. Then split the per-session
  counts before and after that machine's 12.1 install date.
- If 0.2 is negative, close it as its own decidable outcome and route to
  `road-to-stop-gate-honesty` and `road-to-standing-context-40k` — not to a
  fourth latency phase.
- Re-read `road-to-mixed-trigger-activation-cost` first regardless. It is the
  more likely cause on the parent's own evidence, and this stub exists partly to
  keep that pointer alive.
