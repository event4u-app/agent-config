---
complexity: lightweight
review_by: 2026-12-24
---
# Stub: the opencode runtime probe

> **Stub — not active work, and a DRAIN-RUN TRANSFER** in the sense
> [`README.md`](README.md) § The two classes defines. **Capability-gated:** the
> scope decision is made, the work is wanted, and the only thing missing is an
> environment the run did not have. Promoted by its own named probe returning
> true, never by the shared demand-gate criteria.

## What was transferred

From `agents/roadmaps/archive/road-to-opencode-enforcement.md` Phase 1, on an AI council
verdict of 2026-08-24 (2/2 convergent; the maintainer delegated owner-reserved
blockers to the council for that drain run).

- **1.1** the `@event4u/agent-config-opencode` plugin package.
- **1.2** the per-concern red/green arms.
- **Group B of the PREREG** — the four deny-dependent concerns
  (`block-kernel-rule-writes`, `block-config-weakening`, `block-no-verify`,
  `git-authorization`), each gated on the probe below.
- **AC-2's transcript half, AC-3 and AC-4** — recorded here 2026-08-24 to close a
  bookkeeping gap rather than to transfer anything new. All three already rested
  on 1.1 and 1.2; naming them makes the parent's `[~]` boxes verifiable against
  this file instead of against a sentence in the parent. AC-2's
  PRE-REGISTRATION half did NOT transfer and is complete
  (`internal/bench/opencode-enforcement-PREREG.md`).

**Group A did NOT transfer and is not blocked.** `hardenedSpawnEnv` → `shell.env`
and kernel projection → `experimental.chat.system.transform` are mutate-only,
match their hooks exactly, and have writable red/green criteria today
(`internal/bench/opencode-enforcement-PREREG.md` § Group A). They wait on the
plugin package, not on the probe.

## Why no automation can supply it

The probe needs **an installed opencode plugin and a live opencode session**.
Phase 0 established every fact a type declaration can carry — all four hooks
resolve, `permission.ask` honours `status: "deny"`, `tool.execute.before` is
mutate-only — and then hit the boundary: *does `permission.ask` actually fire for
the guarded operation, and does its untyped `metadata` carry the decision input?*
That is a runtime observation. No offline read answers it, and an autonomous run
has no opencode session to drive.

## Probe and named producer

**Producer:** the maintainer, on a machine with opencode installed and the plugin
loaded.

**Probe — `opencode-permission-payload-and-coverage`.** Returns true for a given
concern only when a transcript establishes **all three**:

1. **Coverage** — `permission.ask` fires for that concern's guarded operation.
2. **Payload** — the input carries the concern's decision input in a form
   losslessly normalizable into what the canonical script already consumes.
3. **Honour** — `status: "deny"` prevents the guarded action from executing.

Its three outcomes are **pre-registered** rather than decided on sight
(PREREG § The probe): all three hold → proceed to red/green; any one fails →
record the concern **unsupported on this host surface** and make no enforcement
claim; no transcript → **unevaluated**, which is neither.

**Baseline on the transfer date:** no transcript exists for any of B1–B4, so all
four are **unevaluated**. That is deliberately not "unsupported" — the distinction
is the one the PREREG's third row exists to protect, and collapsing it would
report a host limitation nobody established.

## What promotion may NOT claim

```
A GREEN COUNTS ONLY IF THE CANONICAL SCRIPT PRODUCED THE VERDICT.
A PLUGIN THAT READS `metadata` AND DECIDES FOR ITSELF IS A SECOND AUTHORITY
SURFACE, NOT A CARRIER, AND ITS GREEN IS NOT THIS PACKAGE'S ENFORCEMENT.
```

`docs/contracts/hook-architecture-v1.md` § The fifth state records opencode as
**bound-but-capability-limited** and the translator-vs-authority question as
**conditional and behavioural** — a type declaration cannot settle it. Whoever
runs this probe settles it, and a green whose verdict came from plugin-local logic
falsifies the translator classification instead of counting.

## Scope limit inherited from Phase 0

Every upstream fact is scoped to `@opencode-ai/plugin@1.18.21` /
`@opencode-ai/sdk@1.18.21`. The parent roadmap's blocker named git `6386e67` and
**equivalence was not demonstrated**. If the pin is shown to differ materially,
the PREREG is re-derived before this probe runs.

## What this stub does NOT cover

- **Phase 0**, which is complete: the matrix is corrected, the fifth state and the
  per-concern table are in the contract, and the PREREG is written.
- ~~**The estate.**~~ **Superseded 2026-08-24, and the original is kept because
  its reasoning still holds while its factual premise no longer does.** It read:

  > *"The parent roadmap stays **active** with Phases 1 and 2 open — its premise
  > was confirmed, not refuted, so closing it would report a null that the
  > evidence does not support."*

  Phases 1 and 2 are no longer open: every step in both is `[~]`, transferred
  here. The parent is therefore **archived**, and the sentence's own argument is
  why that is not a null: the premise WAS confirmed, the channel exists, the
  matrix is corrected, the fifth state and the per-concern table are in the
  contract, and the PREREG is written. Archiving records completed work whose
  remaining half lives here — it does not report that opencode enforcement failed.

  What would have been dishonest is closing it as *done*: the parent is archived
  with **three acceptance criteria transferred**, never with all five met.
