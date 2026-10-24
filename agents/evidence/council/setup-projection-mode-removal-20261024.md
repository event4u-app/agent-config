<!-- evidence-type: analysis -->

# ROUTED TO THE OWNER 2/2 — removing `projection.mode` (step 4.7)

**Date:** 2026-10-24 · **Members:** `anthropic`, `openai` · **Present: 2 of 2** · two rounds, blind
chairman, CLI, $0.00 · **Prompt:** `setup-projection-mode-removal-20261024.question.md` beside this file.

Step 4.7's precondition holds (ADR-289 point 4; `second-host-unlisted-reachability` resolved;
`doctor --check skill-reach` → `unreachable 0` on claude-code and codex). What it would remove does
not qualify for an agent lane.

| Point | `anthropic` | `openai` |
|---|---|---|
| Default-neutral? | no — upgraded installs without the key and `use --profile=legacy-all` users rely on the full surface, which non-listing hosts would lose | no — `legacy-all` consumers can lose the full surface, fresh claude installs gain skills |
| Release class | major; the `use --profile=legacy-all` command changing meaning is on ADR-300's major list on its own | major as written; a minor only with a durable non-settings full/scoped control that preserves `legacy-all` and the command on every host — a tombstone plus one-window read does not suffice |
| Routing | **owner-reserved** — it removes a documented full-surface compatibility control | **owner-reserved** — evidence measures the change, it cannot authorise it |

Not implemented. The question for the owner, merged from both seats:

1. Remove `projection.mode` in the next major and retire the full-surface guarantee on hosts without a
   listing lever (the `legacy-all` profile command is removed or redefined).
2. Remove it in a minor only together with an automatic, durable non-settings full/scoped control that
   keeps `legacy-all` behaviour and the command on every supported host.
3. Keep `projection.mode` until an equivalent host-independent control exists (AC-1 keeps naming it).

The anthropic seat recommended 1; the openai seat named the three options without a preference.
