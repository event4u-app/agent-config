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
   invocation path.
5. **Decision debt.** ADR-068/070–084 encode the pre-native drive-loop era;
   ADR-085 is framed around the retired Python kernel; ADR-201's open question
   (dist/agent-src/ is now a byte-identical copy of src/) is unresolved; 6 ADRs
   perma-proposed; 164 src/ files reference the dead authoring tree.

## Locks honored (do not relitigate inside the sub-roadmaps)

- **Scope-dedup reachability — REFUSED (DR, 2026-07-31, PR #1066).** Both fix
  mechanisms refused as a maintainer decision; reopen only on a demonstrated
  external dual-scope consumer. The "flip scope_dedup" quick win from the
  analysis is therefore OUT of scope; the refusal record and reopen conditions
  live in `agents/settings/contexts/dedup-reachability-refusal.md`.
- **Thin-projection quality — honest null (TERMINAL).** Thin win-rate 36.2% <
  48% pre-registered threshold. The thin FLIP stays parked
  (`later/road-to-thin-flip-under-anchor-scoring.md` carries the resume
  condition). Finishing the `condense.ts` port so the mode stops THROWING is
  allowed (dead-switch repair), flipping the default is not.
- **ADR-054 runtime activation — refused AS DESIGNED, not permanently**
  (activation red-baseline null, 0/67 adjudicated). A prompt-time hook resolver
  is a DIFFERENT mechanism and passes the mechanism-match test; it enters as a
  phase-gated spike with pre-registered thresholds, not as a default flip.
- **A3 production-validator / enforcement-projection / orchestration-flip
  honest nulls** — TERMINAL, not re-run here.

## Sub-roadmaps (managed by this file)

| Sub-roadmap | Scope | Status |
|---|---|---|
| [`road-to-renewal-foundation.md`](road-to-renewal-foundation.md) | CI oracle repair, dead-tree sweep, token quick wins (pack-gated floors, MCP trim), runtime-activation spike (phase-gated) | active |
| [`road-to-renewal-leverage.md`](road-to-renewal-leverage.md) | Execution flows (work-engine batching, parallel dispatch, command dedup/tail-cut) + external borrows (hook layer, worktree manifest, roadmap statuses) | blocked on Foundation Phase 1 |
| [`road-to-renewal-adr-hygiene.md`](road-to-renewal-adr-hygiene.md) | Drive-loop era batch disposition, ADR-085 amendment, perma-proposed sweep, ADR-201 resolution | chip-mode (attach to other PRs) |

Ordering (council-locked): Foundation Phase 1 (CI oracle) gates everything —
a broken validator cannot validate its own fix. Leverage starts only after
Foundation Phase 1 is green. ADR hygiene chips alongside any PR.

## Success criteria (pre-registered)

- `task ci` wall-clock under 5 minutes locally; zero gates scanning a
  nonexistent root (structural guard, not a one-time sweep).
- `ci-strict` ⊇ `ci` provably (single shared gate list, strict adds — never
  subtracts).
- Session rule-layer footprint on this repo measurably reduced with content
  unchanged per `audit_initial_context` (pack-gating + MCP trim), and the
  runtime-activation spike produces a pre-registered measurement (win-rate +
  token delta) before any default changes.
- Every command appears exactly once in the host projection.
- Zero `src/` references to `.agent-src.uncondensed/` + CI ban on new ones.

## Phase 1 — this PR

- [x] Deep analysis (11-agent pass, internal + external) with tree-level evidence
- [x] Council pass on priorities, topology, loop default (2026-08-02)
- [x] Hand-verify damning findings (router consumers, dead-root gates, thin
      throw, ci-strict subset, dedup lock)
- [x] Central roadmap + three sub-roadmaps authored
- [x] `/optimize:deep` command authored (analysis → council → roadmaps → PR →
      N autonomous refinement loops, default N=3, halt-on-spin tripwire)
- [ ] Refinement loops over this roadmap set (autonomous, council-assisted,
      N=3 per council default; update roadmaps + PR in place)

## Phase 2 — steering (after this PR merges)

- [ ] Foundation Phase 1 (CI oracle) executed and verified → unblock Leverage
- [ ] Re-measure token footprint after Foundation Phase 2; decide
      runtime-activation spike go/no-go on the recorded thresholds
- [ ] Quarterly: re-run `/optimize:deep` against this central roadmap and
      retire/refresh sub-roadmap items that reality has overtaken

## Provenance (encrypted per source-confidentiality; maintainer-recoverable)

External references analyzed at tree level (Source R / E / S / W):

- Source R: `ENC1:bPfe4pHRtu1H1YcNYXCht2vUSMHLUKqwnZJPCbAncmtwXNiNR1qUHCM736v0tyJcfc67iJM73Gv8USND5RjVFxYPedDMPeVWDIVfQ/MqRSe3Cb604t4+DszYZ3SBhvc=`
- Source E: `ENC1:n3hu1SsdtHr6SMugr9ogbRIpPGfdE023iHojl4CAXN+EJu7pNWMQJXOoN0B+SQgVVR8cKWhxhZTDg44AI4/MlSlLgAFGbsKozZo0hb83h/cYlnSLHcc4/7Jr22BK5kE=`
- Source S: `ENC1:/g6Qasqb79mFE9k+xd6IVfXqn1LizpERu7BHrVOF5eDM9Kzw/HBN2hhhGTR0WlpMwhMlsgrekb8Z3TuyEanW/CJx8JYTl8xDiBRTOyROPmGOIegL99sEBihiMrCAiEGP30SkaDlnsYE=`
- Source W: `ENC1:r1CW02ilFB7FGQ5kN2NUckTXdvvf5POKpXTXCG+gL6haVqWMJNBP/DcXWoiY0GfkATvZsK73Q7B9exBCYTyQSQ+NuojUebrx05LaUIlIhwKIWXUkOGscNatT17DX80ggKz4=`
