---
complexity: structural
status: ready
role: central
---

# Road to package renewal — central roadmap (2026-08)

> Commissioned re-analysis of the package at 9.13.0 with the explicit mandate to
> question every standing decision under 2026 conditions (strong hosts, native
> subagents/hooks/plugins, byte-exact projection). An 11-agent analysis pass
> (7 internal surface readers + 4 external reference deep-dives, tree-level
> evidence) produced the findings below; the load-bearing ones were re-verified
> by hand before this roadmap was written. Council convergence 2026-08-02
> (claude-sonnet-4-5 + gpt-4o): foundation-first ordering, central + focused
> sub-roadmaps, autonomous-loop default N=3 with a halt-on-spin tripwire, and
> hand-verification of damning findings before roadmap authoring (done).

## Goal

Cut the real session token cost, make CI a trustworthy fast oracle, modernize
execution flows toward native orchestration, and retire decision debt — in
PR-sized increments, each verified against a pre-registered measurement, with
this central roadmap steering three sub-roadmaps.

## Verified findings (hand-checked 2026-08-02, this is the evidence base)

1. **Routing is passive on Claude Code.** `dist/router.json` has no runtime
   consumer — every reader is a compiler/linter/bench (`compile_router.ts`,
   `trigger_coverage.ts`, `bench_ab_v2_run.ts`, …); no hook loads rule bodies
   on trigger. `condense.ts` symlinks ALL scoped tiers into `.claude/rules`;
   non-kernel bodies ≈80k GPT tokens are always-context. Verified: grep over
   `src/` shows zero hook/runtime consumers of `router.json`.
2. **CI oracle is broken in both directions.** 20+ `src/scripts/lint_*` /
   `check_*` gates still reference the deleted `.agent-src.uncondensed/` root
   (dir confirmed absent) — a scan of nothing exits green; `assertScanned`
   adoption is ~3/215 gate scripts. `task ci` runs ~200 sequential tsx
   subprocesses (405 `task:` refs in Taskfile.yml); `ci-strict` checks LESS
   than `ci` (6 gates missing); only ONE branch-protection check is actually
   required vs the documented matrix.
3. **Thin projection is built but unreachable.** `condense.ts:1046-1051` throws
   on `lean_projection.mode: thin` ("requires project_thin_rules (not ported)").
   `project_thin_rules --measure`: eager 85,880 → thin 15,106 GPT tokens.
4. **Work engine burns a CLI round-trip per step**; no flagship flow dispatches
   parallel subagents; the host projection lists every command twice (hyphen
   skill + colon command); ~1,900 lines of commands have no plausible
   invocation path (analysis ESTIMATE, not hand-reproduced — the enumeration
   with file list + method is the first action of any step consuming it).
5. **Decision debt.** ADR-068/070–084 encode the pre-native drive-loop era;
   ADR-085 is framed around the retired Python kernel; ADR-201's open question
   (dist/agent-src/ is now a byte-identical copy of src/) is unresolved; 6 ADRs
   perma-proposed; 164 src/ files reference the dead authoring tree.

## Locks honored (do not relitigate inside the sub-roadmaps)

- **Scope-dedup reachability — REFUSED (DR, 2026-07-31, PR #1066).** Both fix
  mechanisms refused as a maintainer decision; reopen when any of the FIVE
  recorded conditions fires (IO-bound-profile evidence, constrained-consumer
  telemetry, quality-floor invalidation, perceptibility evidence, or — most
  likely first — a demonstrated dual-scope consumer). The "flip scope_dedup"
  quick win from the analysis is therefore OUT of scope; the refusal record
  and reopen conditions live in
  `agents/settings/contexts/dedup-reachability-refusal.md`.
- **Thin-projection quality — honest null (TERMINAL).** Thin win-rate 36.2% <
  48% pre-registered threshold. The thin FLIP stays parked
  (`later/road-to-thin-flip-under-anchor-scoring.md` carries the resume
  condition). Finishing the `condense.ts` port so the mode stops THROWING is
  allowed (dead-switch repair), flipping the default is not.
- **ADR-054 runtime activation — refused AS DESIGNED, not permanently**
  (activation red-baseline null, 0/67 adjudicated). Mechanism-match: the
  Foundation Phase 3 spike shares ADR-054's transport family (a prompt-time
  reader of `dist/router.json` — the ADR names that shape) but is a DIFFERENT
  measurement with a different objective and baseline — it replaces
  always-loaded non-kernel bodies to cut tokens, where ADR-054 added
  decay-triggered restatements against an adherence gap the red baseline
  never produced. The lock therefore does not bind the spike; the
  shape-similarity is acknowledged, the spike runs phase-gated with
  pre-registered thresholds, never a default flip, and a loss parks it
  permanently next to ADR-054 with the numbers.
