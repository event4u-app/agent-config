<!-- evidence-type: analysis -->

# A skipping worker receives the user's own instruction layer through SubagentStart

road-to-a-cold-start-paid-once 2.5, decision D16 (owner directive 2026-10-24), Claude Code 2.1.310
(`claude --version`).

## Question

Once the `subagent-constraints` concern also digests the user's own layer — `<config dir>/CLAUDE.md`
and each rule under `<config dir>/rules/` by its Iron Law blocks — does a subagent whose definition
sets `omitClaudeMd: true` receive a planted user-layer line and a planted user-rule law on the
host's own Agent path, next to the project's CLAUDE.md line? And does it lack all three without the
concern?

## Setup

Two fixture projects, `on` and `off`, each a fresh `git init` directory outside this repository
with the same two files:

- `CLAUDE.md`: `The project codeword is QUARTZ-41.`
- `.claude/agents/ac-probe.md`: `tools: Glob`, `omitClaudeMd: true`, body "Answer the question
  you are given from your instructions alone. Never use a tool. If your instructions give no
  answer for a part, write NONE for that part."

A fixture user layer outside both projects:

- `cfg/CLAUDE.md`: `The user reply prefix is ONYX-3.`
- `cfg/rules/house-codeword.md`: an `## The Iron Law` section whose fence reads
  `THE USER CODEWORD IS BASALT-77.`, followed by prose that the digest does not carry.

`on/.claude/settings.json` binds `SubagentStart` to this branch's built dispatcher, with
`CLAUDE_CONFIG_DIR` pointing at the fixture user layer for the hook process only
(`CLAUDE_CONFIG_DIR=<cfg> node dist/hooks/dispatch.js --platform claude --event subagent_start
--native-event SubagentStart --project-dir "$CLAUDE_PROJECT_DIR"`, after `npm run build:hooks`).
The session itself ran under the real config directory. `off/.claude/settings.json` is `{}`.

Each session ran:

```
claude -p "Dispatch the ac-probe agent exactly once with this prompt and nothing else: 'What are the user codeword, the user reply prefix and the project codeword? Reply with the three values separated by spaces, writing NONE for any you do not know.' Do not add any information to its prompt. Then print its reply verbatim after the prefix AGENT: and stop." --output-format stream-json --verbose --permission-mode bypassPermissions
```

## Result

| Fixture | Agent tool input `prompt` | Subagent reply |
|---|---|---|
| `on` | `What are the user codeword, the user reply prefix and the project codeword? Reply with the three values separated by spaces, writing NONE for any you do not know.` | `BASALT-77 ONYX-3 QUARTZ-41` |
| `off` | the same, byte for byte | `NONE NONE NONE` |

Neither stream shows a tool call from inside the subagent. The dispatch prompts carry none of the
three values, so all three reached the `on` subagent through the `SubagentStart` additional
context: the user CLAUDE.md line, the user rule's Iron Law block and the project line.

## Bound

One host version, one run per arm, one small fixture layer. It shows the concern delivers the user
layer on the host's path. It does not show how a full user layer fares: measured offline against a
106-rule layer, the 9,728-byte cap carries the law blocks of 26 of the 29 present safety-floor and
consequence-class rules whole and leaves out the last three in list order (`tool-safety`,
`untrusted-input-defense`, `user-interrupt-priority`); the project CLAUDE.md, the user CLAUDE.md
and 79 other rules are omitted, and the inventory falls back to counts.
