# Tier-1 audit (pass 2) — Phase 4 of `road-to-corpus-expansion-evidence-based-cuts`

**Generated:** 2026-05-29 · Phase 4.
**Inputs:**
- `widened-corpus-diff-2026-05-29.md` — the corpus-expansion outcome (20 → 11 never-matched).
- `corpus-surface-inventory-2026-05-29.md` — the addressable / state-bound classification.
- `latest.json` — the telemetry replay with intended-vs-observed + unintended_activations.

## Audit reduction

The pass-1 audit (`tier1-audit-2026-05-28.md`) had 20 never-matched
candidates and no structural evidence — every verdict was inference.
After Phase 3's widened corpus, the candidate set reduces as follows:

| Class | Count | Auto-verdict | Reason |
|---|---:|---|---|
| State-bound (Phase 1 pre-classification) | 5 | **auto-keep** | Corpus-unreachable by construction — fixture-feasibility recorded in Phase 1. |
| Intent-only triggers (NEW from Phase 3) | 5 | **auto-keep** | Router-telemetry replay cannot exercise `intent:` triggers; the rules activate at agent-deliberation time, not router-match time. |
| Single audit candidate | 1 | needs defence | `artifact-engagement-recording` — 0 activations despite having a keyword + 2 phrase triggers. |

The 23 tier-1 rules that did activate are auto-kept (any activation
in the widened corpus = `keep`).

## Per-candidate defence

### `artifact-engagement-recording` — `keep`

**Triggers:** `phrase: /implement-ticket`, `phrase: /work`, `keyword: telemetry`.

**Why it didn't fire:** the corpus author rewrote `slash-commands-03`
during Phase 3 corpus authoring to use `/commit` instead of
`/implement-ticket` (because `slash-command-routing-policy`'s
trigger set was the better fit for that task slot). The rule's
intended trigger surface (`/implement-ticket` / `/work` / `telemetry`)
is not tested by any current corpus prompt.

**Defence:** the rule has `routes_to: [contract:artifact-engagement-flow]`
and is actively cited by both `/implement-ticket` and `/work`
engine flows in `.agent-src/commands/`. It is load-bearing
infrastructure for the engine-step telemetry pipeline. Demoting it
to tier-2 would mean the engine flow has to grep for it instead of
trigger-loading it — strictly worse.

**Verdict:** `keep`. A future corpus extension covering the
`/implement-ticket` flow would activate this rule trivially. Not a
candidate for this pass.

## Body-size × activation pareto (Pass B input)

Per the tightened Council R3 thresholds: a rule qualifies as a
Pass B kernel-body-refactor candidate when **ALL THREE** hold:
`body > 3 000 chars` AND `absolute_activations < 3` AND
`activation_rate < 30 % of addressable_tasks`.

| Rule | chars | addressable | activations | rate | Pass B? |
|---|---:|---:|---:|---:|---|
| `autonomous-execution` | 7 705 | 0 | 0 | n/a | flagged — but state-bound (wrong lens) |
| `no-roadmap-references` | 6 427 | 1 | 4 | 400 % | no — high activation rate |
| `context-hygiene` | 5 714 | 0 | 0 | n/a | flagged — but state-bound (wrong lens) |
| `architecture` | 5 503 | 0 | 4 | n/a | no — 4 unintended activations show it works |
| `no-decorative-emojis-in-git-surfaces` | 4 262 | 3 | 0 | 0 % | flagged — but intent-only (wrong lens) |
| `roadmap-progress-sync` | 4 151 | 3 | 4 | 133 % | no |
| `telegraph-speak` | 3 458 | 1 | 0 | 0 % | flagged — but intent-only (wrong lens) |
| `augment-source-of-truth` | 3 205 | 4 | 2 | 50 % | no |
| _(others)_ | < 3 000 | … | … | … | n/a (body too small) |

**Pareto raw flag: 4 candidates.** Three are state-bound
(`autonomous-execution`, `context-hygiene`) or intent-only
(`no-decorative-emojis-in-git-surfaces`, `telegraph-speak`) and
their non-activation is a structural property of how router replay
works — NOT a signal that their bodies are bloated for their
actual runtime cost. The pareto correctly catches them but they
are not the right targets for kernel-body-refactor work.

**True Pass B candidate set: zero.** Every flagged rule has a
documented structural reason for low replay-activation that does
not correspond to actual underutilisation at runtime.

## Cut decision

**0 demotes, 0 deletes.** Same outcome as pass-1, but for a
fundamentally different reason: pass-1 closed with zero cuts because
the corpus was blind. Pass-2 closes with zero cuts because the
widened corpus **proved every tier-1 rule has structural reason to
exist** — either it activates (the 9 newly-activated + 13 pre-existing),
is state-bound (5), or is intent-only (5).

The Pass B (kernel-body refactor) deferral is preserved: it remains
unopened because no candidate qualifies under the tightened
thresholds, and the 4 raw-pareto flags are false-positives caused by
the structural-unreachability dimension that the pareto does not
encode.

## Survivor set

23 tier-1 rules survive, unchanged from pre-pass-2. The audit's
value this pass is the **structural categorisation** — future audits
no longer need to debate why these 10 never fire (5 state-bound +
5 intent-only); they have permanent classification.

## Next steps (deferred to a future roadmap)

1. **If we ever want to cut intent-only rules' tokens**, the path is
   not router-replay audit — it's a static body-size analysis +
   council debate on whether the intent-only trigger semantics
   justify the body. Different roadmap, different tools.
2. **State-fixture feasibility scan** from Phase 1 (2/5 rules
   feasible) is the input for a possible "extend telemetry with
   first-turn + turn-count fixtures" roadmap — would unlock auditing
   for `onboarding-gate` + `context-hygiene` but the audit dev cost
   exceeds the likely token cut.
3. **Pass B kernel-body refactor** remains closed; reopen when a
   tier-1 rule both activates frequently AND has a body that exceeds
   the kernel budget — current state has neither.
