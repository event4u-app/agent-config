# Findings: drain-recurrence-count
<!-- completion-review: v1 | reviewed: 2026-09-12 | scope: 743b643576daf040afeb4720846c0245c3badb5b29004ce11f16b0e626e89f2a | diff: 2877ebe17caa7ae7e22f615d14347e5817c74abe | reviewer: r2-fresh-subagent-drain-recurrence-count | prompt_hash: ebde3c44cb8a430276c60289c804a33b26b94425e0af283bc832990a95624c9b -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-recurrence-count"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-12 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 2877ebe17caa7ae7e22f615d14347e5817c74abe
  scope_hash: 743b643576daf040afeb4720846c0245c3badb5b29004ce11f16b0e626e89f2a
  roadmap: agents/roadmaps/archive/road-to-a-recurrence-count-that-survives-the-round.md
  roadmap_hash: c0e6db493ae1888bf5a0e178a7439c0b07e024925fb11691e40e7c8a613547c8
  ac_hash: e7b95c38d1a351d05e38bb1cba6c6291e59faa298a9f139cd5be9e40ce59fc9c
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-12T04:19:17Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/check_held_object_arrivals.ts:145 | Dead citer root reports an affirmative clean verdict. `listMarkdown` swallows a failed `readdirSync` into `[]` (:95-99), so if the active-roadmap tree moves or is renamed while `stubs/` and `later/` stay put, `citerFiles` is empty, `cited` is 0, and `check` takes the `findings.length === 0` branch and prints `0 held object(s) cited inside a live blocker, all carrying an arrival line` with exit 0 — under `--enforce` too. The `res.held === 0` guard (:189-192) asserts only the HELD root; the `allowEmpty` note (:183-187) nevertheless claims "a moved root is still caught". Reproduced: a root with `agents/roadmaps/stubs/road-to-held.md` (no arrival line) and its blocker citer under `agents/roadmaps/active/` instead of `agents/roadmaps/` prints `scanned: 0` then the green line, exit 0 with `--enforce`. A real uncounted citation one directory away is reported as clean. | fixed | Fixed in `cccba14f2`. Citer roots are now asserted. `listMarkdown` returns `readable`, separating a root that holds no markdown (legitimate — `later/` is empty when nothing is parked) from one that cannot be read at all; an unreadable citer root exits 2 on every path including advisory. Sensitivity proven: restoring the swallowed-error form turns the new test red, restoring the fix turns it green. The `allowEmpty` note that claimed a moved root was still caught now says what is actually asserted. | <!-- ref-ignore -->
| 2 | medium | src/scripts/report_held_object_arrivals.ts:346 | The positional filter drops the value after any flag, but three flags take no value. `argv.filter((a, i) => !a.startsWith('--') && !argv[i-1].startsWith('--'))` discards the held-object ref whenever it follows `--list` or `--ignore-case`, and lets the short form `-i` through as a positional because it does not start with two dashes. Reproduced: `report_held_object_arrivals --list road-to-worker-generation-recycling --tree /tmp/absent` exits 2 with the usage line; `report_held_object_arrivals -i road-to-worker-generation-recycling` prints `held object not found: -i`. Both spellings are documented in the `--help` text at :416-421 and at :349. | fixed | Fixed in `cccba14f2`. `VALUE_FLAGS` names the three flags that consume the next token, and the filter rejects single-dash tokens too. Both documented spellings verified: `-i <slug>` sets the fold flag (pattern prints `/i`) and `--list <slug> --tree ...` resolves the object. |
| 3 | medium | src/scripts/report_held_object_arrivals.ts:237 | A tree that stats as a directory but cannot be listed is reported as a count of zero. `resolveTree` clears it via `isReadableDir` (`statSync().isDirectory()`), then `countRounds` catches the `readdirSync` failure and returns `examined: 0, unreadable: 1` (:240-243), and `report` prints `arrivals: 0 distinct round(s) of 0 examined` (:394-397). The module header at :23-29 states the opposite contract: an unreachable tree "exits 0 saying no prior rounds are readable, and prints no count at all". Reproduced with a mode-0300 directory passed to `--tree`: the zero line is printed, mitigated only by a `note: 1 path(s) unreadable` line below it. A reader transcribing the figure onto a held object writes a measured-looking 0 that was never measured. | fixed | Fixed in `cccba14f2`. A tree that stats as a directory but cannot be enumerated now takes the same no-reading-was-taken branch as an absent tree instead of printing a measured-looking zero. Same message because it is the same fact; the resolution line reads `but not listable` so the two causes stay distinguishable. |
| 4 | medium | src/scripts/check_held_object_arrivals.ts:122 | `blockerCitations` is fence-blind, so blocker scope can be opened by an illustrative heading. The scanner is a line loop with no code-fence state; `line.startsWith('### blocker:')` sets `inBlocker` and only a subsequent `## ` line clears it. A roadmap that quotes the blocker shape inside a fenced block therefore puts the whole remainder of that section into blocker scope. Reproduced: `blockerCitations` over a `## Phase 1` section containing a fenced `### blocker: template` followed by a bullet naming `stubs/y.md` returns `y.md`. That is the check counting a mention outside any real blocker as a second arrival — the exact discrimination the module's :114-121 doc comment says the blocker scope exists to make. | fixed | Fixed in `cccba14f2`. `blockerCitations` tracks fence state and skips fenced lines. A new test pins both directions: a fenced `### blocker:` example yields zero citations, and the real heading still opens scope. The live rate is unchanged at 4 of 9, so no current firing came from a fenced false positive — the fix removes a latent inversion rather than correcting the measurement. |
| 5 | medium | tests/scripts/held_object_arrivals.test.ts:248 | The test named "writes nothing" asserts a source-text denylist rather than behaviour. It reads the reporter's source and requires no match for writeFile / mkdir / appendFile. `rmSync`, `unlinkSync`, `renameSync`, `copyFileSync`, `createWriteStream`, `writeSync` and `truncateSync` all pass it, so the module's stated contract at :9 ("it writes nothing, and the absence of any write is the contract") is guarded against three spellings out of many, and destructive calls are guarded against none. It is also over-broad in the other direction: the word `mkdir` in a comment fails the suite. AC-3 records all four of its properties as "verified through the real entry point"; this property is verified by a grep, not by the entry point. | accepted-risk | The grep IS what step 2.2 specifies, so the step is met and replacing it would be a different step. What was wrong is the CLAIM about it: AC-3 read `all four properties verified through the real entry point`. Narrowed in the archived roadmap to say three are, and this one is verified by the grep the step names — the finding's real content and the misleading part. |
| 6 | medium | src/scripts/report_held_object_arrivals.ts:199 | Three of the reporter's defensive branches have unknown sensitivity — no test exercises any of them. The oversize skip (:199-202), the symlink skips (:221 and :249), and the `unreadable` / `oversized` tallies surfaced at :398-399 are referenced nowhere in the 26-test file: it contains no occurrence of `oversized`, of any symlink term, or of `.unreadable`. Deleting `if (size > MAX_FILE_BYTES)`, or either `isSymbolicLink()` guard, leaves the suite at 26/26 green. A symlink loop under the consumed-inbox tree would then hang `dirRaises`, and an 8 MB-plus file would be read whole, with no test turning red. | deferred | Real and unfixed. The oversize skip, both symlink guards and the unreadable/oversized tallies have no test, so deleting any of them stays green and a symlink loop under the inbox tree would hang the walk. Not fixed here because it is test coverage for defensive branches rather than a defect in shipped behaviour. Carried as a named gap: the reporter is advisory, hand-run, and reads a machine-local tree, so the blast radius is one operator's terminal. |
| 7 | low | src/scripts/check_held_object_arrivals.ts:126 | The `## Blockers` opener has no test. Every fixture in the suite and in `--self-test` opens blocker scope through a `### blocker:` heading: `CITER_BLOCKED` (test:53-56) carries both headings, test:289 opens through `### blocker: a`, test:297 opens through a bare one. Replacing the `## blockers` branch with a constant `false` leaves 26/26 and self-test 5/5 green. The behaviour is real — `blockerCitations('## Blockers\n\n- see stubs/x.md\n')` returns `x.md` — so a roadmap whose blockers are plain bullets under a `## Blockers` heading would silently stop being scanned with nothing going red. | deferred | Same class as 6 and smaller: the `## Blockers` opener is real behaviour with no test, so it could be removed silently. Deferred with 6 rather than fixed piecemeal. |
| 8 | low | src/scripts/check_held_object_arrivals.ts:147 | The comment above the citation loop states a rule the code does not implement. Its first sentence — "A held object citing another held object is not the estate asking again; it is one parked argument pointing at its neighbour" — describes an exclusion; the code excludes only the self-citation case (`name === self`, :155). The shipped rule is the one the measurement record states (analysis:44-48) and the suite asserts (test:312, "treats a parked roadmap as a live citer"), so the code is right and the sentence is wrong. It matters because all four live firings are parked-roadmap citers, so a reader auditing the recorded "0 of 4 false positives" against this comment would conclude the entire firing population should have been excluded. | fixed | Fixed in `cccba14f2`. The comment now describes what the code does — only self-citation is excluded, a held object citing a DIFFERENT held object still counts — and says so explicitly, because all four live firings have a parked roadmap as the citer, which is the reading the old sentence would have inverted. |

