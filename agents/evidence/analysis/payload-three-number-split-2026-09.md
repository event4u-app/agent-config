<!-- evidence-type: analysis -->

# The payload metric, split into the three things it measures

Phase 3 of `agents/roadmaps/road-to-the-delivery-flip-that-tells-the-truth.md` — the
three labelled numbers (3.1), the untouched ceiling (3.2), and the activation charge
published beside the saving (3.3).

Measured 2026-09-12 on branch `drain/delivery-flip`. Every figure below was taken on
this tree by the command named beside it; none is inherited from an earlier record,
and one figure the roadmap offered for reuse is refuted below.

## The three numbers

| # | Label | Unit | Denominator | Value at this HEAD | Gated? |
|---|---|---|---|---:|---|
| 1 | `source_corpus` — what the source tree could deliver | chars/4 tok | per session | 138,360 total · 122,769 in the rules bucket | **yes** |
| 2 | `host_payload` — what one host actually receives at rest | chars/4 tok | per session | 24,537 on a thinned host · unchanged on every other | no |
| 3 | `activation_payload` — what a trigger match charges | bytes | per fire | p50 6,728 · p90 14,016 · max 16,297 | no |

They are three quantities, not three views of one. Numbers 1 and 2 share a unit and a
denominator and still differ by 5.0x after the flip; number 3 shares neither with
either of them and is never summed into them.

**Two of the three already had names.** ADR-270 (2026-09-09) separated `source_corpus`
from `host_payload` and gave `check_preamble_payload_budget` a `measurement_scope`
field, because "until the two are named apart, every ceiling discussion risks comparing
unlike quantities". This phase adds the third to the same report under the same rule
rather than opening a second one.

## Where each number is taken, and how

### 1. Source corpus — 138,360 tok

```
./scripts-run src/scripts/check_preamble_payload_budget
```

The no-argument reading, unchanged by this phase. Three buckets: project-scope rules
122,769 tok, preloaded skills catalog 14,845 tok, CLAUDE.md hierarchy 746 tok. Its
subject is `dist/agent-src/rules` — the projection **source**, which is what the
ratchet governs and what a change may or may not grow.

### 2. Host payload — 24,537 tok on a thinned host

```
./scripts-run src/scripts/project_thin_rules --out <tmp>
./scripts-run src/scripts/check_preamble_payload_budget --project-rules-dir <tmp>
```

The projector writes the tree a `claude-code` consumer receives under the shipped
template pair (`lean_projection.mode: delivery`, `hosts: [claude-code]` —
`src/config/agent-settings.template.yml:212-214`), and the gate measures it through the
same bucket definition it uses for number 1. 119 files on both sides, so the pair is
like-for-like: **122,769 → 24,537 tok, a reduction of 98,232 tok (80.0 %)**.

A host outside `lean_projection.hosts` receives what `eager-all` writes, byte-for-byte —
asserted per PR by `check_host_tree_parity`, not assumed here — so for every such host
number 2 equals number 1 over the same file set and the reduction above is zero. That is
the whole reason this number is per host rather than one figure.

Cross-checked a second way, through the projector's own `is_thin_entry` rather than
through the gate: 114 non-`manual` files, 96,730 B = 24,183 tok, 98 of 114 thinned. The
354-token gap between the two readings is the five ADR-004 `type: manual` rules, which
`build_thin` emits and no per-tool tree receives.

**This repository's own `--host claude-code` reading is 6,597 tok and is NOT this
number.** The gate says so itself with its `PARTIAL TREE` diagnostic: a maintainer
checkout carries 13 rule files against 119 in the source, because a project rule that is
byte-identical to a user-scope twin is skipped at install. The `--project-rules-dir`
route above is the reproducible one, and it is the route the gate's own diagnostic
names.

### 3. Activation payload — p50 6,728 B / p90 14,016 B / max 16,297 B

```
./scripts-run src/scripts/check_preamble_payload_budget
```

Printed by the same run as number 1, from `_lib/activation_payload.ts`. Gate-open
per-fire emission of the `rule-inject` concern over the frozen
`tests/eval/routing-matrix` positives, measured through the same `matchTierRules` +
`selectForInjection` the runtime concern calls, at the concern's own `CAP_BYTES`
(16,384 B).

