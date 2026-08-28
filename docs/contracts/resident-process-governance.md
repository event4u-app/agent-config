---
stability: stable
supersedes: no-runtime-boundary.md
---

# Resident-Process Governance Contract

> **Audience:** every skill author, mission/recipe reviewer, gate author, and
> anyone asking "may this thing keep running after the command returns?"
>
> **Successor to** [`no-runtime-boundary.md`](no-runtime-boundary.md), under
> **[ADR-249](../decisions/ADR-249-supervised-resident-process-permitted-under-governance.md)**.

This package emits text and files. That has not changed and is still the default:
a skill or mission that can do its job with codegen, one-shot shell and git-as-state
should do exactly that, and most of them can.

What changed on 2026-08-27 is the **ceiling**. A resident process is no longer
prohibited. It is **governed** — permitted only in the classes below, only under
the conditions below, and never as a side effect of something else.

## Scope — suite-wide, and this is a deliberate widening

**This contract is suite-wide.** Its predecessor was not, and pretending otherwise
would inherit an ambiguity rather than resolve it.

`no-runtime-boundary.md` declared its audience as *"every Mission-Mode decision,
skill author, and recipe reviewer"* and said it made the boundary explicit
*"for the Mission-Mode layer"*. Its Prohibited row banned *"spawned subprocesses
that outlive the current agent turn"* — a statement about mission steps. It was
nonetheless cited across the tree as the general no-runtime authority, including
by a gate (`src/scripts/validate_reach_prescriptions.ts:13`, "The Class A boundary
(`docs/contracts/no-runtime-boundary.md` …)"), and `ADR-124:34` had already
recorded that *"the 'no runtime' identity rests on instruments whose literal
scope is narrower"*.

So the widening is stated rather than assumed. An AI council (2026-08-27, 4/4)
chose this over two alternatives: keeping the Mission-Mode scope, which preserves
the mismatch between what the document says and how a gate reads it; and adopting
suite-wide scope silently, which performs a scope expansion by replacement.

**A citation is not automatically re-scoped.** Every gate and document that cited
the predecessor for a general boundary should be read against this contract's
class table rather than grandfathered into it. The predecessor's stub records
where they are.

**Beta window resolved.** The predecessor carried `keep-beta-until: 2026-08-17`,
which had expired ten days before this contract was written while it was still
being cited as settled authority. This contract ships `stability: stable`: the
policy is an accepted ADR, and a beta marker on it would imply a reversal is
pending when none is.

## Allowed — unchanged

Carried over almost verbatim, because it was right.

| Category | Examples | Notes |
|---|---|---|
| **Codegen / file emit** | Write a migration file, emit a `UPGRADE.md` plan, produce a diff patch | The canonical output |
| **File I/O** | Read `composer.json`, write `.work-state.json`, append to a report | Single-invocation scope only |
| **Multi-turn prompting** | Agent asks the user to run a command, the user pastes the result back | Human stays in the loop |
| **git-as-state** | `git commit -m "mission:upgrade step=11 status=ok"`, `git revert HEAD` | Structured commit messages are logging, not a daemon |
| **Shell invocation (single-shot)** | `composer install`, `php artisan test --filter=…` run once per step | One-shot, result returned immediately |
| **Report / plan files** | Write an evidence record, emit a checklist | Authoring-time output |

## Process classes — who may be resident, and under what

This replaces the flat prohibition. Read the row, then the conditions.

| Class | Definition | Verdict |
|---|---|---|
| **P0 — In-turn only** | Everything in Allowed above. Nothing outlives the command. | **Permitted, unconditional.** The default, and still where almost everything belongs. |
| **P1 — Supervised resident process** | A process with a lifecycle beyond one command that satisfies **all four** governance conditions below. | **Permitted under the conditions.** Requires a declared supervisor, a declared write scope, a documented stop path, and claim-consistency. |
| **P2 — Unsupervised background process** | Anything resident that does not satisfy all four: no named supervisor, an undeclared write scope, no documented stop, or a revision that still publishes a runtime-absence claim. | **PROHIBITED.** ADR-249 reversed a prohibition on *supervision*, not on *processes that answer to nobody*. |
| **P3 — Cross-session persistent state store** | SQLite as a memory backend, pgvector, MCP memory servers, Redis, any store persisting beyond the git working tree. | **PROHIBITED, unchanged.** The 2026-06-14 agent-memory / Layer-2 sunset is **not reopened** — ADR-249 § Not reopened says so explicitly, and `ADR-100:137` records the sunset as "reconciled, not reversed". |
| **P4 — Network/LLM-dependent build path** | Any index/graph/corpus *build* step requiring network or model calls. | **PROHIBITED, unchanged.** ADR-124 Class C stands; ADR-249 does not touch it. |

**The P3 carve-out survives verbatim** (ADR-124 § 6): a gitignored, deterministic,
rebuildable build/index artifact under `agents/runtime/state/` is a build output,
not a state store. **State-store test:** if deleting the artifact changes *what*
the tool can answer rather than only *how fast* it answers, it is a state store
and prohibited. A code-graph cache passes; a vector index fails.

**P1 does not weaken P3.** A supervised process may write only what it declared,
and declaring a vector index does not make it one.

## The four governance conditions

A P1 process satisfies all four, or it is P2.

1. **Supervised** — a named supervisor, a documented start path and stop path,
   and it does not outlive that supervisor.
2. **Scoped writes** — it declares what it writes **before** it runs, and writes
   nothing else. The P3 state-store test applies to whatever it declares.
3. **Stoppable** — a documented mechanism stops it, and stopping it degrades a
   capability rather than corrupting state.
4. **Claim-consistent** — it may not execute from a revision that still publishes
   a runtime-absence claim on a maintained public surface.

Condition 4 is a condition on the **process**, not only on the documentation, and
it is the one most easily mis-implemented. An AI council found the
documentation-ordering rule *necessary but not sufficient*: removing a public
claim does not stop an **older** revision from activating a process. The check
that enforces the documentation half is
`src/scripts/check_supervision_claim_atomicity.ts`; the same-revision activation
guard belongs to whichever change first ships a P1 process, and does not exist yet.

## What a P1 process may NOT be used to claim

Permitting a class is not evidence that a member of it behaves well. Until a
lifecycle suite exists and has run on the revision in question, no public surface
may assert that a resident process **is** supervised, bounded, isolated,
auto-restarted or lifecycle-managed. Stating the adopted policy is fine and is
what the README does; asserting the property is not.

`check_supervision_claim_atomicity` enforces this, and refuses four things
separately rather than checking a file exists: an unnamed suite, a result from
another revision, a suite that did not exercise real processes, and a run that
was empty or skipped at least as much as it ran.

## Still prohibited, and not by this contract

| Category | Where it lives |
|---|---|
| **Auto-PR / auto-push** | Hard Floor — `non-destructive-by-default`. Unchanged. |
| **Network egress from mission scripts** | Skills needing network declare `allowed_tools` and pass the lethal-trifecta gate. Unchanged. |
| **Spawn hardening** | ADR-123 and `docs/spawn-site-policy.md`. Every subprocess still routes through `hardenedSpawnEnv()`. A resident process is a harder case for spawn hygiene, never an exemption. |
| **Lethal trifecta** | `lethal-trifecta-guard` applies in full. A resident process with private data, untrusted input and network reach is the trifecta with a longer lifetime. |

## Gray — council review before adopting

| Pattern | Risk | Gate |
|---|---|---|
| **A P1 process whose supervisor is the host agent** | The host's lifecycle is not this package's to guarantee, so "supervised" would rest on a promise nobody here can keep. | Council sign-off; the supervisor must be nameable in this tree. |
| **Conditional branching on prior step outputs** | Missions becoming implicit state machines. | Skill decision tree with explicit judgement, not a script `if`/`else`. |
| **Nested sub-missions** | Unbounded depth. | Defer until a flat sequence is proven insufficient. |

## Decision authority

A case unclear against this contract goes to the AI Council
(`agent-config council:status` to check availability) before any build work
starts. A P1 process that would be the first of its kind is not an unclear case —
it is a new one, and it needs its own record.

## See also

- **[ADR-249](../decisions/ADR-249-supervised-resident-process-permitted-under-governance.md)** — the decision this contract implements, including § Not reopened.
- **ADR-124** § 4 — the class table this one succeeds; Classes A and C, and the § 6 state-store test, are unchanged.
- **ADR-109** — the subagent contract; only its "no daemon" clause moved.
- [`no-runtime-boundary.md`](no-runtime-boundary.md) — the predecessor, kept as a pointer stub.
- `agents/evidence/analysis/no-runtime-discovery-2026-08-27.md` — the census that found the three artefacts which actually refused a resident process.
