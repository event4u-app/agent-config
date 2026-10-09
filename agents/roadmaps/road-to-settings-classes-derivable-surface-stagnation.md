---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to settings classes derivable surface stagnation

> **Source:** `task lint-settings-classes`, red on PR #2267
> (`drain/neighbours-carried-20261008`, an unrelated roadmap-disposition
> change touching no settings file) and, by construction of the gate, equally
> red on `origin/main` itself — `src/config/gate-violation-baselines.json`'s
> `lint_settings_classes:derivable-surface` entry carries `"landed":
> "2026-08-12"` with no `reaffirmed` block, and the 56-day non-stagnation
> clause fires purely on elapsed calendar time, independent of any diff.

## Goal

The `lint_settings_classes:derivable-surface` ratchet stops failing CI for a
reason unrelated to the PR that happens to trip it: either the 83-of-134
`derivable`-classified settings-template leaves are walked down (the
mechanism each one names gets built, the key deleted), or the baseline is
re-audited and a `reaffirmed: {date, reason}` block is added honestly —
meaning each of the 83 was actually re-read, not merely re-stamped.

## Phase 1 — Decide how to spend this debt

- [x] **1.1 Pick a disposition for the stalled `derivable`
      queue.** Either (a) begin draining it — implement the mechanism a batch
      of entries names and delete those keys — or (b) re-read all 83 entries
      against the current tree and add a `reaffirmed: {date, reason}` block to
      `lint_settings_classes:derivable-surface` in
      `src/config/gate-violation-baselines.json` stating what was checked and
      why none are yet repairable. A reaffirmation written without re-reading
      the population is the same laundering the ratchet exists to catch.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0

<!-- Release holds — emitted commented out, because the default is that there is
     not one. Uncomment ONLY if an intermediate tree state of this roadmap must
     not be published. Template rule 28 is the contract; the authoring order is
     re-sequence -> guard -> hold, and a hold is the last resort, never the
     first tool.

     Record the outcome either way. A roadmap that considered a hold and reached
     rung 1 or 2 instead writes the one-line `resequenced:` / `guarded:` note
     below and deletes the entry; that note is a counted outcome, not a comment.

     resequenced: <one line — the broken intermediate state, and the phase cut
     that removed it, so no window was ever needed.>

     ## Release holds

     ### hold: <kebab-id>
     - **Channel:** all             (all | latest; omitted parses to all)
     - **Opened by:** <phase.step>  (the checkbox whose [x] opens the window)
     - **Cleared by:** <phase.step> (the checkbox whose [x] closes it)
     - **State:** <one sentence naming what is broken in the tree while open.>
     - **Why not a guard:** <why the guard rung failed, concretely. Mandatory —
       an entry without it is malformed and reddens CI.>

     Both named steps carry an inline HTML-comment marker on the checkbox line
     itself — `opens-hold: <kebab-id>` on the opener, `clears-hold: <kebab-id>`
     on the clearer — so the binding is readable from the checkbox and not only
     from this section. The clearing step MUST carry a `verify:` field: a hold
     cleared by an unverified flip is a hold cleared by assertion.
-->

## Blockers

### blocker: settings-derivable-audit-scope
- **Status:** resolved
- **Owner:** owner
- **Blocks:** 1.1
- **What to do:** pick exactly one — (a) authorize draining the 83-key queue (likely several PRs, since each key names a distinct replacement mechanism), or (b) authorize a one-time re-audit-and-reaffirm pass now, recorded with the keys actually checked.
- **Resolved when:** the owner's answer is recorded under this blocker with date.
- **Recommendation:** (b) first — a reaffirm costs one audit pass and buys 56 more days without a CI-wide red; draining 83 keys is real engineering work better scoped into its own roadmap once the audit shows which ones are cheap.
- **If you do nothing:** every PR touching no settings file at all keeps tripping this gate until someone reads and reaffirms or drains it.
- **Answer (2026-10-09):** the owner chose **(b)**, the one-time re-audit-and-reaffirm
  pass, which is also what this entry recommended. Carried out and merged as
  `6d603d93e` (#2268).

  The audit ran **before** the stamp and is the reason in the block, which is the
  order Risk 1 asks for: a drain was attempted first and yielded **0 of 83**. The
  cause is the same in every row — the named replacement mechanism was built and
  the old key was never retired from its original consumer, so the replacement is
  additive rather than substitutive. Worth recording because it nearly went the
  other way: a grep for the dotted literal suggested about 25 drainable keys, and
  every one of those 25 had a real reader once checked against its owning module.
  TypeScript consumers read nested settings by object access and rule or command
  consumers name the key only in prose, so a zero from that grep is a property of
  the grep.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A reaffirm is written without re-reading the 83 entries | implementation | Re-stamping the date without checking is the exact laundering the 56-day clause exists to catch | Step 1.1's `verify:` is the gate itself passing, and the `reaffirmed.reason` must name what was actually checked | Phase 1 — Decide how to spend this debt |

## Acceptance Criteria

- [x] AC-1 — the settings-classes lint passes on `main` without the
      `derivable-surface` finding appearing again before this roadmap's own
      disposition (drain or honest reaffirm) is recorded.
      Measured after `6d603d93e` merged: `lint_settings_classes` reports
      `158 settings key(s) classified — A=26 B=3 C=129`, exit 0. The disposition
      was recorded first, in the `reaffirmed.reason` the same commit added.
      verify: `./scripts-run src/scripts/lint_settings_classes` -> 0
