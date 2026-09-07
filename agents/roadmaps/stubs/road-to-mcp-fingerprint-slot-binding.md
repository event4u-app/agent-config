---
complexity: lightweight
review_by: 2026-12-07
design_validated: "AI council 2026-09-06 (unanimous, 2 seats) picked the slot: post_tool_use, observe-only. AI council 2026-09-07 (2 seats, convergent) ruled that executing it inside road-to-scan-that-fails-closed would falsify that roadmap's own AC-8, and that amending AC-8 to permit it is goalpost movement. Record: agents/roadmaps/road-to-scan-that-fails-closed.md, blocker: mcp-fingerprint-slot. The parent stays ACTIVE — its AC-6 is open on out-of-scope work — so this path is the active tree, not archive/."
capability_gap: none
blocker_class: estate
blocker_opened: 2026-09-07
---

# Stub: road to binding the MCP tool-fingerprint store to a hook slot

> **Stub — not active work.** Holds the implementation half of one blocker
> transferred out of
> [`road-to-scan-that-fails-closed.md`](../road-to-scan-that-fails-closed.md)
> by the autonomous drain run of 2026-09-07. Unlike most drain-run transfers
> this is **not** capability-gated — the repository can do this today, in one
> manifest edit plus one ledger row. It is **scope-gated**: the parent roadmap's
> own AC-8 forbids a new hook concern arriving as a result of that roadmap, so
> the wiring cannot land in the change that decided it. That is why the
> frontmatter declares `capability_gap: none` and `blocker_class: estate` — this
> is an authorization decision an owner can grant in one line, and it belongs in
> the BLOCKED QUICK-WIN bucket of `agent-config stubs:due` rather than in the
> owner bucket.

## The transfer

**Outcome state:** transferred. The DECISION half is closed; the
IMPLEMENTATION half is here.

**Original blocker, verbatim from the parent roadmap:**

> - **What to do:**
>   1. Choose pre-use interception (a `pre_tool_use` binding) or observe-only
>      recording (a `post_tool_use` binding) for `mcp_tool_fingerprint.ts`.
>   2. Wire the chosen slot in `src/scripts/hook_manifest.yaml` and confirm
>      `grep -c mcp_tool_fingerprint src/scripts/hook_manifest.yaml` returns a
>      non-zero count.
> - **Resolved when:** the owner picks a slot and `mcp_tool_fingerprint.ts` is
>   bound in `hook_manifest.yaml`.

**Step 1 is done.** Step 2 is what moved. The original `Resolved when:` clause
was therefore **not satisfied** and must not be read as satisfied — that is
stated here and again in the parent roadmap's resolution, because a blocker
whose condition half-fired is the exact place a reader would otherwise assume
the whole thing landed.

## The settled decision — carried verbatim so the implementer needs no archaeology

| Field | Value |
|---|---|
| Slot | `post_tool_use` |
| Mode | observe-only |
| Authorization granted | **none** |
| Pre-use interception provided | **no** |
| Decision authority | AI council, 2 seats (anthropic + openai), unanimous |
| Decision date | 2026-09-06 |
| Observation floor before | zero — bound to no slot, `grep -c` returns 0 |
| Observation floor after | non-zero: a mutated third-party tool definition becomes detectable after first use |
| Prevention floor before / after | zero / **zero** — unchanged, and this is the load-bearing row |

```
OBSERVE-ONLY MUST NEVER BE CITED AS SATISFYING A PREVENTIVE RUNTIME-INTEGRITY
GUARANTEE. IT DETECTS A RUG-PULL AFTER THE FIRST CALL. FOR A TOOL WITH
IRREVERSIBLE SIDE EFFECTS THAT IS A POST-MORTEM, NOT A CONTROL.
```

## Why this is not a silent downgrade

`agents/roadmaps/archive/road-to-mcp-runtime-integrity.md` § "The
no-silent-downgrade rule" governs this choice. Read in full it does **not**
forbid the post-use variant:

> The variant stays a legitimate option; what is forbidden is choosing it
> without the owner recording that they chose it, because the choice gives up
> protection against exactly the class of tool the check exists for.

Its requirement is a recorded trade-off, and this file plus the parent's
resolution is that record. Two further facts, both measured at
`d08656dfe` on 2026-09-07 rather than assumed:

1. **Nothing is being substituted.** The store is bound to no slot at all, so
   the move is zero → observation, not pre-use → post-use. There is no existing
   protection for the after-use variant to displace.
