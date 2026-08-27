<!-- evidence-type: analysis -->
# Council — 221 tokens of enforcement metadata against a zero-headroom ceiling

**Date:** 2026-08-27 · **Members:** anthropic/claude-sonnet-4-5, openai/codex-default · **Rounds:** 2 · blind peer review · quorum 2/2 concluded · $0.0578

**No convergence.** Both seats agreed the change is worth making and that all 14
declarations should land; they split on how to pay for it.

| seat | verdict |
|---|---|
| `anthropic/claude-sonnet-4-5` | **Option 1** — ship, record 221 as transfer debt with a numeric repayment target, no ceiling raise, expiry unchanged |
| `openai/codex-default` | **Option 5** — find ≥ 221 tokens of verified headroom in the SAME change, then ship |

**Landed: Option 1**, with the dissent recorded rather than resolved away. The
offset was attempted and not found — every candidate was either drive-by editing
of prose the change does not otherwise touch, or editing the gate. The dissenting
seat's own warning applies to its alternative: requiring same-change savings
"may incentivize rushed compression that makes important instructions worse".

A split is an escalation condition under `decision-revisit-gate`, and the
escalation target for this run is recorded rather than the owner, per the
delegation. The debt is placed in the owner-decision queue —
`stubs/road-to-preamble-transfer-debt-221.md`, counted by `agent-config
stubs:due` — which is the closest thing to an escalation this run can perform
without interrupting the maintainer.

## Verdicts, verbatim

### anthropic/claude-sonnet-4-5

performative. The honest question is: **do we enforce the ceiling as written, or admit it failed and govern the overage honestly?**

If we enforce as written: **reject this change** (implicitly Option 3, delayed until headroom exists). The 82-undeclared stays 82, the gap stays uncounted, but the ceiling holds.

If we govern the overage: **ship with explicit acknowledgment that the grace ceiling is emergency headroom, not sustainable budget**, and record the 221 as the cost of making an existing gap measurable. That's Option 1 or 2, but honest about what it is.

**What makes it *not* precedent:** honesty. If the decision explicitly states "the ceiling already failed; this is emergency measurement of technical debt, not normal operations," then citing it for normal rule growth is citing a declared-emergency exception. The precedent it sets is narrow: *measurement improvements may use emergency headroom when the ceiling is already in failure mode.*

But that only works if the decision **also** says the grace ceiling expires as planned (2026-11-10), no extensions, and any further growth is rejected unless the diet recovers net headroom first. Otherwise "emergency" becomes "the new normal."

---

**3. My recommendation**

**Option 1 with binding conditions**, framed honestly:

- **Ship the 14 declarations (+221 tokens).**
- **Record the cost as transfer debt in the landing roadmap**, blocking its archive until preamble ≤ 137,991 tokens.
- **Acknowledge explicitly** that this uses emergency headroom because the ceiling is already in failure mode (28% over design).
- **No ceiling raise** — the grace ceiling stays 138,212 and expires 2026-11-10 as planned.
- **No further growth** is permitted until the diet recovers net headroom, regardless of reason quality.

**Where the debt is recorded:**

In `agents/roadmaps/<name>.md`, as a blocking phase:

```markdown
## Phase N: Recover enforcement metadata cost

**Emergency headroom used:** +221 tokens for 14 enforcement dispositions
**Repayment target:** Preamble must reach ≤137,991 tokens (grace ceiling - 221)
**Blocker:** This roadmap cannot archive until verified.

Grace ceiling expires 2026-11-10. No extensions.

Verification: `check_preamble_payload_budget` reports ≤137,991
```

**Revisit condition:**

If any of these occur, this decision is reviewed as a failed experiment:

1. The transfer debt remains unpaid when grace expires (2026-11-10)
2. Any change attempts to create new transfer debt before this debt is cleared
3. The grace ceiling is raised or extended to accommodate repayment delays

The precedent this sets is: **emergency headroom may fund measurement of existing technical debt, ONCE, with binding repayment, when the ceiling is already in failure mode.** It does not permit general growth, and it does not extend the emergency.

### openai/codex-default

Matze — my assessment is mixed on the listed options, but I agree with the underlying change.

1. **Option 5: create at least 221 tokens of verified headroom elsewhere in the same change, then ship all 14 declarations.**

2. **Prior points I agree with:** Reviewer B has the stronger governance argument: the change’s value is real because machine-readable dispositions replace accidental movement with accountable measurement, but “transfer debt” would still exceed a deliberately immutable ceiling. I also agree with Reviewer A that the declarations are bounded metadata rather than new obligations and that any exception would need an explicit repayment mechanism.

3. **Prior points I disagree with:** I disagree with Reviewer A’s claim that making the roadmap unable to archive constitutes “funding.” It creates an enforceable-looking future obligation, but the payload remains above the blocking ceiling immediately after merge. The proposed six-month review also controls only future debt creation; it neither guarantees repayment nor prevents this exception from being cited tomorrow. Most importantly, the artefact’s **“The lock”** section says the ceiling “may never move UP,” while the prior council said growth is “transferred, never funded by raising the preamble ceiling.” An atomic, same-change reduction is the clearest interpretation of “transferred.”

4. **New refinement:** Preserve all 14 declarations rather than choosing Option 4. The seven `instruction-only` declarations are substantive negative dispositions: they distinguish consciously unbacked rules from rules nobody has assessed. Omitting them would preserve ambiguity and weaken the stated purpose of making the gap countable. Find the compensating 221 tokens in duplicated prose, projection overhead, or semantics-preserving compression—not by deleting obligations or weakening enforcement. Record the exact removals and before/after measurement in the evidence report; merge only when `check_preamble_payload_budget` reports **≤138,212**.

**Strongest argument:** A zero-headroom ceiling remains credible only when valuable additions must displace existing payload atomically; otherwise “transfer debt” changes a hard invariant into a queue of promises.

**Strongest counter-argument:** Requiring same-change savings may delay high-value observability work and incentivize rushed compression that makes important instructions less clear. The compensating reduction therefore needs semantic review, not merely a passing token count.

**Revisit condition:** If no semantics-preserving 221-token reduction can be demonstrated, revisit when the ratchet creates at least 221 tokens of measured headroom or when the grace policy expires on **2026-11-10**, whichever comes first.

`RTK.md` was not present in the accessible workspace, so this review relies on the supplied artefact and governing prompt.

Summary: ship all 14 declarations only with an atomic, verified 221-token reduction elsewhere in the same change.

## The binding conditions, and where each is discharged

| condition (concurring seat) | discharged |
|---|---|
| No ceiling raise | `grace_ceiling` untouched at 138,212; expiry 2026-11-10 unchanged |
| A numeric repayment target, not a promise | ≤ 138,212, stated in the stub's `Resolved when` |
| Recorded where it cannot evaporate | a drain-run transfer stub, counted in the dashboard's owner-decision total |
| No further growth until the diet recovers headroom | stated in the stub's `Blocks` field |

## One fact that reframes the whole question

`origin/main` measured **exactly 138,212** — the ceiling to the token. So the
constraint is not specific to this change: **any** rule-metadata addition is
currently blocked until the diet runs. Neither seat was told that in those
words, and it is the reason a 0.16 % addition reached a council at all.
