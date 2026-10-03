# Findings: rule-carrier-phase1b
<!-- completion-review: v1 | reviewed: 2026-10-03 | scope: dbd81dc92c8efb4f3790805c4d40780d0422d046131a5ec3f64a1052eda24a2d | diff: b25a8568050e0a1d70dbd7fd033f0eb6005093c7 | reviewer: fresh-subagent/rule-carrier-phase1b-2026-10-03 | author: claude-opus-5/worktree-agent-a2f2558c9c4303d4d -->

<!-- evidence-type: completion-review -->

<!-- context-manifest: v1
inputs:
  diff_sha: b25a8568050e0a1d70dbd7fd033f0eb6005093c7
  scope_hash: dbd81dc92c8efb4f3790805c4d40780d0422d046131a5ec3f64a1052eda24a2d
  roadmap: agents/roadmaps/road-to-a-rule-carrier-that-works-outside-the-repo.md
  roadmap_hash: 8b64e496f732c88c75111664f229b735369df80f67713752be2a2c1e0ea5c722
  ac_hash: 6d2168b4efde3c3a14089279cbffd86f8041b1cb28e6e8b25e82aec57c8a5e47
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-03T04:31:00Z
-->

Dispatched over the whole delta of `drain/rule-carrier-phase1b-20261002` against
`origin/main` — 19 files — with a prompt that named the scope, pointed at this
roadmap's Goal / Context / steps 1.3–1.7 / Acceptance Criteria as the contract,
listed angles to look at, and stated no expectation of the outcome in either
direction. The reviewer read the diff in full plus the surrounding code, and ran
no tests.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/hooks/rule_inject_hook.ts:588-603 | Phase 1 emits a high-consequence rule's law and sets `form = 'law'`; phase 2 then skips anything not still `omitted_budget`, with no upgrade path. A class member can therefore **never** receive its whole body however empty the budget is, and its id enters the seen-set on the way out, so the body does not come back on a later turn either. 23 of the 28 members have a law section; `security-sensitive-stop` drops 5,687 chars to 429 (92.5 % withheld), `secret-vcs-guard` 4,981 → 394. On `origin/main` every selected rule got its whole body. D1's "then the highest-priority full body that fits" reads as a floor and was implemented as a ceiling; the D1 fixture sized both bodies so only one fit, which cannot tell the two apart. | fixed | `put` replaces a part in place and charges only the delta; 2 fixtures (body-when-there-is-room, law-when-there-is-not), sensitivity checked (b25a85680) |
| 2 | high | src/scripts/hooks/rule_inject_hook.ts:493 | `highConsequenceIds` used `Object.keys(members)` and ignored `no_stub` — the subset whose law was DECLARED unable to stand alone, which is why the projector ships those full-bodied. `rule_consequence_class.ts` exports `stubLawIds` for exactly this distinction. | fixed | carrier calls `stubLawIds`; fixture sizes the budget so the wrong reader lets a `no_stub` member pre-empt a higher-scoring body (b25a85680) |
| 3 | medium | src/scripts/hooks/rule_inject_hook.ts:588 | D1's "the law of **every** matched high-consequence rule" was not guaranteed: `ranked` came from `sel.selected` alone and `selectForInjection` ranks on score with no knowledge of the class, so a member in `sel.dropped` never reached phase 1. | fixed | text for a dropped class member is loaded; fixture reds without it (b25a85680) |
| 4 | medium | rule_inject_hook.ts:598-608; rule_inject_foreign_matrix.test.ts:380 | On a restore, a rule with no law section was labelled `omitted_budget` — which by 1.5's own semantics blames a budget decision that was never made. The matrix pinned the wrong label. | fixed | law-less rules compete for their body on a restore, so every label is true of the rule it names; matrix column updated (b25a85680) |
| 5 | medium | tests/scripts/rule_inject_hook.test.ts:1090-1112 | "The restore obeys the same character budget" was vacuous: `withLaw(id, 900)`'s *law* is ~40 chars, so it asserted a ~400-character string against an 8,000 cap and would stay green with the budget code deleted. | fixed | `withLongLaw` gives three 3,500-char laws that cannot all fit (b25a85680) |
| 6 | medium | tests/scripts/rule_inject_hook.test.ts:1144-1152 | The digest half of `projectKey` was unexercised: both roots came from `mkdtemp`, so their basenames already differed and the test passes if the digest is dropped. | fixed | new case gives both roots the basename `api` (b25a85680) |
| 7 | medium | _lib/rule_layer_overlap.ts:163-168 + rule_inject_hook.ts:694 | In this checkout `<project>/.claude/rules` carries 13 files against 120 in `dist/agent-src/rules`, so with no global layer the carrier delivers 13 of ~120 — read as the inverse of the step's intent. | accepted-risk | The filter is RIGHT: scope is what the host loads, and a host loading 13 files has the agent under 13 rules. It reads as a regression against the step's framing, not its contract. Recorded in the roadmap. |
| 8 | medium | src/scripts/hooks/rule_inject_hook.ts:804 | `takePending` cleared the pending set BEFORE `restore` could fail, so a failed build (package moved, or an upgrade renamed the pending rules out of the router) lost it permanently and silently — on the one slot that does not come round again for that boundary. | fixed | split into `readPending` / `clearPending`; the clear is last. Fixture removes the router, asserts the set survives, restores it and asserts the restore still fires (b25a85680) |
| 9 | low | tests/scripts/rule_inject_hook.test.ts:1137 | `EVENT4U_CONFIG_HOME` is honoured ahead of `$HOME` by `event4u_root` and is deliberately not neutralised by `hermetic-env.ts`, so a developer carrying it reds the state-location cases. | fixed | stubbed in `beforeEach` — the same machine-dependence class step 1.3 found in `$HOME`, one variable over (b25a85680) |
| 10 | low | src/scripts/hooks/rule_inject_hook.ts:566, 623 | The byte budget did not reserve the manifest while the character budget did, so emitted bytes could exceed the registered 16,384-byte row by the manifest's length. | fixed | both units reserve it (b25a85680) |
| 11 | low | src/scripts/hooks/rule_inject_hook.ts:883 | The dispatcher prepends this concern's own `reason` line to the payload (`_parse_concern_stdout` joins `stated` and `extra`), adding ~60-70 characters outside its own budget — against the 728-character margin named as conservative. | accepted-risk | Recorded in risk-register row 5, which is where "which string the host measures" already lives as the open question |
| 12 | low | src/scripts/hooks/rule_inject_hook.ts:618-629 | Manifest truncation dropped rows from the tail in router order, so a rule actually delivered could be truncated out and counted under `omitted_budget` — the one thing AC-2 forbids outright. Unreachable on today's router. | fixed | undelivered rows are dropped first (b25a85680) |
| 13 | low | rule_inject_hook.ts:551-554; test :775 | A readable file that strips to empty is labelled `source_unavailable`, which 1.5 defines as blaming the install. | accepted-risk | There is no usable source text, which is what the label says; the alternative blames a budget decision nobody made. A choice between two imperfect labels in a closed four-value vocabulary, recorded as one |
| 14 | low | src/scripts/hooks/rule_inject_hook.ts:489-497 | `highConsequenceIds` re-read and `JSON.parse`d a 12 kB config on every fire and resolved `ruleSources` a third time in the same dispatch. | fixed | memoised per root; a dispatch is one process and an install does not change under it (b25a85680) |
| 15 | low | src/scripts/hooks/rule_inject_hook.ts:299-305 | The seen-set accumulates one file per (project, session) under the user-global root with no retention; `janitor.ts` is project-scoped and never swept `rule-inject` even at the old location. | deferred | A real gap. A janitor change is a different surface from this phase; recorded in the roadmap |
| 16 | low | tests/scripts/rule_inject_hook.test.ts:104 and the new blocks | Temp-directory leakage: the module-scope `HOME` and the new blocks' trees were never removed, unlike the pre-existing blocks above them. | fixed | every tree goes through a tracked `mkdtemp` and is removed in `afterAll` (b25a85680) |
| 17 | low | src/config/hook-token-budget.json | Step 1.6 added an emitter to `session_start` without re-checking `per_slot_sum_caps_bytes.session_start`. | deferred | The slot sums are an authoring-time control read by `bench_hook_injection`; re-deriving one is a measurement this phase did not take. Recorded in the roadmap |

