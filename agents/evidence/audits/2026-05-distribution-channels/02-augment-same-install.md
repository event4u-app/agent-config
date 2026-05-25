# Augment same-install dual-registration — audit

**Audit:** 02 of 03 (Phase A, Step 2)
**Date:** 2026-05-25
**Status:** Structural inspection complete. Augment's same-install shape differs from Claude's — the plugin manifest does NOT introduce a second registration channel.

## What was measured

| Source | Path | Shape |
|---|---|---|
| Project-local filesystem tree | `.augment/{rules,skills,commands,contexts,personas,templates,scripts,user-types}/` | `rules/` is the only real directory; the rest are **symlinks** into `../.agent-src/` |
| Plugin manifest | `.augment-plugin/marketplace.json` | `plugins[0].source: "."` — points at the **package root**, not a separate registry |
| User-global tree | `~/.augment/{skills,rules,commands}/` | Present on this machine (project-side `~/.augment/skills/` shows 0 entries — package is not currently installed at user scope) |

`.augment/` contents:

```
README.md → ../.agent-src/README.md
commands → ../.agent-src/commands
contexts → ../.agent-src/contexts
personas → ../.agent-src/personas
scripts → ../.agent-src/scripts
skills → ../.agent-src/skills
templates → ../.agent-src/templates
user-types → ../.agent-src/user-types
rules/   (real directory — copied per portability requirement)
```

`.augment-plugin/marketplace.json` (excerpt):

```json
"plugins": [
  {
    "name": "agent-config",
    "source": ".",
    ...
  }
]
```

## What is structurally established

1. **Augment's manifest is not a second registration channel.** Unlike Claude (where `.claude-plugin/marketplace.json` enumerates 351 individual paths into `./.claude/skills/<id>`), Augment's manifest names a single plugin whose source is `"."` — i.e. the entire package directory. The harness walks the `.augment/` tree starting from that source. There is no separate enumeration that could double-register.
2. **The filesystem tree is mostly symlinks into `.agent-src/`.** `rules/` is the one real directory (per the portability rule that rules must be copied, not symlinked). Skills, commands, contexts, personas, templates all point at the single `.agent-src/` source tree. Inside a single install there is exactly **one** copy of each skill on disk, and the manifest source points at the directory that contains it.
3. **Cross-scope drift (path 2) still applies.** If a developer has installed `event4u/agent-config` at user scope (`~/.augment/skills/<id>/`) at a prior version and later installs it at project scope, the two trees may carry different frontmatter — same shape as the Claude `copilot-config` finding. On this machine `~/.augment/skills/` is empty, so the drift cannot be observed directly today, but the structural risk is identical.

## Conclusion for Phase A Step 3

- **Augment same-install (path 1) is a non-issue by construction.** The plugin manifest uses `source: "."` and points at the same filesystem tree the harness would scan directly; there is no separate registry to deduplicate. Shipping both `.augment-plugin/marketplace.json` and `.augment/` together is the correct shape, not a duplication.
- **Augment cross-scope (path 2) is the only relevant risk** — solved by the Phase B installer guard + Phase C probe.

**Canonical channel for Augment:** `filesystem` (the existing shape). The plugin manifest stays — it carries package metadata for the Augment plugin registry but does not enumerate skills independently. The `--legacy-both` flag is not needed for Augment because nothing is being removed.

## Suggested manual reproduction (for the human owner)

```bash
# Confirm Augment is reading the project-local source:
auggie skills list 2>/dev/null | grep -c copilot-config
# Expect: 1 (single registration; manifest + filesystem are the same source).

# If a user has previously installed at user-global scope:
ls ~/.augment/skills/ | wc -l
# Drift only possible when this count > 0 AND project-local is also present.
```
