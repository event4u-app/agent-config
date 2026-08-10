# Findings: feat-road-to-zero-ceremony-settings
<!-- completion-review: v1 | reviewed: 2026-08-05 | scope: 9476261cefe528ebe79da63d6d526a44b0f595da9314fa826efc7f5857d34b43 | diff: 84e4596c7d42afbe3d26ee2e2b2e36836b754c97 | reviewer: r2-fresh-subagent-feat-road-to-zero-ceremony-settings -->

<!-- context-manifest: v1
inputs:
  diff_sha: 84e4596c7d42afbe3d26ee2e2b2e36836b754c97
  scope_hash: 9476261cefe528ebe79da63d6d526a44b0f595da9314fa826efc7f5857d34b43
  roadmap: agents/roadmaps/archive/road-to-zero-ceremony-settings.md
  roadmap_hash: 9887176041ebee4150fce8304d675c470f166acccc3b5f35d663049ffacfaba2
  ac_hash: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-05T21:06:22Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/_cli/cmd_settings_set.ts:58 | `PACKAGE_ROOT` is three hard-coded parent hops from `import.meta.url`, correct only for the `src/scripts/_cli/` source layout. `prepack` → `build:cli-delegate` bundles every `cmd_*.ts` into `dist/cli-delegate/*.js`, and `_dispatch.bash` prefers that bundle whenever it exists. From `<pkg>/dist/cli-delegate/cmd_settings_set.js` three hops resolve to `<pkg>/..` — `node_modules/@event4u` for a scoped install — so `loadClassIndex` reads a path that does not exist, returns `null`, and the writer refuses EVERY write. The one agent-reachable writer this phase ships is inert in the shipped artifact. `src/scripts/_lib/package_root.ts` exists precisely because this bug turned the 9.11.0 tarball E2E red; every other delegate uses `resolvePackageRoot(import.meta.url)`. The test suite imports the constant from the TS source, so it stays green either way. | fixed | 84e4596c7 — resolvePackageRoot(import.meta.url), the resolver every other delegate uses; the bundled-copy path now finds the contract |
