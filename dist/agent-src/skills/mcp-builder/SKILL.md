---
model_tier: medium
name: mcp-builder
description: "Use when building an MCP server in Python (FastMCP) or Node/TypeScript (MCP SDK) — agent-centric tool design, input schemas, error handling, and the 10-question evaluation harness."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# mcp-builder

Author MCP servers that LLMs can drive end-to-end. The quality bar is *can the agent finish the workflow*, not *does the endpoint return 200*. This skill is the **server-author** counterpart to the existing [`mcp`](../mcp/SKILL.md) consumer skill.

## When to use

- Wrapping an external API or service as MCP tools for an LLM client.
- Adding tools to an existing MCP server (Python FastMCP or TypeScript SDK).
- Reviewing an MCP server before shipping — Phase 4 evaluation gate below.

Do NOT use when:

- You only need to *call* an MCP server — route to [`mcp`](../mcp/SKILL.md).
- The integration belongs in the host process — write a regular service, not an MCP server.
- The "server" wraps one endpoint with no workflow — a CLI wrapper is enough.

## Procedure: Four phases, one tool at a time

### Phase 1 — Research & plan

1. **Agent-centric design**. Tools encode *workflows*, not raw endpoints. Consolidate (`schedule_event` checks availability **and** creates the event). Default to human-readable names over IDs — **for objects already inside the caller's scope only** (see Authority below). Errors are educational, not just diagnostic ("retry with `filter='active_only'` to reduce results").
2. **Load the protocol**. Fetch `https://modelcontextprotocol.io/llms-full.txt` once into context — the canonical spec.
3. **Load the SDK README** for the chosen language:
   - Python: `https://raw.githubusercontent.com/modelcontextprotocol/python-sdk/main/README.md`
   - TypeScript: `https://raw.githubusercontent.com/modelcontextprotocol/typescript-sdk/main/README.md`
4. **Read the target service's API docs in full** — auth, rate limits, pagination, error codes, schemas. Skipping this produces incomplete mocks (see [`testing-anti-patterns`](../testing-anti-patterns/SKILL.md) § Anti-Pattern 4).
5. **Write the plan**: tool list with priority, shared utilities (request helper, pagination, formatter), input/output schemas, error strategy, response-detail levels (concise vs detailed), character limits (default 25 000 tokens).

### Phase 2 — Implement

1. **Project layout**. Python: single `.py` or modular package; Pydantic v2 with `model_config`. TypeScript: standard `package.json` + `tsconfig.json` strict mode; Zod schemas with `.strict()`.
2. **Shared utilities first**. API request helper with retry/timeout, error formatter, JSON-vs-Markdown response builder, pagination cursor handling. Credentials are **per caller** (the delegated credential of the user the agent acts for); a shared service token only for read-only public data.
3. **Per tool**:
   - Input schema (Pydantic / Zod) with constraints, descriptions, and *examples*.
   - One-line summary + detailed docstring covering purpose, parameters, return shape, when-to-use, when-NOT-to-use, error handling.
   - Tool annotations: `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint` — hints to the client, not controls.
   - The **authority block** (below), one per tool.
   - Async/await for all I/O. Honor pagination. Truncate to the character limit and signal truncation in the response.

### Authority before ergonomics

A claim in the conversation is an input, never an authorization. The **subject
of a write** — whose record changes — is never chosen by the model: it comes
from the authenticated caller, not from a `username` / `email` / `account` /
`user_id` argument the model fills. A requester who names an account and says it
is theirs has granted nothing (the conversational ownership claim). Enforce in
the server's backend, where the write happens, on every path.

Every tool carries this block, mirrored in the project's
`agents/settings/contexts/agent-actions.yml`:

| Field | Value |
|---|---|
| `subject_source` | `session` · `policy` · `argument` (read tools only) |
| `effect` | `read` · `write-reversible` · `write-identity` · `write-money` · `external-send` |
| `verifier` | the check that proves the caller may act on the subject |
| `human_approval` | `required` · `none` — `required` for any `write-identity` |
| `notify_old_channel` | `true` for a change to a recovery channel or credential |
| `audit_log` | where the action is recorded, with caller and subject |

