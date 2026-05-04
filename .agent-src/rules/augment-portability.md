---
type: "auto"
description: "Editing or creating files inside .augment/ directory — skills, rules, commands, templates, contexts must be project-agnostic"
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/augment-portability-mechanics.md
---

# Package Portability

Everything that ships with the `event4u/agent-config` package MUST be
**project-agnostic**. That includes:

- Everything inside `.augment/` (skills, rules, commands, guidelines,
  templates, contexts)
- The package repo's own root `AGENTS.md`
- The package repo's own `.github/copilot-instructions.md`

All three are either installed into consumer projects (`.augment/` via
`install.sh`) or read by AI tools when working on the package itself
(`AGENTS.md`, `copilot-instructions.md`). Leaking consumer-specific
content into any of them pollutes downstream projects or misleads agents.

## Rules

- NEVER reference a specific consumer project, repo name, domain, or tech
  stack directly. The package repo itself (`event4u/agent-config`) MAY be
  named inside its own root `AGENTS.md` and `copilot-instructions.md` —
  that is meta about the package, not a leak.
- NEVER hardcode consumer-project paths, class names, or conventions.
- Write content so it works as a **reusable package** across any project.
- Project-specific behavior belongs in the **consumer's** `.agent-settings.yml`,
  `AGENTS.md`, or `agents/` — never in files shipped by this package.
- If a skill or rule needs project-specific input, read it from
  `.agent-settings.yml` or accept it as a parameter.
- When reviewing or editing package files, always ask: "Would this still
  make sense in a completely different project?"

## Runtime invocations — no `task` commands

Skills, rules, commands, guidelines, personas, and context docs run in
**consumer projects**, which may not have Task installed. **Never**
reference a `task <something>` invocation inside any artefact file
under `.agent-src.uncompressed/{skills,rules,commands,guidelines,personas,contexts}/`
(and therefore also not in the compressed mirror under `.agent-src/`).
Use direct script invocations instead.

## Consumer CLI — `./agent-config`

A subset of package scripts is exposed through a project-local CLI
wrapper `./agent-config` (written into the project root by the
installer, gitignored). Artefacts MUST prefer the CLI over raw
`python3 scripts/…` paths for every command the CLI already covers.

## Translation tables — see mechanics

The full `task`-to-script translation table, the `./agent-config`
CLI mapping, and the rationale (Task absence on consumers,
maintainer-vs-artefact split) all live in
[`contexts/communication/rules-auto/augment-portability-mechanics.md`](../contexts/communication/rules-auto/augment-portability-mechanics.md).
Pull it whenever an artefact is about to mention a runtime
invocation.

## Enforcement

`scripts/check_portability.py` scans `.augment/`, `.agent-src.uncompressed/`,
and the package repo's root `AGENTS.md` + `.github/copilot-instructions.md`
for forbidden identifiers, for any `task <name>` invocation inside
artefact files, and for direct script invocations that bypass the
`./agent-config` CLI. It runs in CI and must pass before any PR.
