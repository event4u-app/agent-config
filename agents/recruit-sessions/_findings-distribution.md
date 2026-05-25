# Recruit findings — distribution-channels track

**Placeholder.** Populated by the human owner as recruit sessions complete (per `road-to-adoption-proof-and-ci-green.md` Phase B).

This file collects feedback specifically about the distribution-channels work landed in `road-to-clean-skill-distribution-channels.md`. The recruit sessions answer questions the maintainer can't observe from inside their own machine.

## Questions to ask each recruit

1. **Have you seen duplicate skills?** A skill name showing twice in any AI tool, OR a skill whose description seems to flip between calls. List the tool, the skill name, and what you saw.
2. **Which scope did you install to?** Project-local (`./.augment/`, `./.claude/skills/`, …) or user-global (`~/.augment/`, `~/.claude/skills/`, …) — or both?
3. **Did the installer warn you about scope drift?** If yes, what did the warning say, and which numbered option did you pick?
4. **Did `task probe:skills` give you a useful answer?** If you ran it, paste the relevant excerpt — especially any DUPLICATE / DRIFT lines.
5. **Did the wizard ask about scope?** If you used `agent-config setup`, did the first step surface the scope-guard finding before you picked your install scope?

## How to record findings here

Append a dated entry per recruit session:

```markdown
## 2026-XX-XX · <recruit identifier>

- **Tool:** <claude / augment / cursor / cline / windsurf / copilot>
- **Scope:** <project / user / both>
- **Duplicate observed?** yes / no — <details>
- **Scope-guard warning?** yes / no — <option picked>
- **Probe output:** <one-line excerpt or "not run">
- **Wizard scope check?** yes / no
- **Other notes:** <free text>
```

## Why this matters

The 2026-05-25 root cause (cross-scope drift) was visible from a single machine. The recruit sessions tell the maintainer whether the fix actually lands in the wild — whether new users encounter the bug, and whether the diagnostics (`scope_guard`, `task probe:skills`, the wizard banner) catch it before the user opens a confused issue.

## See also

- Roadmap: [`road-to-clean-skill-distribution-channels.md`](../roadmaps/road-to-clean-skill-distribution-channels.md) — closed track that produced the diagnostics this file evaluates.
- Sibling roadmap: [`road-to-adoption-proof-and-ci-green.md`](../roadmaps/road-to-adoption-proof-and-ci-green.md) — recruit-session governance.
- Contract: [`docs/contracts/harness-expectations.md`](../../docs/contracts/harness-expectations.md) — the three classes of host behaviour the recruits will be asked about.
