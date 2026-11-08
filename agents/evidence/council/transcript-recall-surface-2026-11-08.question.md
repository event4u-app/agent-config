<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-08, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence). Not edited after the run. -->

# Where should transcript recall live?

You are deciding one design question for a repository that ships rules, skills
and hooks for AI coding agents, plus a CLI (`agent-config <namespace>:<action>`).
Answer on the evidence below. Do not summarise the evidence back. Name the option
you choose, the strongest argument against it, and anything the options miss.

## Background

After the host compacts a session, the agent can only see the summary. The
host still keeps the full session transcript (JSONL) on disk, and hooks receive
its path (`transcript_path`). The planned capability: a read-only keyword search
over the **current session's own** transcript, returning turn index plus a
capped excerpt (2,000 tokens per call, 3 calls per turn), redacted through the
existing redaction path. Never other sessions. A pre-registered comparison over
at least 15 compactions decides whether it stays on; no gain keeps it off.

## Constraints from the tree

- ADR-041 controls the leading verb of **visible slash commands**: an allowlist
  (`work`, `audit`, `plan`, `implement`, `review`, `fix`, `memory`, `roadmap`,
  ...); a new verb needs an ADR. It does not name the CLI namespaces.
- Existing CLI namespaces near this: `session:recycle` (validates and writes a
  recycle envelope for the successor session), `sessions:list` / `sessions:claim`
  (live sessions), `memory:lookup` / `memory:get` (curated memory entries),
  `chat-history:hook` / `chat-history:checkpoint` (a separate chat-history log),
  `handoff` (generate a handoff from a recent session).
- `export` was proposed earlier but ejects a tool's canonical content into a
  path; it does not read session data.
- The agent would call this from inside a session, typically right after a
  compaction, via a shell call or an MCP tool.

## The question

Which surface should carry transcript recall?

1. A new action in the existing `session:` namespace (e.g. `session:recall`),
   CLI only.
2. A flag or mode on `memory:lookup`.
3. An MCP tool (with a CLI twin), not a slash command.
4. Something else — name it.
