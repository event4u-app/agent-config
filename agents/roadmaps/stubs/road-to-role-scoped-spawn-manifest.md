---
complexity: lightweight
---

# Stub: road to a role-scoped spawn manifest

> **Stub — not active work.** Drain-run cancellation, 2026-08-23, from
> [`road-to-role-scoped-spawn-profiles.md`](../archive/road-to-role-scoped-spawn-profiles.md).
> Council decision **(b)** on `b-maintainer-run-capture`, convergent **2 of 2**
> (`anthropic/claude-sonnet-4-5`, `openai/codex-default`; 2 rounds, blind peer
> review). Rationale and the full verdict:
> [`role-scoped-spawn-profiles.md § C`](../../evidence/investigations/role-scoped-spawn-profiles.md).

## Why this is a stub and not open work

Phases 1 and 2 designed a per-role scoping manifest and the pre-registered A/B
that would arm one role. Both were gated on Phase 0's payload inventory, and
that inventory requires a **host-owner capture** an autonomous run cannot
perform — for three independent reasons, all recorded in the tree:

1. The actor is named as *"the **host owner**, performing a fresh-session
   capture on the machine whose `~/.claude/settings.json` the host reads. Not a
   maintainer role and not a CI job"*
   ([`road-to-subagent-payload-capture.md`](road-to-subagent-payload-capture.md)).
2. The parent roadmap's own Non-goals list carries *"Automating the capture.
   The cut line is recorded and is not this roadmap's to move."*
3. The cut line is a **security** decision, not a convenience one: *"injecting
   `AGENT_HOOK_CAPTURE_DIR` into host settings is a host-environment
   modification and the resulting verbatim capture is an egress risk"* —
   routed through `security-sensitive-stop` § self-modification.

Nothing here is blocked on a *large* piece of work. It is blocked on one
one-session errand with a containment protocol, and the protocol has a named
owner who is not an agent.

## The three-point integrity check

### 1. The original criteria, verbatim

From the parent's Acceptance Criteria, the four that this stub carries:

```
AC-3 — A per-role manifest exists whose schema admits exactly the three
existing axes plus a mandatory evidence reference, and whose generated
unscoped state produces byte-identical subagent payloads.

AC-4 — A pre-registration naming corpus, arms, pair count and two bars is
committed strictly before the first run artefact.

AC-5 — At least one role is scoped in production, its manifest entry cites
a published benchmark section, and that section states pair count, host
and the single-host limitation; every role without a cleared bar is
unscoped.

AC-6 — When the A/B misses its bar, the null is published under an
existing honesty label and the role remains unscoped.
```

From the parent's `blocker: b-maintainer-run-capture`, § Resolved when (the
half this stub preserves):

```
this roadmap's evidence file records the version-pinned section inventory
from Step 3 and the negative probe from the containment protocol reports the
capture directory empty
```

### 2. The complete list of dependent steps

Thirteen steps, all `[-]` in the parent, all cancelled by this one decision:

- **Phase 0 Step 3** — capture the inbound spawn payload under containment.
- **Phase 0 Step 4** — compute the trimmable fraction from the captured
  inventory. Cancelled because both numerator and denominator were required to
  come from Step 3.
- **Phase 1 Steps 1-5** — the manifest contract, the role enumeration, the
  all-unscoped generation, the three-axis composition check, the human-gated
  flip.
- **Phase 2 Steps 1-6** — the pre-registration, the quality-bar anchoring, the
  run-and-publish, the honest-null clause, the arm-at-most-one clause, the
  reversal path.

Nothing else. **Phase 0 Steps 1, 2 and 5 are closed and stay closed** — they
were answerable without a capture and are answered in the evidence file.
**Phase 3 is independent in both directions** and is complete; it is not
waiting on anything here.

### 3. Named producer, detection probe, and the baseline at cancellation

**Producer:** the **host owner**, per the containment protocol in
[`road-to-subagent-payload-capture.md`](road-to-subagent-payload-capture.md).
That stub is the prerequisite for this one: promoting this stub before it is
promoting work whose input does not exist.

| # | Probe (read-only) | Baseline at cancellation, 2026-08-23 |
|---|---|---|
| P1 | a version-pinned section inventory in `agents/evidence/investigations/role-scoped-spawn-profiles.md` | **absent** — § C records the decline; § B records the host pin `2.1.241 (Claude Code)` with no inventory |
| P2 | `grep -rn 'discipline_profile' src/config/spawn-profiles*` (a manifest file of any name) | **no such file** — no manifest exists in the tree |
| P3 | a benchmark section in `docs/benchmark.md` reporting a role-scoping A/B | **absent** — no pre-registration and no run artefact exist |
| P4 | `grep -c 'scoped' <manifest>` reporting exactly one scoped role | **not evaluable** — no manifest |

Discharged only when P1 is positive **first**. P2-P4 are meaningless until it
is: a manifest built before the inventory is the Risk-1 failure the parent
roadmap names — *"a confident number measuring the wrong thing"*.

## What promoting this stub is worth — and what it is not

**Worth:** the scoping question becomes answerable at all. Today no trimmable
fraction exists, so any saving quoted for role scoping is arithmetic over a
guess.

**Not worth pretending:** the ceiling is already bounded and it is not large.
The drain run measured the subagent bucket at **22.1 %** of weighted input
units over 132,410 records on one machine's store
([`role-scoped-spawn-profiles.md § F`](../../evidence/investigations/role-scoped-spawn-profiles.md)),
with the orchestrator's own main-bucket traffic the single largest sink at
66.3 %. A perfect trim of every subagent payload is bounded by roughly a fifth
of weighted input **before** any quality cost — and the package's own measured
discipline lift (`+0.458, p=0.0135`,
`src/config/agent-settings.template.yml:117-119`) says that cost is not zero.
That is one machine's distribution and generalises to nothing, but it is the
only number attached to the question, and it argues for promoting this stub
**only** alongside a quality bar, never on the token axis alone.

**Kill criteria for the cancellation** (per the council): a host owner commits
to completing the full containment protocol in one uninterrupted same-day
session and produces both the version-pinned section inventory and a successful
fresh-session negative probe. *Autonomous capture becoming technically possible
is explicitly insufficient* — the recorded security cut line and the non-goal
would each have to be revised separately, by their owners.

Promote per item. Delete this stub when its last item is gone.
