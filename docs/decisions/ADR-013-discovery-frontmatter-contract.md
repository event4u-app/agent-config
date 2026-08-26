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
keys from colliding with the existing `rule_loading_tier` / `profile.id` axes
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
| `legal` | Legal | In-house legal — contract/NDA/DPA review, privacy, legal triage (EU/DE scope). |
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
| `legal` | In-house legal — EU/DE-scoped contract/NDA/DPA review and legal triage; procedure-only, attorney-review draft output. |
| `ai-video` | AI video pipeline (per ADR-011, the only heavyweight domain). |
| `fun` | Non-essential social/fun workflows (prediction-pool tips, etc.). Optional under the `small-business` workspace; `experimental` trust. |
| `meta` | Artefacts that maintain *this* package (`agent-config` itself). |
| `git` | Git workflow — commit, pull requests, branch sync. Carries `slug_prefix: git` (ADR-044 §A3); `requires: engineering-base`. Added 2026-06-04 for 6.0.0-D Step 12 Class B1 (`commit`→`git-commit`, `create-pr`→`git-pr-create`). |
| `frontend-design` | Grounded design intelligence — design-knowledge corpus + BM25 grounding engine, design tokens, stack best-practice and chart/typography knowledge. `requires: engineering-base`; `suggests: react, nextjs`. Added 2026-06-07 (ADR-061). |
| `analysis-workbench` | RCA, post-mortem, premortem, decision-review as an integrated learning loop. `requires: engineering-base`; opt-in under the `engineering` workspace. Added 2026-06-15 (ADR-096). |
| `brand` | Brand as a first-class UX layer — archetype/voice/identity grounding corpus, brand→token derivation, and consistency governance that constrains UI. `requires: frontend-design`; `suggests: ai-image`; opt-in under the `engineering` workspace. Added 2026-06-16 (road-to-image-brand-typography Phase B). |
| `scale-discipline` | Scale-safe persistence — index parity, bounded reads, migration safety, growth budgets, thin request path, durable async; deterministic pattern lints (`lint_persistence`) gate, heuristics advise. `requires: engineering-base`; `experimental`/lab, `default_install: false` until benched. Added 2026-07-27 (road-to-scale-and-history-discipline Phase 1). |
| `history-discipline` | Audit/change history done right — audit coverage on declared scopes, cheapest-sufficient tier matrix (default: row-level audit log; event sourcing only by waiver), audit-table hygiene, privacy + reliability interlocks. `requires: scale-discipline`; `experimental`/lab, `default_install: false` until benched. Added 2026-07-27 (road-to-scale-and-history-discipline Phase 3). |
| `forensics` | Machine-derived release evidence from git history alone — hotspot risk (change frequency x complexity) and change-coupling analyzers; deterministic, read-only, advisory to the release findings pipeline. `requires: engineering-base`; `experimental`/lab, `default_install: false`. Added 2026-08-09 (road-to-judgment-and-forensic-evidence Phase 3). |

Amendments to the pack list require an ADR-013 amendment and the
matching `src/config/discovery/packs.yml` row in the same PR.

### Non-overlap rule (ADR-010 alignment)

- `rule_loading_tier` values (`minimal`, `balanced`, `full`, `custom`) are
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
  declares the new keys, or sits in `src/config/discovery/unassigned-artefacts.yml`
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
[`scripts/lint_artefact_frontmatter.py`](../../src/scripts/lint_artefact_frontmatter.ts),
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

Pack entries in [`src/config/discovery/packs.yml`](../../config/discovery/packs.yml)
may carry an optional `cluster: <language-id>` field. It groups a framework
pack under a programming-language tile in the setup wizard's capability-packs
step (e.g. `laravel: cluster: php`, `react: cluster: typescript`). Like
`requires_hint`, it is **advisory only** — the installer does not act on it; it
drives the wizard UI's collapsible language→framework grouping. The value must
be a known pack id (and not self-referential), enforced by
[`scripts/lint_discovery_vocabulary.py`](../../src/scripts/lint_discovery_vocabulary.ts)
and emitted into the discovery manifest. Additive, no vocabulary rename.

Driven by [`agents/roadmaps/road-to-wizard-ux-improvements.md`](../../agents/roadmaps/road-to-wizard-ux-improvements.md) § Phase 4 (AI-council-resolved: reuse `packs.yml` as the single source of truth rather than a second mapping file).

