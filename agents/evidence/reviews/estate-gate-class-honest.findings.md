# Findings: estate-gate-class-honest
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: f294dd5dd6cdfb8ed9d944e554cbdfab1b1e80b82ac851b9147898cf56468b97 | diff: 3a517f3aa760cc1c325fe87d87a3931fba2c232e | reviewer: r2-fresh-subagent-estate-gate-class-honest | prompt_hash: f2b6da5d97977be2bd926736120b1e6c8c0f214add0305794866277adb628c28 -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3a517f3aa760cc1c325fe87d87a3931fba2c232e
  scope_hash: f294dd5dd6cdfb8ed9d944e554cbdfab1b1e80b82ac851b9147898cf56468b97
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T18:20:04Z
-->

<!-- re-bind note (outside the manifest — the §5 block takes only its own keys).
Dispatched against the pre-fix scope
68ef564ca0205e02ae17eb4f1f4a99dc5d707a961b2b19218989c98f580ce9e9 at diff
4a8a488809212bf828e1877f0623381cafa80375, which is the required ordering; eight of
the nine findings were then fixed and the marker and manifest above re-pointed at
the reviewed-and-repaired content. The findings are unchanged, each carrying its
own outcome and fix ref. Review artefacts are excluded from the scope computation,
so this edit is a fixed point and does not move the hash it names.

An earlier dispatch of this same review used --base on the parent branch, which
pulled the merged origin/main content into the scope and produced a hash the
completion-review gate does not compute; it was discarded unfilled and re-dispatched
against origin/main before any reviewer saw it. -->

