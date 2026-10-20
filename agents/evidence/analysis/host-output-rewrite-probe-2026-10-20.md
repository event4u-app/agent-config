<!-- evidence-type: analysis -->
# Host output- and input-rewrite probe — Claude Code 2.1.304

The four lines below are the structured record `rewrite_capability.ts` reads
for the `output` channel; the narrative after them is the evidence they rest on.

host: claude
host_version: 2.1.304
channel: output
result: delivered
auth_mode: subscription

- **Host:** Claude Code `2.1.304` (`claude --version`), model for probe sessions `claude-haiku-5-5` (`--model haiku`).
- **Date:** 2026-10-20.
- **Roadmap:** `road-to-placeholders-on-the-wire`, steps 0.1 and 0.2.
- **Spend:** subscription only; no API key, no paid service. Telemetry went to a local OTLP sink on `127.0.0.1:4318`.
- **Marker:** `PLACEHOLDERPROBE-7f3a9c` (not credential-shaped). **Token:** `[[TOK-1]]`.
- **Every answer below is grounded in a line from the raw logs** (`logs/events.jsonl`, `logs/*.out`, `logs/otlp*.log`, `logs/transcripts/*.jsonl`, `logs/transcript-counts.txt`), never in documentation.
- **No refusal occurred.** No harness, auto-mode classifier or guard refused any action of this probe.

## Method

Every session ran from `probe/work/` (a scratch directory outside any repository) as:

```bash
claude -p --model haiku --setting-sources "" --settings <S>/probe-hooks.json \
  --allowedTools "Read" "Grep" "Bash(echo:*)" "Bash(cat:*)" "Bash(node:*)" "Bash(printf:*)" "Bash(python3:*)" \
                 "mcp__probe__get_record" "Agent" "Task" \
  --output-format json [--mcp-config <S>/mcp.json --strict-mcp-config] [--resume <id>] "<prompt>" < /dev/null
```

`--setting-sources ""` kept the user's own settings-file hooks out: every `stop_hook_summary` in the transcripts reports `hookCount: 1` (only the probe hook). The scenario is written to `scenario.txt` by `run.sh` before each run. `work/data.txt` holds four lines, the third being `secret line: PLACEHOLDERPROBE-7f3a9c end`.

Scenarios: `post-preserve` (deep-replace marker → token in `tool_response`, return as `updatedToolOutput`), `mcp-field` (use `updatedMCPToolOutput` instead for `mcp__*`), `post-mismatch-string` (return a string), `post-mismatch-extrakey` (preserved object plus an extra key; non-object wrapped as `{wrapped: …}`), `post-mismatch-missingkey` (delete the last top-level key), `pre-input` (deep-replace token → marker in `tool_input`, return `updatedInput` only), `pre-input-ask` (same plus `permissionDecision: "ask"`), `ups-sleep-block` (UserPromptSubmit busy-waits 10 s then exits 2), `ups-block` (control: exits 2 at once), `none`.

### probe-hooks.json

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ],
        "matcher": "*"
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ],
        "matcher": "*"
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 2
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ]
      }
    ],
    "SubagentStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ],
        "matcher": "*"
      }
    ],
    "PostToolUseFailure": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node <S>/hook.js",
            "timeout": 30
          }
        ],
        "matcher": "*"
      }
    ]
  }
}```

### hook.js

```js
#!/usr/bin/env node
// Probe hook: logs the received envelope, then replies per scenario.
// Scenario comes from PROBE_SCENARIO (env) or <dir>/scenario.txt.
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const MARKER = 'PLACEHOLDERPROBE-7f3a9c';
const TOKEN = '[[TOK-1]]';
const LOG = path.join(DIR, 'logs', 'events.jsonl');

