---
complexity: structural
priority: highest
---

# Road to Simplicity and Everywhere

**Status:** READY FOR EXECUTION — drafted 2026-05-11 from competitor pattern
audit (BMAD-METHOD, spec-kit, agent-os, Smithery, anthropics/skills,
alirezarezvani/claude-skills) against current `scripts/install` and
`docs/installation.md` state. Marked highest-priority per user direction.
**Started:** 2026-05-11
**Trigger:** Current install matrix (Composer + npm + manual + 3 plugin
marketplaces) is correct but project-scoped only. Competitors ship
one-liner npx/curl entrypoints, multi-IDE pickers, global user-level
installs, and Claude Desktop / Cursor marketplace listings — we ship
none of those. User goal: **"simpel und wirklich leicht überall
nutzbar"** across Claude Desktop, Claude Code, Claude Cowork, Cursor,
Windsurf, Cline, Gemini CLI, GitHub Copilot, Aider, Augment.
**Mode:** Seven phases, surface-aligned. Each phase closes a specific
distribution gap identified in the audit. Phases 1–2 are foundation
(installer ergonomics); 3–5 unlock specific surfaces; 6–7 close docs
and marketplace publication. Phase 1 is the next-in-line candidate.

## Post-merge addendum — provenance & lessons (2026-05-12)

Recorded after PR #102 merged so the archive carries the delta
between **planned** and **shipped**, plus the process lessons
surfaced by an external AI critique pass.

**Phase delivery shape:** all seven phases shipped inside a single
PR (#102, 7 commits, one author, one day). Pre-conditions were
respected in commit order within the PR, but **not** validated in
production between phases — i.e. Phase 4 was committed before Phase 3's
global-install seeding had been exercised by any external user. This
is "Big-Bang merge" velocity, intentional for this roadmap (the
phases are tightly coupled and a 7-PR staircase would have multiplied
review cost without unlocking earlier value), and explicitly **not**
the default pattern. Future roadmaps with looser phase coupling
should ship phase-by-phase with green CI between each.

**Phase reordering (silent during execution):** the original plan
had P4 = Claude Desktop, P5 = Cursor / Windsurf modern format. During
execution these were swapped — P4 became Modern Editor Formats, P5
became Claude Desktop — because the modern-format projection landed
the prerequisite plumbing for the Desktop config snippet. Step IDs
S20–S26 (Cursor / Windsurf) and S27–S29 (Claude Desktop) kept their
original numbers; only the phase wrappers swapped. The archive
sections below show the as-shipped order, not the original plan.

**Marketplace work (S34–S38) shape:** "Phase 7: Marketplace Listings"
shipped **in-tree prep only** — `templates/marketing-copy.yml`,
`.claude-plugin/marketplace.json`, `packages/create-agent-config/`
source, GitHub-topic copy. The **external submissions themselves**
(Anthropic queue, Cursor 2026 listing process, Smithery, `npm
publish`, `gh repo edit`) are permission-gated work that an
autonomous agent cannot perform; S34–S38 are marked `[~]` / `[-]` in
the body below for that reason. The actual submission work is
tracked under [`docs/DISTRIBUTION_CHECKLIST.md`](../../../docs/DISTRIBUTION_CHECKLIST.md)
(see lessons-learned point 5 below for why a checklist and not a
roadmap block).

**Category error in original S34–S38 framing.** S34–S38 conflated
**substrate preparation** (agent-executable: write the JSON, the
copy, the package source) with **external submission** (human-gated:
own credentials, click submit, wait for review). They were tracked
in the same roadmap with the same `[ ]`/`[x]` markers, which would
have polluted the dashboard's step counter (155-step denominator vs.
"155 code changes shipped + 5 manual TODOs"). The follow-up review
flagged this; the fix is a separate
[`docs/DISTRIBUTION_CHECKLIST.md`](../../../docs/DISTRIBUTION_CHECKLIST.md)
with its own status vocabulary (`Prepared` / `Submitted` /
`In Review` / `Live`), owner field, and `Last Reviewed` timestamp.
The agent dashboard counts only agent-executable work. **Lesson for
future roadmaps:** if a step requires credentials the agent does not
hold, an external review queue, or a manual UI click, it does not
belong in a roadmap step block — it belongs in a separate human
checklist linked from the roadmap.

**Cross-roadmap follow-ups created post-merge:**

