---
stability: beta
keep-beta-until: 2026-08-14
---

# Multi-Tool Projection Fidelity Contract

**Status:** beta · **Phase 4 of [step-1-v2-feedback-followup](../../agents/roadmaps/step-1-v2-feedback-followup.md)**

Names the **per-tool guarantees** the projection pipeline (`scripts/compress.py --sync` + `scripts/compress.py --generate-tools`) actually delivers. Byte-equivalence is not behaviour-fidelity — each consumer tool has its own frontmatter grammar, its own activation model, and its own surface for skills / rules / commands.

## Source of truth

Every projection starts from `.agent-src/` (compressed) which is generated from `.agent-src.uncompressed/`. The projection layer **never** writes to source; it only reads.

## Per-tool projection map

| Tool | Rules surface | Skills surface | Commands surface | Frontmatter grammar |
|---|---|---|---|---|
| **Augment** (host) | `.augment/rules/*.md` (copies; symlink opt-in via `augment.rules_use_symlinks`) | `.augment/skills/<name>/SKILL.md` (symlink → `.agent-src/skills/`) | `.augment/commands/*.md` | full source frontmatter preserved |
| **Claude** (Code + Desktop) | `.claude/rules/*.md` | `.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` (commands rendered as skills) | full source frontmatter preserved |
| **Cursor** | `.cursor/rules/*.mdc` + legacy `.md` symlinks (130 files = 65 × 2) | **not projected** | `.cursor/commands/*.md` | `description`, `globs`, `alwaysApply` only — `triggers`, `routes_to`, `tier`, `type` are **dropped** |
| **Windsurf** | `.windsurfrules` (single concatenated file) + `.windsurf/rules/*.md` (per-rule) | **not projected** | `.windsurf/workflows/*.md` | concatenated body; per-rule frontmatter only retained in `.windsurf/rules/`, not in the legacy `.windsurfrules` single-file |
| **Cline** | `.clinerules/*.md` | **not projected** | **not projected** | full router frontmatter preserved (`type`, `tier`, `description`, `triggers`, `routes_to`) |
| **Gemini** | `GEMINI.md` (single-file digest) | embedded inline | embedded inline | digest only — no per-rule frontmatter |
| **Copilot** | `AGENTS.md` / `copilot-instructions.md` | embedded inline | embedded inline | digest only |

`AGENTS.md` is the **tool-agnostic root pointer** and exists at workspace root regardless of which projections are enabled.

## Fidelity guarantees per axis

### 1. Rule body fidelity

| Tool | Body identical to source? |
|---|---|
| Augment | yes (copy or symlink) |
| Claude | yes (copy) |
| Cursor `.mdc` | yes |
| Cline | yes |
| Windsurf single-file | concatenated, separator `---` between rules |
| Windsurf per-rule | yes |
| Gemini / Copilot digest | summarised — **no fidelity guarantee** |

### 2. Trigger fidelity (`triggers:` keyword / `path_prefix`)

| Tool | `triggers:` preserved? |
|---|---|
| Augment, Claude, Cline, Windsurf-per-rule | **yes** — the host LLM sees the trigger set verbatim |
| Cursor `.mdc` | **no** — Cursor's frontmatter grammar does not honour `triggers:`; activation falls back to `globs:` + `alwaysApply: <bool>` + description match |
| Windsurf single-file `.windsurfrules` | **no** — concatenated body strips per-rule frontmatter |
| Gemini, Copilot | **no** — digest format |

**Consequence:** rules that depend on `triggers:` for activation (tier-2a path-prefix routing, tier-3 keyword routing) **silently degrade on Cursor and on the Windsurf single-file**. They still appear in body, but the host must infer activation from prose.

### 3. `routes_to:` fidelity

Same matrix as `triggers:` — preserved on Augment, Claude, Cline, Windsurf-per-rule; **dropped** on Cursor `.mdc` and Windsurf single-file.

**Consequence:** the four tier-3 routing rules (`laravel-routing`, `symfony-routing`, `copilot-routing`, `devcontainer-routing`) added in Phase 3.3 will route deterministically on Augment / Claude / Cline; on Cursor / Windsurf-single-file the host must rely on description matching alone.

