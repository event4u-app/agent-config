# Findings: feat-local-only-gate-reds
<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: 2fad22395807e464f4ab0b433d634057bc5754f17bd4ef53a147bc91261b6f0b | diff: 637c00913b9936d5ceb8fe5cdffa8eddd610ef47 | reviewer: r2-fresh-subagent-feat-local-only-gate-reds | prompt_hash: af6f5c846c0e5c1464b480700db53b2b6a5ba24807f93e2325b8116748370495 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 637c00913b9936d5ceb8fe5cdffa8eddd610ef47
  scope_hash: 2fad22395807e464f4ab0b433d634057bc5754f17bd4ef53a147bc91261b6f0b
  roadmap: agents/roadmaps/road-to-local-only-gate-reds.md
  roadmap_hash: 3882accbba90139d3e04411de605487d134b2b26f8e56134dd282429896da264
  ac_hash: 99a4182cd1c23b36c9dc0a8fe028aefe1acd50d6452ae6a227d1f0a2d0f5b43b
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-13T07:02:01Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | agents/roadmaps/road-to-local-only-gate-reds.md:65 | The new "fifth red" section says `check_gate_coverage` surfaces **one** gate the four did not include and documents only `check_ci_local_parity`. A fresh run exits 1 on **two**: `❌ check_ci_local_parity: scanned 357, floor 380` and `❌ lint_rule_skill_pack_reach: emitted no 'scanned: <N>' line — an enforced gate must report what it inspected`, footer `❌ 2 gate(s) failed the coverage floor.` The second is the gate this diff modifies. Cause: `SCANNED_RE = /^\s*scanned:\s*(\d+)\s*$/m` (check_gate_coverage.ts:64) requires the line to end after the number, and the gate emits `scanned: 116 rule(s), 289 skill(s), 34 pack(s) — 12 unreachable-route, 14 unrouted-skill`, which never matches — so an entry registered `status: enforced, min_scanned: 90` (gate-coverage.yml:184-188) has read `null` since it was registered by `924cad87f`, the commit Phase 2 step 1 identifies by name. The red is pre-existing (the emit line is unchanged by this diff), but the diff both edits that gate and adds prose enumerating this checker's reds, so the roadmap now makes a falsifiable claim the tool contradicts, and a red squarely inside the branch's declared subject ("red gates nobody sees") is left unrecorded. | open | |
| 2 | low | src/scripts/lint_rule_skill_pack_reach.ts:251 | `--root` with a missing value silently falls back to the real repository (`args.root = argv[i + 1] ?? REPO`). A self-test or contributor invocation whose root argument goes missing therefore scans `src/rules` + `src/skills` of the live tree instead of the fixture and can still exit 0 — a green run that proved nothing about the fixture it meant to test. That is the exact failure class `_lib/gate_self_test.ts` exists to prevent ("a scan root that moved… reports clean forever"). Rejecting a valueless or flag-shaped `--root` with exit 2 (the usage code this gate already reserves) would fail loudly instead. Not triggered by the five shipped cases, which all pass an absolute fixture path. | open | |