- **A3 production-validator / enforcement-projection / orchestration-flip
  honest nulls** — TERMINAL, not re-run here.
- **Harvest freeze until the first external adopter (restraint decision,
  2026-07-20,** `agents/settings/contexts/surface-consolidation-restraint.md`**).**
  Council 2026-08-02 (loop 1, unanimous): split by pain — borrows that close a
  RECORDED internal failure (return-prevention) proceed with an inline lock
  note; purely additive capability stays frozen behind the freeze's own reopen
  condition. Effect on Leverage: Phase 2 carries only the three
  documented-failure fixes; the additive borrows are listed under "Findings
  not carried forward" below.

## Findings not carried forward (disposition + reopen condition)

- **Supply-chain dependency audit** — partially mitigated today
  (`check_secret_leak` gate, npm OIDC Trusted Publishing + provenance in the
  release workflow); the remaining gap (no lockfile/dependency scanner,
  `npm ci --no-audit` everywhere) moves INTO Foundation Phase 1 as a new item
  rather than being dropped.
- **Windsurf single-blob projection** (~5,400 lines always-loaded) — measured
  as part of Foundation Phase 2's before/after; no dedicated work this cycle.
- **Settings template (1,241 lines)** — mitigated by the browser setup wizard
  as the primary settings surface; reopen if wizard coverage of template keys
  is incomplete (then chip a template-sectioning item into ADR-hygiene).
- **Self-learning open loop** — deliberately dropped per the Evidence-v2
  accumulation KILL and agent-memory sunset locks; reopen only through those
  records.
- **Monolith scripts (~15.5k LOC / 4 files)** — no refactor-for-its-own-sake;
  re-enters exactly where it bites: the umbrella-runner spike's import-safety
  audit (Foundation Phase 1).
- **Semantic-retrieval ceiling** — out of scope for the Phase 3 spike
  (keyword/phrase matching only); reopen if the trigger-precision pass caps
  below the pre-registered injection-precision threshold.
- **PR-creation flow** — analyzed, not dropped: the actionable findings
  (required-check matrix, ci/ci-strict superset, CI build-artifact sharing)
  live in Foundation Phase 1. Two analysis ideas NOT carried: a GitHub merge
  queue (depends on the required-check matrix actually being enforced —
  reopen after Foundation Phase 1 lands the enforce branch) and a CI auto-fix
  bot for regenerable artifacts (collides with the commit-policy /
  non-destructive floors; reopen only with a design that keeps the human on
  the commit).
- **Frozen borrows (harvest-freeze)** — session cost telemetry, USD budget
  circuit-breaker, fact-forcing edit gate, MCP health gating, forward-routing
  footers, in-description deflection, new `awaiting-evidence` tracker status
  (existing `## Blockers` convention covers the need), and PreCompact context
  re-injection (moved here in loop 2: its incident citation did not verify
  and the shipped `hot_context_hook.ts` already restores on SessionStart
  source=compact). Reopen: the freeze's own condition (first documented
  external adopter).

## Sub-roadmaps (managed by this file)