<!-- Scope note, because this branch is STACKED and the gate is not: its diff
versus main necessarily contains the three code files PR #1404 introduced and had
independently reviewed. That is why the critical finding below was reachable at
all — the reviewer read a tree in which the sibling spend-cap fix does not exist,
and caught prose asserting otherwise. -->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | `agents/evidence/analysis/gate-class-sweep-2026-08-17.md:278`; `agents/roadmaps/road-to-gate-autonomy.md:426` | § 4d(a) recorded the dropped `--budget` cap as "FIXED, in its own change", claimed all three targets forward, and closed `b-estate-prose-pass-from-1-3` partly on that basis — while at this branch's HEAD **none of the three forwards `{{.CLI_ARGS}}` and the guard test does not exist**. A money-safety defect declared fixed with its blocker closed, while the defect is live in the reviewed tree. | fixed | Correct, and the severity is right. Verified at HEAD: no `{{.CLI_ARGS}}` on `bench:ab:live`, `bench:ab:value` or `value:behaviour`, and no `tests/scripts/bench_ab_taskfile.test.ts` — the fix lives on `fix/bench-ab-budget-passthrough` (PR #1406), a sibling of this branch's parent, so it is not in this ancestry. Both passages now say DECIDED, name the sibling PR, and state plainly that the defect stays live here until it merges. The blocker stays RESOLVED because its own bar is "a recorded decision", which (a) has — but it no longer asserts tree state. Fixed in `3a517f3aa`. |
| 2 | high | `agents/roadmaps/road-to-surface-consolidation.md:335-338` | `benchmark-spend` was promoted to `Class: 2`, making it renderable as a consent gate for the first time, while its own `What to do:` and `Recommendation:` still claim the command "caps per-task spend" — the claim § 4c found false. Reachability increased on the one entry whose text is known wrong. | fixed | Correct, and the consequence is the reviewer's, not mine to argue away: I raised its reachability. A dated caveat now sits directly above `Blocks:`, where `gate_execute` renders it in front of a decider, naming both false statements, the sibling PR that makes them true, and an explicit "do not authorise (a) believing the cap applies" until it merges. The authored prose is left alone — correcting another roadmap's recommendation is its owner's call. Fixed in `3a517f3aa`. |
| 3 | high | `agents/evidence/analysis/gate-class-sweep-2026-08-17.md:244-248`, `:337` | The "within the bar" figures count only entries with **no `Recommendation:` at all**: no class-2 entry anywhere carries a 1–156-char one. So "over the eight that fit, the class-2 half is exactly what § 4 claimed" is false for all eight — they render `(none recorded — ask for one before deciding)`, and `lint_roadmap_blockers` flags every one for the missing field. | fixed | Correct, independently re-measured, and the correction is a **stronger** result than the claim it replaces. Of the 26 live class-2 entries: **16 over the bar, 10 with no recommendation at all, 0 usable.** So § 4's "21 of the 49 are one line and one yes away from resolved" describes **zero** entries. The passage now measures the field rather than the renderer's pass/fail, and says why the two differ — the check passes trivially at length zero. Fixed in `3a517f3aa`. |
| 4 | medium | `agents/evidence/analysis/gate-class-sweep-2026-08-17.md:335-337`; `agents/roadmaps/road-to-gate-autonomy.md:438` | "Over all **27 live** class-2 entries" counts `b-estate-prose-pass-from-1-3`, which the same passages state resolved out of the population two paragraphs earlier — the live reading is 26. | fixed | Correct, and it is the one entry the passage singles out as its own, which makes the slip worse rather than incidental. Both sites now read 26, with 16/10/0 against it. Fixed in `3a517f3aa`. |
| 5 | medium | `agents/evidence/analysis/gate-class-sweep-2026-08-17.md:246-248` | Denominator mixing inside one sentence: 11 is measured over the 19 entries step 1.3 made reachable, 13 is `21 − 8` over § 4's differently-scoped claim, so two of the thirteen were never measured against the bar. The same failure § 4d later guards against explicitly. | fixed | Correct, and pointing at my own guard sentence is fair. All three superseded figures — 8/19, 10/27 and the arithmetic 13 — are now named as superseded with the reason each is wrong, and the live 26/16/10/0 stated once. Fixed in `3a517f3aa`. |
| 6 | medium | `agents/roadmaps/road-to-gate-autonomy.md:149`, `:159`, `:195-203` | Step 1.3 is `[x]` and Phase 1 ✅ after its `verify:` clause was rewritten from "lint is green" to "reports no new violation", while at HEAD the gate exits 1 (28 against a baseline of 26). The acceptance bar was relaxed in prose to a level the branch could meet. | accepted-risk | The finding is right that the bar moved and that the party it judges moved it; the reviewer also confirms the 28-before/28-after measurement is real and the red pre-existing, and that adding `Class:` fields cannot create a decidability gap (the rule is class-independent). Left as disclosed rather than fixed, for the same reason as the parent branch's finding 5: the original clause is unmeetable without editing two entries in roadmaps this work does not own, and a silent rewrite — not the rewrite — is the violation. Recorded so the pattern stays visible across both branches. |
| 7 | low | `src/agent-src/scripts/roadmap_gates.ts:422-438` | `class` is added with no in-repo consumer, in the same comment that withdraws `run` for having none — the stated test for shipping a JSON field is applied to one and waived for the other without saying why. | fixed | Fair: the asymmetry was real and unexplained. It is not a preference, though — `road-to-gate-autonomy` step 1.3 names this field as its acceptance condition, and nothing asks for the command here. The comment now says exactly that, so the next reader sees the reason rather than inferring inconsistency. Fixed in `3a517f3aa`. |
| 8 | low | `tests/scripts/roadmap_gates.test.ts:251-256` | `classOf`'s cast annotates `Array<{ class: string; run: string }>` — documenting a `run` field the sibling test asserts is absent, and type-checking silently. | fixed | Correct. The annotation names only `class`, with one line saying why: a cast documenting `run` would tell the next reader the opposite of what the sibling test proves. Fixed in `3a517f3aa`. |
| 9 | low | `src/agent-src/scripts/roadmap_gates.ts:422-437` | 16 lines of comment for a one-line field, most of it narrating review-process history a future reader cannot resolve. | fixed | Correct — the review artefact is not a durable reference, and "R2 finding 7" means nothing to someone reading this file in six months. Cut to the load-bearing constraint plus the roadmap-anchored reason from finding 7. Fixed in `3a517f3aa`. |

**Two verifications the reviewer volunteered, recorded so they are not
re-litigated:** the class arithmetic is fully reproducible at HEAD
(`{2: 26, 3: 23}` over 49 records, 49 authored `Class:` lines = 48 open + 1 on the
resolved entry, exactly one default-resolved record, and all twelve § 4d verdicts
matching the live tree); `src/` and `dist/` are byte-identical; and 50/50 tests
pass.

**One population note worth keeping**, which no finding covers:
`road-to-product-bets.md` also holds an open, class-less blocker, excluded from
the 49 only because that roadmap is `status: draft`. So "exactly 1 resolves
through the default" is correct for the `gates` population and **not** for the
tree. Stated here rather than folded into a finding, because it qualifies a claim
this branch makes without making it false.
