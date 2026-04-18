# Reference analysis: kdcllc/agents_config

> A Python runtime library for validating Azure AI agent YAML configs — **not a
> competitor to this package**, but it ships three patterns worth adopting:
> OIDC-based PyPI publishing, GitHub Copilot's native chatmodes/instructions/prompts
> layout, and a proven `${env:}` + `${ref:}` substitution syntax.

- **Source:** https://github.com/kdcllc/agents_config
- **Default branch:** `master`
- **License:** MIT
- **Language:** Python 3.12+
- **Description (self):** "Robust Pydantic models for AI agent configuration
  with environment variable substitution"
- **Fetched:** 2026-04-18 (latest commit on `master`)
- **Focus:** full comparison
- **Analyst:** agent via `/analyze-reference-repo`

## TL;DR

### What this repo actually is

A **runtime library** that loads, validates, and resolves references in YAML
files that define AI agents (model + tools + prompt) for Azure OpenAI /
Azure AI Foundry / Ollama. Think "Pydantic for agent YAML", not
"skills/rules package for Claude/Cursor". The only overlap with our problem
space is incidental: the repo ships its own
`.github/copilot-instructions.md` so Copilot can help develop the library.

### Top 3 things to ADOPT

1. **PyPI Trusted Publishers (OIDC) workflow** — token-less publishing via
   GitHub Actions. Directly applicable to `road-to-ultimate.md` Phase 3
   (global CLI on PyPI).
2. **`${env:VAR}` + `${ref:path.to.value}` substitution syntax** — confirms
   the exact pattern I proposed for `mcp.json` in `road-to-ultimate.md`
   Phase 2. The reference implementation (`app/agents_config/base.py`) is ~70
   lines of clean regex + recursive walk — buildable in a day.
3. **Dedicated `PUBLISHING.md`** as a separate file from `CONTRIBUTING.md` —
   clean split between "how to contribute" and "how to release". We don't
   have a publishing guide today.

### Top 3 things to ADAPT

1. **`.github/chatmodes/*.chatmode.md`** — GitHub Copilot native feature for
   named chat modes. We don't project to this surface yet; our skills could
   map to chatmodes for Copilot-heavy users.
2. **`.github/instructions/*.instructions.md`** — per-language/per-topic
   instruction files (Copilot auto-selects them). We ship one monolithic
   `.github/copilot-instructions.md`. Worth investigating whether splitting
   improves Copilot's triggering.
3. **`.github/prompts/*.prompt.md`** — reusable prompts. Maps roughly to our
   commands; could be another projection target from `task generate-tools`.

### Top 3 things we ALREADY do better

1. Library breadth — 200+ skills/rules/commands/guidelines vs. zero curated
   agent content (the reference is a *tool to validate configs*, not a
   library of them).
2. Governance — `rule-type-governance`, `skill-quality`, `size-enforcement`,
   portability linter. Reference has none of this (out of scope for them).
3. Multi-tool projection — we support 6 tools (Augment, Claude, Cursor,
   Cline, Windsurf, Gemini). Reference targets GitHub Copilot only.

### Non-issue: "same name, same kind of thing"

Name collision is coincidental. Different layer, different audience, different
problem. No strategic threat, no overlap to worry about.

## Comparison matrix

