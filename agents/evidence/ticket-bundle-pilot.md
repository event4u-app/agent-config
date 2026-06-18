# Ticket-bundle pilot — evidence

Evidence for `road-to-ticket-bundles` Phase 1 (T-008 build-pilot, T-001 transport-spike).

## Phase 1a — build pilot (the GATE) · PASSED

**Premise tested:** a `lite`-tier (Haiku-class) agent can build a `lite` ticket
from the ticket alone, without re-deriving the repo.

**Setup:** a Haiku subagent was given ONLY `T-004-build-export-generator.md`
(the ticket) + `src/scripts/build_linear_digest.ts` (the named sibling pattern),
and told to write `build_ticket_export.py`. No roadmap, no repo tour.

**Result (independently re-verified by the orchestrator):**

| Check | Outcome |
|---|---|
| Built the artifact from the ticket alone | ✅ `build_ticket_export.py` |
| Stayed inside `boundaries.must_touch` | ✅ only that one file changed |
| Met runnable acceptance (`--dry-run` exit 0, create/skip per ticket) | ✅ exit 0, 8 lines |
| Missing-token handling in live mode | ✅ clean error |
| Pure stdlib + yaml (no stray deps) | ✅ |

**Qualitative gate verdict:** PASS. One `lite` ticket, one fresh cheap agent,
clean build from the ticket alone — the expensive-plan / cheap-build premise
holds. No format gap surfaced. (Sample is small by design; the gate is
qualitative per ADR-101 — every failure must root-cause to a fixable format
gap, and none occurred.)

**Format-hardening note:** the buildability lint itself caught a real
inconsistency during this phase — `assets: none` (scalar) vs the array schema —
which was fixed (schema accepts array or `"none"`; lint normalises). The gate
working *on its own authors* is corroborating evidence.

## Phase 1b — transport spike · BLOCKED (no Linear token in this environment)

No `~/.event4u/agent-config/linear.key` and no `LINEAR_API_KEY`/`LINEAR_API_TOKEN`
env in this environment, so the live GraphQL round-trip could not be exercised.

**What is settled without a live run (design, not vibe):**
- **Idempotency** is query/map-first via `manifest.linear_state.linear_id`
  (Linear has no documented external-key upsert) — the exporter implements this
  and its `--dry-run` proves the create/skip decision per ticket.
- **CSV** is non-idempotent (official importer is create-only) → bootstrap only.
- **Images:** public-repo raw URLs are auto-ingested by Linear into auth-gated
  storage; only the private-repo case needs the API upload path.

**Still requires a real token (out-of-session):**
- Confirm `issueCreate` exposes no settable external key (→ the map is the sole
  idempotency key).
- Exercise the resumable mid-batch partial-failure path against a scratch team.
- Confirm the private-repo image-upload path end to end.

These keep Phase 5 *live* verification open; the generator code + `--dry-run`
are done and verified offline.
