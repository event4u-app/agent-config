---
model_tier: high
name: agent-security-review
description: "Use for an adversarial red-team / blue-team / auditor review of an AI agent's CONFIG + behaviour (rules, skills, MCP, hooks, permissions) — attack-chain → defensive-gap list, not a code audit."
personas:
  - security-engineer
domain: quality
council_depth: deep
workspaces:
  - engineering
packs:
  - engineering-base
---

# agent-security-review

A holistic, adversarial review of an **agent's configuration and behaviour** —
the trust anchor, not the application code. Where [`threat-modeling`](../threat-modeling/SKILL.md)
models a code change and [`security-audit`](../security-audit/SKILL.md) hunts
code vulnerabilities, this skill asks: *given this assembled agent config
(rules, skills, MCP servers, hooks, permissions, memory), how would an attacker
turn it against its owner, and what defensive gap lets them?*

Pairs the static signal from [`/security-audit-config`](../../agent-src/commands/) with an
adversarial three-lens pass. Output is **decision support** — surface the
trade-off, name the gap; the human decides.

## When to use

- A consumer asks "is my agent setup safe / could this be weaponised".
- Before trusting a third-party skill pack, MCP server, or rules file.
- Periodic posture review of a fleet's agent config.
- Any `D`/`F` category from `/security-audit-config` that warrants depth.

## Procedure

### 1. Inventory + inspect the attack surface

Inspect the config the agent actually loads and check each surface in turn:
instruction files (CLAUDE.md /
AGENTS.md / .cursor/rules / copilot-instructions), installed skills + their
`allowed-tools`, MCP servers + their tool descriptions, hooks + lifecycle
scripts, permission/auto-approve settings, persistent memory. Run the static
pass first:

```bash
python3 src/scripts/security_audit_config.py --root <repo> --json
```

### 2. Red team (attacker lens)

For each surface, construct concrete **attack chains**, grounded in the known
classes:

- Rules-file backdoor — hidden-Unicode / suppression instruction in a loaded file.
- MCP tool-poisoning / rug-pull — malicious or mutated tool description.
- Lethal trifecta — a path that reads private data, ingests untrusted content,
  AND can communicate externally.
- Consent bypass — `bypassPermissions`, `Bash(*)`, auto-approve, `npx -y`.
- Memory / context poisoning — a planted instruction that fires later.

Name the chain: *entry → mechanism → impact*. Be specific (which file, which tool).

### 3. Blue team (defender lens)

For each red-team chain, evaluate the existing defences: are the always-on
rules ([`untrusted-input-defense`](../../rules/untrusted-input-defense.md),
[`lethal-trifecta-guard`](../../rules/lethal-trifecta-guard.md),
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md)) in
force? Is the egress gated? Is the untrusted leg quarantined? Note what is
present and what is **absent**.

### 4. Auditor (synthesis)

Pair each attack chain with its defensive gap and prioritise (likelihood ×
impact). For a neutral second opinion on the hardest calls, run
[`ai-council`](../ai-council/SKILL.md) (`council_depth: deep`) and
[`judge-security-auditor`](../judge-security-auditor/SKILL.md) over the flagged
files. Produce a ranked **attack-chain → gap → recommended control** table.

## Output

A prioritised findings table — `attack chain | defensive gap | OWASP ASI | recommended control | confidence` —
prefixed with the trust-and-safety banner, because this is advisory security output:

```
> HUMAN REVIEW REQUIRED — adversarial agent-config review. Findings are
> decision support, not a guarantee; detection is probabilistic. Validate
> each chain before acting.
```

Recommend controls; never auto-apply config changes (per
[`scope-control`](../../rules/scope-control.md)).

## Gotcha

- **Clean static score ≠ safe.** The most dangerous chains (rug-pull MCP tool
  whose description mutates post-approval, a lethal-trifecta path across three
  individually-fine skills) leave no single linter hit — they only surface when
  the red-team lens (step 2) **inspects** how the surfaces compose. Always run
  the adversarial pass, not just the audit script.
- **Tool descriptions are part of the surface.** A check that reads only the
  config files and skips each MCP server's live tool descriptions misses
  tool-poisoning entirely.
- **The reviewer is not the fixer.** Emitting a config patch turns advisory
  review into an unreviewed change — recommend, hand back.

## Do NOT

- Do NOT treat a clean static score as proof of safety — the red-team lens
  finds chains the linters cannot see.
- Do NOT block or "fix" the consumer's config autonomously — surface + recommend.
- Do NOT re-audit application code here — that is `security-audit` / `threat-modeling`.
- Do NOT omit the HUMAN REVIEW REQUIRED banner.

## See also

- [`/security-audit-config`](../../agent-src/commands/) — the static A–F counterpart.
- [`untrusted-input-defense`](../../rules/untrusted-input-defense.md), [`lethal-trifecta-guard`](../../rules/lethal-trifecta-guard.md) — the prevention rules.
- [`threat-modeling`](../threat-modeling/SKILL.md), [`judge-security-auditor`](../judge-security-auditor/SKILL.md), [`ai-council`](../ai-council/SKILL.md).