### 2026-05-27 — Additive advisory `example_roles:` key on workspaces

Workspace entries in [`src/config/discovery/workspaces.yml`](../../config/discovery/workspaces.yml)
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
[`src/config/discovery/packs.yml`](../../config/discovery/packs.yml) and the
`ADR_PACKS` frozenset in
[`scripts/lint_discovery_vocabulary.py`](../../src/scripts/lint_discovery_vocabulary.ts).
Optional under the `small-business` workspace (alongside `ai-video`);
`trust_level_default: experimental`, `install.default: false`. First
artefacts: the `/prediction-pool` command + `prediction-pool-optimizer` skill in
`packages/pack-fun/`. Additive, no rename; non-overlap with cost-profile
and `profile.id` reservations holds.

### 2026-06-07 — New `frontend-design` pack

Added pack id `frontend-design` to the closed vocabulary (grounded design
intelligence — design-knowledge corpus + BM25 grounding engine, design tokens,
stack best-practice and chart/typography knowledge, adopted from the MIT
an external reference corpus per ADR-061). Mirrored in
[`src/config/discovery/packs.yml`](../../src/config/discovery/packs.yml) and the
`ADR_PACKS` frozenset in
[`scripts/lint_discovery_vocabulary.py`](../../src/scripts/lint_discovery_vocabulary.ts).
`workspaces: [engineering]`, `requires: [engineering-base]`,
`suggests: [react, nextjs]` (the corpus is stack-agnostic data — React is
suggested, never required), `trust_level_default: professional`,
`size_class: medium`. Council-resolved 2026-06-07 (anthropic/claude-sonnet-4-5 +
openai/gpt-4o, converged A2: opt-in pack over inflating `engineering-base`
with ~1 MB of design data). Additive, no rename; non-overlap with
cost-profile and `profile.id` reservations holds.

### 2026-06-16 — New `brand` pack

Added pack id `brand` to the closed vocabulary (brand as a first-class UX layer
— archetype/voice/identity grounding corpus, brand→token derivation, and
consistency governance that constrains UI). Mirrored in
[`src/config/discovery/packs.yml`](../../src/config/discovery/packs.yml) and the
`ADR_PACKS` frozenset in
[`scripts/lint_discovery_vocabulary.py`](../../src/scripts/lint_discovery_vocabulary.ts).
`workspaces: [engineering]`, `requires: [frontend-design]`, `suggests:
[ai-image]` (pack-brand exports tokens, pack-ai-image consumes them — B → A),
`trust_level_default: professional`, `size_class: medium`. Council-resolved
2026-06-13 (road-to-image-brand-typography Phase B). Additive, no rename;
non-overlap with cost-profile and `profile.id` reservations holds.

### 2026-06-24 — New `legal` workspace + `legal` pack

Added workspace id `legal` and pack id `legal` to the closed vocabularies
(in-house legal — EU/DE-scoped contract/NDA/DPA review and legal triage;
procedure-only, no default legal positions; every output a draft for attorney
review). Mirrored in
[`src/config/discovery/workspaces.yml`](../../src/config/discovery/workspaces.yml),
[`src/config/discovery/packs.yml`](../../src/config/discovery/packs.yml), and the
`ADR_WORKSPACES` + `ADR_PACKS` sets in
[`src/scripts/lint_discovery_vocabulary.ts`](../../src/scripts/lint_discovery_vocabulary.ts).
`workspaces: [legal]`, `domain: legal`, `size_class: medium`,
`trust_level_default: experimental`, `surface_tier: lab` (gated lab-tier until the
Gate-2 maintenance owner + external qualification is confirmed —
road-to-legal-pack Phase 0.2). Council-resolved across three rounds 2026-06-24
(road-to-legal-pack). Additive, no rename; non-overlap with cost-profile and
`profile.id` reservations holds.

### 2026-06-24 — Rename `legal` → `legal-review-prep` (workspace + pack)

Renamed the workspace id and pack id `legal` → `legal-review-prep` in both
closed vocabularies, the schema enums, and all artefacts (`src/domains/legal/`
→ `src/domains/legal-review-prep/`, the five skill frontmatters, the
`legal-safety-floor` rule). Driven by a deep AI-council (3 rounds,
anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-24) + ~8 external
7.1.0 reviewers: the name `legal` reads as "legal advice" and undermines the
not-legal-advice positioning; `legal-review-prep` names the actual capability
(prepare for attorney review). The `domain: legal` classifier and the `legal`
user-type are a different axis and are unchanged. Rename, not additive;
non-overlap reservations still hold. See `road-to-legal-review-prep` Phase 0.

