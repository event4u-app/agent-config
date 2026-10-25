---
stability: beta
keep-beta-until: 2026-08-21
---

# Trust & Safety Layer — Phase 5 of the monorepo migration

> **Status:** active · **Stability:** beta · **Owner:** monorepo-phase-5
> · **Authoritative ADR:** [`ADR-018`](../decisions/ADR-018-trust-and-safety-layer.md)

Phase 1 stamped every artefact with `trust.level`,
`trust.confidence`, and `trust.human_review_required`. Two consumers
act on those fields today: the condenser injects banners into compiled
output (§ 2), and a lint catches drift (§ 5). The installer confirm gate
ADR-018 specified was never built (§ 4).

## § 1 — Trust levels

A closed enum on `trust.level`:

| level         | meaning                                                              |
|---------------|----------------------------------------------------------------------|
| `core`        | Iron-Law / structural. Cannot be downgraded. Kernel rules sit here.  |
| `professional`| Domain expertise the user opted into; no human-review floor.         |
| `advisory`    | High-impact judgement. Banner injected; a pack shipping one needs a safety-floor rule. |
| `restricted`  | Reserved for future legal / regulated content. Same surface as advisory, stricter copy. |
| `experimental`| Pre-stable. May be removed without ADR.                              |

`trust.confidence` is a parallel signal (`high` · `medium` · `low`)
used by the manifest's summary; it does **not** gate behaviour.

`trust.human_review_required: true` is the per-artefact banner gate.
Independent of `trust.level` so a `professional` artefact can still
demand review on its specific surface.

## § 2 — HRR banner

The condenser (`src/scripts/condense.ts`, `_inject_hrr_banner`) prepends
the body of every artefact whose frontmatter declares
`trust.human_review_required: true` with:

```text
<!-- agent-config:human-review-banner -->
> HUMAN REVIEW REQUIRED · trust: <level> · owner: <domain>

<original body>
```

- The HTML comment is the parser-stable marker
  (`_HRR_BANNER_MARKER` in `src/scripts/condense.ts`). Detection greps
  for this string, never the prose line.
- Idempotent: re-condensing a file that already carries the marker
  leaves it unchanged.
- `<domain>` is the first `-`-separated segment of the artefact's first
  `packs:` entry (`finance-basic` → `finance`), else its first
  `workspaces:` entry, else `unknown`.

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

## § 4 — Installer flow — specified, not built

ADR-018 specified an installer confirm gate: the pack picker shows
`packs[].trust_summary`, selecting a pack with `advisory`/`restricted`
artefacts asks for confirmation (`--accept-advisory=<pack-id>` in
non-interactive mode), and the lockfile records accepted counts so an
escalation re-asks. **None of it exists.** The file the ADR named
(`packages/core/installer/src/trust-escalation.ts`) was never written,
and no installer, CLI or lockfile code reads `trust_summary` or accepts
`--accept-advisory`.

What exists: `src/scripts/build_discovery_manifest.ts` writes
`packs[].trust_summary` into `dist/discovery/discovery-manifest.json`,
and § 5's lint is its only reader. Building the gate is an open
decision, not a defect in this contract.

## § 5 — Coherence lint

`src/scripts/lint_trust_coherence.ts` (task `lint-trust-coherence`)
asserts three invariants over `dist/discovery/discovery-manifest.json`:

1. **Safety-floor presence.** Every pack with
   `trust_summary.advisory + trust_summary.restricted > 0` ships at
   least one artefact whose logical path contains `safety-floor`.
2. **Banner presence.** Every artefact with
   `trust.human_review_required: true` has its compiled output under
   `dist/agent-src/<logical>` and that output contains
   `<!-- agent-config:human-review-banner -->`.
3. **Kernel trust floor.** Every rule listed in `dist/router.json` `kernel[]`
   declares `trust.level: core`. No escalation (advisory blocks the
   Iron-Law floor) and no demotion (experimental cannot guarantee it).

Exits 0 clean, 1 on any violation. Tests in
`tests/scripts/lint_trust_coherence.test.ts` lock the failure modes.

## § 6 — What this contract does **not** do

- **Per-user permissions.** Trust is a property of artefacts, not of
  users. There is no install-time confirmation (§ 4) and no runtime
  per-action authorisation.
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
- Condenser implementation: [`src/scripts/condense.ts`](../../src/scripts/condense.ts)
  (`_inject_hrr_banner`, `_HRR_BANNER_MARKER`)
- Manifest writer: [`src/scripts/build_discovery_manifest.ts`](../../src/scripts/build_discovery_manifest.ts)
- Lint implementation: [`src/scripts/lint_trust_coherence.ts`](../../src/scripts/lint_trust_coherence.ts)
- Sibling contracts: [`safety-model`](safety-model.md) ·
  [`kernel-membership`](kernel-membership.md) ·
  [`ADR-013` — discovery frontmatter](../decisions/ADR-013-discovery-frontmatter-contract.md)
