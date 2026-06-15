# Security Policy

## Scope

This policy covers the published **`@event4u/agent-config`** npm package and the
artifacts it ships: skills, rules, commands, MCP configs, hooks, and the
installer script. It does **not** cover downstream consumer projects that install
the package.

**Trust boundary.** `agent-config` has no running server and holds no user data.
The trust boundary is the **shipped artifact tree** (the content installed into a
consumer project's `.augment/`, `.claude/`, `.cursor/`, etc.) and the **installer
script** (`scripts/install.sh` / `src/cli/`). Threats are about artifact
integrity, supply-chain compromise, and injected payloads — not application
authentication or billing.

## Supported versions

Security fixes are applied to the **latest published version** on npm. Older
releases are not backported.

| Version | Supported |
|---|---|
| Latest (`main`) | ✅ |
| Older releases | ❌ |

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.**

Report vulnerabilities via **GitHub Security Advisories**:

> Repository → Security → Advisories → "Report a vulnerability"

Include:

- Affected surface (artifact path, script, installer step)
- Attack vector and prerequisites
- Proof-of-concept steps or payload (if safe to share)
- Impact assessment

## Response posture

| Step | Timeline |
|---|---|
| Acknowledgement | Within **3 business days** |
| Triage + severity assessment | Within **7 business days** |
| Fix or mitigation shipped | Depends on severity — critical: ≤ 14 days; high: ≤ 30 days |
| Public disclosure | Coordinated with the reporter after fix ships |

We follow responsible disclosure. Reporters who notify us privately before public
disclosure are credited in the release notes (unless they prefer anonymity).

## Out of scope

- Vulnerabilities in **consumer projects** that install `@event4u/agent-config`
  (those are the consumer's responsibility).
- Vulnerabilities in **host AI tools** (Claude Code, Augment, Cursor, etc.) —
  report those to the respective vendors.
- Social-engineering attacks against individual developers (out of scope for a
  package advisory).
- Theoretical injection risks in AI model outputs not caused by shipped
  `agent-config` content.

## Security architecture reference

The package threat model, linter coverage, and known gaps are documented in
[`docs/threat-model.md`](docs/threat-model.md).

Key controls shipped with the package:

- `lint_hidden_unicode.py` — Trojan-Source / invisible-char detection in all
  shipped `.md` files.
- `lint_instruction_smuggling.py` — prompt-injection and disclosure-suppression
  detection in skill/rule prose.
- `lint_mcp_config_security.py` — OWASP ASI04 checks on shipped MCP configs.
- `lint_skill_frontmatter_safety.py` — dangerous-frontmatter detection
  (`bypassPermissions`, wildcard `allowed_tools`, unsafe automated execution).
- `lint_agent_security.py` — umbrella runner aggregating the four linters above,
  with SARIF 2.1.0 output for CI integration.
