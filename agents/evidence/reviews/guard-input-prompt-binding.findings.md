# Findings: guard-input-prompt-binding
<!-- completion-review: v1 | reviewed: 2026-08-13 | scope: 86beb9112ddbc88202b2b645b2f076516f4bf689d2484338b3b451e3c1076891 | diff: b93df013381e38ae0ca594c810905866b204ed71 | reviewer: r2-fresh-subagent-guard-input-prompt-binding | prompt_hash: 9442b32523a1113bf8bf6976a597218317d3ac5bf7e0d91e6fafd4cf593d4846 -->

<!-- context-manifest: v1
inputs:
  diff_sha: b93df013381e38ae0ca594c810905866b204ed71
  scope_hash: 86beb9112ddbc88202b2b645b2f076516f4bf689d2484338b3b451e3c1076891
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-13T00:36:22Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | taskfiles/ci-fast.yml:940 | The new Gate-R2 task runs the validator bare, with none of the exit-2 degraded-advisory wrapper both immediate siblings (`lint-plan-risk-register`, `check-completion-review`) carry. `plan-review-gates.md` § 6 binds "every future gate in this family": exit 2 means warn-and-allow, because "a broken gate must never block its own fix". The script's own docstring lists a malformed baseline and an unreadable corpus as exit-2 causes, so a one-character JSON typo in `review-prompt-binding-baseline.json` hard-blocks CI including the PR that repairs it. The task `desc` also drops the "→ degraded advisory" clause the siblings state, so the deviation reads as intentional nowhere. | fixed | 85d72ca1f |
| 2 | medium | src/scripts/check_review_prompt_binding.ts:179 | A `steered-prompt` finding has no exemption path by construction ("never baselinable"), the scan is corpus-wide, and the predicate is `preloadedVerdict` imported from `hooks/evidence_independence.ts` — a live, actively tuned regex list owned by a different concern, whose own docstring records a past phrase being dropped for false positives. The gate's docstring frames the current one-of-four clause coverage as "the detection floor this buys", i.e. a list expected to grow. Any future phrase added there retroactively converts already-committed prompts into permanent, unfixable blocks on every PR: the record may not be edited (this change's own premise), the finding may not be baselined, and nothing bounds the predicate to prompts written after the gate shipped. That is exactly the outcome § 2.7 names as fatal — "a gate whose only output is unfixable blocks is the gate that gets switched off". | fixed | 85d72ca1f |
| 3 | medium | src/scripts/check_review_prompt_binding.ts:20 | The "WHAT IT DOES NOT DO, stated so the gate is not oversold" section names only substitution, and concludes "steering must now be an act of SUBSTITUTION leaving its own artefact in the commit". Omission is cheaper and leaves no artefact: not committing `<slug>.review-input/prompt.md` drops the round out of `collectPackages` via the `no_applicable_files` skip, with no finding and no signal. Nothing in the tree requires the package to exist — grep of `src/scripts` finds only `dispatch_r2_reviewer` writing it and `check_secret_leak` excluding it. Measured on the committed corpus: 11 of 19 artefacts already carry `prompt_hash` with no package, so the bypassed state is the historical norm and is indistinguishable from it. The same overstatement is carried into `docs/contracts/plan-review-gates.md:766`. | fixed | 85d72ca1f |
| 4 | medium | src/config/review-prompt-binding-baseline.json:8 | The sole justification for two permanent suppressions — repeated at line 15 and in `docs/contracts/plan-review-gates.md:775` — is that "§ 2.7 forbids editing a round record". § 2.7 states the opposite for a live artefact: "The rename is an archival step at the end of a round, **never an edit ban on the live artefact**", and "Within a round, the binding artefact is re-bound in place." The freeze it does assert is scoped to archived records ("Archived records are frozen"), i.e. `<slug>.round<N>-review.md`. Both baselined slugs are live `*.findings.md` records still inside the gate's glob, so the cited clause does not cover them. A defensible reason may well exist (re-writing a marker hash to match a prompt that may not have produced the verdict would fabricate a binding) but it is not the one recorded, and `check_suppression_hygiene` can only check that a reason is long enough, never that it is true. | fixed | 491020a98 — both reasons and the contract paragraph now give the evidentiary reason (rewriting either side fabricates or erases a binding) and record that the § 2.7 citation was wrong |
| 5 | medium | src/config/gate-coverage.yml:45 | The header asserts "256 `lint_*` / `check_*` / `audit_*` scripts live under `src/scripts/` (the count is computed, not asserted — `check_gate_coverage.count_gate_scripts`)". Invoking that exact function on this tree, with the new script present, returns **255**. Line 52 explains the derivation — "255 scripts before this change plus the one it adds" — which is the previous revision's measured number plus one, i.e. adjusted toward the previous prose rather than recounted, in the same sentence that claims "Both halves are RECOUNTED here … never adjusted toward the previous prose". This is the drift the paragraph exists to make visible, and nothing gates the number. The entry-count half is correct (35 listed, 35 enforced, verified). | fixed | 491020a98 — corrected to the measured 255, with the mis-derivation recorded in the header rather than quietly replaced |
| 6 | low | tests/scripts/check_review_prompt_binding.test.ts:63 | At the reviewed scope the corpus test freezes live totals (`toBe(19)`, `toBe(17)`, plus line 64) against a tracked corpus that grows by one on every dispatched R2 round — including this change's own artefact, which § 2.5 requires to be committed before the fixes. Verified: with this round's package present the same functions read 20 packages / 18 binding, so the assertion is self-invalidating on this branch. | fixed | 85d72ca1f — the file at this commit carries no frozen count. Stated plainly because § 2.5 ordering matters here: the repair itself landed at ee5a61c84, one commit past the reviewed scope and BEFORE this artefact was committed, so it is not evidence of responding to this review. The reviewer flagged it against a scope already superseded and recorded it anyway, correctly. 85d72ca1f is the post-artefact commit that carries the corrected file and adds the duplicate-slug and steeredAck cases. |
| 7 | low | src/scripts/check_review_prompt_binding.ts:407 | The gate carries a `min_scanned` floor in `gate-coverage.yml` but publishes `scanned:` with a hand-rolled `process.stdout.write` at line 407 and calls `assertScanned` separately at line 412, after `evaluate()` has already run. `_lib/scan_scope.reportScanned` exists for precisely this case — its docstring says to use it "for any gate that should also carry a floor in `src/config/gate-coverage.yml`" and that splitting the two "lets the published number drift from the number that was validated — the invented-count failure that is mechanically undetectable downstream". The two expressions happen to agree today; no reason for declining the helper is recorded. | fixed | 85d72ca1f |
| 8 | low | src/scripts/check_review_prompt_binding.ts:190 | `prompt.md` is read from disk twice per package — once as `utf-8` for the steering predicate, once raw for the hash. One `readFileSync` plus `buf.toString('utf-8')` is equivalent, halves the I/O over the whole corpus, and removes the window in which the two reads could observe different bytes and produce a hash that does not correspond to the text that was screened. | fixed | 85d72ca1f |
| 9 | low | .gitattributes:50 | The binding is `sha256` over the raw bytes of a tracked text file, but no `text eol=lf` rule covers `agents/evidence/reviews/**` — the file pins `eol=lf` only for the `agents/memory` trees. On a checkout with `core.autocrlf=true` every prompt materializes with CRLF, so every binding in the corpus breaks at once and the gate exits 1 locally for that contributor, with a baseline that cannot cover it. Cheap to close with one line; the baseline reason at line 15 already shows CRLF was a live hypothesis during the investigation. | fixed | 85d72ca1f |
| 10 | low | src/scripts/check_review_prompt_binding.ts:354 | Two exit paths bypass the § 6 requirement that the `scanned:` line be "emitted on **every** exit path, exit `2` included": `parseArgs` calls `process.exit(2)` at lines 354 and 370 without emitting it. Separately, `evaluate()` sits outside the try/catch that maps failures to exit 2, and a non-`DeadScopeError` from `assertScanned` is rethrown, so an internal error there terminates the process with node's default exit 1 — the "policy violation, block" code — inverting § 6 for the very failures the docstring promises are exit 2. | fixed | 85d72ca1f |
| 11 | low | src/scripts/check_review_prompt_binding.ts:122 | `loadBaseline` builds the map with `out.set(entry.slug, …)`, so a duplicate `slug` silently overwrites the earlier entry and is never reported. The shipped file is a suppression list under `check_suppression_hygiene`, where a silently dropped entry — with its reason and falsifier — is the class of hole the ratchet exists to prevent; a duplicate key should be an error alongside the missing-field errors already raised above it. | fixed | 85d72ca1f |
| 12 | low | src/scripts/check_review_prompt_binding.ts:426 | `--json` writes the payload to stdout interleaved with the `scanned:` line, the ledger report and the summary line, so the output is not machine-parseable. Both baseline entries record `npx tsx src/scripts/check_review_prompt_binding.ts --json` as their falsifier; piping that documented command into a JSON consumer fails. Either route the JSON to a file or a distinct stream, or drop the flag's implicit promise. | fixed | 85d72ca1f |