| Axis | Reference | This repo | Label | Notes |
|---|---|---|---|---|
| **Product kind** | Python runtime library validating agent YAML | Agent-config package for AI coding tools | n/a | Wrong-category comparison — different problem. |
| **Distribution** | PyPI (`uv add agents-config` / `pip install`) | Composer + npm per project | n/a | Different domain. |
| **Scope** | Python package imported by the user's app | Project-scoped files in consumer repos | n/a | Different use site. |
| **Config format** | YAML + Pydantic validation | Markdown + frontmatter | n/a | Different content kind. |
| **License** | MIT | MIT | ALREADY | Aligned. |
| **Python runtime** | 3.12+ | 3.10+ (scripts only) | ALREADY | We don't claim to be a Python library. |
| **CI publish workflow** | GitHub Actions with PyPI Trusted Publishers (OIDC) | Composer/npm publish, no PyPI | **ADOPT** | Direct fit for road-to-ultimate Phase 3. See `.github/workflows/publish.yml`. |
| **Publishing docs** | Dedicated `PUBLISHING.md` | Publishing steps scattered in CONTRIBUTING.md | **ADOPT** | Split publishing from contribution. |
| **Env var substitution** | `${env:VAR_NAME}` regex in strings/dicts/lists | Documented for `.agent-settings` only | **ADOPT** | Use for `mcp.json` in road-to-ultimate Phase 2. |
| **Internal references** | `${ref:path.to.value}` with dot-notation resolver | Not present | **ADOPT** | Same pattern, same implementation cost. |
| **Secret resolver impl** | ~70 lines in `app/agents_config/base.py` (regex + recursion) | n/a (not yet built) | **ADOPT** | Clean reference implementation we can port idiomatically. |
| **Copilot chatmodes** | `.github/chatmodes/*.chatmode.md` (3 files) | Not generated | **ADAPT** | Map our skills → chatmodes as a projection target. |
| **Copilot instructions split** | `.github/instructions/*.instructions.md` (3 files) | Single `.github/copilot-instructions.md` | **ADAPT** | Test whether a split version improves Copilot selection. |
| **Copilot prompts** | `.github/prompts/*.prompt.md` (3 files) | Not generated | **ADAPT** | Map our commands → prompts projection. |
| **Runtime YAML agent defs** | Core product (Pydantic models for agents/models/tools) | Out of scope | **REJECT** | Different layer, not our problem. |
| **Azure AI Foundry / OpenAI SDK bindings** | First-class | None | **REJECT** | Not our domain. |
| **Skills library** | None (this is not their job) | 90+ curated | **ALREADY** | Different product. |
| **Rules / governance** | None | `rule-type-governance`, `skill-quality`, portability linter, size enforcement | **ALREADY** | Reference doesn't need these. |
| **Multi-tool projection** | Copilot only | Augment + Claude + Cursor + Cline + Windsurf + Gemini | **ALREADY** | Six targets vs. one. |
| **Compression pipeline** | Not applicable | `.agent-src.uncompressed/` → `.agent-src/` | **ALREADY** | Reference has nothing content-like to compress. |
| **Test framework** | pytest + pytest-cov + mypy + flake8 + black + isort | pytest + shell tests | UNCLEAR | They run mypy strict; worth checking if we should on `scripts/`. |
| **Copilot project hint** | README points to `.github/copilot-instructions.md` and chatmode files | Same | ALREADY | |

## Findings

### ADOPT

