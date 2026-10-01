# Findings: drain-hooks-every-host-close
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 15c2e4dd79f3a86926dd3176c0eaf7d20d4f58f48d92ee5ba50b665f97b9f19c | diff: af0b1668b167872bb7ef966322ab7013fa2c8fce | reviewer: r2-fresh-subagent-drain-hooks-every-host-close | prompt_hash: 6188c8176a35845071297ab815754994a7a2eb0a912039d1f8d17d67fcd64d81 -->
<!-- {"review-independence":{"review_independence":"multi-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"multi-pass","reviewers":["r2-fresh-subagent-drain-hooks-every-host-close","r2-fresh-subagent-round2","r2-fresh-subagent-round3","r2-fresh-subagent-round4","council/anthropic+openai-2026-10-01"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: af0b1668b167872bb7ef966322ab7013fa2c8fce
  scope_hash: 15c2e4dd79f3a86926dd3176c0eaf7d20d4f58f48d92ee5ba50b665f97b9f19c
  roadmap: agents/roadmaps/archive/road-to-hooks-on-every-host.md
  roadmap_hash: 5bd92c90916806a1a592464cf2e1e2b4a14e4abbe52f876ef7be0aa9acfd506c
  ac_hash: 098bdb3afcece6e3169f4a28232bc67e549237d6850779bd1e8e601e01dc6dbb
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T03:24:52Z
-->

**Five rounds, each a fresh subagent with no implementation context, plus a
two-provider council on the ratification question.** Rounds 1-4 found defects;
each round's findings were fixed and the next round ran against the result. The
final round found **no high and no medium findings** — three low items, all
prose or whitespace, fixed in `af0b1668b`. This artifact's `scope:` is the final
tree; the table records every round, because the interesting content of this
review is the sequence, not the last row of it.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/hooks/host_lowering.yaml:284 | The `copilot` row asserted `preToolUse` "fail-closed on exit 2". The cited page does not say that. Re-fetched, it hashes byte-identical to the committed `docs_digest` — provably the pinned body — and carries no exit-code semantics at all: no `exit 2`, no non-zero convention, no stderr contract. It documents the capability ("can approve or deny tool executions") plus a config shape. The branch then built D2's argument on top of it. A statement about a host the tree has not established, in the file whose header forbids exactly that. | fixed | Verified independently before fixing: digest matched byte-for-byte, a grep for exit-code semantics over the pinned body returned 0 hits. Corrected at the row, in roadmap 2.1 and 2.3, and in D2 — now the weaker, true version (only codex documents such a contract, so copilot is further from a binding). New **D3** records the lesson. (`17a3079f5`) |
| 2 | high | src/scripts/check_host_docs_digest.ts:213 | `applyFindings` skipped `no-url` and `unreachable` but not `gone`, so a 404/410 fell through to the digest branch and wrote `docs_digest: null` — the one state meaning "this citation is dead" was the one state that destroyed the evidence. Self-defeating: with a null digest and an untouched year-long `expires`, a page that later returned would classify `filled` and the drift signal would be lost permanently. Contradicted the module header's own promise. | fixed | Reproduced first (`written: ['claude/any']`, digest to `null`), then `gone` added to the skip predicate. Pinned by a test seen RED against the unfixed predicate — the pre-existing write-neutrality cases covered `unreachable` and `no-url` only, which is how a 19/19 green suite missed it. (`17b34efa0`) |
| 3 | high | src/scripts/check_host_docs_digest.ts:1 | The new gate reddened `check_gate_coverage` (`gate-hardening:unhardened-scan-scope: 1 violation and no recorded baseline`) — a CI step with no `continue-on-error`. The script matched `listGateScripts`, called no `assertScanned`/`reportScanned`, emitted no `scanned:` line and was unregistered. Only violation in the tree, so `main` was green and the red was introduced here. | fixed | `reportScanned` added (9 verified rows, floor 8); registered in `gate-coverage.yml` with a `no_canary_reason`; self-test rewritten onto `_lib/gate_self_test.ts` so the sibling `registered-non-adopters` ratchet holds at baseline. (`17b34efa0`) |
| 4 | medium | src/scripts/check_host_docs_digest.ts | `--flag=value` passed the unknown-flag guard (`a.split('=')[0]`) and was then silently ignored by `valueOf` (exact-match `indexOf`). Reproduced: `--lowering=/nonexistent/table.yaml` exited 0 having read the REAL committed table; with `--fetch --write` it would write `HOST_LOWERING_PATH` while the operator named a copy. The exact fail-open the guard exists to prevent. Found independently by two reviewers. | fixed | Both forms resolve; a flag with no value or followed by another flag is an error. Pinned by a self-test case driving the real CLI. (`17a3079f5`, `17b34efa0`) |
| 5 | medium | src/scripts/check_host_docs_digest.ts:223 | A drift `--write` overwrote `docs_digest` with the new body's hash while leaving `docs_at` untouched, so the row asserted a reading that never happened — and worse, erased its own signal: the next run would compare new-against-new, report `unchanged`, and a human who missed one red week would never learn the page moved. | fixed | Drift now writes `expires` ONLY; the recorded digest is evidence, not a cache. Two tests pin both halves. (`17a3079f5`) |
| 6 | medium | src/config/gate-coverage.yml:482 | The coverage row pinned `argv: ["--fetch"]`, and `check_gate_coverage` spawns each enforced gate with its declared argv inside the required-check job — so the watcher would have issued eight live vendor requests on EVERY pull request, with up to 8x30s of third-party latency and no spawn timeout. It also falsified the rationale committed beside it ("not a pull-request gate"). The network bought the floor nothing: `reportScanned` fires before the fetch branch. | fixed | The workflow gained an offline scope step and `argv: []` pins to it, so the per-PR spawn makes no network call. (`e5237dbdb`) |
| 7 | medium | src/scripts/hooks/host_lowering.ts:57 | The `docs_digest` definition was wrong three times in one branch, each correction refuted by the next: "as fetched on `docs_at`" (refuted by the first fill — digests taken 2026-10-01 against rows read 2026-09-29), "as fetched by the LAST digest run" (refuted by the writer, which keeps the old digest on drift), and "`docs_at` + `docs_digest` are ONE pair" (refuted by the same committed data as the first). | fixed | The two fields are INDEPENDENT and now say so; all three retired wordings are listed rather than quietly replaced, because the instructive fact is the relapse. (`17a3079f5`, `e5237dbdb`) |
| 8 | medium | src/scripts/check_host_docs_digest.ts:355 | `parseHostLowering` sat outside the try/catch guarding the read, and the entry point had no `.catch`, so a malformed table produced an unhandled rejection and a stack trace instead of the documented exit-2 contract — on the scheduled job, contradicting that job's promise that a red means "go read a page". | fixed | Parse moved inside the guard; `.catch` added at the entry point. (`17a3079f5`) |
| 9 | medium | src/scripts/check_host_docs_digest.ts:470 | `asOf()` prints "Pass `--as-of <iso>` to pin it" on every unpinned run, but `--as-of` was absent from `KNOWN_FLAGS`, so following that advice exited 2. | fixed | `--as-of` accepted, with the reason recorded at the entry. (`17b34efa0`) |
| 10 | low | src/scripts/check_host_docs_digest.ts:537 | `--today` was validated by shape only, so `2026-13-45` passed and then threw `RangeError` out of `dayBefore`'s `toISOString()` as a bare stack trace — the outcome the value parser exists to prevent. | fixed | Round-tripped through `Date`, which also rejects `2026-02-31`. Both verified. (`e5237dbdb`) |
| 11 | low | src/scripts/check_host_docs_digest.ts:186 | Two silent no-ops in the line walk: an indent-8 comment inside a `verified:` block ended the block early, and a row with no `docs_digest:` key wrote nothing while still reporting `filled` — a write claimed and not performed. | fixed | Comments no longer close the block; `applyFindings` returns `written`/`missed` and a missed row is an error. Both pinned by tests. (`17a3079f5`) |
| 12 | low | src/scripts/check_host_docs_digest.ts:440 | Read-only `--fetch` — the mode the weekly job runs — reported a `filled` row as "newly recorded" when nothing was written. | fixed | The phrase is now conditional on `--write`. (`17a3079f5`) |
| 13 | low | src/scripts/check_host_docs_digest.ts:22 | The module header said a changed digest "does exactly one thing: it expires the row", reading as if escalation were automatic. In production the weekly job runs `--fetch` with no `--write`, so nothing is expired — the job simply goes red. | fixed | Restated as "the most it ever does", with the production behaviour named. (`af0b1668b`) |
| 14 | low | .github/workflows/host-docs-digest.yml:17 | Both recovery messages were under-specified identically: `--fetch --write` marks a drifted row stale and nothing moves `expires` forward again, so following the printed instruction literally leaves the row red forever. | fixed | The drift line and the workflow comment now say re-establishing means editing `docs_at`, `docs_digest` AND `expires` after reading the page. (`af0b1668b`) |
| 15 | low | .github/workflows/host-docs-digest.yml:53 | The workflow pinned `ref: main`, so a `workflow_dispatch` from a branch would run main's table — the job could not be exercised before it was relied on. | fixed | Checks out the dispatched ref; a schedule already uses the default branch. (`17a3079f5`) |
| 16 | low | tests/install/global_install_hooks_smoke.test.ts:178 | The negative control re-implemented `boundHosts` inline, proving a copy of the logic is sensitive rather than the function the real assertions use. | fixed | Mutates the table TEXT and feeds it through the same helper. (`17a3079f5`, `e5237dbdb`) |
| 17 | low | src/config/gate-coverage.yml:495 | The `no_canary_reason` — load-bearing, since it substitutes for a negative control — credited `--self-test` with a `filled`-vs-`missed` assertion it did not contain. | fixed | The assertion now exists (plus a `gone`-writes-nothing case) rather than the sentence being softened. (`e5237dbdb`) |
| 18 | low | src/config/gate-coverage.yml | Inserting the coverage row at the top of the manifest shifted the line-pinned PEM canary in `.secret-allow` and reddened `check_secret_leak` on a pre-existing fixture. | fixed | The row moved to the end of the list, leaving every existing line number — and the security allowlist — untouched. (`e5237dbdb`) |
| 19 | low | src/config/ci-local-parity.yml:277 | The `ci_only` entry sat below the comment introducing `local_only:`, reading as a `local_only` entry while YAML parsed it into `ci_only`; plus three blank lines where the file's convention is one. | fixed | Moved above that comment; whitespace normalised. (`e5237dbdb`, `af0b1668b`) |
| 20 | low | src/scripts/check_host_docs_digest.ts:525 | Two asymmetries introduced with `gone`: `detail` was printed only for `unreachable`, so a dead citation logged without its status code; and `--strict-fetch` without `--fetch` was silently ignored where the sibling `--write` case is a loud exit 2. | fixed | Both closed. (`17b34efa0`) |

## Residue — carried, not closed

- **Raw-body hashing.** A nav link and a rewritten refusal contract hash
  identically, so the weekly job's first red is more likely to be a CSS rebuild
  than a contract change. Raised by the council and by two rounds; recorded as
  future work in the ratification. Normalised or contract-scoped hashing is its
  own design question.
- **`SMOKE_BRIDGE_PATHS`.** Being in the probe list is only half of being
  probed. No live instance; exporting the constant would red two
  committed-build-output freshness gates. Named in the test file.
- **The codex probe was never re-run** by any reviewer — it spawns a host agent,
  which the review brief forbids. Round 2 verified every observable it rests on
  (`codex --version` 0.148.0, `codex features list` reporting `hooks stable
  true`, registry latest 0.159.3, `command -v copilot` absent), and rounds 4 and
  5 re-derived the 24-stable-release figure from the registry; the negative
  result itself is single-operator, n=1, and the row says so.
- **`npm audit` reds the `Static Checks` job** on `fastify <= 5.12.4` (high).
  NOT this branch: `git diff origin/main -- package.json package-lock.json` is
  empty, so the dependency set is byte-identical to `main`'s and the advisory is
  newly published against it. A security dependency bump belongs in its own
  reviewable change, not bundled into a hooks roadmap.
- **`check_gate_completeness`** is red at 235 against a baseline of 214.
  Confirmed in no workflow, and its output never mentions `host_docs_digest` —
  pre-existing.

## What the final round verified by execution

`check_host_docs_digest --self-test` 0 (6/6, 5 rejecting, driving the real
CLI) · `lint_hook_manifest --as-of 2026-10-01` 0 with exactly 7 warnings
(**AC-1**) · `check_gate_coverage` 0 · `check_ci_local_parity` 0 ·
`check_enforcement_matrix` 0, 32 rows (**AC-2**) · `check_secret_leak` 0 ·
`check_read_surface_coverage` 0 · `check_kernel_edit_ratified` 0 ·
`lint_workflow_security` 0 · `check_estate_count` 0 · both test files 24/24
including the negative control (**AC-4**) · compiled sibling byte-identical ·
live `--fetch` 8/8 unchanged with a clean tree afterwards.

Independent probes rather than re-reading the write-up: a sabotaged digest in a
temp copy exited 1 naming the host with url/was/now/seen, and the write probe
changed **exactly one line** (`expires`) while preserving the recorded digest;
the Copilot page was re-fetched, hashed to the committed digest byte-for-byte,
and grepped for exit-code semantics (**0 hits**) — confirming finding 1's
correction is exact rather than merely plausible.
