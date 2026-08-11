# Findings: council-integrity
<!-- completion-review: v1 | reviewed: 2026-08-11 | scope: 5b552cbbf5548f3e46cde332e42294a7c2f73066efd6e469ac51b11445e3d0ba | diff: 1a7b4f87e2d1100d288059f8003266bc7fe79eaa | reviewer: r2-fresh-subagent-council-integrity | prompt_hash: fccc00b0d955ef070a14b20828d5fe1833af34a7b184e4f4999d4e44b3621d3d -->

<!-- context-manifest: v1
inputs:
  diff_sha: 1a7b4f87e2d1100d288059f8003266bc7fe79eaa
  scope_hash: 5b552cbbf5548f3e46cde332e42294a7c2f73066efd6e469ac51b11445e3d0ba
  roadmap: agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-council-integrity.md
  roadmap_hash: 834f4bb1b28757eaaa46d1683b261248d92a232ed12cd1e41715216e0b42b145
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-11T05:50:00Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/ai_council/orchestrator.ts:1973 | `assert_synthesis_matches_tally` throws from inside `render()` before the tally and Convergence blocks are pushed, so a verdict/tally mismatch destroys the ENTIRE rendered artifact after every provider call has been paid for. No catch, no degraded fallback, although the module's own pattern for an unparseable claim is a repair marker (`needs_repair`). The roadmap records that unconditional wiring of the sibling shape check was unsafe for exactly this reason. | fixed | render path returns instead of throwing; mismatch appended after the tally block (02c786c28) |
| 2 | medium | src/scripts/ai_council/prompts.ts:506 | `_VERDICT_RE` is case-insensitive and line-anchored, so ordinary prose beginning a line with `Verdict: option A is the stronger choice` parses as a machine-readable verdict — the prose inference the comment two lines above forbids. The new test deliberately uses prose with no line-initial `Verdict:`, i.e. it tests around the actual false-positive shape. | fixed | `/i` dropped; three tests added on the real line-initial prose shapes (02c786c28) |
| 3 | medium | src/scripts/ai_council/orchestrator.ts:1973 | The check only fires when `opts.chairman.text` is non-empty; on the default path the host agent writes its verdict AFTER `render()` returns, where nothing checks it. Phase 2's Exit claim therefore overstates coverage — the same overstated-coverage class the roadmap corrected for the shape check's docstring. | fixed | Phase 2 Exit amended in place — coverage stated as member-chairman path only (02c786c28) |
| 4 | medium | src/scripts/ai_council/orchestrator.ts:1932 | The contract append overrides `prose_synthesis: true`, whose documented meaning is a BARE slot (`template = ''`). With both on and no chairman the body becomes raw contract instructions, and the in-diff comment claiming the templated default stays green describes an unreachable branch. | fixed | append guarded on `template !== ""` so `prose_synthesis` keeps its bare slot (02c786c28) |
| 5 | medium | agents/roadmaps/road-to-inbox-harvest-2026-08-b-council-integrity-followup.md:3 | Frontmatter `parent_roadmap` points at the path this same diff deletes; every prose reference correctly uses `archive/`. Roadmaps are excluded from `check_references`, so nothing catches it. | fixed | frontmatter repointed at `archive/` (02c786c28) |
| 6 | medium | agents/roadmaps-progress.md:72 | Dropping the parent's structured `## Blockers` section for a bare `> Blocked until` blockquote makes the dashboard synthesise a blocker with id `legacy` and owner `user`, replacing a `maintainer`-owned blocker with a precise resolution criterion, and bumps the header counter to claim a user action item for what is data accumulation. | fixed | structured `## Blockers` carried forward; dashboard prints quorum-solo-floor / maintainer (02c786c28) |
| 7 | low | src/scripts/ai_council/prompts.ts:575 | The parameter type requires `split: boolean` but the body never reads it, branching on `consensus === null` while the error text asserts a split across `options.length`. The equivalence is assumed, not checked; a zero-option tally yields "split across 0 option(s)". | fixed | reads `tally.split`; empty tally reports "no option-level stances parsed" (02c786c28) |
| 8 | low | src/scripts/ai_council/prompts.ts:502 | `SPLIT_VERDICT_LABEL` shares a namespace with free-text option labels, so an option genuinely labelled `split` that clears the tally makes the correct verdict fail. | fixed | reserved sense yields when an option carries the label; two tests (30328d881) |
| 9 | low | src/scripts/_lib/env_kill_switch.ts:35 | The new shared helper ships with no direct test; the step's verify command exercises at most one of its two call sites. The off-set is now an untested cross-module invariant. | fixed | `tests/scripts/_lib/env_kill_switch.test.ts` — 11 cases across both call sites (02c786c28) |
| 10 | low | src/scripts/ai_council/prompts.ts:548 | The placeholder guard plus the last-match rule means a chairman who leaves `VERDICT: <option-label>` in place silently disables the check — the most likely authoring mistake produces no signal at all. | fixed | subsumed by 1 — the render path now surfaces rather than silently returning (02c786c28) |
| 11 | low | agents/roadmaps/road-to-inbox-harvest-2026-08-b-council-integrity-followup.md:392 | "The parent closed 8 of 8 steps" is contradicted by the next sentence and by the archived parent, which carries 1.6 as `[~]`. | fixed | "8 of 9 non-cancelled steps" (02c786c28) |

**Re-bound after merging `origin/main` (PR #1272), and the delta is named rather
than absorbed.** The scope hash moved because the branch merged main, not
because reviewed code changed. Measured: the scope file list is identical to the
reviewed round except for the resolved rename source and the test the fix pass
added, both already covered. What the reviewer never saw is exactly the merge
resolution — two rows of the `-inbox-harvest-2026-08-b` index table (both
children now point at `archive/`, since each session had archived its own and
left the other active) and the regenerated dashboard. No foreign code entered
the review scope: after merging main, main's own files are identical to
`origin/main` and therefore absent from the diff.