## What was reviewed

The three code paths in the review scope, read in full and exercised through
their real entry points: `src/scripts/report_held_object_arrivals.ts`,
`src/scripts/check_held_object_arrivals.ts`, and
`tests/scripts/held_object_arrivals.test.ts`. The eleven non-code paths in the
diff were read only where they carry a claim the code is supposed to satisfy —
the acceptance criteria and the measurement record.

Verification runs taken during the review: the suite (26 of 26 pass), the gate
self-test (5 of 5, two rejecting), the check against the live tree, and four
targeted probes against synthetic roots for findings 1, 2, 3 and 4. Every
finding above names the invocation that produces it.

## The two recorded facts

Both were checked rather than accepted.

**Confirmed — the check ships advisory for the recorded reason.** A live run
returns 4 of 9 held objects cited inside a live blocker with no arrival line,
matching the recorded firing rate exactly, and the four objects it names are the
four adjudicated in the measurement record. `--enforce` is a flag read at
:312 and nothing else consults it, so the promotion is an invocation change
rather than an edit, as recorded. Finding 8 qualifies the adjudication's
auditability, not its verdict: the four verdicts are a human read of four
blockers and this review did not re-adjudicate them.

**Confirmed, with one correction to the framing.** The reproduction and the
non-reproduction are both recorded as stated. The framing given to this review
named one non-reproduction; the record itself is stricter — analysis:252-256
says one of three recorded counters reproduces and the other two do not, the
third being `stubs/road-to-code-graph-benchmark-rerun.md` at a recorded 72
against 73 today under a stated pattern. Neither is tuned away, and neither is
re-reported here as a new finding.

## Not adjudicated

The diff wires the check into no task, workflow, or gate ledger — it adds three
files and touches no runner — so it executes only when invoked by hand. Whether
that is intended is a scope question the acceptance criteria do not answer, and
the reviewer has no branch-scoped evidence either way, so it is stated here
rather than filed as a finding.