## What the reviewer checked and could not fault

Recorded because coverage and silence are different things. The reserve-then-fill
arithmetic, hand-computed at the boundary (admitted at `cost = 7935 = left`,
refused at 7936) · the byte-check fixture's sensitivity, including that
`selectForInjection` always admits the first candidate so the dense body really
does reach `compose` · the D1 ordering fixture's sensitivity · the
manifest-truncation property and its termination · `statePath`, and that nothing
else in the tree read the old location · the ledger join, read back by the same
two arguments the other side uses · the `$HOME` fix, including that
`write_target` reads `process.env` at call time · the completeness of the
`gitignore_block` extraction, name by name, and that the function bodies are
byte-identical · `write_managed_block`'s append-only and best-effort behaviour ·
the `ai_council` import split · manifest / compiled-JSON consistency and the
unchanged concern declaration block · `emitFor`'s landing place · the
`session_start` source gate.

## The ordering this artifact deviates from, named rather than implied

Contract §2.5 asks for the findings artifact to be committed BEFORE the commits
that fix its rows, so that `fixed` cannot be written after the fact. This one
was written after: the review returned while the branch was already in CI, the
fixes landed in `b25a85680`, and this file is added on top of them. The gate
reports that as `fix-before-artifact` and it is right to.

It is recorded here rather than worked around — marking the already-landed rows
`open` would have made the table false, and reverting a correct commit to
re-land it in the contract's order would have put noise in the history to buy a
property the history itself would then no longer show. What the contract is
protecting is the possibility of writing `fixed` for work nobody did; every row
above names the mechanism and the fixture, and each fixture was checked by
neutralising the mechanism and watching it red.

## What this review did NOT cover

The reviewer ran nothing, so the bundle-size readings and the lowered
`check_source_size_budget` baseline are unverified by it — both are gate output
quoted in the roadmap and reproducible by running the gates.

It also raised one pre-existing infrastructure observation that is not this
diff's: `tests/_lib/ensure-build-artefacts.ts` builds `dist/` only when ABSENT,
so the foreign matrix exercises whatever `dist/hooks/dispatch.js` is on disk. A
stale local build would make those 13 columns a statement about older code.
