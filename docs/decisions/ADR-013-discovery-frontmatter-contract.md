---
adr: 013
status: accepted
date: 2026-05-19
decision: discovery-frontmatter-contract
supersedes: —
superseded_by: —
phase: v2.x · automated-pack-workspace-and-skill-discovery Phase 0
type: prospective
---

# ADR-013 — Discovery Frontmatter Contract

## Status

**Accepted** · 2026-05-19 · in-session + external AI Council pass complete
(`agents/runtime/council/responses/2026-05-18T*-r3-automated-discovery/`). Cost: $0.19.
The 5 external CRITICAL/HIGH items have been folded into Phases 1, 2, 3, 5
of `agents/roadmaps/archive/automated-pack-workspace-and-skill-discovery.md`
(archived 2026-05-19, status: completed).

## Context

`event4u/agent-config` ships 218 skills, 72 rules, 129 commands, and 141
templates as of `2.26.0`. Three downstream surfaces — the setup wizard
(`unified-setup-and-settings-gui`), the agent-mode installer (`--agent`),
and the strategic-visibility positioning lint
(`strategic-visibility-mcp-topics-positioning`) — need to know **which
workspaces and packs each artefact belongs to** without anyone manually
maintaining the list.

A release-time scan over artefact frontmatter is the cheapest source of
truth. The scan emits a single `dist/discovery/discovery-manifest.json`
shipped inside the npm tarball; every downstream surface reads from that
file and from nothing else. This ADR locks the **frontmatter shape**, the
**closed vocabularies**, and the **non-overlap rule** that keeps the new
keys from colliding with the existing `cost_profile` / `profile.id` axes
(ADR-010).

### Why a closed vocabulary

Free-form `domain:` (existing today) has 6 distinct values across 218
skills — usable, but unenforced. Free-form `workspaces:` / `packs:`
would degenerate into 30+ near-duplicate strings within one release
cycle. The vocabulary is closed; amendments require an ADR-013
amendment and a `lint_discovery_vocabulary.py` update in the same PR.

### Why additive, not renaming

`domain:` and `recommended_for_user_types:` exist on every annotated
skill today. Renaming would force every consumer (router, skill linter,
analysis pipeline) to retag at the same time. The new keys are
**additive**: `workspaces:` and `packs:` live alongside `domain:`,
the migration is mechanical (Phase 4 of the implementing roadmap), and
no existing reader breaks.

## Decision

### Frontmatter shape — additive block

```yaml
# ── existing keys stay ──
name: <slug>
description: <one-liner>
source: package
domain: <existing free-form>   # untouched

# ── new keys (additive; optional Phases 1–3, required Phase 4+) ──
workspaces:
  - engineering
  - product
packs:
  - engineering-base
lifecycle: active           # active | deprecated | experimental | archived
trust:
  level: core               # core | professional | experimental | advisory | restricted
  confidence: high          # high | medium | low
  human_review_required: false
install:
  default: true
  removable: true
```

### Closed vocabulary — `workspaces:`

| id | label | one-line definition |
|---|---|---|
| `engineering` | Engineering | Code, tests, CI, reviews, architecture. |
| `product` | Product | Discovery, roadmaps, prioritisation, AC tightening. |
| `finance` | Finance / CFO | Cashflow, forecasting, DCF, board reporting. |
| `founder` | Founder | Strategy, fundraising, vision, board narrative. |
| `gtm` | Go-to-Market | Sales pipeline, marketing, positioning, launch. |
| `ops` | Operations | Hiring, comp, perf, org design, runbooks. |
| `small-business` | Small Business | Self-employed / SMB-shaped owner workflows. |
| `construction` | Construction | Trade-business workflows (planning, quotes). |
| `agent-config-maintainer` | Maintainer | Skills/rules/commands that maintain *this* package. |

Amendments to the workspace list require an ADR-013 amendment.

### Closed vocabulary — `packs:`

