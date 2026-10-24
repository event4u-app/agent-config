<!-- evidence-type: analysis -->

# A skipping worker receives a planted CLAUDE.md line through SubagentStart

road-to-a-tick-the-shipped-path-earns 2.4, 2026-10-24, Claude Code 2.1.310 (`claude --version`).

## Question

Does a subagent whose definition sets `omitClaudeMd: true` receive a line from the project's
`CLAUDE.md` on the host's own Agent path, once the `subagent-constraints` concern is bound on
`SubagentStart`? And does it lack that line without the concern?

## Setup

Two fixture projects, `on` and `off`, each a fresh `git init` directory outside this repository
with the same two files:

- `CLAUDE.md`: `The project codeword is QUARTZ-41.`
- `.claude/agents/ac-probe.md`: `tools: Glob`, `omitClaudeMd: true`, body "Answer the question
  you are given from your instructions alone. Never use a tool. If your instructions give no
  answer, reply NONE."

`on/.claude/settings.json` binds `SubagentStart` to this branch's built dispatcher
(`node dist/hooks/dispatch.js --platform claude --event subagent_start --native-event
SubagentStart --project-dir "$CLAUDE_PROJECT_DIR"`, after `npm run build:hooks`).
`off/.claude/settings.json` is `{}`. Both sessions also ran the user-global hooks of the installed
release, which carries no such concern.

Each session ran:

```
claude -p "Dispatch the ac-probe agent exactly once with this prompt and nothing else: 'What is the project codeword? Reply with the codeword only, or NONE.' Do not add any information to its prompt. Then print its reply verbatim after the prefix AGENT: and stop." --output-format stream-json --verbose --permission-mode bypassPermissions
```

## Result

| Fixture | Agent tool input `prompt` | Subagent reply | Subagent tool uses |
|---|---|---|---|
| `on` | `What is the project codeword? Reply with the codeword only, or NONE.` | `QUARTZ-41` | 0 |
| `off` | `What is the project codeword? Reply with the codeword only, or NONE.` | `NONE` | 0 |

The dispatch prompts are byte-identical and carry no codeword, and neither subagent used a tool,
so the codeword reached the `on` subagent only through the `SubagentStart` additional context. The
`off` reply confirms the definition really skips `CLAUDE.md` on this host version.

Repeated after the council's round-1 fixes (nearest-first allocation, serialized cap, YAML
frontmatter parsing), rebuilt with `npm run build:hooks`: `on` answered `QUARTZ-41`, `off` answered
`NONE`, same prompts.

## Bound

One host version, one run per arm, one fixture definition. It shows the host adds a
`SubagentStart` `additionalContext` to the subagent's context and that the concern supplies the
project's line; it says nothing about how a model weighs a long digest against its task.
