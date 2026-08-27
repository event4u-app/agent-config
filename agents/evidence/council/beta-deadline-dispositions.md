<!-- evidence-type: analysis -->
# Council decisions — the three beta contracts that lapsed on 2026-08-26

**Round 1** · 2026-08-27 · anthropic/claude-sonnet-4-5, openai/codex-default · 2 rounds · blind peer review · quorum 2/2 concluded · $0.0570

**Round 2 (correction)** · 2026-08-27 · anthropic/claude-sonnet-4-5, openai/codex-default · 2 rounds · blind peer review · quorum 2/2 concluded · $0.0541

| Contract | Round 1 | Round 2 | Landed |
|---|---|---|---|
| `ci-green-floor` | extend | not re-put | **extend to 2026-09-04** |
| `adoption-signal-floor` | **promote** | **extend** | **extend to 2026-10-19** |
| `plain-language-surface` | promote | not re-put | **`promote-to: stable`** |

## Why there was a second round, and why it is not verdict-shopping

Round 1 decided `adoption-signal-floor` on a framing **I** wrote which asserted
"nothing in the file is marked open, pending, or undecided". That was false: its
§ Extraction demand gate holds a live 90-day bet whose window closes 2026-10-18
and whose outcome is recorded nowhere. Both seats' PROMOTE reasoning had rested
on a "zero open clauses" axis that the omitted fact bears on directly.

The re-put stated the correction, quoted the earlier verdict back, and asked the
seats to say plainly if they were holding it. Both returned **B, extend**, and
one wrote: *"I am not holding an earlier verdict; on the corrected record, my
verdict is B."* The other two contracts were **not** re-put — a correction is to
one framing, not a second bite at a round.

## Round 1 — verdicts verbatim

### anthropic/claude-sonnet-4-5

# Assessment — Round 2

## 1. Agreement with prior reviewers

I **agree with both Reviewer A and B** on the three verdicts (`1: extend | 2: promote | 3: promote`) and most of their reasoning. Specifically:

- **Reviewer A & B on Contract 1:** Both correctly identify the explicit open work — two advisory-table rows with named completion criteria. The contract's own text declares the partition "not final," making this unambiguous.
- **Reviewer A & B on Contract 2 & 3:** Both recognize that **event-triggered re-audit is appropriate for a stable contract**, not evidence of beta status. This is the key insight that avoids the trap.

## 2. Disagreement — authority question only

**Reviewer A's directional-policy reading** (`decision-revisit-gate`: strengthening = council, weakening = owner) is sophisticated but potentially over-broad. It might establish general promotion authority where none was intended.

**Reviewer B's bounded-delegation reading** is more conservative and probably correct: the maintainer delegated *this specific drain run's decisions*, not a standing authority to promote any beta contract. I agree with **B's interpretation** as the safer one.

## 3. New points and refinements

### The baseline freeze is structural honesty
The gate **refuses to expand** the 2026-08-25 baseline, forcing exactly three remedies. This prevents "defer by adding to exceptions" — the failure mode beta deadlines exist to stop. The five blocked PRs create urgency, but neither reviewer fell into hasty promotion under pressure. Good.

### Contract 1's self-documenting incompleteness is the gold standard
Its text explicitly says "this partition is not final" and names the blocking work. That's what a genuinely-beta contract should look like. The others don't carry comparable markers.

### For Contracts 2 & 3, the DATE was the wrong instrument from the start
Both have **event-triggered re-audit cadences** appropriate to their concerns. A calendar date fires on a day nobody chose, while the real trigger is an event that hasn't happened. A better beta-exit criterion for such contracts might be: *"beta until N enforcement passes + zero open policy questions"* — measurable from CI/lint, not a schedule.

### "Settled vs quiet" — the missing discriminator
The prompt asks what makes a contract "settled rather than merely quiet." Both reviewers applied this implicitly but didn't state the test. Here it is:

| Settled | Quiet |
|---|---|
| Enforced (deterministic gate exists and passes) | No enforcement, or unenforced |
| Active (N references, collector runs, lint reports) | Low/zero references, no usage signal |
| Complete (zero open clauses, no "pending" markers) | Open questions, deferred sections |
| Event-based review appropriate to concern | No review trigger, or only calendar |

Contracts 2 & 3 are **settled** on all four. Contract 1 fails "complete."

## 4. Final answer

`1: extend | 2: promote | 3: promote`

### Contract 1 — EXTEND (90 days)

**The ONE thing that must happen:** Both blocking rows (`cloud-release.yml` + `deploy-mcp-worker.yml`) must meet their stated consecutive-run criteria, and their final blocking/advisory classifications must be **recorded in the contract** (not just in CI). This is measurable from CI history, not a schedule.

**Why this is a fact, not deferral theatre:** The contract's own text declares the partition "not final" and names the two pending migrations. Promoting now would encode an explicitly unfinished state as authoritative.

**Revisit when:** Either workflow meets its criterion, OR the maintainer formally rejects the proposed reclassification.

---

### Contract 2 — PROMOTE

**What makes it settled:**
- **Enforced:** Collector exists (`adoption_snapshot.ts`) and runs in production.
- **Active:** 9 file references.
- **Complete:** Zero open clauses, zero "pending" markers.
- **Appropriate review:** Event-triggered re-audit (new signal proposed, consumer asks for forbidden thing, quarterly trend check) is **exactly what a stable privacy floor should do** — adapt on real triggers, not calendar dates.

The date-based beta marker was the wrong instrument here from the start. The contract is doing what a mature privacy floor does: hold the boundary, reconsider on events that matter.

**Revisit when:** A consumer requests something the floor forbids, OR a new adoption signal is proposed that crosses the LOCAL-ONLY boundary, OR the quarterly trend review reveals drift.

---

### Contract 3 — PROMOTE

**What makes it settled:**
- **Enforced:** `lint_role_experiences --plain-language` passes today (299 skills indexed).
- **Active:** 3 file references (low count reflects narrow surface — relabel matrix for non-dev audiences — not immaturity).
- **Complete:** Zero open policy questions.
- **Appropriate review:** Event-triggered (new non-dev surface introduces uncovered terminology, OR lint and matrix diverge).

The stale See-also path (`scripts/lint_role_experiences.py` → should be `.ts`) is a **documentation defect**, not beta evidence. The link resolves; the text is wrong. Fix it as ordinary maintenance.

**Revisit when:** `lint_role_experiences` reports a pattern class not covered by the matrix, OR a consumer interaction reveals a term-mismatch the relabel doesn't handle.

---

## 5. Authority — inside council's delegated scope, not standing

**Bounded delegation for this drain run only.** The maintainer delegated "owner-reserved decisions for an autonomous drain run" and named the three remedies (promote | extend | supersede). That grants the specific authority to promote **these three contracts in this run**, but does not establish general promotion authority beyond it.

**Why this is inside scope:** From the owner-reserved table, "Governance self-amendment" means reopening rules, quorum, escalation. Beta→stable is **not** that — it's moving along a declared maturity path with the maintainer's explicit delegation. The council may decide.

**Why this does NOT create standing authority:** This is bounded delegation for a specific decision set, not a transfer of the general promotion power. Subsequent beta contracts would still need owner decision or explicit delegation.

---

## End summary

Extend Contract 1 until its two classification outcomes are resolved; promote Contracts 2 and 3 under the council's explicitly delegated authority for this drain run. The baseline freeze forced this review rather than allowing silent deferral — working as designed.

### openai/codex-default

Matze, my assessment is **mixed**: extend Contract 1; promote Contracts 2 and 3. No contract has an identified successor, so supersession is unsupported.

`1: extend`  
`2: promote`  
`3: promote`

