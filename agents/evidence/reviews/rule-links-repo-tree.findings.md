# Findings: rule-links-repo-tree
<!-- completion-review: v1 | reviewed: 2026-10-03 | scope: ee829d1ca473ca9fdb19cb80d9ce0fb4206199097fafec7697b019f77d2684c9 | diff: 88514ea1d21e83931f0eb0cfc31dfffac01bac54 | reviewer: subagent-opus-rule-links-repo-tree | prompt_hash: 8b50cc5955ef19ff690052ac26c164564ae49711af4e248933d035bb94fadc7e -->

<!-- context-manifest: v1
inputs:
  diff_sha: 88514ea1d21e83931f0eb0cfc31dfffac01bac54
  scope_hash: ee829d1ca473ca9fdb19cb80d9ce0fb4206199097fafec7697b019f77d2684c9
  roadmap: agents/roadmaps/road-to-rule-triggers-and-links-that-hold.md
  roadmap_hash: 6da77b318009a7d95608bfb5fe3939261a09e077d74b466a95e69244e2a00d58
  ac_hash: 2811d9537de14de6c607c768b6f12050667a90a4d297968ea680d829d1d13e5d
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-03T04:00:00Z
-->

**§2.5 cannot be satisfied here, and saying so is more honest than shaping the
file around the check.** The review was commissioned mid-work — a subagent over
the branch rather than `dispatch_r2_reviewer` — so every fix was committed
before any artifact existed, and `checkFindingsBeforeFixes` is right to report
`fix-before-artifact`. The verdict is accurate; it is recorded here rather than
avoided by back-dating, renaming, or marking real fixes as something else.

**Independence, stated at its real level, not at a flattering one.** This is an
L0/L1 pass under [`evaluator-independence`](../../../src/rules/evaluator-independence.md)
§ Tests are evaluators — same model, same session, a different context window.
It is NOT provider-diverse and must not be cited as if it were. What makes it
worth the space is that the prompt is committed beside it (`.review-input`,
hashed into the header) and carries no verdict, no expectation and no
self-chosen subset: the scope is "the complete delta, no subset", and the
checklist asks for findings rather than for confirmation. Finding 1 is the
evidence the pass was real — it reversed a change the implementing session had
already measured, committed and written a commit message justifying.

