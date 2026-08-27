<!-- evidence-type: analysis -->
# Council decision — disposition of `road-to-kernel-invariant-restoration`

**Date:** 2026-08-27 · **Members:** anthropic/claude-sonnet-4-5, openai/codex-default · **Rounds:** 2 · **Peer review:** blind · **Quorum:** 2/2, needed 1 — concluded · **Actual cost:** $0.0404

**Verdict: 2/2 convergent — Option 3**, archive and transfer, with a **hard
precondition**: only after the open item lands in a durable, dashboard-visible
owner queue that is *verified to render*. Both seats said, in their own words,
that archiving without a real transfer target is Option 2 (park it in `later/`)
wearing Option 3's label.

## Why this record exists rather than a link

Council artefacts under `agents/runtime/council/` are gitignored and auto-pruned
after the retention window, so a path to one is a reference that rots
(`no-roadmap-references`, council clause).

## Verdicts, verbatim

> **One path below does not exist, and that is deliberate.** Both seats propose
> creating `agents/owner-actions.md`. It was not created — see § The one <!-- ref-ignore -->
> correction the implementation made to the decision. The lines naming it carry
> a `ref-ignore` marker so the reference checker does not read a quoted proposal
> as a broken link; the transcript itself is unaltered.


### anthropic/claude-sonnet-4-5

Matze, I'll engage with the prior critiques and then state my verdict.

## 1. Points I agree with

**Reviewer A:**
- The dashboard-as-queue falsification is compelling — if it functioned as a monitored action queue, the red `check_rule_invariants` blocking `task ci` for all contributors would have been cleared by now.
- "Archiving claims completion of the roadmap's work, not completion of every consequence that work produces" — this is the key distinction both reviewers make well.
- The transfer target must be real, dashboard-visible, and in the maintainer's actual path.

**Reviewer B:**
- "Making 'active roadmap' mean 'work agents cannot advance'" is the right framing of the cost.
- The operational honesty — "if the dashboard doesn't consume it, archiving is Option 2 with better paperwork" — is the load-bearing check.
- The "transferred, not completed" marking preserves intellectual honesty.

## 2. Where I push back

Both reviewers assume Option 3 is clearly superior, but neither addresses the systematic problem: **nine kernel files are guarded, and this is the first human-only item to surface**. If we create a queue artifact for this one edit, we're building infrastructure for a class that recurs by design. That's fine — but it shifts the question from "how do we dispose of this roadmap" to "how do we systematically handle agent-forbidden kernel edits going forward."

Reviewer A's revisit condition ("if dashboard is demonstrated to be monitored over 2 weeks") is measurement theater — it defines success as something that would have already happened if the mechanism worked. If the dashboard isn't being monitored now, waiting 2 weeks won't change that.

Both propose similar transfer targets but don't verify dashboard integration exists. Reviewer B states this as a condition ("verify it appears in generated dashboard output"), but that's a prerequisite for Option 3 to be honest, not a revisit trigger.

## 3. New point: Reframe the drain goal

The real tension neither reviewer names: **"drain to empty" vs "drain of agent-actionable work" are different goals**, and the latter is the one that actually serves the purpose. A roadmap containing only human-authorized edits does not represent unfinished agent work — it represents the boundary of agent authority working as designed.

If we revise the drain goal to **"no agent-actionable work remains in active estate"**, then:
- This roadmap archives now (its agent work is done)
- The open item transfers to a human-only queue (which Option 3 proposes anyway)
- Future kernel-edit items follow the same path without blocking drain-completeness
- The drain metric becomes meaningful: it measures agent completion, not the absence of all work

## My verdict: **Option 3**, with one critical condition

**Archive the roadmap and transfer the open item**, but ONLY after:

1. `agents/owner-actions.md` (or similar) exists as a durable, dashboard-visible queue <!-- ref-ignore -->
2. `./agent-config roadmap:progress` or equivalent CONFIRMS it appears in dashboard output
3. The transfer includes: file, line, protected literal, blocker (guard + decision), source roadmap link

**Rationale engaging the dashboard-as-queue question:**
The dashboard is demonstrably not functioning as an action queue — the red CI gate proves it. So "keep it active for visibility" is preserving visibility on a surface that isn't watched. But archiving without a real transfer target is Option 2 wearing Option 3's label. The queue artifact must be dashboard-visible AND confirmed to render before the roadmap archives. If that infrastructure doesn't exist and can't be verified, Option 1 (leave it active) is more honest than Option 3 (archive and pretend the queue is real).

**Revisit if:**
The drain goal is challenged again by a second human-only item AND we still lack a functional owner-action queue. At that point, the goal itself needs revision to "no agent-actionable work" rather than "no roadmaps," which would make this disposition systematic rather than one-off.

