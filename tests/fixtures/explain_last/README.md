# `explain last` fixtures

Synthetic `.work-state.json` payloads consumed by
`tests/cli/explain_last/`. Each file pins one branch of the
`build_trace` decision tree so the test surface stays small and
deterministic.

| File | Branch under test |
|---|---|
| `work-state.success.json` | Happy path — every Phase-2 slot populated (inputs, route, memory, assumptions, pack). |
| `work-state.halt-hook.json` | Engine halted inside `verify`; `trace.halt` populates from `state.halts[-1]`. |
| `work-state.council-attached.json` | Council session sidecar (`council-attached/council-responses.json`) sits next to the state file so `trace.council` populates. |
| `work-state.video-from-script.json` | `directive_set: video` plus `video_provider` envelope; exercises the Phase-3 provider slot. |
| `work-state.no-memory.json` | `state.memory` empty and no `.agent-memory/hits.jsonl` sidecar — `trace.memory` resolves to `null`, renderer prints `(none)` (no `[]` bug). |

All fixtures are version-`1` payloads. They never carry real PII so
the scrubber is exercised by separate unit tests under
`tests/cli/explain_last/test_scrubber.py` rather than here.
