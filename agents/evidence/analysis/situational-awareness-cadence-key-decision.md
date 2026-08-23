# Decision — step 5.1 re-scoped: a derived refresh trigger, not a settings key

- **Roadmap:** `road-to-roadmap-situational-awareness`, step 5.1
- **Date:** 2026-08-23
- **Resolver:** agent, on the tree's own deterministic evidence. **The AI council
  was convened first and returned an honest null** — see below.
- **Confidence:** high on the lock, medium on the replacement design.

## The question

Step 5.1 asks for a `roadmap.context_refresh_cadence` settings key
(`phase_boundary` | `every_5_steps` | `per_step`, default `phase_boundary`). I
implemented it exactly as written — `src/config/agent-settings.template.yml`,
`src/server/schemas/settings.ts`, and an enum test — and all three went green.
`lint_settings_classes` then refused the change.

## The lock, and why mechanism-match does not get me out of it

`docs/contracts/settings-classes.md` classifies every settings leaf on a second,
orthogonal axis answering *should this key exist at all?* I classified the new key
`derivable` by direct analogy with the `roadmap.dashboard_regen_cadence` row
beside it. The gate then failed:

```
lint_settings_classes:derivable-surface: 84 violation(s) against a baseline of 83
 — 1 new. A ratchet only turns one way: fix the new violation(s). Raising the
baseline in src/config/gate-violation-baselines.json is a defect, not a fix.
```

`src/scripts/lint_settings_classes.ts:510-514` states the intent in as many
words: *"`derivable` is a deletion queue, so its size is a debt count and may
only fall: a NEW key classified `derivable` is a key that should not have been
added."*

The ratchet tested "new derivable settings keys". Step 5.1 proposes exactly a new
derivable settings key. **Same mechanism — the lock applies**, and looking for a
technicality would be the failure the revisit gate exists to prevent.

**The `derivable` label is honest, which is the load-bearing part.** The contract
requires a `derivable` row to name its replacement, and one exists: compare a
fingerprint of the reading the run already holds against a cheap fresh read, and
re-probe only when it moved. That is strictly better than any fixed beat — it
never misses a change inside a long phase, and never pays for a probe when
nothing moved. The contract is right about the design; the enum is the weaker one.

## The council returned an honest null

`./scripts-run src/scripts/council_cli run … --confirm --invocation agent`
(question: `agents/runtime/council/questions/situational-awareness-cadence-key.md`,
response: `agents/runtime/council/responses/situational-awareness-cadence-key.md`):

```
council:quorum · after the run · 0/2 present, needed 1 — INCONCLUSIVE
anthropic | cli_quota_exhausted | 53 / 50
openai    | cli_quota_exhausted | 50 / 50
verdict: {"status": "inconclusive", "threshold": 1, "total": 2, "present": 0}
```

Both members abstained on exhausted subscription quota, and `api_on_quota: off`
means no metered rung retried. **This is an abstention, not convergence**, and it
is recorded as one. Cost: $0.0000.

## Options considered

| # | Option | Verdict |
|---|---|---|
| A | Land the key; drain another `derivable` key or raise the baseline | **rejected** — raising the baseline is called a defect by the gate itself, and draining an unrelated key is scope creep on someone else's decision |
| B | Re-scope 5.1: no key; put the trigger in the mechanism | **adopted** |
| C | Classify the key `consent` or `policy` to clear the ratchet | **rejected as dishonest** — the key authorises nothing and carries no project-level fact, and the contract warns that "the direction of this axis pushes every borderline row toward" the convenient label |
| D | Descope 5.1 entirely into a stub | **rejected** — D2 is real and measured (`check_branch_freshness.ts` documents a 90-minute stale window that produced a `CONFLICTING` PR); dropping the whole trigger drops the value |

## What was built instead

`contextFingerprint()` in `src/scripts/roadmap_context.ts`, exposed as
`agent-config roadmap:context --fingerprint`. It hashes the `origin/main` SHA
**plus the sorted `(PR number, head SHA)` pairs**. The loop re-probes at a phase
boundary only when the fingerprint differs from the one it holds.

**Why not the `origin/main` SHA alone** — the obvious cheap trigger, and it
under-fires: a peer pushing to their own open PR branch mid-run adds a file that
may now overlap mine, and `origin/main` has not moved. The PR head SHAs are what
close that case, at the cost of one `gh pr list --json number,headRefOid` call.

This also collapses two steps into one mechanism: step 5.6 asks for a
`context_fingerprint` on the resume checkpoint, and it is the same value.

## What this costs, stated rather than implied

- A user who wants per-step freshness has **no knob**. The trigger fires on
  change, which is the behaviour the enum was approximating.
- The roadmap's honest-null path said "the cadence default drops to `off`". With
  no key, the null path is "delete the trigger" — a one-line revert of the loop
  edit, which is the same reversibility the setting bought.
- Step 5.1's stated verify line ("the settings schema test accepts the three
  values and rejects a fourth") is **not** the line discharged. The discharged
  line asserts the derived trigger. That substitution is the whole point of this
  memo.

## Revisit-if

A run is measured missing a mid-phase change that a fixed per-step beat would
have caught, **and** the fingerprint cannot be widened to cover it. Then the enum
becomes the right carrier and this memo is the record of what it costs — which
would also mean draining one existing `derivable` key to pay for it, deliberately
rather than by raising a baseline.
