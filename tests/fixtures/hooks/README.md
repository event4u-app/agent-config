# Hook fixture corpus

**Purpose.** Minimal, valid, platform-native payloads — one per event in
the agent-config event vocabulary
(see [`hook-architecture-v1`](../../../docs/contracts/hook-architecture-v1.md)).
Consumed by `./agent-config hooks:replay` (Phase 2.4b of
`agents/roadmaps/road-to-proof-not-features.md`) and by the dispatcher
replay tests (Phase 2.4c).

**Layout.** One file per event:

```
tests/fixtures/hooks/
  session_start.json     — augment-shaped startup envelope
  session_end.json       — augment-shaped end envelope
  user_prompt_submit.json — claude-shaped (augment has no native event)
  pre_tool_use.json      — claude-shaped (augment optional)
  post_tool_use.json     — augment-shaped tool-call envelope
  stop.json              — augment-shaped end-of-turn envelope
  pre_compact.json       — claude-shaped compaction envelope
  agent_error.json       — synthetic (dispatcher contract § Round 2 Q3)
```

Each fixture is a **stdin payload**, not a dispatcher envelope. The
dispatcher wraps the payload via `_build_envelope` before handing it
to a concern (see `scripts/hooks/dispatch_hook.py`).

## Schema invariants

Every fixture MUST:

1. Be valid JSON (`json.loads` round-trips).
2. Be an object at the top level (the dispatcher only wraps dicts).
3. Carry `session_id` (string, non-empty) so feedback writes land in a
   deterministic slot under `agents/state/.dispatcher/<session_id>/`.
4. Carry enough event-specific fields that real concerns
   (`chat-history`, `roadmap-progress`, `context-hygiene`,
   `verify-before-complete`, `minimal-safe-diff`) can run without
   raising — primarily `tool_name` (for `*_tool_use`) and `prompt` /
   `text` (for `user_prompt_submit`).
5. Carry **no** real user content. Use placeholder strings
   (`"hello"`, `"echo hi"`) — these files are committed; redaction is
   not enforced post-commit.

## Choosing the platform shape per event

Picked one representative shape per event (rather than N × M fixtures)
so the corpus stays small and the matching test grid stays readable.
Multi-platform shape coverage lives in
`tests/hooks/test_event_shape_contract.py` (frozen samples table).

| Event | Shape | Why |
|---|---|---|
| `session_start` | augment | augment ships in this repo's primary CI |
| `session_end` | augment | symmetry with `session_start` |
| `user_prompt_submit` | claude | augment has no native event for it |
| `pre_tool_use` | claude | optional on augment, native on claude |
| `post_tool_use` | augment | most-bound event, all platforms support |
| `stop` | augment | all platforms bind it (except copilot) |
| `pre_compact` | claude | claude-only event |
| `agent_error` | synthetic | dispatcher-defined; no native source |

## Usage

```bash
# Replay one fixture through the dispatcher (read-only, replay mode):
AGENT_CONFIG_REPLAY=1 \
  python3 scripts/hooks/dispatch_hook.py \
    --platform augment --event post_tool_use \
    < tests/fixtures/hooks/post_tool_use.json

# Or via the CLI subcommand (Phase 2.4b):
./agent-config hooks:replay \
  --platform augment --event post_tool_use \
  --payload tests/fixtures/hooks/post_tool_use.json
```

`AGENT_CONFIG_REPLAY=1` signals concerns to skip writes under
`agents/state/`. Concerns that don't honor the flag are listed by
`./agent-config hooks:doctor` as not replay-safe.

## When to update

- Vendor schema drift surfaces in `test_event_shape_contract.py` first
  (frozen samples table). When a sample changes, update the matching
  fixture here to keep the corpus aligned.
- New event added to `EVENT_VOCABULARY` in
  `scripts/hooks/dispatch_hook.py` → add a fixture here. The replay
  test (Phase 2.4c) asserts a 1:1 mapping between the vocabulary set
  and this directory.
- **Never** edit a fixture to make a failing test pass. The fixture is
  the contract; the test follows it.
