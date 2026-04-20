# Roadmap: Road to Ultimate — Ecosystem & Interop

> Open the package to **third-party content and cross-platform tooling** without
> sacrificing curation — external skill sources, MCP generation, globally
> installable CLI, platform auto-detection, and opt-in upstream sync.

Source: Competitive analysis of
[`dongitran/ai-agent-config`](https://github.com/dongitran/ai-agent-config) (NPM
CLI, user-scoped config, bi-directional GitHub sync, MCP + Bitwarden) combined
with the strategic goal of becoming *the* ultimate agent setup and governance
package.

Sibling: [`road-to-9.md`](road-to-9.md) covers **depth** (real runtime, one
killer flow, installer consolidation). This roadmap covers **breadth**
(ecosystem, interop, third-party content) without giving up our governance
model.

**Guiding principle:** Adopt openness where it serves us. Keep governance
where it differentiates us. No blind copies, no feature cargo-cult.

## Prerequisites

- [ ] [`road-to-9.md`](road-to-9.md) Phase 1 landed — a real minimal runtime
      exists. Ecosystem features on a scaffold are wasted effort.
- [ ] Read [`.agent-src.uncompressed/skills/mcp/SKILL.md`](../../.agent-src.uncompressed/skills/mcp/SKILL.md)
      — current MCP surface and what it already promises.
- [ ] Read [`scripts/install.py`](../../scripts/install.py) and
      [`scripts/install.sh`](../../scripts/install.sh) — the installers to
      extend.
- [ ] Read [`.agent-src.uncompressed/skills/upstream-contribute/SKILL.md`](../../.agent-src.uncompressed/skills/upstream-contribute/SKILL.md)
      — existing one-way contribution story.
- [ ] Read [`docs/architecture.md`](../../docs/architecture.md) — confirm the
      stable/experimental split before extending surfaces.
- [ ] Branch off `main` after 1.5.0.

## Context

### What the competitor does well

| Capability | Competitor | Us (today) |
|---|---|---|
| Distribution | NPM global (`npm i -g`) | Composer + npm **per project** |
| Config scope | User (`~/.ai-agent/`) + project | Project only |
| External skill sources | `sources add <git-url>` CLI | **Missing** — fork or edit `.augment/` |
| MCP server config | Generates Claude/Cursor/Codex configs from one source | Documented, not generated |
| Secret resolution | Bitwarden CLI placeholder expansion | **Missing** |
| Upstream sync | Weekly GitHub Action auto-PR | **Missing** |
| Platform detection | Detects installed AI tools, writes config only for those | Writes all tool configs regardless |

### What **we** do better (and must not lose)

- Curated library (>200 skills/rules/commands/guidelines vs. a handful).
- Compression pipeline (`.agent-src.uncompressed/` → `.agent-src/`).
- Governance rules (`rule-type-governance`, `size-enforcement`,
  `skill-quality`, `tool-safety`, `runtime-safety`).
- Cross-tool projection via `task generate-tools` (Claude, Cursor, Cline,
  Windsurf, Gemini).
- Project-scoped AGENTS.md + copilot-instructions.md flow with portability
  linter.

### Strategic framing

| Axis | Competitor | Us |
|---|---|---|
| **Openness** | High — marketplace-shaped | Low — curated-package-shaped |
| **Governance** | Thin | Deep |
| **Runtime** | None claimed | Scaffolded (see road-to-9) |
| **Quality floor** | User-responsibility | Package-enforced |

The goal of this roadmap is **not** to become the competitor. The goal is to
close the openness gap **while keeping** the governance floor.

- **Feature:** none (strategic follow-up to 1.4.0 external review + competitor
  analysis)
- **Jira:** none
- **Target releases:** 1.7.0 (Phases 1–2), 1.8.0 (Phases 3–4), 1.9.0 (Phases 5–6)

## Phase 1: External skill sources (P0)

**Problem:** Consumers cannot add third-party skill/rule/command repos without
forking us or hand-editing `.augment/`. That caps our ecosystem reach.

**Scope:** A source descriptor, a CLI to manage sources, a sync step that
materializes external content under a clearly tagged path, and linter gates
that enforce our quality floor on external content.

- [ ] **1.1** Define source descriptor: `agents/sources/<name>.json` with
      fields `url`, `ref` (branch/tag/sha), `path` (subdir inside source repo),
      `enabled: bool`, `kind: "skills|rules|commands|guidelines"`,
      `trust: "verified|community"`.
- [ ] **1.2** CLI — `scripts/sources.py` with `add|remove|list|sync|verify`.
      Reuse `install.py` conventions, no new framework.

- [ ] **1.3** Sync target: `.agent-src/external/<source-name>/...` — never
      merged into curated paths, always clearly labeled.
