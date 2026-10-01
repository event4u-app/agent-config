# Findings: drain-hooks-every-host-close
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: b77418b4f8e8b771be3076d68fb4ede2103089174e2e18c1a9271ac3a609fd46 | diff: fc46660c1399722fa6906646b759ce87066e52d6 | reviewer: r2-fresh-subagent-drain-hooks-every-host-close | prompt_hash: 1b53cb005de9a316fd26be9ed42b1db5016330d1afb9de9b083d50755836e929 -->
<!-- {"review-independence":{"review_independence":"multi-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"multi-pass","reviewers":["r2-fresh-subagent-drain-hooks-every-host-close","r2-round2","r2-round3","r2-round4","r2-round5","council/anthropic+openai-2026-10-01"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: fc46660c1399722fa6906646b759ce87066e52d6
  scope_hash: b77418b4f8e8b771be3076d68fb4ede2103089174e2e18c1a9271ac3a609fd46
  roadmap: agents/roadmaps/archive/road-to-hooks-on-every-host.md
  roadmap_hash: 5bd92c90916806a1a592464cf2e1e2b4a14e4abbe52f876ef7be0aa9acfd506c
  ac_hash: 098bdb3afcece6e3169f4a28232bc67e549237d6850779bd1e8e601e01dc6dbb
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T03:43:41Z
-->
**Six rounds, each a fresh subagent with no implementation context, plus a
two-provider council on the ratification question.** The rounds found **21
defects, 3 of them high**; each round's findings were fixed and the next round
ran against the result. The fifth round found no high and no medium findings; the sixth and final
round returned **"the branch is sound"** with one low polish item, fixed in
`fc46660c1` and recorded as row 6 below — the one row whose fix legitimately
postdates this artifact.

**What the table below carries, and why it is not the twenty.** The R2 contract
(§2.5) requires a findings artifact to be committed BEFORE the commits that fix
it, so a `fixed` row citing a commit that predates this file would be
backdating — and the gate detects it. The twenty are real, landed and referenced
by commit, but they belong to superseded rounds. They are recorded in full as
prose under **Review history**, which loses none of the content and claims
none of the ordering. The table carries what is still **open or accepted** at
this scope.

## Open and accepted at this scope

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/check_host_docs_digest.ts:11 | Raw-body hashing cannot distinguish a rewritten refusal contract from a nav link, a footer year or an A/B test, so the weekly job's first red is more likely to be a CSS rebuild than a contract change. Raised by the council and by two review rounds. | accepted-risk | Bounded, not eliminated: two independent fetches returned 8 unchanged, which demonstrates short-term reproducibility and not semantic precision. Normalised or contract-scoped hashing is its own design question with its own failure modes (what counts as "the contract" on a page nobody controls), and shipping a guess at it here would replace a loud imprecise signal with a quiet precise-looking one. Named in the ratification as not-adopted.  |
| 2 | medium | package-lock.json | `npm audit --omit=dev --audit-level=high` reds the `Static Checks` CI job on `fastify <= 5.12.4` (five advisories, high). | deferred | **Not this branch.** The diff touches neither `package.json` nor `package-lock.json`, so the dependency set is byte-identical to `origin/main`'s and the advisory is newly published against it; it reds every PR in the repository until someone bumps the dependency. A security bump belongs in its own reviewable change — bundling it here would mean a revert of this roadmap also reverts the fix, and vice versa. Owner call.  |
| 3 | low | src/scripts/install.ts:1611 | Being listed in `SMOKE_PROBE_SLOTS` is only half of being probed: `_smoke_test_hooks` resolves `SMOKE_BRIDGE_PATHS[platform] ?? ''` and counts a platform with no entry as `skipped`, so a host could be listed as probed and silently never exercised. | accepted-risk | No live instance — all six listed platforms have a bridge path today. Closing it means exporting the constant, which edits `src/scripts/install.ts` and reds two committed-build-output freshness gates (`build:cli` + `build:install-bundle`), with the bundle needing a rebuild against a real `node_modules` this worktree does not have. Recorded in `tests/install/global_install_hooks_smoke.test.ts`'s own comment so the next reader meets it rather than rediscovering it.  |
| 4 | low | src/scripts/hooks/host_lowering.yaml:306 | The codex deny probe is n=1, one build, one operator, and did not separate "the hook fired and was ignored" from "the matcher never matched" — the instrumented re-run was blocked by the harness it ran under. | accepted-risk | The row states both unexcluded explanations and names the one cheap experiment that would separate them (a marker-file re-run on >= 0.159.3). Every observable the probe rests on was independently re-verified by two later rounds: `codex --version` 0.148.0, `codex features list` reporting `hooks stable true`, registry latest 0.159.3, `command -v copilot` absent, and the 24-stable-release gap re-derived from the registry. What is claimed is only that this package has demonstrated no refusal path there.  |
| 5 | low | agents/roadmaps/road-to-host-claims-the-tree-contradicts.md | `task roadmap-progress-check` fails on an unrelated roadmap carrying 2 unresolved `[~]` deferrals. | deferred | Pre-existing on `origin/main` (verified: the same 2 deferrals are present there) and not in this diff. CI deliberately runs the narrow `task roadmap-dashboard-untracked-check` instead, precisely so a pre-existing estate defect does not block every unrelated PR — which is why this is reported rather than fixed. Resolving it is an owner decision under `roadmap-management § 4b`.  |

| 6 | low | src/scripts/check_host_docs_digest.ts:616 | `reportScanned()` was called outside any `try`, so a `DeadScopeError` — an empty or moved corpus, which is an ANTICIPATED input condition — escaped to the module-entry catch-all and printed a seven-frame stack. The exit code was already correct, so this was cosmetic; it was also inconsistent with 280 of the 312 `assertScanned`/`reportScanned` call sites in this tree, and with this module's own header, which argues twice that an anticipated condition must not surface as a bare stack trace and then let this one through. | fixed | Caught and reported as one line with exit 2, per the house pattern. Verified against an empty fixture table: `--lowering <empty> --quiet` now prints the `scanned 0 verified row(s)` diagnostic and exits 2 with no stack. (`fc46660c1`) |

## Review history — the twenty findings of rounds 1-5

Each was found by a fresh reviewer with no implementation context, reproduced
before being fixed, and closed by the commit named. The three high-severity
ones are the argument for having run the rounds at all: a host claim the cited
page does not support, a write path that erased the evidence it was built to
protect, and a CI gate this branch reddened on the required-check job.

1. **high** — `src/scripts/hooks/host_lowering.yaml:284`
   The `copilot` row asserted `preToolUse` "fail-closed on exit 2". The cited page does not say that. Re-fetched, it hashes byte-identical to the committed `docs_digest` — provably the pinned body — and carries no exit-code semantics at all: no `exit 2`, no non-zero convention, no stderr contract. It documents the capability ("can approve or deny tool executions") plus a config shape. The branch then built D2's argument on top of it. A statement about a host the tree has not established, in the file whose header forbids exactly that.
   *Closed:* Verified independently before fixing: digest matched byte-for-byte, a grep for exit-code semantics over the pinned body returned 0 hits. Corrected at the row, in roadmap 2.1 and 2.3, and in D2 — now the weaker, true version (only codex documents such a contract, so copilot is further from a binding). New **D3** records the lesson. (`17a3079f5`)

2. **high** — `src/scripts/check_host_docs_digest.ts:213`
   `applyFindings` skipped `no-url` and `unreachable` but not `gone`, so a 404/410 fell through to the digest branch and wrote `docs_digest: null` — the one state meaning "this citation is dead" was the one state that destroyed the evidence. Self-defeating: with a null digest and an untouched year-long `expires`, a page that later returned would classify `filled` and the drift signal would be lost permanently. Contradicted the module header's own promise.
   *Closed:* Reproduced first (`written: ['claude/any']`, digest to `null`), then `gone` added to the skip predicate. Pinned by a test seen RED against the unfixed predicate — the pre-existing write-neutrality cases covered `unreachable` and `no-url` only, which is how a 19/19 green suite missed it. (`17b34efa0`)

3. **high** — `src/scripts/check_host_docs_digest.ts:1`
   The new gate reddened `check_gate_coverage` (`gate-hardening:unhardened-scan-scope: 1 violation and no recorded baseline`) — a CI step with no `continue-on-error`. The script matched `listGateScripts`, called no `assertScanned`/`reportScanned`, emitted no `scanned:` line and was unregistered. Only violation in the tree, so `main` was green and the red was introduced here.
   *Closed:* `reportScanned` added (9 verified rows, floor 8); registered in `gate-coverage.yml` with a `no_canary_reason`; self-test rewritten onto `_lib/gate_self_test.ts` so the sibling `registered-non-adopters` ratchet holds at baseline. (`17b34efa0`)

4. **medium** — `src/scripts/check_host_docs_digest.ts`
   `--flag=value` passed the unknown-flag guard (`a.split('=')[0]`) and was then silently ignored by `valueOf` (exact-match `indexOf`). Reproduced: `--lowering=/nonexistent/table.yaml` exited 0 having read the REAL committed table; with `--fetch --write` it would write `HOST_LOWERING_PATH` while the operator named a copy. The exact fail-open the guard exists to prevent. Found independently by two reviewers.
   *Closed:* Both forms resolve; a flag with no value or followed by another flag is an error. Pinned by a self-test case driving the real CLI. (`17a3079f5`, `17b34efa0`)

5. **medium** — `src/scripts/check_host_docs_digest.ts:223`
   A drift `--write` overwrote `docs_digest` with the new body's hash while leaving `docs_at` untouched, so the row asserted a reading that never happened — and worse, erased its own signal: the next run would compare new-against-new, report `unchanged`, and a human who missed one red week would never learn the page moved.
   *Closed:* Drift now writes `expires` ONLY; the recorded digest is evidence, not a cache. Two tests pin both halves. (`17a3079f5`)

6. **medium** — `src/config/gate-coverage.yml:482`
   The coverage row pinned `argv: ["--fetch"]`, and `check_gate_coverage` spawns each enforced gate with its declared argv inside the required-check job — so the watcher would have issued eight live vendor requests on EVERY pull request, with up to 8x30s of third-party latency and no spawn timeout. It also falsified the rationale committed beside it ("not a pull-request gate"). The network bought the floor nothing: `reportScanned` fires before the fetch branch.
   *Closed:* The workflow gained an offline scope step and `argv: []` pins to it, so the per-PR spawn makes no network call. (`e5237dbdb`)

7. **medium** — `src/scripts/hooks/host_lowering.ts:57`
   The `docs_digest` definition was wrong three times in one branch, each correction refuted by the next: "as fetched on `docs_at`" (refuted by the first fill — digests taken 2026-10-01 against rows read 2026-09-29), "as fetched by the LAST digest run" (refuted by the writer, which keeps the old digest on drift), and "`docs_at` + `docs_digest` are ONE pair" (refuted by the same committed data as the first).
   *Closed:* The two fields are INDEPENDENT and now say so; all three retired wordings are listed rather than quietly replaced, because the instructive fact is the relapse. (`17a3079f5`, `e5237dbdb`)

8. **medium** — `src/scripts/check_host_docs_digest.ts:355`
   `parseHostLowering` sat outside the try/catch guarding the read, and the entry point had no `.catch`, so a malformed table produced an unhandled rejection and a stack trace instead of the documented exit-2 contract — on the scheduled job, contradicting that job's promise that a red means "go read a page".
   *Closed:* Parse moved inside the guard; `.catch` added at the entry point. (`17a3079f5`)

9. **medium** — `src/scripts/check_host_docs_digest.ts:470`
   `asOf()` prints "Pass `--as-of <iso>` to pin it" on every unpinned run, but `--as-of` was absent from `KNOWN_FLAGS`, so following that advice exited 2.
   *Closed:* `--as-of` accepted, with the reason recorded at the entry. (`17b34efa0`)

10. **low** — `src/scripts/check_host_docs_digest.ts:537`
   `--today` was validated by shape only, so `2026-13-45` passed and then threw `RangeError` out of `dayBefore`'s `toISOString()` as a bare stack trace — the outcome the value parser exists to prevent.
   *Closed:* Round-tripped through `Date`, which also rejects `2026-02-31`. Both verified. (`e5237dbdb`)

11. **low** — `src/scripts/check_host_docs_digest.ts:186`
   Two silent no-ops in the line walk: an indent-8 comment inside a `verified:` block ended the block early, and a row with no `docs_digest:` key wrote nothing while still reporting `filled` — a write claimed and not performed.
   *Closed:* Comments no longer close the block; `applyFindings` returns `written`/`missed` and a missed row is an error. Both pinned by tests. (`17a3079f5`)

12. **low** — `src/scripts/check_host_docs_digest.ts:440`
   Read-only `--fetch` — the mode the weekly job runs — reported a `filled` row as "newly recorded" when nothing was written.
   *Closed:* The phrase is now conditional on `--write`. (`17a3079f5`)

13. **low** — `src/scripts/check_host_docs_digest.ts:22`
   The module header said a changed digest "does exactly one thing: it expires the row", reading as if escalation were automatic. In production the weekly job runs `--fetch` with no `--write`, so nothing is expired — the job simply goes red.
   *Closed:* Restated as "the most it ever does", with the production behaviour named. (`af0b1668b`)

14. **low** — `.github/workflows/host-docs-digest.yml:17`
   Both recovery messages were under-specified identically: `--fetch --write` marks a drifted row stale and nothing moves `expires` forward again, so following the printed instruction literally leaves the row red forever.
   *Closed:* The drift line and the workflow comment now say re-establishing means editing `docs_at`, `docs_digest` AND `expires` after reading the page. (`af0b1668b`)

15. **low** — `.github/workflows/host-docs-digest.yml:53`
   The workflow pinned `ref: main`, so a `workflow_dispatch` from a branch would run main's table — the job could not be exercised before it was relied on.
   *Closed:* Checks out the dispatched ref; a schedule already uses the default branch. (`17a3079f5`)

16. **low** — `tests/install/global_install_hooks_smoke.test.ts:178`
   The negative control re-implemented `boundHosts` inline, proving a copy of the logic is sensitive rather than the function the real assertions use.
   *Closed:* Mutates the table TEXT and feeds it through the same helper. (`17a3079f5`, `e5237dbdb`)

17. **low** — `src/config/gate-coverage.yml:495`
   The `no_canary_reason` — load-bearing, since it substitutes for a negative control — credited `--self-test` with a `filled`-vs-`missed` assertion it did not contain.
   *Closed:* The assertion now exists (plus a `gone`-writes-nothing case) rather than the sentence being softened. (`e5237dbdb`)

18. **low** — `src/config/gate-coverage.yml`
   Inserting the coverage row at the top of the manifest shifted the line-pinned PEM canary in `.secret-allow` and reddened `check_secret_leak` on a pre-existing fixture.
   *Closed:* The row moved to the end of the list, leaving every existing line number — and the security allowlist — untouched. (`e5237dbdb`)

19. **low** — `src/config/ci-local-parity.yml:277`
   The `ci_only` entry sat below the comment introducing `local_only:`, reading as a `local_only` entry while YAML parsed it into `ci_only`; plus three blank lines where the file's convention is one.
   *Closed:* Moved above that comment; whitespace normalised. (`e5237dbdb`, `af0b1668b`)

20. **low** — `src/scripts/check_host_docs_digest.ts:525`
   Two asymmetries introduced with `gone`: `detail` was printed only for `unreachable`, so a dead citation logged without its status code; and `--strict-fetch` without `--fetch` was silently ignored where the sibling `--write` case is a loud exit 2.
   *Closed:* Both closed. (`17b34efa0`)

## What the final round verified by execution

`check_host_docs_digest --self-test` 0 (6/6 cases, 5 rejecting, driving the
real CLI) · `lint_hook_manifest --as-of 2026-10-01` 0 with exactly 7 warnings
(**AC-1**) · `check_gate_coverage` 0 · `check_ci_local_parity` 0 ·
`check_enforcement_matrix` 0, 32 rows match (**AC-2**) · `check_secret_leak` 0 ·
`check_read_surface_coverage` 0 · `check_kernel_edit_ratified` 0 ·
`lint_workflow_security` 0 · `check_estate_count` 0 · both test files 24/24
including the negative control (**AC-4**) · the compiled sibling byte-identical
to a fresh compile · a live `--fetch` returning 8/8 unchanged with a clean tree
afterwards.

Independent probes rather than re-reading the write-up: a sabotaged digest in a
temp copy exited 1 naming the host with url/was/now/seen, and the write probe
changed **exactly one line** (`expires`) while preserving the recorded digest;
the Copilot page was re-fetched, hashed to the committed digest byte-for-byte,
and grepped for exit-code semantics (**0 hits**) — which is what makes finding 1
of the history an established correction rather than a plausible one.
