---
proposed_by: owner/decision-D12-2026-10-06
implemented_by: claude-opus-5.5/drain-neighbours-pull-weight-20261006c
reviewed_by: council/anthropic+openai-2026-10-06-mcp-usage-observation
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the `mcp-usage-observation` hook-manifest edit

Closes the `mcp-recorder-unreachable-behind-the-tools-filter` blocker of
`road-to-neighbours-that-pull-their-weight` (step 3.3). The owner chose option 3
on 2026-10-06 (decision D12); this record is the independent review of the
manifest edit that implements it, which D12 and ADR-268 § 4 both require.

## What is ratified

- `src/scripts/hook_manifest.yaml` / `.json` — a new concern
  `mcp-usage-observation` (`severity: advisory`, `fail_closed: false`,
  `effect: telemetry`, no `tools:` key, no `needs_payload_bodies`), bound on the
  six `post_tool_use` rows that bind `telemetry-usage`.
- `src/scripts/hooks/mcp_usage_observation_hook.ts` — writes
  `{ "mcp__<server>__<tool>": "<UTC day>" }` to gitignored
  `agents/runtime/neighbour-tool-use.json`; exit 0 always, prints nothing.
- The recorder branch removed from `telemetry_usage_hook.ts`; that concern's
  `tools: [Skill]` filter is unchanged.

**Why `ratified` and not `confirmed-non-expanding`:** both 2026-10-02 seats and
both 2026-10-06 seats agree the change IS authority-expanding — a default-on
collector that bypasses the telemetry opt-in. The label says so.

## The review

`./scripts-run src/scripts/council_cli run agents/runtime/council/questions/mcp-usage-observation-ratification.md --prompt-mode pr --confirm --invocation agent`,
2026-10-06, two seats (anthropic, openai), subscription transport, $0.00 billed.
The prompt asked for a verdict from the closed vocabulary and for findings, and
stated no expected outcome; it inlined the manifest, hook and telemetry-hook
delta and named the branch for the rest.

- **anthropic** — `ratified`: "Both council conditions are explicitly satisfied
  … No blocking code defects identified."
- **openai** — `ratified`: "The expansion is explicit, separately named,
  fail-open, body-reduced, local-only, and its sink is structurally restricted
  to tool-name/day entries."

Non-split. Both seats' 2026-10-02 conditions are met: the concern's own header
and its manifest comment state that it is default-on and bypasses the telemetry
opt-in, and `tests/hooks/mcp_usage_observation_hook.test.ts` proves the store
holds tool names only.

## Non-blocking findings, NOT applied in this change — recorded, not dropped

Both seats raised them as pre-merge polish, neither as a condition:

1. **Receive vs persist wording.** The manifest comment says the hook "receives
   the tool name and nothing it could leak". It receives the reduced envelope
   (including `cwd` and possibly a session id) and PERSISTS only the name and
   day. The wording should say persists.
2. **Name grammar and cardinality bound.** `mcpToolName` checks only the
   `mcp__` prefix; a length cap, the host's sanitised alphabet and a cap on
   distinct entries would enforce the "bounded by the tool surface" claim
   rather than trust it.
3. **`effect: telemetry` vs "nothing here is telemetry".** The manifest's
   category is local state recording; a qualifying clause would prevent the
   apparent contradiction.
4. **End-to-end dispatcher reduction.** One seat noted the names-only test
   feeds `run()` directly. Addressed in this change: a test now derives the
   keep-set from the SHIPPED entry with `_concern_body_classes`, stubs a marked
   envelope with `stubPayloadBodies`, and feeds the result to the hook.

Items 1-3 edit the hook manifest and the hook itself. The implementing session's
attempt to apply them was refused by its host's permission classifier as
self-modification, so they are left for an owner-run follow-up rather than
worked around. They change wording and harden input; none changes what the
council ratified.