- [ ] **1.4** Projection: `task generate-tools` emits external content under
      `external/` namespace in every tool directory (Claude, Cursor, …).
- [ ] **1.5** Quality gate: `scripts/skill_linter.py --external` runs against
      synced content with the **same rules** as our own skills. Failures
      block the sync with a readable report.
- [ ] **1.6** `.gitignore` handling: `.agent-src/external/` is committed (so
      consumers get deterministic builds); fetches are reproducible from
      `agents/sources/*.json`.
- [ ] **1.7** Trust model: `trust: verified` requires a pinned commit SHA;
      `community` allows floating refs but warns on every sync.
- [ ] **1.8** Tests: `tests/test_sources.py` — descriptor validation, sync
      idempotency, linter integration, namespace isolation.

**Acceptance criteria:**
- `event4u-agent sources add <url> --name foo` creates a descriptor and
  syncs once.
- External skills live under `.augment/external/foo/skills/`, never under
  `.augment/skills/`.
- `task lint-skills` covers external content and blocks bad sources.
- `event4u-agent sources list` shows each source, ref, pinned SHA, last
  sync time, lint status.

## Phase 2: MCP config generation (P0)

**Problem:** We document MCP but don't generate per-platform configs. Users
hand-write `claude_desktop_config.json`, `cursor-mcp.json`, etc.

**Scope:** One source-of-truth `mcp.json`, a renderer that emits per-tool
shapes, and a secret resolver with env + keychain backends.

- [ ] **2.1** `mcp.json` schema — server list with
      `{ name, command, args, env, placeholders }` where placeholders are
      `${SECRET:…}` / `${ENV:…}` tokens.
- [ ] **2.2** Renderer `scripts/mcp_render.py` — emits:
      `~/.config/claude-desktop/claude_desktop_config.json`,
      `.cursor/mcp.json`, Windsurf-compatible output.
- [ ] **2.3** Pluggable secret backends: `env`, `keychain` (macOS `security`,
      Linux `secret-tool`), `file` (last resort, warned). **No bundled
      Bitwarden dependency** — users bring their own.
- [ ] **2.4** Resolver contract: unresolved placeholders fail loudly with a
      report. Never silently write empty values.
- [ ] **2.5** Task entries: `task mcp:render` + `task mcp:check` (dry-run).
- [ ] **2.6** Docs: `docs/mcp.md` — schema, backends, worked example.
- [ ] **2.7** Tests: fixture `mcp.json`, assert identical output per target,
      assert unresolved-secret failure mode.

**Acceptance criteria:**
- One `mcp.json` edit produces correct output for every supported tool.
- Missing secrets cause non-zero exit with a human-readable report.
- Running the renderer twice with no change is a no-op.

## Phase 3: Globally installable CLI (P1)

**Problem:** Our tooling lives in `scripts/*.py` and `Taskfile.yml`, both
require a repo checkout.

**Scope:** Package the CLI as a pip-installable distribution with one entry
point; shell and PHP wrappers become thin fallbacks.

- [ ] **3.1** Consolidate `scripts/` into `event4u_agent_config/` Python
      package (namespaced, importable).
- [ ] **3.2** `pyproject.toml` with
      `[project.scripts] event4u-agent = event4u_agent_config.cli:main`.
- [ ] **3.3** Subcommands: `install`, `sources`, `mcp`, `generate-tools`,
      `lint`, `sync`. Each dispatches to existing script logic.
- [ ] **3.4** Publish to PyPI as `event4u-agent-config`. Keep Composer + npm
      distributions unchanged — they stay the bundling path.
- [ ] **3.5** `install.sh` / `install.php` detect the CLI on PATH and defer
      to it; fall back to inline logic only when unavailable.
- [ ] **3.6** Docs: `docs/installation.md` adds a "global CLI" section.
      Both paths are first-class.

**Acceptance criteria:**
- `pipx install event4u-agent-config && event4u-agent install --here` works
  on a clean machine.
- Composer/npm consumers see **zero** breaking change.
- `event4u-agent --version` matches the package version.

## Phase 4: Platform auto-detection (P1)

**Problem:** `task generate-tools` writes configs for every supported tool
regardless of what's installed.

**Scope:** Detect installed tools, expose detection as a command, add
`--only-detected` to install + generate.

- [ ] **4.1** `scripts/detect_platforms.py` — probes for Claude Desktop,
      Cursor, Cline, Windsurf, Gemini CLI, Codex (path + config presence).
- [ ] **4.2** Output: machine-readable JSON + human-readable table.
- [ ] **4.3** Integrate: `task install -- --only-detected`,
      `task generate-tools -- --only-detected`.
- [ ] **4.4** CI keeps generating all platforms in this repo so tests cover
      every projection.
- [ ] **4.5** Docs: `docs/installation.md` documents the flag. Default stays
      "all" for reproducibility.