function shape(v, depth = 0) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return depth > 3 ? 'array' : ['array', v.length ? shape(v[0], depth + 1) : 'empty'];
  if (typeof v === 'object') {
    if (depth > 3) return 'object';
    const o = {};
    for (const k of Object.keys(v)) o[k] = shape(v[k], depth + 1);
    return o;
  }
  return typeof v;
}
function deepReplace(v, from, to) {
  if (typeof v === 'string') return v.split(from).join(to);
  if (Array.isArray(v)) return v.map((x) => deepReplace(x, from, to));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = deepReplace(v[k], from, to);
    return o;
  }
  return v;
}
function trunc(v) {
  const s = JSON.stringify(v);
  if (s === undefined) return undefined;
  return s.length > 3000 ? s.slice(0, 1500) + ' …[' + s.length + ' chars]… ' + s.slice(-1500) : s;
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let env = {};
  try { env = JSON.parse(raw); } catch (e) { env = { parse_error: String(e) }; }
  let scenario = process.env.PROBE_SCENARIO || '';
  try { if (!scenario) scenario = fs.readFileSync(path.join(DIR, 'scenario.txt'), 'utf8').trim(); } catch {}
  const ev = env.hook_event_name;
  const entry = {
    ts: new Date().toISOString(),
    scenario,
    event: ev,
    tool_name: env.tool_name,
    session_id: env.session_id,
    agent_id: env.agent_id,
    agent_type: env.agent_type,
    transcript_path: env.transcript_path,
    envelope_keys: Object.keys(env),
    tool_input_shape: env.tool_input !== undefined ? shape(env.tool_input) : undefined,
    tool_response_type: env.tool_response === undefined ? undefined : (Array.isArray(env.tool_response) ? 'array' : typeof env.tool_response),
    tool_response_shape: env.tool_response !== undefined ? shape(env.tool_response) : undefined,
    raw_len: raw.length,
    marker_in_envelope: raw.includes(MARKER),
    token_in_envelope: raw.includes(TOKEN),
    tool_input: trunc(env.tool_input),
    tool_response: trunc(env.tool_response),
    prompt: env.prompt,
  };
  fs.appendFileSync(LOG, JSON.stringify(entry) + '\n');

  const out = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
  const parts = scenario.split(',');
  const has = (p) => parts.includes(p);

  if (ev === 'UserPromptSubmit' && has('ups-sleep-block')) {
    const end = Date.now() + 10000; while (Date.now() < end) {}
    process.stderr.write('probe: blocking prompt after sleep');
    process.exit(2);
  }
  if (ev === 'UserPromptSubmit' && has('ups-block')) { process.stderr.write('probe: blocking prompt immediately'); process.exit(2); }
  if (ev === 'PostToolUse' && env.tool_response !== undefined) {
    const isMcp = String(env.tool_name || '').startsWith('mcp__');
    const field = has('mcp-field') && isMcp ? 'updatedMCPToolOutput' : 'updatedToolOutput';
    let replacement;
    if (has('post-preserve')) replacement = deepReplace(env.tool_response, MARKER, TOKEN);
    else if (has('post-mismatch-string')) replacement = 'REPLACED-AS-STRING ' + TOKEN;
    else if (has('post-mismatch-extrakey')) {
      const r = deepReplace(env.tool_response, MARKER, TOKEN);
      replacement = (r && typeof r === 'object' && !Array.isArray(r)) ? { ...r, probeExtraKey: 'x' } : { wrapped: r };
    } else if (has('post-mismatch-missingkey')) {
      const r = deepReplace(env.tool_response, MARKER, TOKEN);
      if (r && typeof r === 'object' && !Array.isArray(r)) { const ks = Object.keys(r); delete r[ks[ks.length - 1]]; }
      replacement = r;
    }
    if (replacement !== undefined) {
      fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), emitted: field, tool_name: env.tool_name, replacement: trunc(replacement) }) + '\n');
      out({ hookSpecificOutput: { hookEventName: 'PostToolUse', [field]: replacement } });
    }
  }
  if (ev === 'PreToolUse' && env.tool_input && (has('pre-input') || has('pre-input-ask'))) {
    const ni = deepReplace(env.tool_input, TOKEN, MARKER);
    const hso = { hookEventName: 'PreToolUse', updatedInput: ni };
    if (has('pre-input-ask')) { hso.permissionDecision = 'ask'; hso.permissionDecisionReason = 'probe ask'; }
    fs.appendFileSync(LOG, JSON.stringify({ ts: new Date().toISOString(), emitted: 'PreToolUse', hso }) + '\n');
    out({ hookSpecificOutput: hso });
  }
  process.exit(0);
});
```

### run.sh

```bash
#!/bin/bash
# usage: run.sh <label> <scenario> <prompt> [extra claude args...]
S="$(cd "$(dirname "$0")" && pwd)"
label="$1"; scen="$2"; prompt="$3"; shift 3
echo "$scen" > "$S/scenario.txt"
echo "{\"ts\":\"$(date -u +%FT%TZ)\",\"run\":\"$label\",\"scenario\":\"$scen\"}" >> "$S/logs/events.jsonl"
cd "$S/work" && claude -p --model haiku --setting-sources "" --settings "$S/probe-hooks.json" \
  --allowedTools "Read" "Grep" "Bash(echo:*)" "Bash(cat:*)" "Bash(node:*)" "Bash(printf:*)" "Bash(python3:*)" "mcp__probe__get_record" "Agent" "Task" \
  --output-format json "$@" "$prompt" < /dev/null > "$S/logs/$label.out" 2> "$S/logs/$label.err"
