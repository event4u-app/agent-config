---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Merging into road-to-an-installed-layer-that-is-thinned was done and had to be reverted: that roadmap was re-stamped on 2026-10-06 by #2226, the two steps landed the same day by #2225, and its risk register cannot record a second review on one date, which turned the register gate red on main. Nothing can be archived or parked to pay for it. Two fixture steps, no failing check."
estate_growth_exempt: "Grows active_roadmaps by one: it holds two steps the owner already accepted in #2225, moved out of the roadmap whose same-day review stamp could not carry them."
relates:
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: extends
    note: "That roadmap owns the opt-in thinning and the default flip; this file fixes what a default install receives before any flip, and edits none of its steps."
---
# Road to a default install served once

> **Source:** an external review round (opaque id `inbox-2026-10-e`), round
> `agents/tmp.old/inbox-2026-10-e/`. Both steps landed first as 2.5 and 2.6 of
> `road-to-an-installed-layer-that-is-thinned` in #2225 and moved here on
> 2026-10-06, unchanged in substance, because that file's risk-review stamp of
> the same day could not record them. Anchors re-read at `main` @ `0c86ad98f`.

## Goal

An install nobody opted into thinning receives each routed rule body once, not
twice; and a reduction in the source rules shows up as pending reinstall
instead of as nothing.

## Context

- `gateOpen` in `src/scripts/hooks/rule_inject_hook.ts` opens on the resolved
  `lean_projection` pair, template base included, so the carrier injects on a
  default Claude Code install.
- The installer reads only an explicit user-global `mode` as consent to thin
  (decision D3 of `road-to-an-installed-layer-that-is-thinned`) and writes full
  bodies otherwise. A default install therefore carries every routed body in
  its rule files AND receives the same body by injection.
- `src/scripts/check_standing_rule_delivery.ts` measures installed directories
  only, by design, so a smaller source rule is invisible until a reinstall.

## Phase 1 — One copy, and a visible gap

- [x] **1.1 A default install is not served twice.** One fixture over a default
      (unthinned) install counts injected characters for rules whose full body
      already stands. The gate then keys on the installed form of each rule —
      a stub gets the body, a full body gets nothing — or on the same consent
      predicate the installer uses. The fixture asserts zero duplicated bodies
      on a default install and unchanged delivery on an opted-in one.
      verify: `npx vitest run tests/scripts/rule_inject_default_install_no_double.test.ts` -> 0
- [x] **1.2 A source reduction shows as pending reinstall.** The standing
      delivery report gains one column per standing rule: installed digest
      against the current source digest, `pending reinstall` where they differ.
      verify: `npx vitest run tests/scripts/check_standing_rule_delivery.test.ts -t 'pending reinstall'` -> 0

## What this roadmap deliberately does not do

- No default flip of thinning; that stays with the installed-layer roadmap's
  owner decision.
- No change to what an opted-in install receives.
- No failing check on the pending-reinstall column.

## Acceptance Criteria

- [x] AC-1 — On a default install the fixture counts zero rule bodies delivered
      both as a file and by injection, and an opted-in install's delivery is
      byte-identical to before.
- [x] AC-2 — The standing delivery report names every rule whose installed copy
      differs from its source.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | The steps move here unchanged rather than being re-worded | They were accepted in #2225; only their container changed | The installed-layer roadmap is re-reviewed on a later date and can take them back |
| D2 | reversible-technical | agent | 1.1 keys on BOTH: the installed form decides only when the installer's consent predicate (`installerThinsHost`) is false, so a default install skips full-bodied copies, a stub still gets its body, and an opted-in install is untouched (its full-bodied `no_stub` rules included). The offline `model_rule_injection` harness opts out, because it measures what the concern delivers and must not read the measuring machine's installed files | `rule_inject_default_install_no_double.test.ts`, seen red with the filter neutralised | The default flip of thinning lands, which makes the consent branch the common one |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Closing the double delivery starves a rule that only the injection carried | implementation | 1.1 stops injecting bodies that already stand; a rule installed as a stub must keep receiving its body. | 1.1's fixture asserts both directions — zero duplicates on a default install, unchanged delivery on an opted-in one. | Phase 1 — One copy, and a visible gap |
| 2 | A pending-reinstall column is read as an error | product | Every source edit makes rules differ from an older install. | The column reports and fails nothing, and names the digest it compared. | Phase 1 — One copy, and a visible gap |