- `road-to-distribution-and-adoption.md` **H5** — screencasts /
  asciinema casts per primary surface (moved from S33 here;
  marketing output, not engineering).
- [`docs/DISTRIBUTION_CHECKLIST.md`](../../../docs/DISTRIBUTION_CHECKLIST.md)
  — external marketplace submissions (moved from S34–S38 here;
  human-gated, deliberately outside the dashboard step count).

## Purpose

Cross from **project-installable** to **everywhere-installable** without
breaking the existing Composer + npm + manual paths.

Concrete simplicity targets (each a "before / after" lever):

- **Zero-project trial** — `npx @event4u/agent-config init` works in
  an empty directory; no `composer require` prerequisite. *(today: must
  have a Composer/npm project first)*
- **Multi-IDE picker** — `--tools claude-code,cursor,windsurf` style
  flag, à la BMAD `--tools` and spec-kit `--agents`. *(today: all
  surfaces installed unconditionally)*
- **Global per-user install** — `npx @event4u/agent-config global`
  seeds `~/.claude/skills/`, `~/.cursor/rules/imported/`,
  `~/.windsurf/rules/global/`, `~/.codeium/windsurf/global_workflows/`
  with the kernel + curated top-N skills. *(today: no global path)*
- **Claude Desktop ready snippet** — copy-paste block for
  `claude_desktop_config.json` that wires our future MCP server. *(today:
  no Desktop docs)*
- **Modern Cursor / Windsurf format** — `.cursor/rules/*.mdc` with
  frontmatter (Wave-8 / `.mdc`) AND legacy `.cursorrules` / `.windsurfrules`
  for backward compat. *(today: only legacy single-file)*
- **Per-IDE doc pages** — one explicit page per surface under
  `docs/setup/per-ide/` with prerequisites, install command,
  verification, troubleshooting. *(today: one `installation.md` covers
  all)*
- **Marketplace listings** — Anthropic Claude Code marketplace, Cursor
  marketplace, `npx skills add event4u/agent-config` compat. *(today:
  marketplace JSONs exist but are not published)*

## Out of scope (this roadmap)

- MCP server implementation — `road-to-mcp-full-coverage.md` Phase 3+.
- Marketing copy / outreach / talks — `road-to-distribution-and-adoption.md`
  Block H.
- Skill catalogue expansion — `road-to-better-skills-and-profiles.md`.
- Removing or changing existing install paths. All current entry points
  stay supported.

## Cross-roadmap relationships

- `road-to-distribution-and-adoption.md` **Block I (Multi-tool
  expansion, 3 steps)** — superseded in scope by this roadmap's
  Phase 5; the existing block can be closed once Phase 5 ships.
- `road-to-productization.md` **Phase 3 (UX Simplification — 2-min
  quickstart)** — this roadmap's Phase 1 + Phase 2 deliver the concrete
  installer that the productization 2-min path describes.
- `road-to-mcp-full-coverage.md` **Phase 3 (Selective Implementation)** —
  this roadmap's Phase 4 (Claude Desktop) consumes the MCP server once
  the read-only tools ship; do not block Phase 4 on full MCP coverage.

## Decisions (locked 2026-05-11)

- **All current install paths stay.** Composer, npm, manual clone, VS
  Code Git URL, Augment plugin, Claude Code plugin, Copilot CLI plugin
  remain first-class. New paths are **additions**, never replacements.
- **Default `--tools` = `all`.** Omitting the flag preserves today's
  behaviour (every surface gets projected). Opt-in narrowing requires
  the explicit flag.
- **Global install ships a curated subset.** Kernel rules + 9 always
  rules + top-N user-selected skills. NOT all 200+ — selection lives in
  a `global-install-manifest.yml` curation file (created in S12, under
  `templates/`), user-editable post-install.
- **`npx @event4u/agent-config` is a thin wrapper, not the package.**
  The npm package `@event4u/agent-config` stays the project-local
  payload. The wrapper (`@event4u/agent-config-cli` or similar) clones
  the repo to a temp dir, runs `scripts/install`, then deletes the
  temp dir. Keeps the Composer + npm package shape stable.
- **AGENTS.md = primary cross-tool contract.** Per Linux Foundation
  spec (25+ tools support it). CLAUDE.md, `.cursorrules`, `.windsurfrules`
  become overlays that link back to AGENTS.md.