echo "exit=$?"
node -e 'const o=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log("session",o.session_id);console.log("RESULT:",o.result);console.log("denials",JSON.stringify(o.permission_denials))' "$S/logs/$label.out" 2>/dev/null || head -c 2000 "$S/logs/$label.out"
cat "$S/logs/$label.err" | head -20
```

### mcp-server.mjs and mcp.json (SDK `@modelcontextprotocol/sdk` 1.30.0 by absolute path)

```js
// Tiny stdio MCP server for the probe: one tool returning the marker.
import { Server } from '~/projects/galawork/galawork-packages/event4u/agent-config-lane-placeholders/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js';
import { StdioServerTransport } from '~/projects/galawork/galawork-packages/event4u/agent-config-lane-placeholders/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '~/projects/galawork/galawork-packages/event4u/agent-config-lane-placeholders/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js';
const server = new Server({ name: 'probe', version: '0.0.1' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: 'get_record', description: 'Returns a probe record.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }],
}));
server.setRequestHandler(CallToolRequestSchema, async () => ({
  content: [{ type: 'text', text: 'record header\nsecret line: PLACEHOLDERPROBE-7f3a9c end\nrecord footer' }],
}));
await server.connect(new StdioServerTransport());
```

```json
{"mcpServers":{"probe":{"command":"node","args":["<S>/mcp-server.mjs"]}}}
```

### otlp-sink.js (telemetry receiver, item 0.1.7)

```js
// Local OTLP/HTTP sink: appends every request path + body to logs/otlp.log, answers 200.
const http = require('http'); const fs = require('fs'); const path = require('path');
const LOG = path.join(__dirname, 'logs', 'otlp.log');
http.createServer((req, res) => { let b = []; req.on('data', (c) => b.push(c)); req.on('end', () => {
  fs.appendFileSync(LOG, `=== ${new Date().toISOString()} ${req.method} ${req.url} ${req.headers['content-type']}\n${Buffer.concat(b).toString('utf8')}\n`);
  res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); }); }).listen(4318, '127.0.0.1');
