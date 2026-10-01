# Findings: tree-keeps-neighbours
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 78737fc984e1954248267c76cb76521cfeb536b22cf11f20debcf000dfeae055 | diff: 927a9cfe58a0f7f319ad0af5e387b727a879aaec | reviewer: ai-council-anthropic-openai -->
<!-- {"review-independence":{"review_independence":"multi-provider","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["anthropic/claude-sonnet-4-5","openai/codex-default"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 927a9cfe58a0f7f319ad0af5e387b727a879aaec
  base_sha: 162889e8b16359904766927a7fbd896f961ed9b9
  scope_hash: 78737fc984e1954248267c76cb76521cfeb536b22cf11f20debcf000dfeae055
  roadmap: agents/roadmaps/archive/road-to-a-tree-that-keeps-its-neighbours.md
  ratification: agents/evidence/ratifications/drain-tree-keeps-neighbours.md
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T11:20:00Z
-->

The review that produced these findings is the AI-council round run for the
ratification gate — two seats, two providers, neither of them the implementing
session. It is recorded once rather than twice: the prompt, the independence
statement, the sensitivity probes and the disagreements live in
`agents/evidence/ratifications/drain-tree-keeps-neighbours.md`. This file is the
findings table that round produced, in the shape this surface reads.

One seat read the branch directly; the other read the described delta plus what
it could reach, and said so. The seat that read the tree found finding 2, which
the other did not.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/install/emit_host_rules_cli.ts:70-95 | A neighbour's rule file sharing one of our basenames is OVERWRITTEN before ownership is consulted. Both emit loops write the destination, and `cleanOwnedOnly` runs afterwards skipping every name in `valid` — so the collision case is unreachable by the cleanup pass by construction. The existing fixtures exercised stale FOREIGN names only; none called `emitCursor` or `emitWindsurf` with a current-name collision. | fixed | `mayWriteRuleFile` checks ownership BEFORE each write; the blocked count folds into the same `kept:` line. Four end-to-end fixtures go through the real emitters, because the write happens inside them and a helper-level test cannot prove the gate is consulted. Proven red by bypassing the gate — 1 failed / 23 passed. (`f1eaf3949`) |
| 2 | high | src/install/host_rule_ownership.ts:85-86,108-118 | Ownership compared PATHS and discarded the recorded SHA-256, though the module it imports exists to distinguish `recorded-unchanged` from `recorded-modified`. Consequences: a stale generated rule the consumer had since edited was deletable, and a recorded `.windsurfrules` since replaced by another package was overwritable. The seat named the shape exactly — "the helper is named `RecordedHashes`, but callers discard the hashes". | fixed | `classifyOwnership` decides; only `recorded-unchanged` is removable, and a directory is removable only when every file beneath it is. The `.windsurfrules` manifest shortcut is deleted outright — the header is content-derived and is the only route in. Proven red by restoring path-membership — 3 failed / 17 passed. (`f1eaf3949`) |
| 3 | high | tests/install/host_rule_ownership.test.ts:42-48 | THE FIXTURE CONCEALED FINDING 2. `consumerWithManifest` recorded a constant `"deadbeef"` for every file, so every claimed file would have classified `recorded-modified` — and the deletion assertions passed anyway, because the code never looked. A fixture that cannot fail for the right reason is not evidence. | fixed | The helper records the real digest of each body. Two new cases pin the modified-since-install branch in both directions, plus one for a manifest entry carrying no digest at all. (`f1eaf3949`) |
| 4 | high | src/scripts/_lib/neighbour_census.ts:126-135 | `command_head` disclosed secrets. Taking "the first token" fails on three shapes: a leading `VAR=secret` assignment IS the first token; a credential-bearing URL passed verbatim; and the non-shell-aware `;` split promoted quoted-argument fragments into the output. The existing test covered `node script.js --flag`, which exercises none of them. | fixed | Leading assignments are dropped, the result must match a bare program-name shape, and whatever survives passes through this repo's own `secret_detector` — shape cannot see a credential spelled like a program name. Six fixtures over the named shapes. Proven red by returning the whole command — 5 failed / 27 passed. (`f1eaf3949`) |
| 5 | medium | tests/scripts/neighbour_census.test.ts:54 | The planted token was dictionary words — neither credential-shaped nor high-entropy — so it would have exercised the shape rules and silently skipped any detector gate behind them. | fixed | A high-entropy value with no vendor prefix, which exercises the `entropy` rule: the layer that catches a credential nobody wrote a pattern for. A vendor-prefixed shape was tried first and is correctly rejected by the remote's push protection even as a fixture; that is recorded rather than worked around. (`f1eaf3949`) |
| 6 | medium | src/scripts/hook_manifest.yaml:1368-1374 | `source-first-gate` declared `effect: verification` while its own script header says it "emits nothing to the model and it never blocks". Both seats raised it. | fixed | Reclassified `telemetry`, with the script's own sentence quoted beside it. (`f1eaf3949`) |
| 7 | medium | src/scripts/hook_manifest.yaml:38 | The `permission` / `verification` boundary was under-specified: is `permission` "can refuse" or "decides authorization"? Both seats asked for it in writing; the lint encodes one reading and nothing stated which. | fixed | The taxonomy is written at the head of the manifest, with the axis named as OBSERVABLE DELIVERY rather than primary purpose — which is also what resolves finding 6. (`f1eaf3949`) |
| 8 | medium | src/scripts/code_graph/verbs.ts:55-71 | The three gate verbs' new refusal behaviour is governance behaviour, and the ratification-surface detector did not flag it. It restricts rather than expands authority. | deferred | Surfaced to the maintainer rather than silently accepted: the detector's surface list is not this lane's to widen, and the behaviour itself is a refusal added, never an authority granted. |
| 9 | medium | src/install/emit_host_rules_cli.ts | The host-rule emitter runs from `install.sh` and nothing records its output in the install manifest, so on a real consumer every host rule file is unclaimed and therefore kept. One seat sharpened the consequence: it is not only that stale files survive, it is that THIS PACKAGE'S OWN rules survive its own uninstall. | deferred | Not closed here, and stated rather than implied. The fix is a writer for that inventory; the available project-manifest reader drops nested `files[]` by design, so a read-modify-write through it would erase other tools' inventories, and choosing the store is a decision this lane's roadmap did not take. The direction the gate fails in — keeping what it cannot prove is ours — is the safe one. |
| 10 | low | — | One seat proposed splitting the code-graph work onto its own branch; the other argued against, on the grounds that all four commits serve one subject and splitting would land hook and rule coexistence while leaving graph coexistence broken. | accepted-risk | Followed the second seat. The branch is one roadmap; the natural boundary is before it or after it. |

## Not claimed

The fixes taken from this round were not independently re-reviewed. The round
closed with the findings; the repairs and their sensitivity probes are the
author's, recorded above and in the ratification artifact so a later reader can
check them rather than take them.