**Acceptance criteria:**
- On a Cursor-only machine, `--only-detected` produces `.cursor/` and
  **nothing else**.
- Detection table lists each platform with `found | not-found | path`.

## Phase 5: Upstream sync automation (P2)

**Problem:** External sources drift. Manual re-sync is error-prone.

**Scope:** Scheduled Action that re-syncs sources, runs linters, opens PR.

- [ ] **5.1** `.github/workflows/sync-sources.yml` — weekly cron +
      `workflow_dispatch`.
- [ ] **5.2** Steps: fetch sources → `event4u-agent sources sync` →
      `task lint-skills` → if diff, open/update PR
      `chore(sources): weekly sync <date>`.
- [ ] **5.3** PR body lists each source: old ref → new ref, lint result.
- [ ] **5.4** Failure mode: failing sources stay at old pin; PR flagged
      `needs-review`, other sources still update.
- [ ] **5.5** Docs: `docs/sources.md` — "Upstream sync" section.

**Acceptance criteria:**
- Weekly run creates or updates a single PR — never more than one open.
- Failing sources don't break the sync for other sources.

## Phase 6: Config profiles (P3 — optional)

**Problem:** Different project types need different curated subsets.

**Scope:** Named profiles select which curated + external sources apply.
Ships only if Phases 1–3 prove stable.

- [ ] **6.1** `agents/profiles/<name>.yaml` — include/exclude globs for
      skills, rules, commands.
- [ ] **6.2** `event4u-agent install --profile=laravel` scopes the install.
- [ ] **6.3** Profile composition: layered, explicit, no magic resolution.

**Acceptance criteria:**
- Switching profile in the same project reliably adds/removes only the
  expected files.

## Explicitly **not** in scope

Patterns the competitor ships that we deliberately reject:

| Feature | Competitor | Why we pass |
|---|---|---|
| User `~/.ai-agent/config.json` as primary config | Yes | Conflicts with our project-scoped, version-controlled governance model. |
| Bundled Bitwarden dependency | Yes | Adds a mandatory external tool. We provide a pluggable backend interface instead. |
| Bi-directional push-to-source | Yes | Encourages ungoverned edits. We keep `upstream-contribute` as the single contribution path. |
| Global `ai-agent commit` / `ai-agent pr` | Yes | Duplicates Git. We stay out of Git workflows. |
| Community skill marketplace | Planned | Would require moderation we can't sustain. External sources serve the same need without us operating the marketplace. |
| Cloud-stored user config | Implied | Out of scope. Local + Git is enough. |

## Dependencies between phases

- Phase 2 (MCP) and Phase 5 (upstream sync) both depend on Phase 1 (sources).
- Phase 3 (global CLI) is independent and can land in parallel with Phase 1.
- Phase 4 (detection) is independent.
- Phase 6 (profiles) depends on Phases 1–3.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| External sources ship low-quality or malicious skills. | Phase 1.5 linter gate + `external/` namespace + trust tiers. |
| MCP secret resolver leaks credentials to logs. | Resolver is boundary code — no placeholder value appears in any log or error message. Tested. |
| Global CLI drifts from bundled `scripts/`. | Both import from the same `event4u_agent_config/` package; no code duplication. |
| Platform detection false positives create broken configs. | Detection always confirmed by a sentinel file check, not just binary presence. |
| Upstream sync floods maintainers with PRs. | One rolling PR, weekly cadence, auto-close when no diff. |

## Open questions

- **CLI name** — `event4u-agent` keeps branding explicit. Alternative:
  `agent-config` (neutral). Decide before publishing to PyPI (Phase 3.4).
- **External source location** — `agents/sources/` (config) + `.agent-src/external/`
  (content) is the current proposal. Alternative: nest both under one root.
- **Per-source lint budget** — do we allow external sources to disable
  specific lint rules? Default: **no**, until we see real demand.

## References

- [`road-to-9.md`](road-to-9.md) — depth/runtime roadmap (sibling).
- [`docs/architecture.md`](../../docs/architecture.md) — stable vs.
  experimental layers.
- [`.agent-src.uncompressed/skills/mcp/SKILL.md`](../../.agent-src.uncompressed/skills/mcp/SKILL.md).
- [`.agent-src.uncompressed/skills/upstream-contribute/SKILL.md`](../../.agent-src.uncompressed/skills/upstream-contribute/SKILL.md).
- [`scripts/install.py`](../../scripts/install.py).
- Source of competitive analysis:
  [`agents/analysis/compare-dongitran-ai-agent-config.md`](../analysis/compare-dongitran-ai-agent-config.md)
  *(created by `/analyze-reference-repo` — see
  [`.agent-src.uncompressed/commands/analyze-reference-repo.md`](../../.agent-src.uncompressed/commands/analyze-reference-repo.md))*.
