# Findings: feat-rule-stub-projection
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: dca78ab4a64e1e50d941db33cb64514e8213a657e0c493342e84c1d84d8a6259 | diff: 052a6e66eca0b464a20ab412e544df66a3c3a96a | reviewer: r2-fresh-subagent-feat-rule-stub-projection | prompt_hash: e48fa04fe7c0e47bad6b6ba35570d2ebaba9c37aa8f4d733e545a9e43495f490 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 052a6e66eca0b464a20ab412e544df66a3c3a96a
  scope_hash: dca78ab4a64e1e50d941db33cb64514e8213a657e0c493342e84c1d84d8a6259
  roadmap: agents/roadmaps/archive/road-to-rule-stub-projection.md
  roadmap_hash: 7ebb8851c621e4eee3485faa1dba348246881b7c12eb7678d0217533b69fc54b
  ac_hash: 743a55103bf09fceecf918eb1560aa1d9add6eada3fa747fba9925916e1ee94a
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T16:48:48Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/check_rule_stub_ceiling.ts:458-479 | `--write-baseline` recomputes every ceiling from the tree and carries `history` forward verbatim, so it raises ceilings silently — defeating assertion 3. The failure text and the baseline `_comment` both point the operator at this exact command as the fix. | open | |
| 2 | medium | src/scripts/check_rule_stub_ceiling.ts:531 | The history/ceiling agreement check runs on every entry and demands `h.to === ceilings[h.rule]`, so a second raise for the same rule reds permanently and the only way to green is deleting the audit trail. | open | |
| 3 | medium | src/scripts/check_rule_stub_ceiling.ts:317,333,544-565 | The migrated population comes from an unbounded phrase match over the whole file, so an incidental prose mention of "merged into" becomes a hard CI failure carrying remediation advice that is wrong for a rule that never migrated. Latent: the two populations coincide at 44 today. | open | |
| 4 | medium | src/scripts/check_rule_stub_ceiling.ts:338-344,566-580 | The ceiling is keyed on whole-file tokens including YAML frontmatter, so adding a trigger trips a prose ceiling whose failure text says to move prose that did not grow. | open | |
| 5 | medium | src/config/rule-stub-ceilings.json:2 | `measured_at_commit: "unrecorded"` — the env var that fills it is named nowhere, and the sibling baseline it claims to mirror records a real sha. Nothing ties the 44 numbers to a tree state. | open | |
| 6 | medium | src/config/gate-coverage.yml:47-48 | The diff adds the 41st row while the header still claims 40 emitters with 39 listed — the miscount that file's own note names as its canonical failure. | open | |
| 7 | low | src/scripts/check_rule_stub_ceiling.ts:116-131,381-386 | `EMPTY_REASONS` is unreachable: the 40-char floor is tested first and every entry is shorter, so the denylist the docblock advertises never runs and the self-test does not exercise it. | open | |
| 8 | low | src/scripts/check_rule_stub_ceiling.ts:571 | The partial-raise `covered` branch cannot change a verdict — its precondition implies the disagreement failure already fired. | open | |
| 9 | low | src/scripts/check_rule_stub_ceiling.ts:602-605 | `scanned:` is emitted only on the green path although the comment says both, so a real violation earns a second misleading red from `check_gate_coverage` about blindness. Copied from the sibling gate. | open | |
| 10 | low | src/scripts/check_rule_stub_ceiling.ts:210 | `dist/agent-src` is tried before `src`, so a pointer can resolve against a stale committed projection after its real target is deleted. | open | |
| 11 | low | src/scripts/check_rule_stub_ceiling.ts:7 | The docblock opens with 42, the figure this branch corrects to 44 everywhere else — surviving in the file read first. | open | |
| 12 | low | src/scripts/check_rule_stub_ceiling.ts:708-715 | `selfTest`'s docblock enumerates four rejecting cases while six ship, inviting a trim below the floor. | open | |
| 13 | low | src/scripts/check_rule_stub_ceiling.ts:293,261-266 | The pointer sentence counts as floor only when it fits on one line, although the code elsewhere records that live pointers soft-wrap — biasing the published split in the direction the roadmap premise favours. | open | |
| 14 | low | src/scripts/check_rule_stub_ceiling.ts:268-274 | Fence tracking treats ``` and ~~~ as interchangeable, so the house nested-fence shape closes the outer fence at the inner opener and mis-splits everything after it. | open | |
| 15 | low | src/scripts/check_rule_stub_ceiling.ts:213,218,225 | `fs.existsSync` accepts a directory, so a pointer naming a directory reports resolved while naming no readable document. | open | |
| 16 | low | src/scripts/check_rule_stub_ceiling.ts:317,338-344 | The corpus is read twice and tokenized four times per migrated rule, including on the check path where the floor/residue encodes are unused — ~117 redundant reads and ~88 redundant encodes per CI run. | open | |
| 17 | low | src/config/gate-coverage.yml:537-552 | The new row declares no `canary:` recipe, so the gate ships permanently UNPROVEN although it is exactly the create-only shape canaries support. | open | |
| 18 | low | src/scripts/check_rule_stub_ceiling.ts:497 | The method-change path marks all 44 targets complete and then returns 1, so the ledger line reports a clean run on a failed one. | open | |
| 19 | low | src/scripts/check_rule_stub_ceiling.ts:241-248 | `splitFrontmatter` returns an empty body for a file ending at its closing `---` with no trailing newline, so such a rule contributes zero residue with no signal. | open | |