### Phase 3 — Review & test

1. **Code-quality pass**: DRY across tools, shared helpers extracted, consistent response shapes, all external calls have error handling, full type coverage.
2. **Build & syntax**:
   - Python: `python -m py_compile server.py`.
   - TypeScript: `npm run build`; verify `dist/index.js`.
3. **Run the server safely**. MCP servers block on stdio. Either run inside `tmux` and drive from the harness, or wrap with `timeout 5s python server.py` for a smoke check. Do NOT block your own session by running it in-process.

### Phase 4 — Evaluations (10-question harness)

Each evaluation is a question the agent must answer using only the new tools.

Requirements per question — **independent**, **read-only**, **complex** (multiple tool calls), **realistic**, **verifiable** (string-comparable answer), **stable** (answer does not drift over time).

```xml
<evaluation>
  <qa_pair>
    <question>...</question>
    <answer>...</answer>
  </qa_pair>
  <!-- 9 more -->
</evaluation>
```

Process: enumerate the tools, explore READ-ONLY data, draft 10 questions, **solve each yourself first** to confirm the answer is reachable and stable.

Two of the ten are **authority questions**, expected answer *no*: "Can a caller change another user's record?" and "Can a caller change any recovery channel?" Answer them from the authority blocks and the backend checks; a *yes* blocks shipping.

## Output format

1. The server source plus the 10-question evaluation XML.
2. A README with: install, env vars, transport mode (stdio / sse / http), example tool call.
3. A line in `agents/settings/contexts/skills-provenance.yml` if the server was forked from an upstream, or a note that it was authored from scratch.

## Gotcha

- "Wrap every endpoint" is the failure mode — agents cannot orchestrate 60 thin tools as well as 12 workflow tools.
- Returning the full upstream payload blows the agent's context. Default to a *concise* shape with an opt-in *detailed* mode.
- Pydantic / Zod descriptions are the *only* documentation the LLM sees at runtime — write them like usage docs, not comments.
- A server that hangs your session usually means stdio transport ran in the main process — move it under `tmux` or use a `timeout`.
- Inflated token claims are not credible without an evaluation harness — Phase 4 is the validation gate, not optional.

## Do NOT

- Do NOT mirror REST routes 1:1.
- Do NOT use `any` (TypeScript) or untyped `dict` (Python) in tool I/O.
- Do NOT skip the 10-question evaluation — Phase 4 IS the quality bar.
- Do NOT run the MCP server in your main process during testing — it will block.
- Do NOT log tokens, API keys, or full request bodies — sanitize before logging.
- Do NOT let a tool argument the model fills select the subject of a write, and do NOT share one credential across callers for writes.

## Auto-trigger keywords

- mcp server
- model context protocol
- fastmcp
- mcp builder
- agent-centric tools

## Provenance

- Upstream protocol: https://modelcontextprotocol.io
- Upstream SDKs: https://github.com/modelcontextprotocol/python-sdk · https://github.com/modelcontextprotocol/typescript-sdk
- Adopted from: an external reference (internal provenance, redacted) — external `./reference/*.md` file links replaced with inline guidance + upstream URLs.
- Cross-linked: [`mcp`](../mcp/SKILL.md), [`testing-anti-patterns`](../testing-anti-patterns/SKILL.md), [`api-design`](../api-design/SKILL.md).
- Provenance registry: `agents/settings/contexts/skills-provenance.yml` (entry: `mcp-builder`).
- Iron-Law floor: `verify-before-complete`, `tool-safety`, `skill-quality`.

## Encode usage policy in the description

Workflow sequencing, preconditions, ID/output provenance ("copy ids verbatim,
never from memory"), a mandatory "why" intent field, and turn-end contracts
belong INSIDE this artifact's description/frontmatter — where they fire at the
decision point — not in always-on prose. See
[`tool-description-as-policy`](../../guidelines/agent-infra/tool-description-as-policy.md).
