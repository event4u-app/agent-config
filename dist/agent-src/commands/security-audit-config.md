---
model_tier: high
name: security-audit-config
pack: engineering-base
tier: 2
visibility: internal
skills: [judge-security-auditor, threat-modeling, security-audit]
description: Audit an assembled agent config (CLAUDE.md, .cursor/rules, settings, MCP, hooks, skills) for prompt-injection / supply-chain risk — A–F score per category, mapped to OWASP Agentic Top 10
council_depth: deep
suggestion:
  eligible: true
  trigger_description: "audit my agent config, is my CLAUDE.md / MCP setup safe, scan for prompt injection in my rules"
  trigger_context: "a repo with agent config files (CLAUDE.md, .cursor/rules, .mcp.json, .claude/settings.json)"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# security-audit-config

## Instructions

Audit a consumer's **assembled** agent config for the prompt-injection +
supply-chain risks behind the "rules-file backdoor" and MCP tool-poisoning
classes; report an A–F score per category mapped to the OWASP Top 10 for
Agentic Applications. Consumer-facing counterpart to the suite's own self-audit
gate (`task lint-agent-security`).

### 1. Run the static audit

```bash
python3 src/scripts/security_audit_config.py --root <repo> --json
```

(omit `--root` to audit the current repo). Reuses the Phase-1 detection library
under the containment convention
([`security-lint-containment`](../../docs/guidelines/agent-infra/security-lint-containment.md)),
so doc/example files don't tank the score. Scans instruction files (`CLAUDE.md`,
`AGENTS.md`, `.cursor/rules`, `.github/copilot-instructions.md`, `.clinerules`,
`.windsurfrules`), MCP configs (`.mcp.json`, `.cursor/mcp.json`,
`claude_desktop_config.json`), settings/hooks (`.claude/settings.json`),
installed skills.

### 2. Present the score

Surface the overall grade + five category grades (Secrets · Permissions · Hooks
· MCP · Agents/Rules), each with its OWASP-ASI tag, then the findings worth
acting on (HIGH first). Lead with the worst category.

### 3. Optional deep pass

When asked for depth, or any category scores **D/F**, escalate:

- Dispatch [`judge-security-auditor`](../skills/judge-security-auditor/SKILL.md)
  over the flagged files for a diff-level verdict.
- For a red/blue/auditor review of the whole config, hand off to the
  `agent-security-review` skill (`council_depth: deep`).

### 4. Recommend, do not auto-fix

Output is **decision support**, not a gate — detection is probabilistic.
Recommend the fix per finding (secret → `${env:VAR}`, pin an MCP server, remove
`bypassPermissions`, strip hidden Unicode), but never rewrite the consumer's
config without confirmation (per [`scope-control`](../../../src/rules/scope-control.md)).

## Output format

```
Agent-config security audit — <repo>
Overall: B (84/100)

  C  Secrets       75/100 · ASI04 Supply Chain
        [HIGH] .mcp.json:3: inline secret value — use ${env:VAR}
  F  Agents/Rules  50/100 · ASI01 Goal Hijack
        [HIGH] CLAUDE.md:1: role-takeover phrase in prose
  ...
```

## See also

- [`lint_agent_security`](../../../src/scripts/lint_agent_security.py) — the self-audit (our own corpus) sibling.
- [`untrusted-input-defense`](../../rules/untrusted-input-defense.md), [`lethal-trifecta-guard`](../../rules/lethal-trifecta-guard.md) — the always-on prevention rules.
- [`/threat-model`](../threat-model/command.md), [`judge-security-auditor`](../skills/judge-security-auditor/SKILL.md) — deep-pass dispatch.