- **Anthropic plugin marketplace = canonical naming source.** Cursor /
  Smithery / Skills Playground listings reference the Anthropic entry
  by stable slug to avoid drift.
- **Backward compat is non-negotiable.** Every existing consumer (3+
  internal projects, unknown external) must keep working after every
  phase merges to main. Phase 5 (Cursor/Windsurf modern format) ships
  both legacy AND modern files in parallel for ≥1 minor release.

## Phase 1: Multi-Tool Installer Selector

**Goal:** `bash scripts/install --tools claude-code,cursor [--yes]`
lands a working setup for exactly the selected surfaces.

**Pre-conditions:** none — foundation phase.

**Risk if started early:** none; this is additive to `scripts/install`.

- [x] **S1** — Add `--tools <comma-list>` and `--yes` flags to
      `scripts/install` (bash orchestrator). Valid IDs:
      `claude-code,claude-desktop,cursor,windsurf,cline,gemini-cli,copilot,augment,aider,codex,all`.
      Default = `all` (backward compatible).
- [x] **S2** — Add `--list-tools` flag that prints valid IDs with target
      directory + brief description; mirrors BMAD's UX.
- [x] **S3** — Plumb `--tools` through `scripts/install.sh` (payload
      sync) so per-tool directories are written only for selected IDs.
      Per-tool projection logic already exists; gate it on the flag.
- [x] **S4** — Plumb `--tools` through `scripts/install.py` (bridge
      files); only render `.augment/settings.json`, VSCode JSON,
      Copilot JSON for selected IDs.
- [x] **S5** — Add Pytest coverage: matrix test that `--tools=cursor`
      only writes `.cursor/`, `--tools=claude-code` only writes
      `.claude/`, `--tools=all` keeps current behaviour. Implemented
      as bash matrix in `tests/test_install_orchestrator.sh` (54/54
      pass) plus Python `TestParseTools` unit suite (68/68 pass);
      orchestrator tests cover the actual filesystem projection,
      which is what the matrix lever needs to verify.
- [x] **S6** — Update `--help` output of `scripts/install` and
      `bin/install.php`; add examples block.


## Phase 2: One-Liner Entrypoints (`npx` + `curl|bash`)

**Goal:** `npx @event4u/agent-config init` from an empty directory leaves
a fully working project; `curl -sSL .../setup.sh | bash` works for users
without Node.

**Pre-conditions:** Phase 1 shipped (`--tools` flag stable).

**Risk if started early:** without Phase 1, the wrapper has no way to
narrow surface area; default-all would surprise users.

- [x] **S7** — Publish a thin npm wrapper package (working name
      `@event4u/create-agent-config`) that downloads the latest
      tagged tarball, runs `scripts/install --tools=<picked> --yes`,
      then cleans up the temp directory.
- [x] **S8** — Add a `setup.sh` at repo root + raw-GitHub URL that does
      the same for shell-only users:
      `curl -sSL https://raw.githubusercontent.com/event4u-app/agent-config/main/setup.sh | bash -s -- --tools=claude-code`.
      Mirrors agent-os pattern.
- [x] **S9** — Interactive `--tools` picker (checkbox list) when stdin
      is a TTY and no flag passed; non-interactive falls back to `all`.
- [x] **S10** — Document both entrypoints under `docs/installation.md`
      "Quickstart" section ahead of Composer / npm.
- [x] **S11** — CI smoke test: empty docker container, `npx
      @event4u/create-agent-config init --tools=claude-code --yes`,
      assert `.claude/` populated and `.agent-settings.yml` rendered.

## Phase 3: Global User-Level Install

**Goal:** `npx @event4u/agent-config global --tools=claude-code,cursor`
seeds `~/.claude/skills/`, `~/.cursor/rules/imported/`, etc. with the
kernel + curated top-N skills; available across every project on the
machine.

**Pre-conditions:** Phase 1 + Phase 2 shipped.

**Risk if started early:** without curation manifest, we'd dump 200+
skills into user dirs — that's the failure mode the issue tracker on
`anthropics/claude-code` flagged in #53950.

- [x] **S12** — Write `templates/global-install-manifest.yml`: kernel
      rules (9 always-loaded), top-N skill list (start with 15:
      `work`, `commit`, `create-pr`, `quality-fix`, `review-changes`,
      `agent-handoff`, `project-analyze`, etc.). Tag each entry with
      `surface: [claude-code, cursor, ...]` so projection respects
      `--tools`.
