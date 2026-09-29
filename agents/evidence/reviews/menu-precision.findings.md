# Findings: menu-precision
<!-- completion-review: v1 | reviewed: 2026-09-29 | scope: 775a1a328d8c10dc42df304b431ab0a8c0942b1ff5c87ed012f3ab6c211d95e0 | diff: 028a640b0ca28f752800272a991d801a5b1f389d | reviewer: r2-fresh-subagent-menu-precision | prompt_hash: 8d20e063dd0fe800533fd52ece5523df0ae7a260ce004c49437dfe41f0ecb81f -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-menu-precision"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-09-29 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 028a640b0ca28f752800272a991d801a5b1f389d
  scope_hash: 775a1a328d8c10dc42df304b431ab0a8c0942b1ff5c87ed012f3ab6c211d95e0
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-09-29T20:17:20Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/check_routing_coverage.ts:245 | `baseResolvable` probes ref existence, but the branch arm needs a merge base. In a shallow clone `git rev-parse origin/main` exits 0 while `git diff origin/main...HEAD` exits 128; the failure was swallowed as an empty path list and the gate reported green over a committed corpus-less skill. | fixed | 028a640b0 — probe is the diff itself (`baseUsable`) |
| 2 | high | src/scripts/check_routing_coverage.ts:592 | The affirmative verdict line claimed every touched skill carries a corpus even when the scope reported `measured: false`. | fixed | 028a640b0 — the claim is narrowed to what ran |
| 3 | medium | src/scripts/report_skill_menu_census.ts:398 | `selectingKeys` was computed and never read, so the documented falsifiability (a preset gaining such a key changes the number) was false in both halves. | fixed | 028a640b0 — documented as a tripwire; the note is withheld and the key named |
| 4 | medium | tests/scripts/check_routing_coverage.test.ts:197 | Every fixture left its edit uncommitted, so the `base...HEAD` arm — the only one CI uses — had zero coverage. This is why finding 1 survived a green suite. | fixed | 028a640b0 — four unit cases and two self-test cases commit onto a branch |
| 5 | medium | src/scripts/measure_skill_ranker_baseline.ts:142 | The line reader accepts only a double-quoted single-line prompt; a single-quoted or folded case would be dropped silently, and `missing_label_key` is computed with the same reader so it could never report the drop. | fixed | 028a640b0 — a parity test pins the reader to a real YAML parse |
| 6 | medium | src/scripts/check_routing_coverage.ts:246 | The base guard discarded the working-tree, index and untracked arms, which need no base ref, so an unresolvable base degraded the scope to zero coverage where partial was available. | fixed | 028a640b0 — the local arms are measured regardless |
| 7 | low | src/scripts/report_skill_menu_census.ts:414 | `frontmatterDescription` counted `\|"` as two characters, over-reporting the menu by 56 B across 13 skills. | fixed | 028a640b0 — escapes decoded; 59,076 B, delta 311 B |
| 8 | low | docs/SKILL_CENSUS.md:1 | "The column sums exceed the total" is false in this tree: no skill declares more than one pack, so the columns sum to exactly 198. | fixed | 028a640b0 — stated as a renderer property with the measurement beside it |
| 9 | low | docs/SKILL_CENSUS.md:1 | Nothing in CI compares the committed census table with `--census` output, so it drifts as skills gain corpora. | accepted-risk | Accepted by this branch. A freshness gate costs a gate-coverage registration and a ratification artifact for a dated snapshot the file already labels as such; the doc now says plainly that nothing keeps it fresh. |
| 10 | low | tests/scripts/report_skill_menu_census.test.ts:213 | Two tests asserted less than their names promised — the shipped-preset claim ran against temp fixtures. | fixed | 028a640b0 — assertions run against `src/config/profiles/*.ini` |
| 11 | low | src/scripts/report_skill_menu_census.ts:487 | `--profile` returned before the `--emit` branch, so `--profile x --emit` skipped the artifact write silently. | fixed | 028a640b0 — the combination is refused |
| 12 | low | agents/evidence/ac-capability-scorecard.yaml:178 | The `#top-1` evidence anchor resolves against any prose occurrence, so it pinned nothing. | fixed | 028a640b0 — anchors a table row |
| 13 | low | src/config/gate-coverage.yml:613 | The `corpus:` prose still describes only the two denominators and does not mention the third scope. | accepted-risk | Accepted by this branch. `min_scanned: 300` remains honest (405 scanned from the two denominators); editing this file requires a ratification artifact, which is disproportionate for a prose touch that changes no enforcement. |
| 14 | low | src/scripts/measure_skill_ranker_baseline.ts:88 | `readLabelledPrompts` drops a row whose `expected_skills` precedes `id`/`prompt`, with no counterpart to `missing_label_key`, and does not filter empty labels as the matrix arm does. | deferred | agents/roadmaps/road-to-a-menu-whose-precision-is-measured.md — no live instance (0 empty labels in those two corpora); the asymmetry belongs with a future change to that reader, not to this one. |
| 15 | low | src/scripts/measure_skill_ranker_baseline.ts:357 | `misses` counts top-3 misses only and the field carries no comment, so a reader cannot reconstruct the top-1 misses. | deferred | agents/roadmaps/road-to-a-menu-whose-precision-is-measured.md — reporting change with no effect on any measured figure. |

**Ordering note, stated rather than hidden.** This artefact was committed AFTER
the fixes it records, so the § 2.5 findings-before-fixes ancestry check will
report against it. That is the true history: the review was dispatched to a
fresh subagent on the pushed branch, the findings came back, and the repairs
landed before the R2 package was scaffolded. Recording the findings late is
worse than recording them on time and better than not recording them at all,
which is why the artefact exists and why this paragraph does rather than a
re-ordered commit history.
