# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 877e912607d481f286b41886d2a6c7e43491a28f1baa49cfec9d54ab4c9756ce | diff: 7e5d2835efe6e991b1ac2bf612f784ca8af12286 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: ec80dbe1b65eed9ed39be537cabf4a679643cfbc7571c6fec806f53b03c6e2d2 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 7e5d2835efe6e991b1ac2bf612f784ca8af12286
  scope_hash: 877e912607d481f286b41886d2a6c7e43491a28f1baa49cfec9d54ab4c9756ce
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T10:23:10Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | docs/contracts/release-pr-gating.md:166 | The § Cut surface premise re-asserts the exact categorical this diff retires 120 lines above it. The opening blockquote (L43-48) declares "no entry is install or runtime code" false of several entries because the npm manifests carry `bin`, `files`, `dependencies` and `engines` and no gate reads their content; L166 then states the allowlist "admits no install script, no test source, and no executable code" as the load-bearing safety argument, and L211 repeats it unhedged. Only L236 carries the hedge, and the table's own `smoke` row hedges `package.json` while its section opener does not — so the section contradicts both the blockquote and its own last row. | fixed | bf78e1e9d —  |
| 2 | low | tests/scripts/report_evidence_temperature.test.ts:227 | The comment claims "each probe below asserts TWO preconditions at once: that the runtime honoured the TZ assignment, and that the zone resolved to real tzdata". False per probe: the first probe (`lateOnThe5th.getDate()` is 6) is green with `TZ` unset on any host whose ambient zone is UTC+1/+2 — reproduced on this checkout, where ambient is Europe/Berlin and `new Date(Date.UTC(2026,9,5,23,30)).getDate()` is already 6 before any assignment. Only the pair is sensitive to a no-op assignment, because the two probes straddle the sign; the per-probe claim overstates what either one measures. | fixed | bf78e1e9d —  |
| 3 | low | src/scripts/report_evidence_temperature.ts:86 | The builder binds the writer to the gate and the docstring names the unbound leg as the cause of the 16.3.0 break ("writer and gate holding independent spellings"), but the binding stops one layer short of the producer. `main` honours `--out` ahead of `defaultReportPath`, so `taskfiles/content.yml` § `release-prepare` — the invocation the contract names at L86-90 as the thing that writes the census — can hold a third spelling that no assertion in this diff pins. The new tests prove default-path is in the allowlist, never that the pipeline uses the default. | fixed | bf78e1e9d —  |
| 4 | low | tests/scripts/check_release_pr_shape.test.ts:84 | The stated purpose — "narrowing these globs later is a deliberate edit to this assertion rather than a silent behaviour change" — is delivered for 2 of the 6 `*`-bearing allowlist rows. `src/packs/*/README.md`, `src/domains/*/pack.yaml`, `src/domains/*/README.md` and `docs/archive/CHANGELOG-pre-*.md` carry no assertion, and the last is the widest of the set: it admits `docs/archive/CHANGELOG-pre-x/evil.md` (verified by compiling the shipped globs against that path). Narrowing it stays exactly the silent change the test says it prevents. | fixed | bf78e1e9d —  |