| 2 | high | src/server/routes/settings.ts:515 | The guarded filter matches a diff path against a contract key by exact string, but `flatten` recurses into any non-empty map, so a class-C key that IS a map never appears under its own name. `subagents.host_capabilities` is the live case: template `{}`, contract class C, schema `z.object({}).passthrough()`. A PUT of `{subagents:{host_capabilities:{subagent_spawn:true}}}` without `confirmGuarded` produces the path `subagents.host_capabilities.subagent_spawn`, which has no contract row, is filtered out as not-C, and the write returns 200 with no confirmation — contradicting the unconditional guarantee in `docs/contracts/settings-api.md`. | fixed | 84e4596c7 — classOfPath walks to the nearest classified ancestor; tests/shared/settingsClasses.test.ts pins the host_capabilities child case |
| 3 | medium | src/server/routes/settings.ts:515 | Fail-closed is whole-file only, never per-key. `classes === null` guards everything, but a key present in the merged tree and absent from the contract falls through `classes.get(key) === 'C'` as unguarded. `settings-api.md` states the opposite principle — unverifiable is not unguarded — and the CLI applies it per key. Same contract, opposite default on the two paths. | fixed | 84e4596c7 — an unclassified changed key is now guarded, matching the CLI and the contract prose |
| 4 | medium | src/scripts/_cli/cmd_settings_set.ts:316 | The writer serialises with `yamlDump`, discarding every comment in the user's global settings file — the file the wizard creates as the full ~1,359-line commented template. `src/server/io/yamlIO.ts` opens by stating the opposite contract ("we MUST NOT discard them"), which is why the GUI route uses line-level `replaceScalar`. One `settings:set` strips it all irrecoverably. | fixed | 84e4596c7 — merges into the existing document; where the key has no line the round-trip is verified and the fallback says the comments were rewritten |
| 5 | medium | src/scripts/_cli/cmd_settings_set.ts:149 | `_readYaml` wraps only `readFileSync` in the try; `yamlLoad` sits outside it, so a malformed global settings file makes the writer die with a stack trace instead of the documented refuse path. Worse on the sibling branch: a file parsing to a non-map returns `{}`, and the write then replaces the user's entire settings content, silently, exit 0. | fixed | 84e4596c7 — a non-map or unparseable file is refused, not replaced; a comments-only file is recognised as an empty document before the parse |
| 6 | medium | tests/server/settings.write-rejects.test.ts:156 | The route's fail-closed branch is untested. Inverting `classes === null \|\|` to `classes !== null &&` — a one-character fail-open regression — leaves all four new cases green, because each runs with a readable contract and a genuinely-C key. The CLI's equivalent branch IS covered; the server's, which the contract prose spends a paragraph on, is not. | fixed | 84e4596c7 — decision extracted to guardedChangedKeys; "guards EVERYTHING when the contract could not be read" pins the branch |
| 7 | low | src/scripts/lint_settings_classes.ts:284 | Ledger accounting misreports a failing target as clean: a stale contract row is `complete`d in the class loop, then produces a finding in the second loop with no ledger call, so `report()` prints it as satisfied while the gate exits 1. The Counts-mismatch findings are likewise unledgered. The verdict is right; the completeness accounting the change advertises is not. | fixed | 84e4596c7 — a stale row now fails its own ledger target in the first loop |
| 8 | low | docs/contracts/settings-classes.md:331 | Self-contradiction: the document states the C rule was expanded into EIGHT tests and calls test 8 the one to reach for first, then tells the next author to check a new key against "the seven C tests". `lint_settings_classes.ts` repeats "seven explicit tests". | fixed | 84e4596c7 — eight in both the contract checklist and the gate header |
| 9 | low | src/scripts/_cli/cmd_settings_set.ts:137 | `_setDotted` walks a user-supplied dotted path with plain bracket indexing; a `__proto__` segment steps onto the prototype and the terminal assignment writes onto `Object.prototype`. Not reachable today — the class lookup must return A or B first and no contract row is named `__proto__` — but the guard is a markdown data file, not a code invariant, and the function is exported. | fixed | 84e4596c7 — FORBIDDEN_SEGMENTS refuses __proto__ / constructor / prototype structurally |
| 10 | low | agents/roadmaps/archive/road-to-zero-ceremony-settings.md:251 | The new blocker says it blocks "Phase 3 (all four steps)" while step 2 is `[x]` and unblocked; steps 3 and 4 are flipped to `[~]` with no inline reason, unlike every other deferral in the file. The dashboard then renders Phase 3 as done at 100% on 1 done / 3 deferred. | fixed | 84e4596c7 — the blocker names steps 1, 3, 4; steps 3 and 4 carry their reason inline |

## Binding-review disposition

Round 1, scope `9476261cefe528ebe79da63d6d526a44b0f595da9314fa826efc7f5857d34b43`.
Counts: 10 findings — 0 critical, 2 high, 4 medium, 4 low.

Produced by a fresh-context reviewer over the branch diff, the roadmap, and the
real repository files. The artefact was committed BEFORE any fix (36139ac2f),
so the findings-before-fixes ancestry the gate checks is real rather than
reconstructed; the statuses were filled in afterwards and the artefact re-bound
in place to the post-fix scope per § 2.5 / § 2.7.

All ten are fixed in 84e4596c7. Nothing was deferred: the two high findings were
both ship-blockers — one would have shipped an inert writer, the other a hole in
the fence it advertises — and the eight below them were each cheaper to close
than to carry.

Checked and deliberately NOT filed, with what was traced:

- **The `_isUnset` diff-skip.** `"x" → ""`, `["a"] → []`, `[] → ["evil"]`,
  `5 → 0`, `0 → 5`, `false → ""` all keep the pair. Emptying
  `screenshots.identity_allowlist` or `hooks.concern_budget.tier1_concerns` IS
  caught. Only both-sides-unset is skipped, which is the stated intent.
- **Dry-run ordering.** `dryRun` is a server-construction option, not a request
  field, and its early return precedes every write as well as both gates.
- **Contract completeness**, recomputed independently: 140 template leaves, 140
  rows, zero missing, zero stale, zero duplicates, A=27 / B=3 / C=110 matching
  the declared Counts, all three B defaults conservative.
- **`--source`** cannot influence the class lookup or the write target.
- **`gate-coverage.yml` header numbers**: 27 claimed, 27 present.