| id | description |
|---|---|
| `engineering-base` | Framework-neutral engineering hygiene (git, tests, reviews). |
| `php` | PHP-language patterns (framework-free). |
| `laravel` | Laravel framework; advisory hint depends on `php`, `engineering-base`. |
| `symfony` | Symfony framework; advisory hint depends on `php`, `engineering-base`. |
| `javascript` | JavaScript-language patterns. |
| `typescript` | TypeScript-language patterns. |
| `react` | React framework patterns. |
| `nextjs` | Next.js framework patterns. |
| `python` | Python-language patterns. |
| `product-basic` | Core PO/PM artefacts (ticket refinement, AC, estimation). |
| `product-discovery` | JTBD, interviews, VoC, hypothesis testing. |
| `finance-basic` | Cashflow, runway, basic forecasting. |
| `finance-advanced` | DCF, scenario modelling, comp banding. |
| `gtm-sales` | Pipeline, MEDDIC, forecast accuracy. |
| `gtm-marketing` | Positioning, messaging, editorial, content funnel. |
| `ops-people` | Hiring loops, onboarding programs, comp banding. (Renamed from `ops` to honour the non-overlap rule against `profile.id: ops`.) |
| `founder-strategy` | Vision, fundraising narrative, competitive moat. (Renamed from `founder` to honour the non-overlap rule against `profile.id: founder`.) |
| `small-business` | SMB-shaped owner workflows. |
| `construction` | Trade-business workflows. |
| `ai-video` | AI video pipeline (per ADR-011, the only heavyweight domain). |
| `fun` | Non-essential social/fun workflows (prediction-pool tips, etc.). Optional under the `small-business` workspace; `experimental` trust. |
| `meta` | Artefacts that maintain *this* package (`agent-config` itself). |

Amendments to the pack list require an ADR-013 amendment and the
matching `config/discovery/packs.yml` row in the same PR.

### Non-overlap rule (ADR-010 alignment)

- `cost_profile` values (`minimal`, `balanced`, `full`, `custom`) are
  **not** pack ids. The scanner hard-fails on overlap.
- `profile.id` values (`founder`, `developer`, `content_creator`,
  `agency`, `finance`, `ops`) are **not** pack ids. The scanner
  hard-fails on overlap. (Note: `founder`, `finance`, `ops` are
  **workspace ids**; the collision check is against pack ids.)
- `lint_discovery_vocabulary.py` enforces both checks at PR time.

### Migration rule

- **Phases 1–3** (implementing roadmap): artefacts without the new keys
  are accepted; the scanner emits `unassigned[]` warnings; CI logs but
  does not fail.
- **Phase 4**: every artefact under
  `.agent-src.uncondensed/{skills,rules,commands,templates}` either
  declares the new keys, or sits in `config/discovery/unassigned-artefacts.yml`
  with a one-line reason.
- **Phase 4+**: CI flips strict; missing annotation is a fail.

### Trust-root allow-list (security-engineer council fold-in)

The scanner honours frontmatter only on files under the trusted roots:
`.augment/`, `.claude/`, `.agent-src.uncondensed/`, `.agent-src/`.
Files under `agents/`, `tmp/`, or any consumer-writable path **cannot**
claim ownership of a workspace or pack. Phase 2 enforces.

### Release-only manifest (external council CRITICAL fold-in)

The manifest is built on `main` post-merge, never in PR CI. PR CI
asserts the manifest is **absent** from the working tree, preventing a
contributor from smuggling a pre-built manifest claiming
`trust.level: core`. Phase 5 enforces.

### Signing (security-engineer council fold-in)

Phase 6 emits `discovery-manifest.json.sha256` alongside the manifest.
The CLI verifies on first read; verification failure aborts before any
discovery-driven action.

## Consequences

### Positive

- One source of truth for workspaces/packs across wizard, agent-mode,
  CLI, server route, and positioning lint.
- Manifest extraction is mechanical when ADR-011's trigger flips; no
  refactor of artefact bodies needed at that time.
- Vocabulary drift is caught by lint, not by review-by-eye.

### Negative

- Every artefact author must learn 4 new keys (`workspaces`, `packs`,
  `lifecycle`, `trust`, `install`). Mitigation: defaults documented in
  Phase 4 mapping rules; one ADR amendment per new vocabulary entry.
- A future "extract video into its own npm package" decision (ADR-011
  trigger flip) inherits the manifest as scaffolding. Mitigation: the
  manifest declares *labels*, not directory boundaries; extraction is
  still a separate roadmap.

### Risks accepted

- **Free-form `domain:` stays alongside `workspaces:`.** Duplication
  is intentional during the additive migration; a follow-up roadmap
  may collapse them.
- **`requires_hint:` on packs is advisory only.** The runtime does
  not act on it. Acceptable for v1 per the council's "MEDIUM" note.

## Amendments

### 2026-05-21 — Monorepo Phase 1 closure (enforcement live)

