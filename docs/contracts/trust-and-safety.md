---
stability: beta
keep-beta-until: 2026-08-21
---

# Trust & Safety Layer — Phase 5 of the monorepo migration

> **Status:** active · **Stability:** beta · **Owner:** monorepo-phase-5
> · **Authoritative ADR:** [`ADR-018`](../decisions/ADR-018-trust-and-safety-layer.md)

Phase 1 stamped every artefact with `trust.level`,
`trust.confidence`, and `trust.human_review_required`. Phase 5
**enforces** those fields: the installer surfaces them at selection
time, the condenseor injects banners into compiled output, the
runtime gates `human_review_required: true` artefacts before final
output, and a lint catches drift. This contract is what those four
consumers depend on.

## § 1 — Trust levels

A closed enum on `trust.level`:

| level         | meaning                                                              |
|---------------|----------------------------------------------------------------------|
| `core`        | Iron-Law / structural. Cannot be downgraded. Kernel rules sit here.  |
| `professional`| Domain expertise the user opted into; no human-review floor.         |
| `advisory`    | High-impact judgement. Installer **must** confirm; banner injected.  |
| `restricted`  | Reserved for future legal / regulated content. Same surface as advisory, stricter copy. |
| `experimental`| Pre-stable. May be removed without ADR.                              |

`trust.confidence` is a parallel signal (`high` · `medium` · `low`)
used by the manifest's summary; it does **not** gate behaviour.

`trust.human_review_required: true` is the per-artefact banner gate.
Independent of `trust.level` so a `professional` artefact can still
demand review on its specific surface.

## § 2 — HRR banner

The condenseor (`scripts/condense.py`) prepends every artefact whose
frontmatter declares `trust.human_review_required: true` with:

```text
<!-- agent-config:human-review-banner -->
> HUMAN REVIEW REQUIRED · trust: <level> · owner: <domain>

<original body>
```

- The HTML comment is the parser-stable marker
  (`_HRR_BANNER_MARKER` in `scripts/condense.py`). Runtime detection
  greps for this string, never the prose line.
- Idempotent: re-condensing a file that already carries the marker
  leaves it unchanged.
- `<domain>` is the first pack id that ships the artefact (e.g.
  `finance-basic`, `founder-strategy`); falls back to `core` for
  unscoped artefacts.

## § 3 — Domain safety floors

Each pack that ships any `advisory`/`restricted` artefact MUST also
ship at least one rule whose logical filename contains
`safety-floor`. The current set:

| pack                    | safety-floor rule                                  |
|-------------------------|----------------------------------------------------|
| `core` (universal)      | `rules/engineering-safety-floor.md`                |
| `pack-finance-basic`    | `rules/finance-safety-floor.md`                    |
| `pack-finance-advanced` | inherits `finance-safety-floor` from `pack-finance-basic` |
| `pack-founder-strategy` | `rules/strategy-safety-floor.md`                   |

A safety-floor rule:

- Carries `trust.level: advisory` and `trust.human_review_required: true`
  itself — it ships with the banner.
- Names what the agent must **not** issue (final investment call, binding
  legal advice, single-path strategic verdict) and what it must surface
  instead (alternatives, sensitivity, assumptions, jurisdiction).
- Loads automatically alongside the rest of the pack — no opt-in.

## § 4 — Installer flow

[`packages/core/installer/src/trust-escalation.ts`](../../packages/core/installer/src/trust-escalation.ts)
implements the gate:

1. **Display.** The pack picker reads `packs[].trust_summary` from
   `dist/discovery/discovery-manifest.json` and renders one line per pack:
   `Finance basic: 3 advisory · 3 professional · human-review on 1`.
2. **Confirm.** Selecting a pack with any `advisory`/`restricted`
   artefact triggers a confirm prompt. Non-interactive mode (CI,
   agent-mode) requires `--accept-advisory=<pack-id>[,<pack-id>...]`
   explicitly; absence aborts with a non-zero exit.
3. **Agent-mode.** Emits a structured `confirm` question type with the
   trust counts inline; the host agent must relay it verbatim per
   `command-suggestion-policy`.
4. **Lockfile.** `.agent-config.lock.json` records the accepted trust
   counts per pack at install time. A later `sync` that finds the
   manifest's `trust_summary` has **escalated** (more advisory /
   restricted artefacts than were accepted) re-runs the confirm step
   before applying.

## § 5 — Coherence lint

`scripts/lint_trust_coherence.py` (wired into `ci-fast` and `ci-full`)
asserts three invariants over `dist/discovery/discovery-manifest.json`:

1. **Safety-floor presence.** Every pack with
   `trust_summary.advisory + trust_summary.restricted > 0` ships at
   least one artefact whose logical path contains `safety-floor`.
2. **Banner presence.** Every artefact with
   `trust.human_review_required: true` has its compiled output under
   `.agent-src/<logical>` and that output contains
   `<!-- agent-config:human-review-banner -->`.
3. **Kernel trust floor.** Every rule listed in `dist/router.json` `kernel[]`
   declares `trust.level: core`. No escalation (advisory blocks the
   Iron-Law floor) and no demotion (experimental cannot guarantee it).

Exits 0 clean, 1 on any violation. Tests in
`tests/test_lint_trust_coherence.py` lock the seven failure modes.

## § 6 — What this contract does **not** do

- **Per-user permissions.** Trust is a property of artefacts, not of
  users. The installer confirms once at install / sync time; there is
  no runtime per-action authorisation.
- **Rewriting the Iron Law floor.** `non-destructive-by-default`,
  `commit-policy`, `scope-control § git-ops`, `security-sensitive-stop`
  keep their universal scope — this contract references them, never
  re-declares them. See [`safety-model`](safety-model.md) and
  [`kernel-membership`](kernel-membership.md).
- **Versioning the trust enum.** A new level (e.g. a future
  `regulated`) requires a follow-on ADR; this contract enumerates the
  current closed set.

## § 7 — References

- ADR: [`ADR-018 — Trust & Safety Layer`](../decisions/ADR-018-trust-and-safety-layer.md)
- Condenseor implementation: [`scripts/condense.py`](../../src/scripts/condense.py)
  (`_inject_hrr_banner`, `_HRR_BANNER_MARKER`)
- Installer implementation: [`packages/core/installer/src/trust-escalation.ts`](../../packages/core/installer/src/trust-escalation.ts)
- Lint implementation: [`scripts/lint_trust_coherence.py`](../../src/scripts/lint_trust_coherence.py)
- Sibling contracts: [`safety-model`](safety-model.md) ·
  [`kernel-membership`](kernel-membership.md) ·
  [`ADR-013` — discovery frontmatter](../decisions/ADR-013-discovery-frontmatter-contract.md)
