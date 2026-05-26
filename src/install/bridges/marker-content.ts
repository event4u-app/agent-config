/**
 * Marker content — verbatim payload for every marker-style bridge.
 *
 * Mirror of the `*_MARKER` string constants in
 * `scripts/install.py` (lines 1561–1896). Kept in a separate module so
 * snapshot tests can pin copy without dragging the builder closures in.
 */

export const ROOCODE_MARKER = `# Agent Config bridge

This file marks the project as an \`event4u/agent-config\` consumer.

Roo Code reads \`.roo/rules/*.md\` as system-level instructions. The
canonical rule and skill source lives under \`.augment/\` (Augment
portability mirror — see \`AGENTS.md\` for orientation).

## How to use

- These rules load automatically on every Roo Code session — no
  manual action required.
- Switch Roo Code modes (Architect / Code / Ask / Debug / Custom)
  via the mode switcher to invoke different cognition profiles;
  every mode still sees these rules.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Roo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/roocode.md\` for the full activation guide.

Run \`./agent-config --help\` for available commands.
`;

export const CLAUDE_DESKTOP_MARKER = `# Agent Config bridge — Claude Desktop

This file marks the project as an \`event4u/agent-config\` consumer.

Claude Desktop is a **global-scope** tool — it reads config from
\`~/Library/Application Support/Claude/\` (macOS) and does not
auto-discover project files. This marker is informational only.

To wire Claude Desktop to this project's rules, run:
\`npx @event4u/agent-config init --ai claude-desktop --global\`

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

export const AIDER_MARKER = `# Agent Config bridge — Aider

This file marks the project as an \`event4u/agent-config\` consumer.

Aider does not auto-discover this file. To activate it, add the
following to \`.aider.conf.yml\` (create if missing):

\`\`\`yaml
read:
  - .aider/agent-config.md
\`\`\`

Or pass \`--read .aider/agent-config.md\` on the command line.

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

export const CODEX_MARKER = `# Agent Config bridge — Codex CLI

This file marks the project as an \`event4u/agent-config\` consumer.

Codex CLI auto-discovers \`AGENTS.md\` at the project root — that file
is the canonical entry point. This marker is informational and tells
developers where the rules and skills live.

Canonical rule and skill source: \`.augment/\` (see project \`AGENTS.md\`).
`;

export const CONTINUE_MARKER = `# Agent Config bridge — Continue.dev

This file marks the project as an \`event4u/agent-config\` consumer.

Continue.dev auto-discovers \`.continue/rules/*.md\` as system-level
rules per session. The canonical rule and skill source lives under
\`.augment/\` (Augment portability mirror — see \`AGENTS.md\` for
orientation).
`;

export const KILOCODE_MARKER = `# Agent Config bridge — Kilo Code

This file marks the project as an \`event4u/agent-config\` consumer.

Kilo Code auto-discovers \`.kilocode/rules/*.md\` as system-level rules
per session. The canonical rule and skill source lives under
\`.augment/\` (Augment portability mirror — see \`AGENTS.md\` for
orientation).

## How to use

- These rules load automatically on every Kilo Code session — no
  manual action required.
- Switch Kilo Code modes (Architect / Code / Ask / Debug /
  Orchestrator) via the mode switcher to invoke different
  cognition profiles; every mode still sees these rules.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Kilo Code does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/kilocode.md\` for the full activation guide.
`;

export const ZED_MARKER = `# Agent Config bridge — Zed

This file marks the project as an \`event4u/agent-config\` consumer.

Zed reads \`.rules\` at the project root as system-level instructions —
that file is the canonical entry point. This marker is informational
and tells developers where the rules and skills live.

To activate agent-config under Zed, point Zed's \`.rules\` at the
canonical source (or symlink it):

\`\`\`
# Append to .rules at project root
@.augment/AGENTS.md
\`\`\`

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

export const JETBRAINS_MARKER = `# Agent Config bridge — JetBrains AI Assistant

This file marks the project as an \`event4u/agent-config\` consumer.

JetBrains AI Assistant reads custom prompts and guidelines from
project-level config (\`.idea/\`) and user-scope settings. This marker
is informational — to wire agent-config into JetBrains AI, point the
assistant's custom-prompts path at \`.augment/\` or copy the relevant
rules into your JetBrains profile.

Canonical rule and skill source: \`.augment/\` (see \`AGENTS.md\`).
`;

export const KIRO_MARKER = `# Agent Config bridge — Kiro

This file marks the project as an \`event4u/agent-config\` consumer.

Kiro auto-discovers \`.kiro/steering/*.md\` as steering documents per
session. The canonical rule and skill source lives under \`.augment/\`
(Augment portability mirror — see \`AGENTS.md\` for orientation).

## How to use

- Steering documents load automatically on every Kiro session — no
  manual action required.
- For structured, plan-first work, use Kiro's **Spec** workflow
  (the agent produces a spec → tasks → implementation under your
  review). For free-form work, use **Vibe**. Both honor these
  steering documents.
- Slash commands and skills live under \`.augment/commands/\` and
  \`.augment/skills/\`. Kiro does not register them natively —
  invoke them by name in chat (e.g. *"run the create-pr command"*).

See \`docs/setup/per-ide/kiro.md\` for the full activation guide.
`;