**Contract 1 — extend.** Its “advisory table” records unresolved work that could change the classification boundary the contract defines. Reference count demonstrates importance, not maturity. The single prerequisite for promotion is: **resolve both named workflow classifications using their stated operational criteria and record the resulting classifications in the contract**. Revisit when either criterion is satisfied or explicitly rejected by the maintainer.

**Contract 2 — promote.** The privacy boundary is settled rather than merely quiet because it is explicit, operationalized by a running collector, referenced by consumers, and contains no identified policy decision awaiting resolution. One correction to the proposal: a “quarterly check” is calendar-triggered, even without a fixed date. That factual error does not justify continued beta status; recurring audits are compatible with stable policy. Revisit when a proposed signal or consumer request would cross the local-only, non-correlating boundary.

**Contract 3 — promote.** The matrix is a complete normative rule with deterministic enforcement across 299 indexed skills. The stale Python-path label is ordinary documentation drift and should be corrected in the promotion change; it does not show unresolved vocabulary policy. However, lint proves internal conformance, not that non-developer audiences understand the labels. Revisit when user research reveals a comprehension failure, or when a new surface introduces terminology absent from the matrix.

**Authority.** Promotion may ordinarily be owner-reserved because it increases compatibility expectations and the cost of later revision. Here it is within the council’s authority only because the maintainer expressly delegated “owner-reserved decisions for an autonomous drain run” and explicitly asked the council to choose among remedies including promotion. I therefore agree with Reviewer B’s bounded-delegation argument. I disagree with Reviewer A’s broader claim that promotion inherently belongs to the council as “strengthening”: that depends on governance text not supplied here and could incorrectly establish a general precedent.

**Round-one assessment.** I agree with both reviewers’ substantive verdicts and with Reviewer B that stability does not mean immutability. I disagree with their claims that the collector runs “in production”; the supplied evidence says only that it “exists and runs.” Reviewer A also calls the two Contract 1 entries “blocking rows,” although the proposal identifies them as advisory rows. Reviewer B’s evidentiary caution is the strongest counterargument: summaries and passing tooling do not establish real-world maturity or adoption.

**Concrete next steps:** extend Contract 1 with the unresolved classification outcome as its reason; promote Contracts 2 and 3; fix Contract 3’s stale path in the same change; and record that the council’s promotion authority is limited to this delegated drain run.

**End summary:** Extend 1 until both workflow classifications are resolved; promote 2 and 3 under bounded delegated authority.

## Round 2 — the correction, verdicts verbatim

### anthropic/claude-sonnet-4-5

Matze,

## 1. Assessment

**B — EXTEND to 2026-10-19** (one day past the demand-gate window close).

I agree with both prior reviewers that the unresolved demand gate blocks promotion. The distinction between "recorded bet" and "undecided clause" is sharp in theory but collapses here because **roadmaps gate their own work on this contract's outcome**. That dependence elevates the experiment from observational to material — it's not merely documenting a test, it's a live input to planning.

## 2. Strongest argument for this position

**Promoting now creates a certification mismatch.** Calling the contract "complete" means it needs no further amendment, but we already know the demand-gate outcome must be recorded in 52 days. The collector's evidence file doesn't exist on this tree, so the experiment hasn't even started. Promoting before the experiment concludes certifies something as settled when its own stated success criterion cannot yet be evaluated.

The roadmap dependencies compound this: extension work and a dormant marker both wait on this gate's resolution. That's not peripheral; it's structurally load-bearing.

## 3. Strongest counter-argument

**The demand gate tests future extraction demand, not the baseline privacy contract.** The normative content — the privacy floor itself — is already settled and unhedged. The experiment asks "should we build extraction tooling?", not "are the privacy protections sound?". A contract can be normatively complete while still testing optional extensions. Promoting now doesn't prevent recording the outcome later; it just separates promotion from a bet about future scope.

## 4. Concrete next steps

