---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to the InstructionsLoaded observer, and the fork it would decide

> **Stub — not active work.** Drain-run transfer, 2026-08-21, from
> [`road-to-standing-context-40k.md`](../archive/road-to-standing-context-40k.md)
> steps 3.0 and 3.1 plus blocker `b-rules-efficiency-signal`. Council
> disposition **B**, outcome state **transferred**, 2/2 quorum — record in
> [`standing-context-40k-disposition.md`](../../evidence/council/standing-context-40k-disposition.md).
> Three items merged into one stub under the framework's rule 5, because they
> share one evidence chain: the observer produces the datum the fork reads.

## Why this stub exists, and what changed to make it worth writing

The parent recorded step 3.0 twice as resting on a **refuted premise**: the step
asserts *"the host fires that event"*, and nothing in the tree established it.
That reading was about the wrong side of the boundary. The tree-side facts were
correct and are still correct — `InstructionsLoaded` is in no `EVENT_VOCABULARY`
(`src/scripts/hooks/dispatch_hook.ts`, ten events), in no `native_event_aliases`
row (`src/scripts/hook_manifest.yaml`), and the two modules naming it document it
as unbound. Those are statements about **this suite's bindings**. Nobody had
asked the host.

Asked 2026-08-21, on Claude Code **2.1.238**, by the identical exact-token method
that justified the `SubagentStart` / `SubagentStop` rows at 2.1.229:

- `InstructionsLoaded` exact-token count **9**, with the 2.1.229 control set
  reproduced in the same run.
- It is a member of the host's **own hook-event enum**, inside one contiguous run
  of event names next to `ConfigChange`, `CwdChanged`, `FileChanged`,
  `TaskCreated`, `MessageDisplay`.
- The binary carries the **hook-execution machinery** named for it —
  `executeInstructionsLoadedHooks`, `hasInstructionsLoadedHook`.
- Its **payload fields** are `load_reason`, `trigger_file_path`,
  `parent_file_path` — precisely the "load-reason matcher" the step described
  before anyone measured it.

Full record:
[`standing-context-40k-host-and-machine-probes.md`](../../evidence/investigations/standing-context-40k-host-and-machine-probes.md) § 1.

**The capability exists. The work is now buildable, and it was not before.** That
is the whole reason this is a stub with a route rather than a line waiting on a
premise.

## The original criteria, verbatim

> **3.0** Register the `InstructionsLoaded` observer first. The host fires that
> event per loaded `CLAUDE.md` / `.claude/rules/*.md` with a load-reason matcher,
> which turns "rules carried" from an emitter simulation into a per-session
> ground-truth count — exactly the demand-signal datum the retriever's own gate
> reads. Decide the fork *after* the observer has data.
> `verify:` the observer records a load event with its reason on this tree.

> **3.1** Fork, stated so it cannot be half-done. **(a)** Execute
> `later/road-to-deferred-rule-retriever` when its `rules_efficiency` gate
> converts, lexical-core comparison first, per its own text. **(b)** If the
> demand signal never materialises on a sustained basis, record the null and
> **delete the trigger frontmatter from rules instead** — a compile-time field
> nothing consumes is documentation pretending to be mechanism.

> **AC-3:** either (a) ships behind the registered gate with a pre-registered
> adoption metric, or (b) a dated null closes the fork. No third state.

> **blocker `b-rules-efficiency-signal` — Resolved when:** the metric reads
> against its bar and the fork resolves to (a) or (b), or the window is recorded
> as unfilled with a new date.

## What moved here — the complete list

1. Step 3.0 in full — the vocabulary + alias + platform-row registration, the
   concern, and the live-fire verification.
2. Step 3.1 in full, both fork arms, and AC-3.
3. Blocker `b-rules-efficiency-signal`, with both its Corrections and its
   re-entry producer.

Nothing else moved here. Step 0.1 went to
[`road-to-standing-rule-delivery-per-machine.md`](road-to-standing-rule-delivery-per-machine.md)
and steps 2.1 / 2.2 to the payload-diet roadmap.

## Why the host observation does not close 3.0

The step's `verify:` reads *"the observer records a load event with its reason on
this tree."* A string table proves the event exists to bind; it does not prove a
bound concern receives a fire. Binding takes effect at session start, so a
session cannot observe its own registration — the fire is necessarily a later
session.