## Scope grew after the review — what this artefact does NOT cover

The marker above binds scope `fe27f0c0` (head `578b33663`). The reviewer read
scope `364a1cad` (head `6ea08095`). The difference is **not** only the fix pass
its own findings caused, and the extra part is named here rather than absorbed
silently by the re-bind:

- `578b33663` — `docs(roadmap): capture the four gates that are red on main and
  unseen`. Adds `agents/roadmaps/road-to-local-only-gate-reds.md` and <!-- ref-ignore -->
  <!-- The roadmap was archived on 2026-08-13. The path above is left verbatim
       because this record states what THAT COMMIT added, and it added it there;
       re-pointing it at archive/ would make a true historical statement false.
       archive_completed_roadmaps treats agents/evidence/ as a frozen prefix and
       does not migrate it, while check_references requires it to resolve — the
       two-gate contradiction road-to-local-only-gate-reds recorded under its
       ci-reachability-decision blocker. This marker is the documented discharge. -->
  regenerates `agents/roadmaps-progress.md`. **The reviewer never saw either
  file.** It is a roadmap capturing four pre-existing gate reds unrelated to this
  change, added on the operator's explicit instruction after the review closed.
- `84c300c36` and `7fcc236eb` — two merges of `origin/main` (PRs #1321, #1322
  and #1325), taken because the branch fell behind twice during the push
  sequence. Neither carries work of this branch; both conflicted only in the
  generated dashboard, resolved by regenerating rather than hand-merging. Named
  for completeness — content that reached `main` through its own review is not
  this artefact's to re-certify.
- `0d70e7a67` and `6b6eed24e` — **the largest unreviewed addition, and it is
  code.** `check_ci_local_parity` built its CI-side gate set by regexing raw
  workflow text for `task <name>`, comments included; workflow comments say
  `task ci` while stating no workflow invokes it, so its local-only count was 0
  by construction. The repair strips comments before extraction, publishes the
  now-truthful count (167 of 247 local gates), records it as a shrink-only
  baseline, and corrects a pre-existing test assertion that had pinned the
  defect. Six new assertions. **The reviewer saw none of this** — it was found
  after the review closed, on the operator's instruction to investigate whether
  the trunk-red gates should have been possible.
  An AI council was asked to adjudicate the disposition and was unreachable
  (anthropic quota, openai trusted-directory refusal, two attempts), so the
  baseline is a staged choice recorded as such in the roadmap, not a verdict.
  This is the one entry in this list a reviewer should treat as genuinely
  un-reviewed code rather than as bookkeeping.
- `b93df0133` — wires `lint-design-antipattern-parity` into `consistency.yml`.
  Not a discretionary addition: the third merge of `main` brought that gate in
  registered only in the `ci:` task list, the new ratchet refused the merge at
  168 against its baseline of 167, and wiring it was the repair. Raising the
  baseline was rejected as the move its own failure message calls a defect;
  declaring it `local_only` was rejected because the reason would have been
  invented. Verified green before wiring, so it adds a passing step.
- `746f3fd38` — re-measures the gate-script denominator 255 → 257 after the first
  merge brought two further gate scripts. A one-token change to a comment in
  `gate-coverage.yml`, made because leaving a knowingly stale number in the
  paragraph that exists to catch stale numbers is the failure that paragraph
  already records twice. Post-review, and small enough to name rather than
  re-review.

**Revised 2026-08-13 — that reasoning no longer covers this artefact.** It was
written when the only addition was a roadmap and a regenerated dashboard, and it
argued from the addition having no executable surface. `0d70e7a67` changed a
gate's extraction logic and a ratchet baseline, which is executable and is not
bookkeeping. The honest position is therefore narrower than the original claim:
the § 2.5 ordering is still intact, and rows 1-12 still bind to the code they
were written against, but **this artefact does not certify the parity repair**.
A reviewer who wants that half reviewed needs a fresh round; nothing here should
be read as standing in for one.

A reader who needs the code half of this change reviewed has it: rows 1-12 bind
to it, and every fix ref points at a commit inside the reviewed lineage. A reader
asking whether the roadmap was reviewed has the answer in this paragraph: it was
not.
