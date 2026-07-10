---
stability: beta
keep-beta-until: 2026-09-10
---

# Release Sizing

> **Status:** active · v0 / beta · 2026-07-10. Governs how much a
> minor release may carry and what every shipped subsystem owes the
> reader: one primary goal, a disable path, and a named rollback.
> No version numbers appear here as commitments — this contract
> shapes releases, it does not schedule them.

## One primary product goal per minor release

Every minor release names **exactly one primary product goal** — the
one-sentence answer to "why does this release exist?". Secondary
changes may ride along, but the release notes lead with the primary
goal, and a release that cannot name one is not ready to cut.
Scope discipline, not a ratio: what qualifies is a judgment call the
maintainer makes when labeling the release PR
([`release-pr-gating.md`](release-pr-gating.md)).

## Major subsystems are independently disableable where feasible

A major subsystem shipped or substantially reworked in a release is
**independently disableable** where feasible — a settings key in
`.agent-settings.yml`, a pack that can stay uninstalled, or an
explicit opt-in flag. The release notes **name the flag / config
key** so a consumer who hits a regression can switch the subsystem
off without downgrading the whole package. "Where feasible" is a
real qualifier: kernel rules and the install skeleton have no
sensible off-switch; everything above that floor should.

## Rollback path — the `Rollback:` line

Every CHANGELOG entry that **introduces or substantially reworks a
subsystem** names its rollback path in the entry itself via a
`Rollback:` line:

```md
* **workspace:** task-orchestration layer behind `/work` ([abc1234](…))
  Rollback: set `workspace.enabled: false` in `.agent-settings.yml`.
```

The rollback path is the disable flag from the section above, a
revert instruction, or a downgrade note — whatever actually undoes
the subsystem for a consumer. Enforced mechanically:
`src/scripts/lint_changelog_rollback.ts` fails when a new minor /
major section (`## [X.Y.0]`) contains no `Rollback:` line. The gate
only fires for versions **strictly greater** than the version in
`package.json` at lint time, so historical sections never retro-fail;
entry shape stays governed by
[`CHANGELOG-conventions.md`](CHANGELOG-conventions.md).

## Consumer matrix is the floor for every release

The pack-based consumer matrix —
[`../distribution/consumer-matrix.md`](../distribution/consumer-matrix.md)
(authored in parallel; forward link) — is the **floor** for every
release: no release ships a change that knowingly breaks a supported
cell of that matrix without the break being declared under
`### BREAKING CHANGES` and reflected in the matrix in the same
release.

## REJECTED — consumer-facing effort ratio

The proposed meta-ratio *"≥ 2/3 of effort per release must be
consumer-facing"* was **CUT by council 2026-07-10**
(claude-sonnet-4-5 + gpt-4o, unanimous) as a **gameable vanity
metric**: effort is unmeasurable at review time, "consumer-facing"
is reclassifiable at will, and the ratio punishes necessary
infrastructure releases. Recorded here so it is not re-proposed;
re-opening it requires new evidence per the decision-revisit gate.

## Cross-references

- [`CHANGELOG-conventions.md`](CHANGELOG-conventions.md) — entry
  shape the `Rollback:` line extends.
- [`release-pr-gating.md`](release-pr-gating.md) — release-PR shape
  detection; the sizing judgment happens at labeling time.
- [`../release-runbook.md`](../release-runbook.md) — the cut
  procedure this contract's pre-flight check lives in.
- `src/scripts/lint_changelog_rollback.ts` — the mechanized
  `Rollback:` gate (run `--selftest` for its fixture proof).