### openai/codex-default

Matze — **Option 3.**

**Assessment: agree, conditionally.** Archive the roadmap only after transferring the unresolved edit into a durable, dashboard-rendered owner queue. The roadmap has completed its agent-actionable work; keeping it active conflates “unfinished autonomous work” with “authorized human execution required.” The dashboard can function as a maintainer queue only if it explicitly displays owner actions—not merely because an unrelated roadmap remains open.

**Strongest argument:** Both open items reduce to one edit that agents are structurally prohibited from making. A recurring class of human-only kernel changes needs its own lifecycle; otherwise the active roadmap estate can never reliably drain.

**Strongest counter-argument:** Transfer does not make the underlying acceptance criterion complete. Archiving could falsely signal success unless the roadmap marks the items as **transferred, unresolved**, and the dashboard visibly preserves the red invariant status and ownership.

**Round-two critique:**

- I agree with **Reviewer B** that `agents/owner-actions.md` should be created, integrated into the dashboard, and verified there before archival. <!-- ref-ignore -->
- I agree with **Reviewer A** that `later/` merely hides the work and provides no durable operating model.
- I disagree with **Reviewer A’s** claim that the unresolved CI failure proves the dashboard is not watched. Observation without resolution may reflect the authorization and soak constraints described under “Why an agent cannot make the edit,” rather than lack of attention.
- A new refinement: the queue entry needs an explicit state model—`pending-owner-action`, `scheduled`, `completed`, or `rejected`—plus an owner, creation date, exact required literal, source-roadmap link, and verification command. The dashboard should count unresolved owner actions separately from active roadmaps and expose the CI-blocking severity.

**Concrete transfer target:** Create `agents/owner-actions.md`, rendered prominently by the existing dashboard. Add an entry for `src/rules/non-destructive-by-default.md:41` containing the exact protected literal, the three authorization constraints, the council decision reference, `check_rule_invariants` as the completion check, and a backlink from both the entry and archived roadmap. Archive only after verifying the generated dashboard includes that unresolved entry. <!-- ref-ignore -->

**Revisit condition:** Reconsider this disposition if the owner-action queue is not dashboard-visible and assigned before archival, or if transferred items repeatedly remain unresolved beyond an agreed service window.

Summary: choose Option 3, but make verified dashboard transfer a hard precondition—not post-archive paperwork.

## The one correction the implementation made to the decision

Both seats specified building `agents/owner-actions.md`. **It was not built, <!-- ref-ignore -->
and that is the finding rather than a deviation.** The queue already exists:
`agents/roadmaps/stubs/` holds a *drain-run transfer* class, defined in that
directory's own README as work already planned and specified in an active
roadmap and then transferred out when an autonomous run found it needed
something no repository automation can supply — with the parent closing against
outcome state `transferred`. It is counted separately from active roadmaps in
the dashboard header and surfaced by `agent-config stubs:due`.

Building a second surface would have duplicated it, which is precisely the
systematic-infrastructure risk one seat raised, arriving from the other
direction. The council was not told the mechanism existed; the question framing
did not mention it.

**The precondition was still discharged as stated, not waived:** it required a
queue verified to render, and `agent-config stubs:due` moved from **10 owner
decisions to 11**, naming
`agents/roadmaps/stubs/road-to-kernel-clause-1-restore.md` by path.

## What was transferred, and what is honestly still open

| | State |
|---|---|
| The roadmap's agent-actionable work | complete |
| Clause 2's § 10 invariant amendment | landed |
| The mechanism question at 2.2 | answered |
| **Clause 1's restore** | **not done** — `check_rule_invariants` still exits non-zero on `main` |
| **AC-1** | **not met**, recorded as *transferred, unresolved* |

The parent's checkboxes flip because the items have a durable home in the owner
queue, never because the edit landed.

## The reframing both seats reached, stated because it generalises

"Drain to empty" and "drain of agent-actionable work" are different goals, and
only the second is meaningful. A roadmap containing nothing but
human-authorized edits does not represent unfinished agent work — it represents
the boundary of agent authority working as designed. Nine kernel rule files are
guarded by `block_kernel_rule_writes`, so this class recurs by construction.

## Revisit-if

A second human-only item arrives and the owner-action queue has still not been
consumed — at which point the disposition needs to become systematic rather
than per-item; or transferred items repeatedly remain unresolved beyond an
agreed service window.

## Delegation basis

The maintainer delegated owner-reserved decisions for this autonomous drain run
to the council. This disposition weakens no floor: the kernel edit remains
un-made, `block_kernel_rule_writes` remains in force, and the `scope-control`
soak guarantee is untouched. It changes where an open item is recorded, which
is reversible inside the authorised envelope.