- **EXTEND** the review date to **2026-10-19**.
- At that review, require a recorded decision (floor met / floor missed / experiment abandoned) with either auditable evidence from `agents/runtime/metrics/adoption-snapshots.jsonl` or an explicit no-data statement.
- Resolve the two dependent roadmap items at the same review.
- If the demand gate is met, record the extraction-work go-ahead; if missed, record the permanent no-extraction stance.

---

## Engagement with prior critiques

### Reviewer A
I agree with:
- The empirical/normative split
- The collector file absence as evidence the bet hasn't run
- The "promoting before conclusion defers known work" framing
- The revisit date (2026-10-19)

I refine: your "not yet started" is correct — the store doesn't exist — but the stronger weight is the roadmap dependencies, which make the outcome material rather than merely observational.

### Reviewer B
I agree with:
- Operational unresolution as the blocker
- Roadmap dependence making the outcome material
- The normative-floor-is-settled acknowledgment
- The revisit condition

I refine: your "neither outcome is recorded" is correct, but I'd add that the absence of the collector's output file means the experiment hasn't been run at all, not just that its outcome is unwritten.

### New point not raised in round 1

The **certification mismatch** framing: promoting now would certify "complete" for a contract that explicitly states a time-boxed success criterion we cannot yet evaluate. That's not "recording a bet" — it's pre-certifying an incomplete experiment. The roadmap dependencies are what tip this from "observational curiosity" to "material gate."

### openai/codex-default

Matze,

**B — EXTEND past 2026-10-18.** I agree with Reviewer B that a recorded experiment does not inherently make a contract incomplete, but this experiment remains materially open: § “Extraction demand gate” has an unresolved success criterion, two roadmaps depend on its result, and no outcome is recorded. The strongest case for B is therefore not merely the missing metrics file, but that promotion would certify “complete” before a consequential branch has resolved. The strongest counter-argument is A’s distinction: the privacy floor is already normative and stable, while the gate concerns future extraction demand. I nevertheless find that distinction insufficient because the prior PROMOTE verdict expressly relied on “zero open clauses.” I agree with Reviewers A and B on extending; I disagree with Reviewer A’s claim that the absent JSONL file proves the experiment “hasn’t actually run”—absence from this tree establishes only that evidence is unavailable here, not that no production collection occurred. A further refinement is that 2026-10-19 should be the earliest review date, not an automatic promotion date. I am not holding an earlier verdict; on the corrected record, my verdict is B.

**Revisit condition:** Reassess on or after 2026-10-19 only when a durable decision records “floor met,” “floor missed,” or “experiment invalid/abandoned,” cites the available evidence—including an explicit no-data finding if applicable—and resolves the dependent roadmap branches.

## Two things worth keeping, from the seats rather than from me

**The settled-vs-quiet discriminator.** One seat supplied the test the question
asked for and neither round-1 reviewer had stated:

| Settled | Quiet |
|---|---|
| Enforced — a deterministic gate exists and passes | no enforcement, or unenforced |
| Active — references, a collector that runs, a lint that reports | low or zero references, no usage signal |
| Complete — zero open clauses, no pending markers | open questions, deferred sections |
| Reviewed on a trigger appropriate to its concern | no trigger, or a calendar date only |

**A correction to my own argument, from the same seat.** I argued that an
event-triggered re-audit cadence makes a calendar date the wrong instrument.
`adoption-signal-floor`'s cadence includes a *quarterly check*, which is
calendar-triggered — so that argument was weaker than I put it, and is recorded
here at its real strength.

## Authority

Both seats, in round 1, addressed whether promotion is the council's to decide
and converged on the **bounded** reading: the maintainer delegated
owner-reserved decisions *for this drain run* and named promotion among the
three remedies, so the council may promote **these contracts in this run** and
acquires no standing authority to promote any beta contract afterwards. One seat
explicitly rejected the broader argument that promotion is council-decidable
because it "strengthens" a floor, on the ground that it would establish a
precedent from governance text nobody had supplied.

That bound is recorded on `plain-language-surface` itself, not only here.