1. **OIDC PyPI publishing** — Read
   [`.github/workflows/publish.yml`](https://github.com/kdcllc/agents_config/blob/master/.github/workflows/publish.yml)
   before implementing road-to-ultimate Phase 3.4 (PyPI publish). Key points:
   `id-token: write` permission, PyPI Trusted Publisher pre-registration, no
   secrets needed. Folds straight into our Phase 3.
2. **`${env:}` / `${ref:}` substitution** — Port the logic from
   [`app/agents_config/base.py`](https://github.com/kdcllc/agents_config/blob/master/app/agents_config/base.py)
   to a small Python module for our `mcp.json` renderer (road-to-ultimate
   Phase 2.3). Two regex patterns, one dot-notation path resolver, recursive
   walk over dict/list/str. Error mode matches our "fail loudly" rule.
3. **`PUBLISHING.md`** — When road-to-ultimate Phase 3.4 lands, split
   publishing steps out of `CONTRIBUTING.md` into a dedicated file. Reference
   at
   [`PUBLISHING.md`](https://github.com/kdcllc/agents_config/blob/master/PUBLISHING.md).

### ADAPT

1. **Copilot chatmodes projection** — Investigate whether `task generate-tools`
   should emit `.github/chatmodes/<skill>.chatmode.md` for a curated subset
   of skills. Blockers: chatmodes expect a particular frontmatter shape
   (needs spec read), and we'd need to decide the curated subset. Not urgent
   — Copilot users today get value from `copilot-instructions.md` alone.
2. **Split `copilot-instructions.md` into per-topic files** — Test whether
   splitting our monolithic instructions into
   `.github/instructions/<topic>.instructions.md` improves Copilot's
   just-in-time selection. Requires knowing the exact file-naming rules
   Copilot uses to pick. Run A/B on one project before rolling out.
3. **Prompts projection** — Map our commands (`.agent-src/commands/*.md`) to
   `.github/prompts/*.prompt.md`. Requires:
   (a) confirm the Copilot-native prompt frontmatter spec,
   (b) decide whether this is worth the maintenance burden vs. our existing
   slash-command handling.

### REJECT

1. **Pydantic runtime library** — Wrong layer. We don't do runtime agent
   loading; we ship developer-facing content.
2. **YAML agent format** — Same reason. Our content is Markdown with
   frontmatter, agents consume it directly.
3. **Azure-specific bindings** — Out of scope.

### ALREADY

1. MIT license.
2. GitHub Actions CI for tests.
3. `pyproject.toml` + Python packaging conventions (we have `scripts/` but
   not a published Python distribution — see road-to-ultimate Phase 3).
4. Curated skill library (>200 items) — reference has no library at all.
5. Governance rules and linters — reference has none.

### UNCLEAR

1. **mypy strict on our Python code** — Reference runs `mypy --strict` on
   their library. Worth asking: should we run it on `scripts/`? Low priority
   but cheap.
2. **Chatmode / instructions / prompts spec stability** — GitHub's
   custom-chatmode feature is relatively new; frontmatter and naming rules
   may still churn. ADAPT items 1–3 should wait until the spec is fully
   stable or until we hear consumer demand.

## Proposed roadmap items

Fold into existing roadmaps — **no new roadmap needed**:

| Source finding | Target | Where |
|---|---|---|
| OIDC PyPI publishing | road-to-ultimate Phase 3.4 | Add a sub-bullet: "Use PyPI Trusted Publishers (OIDC); no secrets. Reference: kdcllc/agents_config `.github/workflows/publish.yml`." |
| `${env:}` / `${ref:}` substitution | road-to-ultimate Phase 2.3 | Add a sub-bullet: "Regex + dot-notation path resolver per reference pattern (kdcllc `app/agents_config/base.py`). ~70 lines." |
| `PUBLISHING.md` | road-to-ultimate Phase 3.6 | Add a sub-bullet: "Split publishing into `docs/publishing.md`; keep `CONTRIBUTING.md` focused on PR flow." |
| Chatmodes / instructions / prompts projection | **New Phase 7 — Copilot-native projections (P3)** | Only if we decide it's worth the churn; three ADAPT items above are the sub-tasks. |
| mypy strict on `scripts/` | Housekeeping, not a roadmap item | Separate chore-task once the Python package is extracted. |

## Open questions for the maintainer

1. Do we want to pursue the Copilot chatmodes/instructions/prompts projection
   (ADAPT items 1–3) as a new Phase 7 of `road-to-ultimate.md`, or defer
   until there is user demand?
2. Should I update `road-to-ultimate.md` now to cite `kdcllc/agents_config`
   in Phases 2.3 and 3.4 as a reference implementation?
3. Is a dedicated `docs/publishing.md` worth writing now (aligned with the
   existing Composer/npm publish workflow), or only when the PyPI publish
   lands?

## References

- Repository: https://github.com/kdcllc/agents_config
- Secret substitution impl (port target):
  https://github.com/kdcllc/agents_config/blob/master/app/agents_config/base.py
- OIDC publish workflow (port target):
  https://github.com/kdcllc/agents_config/blob/master/.github/workflows/publish.yml
- Publishing guide (structure inspiration):
  https://github.com/kdcllc/agents_config/blob/master/PUBLISHING.md
- Our sibling roadmap:
  [`agents/roadmaps/road-to-ultimate.md`](../roadmaps/road-to-ultimate.md)
- Command that produced this document:
  [`.agent-src.uncompressed/commands/analyze-reference-repo.md`](../../.agent-src.uncompressed/commands/analyze-reference-repo.md)
