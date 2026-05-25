# Claude same-install dual-registration — audit

**Audit:** 01 of 03 (Phase A, Step 1)
**Date:** 2026-05-25
**Status:** Structural reproduction confirmed via filesystem inspection. Live in-session reproduction deferred — requires a fresh `~/.claude/skills/` move-aside + Claude restart that this autonomous session can't safely perform without confirming on a human machine.

## What was measured

Static inspection of the repo's projection trees and the upstream user-global tree:

| Source | Path | Entries | `copilot-config` description |
|---|---|---|---|
| User-global (claude installs over time) | `~/.claude/skills/` | 277 entries | `"Use when configuring GitHub Copilot — copilot-instructions.md, PR review patterns, output optimization — even when the user just says 'tune Copilot' or 'why is Copilot commenting on X'."` |
| Project-local (current `event4u/agent-config` checkout) | `.claude/skills/` | 351 entries | `"Tune the GitHub Copilot AI — copilot-instructions.md, PR-review patterns, suggestion behavior, output verbosity. NOT for dev-environment setup (use devcontainer)."` |
| Plugin manifest | `.claude-plugin/marketplace.json` § `plugins[0].skills` | 351 paths | n/a — manifest carries paths, not frontmatter |

`diff -q .claude/skills/copilot-config/SKILL.md ~/.claude/skills/copilot-config/SKILL.md` → files differ. Frontmatter `description:` values differ exactly as quoted above.

## What is structurally established

1. **Cross-scope drift is real.** The user-global tree at `~/.claude/skills/` carries an older snapshot of the project's skills, with stale frontmatter. This is path (2) in the roadmap context.
2. **Same-install plugin↔filesystem coexistence is real on disk.** The project ships both `.claude-plugin/marketplace.json` (with 351 entries pointing into `./.claude/skills/…`) AND the `.claude/skills/` filesystem tree itself. Both surfaces are present in the same install.
3. **Plugin entries are pointers, not duplicates of content.** Each manifest entry is a path string like `./.claude/skills/<id>`, not a full skill copy. The plugin manifest is metadata-over-filesystem, not an independent content channel.

## What remains in-session-only

Whether Claude Code's session loader, when a project ships both the manifest AND the filesystem tree, registers the same skill twice or dedupes by path is a runtime behaviour of the host harness. The structural finding above is sufficient to motivate the canonical-channel decision in Phase A Step 3; a live-session reproduction belongs to the human operator on a machine where `~/.claude/skills/` can be moved aside without disrupting an active session.

### Suggested manual reproduction (for the human owner)

```bash
# 1. Move user-global tree aside
mv ~/.claude/skills ~/.claude/skills.bak

# 2. Restart Claude Code; confirm the project tree is the only source.
# 3. Inspect harness-side skill listing (the exact command depends on the harness build):
#    /skills           # in-session
#    or: ls ~/.claude/state/skill-cache 2>/dev/null
# 4. Look for `copilot-config` — should appear once.
# 5. Restore: mv ~/.claude/skills.bak ~/.claude/skills
```

If the harness shows `copilot-config` twice after step 2 (i.e. with the user-global tree absent), the same-install plugin↔filesystem path is confirmed. If only once, the harness dedupes and only path (2) (cross-scope drift) matters in practice.

## Conclusion for Phase A Step 3

Regardless of the same-install outcome:

- **The cross-scope drift path (2) is confirmed and consequential.** It produced the actual 2026-05-25 misdiagnosis.
- **The same-install path (1) is, at worst, a redundant registration with identical paths** — the manifest just points at the filesystem entries that already register, so the worst case is a duplicate registration with identical frontmatter (not the drift shape that caused the original bug).

Pick `filesystem` as canonical: it is the only channel that all six tools share, the simplest to project, and removing the plugin manifest from the consumer install path eliminates path (1) entirely without losing any functionality (users can still opt in to plugin-style install via the package's published `.claude-plugin/marketplace.json` at the source repo, but the installer does not project a second registry into consumer projects).
