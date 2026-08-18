# Findings: feat-gate-autonomy
<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: f6592e6198395a9b4ccbd215dc57448d4cbf1f35b90e300536d6f76c6c1cbd66 | diff: 3c9abbf6bef50a8479bc5e01c501fe52cc1f19d5 | reviewer: r2-fresh-subagent-feat-gate-autonomy | prompt_hash: 820e0562236bb6b2869d11b1c187162db9df10a08e2b86f8489d391a1dc38e8d -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-17 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 3c9abbf6bef50a8479bc5e01c501fe52cc1f19d5
  scope_hash: f6592e6198395a9b4ccbd215dc57448d4cbf1f35b90e300536d6f76c6c1cbd66
  roadmap: agents/roadmaps/road-to-gate-autonomy.md
  roadmap_hash: f4f6f56a3fd6a0fb4deec17851addf5a19dcd289794d1da5a6b0b35eeb24bf63
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-17T14:09:58Z
-->

19 findings from a fresh reviewer over the whole diff. The rows were committed
with every Status `open` **before** any fix (`docs(review): the R2 completion
review, 19 findings, all rows open`); this artefact is that same set re-bound in
place to the post-fix scope, with each row's outcome recorded. File:line columns
refer to the pre-fix revision the reviewer read.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/agent-src/scripts/gate_execute.ts:225 | `spawnSync(command, { shell: true })` executes an arbitrary shell string read from a roadmap markdown field, with no echo-before-run and no this-turn confirmation. The stated mitigation only checks that `Run:` exists — the lint never inspects the command — so a mis-authored `Class: 0` + `Run:` pair yields repo-root code execution on one keypress, including Hard-Floor actions. | fixed | `--confirm` now required; the command is echoed and refused without it. A Hard-Floor command is refused even WITH it — class 0 means reversible, so such an entry is misclassified. Fixed in `3c9abbf6b`. |
| 2 | high | agents/roadmaps-progress.md:5 | The dashboard was regenerated after the `blocker_is_resolved` fix yet still reported 50 open blockers / 22 need you, and still rendered a resolved entry as a live decision. The predicate was correct; the committed artifact was stale. | fixed | Regenerated with the current `dist/` projection: 49 open, 21 need you, the resolved entry gone. The staleness was `./agent-config` running the pre-fix dist. Fixed in `3c9abbf6b`. |
| 3 | medium | src/agent-src/scripts/gate_execute.ts:139 | `appendEvidence` bounded the blocker body only at the next `### blocker:`, so for the LAST blocker in a file the evidence bullet landed at the end of the file — after the risk table — contradicting the function's own docblock. | fixed | Body now ends at the next blocker OR the next `##` section; fixture asserts the bullet precedes `## Risk Register`. Fixed in `3c9abbf6b`. |
| 4 | medium | src/agent-src/scripts/gate_execute.ts:70 | `locate()` rebuilt the file path from `basename(r.rel)`, discarding the directory and ignoring the absolute path the collector already resolved. | fixed | Uses `r.path`. Fixed in `3c9abbf6b`. |
| 5 | medium | src/agent-src/scripts/resume_probe.ts:228 | `stepIsDone` matched the step id anywhere on a checkbox line and returned the first match, so an unrelated earlier line could decide the verdict. | fixed | Anchored to the label position; fixture uses the reviewer's own `raise the cap from 2.0 to 2.1` shape. Fixed in `3c9abbf6b`. |
| 6 | medium | src/agent-src/scripts/resume_probe.ts:63 | `COMPOUND_RE` carried no `i` flag while every sibling regex did, so a lowercase conjunction escaped the guard. | fixed | Case-insensitive **and** narrowed to the condition clause — see the note below; the flag alone broke the probe the other way. Fixed in `3c9abbf6b`. |
| 7 | medium | agents/roadmaps/road-to-gate-autonomy.md:147 | Phases marked done while their ACs are knowingly unmet, and the deferred class write-back tracked in step prose only — lost when the roadmap archives. | fixed | Became open step **1.3**. AC-1 and AC-2 now state plainly that they are unmet and what carries the remainder. Fixed in `3c9abbf6b`. |
| 8 | medium | src/agent-src/scripts/gate_execute.ts:190 | Step 2.1's `verify:` asks for an over-budget path that renders rather than executes. No such path exists: class 1 only tests ledger existence and `Blocker.budget` is read nowhere. | deferred | **Not fixed, deliberately.** The budget model it would compare against is `b-gate-budget-preauth` and still the maintainer's; building one to green a checkbox is the invented ledger the same step refuses. Recorded in the 2.1 note and added to the blocker's `Blocks:`. |
| 9 | medium | src/agent-src/scripts/gate_execute.ts:252 | The write path left the derived dashboard stale without saying so. | fixed | The resolved report now names `agent-config roadmap:progress`. Fixed in `3c9abbf6b`. |
| 10 | low | src/agent-src/scripts/gate_execute.ts:30 | Docblock claimed class 3 is byte-identical because "it calls the same renderer"; it calls no renderer. | fixed | Docblock rewritten to describe the mechanism that exists. Fixed in `3c9abbf6b`. |
| 11 | low | src/agent-src/scripts/roadmap_gates.ts:243 | Docblock claimed empty findings "render nothing at all", contradicted by its own next paragraph. | fixed | Corrected: no park notes renders nothing; park notes with none fired still print the coverage line, deliberately. Fixed in `3c9abbf6b`. |
| 12 | low | src/agent-src/scripts/roadmap_gates.ts:573 | The no-roadmaps-directory JSON branch omitted the three keys `renderJson` always emits. | fixed | Emits every key. Fixed in `3c9abbf6b`. |
| 13 | low | src/agent-src/scripts/gate_execute.ts:133 | The blocker id was interpolated unescaped into `new RegExp(...)`, throwing after the command had run. | fixed | `escapeRe`; fixture uses `b-foo(1)`. Fixed in `3c9abbf6b`. |
| 14 | low | src/agent-src/scripts/resume_probe.ts:152 | `extractCondition` searched the whole file for the marker, so body prose could become the condition. | fixed | Restricted to the blockquote, with fenced examples blanked. Fixed in `3c9abbf6b`. |
| 15 | low | src/agent-src/scripts/gate_execute.ts:232 | `r.error` never read: a spawn failure reported "exited null" with no diagnostic. | fixed | Read and reported. Fixed in `3c9abbf6b`. |
| 16 | low | src/agent-src/scripts/gate_execute.ts:95 | The consent Question silently borrowed `Blocks:`, and the default was one constant string. | fixed | The fallback says it is the Blocks line; the default is derived from whether a recommendation exists. Fixed in `3c9abbf6b`. |
| 17 | low | agents/roadmaps/road-to-gate-autonomy.md:103 | "Eight new tests" — the diff adds nine. | fixed | Corrected, with the correction named in the note. Fixed in `3c9abbf6b`. |
| 18 | low | src/agent-src/templates/roadmaps.md:146 | The template shipped `Class: 3` alongside `Run:` and `Budget:`, producing exactly the confusion the same rule warns about. | fixed | The optional fields moved into a comment that states when each applies. Fixed in `3c9abbf6b`. |
| 19 | low | src/agent-src/scripts/roadmap_gates.ts:583 | `--execute` was parsed after the `--pending` early return, ignored `--json`, and had no usage output. | fixed | Parsed first, refuses both combinations loudly, prints usage. Fixed in `3c9abbf6b`. |