### 2026-08-02 — Strict five-key enforcement narrowed to `workspaces` + `packs`

The Phase-4 reading of this ADR — *all five discovery keys strictly enforced on
every artefact* — is **narrowed**, at both nesting levels, to one rule:

> **Keys and sub-keys that carry irreducible information are required.
> Everything the schema gives a default is validated-when-present.**

Concretely, `lint_artefact_frontmatter` now requires only `workspaces` and
`packs`. `lifecycle`, `trust` and `install` — and, inside the latter two, each
individual sub-key (`trust.level`, `trust.confidence`,
`trust.human_review_required`, `install.default`, `install.removable`) — are
optional and take their documented schema default when absent. Every enum and
type check survives untouched for values that ARE written down: a wrong
`lifecycle` enum, a non-bool `trust.human_review_required`, a `trust` that is
not a mapping all still fail. The narrowing changes *when* the checks fire,
never what they accept.

**Why.** Repairing that gate's dead scan root (ADR-051 moved the source
container; the gate had been walking the retired one and reporting
`0 artefact(s) clean`) surfaced 1523 findings across 618 artefacts. Two facts
decided the disposition:

1. **Two gates asserted contradictory contracts and only one was ever
   enforced.** `validate_frontmatter` — green for months against
   `src/scripts/schemas/skill.schema.json` — lists
   `required: ["name","description","source","domain"]`, requiring none of the
   five, and gives `lifecycle` (`"active"`), `trust` and `install` documented
   defaults. `lint_artefact_frontmatter` demanded all five but was blind the
   whole time. When two gates conflict and only one has actually run, the
   enforced one reflects the real contract.
2. **The corpus splits exactly along the information line.** `workspaces` and
   `packs` are absent **0** times in 618 artefacts; `lifecycle`, `trust` and
   `install` are absent 574 / 459 / 456 times. A default can supply a lifecycle
   state or a trust level; it cannot invent which workspace or pack an artefact
   belongs to. That 100 % / 0 % split is evidence the discovery contract *is*
   honoured precisely where it carries irreducible information.
3. **The same holds one level down, and the first pass contradicted itself
   there.** Requiring only the top-level keys still left 327 findings, all
   absent *sub-keys* of a `trust:` / `install:` block that was present. Across
   288 skills `trust` is complete **0** times (120 partial, 168 absent) — a
   required shape with zero adoption was never the requirement — and
   `validate_frontmatter` accepts them because `apply_schema_defaults` fills
   missing sub-keys before validating. The gate had also become internally
   inconsistent: it honoured the documented default for an absent `trust`
   object and refused that same default for a partial one. Sub-keys now default
   too, which takes the gate to **0 violations across 618 artefacts**.

This is deliberately **not** "the gate found too much, so weaken the gate": the
narrowing follows the enforced schema, not the size of the finding count.
Recording a 1523-entry ratchet baseline was rejected for a related reason — the
ratchet policy (council 2026-08-02, roadmap `road-to-gates-that-can-fail`) was
calibrated on a measured premise of ~36 findings in total, and a 56-day expiry
over 593 files is not pressure but an unbeatable clock, so the entry would be
reaffirmed into permanence and the ratchet would become the mechanism by which
drift hardens.

Decided by AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
converged), 2026-08-02; both members stated the ratchet ruling does not survive
at this magnitude. Pinned by tests in
`tests/scripts/lint_artefact_frontmatter.test.ts` asserting both directions.

**Related correction, same pass.** The quarantine-collision check ("listed in
`unassigned-artefacts.yml` AND declaring discovery frontmatter") tested bare key
NAMES, so it read `trust: durable` on the knowledge-card template and
`trust: low` on the lesson-card template as discovery frontmatter. Those are
scalars in unrelated template schemas; ADR-013 `trust` is an object. Neither the
quarantine entries nor the templates were wrong — the predicate was. It now
counts `trust` only when object-shaped (`workspaces` / `packs` / `lifecycle` /
`install` remain unambiguous by name). Those two were the only hits of any of
the five names across the entire quarantine list, so no data was changed.

**Net result:** `lint_artefact_frontmatter` scans 618 artefacts (was 0) and
reports 0 violations. No ratchet baseline entry exists for this gate.

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
