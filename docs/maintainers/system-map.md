# System map — how the whole thing fits together

> One page, by design. This is a MAP, not a contract — where this page and a
> linked contract disagree, the contract wins. It exists so a new maintainer
> (or the same maintainer in six months) can orient without reading 121 ADRs.
> Requested by both 8.11 external reviews ("a 'how the whole system fits
> together' document that does not presuppose reading every contract").

## The one chain that explains everything

```
src/                    ← the ONLY thing you edit
  → projection          (condense.sh --sync; verbatim copy + path rewrite)
  → dist/agent-src/     (shipped projection — generated, read-only)
  → host projection     (task generate-tools → .claude/ .cursor/ .clinerules/ …)
  → installer           (npx @event4u/agent-config init → consumer's .augment/ etc.)
  → consumer runtime    (host agent runs; hooks fire via the dispatcher)
```

Everything below either feeds this chain or checks it.

## Subsystems, one paragraph each

- **Rules + router** — `src/rules/*.md`, compiled into `dist/router.json`.
  9 kernel rules load always; the rest route on trigger-sets. Heavy rule
  bodies migrate to skills/guidelines (P4 pattern); inbound routes are
  derivable per target (`internal/reports/rule-backlinks.md`). Contracts:
  `docs/contracts/kernel-membership.md`, `docs/contracts/rule-router.md`.

- **Skills / commands / personas** — the capability library
  (`src/skills`, command domains under `src/domains`, personas). Counts are
  generated and drift-gated (`CAPABILITIES.yaml`, count-messaging gate).
  Catalog: `docs/catalog.md`.

- **Knowledge + memory** — file-first, no DB. Per-card origin tier AND
  sensitivity class (`prohibited/project/shareable`, ADR-121) gate what may
  reach the global store (`~/.event4u/agent-config/knowledge/`); promotion
  needs a human reason; deletion leaves tombstones. Design:
  `agents/settings/contexts/knowledge-sensitivity.md`.

- **Council** — external multi-model deliberation (no repo access),
  debate/stance/chairman machinery complete and default-off; further
  expansion is gated on the pre-registered council-vs-solo baseline
  (`docs/design/council-vs-solo-baseline.md`). Config contract:
  `docs/contracts/ai-council-config.md`.

- **Subagents / orchestration** — in-session delegation with a form gate
  before mode selection; implementer/judge separation; telemetry on the
  audit JSONL. Team mode (cross-model builder/reviewer WITH repo access) is
  the depth complement — `agents/roadmaps/archive/road-to-team-mode.md`.

- **Telemetry + measurement** — engagement records (id-only,
  PII-excluded-by-construction, default-off; ON in this repo since
  2026-07-12 with pre-registered decision criteria at
  `docs/design/utilization-window-criteria.md`); orchestration audit lines;
  bench harnesses with spend gates.

- **Claims + proof** — every public claim binds to resolvable evidence:
  `docs/CLAIMS.md` (source) → `docs/proof.md` (generated). Honest nulls are
  published; pre-registration before data is the norm. Gate:
  `check_claims`, `build_proof --check`.

- **Introspection lenses (all report-only, all with kill criteria)** —
  `complexity_report` (system-complexity soft ratchet vs checked-in
  baseline), `explain_run` (why rules/skills/dispatches happened),
  `rule_backlinks`. None fails a build; each dies if it informs no decision.

- **CI gates** — `task ci` locally mirrors remote CI; remote CI is the
  authoritative gate (`quality.local_auto_run: false` BY DESIGN — narrow
  diff-scoped probes still run locally; new gates run once locally). The
  consumer matrix installs the real package and fires real hook lifecycle
  events. Branch protection: `docs/maintainers/branch-protection.md`.

## Where to change what (the 10-second router)

| You want to… | Edit… | Never touch… |
|---|---|---|
| Change agent behavior | `src/rules` / `src/skills` / `src/domains` | `dist/`, `.claude/`, `.cursor/` (generated) |
| Change what ships | `src/config/packs.yml`, profiles | consumer trees |
| Change counts/claims/proof | `docs/CLAIMS.md` + regenerate | `docs/proof.md` directly |
| Change install/hooks | `src/install`, `src/scripts/_lib/claude_settings_hooks.ts` | consumer settings by hand |
| Record a decision | `docs/decisions/ADR-*` via adr-create | roadmaps as decision storage |

Deeper operating material (release runbook, succession, incident playbooks)
is owned by `road-to-maintainer-bus-factor` — this page stays the map.