## What fixing finding 6 taught, recorded because it is the transferable part

Adding the missing `i` flag was correct in itself and **immediately produced the
opposite false result**: an ordinary "and" in the prose *after* the condition
read as a second conjunct, every condition became compound, and the one
genuinely fired note in the tree dropped out — a false negative created by
fixing a false positive. The discriminator that makes the case-insensitive test
safe is structural: park notes bold the condition and explain it afterwards, so
`conditionClause` analyses the bolded span and treats the paragraph after it as
commentary. Both directions are fixtures.

## What the reviewer checked and found clean

Recorded so the gaps are legible rather than inferred from silence: the sweep
arithmetic (all five percentages, the uncorrected 24.0 %, the 37-of-49 figure
and the eight-of-twenty-one threshold) re-counted and correct; the
pre-registration commit verified to exist with sections 3 and 4 empty; the
"HARD, not ratcheted" claim verified against the code path; `blocker_is_resolved`
verified to match the lint's existing prefix semantics; src/dist parity verified
blob-identical; the gate-execute fixtures counted.


## Acceptance-criteria binding — this review was AC-BLIND

Recorded 2026-08-18, after the fact.

The manifest above carries `ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`,
which is the SHA-256 of the **empty string** rather than of any criteria. This
review was dispatched against `agents/roadmaps/road-to-gate-autonomy.md`,
which declares its criteria as inline `- **AC-n:**` bullets per phase and
carries no `## Acceptance Criteria` heading at all, while the extractor of the
day matched the heading form and nothing else. The reviewer therefore received a **0-byte** `acceptance-criteria.md`
under a prompt stating that the acceptance criteria had been extracted for it.

**So the findings above review the DIFF, and nothing in them was checked against
the acceptance criteria** — the criteria were not in the reviewer context at all.
The same roadmap yields 27 lines of criteria under the extractor as it stands
today. The extractor learned the inline form in PR #1419 (2026-08-18).

The manifest is deliberately left unchanged. `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
is the honest record of the input this review actually received, and rewriting it
to today's value would assert a binding that never existed — the precise failure
this note exists to prevent. The artefact binds a scope that no longer exists, so
no gate re-derives it and nothing here is stale.
