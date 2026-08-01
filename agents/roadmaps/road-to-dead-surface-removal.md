---
complexity: lightweight
status: ready
---

# Road to dead-surface removal — apply the package's own null rule to the package's own code

> Every 9.9.0 and 9.10.0 review converges on one sentence: *null results must
> produce physical removal, not just a disabled flag.* Three surfaces currently
> fail that rule inside this repository. Council cut:
> [`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md).

## Goal

Delete three dead or half-removed surfaces. No new mechanism, no new gate, no
replacement. Every phase is a deletion whose success criterion is that something
is smaller afterwards.

## Context (verified 2026-08-01, do not relitigate)

- **Code-intelligence engine:** permanently `enabled: false` (measured recall
  0.365 vs grep 0.797 — −43.2 pp against a +10 pp threshold), deprecation recorded
  for the next major, removal after. Yet `web-tree-sitter` (0.24.7) and
  `tree-sitter-wasms` (0.1.13) **still ship as core dependencies today**, so every
  consumer installs a parser stack for an engine that cannot run.
- **`intent:` trigger:** present in the schema, declared by rule authors, and
  documented in `router_telemetry.ts` as *"informational only — never
  auto-matches."* It does nothing at runtime and no planned mechanism would change
  that. Its only effect is giving rule authors false confidence that an activation
  path exists.
- **Per-pack `version:`:** 12 `src/domains/*/pack.yaml` files still carry a
  `version:` line. The release-time lockstep bump (56 files per release) was fixed
  — the duplicated field it bumped was not. Half a fix.

> **Scope boundary.** This roadmap removes; it does not redesign. The engine's
> re-open condition stays exactly as recorded (a consumer case the graph answers
> and grep cannot). Removing `intent:` is not a decision about activation
> architecture — that question is owned by
> [`road-to-activation-evidence-or-refusal`](road-to-activation-evidence-or-refusal.md),
> which independently refuses to *implement* the trigger.

## Phase 1 — Code-intelligence engine out of core

- [ ] Move `web-tree-sitter` and `tree-sitter-wasms` out of `dependencies`.
      Engine, CLI leaves, cache, twin, and the routing skill go to an optional
      package/plugin per the classification already recorded for it.
      *Verify:* a fresh consumer install resolves neither parser package; the
      install-payload delta is measured and stated in the PR body. **Pin the ABI
      pair (`web-tree-sitter@0.24.7` / `tree-sitter-wasms@0.1.13`) in the optional
      package** — this pair is version-coupled and has a known teardown trap.
- [ ] Keep the disabled-by-default settings key and the recorded re-open condition
      intact; the flag is not what is being deleted.
      *Verify:* the template still carries the key with its permanent `false`,
      and the deprecation note points at the optional package.
- [ ] Confirm nothing in the always-loaded surface still routes to the engine.
      *Verify:* grep for the engine's skill id and CLI leaf names returns only
      the optional package and the deprecation note.

## Phase 2 — Remove the `intent:` trigger type

- [ ] Delete `intent:` from the trigger schema and from every rule that declares
      it; the surrounding prose keeps whatever the rule actually needed to say.
      *Verify:* schema validation fails on an `intent:` trigger; a repo-wide grep
      for the trigger key in rule frontmatter returns zero.
- [ ] Update the offline tooling that counted `intent` separately, and the router
      contract's trigger-type table.
      *Verify:* `trigger_coverage` and the router contract no longer document a
      trigger type that does not exist; both stay green.
- [ ] State the removal in the contract in one line, so a future author does not
      reintroduce it as a "missing" feature.
      *Verify:* the line names why (never auto-matched at runtime, gave authors
      false confidence).

## Phase 3 — Per-pack `version:` removal

- [ ] Remove the `version:` field from all 12 `src/domains/*/pack.yaml` files;
      the package version is the single version.
      *Verify:* pack schema validation passes without the field, any consumer of
      it reads the package version instead, and a release cut touches zero
      `pack.yaml` files.
- [ ] Confirm the field cannot come back silently.
      *Verify:* the pack schema rejects `version:` rather than ignoring it.

## Non-goals (recorded refusals)

- **No engine deletion.** The re-open condition stands; extraction is what the
  recorded disposition asks for.
- **No `intent:` implementation.** Removal is the decision; token-overlap matching
  would be a fourth activation instrument in a family that has produced three
  consecutive nulls.
- **No per-pack independent versioning.** The question "individually versioned or
  not" is answered here as *not* — the removal is the answer, not a deferral.

## Surface delta

**−2 core dependencies, −1 schema trigger type, −12 duplicated version fields,
−1 dead fallback path.** Zero additions. This is the only roadmap in this batch
whose delta is unconditionally negative.

## Provenance

Sources: `agents/tmp.old/feedback-9.9.0-1.txt`,
`agents/tmp.old/feedback-9.10.0-1.txt`, `agents/tmp.old/feedback-9.9.0-2.txt`,
`agents/tmp.old/skill-rule-routing.txt` (all operator-owned). Disposition: council
2026-08-01 (`anthropic/claude-sonnet-4-5` + `openai/gpt-4o`, 2 rounds) —
[`feedback-9x-council-cut`](../settings/contexts/feedback-9x-council-cut.md). All
three surfaces were confirmed still present in the working tree on 2026-08-01.
