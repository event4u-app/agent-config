# Recorded decision — `dist/router.json` is build-time infrastructure, not a zombie

> **Status:** recorded 2026-08-10 · **Supersedes:** an orphaned finding
> **Trigger to re-read:** any proposal to delete, stop generating, or "clean up"
> `dist/router.json`, and any claim that it is unused.

## The decision

`dist/router.json` **stays**. It has no *runtime host* consumer — no agent
session loads it — and that fact has repeatedly been read as "nothing uses it,
so it can go". It is the wrong inference: the router is **build-time
infrastructure**, and deleting it reds shipped gates.

Measured 2026-08-10: **70 tracked files** under `src/scripts/`, `tests/`,
`.github/` and the task runner reference it. Among them
`check_static_layer_stability` derives the kernel set from it, and
`check_kernel_prefix_stability`, `check_rule_projection_integrity`,
`lint_trigger_precision`, `trigger_coverage`, `router_telemetry` and
`prepack_router_targets` each consume it for a different check. A deletion is
therefore not a cleanup; it is a change to what CI can verify about the rule
layer.

## Why this file exists at all

The finding lived in a roadmap that has since closed with zero open steps. A
finding recorded only inside a completed plan is owned by nobody: the plan is
archived, the sentence survives, and the next reader meets it as an open
invitation to delete something. Moving it here gives it an owner and a
falsifiable shape.

## The question this does NOT settle

Whether a *runtime* consumer should exist — i.e. whether an agent session should
read the router to fetch rules on demand instead of receiving them all up front
— is a live design question and is **not** answered here. It belongs to the
parked `road-to-deferred-rule-retriever` roadmap, which owns the deferred-rule
retrieval design. The inverse of the original observation is the interesting
half and is carried by the parked rule-payload-diet roadmap: **because no host
consumes the router at runtime, `type: auto` does not gate delivery** — an
`auto` rule is projected and shipped like any other, so the type field is not
the payload lever it looks like.

## What would reopen this

- A runtime retriever ships, and the router acquires a host consumer — then the
  "build-time only" framing narrows and this file is amended, not deleted.
- The consumer count falls to zero because the gates that read it were retired
  — then the deletion argument becomes real and needs its own record.
