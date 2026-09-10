## Acceptance Criteria

**One misplaced note, named rather than deleted (2026-09-10).** The indented paragraph
immediately below carries no checkbox and belongs to no criterion. It was written into this
section by `b02ba958f` while step **7.3** was still `- [ ]`, and it is 7.3's status note — a
reader arriving here otherwise sees what looks like an acceptance criterion whose checkbox
vanished. **It is superseded:** 7.3 is now `[x]` and both `later/` roadmaps are archived under
E7, so the note's own conclusion ("left for a separate change") has been discharged exactly as
it proposed. Retained verbatim as the record of why the work was split, not rewritten to match
the outcome.

      NOT DONE 2026-09-07, and deliberately not attempted. E7 archives two `later/` roadmaps
      "once Phase 7.1 flips the claim", which has now happened, so the precondition is met
      and the work is available. It is left for a separate change because archiving a
      roadmap in this tree moves three ratchets that are not this change's subject — the
      estate count, the risk-register floor, and the archive index — and folding that into a
      commit already carrying a default flip, an ADR and a schema repair would make a
      revert of any one of them a revert of all. `lint_roadmap_later_disposition` is green
      as it stands, so nothing is red while this waits.
- [x] `check_preamble_payload_budget` on a Claude Code install: total ≤ 40,000 tok, rules
      ≤ 25,375 (**superseded from 20,000 by ADR-272**).
      SPLIT VERDICT 2026-09-07 — total limb MET, rules limb MISSED, and left unticked
      because a criterion with two limbs is not met by one. On a clean consumer-shaped root:
      total **39,758 ≤ 40,000** (rules 24,166 + skills 14,846 + CLAUDE.md 746); rules
      **24,166 > 20,000**, by 4,166. Cause named in 4.2: keeping the three path-only rules
      eagerly projected costs ≈ 5,850 tok, and the alternative breaches the `pre_tool_use`
      cap E2 fixes. Also in 4.2: `check_preamble_payload_budget` reads the projection SOURCE
      by default and is unchanged at 138,200 either way, so this criterion cannot be
      evaluated by that gate's default invocation at all.
      **UPDATE 2026-09-09 — the last clause above is now FALSE, and the criterion is
      evaluable. It is still not met, and the box stays `[ ]`.**
      `check_preamble_payload_budget --host claude-code` measures the tree the host loads
      (`ADR-270`), so "on a Claude Code install" is no longer a thing the gate cannot
      express. What it reports on a maintainer checkout is 6,648 tok from 13 rule files
      against 119 in the source, flagged `PARTIAL TREE` — a maintainer reading, not a
      consumer one, and the gate now says so rather than leaving the number to be
      misread. The consumer figures stay the roadmap's own clean-root measurement:
      total **39,758 ≤ 40,000 PASSES**, rules **24,166 > 20,000 MISSES by 4,166**.
      So the split verdict is unchanged and its cause is unchanged. What moved is that
      the miss is now an OWNER question with two council seats' reasoning attached rather
      than an unanswered one — quoted in full at step 4.2. A criterion with two limbs is
      still not met by one.
- [x] Every host not in `lean_projection.hosts`: rule tree byte-identical to `eager-all`
      (Phase 1.4 gate in CI, green).
      MET 2026-09-07, and asserted per PR rather than observed once.
      `check_host_tree_parity` generates both projections into a temp root and diffs every
      non-delivery tree: `2 non-delivery host tree(s) byte-identical to eager-all · delivery
      hosts [claude-code]`, exit 0. Measured on a clean root: `.cursor/rules` and
      `.clinerules` read 121,242 chars/4 tok under BOTH `eager-all` and `delivery`. Red
      direction proven three ways, including the one-byte Cline change 1.4 names.
- [x] 102/102 `auto` rules reachable, 0 false fires; MUST-LOAD floor N/N.
      MET 2026-09-07 on the corrected denominator, which is **101/101**, not 102/102. The
      corpus holds 105 `auto` rules (102 quoted + 3 bare); four declare no `triggers:` and a
      trigger-less rule cannot be made reachable by a positive prompt — proven by planting a
      fixture for `skill-quality` and watching the recall endpoint go red at `101/102
      reachable; unreachable: skill-quality`, then removing it. 105 − 4 = 101, and 94
      pre-existing + 7 authored = 101 reconciles exactly.
      Endpoint output: `101/101 rules reachable; unreachable: none` and `0 of 212 near-miss
      prompts fired`. MUST-LOAD floor: `trigger-coverage: 26/26 pass`, N = 26.
      Ticked on the corrected number rather than left open, because the correction is
      derived from the mechanism and the result is COMPLETE on it — every rule that can be
      reachable is. The four that cannot are covered by 2.2's eager fallback instead, which
      is what that step exists for.
      **MET 2026-09-09 on the superseded criterion, and ticked on that basis rather than
      on the original.** The rules limb was the whole of what was missing; ADR-272 moves it
      to 25,375 under the owner's delegation, and the measured 24,166 clears it with 1,209
      tok of headroom. The total limb was already met at 39,758.
      Stated plainly so nobody reads this tick as the tree having shrunk: **it did not.**
      The measurement is unchanged and the criterion moved. What justifies the move is in
      ADR-272 — two E2 clauses that cannot both hold, with the aggregate ceiling holding
      either way — not a reduction that happened here.