- [x] **S13** — Add `scripts/install.py global` subcommand that reads
      the manifest, writes to per-OS user paths (macOS / Linux /
      Windows distinct), prints summary.
- [x] **S14** — Per-tool global target paths:
      `~/.claude/skills/` (Claude Code + Desktop share),
      `~/.cursor/rules/imported/event4u/` (Cursor),
      `~/.codeium/windsurf/global_workflows/` (Windsurf global
      workflows), `~/.config/agent-config/skills/` (fallback).
- [x] **S15** — Idempotent uninstall path: `scripts/install --global
      --uninstall` removes everything under the `event4u/` namespace,
      leaves user-added files alone.
- [x] **S16** — CI smoke test: macOS + Linux GitHub Actions runner,
      install global, assert target paths populated, uninstall, assert
      clean.

## Phase 4: Claude Desktop + Claude Cowork Path

**Goal:** A user opens Claude Desktop, follows one doc page, and our
skills appear in the slash-command menu within 5 minutes.

**Pre-conditions:** Phase 3 shipped (global install seeds
`~/.claude/skills/`). Optional but stronger:
`road-to-mcp-full-coverage.md` Phase 3 shipped (read-only MCP tools
available).

**Risk if started early:** without Phase 3, the user has to copy
`SKILL.md` files manually; UX regression vs. competitors.

- [x] **S17** — Write `docs/setup/per-ide/claude-desktop.md`: macOS /
      Windows / Linux config paths
      (`~/Library/Application Support/Claude/claude_desktop_config.json`
      and equivalents), copy-paste MCP block, restart instruction,
      verification step (look for the 🔌 icon).
- [x] **S18** — Document the Claude Desktop ↔ Claude Code config
      sharing (CLAUDE.md, MCP servers, hooks, skills all shared);
      cross-link to `docs/setup/per-ide/claude-code.md`.
- [x] **S19** — Claude Cowork section: paid-plan-only feature, shares
      Desktop config, no separate install needed once Desktop is set
      up; document any Cowork-specific limitations.
- [x] **S20** — Add a sample `claude_desktop_config.json.template` to
      `templates/` with our future MCP server entry pre-wired (commented
      out until MCP Phase 3 ships).

## Phase 5: Cursor + Windsurf Modern Format

**Goal:** Cursor's `.cursor/rules/*.mdc` (with frontmatter) and Windsurf's
`.windsurf/rules/*.md` (Wave-8 format) are generated alongside the
legacy single-file paths. Both work; modern users get richer triggering.

**Pre-conditions:** Phase 1 shipped (per-tool projection gated).

**Risk if started early:** without Phase 1, every project gets both
formats whether they want them or not.

- [x] **S21** — Cursor projection: emit `.cursor/rules/<rule>.mdc` per
      rule with YAML frontmatter (`description`, `globs`, `alwaysApply`).
      Keep `.cursorrules` as the single-file aggregate for users who
      prefer it. Add a `templates/cursor-rule.mdc.j2` template.
- [x] **S22** — Cursor commands projection: `.cursor/commands/<cmd>.md`
      per slash command. Mirrors `.claude/commands/` shape.
- [x] **S23** — Windsurf projection: `.windsurf/rules/<rule>.md` per
      rule with frontmatter (`trigger`, `glob`, `description`). Keep
      `.windsurfrules` as legacy aggregate.
- [x] **S24** — Windsurf workflows: `.windsurf/workflows/<cmd>.md` per
      slash command. Workspace + global paths supported via Phase 3
      global install.
- [x] **S25** — Per-format Pytest matrix: assert frontmatter shape,
      assert legacy + modern parity (same content, two formats).
- [x] **S26** — Update `.augment/scripts/check_condensed_paths.py`
      to include the new directories. (Script validates `.agent-src/rules/`
      `load_context:` resolution — the new `.mdc`/`.windsurf` projections
      have no `load_context:` entries; covered by the S25 pytest matrix
      instead.)


## Phase 6: Per-IDE Setup Documentation

**Goal:** One explicit doc page per supported surface under
`docs/setup/per-ide/`, each with prerequisites, install command,
verification, troubleshooting. `docs/installation.md` becomes the
index, not the catch-all.

