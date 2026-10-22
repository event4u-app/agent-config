<!-- evidence-type: analysis -->
# Egress stage observe readings — one release of this repository's sessions

Reading for roadmap `road-to-placeholders-on-the-wire`, step 1.3. Every figure
below is a count. No detected value, fragment, length or digest was printed,
copied or written at any point.

## Window

One release cycle: every transcript event timestamped at or after tag 16.5.0
(2026-10-12 12:34:40 +0200) up to the reading on 2026-10-20. Filtering is per
event (the line's `timestamp`), not per file modification time. Tool calls made
before the window were still indexed, so a result inside the window could be
matched to its call.

## Corpus

| Item | Count |
|---|---|
| Transcript directories matching this repository's prefix (main checkout plus `--claude-worktrees-*`; no sibling `-lane-*` checkout directory existed; `-private-tmp-*` excluded) | 4 |
| Directories with at least one in-window transcript | 3 |
| Transcript files in total | 903 |
| Transcript files with at least one in-window event | 344 |
| — main sessions | 32 |
| — subagent transcripts (`subagents/` directories) | 312 |
| Envelopes replayed | 90,097 |
| Unparsable JSONL lines skipped | 53 |

The reading's own session was live while it ran, so the envelope total moves by
a few dozen between runs; the hit counts did not move.

## Method

- **Replay, not live hooks.** These are transcripts converted after the fact
  into the envelopes the dispatcher would have received. No hook ran, and the
  observation file was not written.
- **Transcript → envelope.** An assistant `tool_use` block became a
  `PreToolUse` envelope (`tool_name`, `tool_input`). A user `tool_result` block
  became a `PostToolUse` envelope (`tool_name`, `tool_input` of the matched
  call, `tool_response`), where `tool_response` is the line's structured
  `toolUseResult` when the line carries exactly one result, and the block's
  `content` otherwise. An `is_error` result became `PostToolUseFailure` with the
  text under `error`, matching the binding the stage lists among the result
  keys. A user line with string or text-block content and no tool result became
  `UserPromptSubmit` (`prompt`) in main sessions only; `isMeta` lines were
  skipped. Subagent transcripts contribute no prompt envelopes, because the
  subagent's opening prompt already appears in the parent's `Agent`
  `tool_input`.
- **Envelope shape.** `{ platform: "claude", event, workspace_root, payload }`.
  Field keys are those of `FIELD_KEYS` in `src/scripts/hooks/egress_stage.ts`:
  prompt = `prompt`/`userPrompt`, input and result = `BODY_KEYS` from
  `src/scripts/hooks/payload_stub.ts`.
- **Stage and engine.** `countEnvelope(envelope, engine)` from
  `src/scripts/hooks/egress_stage.ts`, with the engine from
  `loadEgressEngine()` in `src/scripts/hooks/egress_engine_loader.ts`, which
  loaded from source (`src/scripts/_lib/egress_engine.ts`) as `ok`. Mode is
  `observe`: detection plus the extent proof, nothing replaced. This is the
  function the stage calls in that mode. Run from a
  checkout of `main@efa1cca33` with the 6.1 branch's commits on top, none of
  which touches detection.
- The replay script and its raw aggregate were a local one-off and are not
  committed: the transcripts they read live outside this tree. The steps above
  are the whole method, and only a machine holding those transcripts can re-run
  them; nobody else can reproduce these counts from the repository.
  (Corrected 2026-10-22, release finding `570666e20b2f`: this read "re-running
  them over the same window reproduces the counts", a reproducibility claim the
  uncommitted script and machine-local transcripts cannot back.)

## Rule table at reading time

18 rules, all class `credential`: anthropic-api-key, anthropic-project-key,
aws-access-key, google-api-key, github-pat, github-fine-grained-pat,
openai-api-key, google-oauth-token, github-app-token, xai-api-key,
perplexity-api-key, groq-api-key, jwt, stripe-secret-key, slack-token,
pem-private-key, db-connection-uri, generic-assignment. **No identifier rules
have shipped yet**, so these readings say nothing about identifier traffic.

## Envelopes per event

| Event | Main sessions | Subagents | Total |
|---|---|---|---|
| PreToolUse | 6,911 | 37,802 | 44,713 |
| PostToolUse | 6,803 | 36,627 | 43,430 |
| PostToolUseFailure | 108 | 1,170 | 1,278 |
| UserPromptSubmit | 676 | — | 676 |

## Counts by field × class × type (spans)

| Field | Class | Type | Count |
|---|---|---|---|
| result | credential | DBURI | 60 |
| result | credential | APIKEY | 44 |
| result | credential | SECRET | 40 |
| result | credential | TOKEN | 30 |
| result | credential | PRIVATEKEY | 12 |
| input | credential | DBURI | 28 |
| input | credential | APIKEY | 12 |
| input | credential | PRIVATEKEY | 8 |
| input | credential | SECRET | 6 |
| input | credential | TOKEN | 2 |
| prompt | — | — | 0 |

Totals: result 186 spans, input 56 spans, prompt 0.

## Refusals (no provable extent) by field × rule

| Field | Rule | Count |
|---|---|---|
| result | pem-private-key | 19 |
| input | pem-private-key | 6 |

## Envelopes and sessions with a hit

| Item | Count |
|---|---|
| Envelopes with a result-field count or refusal | 60 |
| Envelopes with an input-field count or refusal | 42 |
| Sessions (transcripts) with at least one hit | 19 of 344 |
| — of which main sessions | 2 of 32 |

The envelopes with a hit, split by whether the call's path or command names a
test, fixture, or the egress/redaction code itself (a check on the path and
command, not on any value):

| Field | Test / detector context | Other | Session kind |
|---|---|---|---|
| result | 36 | 21 | subagent |
| result | 0 | 3 | main |
| input | 36 | 6 | subagent |
| input | 0 | 0 | main |

Most hits come from subagents working on this repository's own detector and its
fixtures. The repository builds a credential detector, so its sessions carry
synthetic credential-shaped test strings. Counts cannot tell those apart from
live credentials, and by design this reading never looked at a value.

## Result-field hits by tool

| Tool | Spans | Envelopes with ≥1 count | Envelopes with a refusal |
|---|---|---|---|
| Bash | 157 | 37 | 15 |
| Write | 21 | 10 | 1 |
| Edit | 6 | 6 | 1 |
| Read | 2 | 1 | 0 |

## `tool_response` shape on result-field hits (keys and types only, for 3.1)

| Tool | Shape | Envelopes |
|---|---|---|
| Bash | object {interrupted: boolean, isImage: boolean, noOutputExpected: boolean, stderr: string, stdout: string} | 25 |
| Bash | object {bashEditDiff: object, interrupted, isImage, noOutputExpected, stderr: string, stdout: string} | 12 |
| Write | object {content: string, filePath: string, originalFile: null, structuredPatch: array, type: string, userModified: boolean} | 9 |
| Write | same, with originalFile: string | 1 |
| Edit | object {contentNotInModelContext: boolean, filePath: string, newString: string, oldString: string, originalFile: string, replaceAll: boolean, structuredPatch: array, userModified: boolean} | 6 |
| Read | object {file: object, type: string} | 1 |

Across all PostToolUse envelopes, `tool_response` is overwhelmingly an object.
For example, Bash has 37,073 object responses against 1,225 string responses,
and the strings are the error and fallback path. A result-side replacement
therefore has to walk nested objects, which `buildPlaceholderEnvelope`'s
deep replace already does. Write and Edit responses echo the agent's own input
(`content`, `oldString`/`newString`, `originalFile`, `structuredPatch`), so a
result-field hit on those tools is mostly the same text already counted on the
input side.

## Limits

- The rule table is credential-only. Identifier rules are not shipped, so
  identifier exposure is not measured.
- This is a replay of stored transcripts, not live hook traffic. Stored tool
  output may already be host-truncated or summarised, and the transcript's
  `toolUseResult` is assumed to match the hook's `tool_response`. That is
  close, but not proven byte-identical.
- Subagent transcripts are **included**: hooks fire for subagent tool calls,
  and they make up 312 of 344 transcripts and about 84% of envelopes. They are
  excluded only from prompt envelopes.
- Hits are spans, not distinct secrets. The same string seen in several fields
  or turns is counted each time.
- The test/detector-context split is a path and command heuristic, not a
  classification of the values.
- One reading of one repository over one release. Its sessions are dominated by
  work on the detector itself, which inflates hits relative to an ordinary
  consumer repository.

## Bearing on step 3.1 (replacement in protect)

Over this release, protect mode would have replaced 186 credential spans across
54 result-field envelopes (Bash 37, Write 10, Edit 6, Read 1). It would have
withheld 17 result envelopes whole on a pem-private-key refusal. Only 3 of the
hit envelopes came from main sessions. The rest came from subagents, mostly in
test or detector context. The readings show that result-side replacement has
real traffic to act on, and that it must handle object-shaped responses. They
do not show live-credential exposure, so they support arming 3.1 on mechanism
grounds, not on a demonstrated-leak basis.
