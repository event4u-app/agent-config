# Findings: drain-road-to-a-brand-20261019x
<!-- completion-review: v1 | reviewed: 2026-10-18 | scope: b52e20f07964d303cbf9055e2438ab75bc0386fe11e482ed74f1af45f11dede0 | diff: 31e62cfd4c71f73a099a9055059ed8bb351852fd | reviewer: r2-fresh-subagent-drain-road-to-a-brand-20261019x | prompt_hash: f193ac030c4b560783538817fdc0fcb15d717202f081308cd2771993cdbba197 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-road-to-a-brand-20261019x"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-18 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 31e62cfd4c71f73a099a9055059ed8bb351852fd
  scope_hash: b52e20f07964d303cbf9055e2438ab75bc0386fe11e482ed74f1af45f11dede0
  roadmap: agents/roadmaps/road-to-a-brand-the-tree-can-check.md
  roadmap_hash: d283f415ca001ca3e7a41a3d5dd9c5afb220ef849ea086d032dc788bc3e8d731
  ac_hash: 2f573fca320a87edda26bf45794e4de42226fd53db37569dd77a816f7f77f970
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-18T22:39:08Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/check_voice_lexicon.ts:388 | Empty or absent stdin is treated as a clean draft. `readStdin()` returns `""` when the first read hits EOF (an unpiped call under a host whose Bash stdin is `/dev/null`, or an empty pipe), `raw !== null`, and `main` prints "no lexicon or claim findings" with exit 0. The `/ghostwriter:write` 5b text (command.md:123-125) promises exit 2 for "no input", and every surface relies on exit 2 to avoid presenting an unchecked draft as checked — so the commonest misuse (forgetting the pipe) yields a false clean. No test covers `--draft -` with empty input. | open | |
| 2 | medium | src/scripts/check_voice_lexicon.ts:364 | `unwrapSingleFence` fails silently, and the fallback hides the whole draft. When the single-fence regex does not match — a four-backtick outer fence, an indented or trailing-text closing fence, or a ``` body inside a ``` outer — the text comes back unchanged and `blankExempt` blanks everything between the first and the next triple fence. The draft then reports "no lexicon or claim findings", exit 0. A profile taboo in such a draft would not abort `/ghostwriter:write`. There is no warning when the input starts with a fence that was not unwrapped. The two-fence test asserts only the passthrough, not the clean result it leads to. | open | |
| 3 | medium | agents/roadmaps/road-to-a-brand-the-tree-can-check.md:604 | AC-6 is ticked on string-presence evidence. The AC says a planted term in a finished draft from the four surfaces "produces a located finding". E13 cites the `draft-surfaces` cases, but those only check that each command/skill file contains `check_voice_lexicon.ts --draft -` and an "Exit 2" sentence. Whether a draft from those surfaces is ever checked depends on the model following prose, which is exactly what the rule's own `enforced_by` now calls `instruction-only`. Together with findings 1 and 2 (silent false-clean paths), the AC's observable property is not demonstrated for any surface. | open | |
| 4 | low | tests/scripts/check_voice_lexicon.test.ts:249 | The `negative-corpus` case is a live ratchet with zero tolerance over unrelated guideline prose. At about 98k words, a single hit reads 0.102 and fails the case. So a future `docs/guidelines/**` edit that legitimately writes e.g. "zero downtime" (a migration guideline) or "we guarantee" reds a brand test far from the change. It also turns the frozen pre-registered measurement into a moving one. Pinning a word-count floor or a hit budget, or asserting over a frozen snapshot, would separate the regression signal from that coupling. | open | |
| 5 | low | tests/scripts/check_voice_lexicon.test.ts:242 | The NG-10 pin treats any hyphen as a phrase separator (`/[\s\-.]/`). Single hyphenated tokens such as `risk-free`, `best-of-breed` and `award-winning` therefore pass as "not a bare word", even though they are one whitespace token, the same unit the corpus word count uses. The test is weaker than the "no single-word claim detection" statement it is cited for. Either the test or the evidence note should say that hyphenated compounds count as phrases by design. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
