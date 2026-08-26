---
complexity: lightweight
review_by: 2026-12-24
---
# Stub: "make it stick" needs telemetry that does not exist

> **Stub — not active work, and a DRAIN-RUN TRANSFER** per [`README.md`](README.md)
> § The two classes. **Capability-gated:** the hypothesis is stated and the
> measurement to test it does not exist.

## What was transferred

Phase 4.1 of `road-to-inbox-harvest-2026-08-e-command-surface-legibility`, on an
AI council verdict of 2026-08-24 (2/2 convergent): *a "make it stick" suggestion —
repeated manual invocations of the same shape should suggest the durable form.*

The parent already gated it on `blocker: make-it-stick-telemetry` and titled its
own phase **"Later and only with evidence"**, so this transfer changes the file it
lives in rather than its status.

## Why an autonomous run may not take it

The hypothesis is *"a user who repeats an invocation would adopt the durable form
if suggested"*. Testing it needs a record of **repeated manual invocations per
shape per user** — telemetry this package does not collect. Building the
suggestion without it ships a nudge whose value is asserted, which is the shape
this repository's `orchestration_record` honest-null already measured and rejected
once (1 of 369 captured, and that figure *"may not be cited for either
direction"*).

An autonomous run cannot manufacture the observation, and building the feature
first is exactly the ordering the parent's own phase title forbids.

## Probe and its named producer

**Producer:** whichever change lands per-invocation telemetry with a shape that
can group by command form.

**Probe — `probe-make-it-stick-telemetry`.** Returns true when a telemetry surface
exists that can answer: *for a given command shape, how many times did the same
operator invoke it manually before adopting (or not adopting) the durable form?*
That requires a per-invocation record with an operator-stable key and a
shape-normalised command identity — neither exists today.

**Baseline on the transfer date:** no per-invocation command telemetry. The
closest surface is the suggestion-block capture instrument landed the same day
(`road-to-suggestion-block-capture`), and it is **not** this: it records whether a
numbered-options block was answered, not how often a command shape was retyped.

## Why it is a separate stub rather than folded into its sibling

`road-to-command-runtime-requirements` is gated on a **decision** (schema
ownership) and could be promoted tomorrow. This one is gated on a **measurement
that has to be built first**, which is a different re-entry condition with a
different producer. `stubs/README.md` is explicit that merging two stubs with
distinct probes is refused for exactly this reason — one probe would then stand in
for two facts.
