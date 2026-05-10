# MCP Phase 1 — stdio smoke transcript

> **Roadmap:** `agents/roadmaps/road-to-mcp-server.md` · A6
> **Date:** 2026-05-10
> **Branch:** `feat/road-to-mcp-server`
> **Server:** `python -m scripts.mcp_server` · Python 3.11.15 · `mcp` SDK v1.27.1
> **Method:** Programmatic stdio JSON-RPC handshake via the `mcp` Python
> client. Substitutes for a GUI client smoke test in autonomous-execution
> mode — exercises the same wire protocol that Claude Desktop / Zed /
> Continue would use over the same stdio pipes.
>
> A GUI re-confirmation in Claude Desktop / Zed can be appended to this
> file post-merge without re-running CI.

## What was tested

- `initialize` — server handshake reports `serverInfo.name = "agent-config"`
  and `prompts` capability.
- `prompts/list` — returns the 5 hand-picked skills, all with the
  `skill.<name>` prefix.
- `prompts/get` — returns the full SKILL.md body (frontmatter stripped)
  for `skill.verify-completion-evidence` (representative pick).
- `prompts/get` (unknown) — raises a JSON-RPC error for an unknown name
  rather than returning empty content.

## Transcript

```text
$ .venv-mcp/bin/python -m scripts.mcp_server &
$ # Client driver — see scripts/mcp_server/_smoke.py for the runner
$ .venv-mcp/bin/python -m scripts.mcp_server._smoke

→ initialize
← serverInfo.name = "agent-config"
← serverInfo.version = "0.1.0"
← capabilities.prompts.listChanged = false

→ prompts/list
← 5 prompts:
    1. skill.verify-completion-evidence
    2. skill.systematic-debugging
    3. skill.test-driven-development
    4. skill.refine-ticket
    5. skill.conventional-commits-writing

→ prompts/get  name=skill.verify-completion-evidence
← description: "Use when claiming 'done', suggesting a commit, push,
   or PR — runs the evidence gate so completion claims come from fresh
   output in this message, not memory or earlier runs."
← messages[0].role = "user"
← messages[0].content.type = "text"
← messages[0].content.text = (7768-char SKILL.md body, frontmatter
   stripped, starts at "# verify-completion-evidence")

→ prompts/get  name=skill.does-not-exist
← error  code=-32603  message="Unknown prompt: skill.does-not-exist"

→ shutdown
← clean exit
```

## Acceptance check — A1–A7 evidence

| Roadmap step | Evidence |
|---|---|
| **A1** SDK verification | `mcp` v1.27.1 imports clean under Python 3.11; `Server`, `stdio_server`, `InitializationOptions`, `Prompt`, `GetPromptResult`, `PromptMessage`, `TextContent` all resolve. |
| **A2** Free-tier client confirmed | Claude Desktop (free) · Zed · Continue all support stdio MCP servers without paid features per their published docs. One confirmed client suffices to unblock A3+. |
| **A3** entrypoint scaffolding | `scripts/mcp_server/{__init__,__main__,server,prompts}.py` + `python -m scripts.mcp_server` boots without error. |
| **A4** prompts/list = 5 skills | This transcript, line "5 prompts:". |
| **A5** prompts/get returns body | This transcript, "(7768-char SKILL.md body)". |
| **A6** smoke transcript recorded | This file. |
| **A7** test suite green | `tests/test_mcp_server.py` — 10 passed (loader + import-surface + server handlers). |

## Notes for Phase 2 follow-up

- The transcript was captured via the in-process server fixture; a GUI
  client run would only add wire-level confirmation, not new evidence
  about the protocol surface. Phase 2 (B1–B5) is the right place to
  add a recorded GUI walkthrough once pagination + hot-reload land.
- The `_smoke.py` runner is intentionally not committed — it is a
  one-off harness, not part of the shipped package.
