---
adr: 092
status: accepted
date: 2026-06-13
decision: defer-command-tier-alias-removal
supersedes: —
superseded_by: —
phase: metadata-and-command-surface-leanness
type: structural
---

# ADR-092 — Defer the command `tier:` alias removal (close ADR-090 Option B as deferred-with-forcing-function)

## Status

**Accepted** · 2026-06-13. Decided by AI council (anthropic/claude-sonnet-4-5
+ openai/gpt-4o, peer-review, deep) — converged on **defer**, with a
forcing-function refinement: a defer without a re-open mechanism is
abandonment in disguise.

## Context

[ADR-090](ADR-090-visibility-command-frontmatter-field.md) made `visibility:`
the command-classifier source of truth and kept the integer `tier:` (`0/1/2`)
as a back-compat alias, **deferring** the alias removal ("Option B") "once
readers and the manifest have fully migrated". This ADR closes that deferred
question with the Phase-3 investigation evidence.

Investigation findings (`road-to-metadata-and-command-surface-leanness`, Phase 3):

- **Integer-`tier` readers are internal:** `src/cli/commands/commands.ts`
  (fallback after `visibility`), `src/scripts/audit_command_surface.py`
  (report column + budget fallback), `src/scripts/build_discovery_manifest.py`
  (**dual-emits `tier`** into the manifest). `src/cli/python/workspace_hosts.py`
  uses a semantically unrelated host-inventory tier.
- **The discovery manifest is a published npm artifact** — `package.json`
  `files` + `build:discovery` in `prepack` + `prepublishOnly:
  check_release_includes_discovery.py`. It dual-emits the integer `tier`.
  **External npm consumers that read the integer key are unknown.**
- The defer rests on a **Runtime Risk that cannot be ruled out** (a consumer
  may register/branch on the integer `tier`), not on evidence that such a
  consumer exists. Maximal caution by default.

## Decision

**Defer Option B.** Keep the `tier:` alias + the manifest dual-emit. Do not
remove `tier:` now: the published manifest's external consumers are unknown,
so the "unknown external consumers = hard stop" rule applies.

The defer is a **waypoint, not an end state** — it ships with a re-open
forcing function so it cannot calcify into permanent debt:

1. **Re-open mechanism (one of):**
   - **Versioned manifest** — publish `discovery-manifest` v2 *without* `tier`
     alongside v1; v1 header carries `deprecated: true` + a `sunset` date;
     after the soak window with no breakage reported, drop `tier`.
   - **Evidence of zero external integer-`tier` reads** (manifest-fetch
     telemetry / a documented "tier key deprecated" notice + soak).
2. **Time-boxed review** — re-evaluate at the next minor-release planning (or
   within 12 months, whichever is first), escalating to the maintainer with
   pre-committed options (build the v2 mechanism · proceed · keep deferred).
3. Execution of the removal itself is carried to
   `road-to-tier-removal.md` (blocked on the mechanism above), not this ADR.

### Rejected alternatives

- **Accept now — drop `tier:` immediately.** Breaks the published-manifest
  contract for unknown consumers with no migration window. Hard stop.
- **Record the defer in the evidence note only, no ADR.** The re-open trigger
  + escalation is *decision-level* content (who authorised the timeout, under
  what gate it proceeds), not evidence — it belongs in a decision record. The
  investigation evidence stays in
  `agents/settings/contexts/tier-visibility-and-merge-evidence.md`.

## Consequences

- The `tier:` ⇄ `visibility:` dual-field persists during the deferral;
  drift is mitigated by the `lint_command_tiers.py` consistency check (when
  both present, they must agree).
- The removal is **cheaply reversible** if ever executed: restoring the `tier`
  field is a manifest schema patch (< 1h to publish), far below the rollback
  cost of a runtime or DB change — but reversibility does not lift the
  unknown-consumer hard stop.
- `road-to-tier-removal.md` institutionalises the trigger so the defer stays
  visible in planning rather than becoming folklore.

## References

- [ADR-090](ADR-090-visibility-command-frontmatter-field.md) — the deferred
  Option B this ADR closes.
- `docs/contracts/command-surface-tiers.md` — tier/visibility contract.
- `agents/settings/contexts/tier-visibility-and-merge-evidence.md` —
  consumer-investigation evidence.