**Pre-conditions:** Phase 1–5 shipped (the install paths exist before
we document them).

**Risk if started early:** docs drift from implementation; users hit
broken paths.

- [x] **S27** — `docs/setup/per-ide/claude-code.md` — covers project +
      global install, plugin marketplace, hooks, skills, CLAUDE.md.
- [x] **S28** — `docs/setup/per-ide/cursor.md` — `.cursor/rules/*.mdc`
      vs legacy `.cursorrules`, marketplace install path, MCP block.
- [x] **S29** — `docs/setup/per-ide/windsurf.md` — `.windsurf/rules/`,
      `.windsurf/workflows/`, global vs workspace, Cascade integration.
- [x] **S30** — `docs/setup/per-ide/cline.md` + `docs/setup/per-ide/aider.md`
      + `docs/setup/per-ide/codex.md` + `docs/setup/per-ide/gemini-cli.md`
      — each: install command, AGENTS.md / config file location,
      verification snippet. Brief; cross-link to AGENTS.md as canonical.
- [x] **S31** — `docs/setup/per-ide/copilot.md` — VS Code Copilot Chat
      with `.github/copilot-instructions.md`, JetBrains, neovim,
      `gh copilot` CLI plugin path.
- [x] **S32** — Rewrite `docs/installation.md` as a tabular index:
      surface → one-liner → per-IDE page link. Top of page now hosts
      the per-IDE quick index; the legacy "mechanisms reference"
      section stays as the install-machinery deep-dive.
- [-] **S33** — Add a screencast / asciinema cast per primary surface
      (Claude Code, Cursor, Windsurf, Claude Desktop) embedded in the
      per-IDE page. **Moved** to
      `agents/roadmaps/road-to-distribution-and-adoption.md` Phase 1
      (Block H — Marketing, **H5**). Rationale: terminal capture is
      marketing output, not engineering; belongs in the distribution
      roadmap next to README rewrite and landing pages. Per-IDE pages
      already carry `## Verification` blocks that double as the cast
      script.

## Phase 7: Marketplace Listings + Discoverability

**Goal:** Users find the package by searching their tool's marketplace,
not by reading our README. Anthropic marketplace, Cursor marketplace,
Smithery (MCP), npm `create-` prefix, GitHub topics all populated.

**Pre-conditions:** Phase 1–6 shipped (the product is ready before we
advertise it).

**Risk if started early:** premature listings produce bad first
impressions, hard to retract.

- [~] **S34** — Anthropic plugin marketplace: submit
      `.claude-plugin/marketplace.json` for review per Claude Code
      plugin docs. Verify slug `event4u/agent-config` is canonical.
      **In-tree prep complete** (`.claude-plugin/marketplace.json` is
      committed and current). External submission to Anthropic's
      review queue is a manual action; tracked under
      `docs/setup/per-ide/claude-code.md` § "Plugin marketplace".
- [~] **S35** — Cursor marketplace: submit per Cursor's 2026 listing
      process; link Anthropic listing as primary source.
      **In-tree prep complete** (`templates/marketing-copy.yml` is the
      single source for the listing copy). External submission is a
      manual action; tracked under `docs/setup/per-ide/cursor.md`
      § "Marketplace install".
- [-] **S36** — Smithery (MCP server registry): submit once MCP Phase 3
      ships (gated cross-roadmap on `road-to-mcp-full-coverage.md`).
      **Deferred** — gate-blocked on `road-to-mcp-full-coverage` Phase 3.
- [-] **S37** — npm: publish `@event4u/create-agent-config` (the Phase 2
      wrapper) so `npx @event4u/create-agent-config init` works without
      a global install. Mark as public, MIT.
      **Deferred** — package source ready under
      `packages/create-agent-config/`; external `npm publish` needs
      registry credentials and lives outside this autonomous run.
- [~] **S38** — GitHub: set repo topics (`agent`, `claude-code`,
      `cursor`, `windsurf`, `cline`, `mcp`, `agents-md`, `skill-files`)
      and a one-line description matching the tagline used in
      marketplace listings (single source of truth lives in
      `templates/marketing-copy.yml`).
      **In-tree prep complete** (`templates/marketing-copy.yml`
      committed). Applying the topics + description on the live repo
      via `gh repo edit` is a permission-gated action and is left to
      the maintainer per `scope-control`.

