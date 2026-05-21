---
stability: beta
keep-beta-until: 2026-08-19
---

# Per-artefact frontmatter contract

> Companion to [`ADR-013`](../decisions/ADR-013-discovery-frontmatter-contract.md)
> and [`discovery-manifest.schema.json`](discovery-manifest.schema.json). The
> ADR is the decision; this file is the worked-example reference linters,
> installer, and contributors cite at runtime.

Every `.md` artefact under `.agent-src.uncompressed/` MUST declare the five
ADR-013 discovery keys. The release-time manifest builder
(`scripts/build_discovery_manifest.py`) derives all workspace/pack assignment
from these alone — **no manual workspace or pack list is ever maintained**.

## Required keys

| Key | Type | Vocabulary | Source |
|---|---|---|---|
| `workspaces` | `array<string>`, ≥1 | [`config/discovery/workspaces.yml`](../../config/discovery/workspaces.yml) | role-based axis |
| `packs` | `array<string>`, ≥1 | [`config/discovery/packs.yml`](../../config/discovery/packs.yml) | functional axis |
| `lifecycle` | enum | `active` · `experimental` · `deprecated` · `archived` | review cycle |
| `trust.level` | enum | `core` · `professional` · `experimental` · `advisory` · `restricted` | safety gate |
| `trust.confidence` | enum | `high` · `medium` · `low` | curator signal |
| `trust.human_review_required` | bool | — | reviewer routing |
| `install.default` | bool | — | ships-by-default toggle |
| `install.removable` | bool | — | core / removable axis |

Vocabularies are **closed**. New entries require an amendment to
[`ADR-013`](../decisions/ADR-013-discovery-frontmatter-contract.md) in the
same PR. The linter
([`scripts/lint_artefact_frontmatter.py`](../../scripts/lint_artefact_frontmatter.py))
rejects free-text values.

## Worked examples

### Skill — `laravel/SKILL.md`

```yaml
---
name: laravel
description: "Writes Laravel PHP — Eloquent, Artisan, FormRequests, jobs, policies."
source: package
domain: engineering
workspaces:
  - engineering
packs:
  - laravel
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---
```

### Rule — `rules/commit-policy.md`

```yaml
---
type: "always"
tier: "safety-floor"
description: "Commit policy — never commit unless explicitly authorized this turn."
alwaysApply: true
source: package
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---
```

### Command — `commands/cost-report.md`

```yaml
---
name: cost-report
tier: 2
description: "Capture token cost from the active session and surface the 50/75/90/100% budget ladder."
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---
```

## Quarantine

Artefacts that genuinely cannot yet carry frontmatter (early scaffolds,
generated stubs) MUST be listed in
[`config/discovery/unassigned-artefacts.yml`](../../config/discovery/unassigned-artefacts.yml)
with a `reason`. A quarantined entry MUST NOT also carry the five keys —
the linter rejects that collision.

## Enforcement

| Surface | What runs | When |
|---|---|---|
| Local | `task lint-artefact-frontmatter` | manual / pre-commit |
| Pre-commit | `pre-commit-roadmap-progress` template | when `.agent-src.uncompressed/*.md`, `config/discovery/*.yml`, or the linter itself is staged |
| CI | `task ci` → `lint-artefact-frontmatter` | every push / PR |

Install the pre-commit hook with:

```bash
./agent-config hooks:install            # combined hook (roadmap + frontmatter)
./agent-config hooks:install --print    # dump to stdout for manual chaining
```

The hook is opt-in per concern — it short-circuits when no relevant files
are staged.

## Roundtrip invariant

Frontmatter survives the `task sync` compression pipeline. Path-bearing
keys (`load_context`) may be rewritten relative to the projected location,
but the five Phase-1 keys above are byte-stable between
`.agent-src.uncompressed/`, `.agent-src/`, and `.augment/`. Enforced by
`tests/test_frontmatter_roundtrip.py`.