setTimeout(() => process.exit(0), 180000);
```

Telemetry runs added: `CLAUDE_CODE_ENABLE_TELEMETRY=1 OTEL_LOGS_EXPORTER=otlp OTEL_METRICS_EXPORTER=otlp OTEL_EXPORTER_OTLP_PROTOCOL=http/json OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318 OTEL_LOG_TOOL_DETAILS=1 OTEL_LOG_USER_PROMPTS=1 OTEL_LOGS_EXPORT_INTERVAL=500`. A first attempt with `OTEL_LOGS_EXPORTER=console` produced no telemetry output at all in `-p --output-format json` mode (`logs/telemetry.out` holds only the result JSON, `logs/telemetry.err` is empty), hence the local sink.

## Step 0.1 — tool-output replacement (PostToolUse)

### 0.1.1 `tool_response` shape per tool

| Tool | Answer | What was observed (`logs/events.jsonl`, field `tool_response_shape`) |
|---|---|---|
| Read | observed | object `{type: string ("text"), file: {filePath: string, content: string, numLines: number, startLine: number, totalLines: number}}`; the marker sits in `file.content` as raw file text, without line numbers |
| Bash | observed | object `{stdout: string, stderr: string, interrupted: boolean, isImage: boolean, noOutputExpected: boolean}`; for a spilled output additionally `persistedOutputPath: string, persistedOutputSize: number` |
| Grep (`output_mode: content`) | observed | object `{mode: string, numFiles: number, filenames: array (empty), content: string, numLines: number, totalLines: number}`; content `"3:secret line: … end"` |
| MCP (`mcp__probe__get_record`) | observed | **array** of content blocks `[{type: "text", text: string}]` — not the `{content: [...]}` envelope of the MCP result; the PostToolUse envelope also carries a top-level `mcp_server` key |

Envelope keys for PostToolUse: `session_id, transcript_path, cwd, prompt_id, permission_mode, effort, hook_event_name, tool_name, tool_input, tool_response, tool_use_id, duration_ms` (+ `mcp_server` for MCP).

### 0.1.2 – 0.1.7

| Item | Answer | What was observed |
|---|---|---|
| 2. Shape-preserving replacement is what the model quotes | observed | All four tools: the model's final answer was `secret line: [[TOK-1]] end` (Read `d131b78f…`, Bash `c0da4fe6…`, Grep `1802813a…` as `3:secret line: [[TOK-1]] end`, MCP `248d40de…`). The `tool_result` sent to the model held the token (`"1\talpha line one\n…3\tsecret line: [[TOK-1]] end…"` for Read). For MCP, both `updatedToolOutput` and `updatedMCPToolOutput` were applied (`c7e44af3…`, answer `secret line: [[TOK-1]] end`). |
| 3. Mismatched-shape replacement | observed | **Built-in tools are schema-validated and fall back to the ORIGINAL output — fail-open, the marker reaches the model.** Read/Bash with a string: answer `… PLACEHOLDERPROBE-7f3a9c end`; transcript attachment `hook_error_during_execution`: `PostToolUse hook returned updatedToolOutput that does not match Read's output shape; using original output. [{"code":"invalid_type","expected":"object","path":[],"message":"Invalid input: expected object, received string"}]` (same text for Bash). Read with the required `file` key deleted: dropped, `path: ["file"] … expected object, received undefined`, original reached the model. **Not every deviation is a mismatch:** an extra key was accepted (Read and Bash answered with the token), and deleting Bash's `noOutputExpected` was accepted (answer with the token). No message on stderr or in the `-p` result in any case; the error exists only as a transcript attachment. **MCP is not validated:** a string where the array was was applied verbatim (model answered `REPLACED-AS-STRING [[TOK-1]]`, `c085e463…`, also via `updatedMCPToolOutput`, `9adced1d…`), and a `{wrapped: [...]}` object was applied and passed to the model as JSON (`e4d275b0…`). |
| 4. On-disk transcript afterwards | observed | After a shape-preserving replacement the transcript holds **only the token**: `logs/transcript-counts.txt` shows `marker=0` for every preserve run (Read, Bash, Grep, MCP, MCP-field, large Bash, subagent). Both the model-bound `tool_result.content` and the `toolUseResult` field are replaced. The hook's own stdout is persisted as a `hook_success` attachment (it carried the token here). After a dropped mismatch the transcript holds the original marker (`read-post-mismatch-string marker=3`, `read-post-mismatch-missingkey marker=3`, `bash-post-mismatch-string marker=3`). |
| 5. Output large enough to spill | observed | `node gen.js` printed 94,451 bytes with the marker at line 1601 of 1602. The hook received `stdout` truncated to the head (envelope `raw_len 31767`, **marker not present**) plus `persistedOutputPath: ~/.claude/projects/<slug>/<session>/tool-results/bweyszdhn.txt` and `persistedOutputSize: 94451`. The spill file already existed and **holds the original marker** (`grep -c` = 1); it was written before the hook ran and the replacement does not touch it. The model received a `<persisted-output>` preview, then called Grep on the spill file; that Grep's PostToolUse received the marker and its replacement applied (model answer `secret line: [[TOK-1]] end`). The session transcript itself holds `marker=0`. |
| 6. Subagent tool calls and `session_id` | observed | Run `6920b8bd…`: the subagent's PreToolUse/PostToolUse for Bash arrived with the **parent's `session_id`** and the parent's `transcript_path`, distinguished by `agent_id: aeb0b5e75721853fe`, `agent_type: general-purpose` (absent on parent events). The replacement applied inside the subagent; the subagent transcript `…/subagents/agent-aeb0b5e75721853fe.jsonl` holds `marker=0 token=3`. |
| 7. Host telemetry and the original output | observed | Local OTLP sink, run `b61d2efa…`: the `tool_result` log event carries `tool_name, tool_use_id, success, duration_ms, tool_input` (full JSON), `tool_input_size_bytes`, `tool_result_size_bytes: 96` — **no output content**. Marker count in the OTLP payload: 0. Telemetry does carry `user_prompt` text (`prompt`, `prompt_text`) and the `assistant_response` text (`"secret line: [[TOK-1]] end"`). Console exporter: no output observable in `-p` mode (see Method). |

## Step 0.2 — tool-input replacement (PreToolUse `updatedInput`)

