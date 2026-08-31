---
complexity: bounded
review_by: 2026-09-30
---

# Road to obligation-exposure instrumentation

> **Drain-run transfer**, created 2026-08-31 when
> `road-to-obligation-delivery-verification` closed as BLOCKED-BY-ARCHITECTURE.
> It carries that roadmap's AC-1 forward unweakened, plus the redesign
> recommendation the closing council attached. See § The two classes in
> [`README.md`](README.md) — this is capability-gated, not demand-gated, and the
> shared promotion criteria do not govern it.

## What was transferred, verbatim and unweakened

**AC-1**, from the parent: *"`mean_batch_size` has a second reading against a
named post-change corpus, and the delta is recorded whichever direction it went
— including 'did not move'."*

Its two binding interpretations are carried with it and are **owner-reserved**;
no council and no agent may lower either:

- *"post-change corpus"* means a corpus **exposed to** the change, not merely
  one later than it.
- The floor is **≥ 10 usable sessions**. Counting unusable sessions as
  zero-sized batches, changing eligibility, or dropping the propagation-model
  requirement are all refused.

## Why the parent could not close it

AI council 2026-08-31, anthropic/claude-sonnet-4-5 + openai/codex-default,
**2/2 convergent on Option B + disposition D3**. The finding, in one sentence:
**installation proves availability, and AC-1 requires exposure.**

Two propagation hops, and they fail differently:

1. `src/` → `dist/agent-src/` is same-commit and byte-exact. Not the problem.
2. `dist/` → an installed tree is gated on an operator re-running the installer,
   with unbounded lag. Measured 2026-08-31: every file in `~/.claude/rules/`
   carries mtime `2026-08-25 14:28`, five days before the obligation landed in
   `af0cf0bf0` (`2026-08-30 14:38:40Z`), and
   `grep -rl "CALLS WITH NO DEPENDENCY BETWEEN THEM" ~/.claude/rules ~/.claude/plugins`
   returns **0 files**.

Re-running the installer repairs hop 2 and **does not** unblock the criterion.
The obligation lives in a `type: auto` rule, which enters a session's context
only when its routing triggers match. So a corpus defined as "sessions after the
install timestamp" necessarily contains sessions where the rule was installed and
never projected. Both seats refused to redefine *exposed* as *available*, on the
ground that doing so would lower an owner-reserved floor.

The cadence that would guarantee delivery — `type: always` — is budget-blocked:
`check_always_budget` reads the extended budget at **60,252 / 60,254 chars
(100.0 %)** on a down-only ratchet across nine kernel rules an agent may not
write.

## What would promote this stub

Either mechanism closes it. Both are real engineering, and neither exists.

1. **A per-session projection record.** Something a measurement can read to
   answer *"was this specific obligation projected into this session's
   context?"* — not inferred from an mtime window, and not per-session
   self-report, which one seat rejected as requiring instrumentation this
   repository does not have.
2. **A guaranteed-projection propagation mechanism**, such that every session in
   a measurement corpus provably carried the obligation. This implies either
   budget relief for `type: always` or a delivery guarantee for `type: auto`
   that the tree does not make today — `docs/contracts/load-context-budget-model.md`
   explicitly disclaims it: *"No claim about `type: \"auto\"` rules."*

## The probe

Re-run on each `review_by:`. Two readings, both cheap:

```bash
# 1. Does a per-session obligation-projection record exist anywhere?
grep -rln "obligation_projected\|projection_record\|delivered_obligations" src/scripts/ src/shared/

# 2. Has the always-budget ratchet opened enough to admit the rule?
./scripts-run src/scripts/check_always_budget
```

Promote when reading 1 returns a real carrier, or reading 2 shows headroom
sufficient for the obligation's rule to move to `type: always`. Until then this
stays here; the parent is archived and its criterion is not lost.

## Do NOT

- Do not raise the reminder's frequency. The parent's pre-commitment forbids it,
  and a disconnected channel is not repaired by sending more down it.
- Do not treat "no change" as "measurement incomplete". A null under **verified
  exposure** is valid closure; the parent's problem was never the null, it was
  that exposure was never verifiable.