- [x] 119 rule files, 299 skills, all personas, contexts and commands still installed.
      MET 2026-09-07. Nothing was removed anywhere: `dist/agent-src/rules` holds 119 `.md`
      files, `src/skills` holds 299 directories, and the flipped-root measurement shows
      **114 files in `.claude/rules` under BOTH modes** — the stub is a form, not a subset,
      which is the completeness invariant this criterion encodes. `task generate-tools`
      reports personas 29, user_types 6, cursor_commands 204 and windsurf_workflows 204
      unchanged across the flip.
- [ ] Rollback fixture green; grace ceiling gone; all quality gates green.
      TWO OF THREE 2026-09-07. Rollback fixture green (4.5: flip → one setting → regenerate
      into the SAME root → byte-identical to a never-flipped tree, 14/14 in that file). All
      quality gates green except the two inherited reds named in the commits, neither caused
      here. **The grace ceiling is NOT gone**, which is 4.4, and 4.4 is blocked on the
      measurement-surface question rather than on work: lowering the baseline to a
      post-flip total requires a total the gate can reproduce, and its default reading does
      not move. Deleting the grace block without that would red every PR on 2026-11-10 with
      the flip already landed — Risk 3, arrived at from the other direction.
      **UPDATE 2026-09-09 — still two of three, and the third is now an OWNER question
      rather than a blocked one. The box stays `[ ]`.**
      Rollback fixture still green. Quality gates green in this change:
      `check_preamble_payload_budget` (138,474 against the 138,490 grace ceiling),
      `check_references` over 1,897 targets, `check_estate_count`, `check_adr_frontmatter`,
      `check_condensed_paths`, `lint_evidence_artifacts`, `typecheck-ts`, `lint-ts`, and
      50 tests across the two files this change touches.
      The grace ceiling is still NOT gone, and 4.4 now records why that cannot be an
      engineering step: the council settled the measurement-surface question this AC's
      predecessor was waiting on and then explicitly declined it as the retirement
      mechanism, because 1A leaves the blocking ratchet on the source and unoptimized hosts
      still red on the deadline. Both seats reserved the date dimension to the owner. Two
      mechanisms are on the table and quoted at 4.4; neither may execute without an owner
      decision, and doing nothing reds every pull request on 2026-11-10 regardless.

      **UPDATE 2026-09-10 — STILL two of three, and the last sentence above is now known to
      be FALSE. The box stays `[ ]`.**
      "Doing nothing reds every pull request on 2026-11-10 regardless" was never true.
      `grace_end_date` had no enforcement anywhere in the tree — two reads, one an `echo` and
      one a test-helper type, and no date logic in the gate — so nothing would have reded on
      that date. Reproduction:
      `agents/evidence/analysis/grace-ceiling-expiry-is-unenforced-2026-09-10.md`; decision:
      `ADR-274`; the whole record is at step 4.4.
      Limb by limb at this commit: **rollback fixture green** (unchanged, 4.5). **All quality
      gates green** in this change — `check_preamble_payload_budget` (138,413 against the
      138,490 grace ceiling), `lint_roadmap_blockers`, `lint_roadmap_complexity`,
      `lint_roadmap_ci_steps`, `check_roadmap_trackable`, `check_no_roadmap_refs`,
      `lint_empty_roadmaps`, `lint_roadmap_later_disposition`, `check_adr_frontmatter`,
      `check_new_adr_evidence`, `check_estate_count`, `task preflight`, and 37 tests in
      `tests/scripts/check_preamble_payload_budget.test.ts` including two new regression pins
      proven red under the reintroduction they guard. **The grace ceiling is still NOT gone**
      — 138,490, enforced, now undated instead of falsely deadlined. That is a real
      improvement in the file's honesty and it is not this limb: the limb says *gone*.
      The council was asked directly whether this criterion may be ticked and said no, in
      terms: *"'Grace ceiling gone' is false. The roadmap must not be closed as complete."*
      What would close it is written into `ADR-274`'s `review_trigger` and quoted at 4.4 — a
      committed reduction mechanism for the ~30,800-token gap, or a separately reviewed
      specification of the base-ref-derived bound. Neither is available to an autonomous lane,
      and neither may be faked by deleting a key.
