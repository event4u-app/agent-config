## Acceptance Criteria

      NOT DONE 2026-09-07, and deliberately not attempted. E7 archives two `later/` roadmaps
      "once Phase 7.1 flips the claim", which has now happened, so the precondition is met
      and the work is available. It is left for a separate change because archiving a
      roadmap in this tree moves three ratchets that are not this change's subject — the
      estate count, the risk-register floor, and the archive index — and folding that into a
      commit already carrying a default flip, an ADR and a schema repair would make a
      revert of any one of them a revert of all. `lint_roadmap_later_disposition` is green
      as it stands, so nothing is red while this waits.
- [ ] `check_preamble_payload_budget` on a Claude Code install: total ≤ 40,000 tok, rules
      ≤ 20,000.
      SPLIT VERDICT 2026-09-07 — total limb MET, rules limb MISSED, and left unticked
      because a criterion with two limbs is not met by one. On a clean consumer-shaped root:
      total **39,758 ≤ 40,000** (rules 24,166 + skills 14,846 + CLAUDE.md 746); rules
      **24,166 > 20,000**, by 4,166. Cause named in 4.2: keeping the three path-only rules
      eagerly projected costs ≈ 5,850 tok, and the alternative breaches the `pre_tool_use`
      cap E2 fixes. Also in 4.2: `check_preamble_payload_budget` reads the projection SOURCE
      by default and is unchanged at 138,200 either way, so this criterion cannot be
      evaluated by that gate's default invocation at all.
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
