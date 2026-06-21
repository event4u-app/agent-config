---
complexity: structural
status: ready
---

# Roadmap: Command-Surface Refactor — Residuals

> Captures the genuinely-open follow-through items from the 6.0.0
> "refactoring" reviewer feedback (`agents/tmp.old/feedback-6.0.0-refactoring{,-3,-4,-7}.txt`)
> that were **deferred but never declined**. The big architectural asks
> from that feedback shipped in the 6.0.0-A…E + 6.1.0 + 6.2.0 lanes
> (flows layer, pack ownership, controlled verbs, per-pack budgets,
> stack-adaptive commands, classification-only consolidation). The items
> below are the leftovers whose tracking roadmap (6.2.0
> consolidation-evidence-gates) is now **archived**, so they are
> untracked.
>
> Explicitly **out of scope** (decided-against, do not re-open here):
> runtime resolver ([`ADR-042`](../../docs/decisions/ADR-042-runtime-resolver-decision-gate.md)),
> aggressive visible-surface reduction / command→skill conversion of
> `review-routing` + `rule-compliance-audit`
> ([`ADR-057`](../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md)),
> persona cut to 4, physical skill-family folding, API knowledge
> connectors (`agents/roadmaps/stubs/road-to-internal-connectors.md`).

## Phase 1 — First-class `visibility:` field

The reviewer asked repeatedly for a real `visibility: visible | advanced | internal`
command-frontmatter field instead of overloading `tier:` as the
visibility proxy. `tier:` still carries this meaning across all 150
commands; no `visibility:` field exists. This is structural and not
gated on any evidence signal.

- [x] Decide field semantics: add `visibility:` alongside `tier:`, or
      promote `tier:` → `visibility:` with a back-compat alias. Record in
      an ADR. <!-- ADR-092: Option A — visibility source of truth, tier kept as back-compat alias; council-decided -->
- [x] Add `visibility:` to the command frontmatter schema
      (`src/scripts/schemas/command.schema.json` or equivalent) with the
      `visible | advanced | internal` enum. <!-- enum added; tier kept as back-compat alias -->
- [x] Backfill `visibility:` on all command sources under
      `src/domains/<pack>/<verb>/command.md`, derived from the current
      `tier:` mapping. <!-- 150/150 backfilled + condensed dist projection -->
- [x] Point the surface classifier (`src/flows/surface-map.yaml`
      consumers) and `commands ls/explain` at `visibility:` as the source
      of truth. <!-- commands.ts prefers visibility (tier fallback); audit + manifest dual-emit -->
- [x] Targeted validation: run the command-frontmatter validator over
      `src/domains/` and confirm zero regressions on the changed files. <!-- validate_frontmatter 330/0, lint_command_tiers green, budget 0-over, tsc clean, 9 lint tests pass -->

## Phase 2 — Split the `meta` pack

`meta` is still one pack with ~27 subdirs. The reviewer (and 6.1.0
line 103) flagged splitting it into capability-scoped packs; the 6.1.0
roadmap punted this to "the 6.0.x lane", which has since closed without
the split.

- [x] Inventory the `meta` command + skill set and group by concern
      (`agent-admin`, `memory`, `analytics`, `governance`). <!-- 68 cmds + 58 skills; governance (2 cmds) folded into meta -->
- [x] Decide the split shape in an ADR (new packs vs. sub-namespaces),
      including the pack dependency edges (`requires` / `suggests`). <!-- ADR-092: logical re-tag, council-decided; memory/analytics/product-reasoning requires:[meta] -->
- [x] Re-parent the grouped commands/skills into the new pack(s) under
      `src/domains/` + `src/packs/*/pack.yaml`, keeping deprecation
      aliases (`replaces` / `deprecated_in`) for any renamed slug. <!-- 26 cmds re-tagged pack:+packs: → memory(11)/analytics(4)/product-reasoning(11); slugs path-derived so unchanged → no aliases needed (per ADR-092); physical move deferred -->
- [x] Update pack-dependency + budget lints and the discovery manifest
      for the new pack set. <!-- manifests regen, allowlist chat-history meta→memory, discovery manifest rebuilt -->
- [x] Targeted validation: pack-dependency lint + marketplace lint green
      on the changed packs. <!-- deps acyclic, validate_pack_yaml 24 ok, budget 0-over, marketplace clean -->

## Phase 3 — Evidence-gated deferrals (track, do not force)

These were deferred under [`ADR-057`](../../docs/decisions/ADR-057-consolidation-evidence-gate-outcomes.md)
pending a real usage / telemetry signal. On roadmap close (council-decided
disposition, 2026-06-13) they were **promoted to a stable decision log** so
they stay visible after this roadmap archives, then marked `[-]`
(not-actioned-pending-signal) here — never silently dropped. Durable home:
[`command-surface-evidence-gated-decisions`](../settings/contexts/command-surface-evidence-gated-decisions.md).

- [-] **Physical demotion of introspection commands** (`skill-preview`,
      `skills-discover`) into the `agent-admin` platform surface — gated
      on the slug-collision-suppression + description-matcher dependency
      that blocked the 6.2.0 attempt. Re-evaluate once that dependency is
      resolved. <!-- promoted to decisions §1 (external-dependency signal); not actioned, no signal -->
- [-] **Flows as the runtime primary surface** (CLI/help navigation, not
      just the data-model + `surface-map.yaml` classification) — gated on
      flow-usage telemetry showing the flow view is reached. Wire the
      telemetry signal first, then decide. <!-- promoted to decisions §2 (telemetry signal); not actioned, no signal -->
- [-] Re-evaluate the `roadmap:process-phase` variant (reviewer asked to
      trim the mental model to create / step / full) — low priority;
      confirm whether the product-surface decision already settles it
      before any change. <!-- promoted to decisions §3 (design-decision signal); not actioned, no signal -->

## Acceptance criteria

- A `visibility:` field exists on command frontmatter and is the
  classifier's source of truth (Phase 1).
- The `meta` pack is split into capability-scoped packs with passing
  dependency + budget lints (Phase 2).
- The evidence-gated items (Phase 3) are either actioned once their
  gating signal exists, or explicitly converted to `[-]` with a recorded
  decision — never silently dropped.