The prompt as committed carries `<worktree>` where the dispatch carried the
absolute worktree path. That path is machine-local and identifies a developer's
home directory; nothing else in the prompt differs, so the hash covers the text
a reader can actually check.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/rules/ui-audit-gate.md:55 | `[directives/ui/audit.ts](../templates/scripts/work_engine/directives/ui/audit.ts)` was turned into a code span with the rest of the repo-tree group, but it was not a repo-tree link: `GLOBAL_DEPLOY_SOURCES.augment` maps `dist/agent-src/templates` to `templates` beside `rules`, so from an installed augment rule it RESOLVES. The repair traded a working link for a path no install holds. Proved from the arithmetic rather than from reading alone: 23 links removed, total 545 to 522, but augment's unresolved fell only 95 to 73. No gate here could catch it — the ratchet bounds UNRESOLVED links, and destroying a resolved one makes the number fall, which a shrink-only ratchet welcomes. | fixed | 266579753 — link restored; a new test pins that this specific link resolves on augment, and the remainder pin now carries the `templates` row, so it may neither grow nor silently vanish. Re-applying the code span reds those two and leaves all 18 host ratchets green, which is the hole being covered |
| 2 | medium | src/install/wizard-plan.ts:75 | The deploy table's own docstring — the one a reader of `CLAUDE_SKILL_BUNDLE` meets first, and the only place that states the figures as a measurement — still read "160 of 550 links ... 113 of them ... against **5,198**". The tree read 136 of 523 with 112 deployable. The same change refreshed the roadmap blockers and the test docstring and left this one, which widens pre-existing drift rather than introducing it. | fixed | 266579753 — 136 of 523, 112 deployable, rewrite priced at 5,152 for 112 links; the earlier totals kept as history with the reason the 112 did not move |
| 3 | low | src/install/installedRuleLinks.ts:120 | "277 of cline's 550 links" — the live reading is 275 resolved of 523. This branch had already corrected exactly this sentence in `tests/scripts/install_rule_links.test.ts` and not in the source the test's wording was derived from. | fixed | 266579753 — 275 of 523 |
| 4 | low | tests/scripts/install_rule_links.test.ts:149 | "Four of them named a file the repository does not have either (`scripts/*.ts` ...)". Only three are dead `scripts/*.ts`; `../scripts/hooks/evidence_independence.ts` resolved, because `../` from `src/rules/` is `src/`. Counting the links that pointed nowhere in the repository the number is five, not four — the two `../../../LEGAL_NOTICE.md` climbs go above the repository root. | fixed | 266579753 — five, enumerated by kind |
| 5 | low | src/rules/media-governance-routing.md:78 | The rule says its gate "fails the build if any policy file ... is not **linked** from: this routing rule ...". After the repair the rule links to none of the seven; it stays green only because `referrers_for` matches `policies/media/<name>` as a bare substring. Small, but load-bearing in one direction: tightening that gate to require a real link — which the rule's own prose invites — would silently un-reference seven safety policies from their routing rule. | fixed | 266579753 — the word is `referenced`, with the substring mechanism and the one-directional hazard named in the rule body |
| 6 | low | agents/roadmaps/road-to-rule-triggers-and-links-that-hold.md:327 | Group 3's justification prices the `templates/` link at "1.7 MB for ONE link" without recording that the link already resolved on augment, so the MB-per-link test was applied to a link that was not dead everywhere. Finding 1 stated from the roadmap's side. | fixed | 266579753 — group 3 now records the revert, names augment as the host that resolves it, and states the general rule: a link that reads as repo-tree is checked against every host's deploy plan before it is repaired |
| 7 | low | agents/roadmaps/road-to-rule-triggers-and-links-that-hold.md:379 | D6 was inserted ABOVE D5 where every other row ascends, and D5's Evidence cell was edited in place to carry its own refutation — a reader reconstructing the history gets a record that never existed. | fixed | 266579753 — D6 moved below D5; D5 keeps its original evidence and gains a dated one-line amendment pointing at D6 |
| 8 | low | src/rules/media-governance-routing.md | `# obligation: line 43` points at a blank line. Mechanically faithful — the marker moved by exactly the three frontmatter lines removed, and the pre-change `line 46` also landed on a blank line — and its only reader parses the integer and nothing else. | accepted-risk | pre-existing and preserved correctly; the marker has no producer and no second reader, which step 1.5's own report already records |
| 9 | low | internal/workers/mcp/content.json | Tracked, and it embeds every old link form verbatim. Its own header declares it the dev stub overwritten by the packer at deploy, and it was already many rule-generations stale before this branch. | accepted-risk | not a regression here; flagged only because it greps as containing the removed links |
| 10 | low | tests/scripts/install_rule_links.test.ts | The baselines now sit at the exact reading with zero headroom, against this repository's usual never-lower-a-ratchet-on-a-local-reading convention. The reviewer verified both halves of the argument for the exception — every unresolved link is `directory-not-deployed` or `outside-install-root`, decided from the deploy plan alone, and `file-missing` is 0 — and it holds. The consequence is a sharper edge than the branch's prose suggested. | fixed | 266579753 — the docstring now names the consequence: one ordinary new `](../contexts/…)` link reds all 18 host rows at once, that is the ratchet working, and the fix is to re-measure rather than to add slack back |

## What the reviewer verified clean, so the findings read against a baseline

Every one of the 18 new code-span paths exists (`test -e` on each).
`condense.sh --changed` reports every `.md` projection matching its source, and
each of the 9 `src/rules/` edits has its `dist/agent-src/rules/` twin.
`report_installed_rule_links` reproduces the pinned per-host numbers exactly,
with `file-missing` 0 on every host. The new remainder pin is a real ratchet,
not a tautology: `by_directory` ordering is deterministic and any new row breaks
it. `lint_media_policy_linkage` is green at 7/7 with 4-12 referrers each, and
the substring that satisfies it was read rather than assumed.
`generate_pack_manifests --check` exits 0, so the five token-passport edits are
exactly right. Also green: `check_condensed_paths`, `check_references`,
`lint_consumer_internal_refs`, `validate_frontmatter`, `check_always_budget`,
`lint_rule_law_section`, `lint_roadmap_blockers`, `lint_plan_risk_register`,
`check_source_pointer_freshness`, `check_no_new_legacy_path`,
`check_enforcement_coverage`. The two edited `validator_ignore` reasons name
links that are still in their files, and the removed one named a pattern that is
not.

## What this pass did not cover

The reviewer read the branch, not the hosts. Nothing here measures an actual
install, so "resolves on augment" is a statement about the deploy plan and the
projected tree, verified against both, and not about a materialised
`~/.augment/rules/` directory. The `docs/` projection question the remainder
blocker holds was out of scope by construction: the prompt asked whether the
roadmap's claims contradict the tree, not whether the projection should change.
