# Findings: drain-adversarial-verification-close-round5
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: d88130a601d10fe1c3afe58e5ba84d68ca03dd896835c1e0d9441660b56c1615 | diff: 0172b670d664b3c0aa4f42e13357fc19b9c4e009 | reviewer: r2-fresh-subagent-drain-adversarial-verification-close-round5 | prompt_hash: ad7479fa7e504d4c05807e06d64d9fbe11b974f59be26b398b906b12ebd7ab5a -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-adversarial-verification-close-round5"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 0172b670d664b3c0aa4f42e13357fc19b9c4e009
  scope_hash: d88130a601d10fe1c3afe58e5ba84d68ca03dd896835c1e0d9441660b56c1615
  roadmap: agents/roadmaps/road-to-adversarial-verification-and-long-runs.md
  roadmap_hash: 1e8b154b6737ddfdf819ce29a6c249d88539612193f4bab211f06479a7649a67
  ac_hash: dff69a91b9cd9e1c4a83d25800e8570d75a424f4fc101ba8db6925e1dc1f26a0
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T02:44:21Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/_lib/forge_reader.ts:182 | `Math.min(FORGE_CALL_TIMEOUT_MS, budget)` is handed straight to `spawnSync`'s `timeout`, but `budget` comes from `budgetOf`, whose default clock is `performance.now()` and therefore fractional. While more than 10 s remains the minimum is the integer 10000 and nothing shows; once roughly 5 s of the 15 s budget has elapsed the minimum becomes the fractional remainder and `spawnSync` throws `ERR_OUT_OF_RANGE — timeout must be an integer` (reproduced on node v26.7.0 with this module's exact option set). The `try` at line 180 swallows it and the call returns `null`, so every forge call issued after the first ~5 s fails instantly with no subprocess at all and its rows degrade to `unread`. The shorten-the-ceiling mechanism this change was added to provide therefore never runs in production — a call admitted with under 10 s left is rejected by Node, not timed out — and the read truncates at 5 s rather than 15 s on exactly the many-ruleset repository the budget was sized for. That falsifies a claim the change makes about itself in four places: forge_reader.ts:88 "caps each spawn at min(FORGE_CALL_TIMEOUT_MS, remaining)", the `forgeProtectionJsonFor` comment "the per-call ceiling is whatever is left of the whole-read budget", docs/troubleshooting.md "a call is both admitted and timed out against whatever is left of it, so the total is a real ceiling rather than an advertised one", and the Phase 3.2 amendment's council-condition list "a call is TIMED OUT against what is left of the budget rather than only admitted against it", recorded as MET. Neither suite can see it: every `Runner` in both files is a fake and `defaultRunner` has zero coverage, so "shortens the per-call timeout to whatever the budget has left" asserts the arithmetic and never reaches the spawn that rejects it | fixed | the timeout is floored to an integer before it reaches the runner. Reproduced independently on node v26.7.0 first; a case now asserts the runner is only ever handed integers, over fractional, sub-millisecond and over-ceiling budgets. |
| 2 | low | src/scripts/_lib/forge_reader.ts:384 | In `readDeployRestricted`, a branch-policy entry whose `name` is not a string is silently dropped by the `filter`, so a malformed payload yields an empty pattern list for that environment, which `deployRestrictedFrom` maps to `false` and the row renders `unsatisfied` with the detail "at least one environment accepts a deployment from any branch" — a positive claim about the forge derived from data nobody could parse. Every sibling field in the same module takes the opposite route: a non-string environment `name` three lines up returns `null`, a non-numeric ruleset `id` returns `null`, a non-boolean `allow_auto_merge` returns `null`. forge_protection.ts chose `false` for a CONFIRMED-empty pattern list, which is a different input from an unparseable one. The direction is the safe one, so this under-reports rather than over-reports, but it contradicts the module's own stated invariant that every failure lands on `unread` | fixed | a non-string pattern name now returns null for the whole row rather than being filtered into an empty list that rendered as a positive claim about the forge. One case. |
| 3 | low | agents/roadmaps/road-to-adversarial-verification-and-long-runs.md:138 | The roadmap preamble here and the `daemon-host-kill-switch` blocker entry at line 981 both call the AC-6 owner artefact a "nine-item" brief, while the artefact under AC-6 carries eight numbered items, (1) through (8), plus an unnumbered "Where the answer goes" paragraph at line 1379. A reader counting items against the stated figure finds eight. This is the same class of hand-written, drift-prone count that the AC-5 entry in the same diff documents itself getting wrong four consecutive times before removing denominators by construction | fixed | the hand-written item count is removed from both places rather than corrected, which is the same lesson the stale-denominator recurrence forced four rounds earlier. |
| 4 | low | src/scripts/_cli/cmd_doctor.ts:3065 | `forgeProtectionJsonFor` is called unconditionally from `_emit_json`, which is also the single-check JSON path reached from line 3006 (`doctor --json --check <id>`). A previously pure-local command now spawns one `git` plus three or more `gh` processes and can block for the full 15 s budget on every `--json` invocation, including one that asked for a single unrelated check, and including any scripted or GUI consumer of the payload. The only scope control is an environment variable — there is no CLI flag, and the read is not gated on the requested check set | accepted-risk | measured at 4.2 s wall clock on this repository against the 15 s worst case. A CLI flag adds lines to a file the source-size ratchet only lets shrink, and gating on the requested check set would make the criterion's own command stop answering for the block it names. The documented env switch is the escape, and the read degrades to unread rather than failing the command. |

## Notes

Scope reviewed: the nine files named in `prompt.md`, at diff
`0172b670d664b3c0aa4f42e13357fc19b9c4e009`.

Verifications run (read-only): both new suites green — `forge_reader` 40 cases,
`doctor_forge_block` 14. The AC-5 total of **188** re-measured and confirmed
exactly: `forge_protection` 28, `test_provenance` 11, the e2e fixture 95, plus
the two above. `npx tsc -p tsconfig.json --noEmit` and `tsc -p
tsconfig.scripts.json` both clean. `grep -rn 'N=3' src/rules` returns exactly
the one line AC-4 names, `verify-before-complete.md:45`.
`check_enforcement_matrix --quiet` exits 0 with the 32-row message AC-6 quotes.
The moved `UNREAD_FORGE` export has no importer outside `forge_reader.ts` and
the two new suites, as forge_protection.ts claims. Finding 1 was established by
running `spawnSync` with this module's exact option set at a fractional timeout,
and by confirming that the remaining-budget expression is non-integer and below
`FORGE_CALL_TIMEOUT_MS` once roughly 5 s has elapsed.

Checked and found sound, recorded so a later round need not re-derive them: the
`{owner}/{repo}` substitution uses the function replacement form and is immune
to `$&` on top of the slug character-set check; `detail` carries no template, so
leaving it out of the substitution is correct; gating the `repository` field on
`read_from_forge` makes the offline-identical claim structural, and the
byte-identity case proves it; `deployRestrictedFrom` returns `null` rather than
a vacuous `true` on an empty environment set; `slurped`'s three page shapes each
have a case, and a failure in any of them blanks the whole list rather than
returning a partial one; `originUrl`'s `ls-remote --get-url` choice and its
`origin`-echo sentinel are both right; `spawnSync` returning a null status on a
missing binary or a kill is handled by the non-zero-status test.