| Sub-roadmap | Scope | Status |
|---|---|---|
| [`road-to-renewal-foundation.md`](archive/road-to-renewal-foundation.md) | CI oracle repair, dead-tree sweep, token quick wins (pack-gated floors, MCP trim), runtime-activation spike (phase-gated) | **complete 2026-08-02** — archived. Phase 3's spike steps closed `[-]` as infeasible-as-specified (no per-prompt injection transport; corpus covers 10 of 97 rules); reopen terms in `internal/bench/layer1-resolver-PREREG.md` |
| [`road-to-renewal-leverage.md`](road-to-renewal-leverage.md) | Execution flows (work-engine batching, parallel dispatch, cadence flip, hub generation, hook-fan-out trim) + three documented-failure fixes with borrowed shape + tracker-convention docs | **unblocked 2026-08-02** — Foundation is complete (Phase 1 green since PR #1109), so the council-locked ordering is satisfied |
| [`road-to-renewal-adr-hygiene.md`](road-to-renewal-adr-hygiene.md) | Drive-loop era batch disposition, ADR-085 amendment, perma-proposed sweep, ADR-201 resolution | chip-mode (attach to other PRs) |

Ordering (council-locked): Foundation Phase 1 (CI oracle) gates everything —
a broken validator cannot validate its own fix. Leverage starts only after
Foundation Phase 1 is green. ADR hygiene chips alongside any PR.

## Success criteria (pre-registered)

- `task ci` wall-clock under 5 minutes locally; zero gates scanning a
  nonexistent root (structural guard, not a one-time sweep).
- `ci-strict` ⊇ `ci` provably (single shared gate list, strict adds — never
  subtracts).
- Non-kernel always-context on this repo reduced by ≥10k GPT tokens vs the
  recorded `audit_initial_context` baseline (levers: pack-gated floors ~8-9k +
  MCP trim), content unchanged; the runtime-activation spike produces its
  pre-registered measurement (token delta + injection precision + non-kernel
  recall/quality arm) before any default changes.

  **BASELINE — recorded 2026-08-02T15:12:25Z, before any Foundation Phase 2
  change landed** (`./scripts-run src/scripts/audit_initial_context`):

  | surface | files | chars | GPT tok | Claude tok |
  |---|--:|--:|--:|--:|
  | `.claude` / `.augment` / `.cursor` always-on rules | 110 | 344,765 | **85,880** | 95,768 |
  | `.windsurfrules` (single-blob projection) | 1 | 286,225 | **69,582** | 79,507 |
  | MCP `agent-config` tool schemas | 31 tools | 22,501 | **4,839** | 6,250 |

  Target on the primary surface: **85,880 → ≤ 75,880 GPT tokens.**

  **AFTER — measured 2026-08-02, Foundation Phase 2 complete. The criterion is
  NOT met by the shipped default, and is met once one gated flip lands. Both
  numbers are recorded rather than one being presented as the result.**

  Shipped default (`rule_packs: []`, nothing else changed on a fresh install):

  | surface | before | after | Δ |
  |---|--:|--:|--:|
  | `.claude` / `.cursor` / `.augment` rules | 85,880 | 85,880 | 0 |
  | `.windsurfrules` | 69,582 | 69,582 | 0 |
  | `skills_projected` catalog (466 → 335 entries) | 17,992 | **13,779** | **−4,213** |
  | MCP, worst-case client (worker, 31 tools) | 4,839 | **4,174** | **−665** |
  | MCP, local client (stdio, 19 tools) | — | 3,074 | newly separated |

  **Realized on the shipped default: −4,878 GPT tok.**

  With the one gated flip (`projection.rule_packs: auto`; blocker
  `rule-packs-auto-consumer-default` in the Foundation roadmap), measured
  END-TO-END by projecting and re-running the audit, not by summing a
  predicate:

  | surface | before | after | Δ |
  |---|--:|--:|--:|
  | `.claude` rules (110 → 102 files) | 85,880 | **77,770** | **−8,110** |
  | `.cursor` rules | 85,880 | **77,770** | **−8,110** |
  | `.windsurfrules` | 69,582 | **63,251** | **−6,331** |
  | `.augment` rules | 85,880 | 85,880 | 0 — full set by design |

  **Available once the flip lands: −12,988 GPT tok across the audited
  always-on surfaces.**

  Two honest misses, both recorded rather than engineered away:

  1. **The ≥10k floor is not cleared by the shipped default** (−4,878). It is
     cleared only with the gated flip. The gate is not agent-liftable — it is
     the workspace-axis human gate of 2026-07-13 applied to the pack axis by
     the AI council (2026-08-02, both members).
  2. **The `≤ 75,880` primary-surface sub-target is missed either way** —
     77,770 with the flip, 1,890 over. The sub-target was unreachable by the
     levers this criterion itself names: the MCP lever does not touch the rule
     row at all, and `.augment` is unfilterable by design. The pre-registration
     conflated a multi-surface floor with a single-surface sub-target; that is
     a defect in the criterion, recorded here, not a result to restate.

  A third figure worth keeping next to these: on the CONSUMER surface the
  workspace axis alone already yields 95 rules / 75,737 tok
  (`check_consumer_scope_flip`, 2026-08-02) — i.e. a consumer is already under
  the sub-target today, and the 85,880 baseline is the maintainer's own
  unscoped tree. The pack axis composes with that as a second AND-constraint.

  Adjacent finding from the same session (Foundation Phase 1), load-bearing for
  this criterion: the KERNEL's own extended footprint had never been measured —
  `check_always_budget` resolved every `load_context` path to a nonexistent file
  and counted ZERO, printing a confident 60.1% of a dimension it was not
  measuring. Repaired, it reads 60,254 chars against a 49,000 cap. That figure
  is now a hard-gated ratchet seeded at first measurement, and this phase's work
  is what pays it down. **Unaffected by Phase 2**: that ratchet measures the 9
  `type: always` kernel rules, and the pack axis never drops a kernel rule.
- Every command appears exactly once in the host projection. **Met
  2026-08-02** — the hyphen/colon double is gone: 134 clustered commands ship
  as `/cluster:sub` from `.claude/commands/`, 47 flat commands keep the single
  skill wrapper that is their only access path.
- Zero `src/` references to `.agent-src.uncondensed/` + CI ban on new ones.

## Phase 1 — this PR

- [x] Deep analysis (11-agent pass, internal + external) with tree-level evidence
- [x] Council pass on priorities, topology, loop default (2026-08-02)
- [x] Hand-verify damning findings (router consumers, dead-root gates, thin
      throw, ci-strict subset, dedup lock)
- [x] Central roadmap + three sub-roadmaps authored
- [x] `/optimize:deep` command authored (analysis → council → roadmaps → PR →
      N autonomous refinement loops, default N=3, halt-on-spin tripwire)
- [x] Refinement loops over this roadmap set (autonomous, council-assisted,
      N=3 per council default; update roadmaps + PR in place) — loop 1: 4-lens
      review + split-by-pain council; loop 2: lock re-audit removed two
      smuggles; loop 3: convergence audit, wording-only deltas → converged

## Phase 2 — steering (after this PR merges)

- [ ] Foundation Phase 1 (CI oracle) executed and verified → unblock Leverage
- [ ] Re-measure token footprint after Foundation Phase 2; decide
      runtime-activation spike go/no-go on the recorded thresholds
- [ ] Record the renewal-cadence decision (when/whether to re-invoke
      `/optimize:deep` against this roadmap set) as a one-line decision note
      here — the recurring re-run itself is cadence, not a checkbox

## Cadence

Re-running `/optimize:deep` against this central roadmap is a standing
practice, not a step: on invocation it retires/refreshes sub-roadmap items
that reality has overtaken. It never blocks archival of this file.

## Provenance (encrypted per source-confidentiality; maintainer-recoverable)

External references analyzed at tree level (Source R / E / S / W):

- Source R: `ENC1:bPfe4pHRtu1H1YcNYXCht2vUSMHLUKqwnZJPCbAncmtwXNiNR1qUHCM736v0tyJcfc67iJM73Gv8USND5RjVFxYPedDMPeVWDIVfQ/MqRSe3Cb604t4+DszYZ3SBhvc=`
- Source E: `ENC1:n3hu1SsdtHr6SMugr9ogbRIpPGfdE023iHojl4CAXN+EJu7pNWMQJXOoN0B+SQgVVR8cKWhxhZTDg44AI4/MlSlLgAFGbsKozZo0hb83h/cYlnSLHcc4/7Jr22BK5kE=`
- Source S: `ENC1:/g6Qasqb79mFE9k+xd6IVfXqn1LizpERu7BHrVOF5eDM9Kzw/HBN2hhhGTR0WlpMwhMlsgrekb8Z3TuyEanW/CJx8JYTl8xDiBRTOyROPmGOIegL99sEBihiMrCAiEGP30SkaDlnsYE=`
- Source W: `ENC1:r1CW02ilFB7FGQ5kN2NUckTXdvvf5POKpXTXCG+gL6haVqWMJNBP/DcXWoiY0GfkATvZsK73Q7B9exBCYTyQSQ+NuojUebrx05LaUIlIhwKIWXUkOGscNatT17DX80ggKz4=`