### 4. Skill surface

Cursor, Windsurf, Cline, Gemini, Copilot have **no native skill surface**. Skills are projected only for Augment and Claude. Consumers on the other tools see skill content only indirectly (via rule bodies that cite skills, or via the catalogue in `AGENTS.md`).

### 5. Command surface

| Tool | Where commands appear |
|---|---|
| Augment | `.augment/commands/*.md` (native slash-command surface) |
| Claude | `.claude/skills/<command>/SKILL.md` (commands rendered as skills with `disable-model-invocation: true`) |
| Cursor | `.cursor/commands/*.md` (106 files) |
| Windsurf | `.windsurf/workflows/*.md` (106 files) |
| Cline | none |
| Gemini, Copilot | listed only inside `AGENTS.md` / `GEMINI.md` digest |

## Automated probe — `task lint-projection-fidelity`

`scripts/probe_projection_fidelity.py` reads `tests/fixtures/projection_fidelity/fixtures.yml` and asserts the per-tool guarantees above against the actual projected trees. The fixture covers five representative artefacts:

| Fixture entry | Tier | Stress-tests |
|---|---|---|
| `rule:non-destructive-by-default` | kernel | always-active body fidelity across all five rule surfaces |
| `rule:laravel-translations` | tier-2a | `path_prefix:` trigger preservation (Cline) vs drop (Cursor) |
| `rule:laravel-routing` | tier-3 | `routes_to:` preservation (Cline) vs drop (Cursor, Windsurf-single) |
| `skill:laravel` | skill | Augment + Claude only; rationale for absence on others |
| `command:commit` | command | per-tool command surface divergence |

Run: `python3 scripts/probe_projection_fidelity.py` — exits non-zero on any divergence. Report at `agents/reports/projection-fidelity.json`.

## Known divergences (do not file as bugs)

These are **architectural facts**, not regressions. They are documented so installers and consumers know what to expect.

1. **Cursor `.mdc` drops router metadata.** Cursor's third-party rule format only honours `description`, `globs`, `alwaysApply`. Adding `triggers:` or `routes_to:` to a Cursor rule has no effect at activation time. The body still loads when the description matches; the deterministic routing layer does not.
2. **Windsurf single-file (`.windsurfrules`) strips per-rule frontmatter.** Legacy compatibility surface. The new `.windsurf/rules/*.md` per-rule files preserve the full frontmatter — consumers should prefer those.
3. **Skills do not project to Cursor / Windsurf / Cline / Gemini / Copilot.** These tools have no native skill loader. Skill content reaches consumers indirectly via rule bodies and the `AGENTS.md` catalogue.
4. **Augment historically did not load symlinked rules.** Default is to **copy** rules into `.augment/rules/`. Opt into symlinks via `augment.rules_use_symlinks: true` in `.agent-settings.yml`.
5. **`task generate-tools` does not refresh `.augment/rules/`.** Only `task sync` (== `scripts/compress.py --sync`) copies rules into the Augment tree. Investigators who edit a rule, run only `generate-tools`, and then `ls .augment/rules/` will see stale state.

## Acceptance criteria for this contract

- [x] Fixture under `tests/fixtures/projection_fidelity/`
- [x] Probe script under `scripts/probe_projection_fidelity.py`
- [x] Report under `agents/reports/projection-fidelity.json`
- [x] Per-tool guarantee table above
- [x] Known-divergence list above

## Related

- [`source-projection`](../architecture/source-projection.md) — pipeline A (source compression)
- [`augment-projection`](../architecture/augment-projection.md) — pipeline B (Augment-specific)
- [`multi-tool-projection`](../architecture/multi-tool-projection.md) — pipeline C (the per-tool emitters)
- [`rule-router`](rule-router.md) — the `triggers:` / `routes_to:` grammar this contract pins
- [`agents/council-sessions/2026-05-14-v2-analysis/feedback/09-cross-tool-projection-fidelity.md`](../../agents/council-sessions/2026-05-14-v2-analysis/feedback/09-cross-tool-projection-fidelity.md) — origin council feedback