2. **Pre-use is unavailable on its own gate**, independent of anything decided
   here. `check_composite_arming` reports `no composite store at
   agents/evidence/hook-composite-readings.jsonl … This is "not measured yet",
   which is NOT the same as "armable"`, and `src/config/hook-latency-budget.json`
   carries `per_turn_composite.observe_only: true` with `p50_ci: null`. The
   no-silent-downgrade rule's own reopening condition — "`check_composite_arming`
   reports armable, the ceiling carries a number" — has not fired.

## What the implementer must do

1. **Add the admissions ledger row** `check_concern_admissions` requires, with
   all five contract answers, and answer the two honest ones honestly:
   - which platforms actually **deny** on this slot (a `post_tool_use` concern
     runs after the call, so no platform denies anything through it — the
     concern cannot refuse, it can only record);
   - that the slot is **already over its nominal budget**: `post_tool_use`
     carries 14 concerns per host against `max_per_event: 8`, which is
     warn-only (`hard_fail: false`) and was exceeded before this row. The
     manifest records that threshold as "a placeholder awaiting session
     evidence". Crossing it further is a cost to state, not a bar this concern
     is the first to meet.
2. **Bind the concern** to `post_tool_use` in `src/scripts/hook_manifest.yaml`
   for the hosts that carry the slot, with `severity: advisory` and
   `fail_closed: false` — a recorder that can red a turn is a control, and this
   one is explicitly not one.
3. **Confirm** `grep -c mcp_tool_fingerprint src/scripts/hook_manifest.yaml`
   returns a non-zero count.
4. **Add the recording and failure-behavior tests**: a first sighting is
   recorded and not reported; a mutation is reported; a malformed envelope exits
   0 without writing.
5. **State in the concern's own comment** that it grants no authorization and is
   not pre-use interception, so a later reader of the manifest alone cannot
   mistake it for one.

## Trigger — and why it is not "the first non-test import"

The obvious trigger was proposed and **rejected in review as circular**: the
manifest wiring may itself create the first production reference, so "the first
non-test import" can be satisfied by the very act it is supposed to gate.

**The wiring trigger is therefore, whichever comes first:**

- **before any claim, contract, or dependent surface assumes that MCP tool
  fingerprints are being recorded** — including a `docs/CLAIMS.md` entry, an
  assurance-registry row, or a runtime-integrity statement in a threat model; or
- **before the first non-test MCP tool execution in a supported host** relies on
  the store; or
- **2026-12-07**, this file's `review_by:` date, at which point the absence is
  read again rather than aged out.

**The pre-use reconsideration trigger is separate and unchanged**, carried
verbatim from the parent lock: `check_composite_arming` reports armable **and**
the latency ceiling contains a numeric value. When that fires, the slot decision
above is reopened on its own terms — step 1.2 of
`road-to-mcp-runtime-integrity` is then taken exactly as written there, and this
stub's observe-only choice does not prejudge it.

## Detection probe

~~~bash
# 1. Is the store still bound to nothing?
grep -c mcp_tool_fingerprint src/scripts/hook_manifest.yaml
# 2026-09-07: 0  → unbound; observation floor zero

# 2. Has the pre-use gate become armable? (decides which slot is even available)
./scripts-run src/scripts/check_composite_arming
# 2026-09-07: "no composite store … NOT the same as armable" → pre-use unavailable

# 3. Does anything already CLAIM fingerprint recording? (the first trigger above)
grep -rn 'fingerprint' docs/CLAIMS.md src/config/assurance-capability-registry.json
# 2026-09-07: no claim of MCP tool-definition fingerprinting → trigger not fired
~~~

Re-entry has happened when reading 1 returns a non-zero count **and** an
admissions ledger row exists for the concern. Reading 1 alone going non-zero,
with no ledger row, is not re-entry — it is the admission
`check_concern_admissions` exists to refuse.

## What promotion looks like

Promotion is **not** moving this file up a directory. It is one manifest edit,
one ledger row and one test file. When a producer performs them, strike the
transfer and delete this file.

## What this stub does NOT cover

- **The pre-use interception decision.** That is the parent lock's own reopening
  condition, gated on a measurement nobody has taken. Nothing here authorizes it
  and nothing here forbids it.
- **The per-turn latency ceiling.** Arming it is
  `road-to-mcp-runtime-integrity`'s business and its own instrument's.
- **Whether the `max_per_event: 8` threshold is right.** It is warn-only and was
  exceeded before this concern existed; re-deciding it is a separate question
  about the budget, not about this binding.