The five required keys (`workspaces`, `packs`, `lifecycle`, `trust`,
`install`) are now **strictly enforced** across every artefact under
`.agent-src.uncondensed/{skills,rules,commands,templates}` by
[`scripts/lint_artefact_frontmatter.py`](../../scripts/lint_artefact_frontmatter.py),
wired into `task lint-artefact-frontmatter`, `task ci`, and the opt-in
combined pre-commit hook (`./agent-config hooks:install`). The migration
rule's "Phase 4+" strict flip described above is therefore in effect.

Worked examples per artefact type live in
[`docs/contracts/frontmatter-contract.md`](../contracts/frontmatter-contract.md);
roundtrip stability across the `task sync` pipeline is guarded by
`tests/test_frontmatter_roundtrip.py`.

The Phase-1 roadmap initially proposed splitting the contract into a
separate `ADR-014-frontmatter-v2-contract.md`. That split was dropped —
this ADR remains the single source of truth and absorbed the worked
examples instead. No ADR-014 issued.

Driven by [`agents/roadmaps/monorepo-phase-1-frontmatter-metadata.md`](../../agents/roadmaps/monorepo-phase-1-frontmatter-metadata.md).

### 2026-05-27 — Additive advisory `cluster:` key on packs

Pack entries in [`config/discovery/packs.yml`](../../config/discovery/packs.yml)
may carry an optional `cluster: <language-id>` field. It groups a framework
pack under a programming-language tile in the setup wizard's capability-packs
step (e.g. `laravel: cluster: php`, `react: cluster: typescript`). Like
`requires_hint`, it is **advisory only** — the installer does not act on it; it
drives the wizard UI's collapsible language→framework grouping. The value must
be a known pack id (and not self-referential), enforced by
[`scripts/lint_discovery_vocabulary.py`](../../scripts/lint_discovery_vocabulary.py)
and emitted into the discovery manifest. Additive, no vocabulary rename.

Driven by [`agents/roadmaps/road-to-wizard-ux-improvements.md`](../../agents/roadmaps/road-to-wizard-ux-improvements.md) § Phase 4 (AI-council-resolved: reuse `packs.yml` as the single source of truth rather than a second mapping file).

### 2026-05-27 — Additive advisory `example_roles:` key on workspaces

Workspace entries in [`config/discovery/workspaces.yml`](../../config/discovery/workspaces.yml)
may carry an optional `example_roles: [<title>, …]` list of illustrative job
titles (e.g. `engineering: [Developer, CTO]`, `finance: [CFO]`). The wizard's
roles step shows the workspace as the *area* and these titles as examples under
it. **Advisory and free-form** — NOT a closed vocabulary: the stored
`.agent-user.yml` `role[]` is the workspace id, never these examples; nothing
acts on the strings beyond display. Emitted into the discovery manifest;
allowed by [`discovery-manifest.schema.json`](../contracts/discovery-manifest.schema.json).
Additive, no vocabulary rename. (Same change cleaned the `finance` label from
"Finance / CFO" to "Finance".)

### 2026-06-01 — New `fun` pack

Added pack id `fun` to the closed vocabulary (Non-essential social/fun
workflows — prediction-pool tip optimization, etc.). Mirrored in
[`config/discovery/packs.yml`](../../config/discovery/packs.yml) and the
`ADR_PACKS` frozenset in
[`scripts/lint_discovery_vocabulary.py`](../../scripts/lint_discovery_vocabulary.py).
Optional under the `small-business` workspace (alongside `ai-video`);
`trust_level_default: experimental`, `install.default: false`. First
artefacts: the `/prediction-pool` command + `prediction-pool-optimizer` skill in
`packages/pack-fun/`. Additive, no rename; non-overlap with cost-profile
and `profile.id` reservations holds.

## Cross-references

- [ADR-007 — Agent Discovery Scopes](ADR-007-agent-discovery-scopes.md):
  the manifest path resolves against the **active scope** (project vs.
  global), not against `cwd` alone.
- [ADR-010 — Profile / Pack / Preset Boundary](ADR-010-profile-pack-preset-boundary.md):
  this ADR touches the **pack axis only**; the non-overlap rule keeps
  the other three axes intact.
- [ADR-011 — Domain-Pack Readiness](ADR-011-domain-pack-readiness.md):
  packs are **labels on in-repo artefacts**, not separately-installable
  npm packages. Extraction stays blocked until ADR-011's trigger flips.
- [Implementing roadmap (archived, status: completed)](../../agents/roadmaps/archive/automated-pack-workspace-and-skill-discovery.md).
- Schema artefact: [`docs/contracts/discovery-manifest.schema.json`](../contracts/discovery-manifest.schema.json).