The openai seat volunteered this as the call it would resist most strongly:
*"treating exact binary strings as sufficient to split or discharge 3.0 … I would
change my view only after a version-stamped fresh session demonstrates that the
suite's registered hook receives the event and its documented payload."*

**Dissent recorded (anthropic seat):** the observation was the uncertain premise,
it is now confirmed and version-stamped, and that discharges the step's
validation goal; the binding is new design work. Recorded because it is the
reason the measurement is preserved as a premise correction rather than discarded
with the step.

A second, independent reason **D** (execute the binding now) was refused:
registration emits install settings, so it changes what the installer writes into
a consumer's `.claude/settings.json` — a shipped-default change, and Rule 3 is
categorical.

## Probe — item 1, bind the event

Named producer: **`matze4u` (Mathias Berg)**, the maintainer, who owns the hook
architecture. This is a single-maintainer repository — measured **1** distinct
reviewer over the trailing 90 days in
[`road-to-maintainer-bus-factor.md`](../archive/road-to-maintainer-bus-factor.md) — so a
separate "hook-architecture owner" would be a role label naming nobody, which
rule 6 forbids.

Sequence, which is the step's own and is not re-ordered here: the observation
(done) → the vocabulary + alias + platform row → the concern.

**Re-entry probe, mechanically decidable:**

```bash
grep -c '"instructions_loaded"' src/scripts/hooks/dispatch_hook.ts   # EVENT_VOCABULARY
grep -c 'InstructionsLoaded' src/scripts/hook_manifest.yaml          # native_event_aliases
```

**Baseline at transfer (2026-08-21):** `0` and `0`.

**Kill switch, required by the council and not optional.** The binding must be
independently removable or disabled, and rolled back on any of: hook failures,
duplicate events, material session-start regression, or unexplained downstream
test breakage. Known cost before starting: a ~24-file test surface on
`hook_manifest.yaml` plus the install settings emission.

## Item 2 — a producer for the `rules_carried` / `rules_used` pair

This is the blocker, and it is **settled, not reopened**. PR **#1484** (merged
2026-08-20) established by four checks that the `rules_efficiency` window is
empty because **nothing writes the pair**, not because no sessions occurred — the
broken-instrument case, which the framework's rule 4 routes to a transfer. The
audit log held 579 orchestration lines for 2026-08 with `rules_carried` null on
579 of 579.

Named producer, either of two paths, both from the blocker's own Correction B:

1. the worker thin projection of `road-to-token-economy-dispatch` Phase 3
   (`projection_quality.status` still reads `armed-awaiting-projection`), or
2. an explicit extension of `orchestration_record_hook.buildRecordInput` to emit
   the pair.

Item 1 of this stub is a **third** path and the one the parent's blocker
Recommendation asked for — *"land step 3.0's observer first"* — which Correction A
had ruled unavailable **because the host capability was unestablished**. That
ground is now measured false, so the Recommendation has a route for the first
time. Correction B is untouched: nothing writes the pair today.

**Re-entry probe, one command:**

```bash
./scripts-run src/scripts/dispatch_economy_report   # rules_efficiency: envelopes with pair > 0
```

**Baseline at transfer (2026-08-21):** `envelopes with pair=0 · median quota=— ·
low-quota signal (< 0.2): no data`. Re-measured this session; unchanged from
#1484.

## Item 3 — decide the fork

Gated on item 2 reading non-zero. Until then neither arm has evidence: **(a)** has
no demand signal, and **(b)** would delete trigger frontmatter on an
*absence* of measurement rather than a measured null — the unbacked-claim failure
this repository gates against.

Do not start the retriever before the comparison against
`src/scripts/_lib/lexical_index.ts` that `later/road-to-deferred-rule-retriever`
pre-registered.

**The parent's 2026-09-17 re-date is a checkpoint, not a forecast.** Nothing in
the tree will fill the window by that date or any later one without a producer,
so a bare re-date on the day would be the parking-lot failure the framework's
rule 1 names. The fork closes when a producer exists, not when a date passes.

## What is still true, and unpleasant

109 of 113 projected rule files carry no frontmatter and load unconditionally on
this host, so roughly a hundred `type: auto` rules keep carrying `triggers:`
blocks no runtime consumer reads — documentation presenting itself as mechanism.
That is the cost of leaving the fork open, and it is the third state AC-3
forbids. This stub does not remove that cost; it names who can.
