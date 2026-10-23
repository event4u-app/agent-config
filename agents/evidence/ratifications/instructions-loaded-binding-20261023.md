---
proposed_by: road-to-a-setup-that-decides-itself step 1.1 (blocker instructions-loaded-binding-needs-a-ratification-quorum, option a)
implemented_by: claude-opus-5.5 session on feat/instructions-loaded-binding
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 4 of 2026-10-23
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 4d39f1cd616dc4503b19d6c9fb16d6fe8ea03da4081bf433ecc89827e220e95c
---

<!-- evidence-type: ratification -->

# Ratification — binding the InstructionsLoaded observer

`check_kernel_edit_ratified` gates five hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/config/hook-token-budget.json`,
`src/scripts/hook_manifest.yaml`, its compiled projection `src/scripts/hook_manifest.json`, and
`src/scripts/hooks/dispatch_hook.ts`. The `subject:` digest covers all five, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `339b3062cc`.

## What was ratified

- `instructions_loaded` joins the dispatcher's event vocabulary and its three mirrors (manifest
  linter, collector enum, journal recorded-set); the native `InstructionsLoaded` is aliased to it
  on `claude` alone; the existing observe-only concern `instructions-observer` is bound to it.
- The concern loads from its own chunk through `LAZY_CONCERNS` (11,097 B, ceiling 12,000) and now
  carries a CLI entry, without which the spawn fallback ran it as a script that did nothing.
- `max_bytes` 1,550,000 → 1,550,500 with a `raise_log` entry: the binding adds 237 B against 51 B
  of headroom. Council decision D8 asked for room before a raise; the room-first route was
  measured — `session-eol` into a chunk frees 29,948 B but loads a 259,330-B chunk on every
  `stop` — and both seats judged the raise the acceptable resolution.
- One historical sentence in `hook-token-budget.json` stops naming the removed
  `lean_projection.mode` key; no number changed.

The change expands observation, not authority: the concern is `fail_closed: false`, emits
nothing to the model, exits 0 on every path, and has a kill switch
(`AGENT_CONFIG_INSTRUCTIONS_OBSERVER=off`). Both seats said so in every round.

## How it got here

Four rounds over the same change, CLI subscription transport, USD 0.00. Prompts committed
verbatim: `agents/evidence/council/instructions-loaded-binding-ratification-r1-20261023.question.md`
through `…-r4-20261023.question.md`.

- **Round 1, both refused** on evidence: two budget texts contradicting the raise, an observer
  header claiming the binding adds nothing, no test of the built path, and an unexplained
  `RECORDED_EVENTS` entry. All fixed. The built-path test then exposed the missing CLI entry.
- **Round 2, both refused** on one point: the built-bundle suite's shared `beforeAll` ran on
  Windows before the per-case skips. The skip moved to the suite.
- **Round 3, both refused** on one point: the temporary output path was interpolated unquoted
  into `/bin/sh -c`. It is now single-quoted; checked under a `TMPDIR` holding a space, an
  apostrophe and `$x`, where the cases that do not start `tsx` pass (cases that do fail there,
  as does an unrelated suite on the base — a `tsx` limitation outside this change).
- **Round 4, both seats ratified,** with no further finding. One seat named a residual
  integration gap: no test fires the registration through an installed Claude host. That is
  what step 2.1's arrival record measures from real sessions.

After round 4 the branch was merged with `origin/main` (no overlap with the gated files) and a
post-merge regeneration reordered `hooks/hooks.json` into matrix order, with no change in
content. The bundle then read 1,550,144 B of 1,550,500.

## Seat answers

The raw responses are gitignored and pruned after the retention window, so each is pinned here
by its SHA-256.

| Round | Response file (`agents/runtime/council/responses/`) | SHA-256 |
|---|---|---|
| 1 | `instructions-loaded-binding-ratification-r1-20261023.md` | `0bac52709ea5a08fd597e7432e875aae5c6021ac7a1bd1242848e5b75b5827fc` |
| 2 | `instructions-loaded-binding-ratification-r2-20261023.md` | `ded494d445206275b624bdc8ee3063c544119c426a2d9a7ebe15336ed3d66494` |
| 3 | `instructions-loaded-binding-ratification-r3-20261023.md` | `0aa885d681fab847f362fcc0665b069e84411791f6173d0b04ee88087ebfc95e` |
| 4 | `instructions-loaded-binding-ratification-r4-20261023.md` | `999f8680675698cedcddaa8ecaf3b8a1c2fe688a6013a87ceba4d708d151f939` |
