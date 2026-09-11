---
stability: stable
---

# Release Sizing

> **Status:** active · **stable** since 2026-09-11 · written 2026-07-10.
> Governs what every shipped subsystem owes the reader: a disable path, a
> named rollback, and the consumer-matrix floor. No version numbers appear
> here as commitments — this contract shapes releases, it does not schedule
> them.
>
> **Promoted on evidence, and only for the half that had any.** Its beta
> window lapsed 2026-09-10 carrying two obligations whose records point in
> opposite directions: the `Rollback:` line below is mechanically enforced by
> `lint_changelog_rollback.ts` and was verified green at promotion time, while
> the one-primary-goal declaration was honoured in **0 of 6** release PRs
> across the whole window. Promoting both would have stamped `stable` on an
> obligation nobody has ever met. The declaration half therefore split out to
> [`release-primary-goal.md`](release-primary-goal.md), which keeps a window,
> a falsifier and a required mechanism; the halves cross-reference so release
> scope and release safety stay one subject.
>
> **Authority.** A beta marker is a public statement about what consumers may
> rely on, which `decision-revisit-gate` reserves to the owner. An AI council
> converged on this split on 2026-09-11 (2/2, blind peer review, subscription
> transport, $0.0000 billed) and its verdict was recorded as advice and not
> executed; the owner instructed execution in the same session.

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

- [`release-primary-goal.md`](release-primary-goal.md) — the beta half split
  out of this contract on 2026-09-11: the one-primary-goal norm and the
  `Primary-Goal:` declaration, with the 0-of-6 measurement that separated
  them and the falsifier its next window must answer.
- [`CHANGELOG-conventions.md`](CHANGELOG-conventions.md) — entry
  shape the `Rollback:` line extends.
- [`release-pr-gating.md`](release-pr-gating.md) — release-PR shape
  detection; the sizing judgment happens at labeling time.
- [`../release-runbook.md`](../release-runbook.md) — the cut
  procedure this contract's pre-flight check lives in.
- `src/scripts/lint_changelog_rollback.ts` — the mechanized
  `Rollback:` gate (run `--selftest` for its fixture proof).