| Slot | Fires | p50 B | p90 B | max B |
|---|---:|---:|---:|---:|
| `user_prompt_submit` | 318 | 6,728 | 14,016 | 16,297 |
| `pre_tool_use` | 32 | 6,657 | 14,081 | 14,924 |
| `pre_compact` | 0 | 0 | 0 | 0 |

`pre_tool_use` is measured but **not bound** — owner ruling E2 removed that binding, so
its row prices a mechanism the shipped configuration does not fire. `pre_compact` is 0
by construction, not by measurement: that branch clears the seen-set and returns without
writing to stdout.

## The figure the roadmap offered for reuse is stale

Phase 2 handed forward "a path-hit p90 of 16,188 B". It was verified rather than
inherited, and it no longer holds.

16,188 B is the p90 recorded in `src/config/hook-token-budget.json:40` as the derivation
of the `user_prompt_submit` slot cap, measured over 318 gate-open fires **before** the
concern's `CAP_BYTES` was lowered 20,480 → 16,384 B on 2026-09-08. The same sample at
this HEAD gives **p90 14,016 B and max 16,297 B** — same corpus, same 318 fires, same
selection path, so the two are directly comparable and the drop is the lowering's effect.

The budget file's `rule-inject` row already records a post-lowering reading (p90 14,507,
max 16,348) that differs again, and the reason is the denominator: that one was taken
over **330** fires "with the command path included", while this sampler reads only
`- prompt:` positives. Neither number is wrong; they are two samples of two sets, which
is the same confusion one layer down that this phase exists to stop. Reported rather than
edited — `hook-token-budget.json` is a registered budget, and moving a derivation figure
in it is a deliberate act with an owner, not a side effect of a reporting change.

**A limit of the sampler, stated:** `readCorpusPositives` reads `- prompt:` entries and
silently skips `- command:` entries, so every figure in this section is prompt-path only.
It is the same reader the shipped slot cap was derived from, so the comparison above
holds; a command-inclusive distribution would be a different measurement.

## What was not touched

`src/config/preamble-payload-budget.json` is byte-identical. The grace ceiling is the
estate-growth ratchet and may only walk down; this phase adds reporting and registers no
second gate. Proof:

```
$ git diff src/config/preamble-payload-budget.json
$
```

The activation reading is informational on the same terms ADR-270 set for the host
reading: it never reaches the exit code, and the gate's source verdict is byte-identical
across a run that takes it — asserted in
`tests/scripts/activation_payload.test.ts`, which also pins that the gated total equals
the source reading alone, so folding the fire distribution into it would turn that case
red.

The activation charge is not ungoverned for lack of a gate here: its ceiling is already
registered in `src/config/hook-token-budget.json`
(`per_slot_sum_caps_bytes.user_prompt_submit` and the `rule-inject` concern row).
Enforcing it a second time in the payload gate would put one obligation behind two gates
that can disagree.

## Two readings that publish number 1 in a per-host column

Neither is a defect, and both are worth knowing about while the flip's divergence is
5.0x.

- `agents/evidence/analysis/standing-payload-by-host-2026-09.md` and the generated host
  cost table in `docs/contracts/rule-router.md` publish the **source** corpus in a
  per-host row. That is ADR-270 decision 5 acting as intended: the published figure is
  the upper bound an unscoped, un-deduplicated install loads, and the artifact's own
  prose says so. The prose carries the label while the column carries the number, so a
  reader who skims the table alone now reads a `claude-code` row five times the delivered
  figure.
- `src/scripts/_lib/value_ladder.ts:477-478` emits "Available behind
  `lean_projection.mode=thin` (default `eager-all` — hence NOT in the default NET)" into
  the generated `docs/value.md`. The statement is false since ADR-267
  and Phase 1.3 of this roadmap found it and refused it deliberately — it sits on an
  executable template-literal line and Phase 1's acceptance criterion was that no
  executable line change. It remains open, and it is Phase 1's item rather than this
  one's.

## What this artifact does not establish

- **No consumer install was measured.** Number 2 is the projector's output for a
  consumer-shaped root, taken on this machine; no `claude-code` install was inspected.
- **No host was probed.** Whether a host READS what it is handed is the axis
  `docs/enforcement-by-host.md` owns, and nothing here touches it.
- **The activation figures are a corpus reading, not session telemetry.** They price the
  frozen routing-matrix positives, which is the set every registered fire-size row in
  this repository is derived from — not the distribution of real prompts.