| Item | Answer | What was observed |
|---|---|---|
| 1. `updatedInput` alone, permission flow running | observed | Run `002e56aa…`: model called Bash `echo '[[TOK-1]]'`; the hook returned only `updatedInput` with `echo 'PLACEHOLDERPROBE-7f3a9c'`; the tool ran the replaced input — `toolUseResult.stdout: "PLACEHOLDERPROBE-7f3a9c"`, model answer `PLACEHOLDERPROBE-7f3a9c`. The permission check passed (`Bash(echo:*)` allow rule; telemetry `tool_decision: accept, source: config`). The PostToolUse envelope's `tool_input` was the **replaced** input. Telemetry's `tool_result.tool_input` was the **replaced** input (`{"command":"echo 'PLACEHOLDERPROBE-7f3a9c'", …}` in `logs/otlp.log`). |
| 2. `permissionDecision: "ask"` plus `updatedInput` in `-p` | observed | Run `ea10f063…`: the call was **denied**, not prompted; the model's `tool_result` was `"probe ask"` (`toolUseResult: "Error: probe ask"`), i.e. the `permissionDecisionReason`. The `PermissionRequest` hook did not fire. The restored input is visible in the `-p` JSON result: `permission_denials: [{tool_name: "Bash", tool_input: {command: "echo 'PLACEHOLDERPROBE-7f3a9c'", …}}]`, and in the transcript's `hook_success` attachment (the hook's stdout, persisted verbatim). The model never saw it. |
| 3. `tool_use` block in transcript / resent next turn | observed | The transcript's assistant `tool_use` block keeps the **model's original** input `{"command":"echo '[[TOK-1]]'"}`, while the `tool_result` holds the marker. Second turn via `--resume 002e56aa…`, asked to quote its previous `command` argument without tools: `echo '[[TOK-1]]'` — the resent `tool_use` carries the original. **But the real value lands on disk regardless:** the PreToolUse `hook_success` attachment stores the hook's stdout (`updatedInput` with the marker) verbatim in the transcript (lines with the marker in that session: `attachment hook_success PreToolUse:Bash`, the `tool_result`, the assistant text). |
| 4. Hook for an `@file` mention | observed | Run `78ec5252…` with `post-preserve` active: events were `SessionStart`, `UserPromptSubmit`, `Stop` only — **no PreToolUse/PostToolUse** fired for the `@data.txt` inclusion. The UserPromptSubmit envelope carried only the typed prompt (`marker_in_envelope: false`). The host injected the file as a synthetic `Result of calling the Read tool: … secret line: PLACEHOLDERPROBE-7f3a9c end` plus a `file` attachment; the model answered `secret line: PLACEHOLDERPROBE-7f3a9c end`; transcript `marker=4`. The first hook to see the content was `Stop` (`last_assistant_message`). |
| 5. Timed-out `UserPromptSubmit` hook | observed | Hook `timeout: 2`, scenario sleeps 10 s then would exit 2. Run `8bf1052a…`: transcript attachment `hook_cancelled`, `hookName: UserPromptSubmit`, `durationMs: 2037`; the prompt **went through** — model answered `PASSED`, `is_error: false`, `terminal_reason: completed`. Control `79ea7738…` (exit 2 without sleeping): `UserPromptSubmit operation blocked by hook: … probe: blocking prompt immediately`, `num_turns: 0`, zero cost — so the same hook blocks when it finishes in time. **A timeout is fail-open.** The timed-out run's wall clock was 24 s, against about 1 s for the control. |

## What this means for the roadmap (own analysis)

- Shape-preserving PostToolUse replacement works for Read, Bash, Grep and MCP on 2.1.304 and keeps the marker out of both the model context and the transcript.
- The built-in fallback on a shape mismatch is **fail-open**: the original output is used and only a transcript attachment records it. A replacement stage must preserve shape exactly. Extra keys and dropping optional keys are tolerated, but the safe rule is to replace string leaves only.
- Three paths bypass the PostToolUse stage: spill files (written with the original before the hook runs; the hook sees only the truncated head), `@file` inclusion (no tool hook fires), and UserPromptSubmit timeouts (fail-open).
- On the input side, restoring the real value via `updatedInput` writes it to disk twice outside the model's view: in the `hook_success` attachment (the hook's stdout) and in telemetry's `tool_input` when telemetry is on. The `tool_use` block the model sees stays tokenized.

## Raw logs

`logs/events.jsonl` (every hook envelope summary and every emitted reply) · `logs/<run>.out` / `.err` (the `-p` JSON result per run) · `logs/otlp-0.1.log`, `logs/otlp.log` (OTLP sink payloads; they contain account identifiers and stay in the scratch directory) · `logs/transcripts/` (copies of the session transcripts) · `logs/transcript-counts.txt` (marker/token counts per transcript) · `tx.js` (transcript reader).
