# Audit 2 — Symlink-mobility test

> Verdict: **⚠️ Partial pass.** Subdirectory-level symlinks (`.augment/skills/ → ../.agent-src/skills/`) are proven and working in production today. Top-level tool-root symlinks (`.cursor/ → projections/.cursor/`) are **not tested** with any of the three load-bearing host agents. This is the blocking unknown for Phase 3.

## Method

1. Enumerate the current symlink topology under `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`.
2. Read `scripts/compress.py` symlink generation logic (`AUGMENT_SYMLINK_DIRS`, `generate_rule_symlinks`).
3. Classify each symlink by depth: **L1** (`.tool/sub` → `../.agent-src/sub`) vs **L0** (`.tool/` → `projections/.tool/`).
4. Identify which class Phase 3 ("projections/" umbrella) would require.
5. Document the test that would be required to verify L0.

## Findings

### Current topology — L1 symlinks (subdirectory level)

`.augment/` projection (from `compress.py:1106`):

```
AUGMENT_SYMLINK_DIRS = ("skills", "commands", "guidelines", "personas",
                        "user-types", "templates", "contexts", "scripts")
```

Each maps to `.augment/<sub> → ../.agent-src/<sub>`. Verified live:

```
.augment/skills        -> ../.agent-src/skills
.augment/commands      -> ../.agent-src/commands
.augment/personas      -> ../.agent-src/personas
.augment/contexts      -> ../.agent-src/contexts
.augment/templates     -> ../.agent-src/templates
.augment/user-types    -> ../.agent-src/user-types
.augment/scripts       -> ../.agent-src/scripts
.augment/README.md     -> ../.agent-src/README.md
```

`.augment/rules/` is a **copy** (not a symlink) because Augment Code historically failed to load symlinked rule files (`compress.py:1098–1100` documents this carve-out). Opt-in via `augment.rules_use_symlinks: true` in `.agent-settings.yml`.

`.claude/`, `.cursor/`, `.clinerules/` use **per-file** symlinks via `generate_rule_symlinks()` (`compress.py:644`):

```
.claude/personas/backend-architect.md       -> ../../.agent-src/personas/backend-architect.md
.cursor/rules/<rule>.mdc                    -> ../../.agent-src/rules/<rule>.mdc
.clinerules/<rule>.md                        -> ../../.agent-src/rules/<rule>.md
```

### What Phase 3 would require — L0 symlinks (tool root)

The council's "projections/" option proposes:

```
.cursor/         -> projections/.cursor/
.windsurf/       -> projections/.windsurf/
.claude/         -> projections/.claude/
.augment/        -> projections/.augment/
```

That is, the **tool root directory itself** becomes a symlink. Each host agent must resolve this symlink before reading its config files.

### Known facts about L0

- **Augment Code:** `.augment/rules` is a copy precisely because Augment didn't follow symlinks for rule loading. Whether Augment follows a symlink at `.augment/` itself is **unknown** — never tested.
- **Cursor:** No documented behavior either way. Cursor reads `.cursor/rules/*.mdc`. If `.cursor/` is a symlink to `projections/.cursor/`, success depends on Cursor's file resolution.
- **Claude Code:** Symlinks at L1 work today (per-file `.claude/personas/*.md`). L0 not tested.
- **Windsurf:** `.windsurfrules` is a single file, not a directory — special case.
- **CLI tools (cli, clinerules):** Use plain file globs; symlink-transparent.

### Test that would prove L0

```bash
# 1. Create projections/ dir mirroring current .cursor structure
mkdir -p projections/.cursor/rules
mv .cursor/rules/* projections/.cursor/rules/
mv .cursor/* projections/.cursor/   # whatever else lives there
rmdir .cursor

# 2. Symlink at L0
ln -s projections/.cursor .cursor

# 3. Open Cursor in this repo, verify rules still apply
# 4. Repeat for Claude Code + Windsurf
```

This test requires the **actual host agent runtime**; it cannot be unit-tested in CI.

## Verdict: ⚠️ Partial pass

- **L1 symlinks: ✅ Proven** — production-tested across `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`.
- **L0 symlinks: ❓ Unverified** — required by Phase 3's "projections/" option; no maintainer has run the test against current Cursor / Claude Code / Windsurf builds.

## Recommendation

Defer Phase 3 until a maintainer runs the L0 test on at least Cursor + Claude Code (the two highest-traffic host agents) and amends this audit to ✅. The test is one-off, low-risk (can be reverted with `mv`), and takes < 30 minutes per tool.

## Evidence

- `scripts/compress.py:644` — `generate_rule_symlinks()`.
- `scripts/compress.py:1106` — `AUGMENT_SYMLINK_DIRS`.
- `scripts/compress.py:1098–1100` — Augment rules-copy carve-out.
- Live `find -type l` output captured during audit (Phase 2 run, 2026-05-25).
