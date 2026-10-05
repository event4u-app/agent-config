# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: 12b3ecc0a7360cd0909b39245b565545679169bc3eeede9f0cf77aacc55bcfad | diff: 4ceb63d9b6e7ea8ca27cf9e5448a215d98936177 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: 9d23dafd07beaa51acc544ecb3aa8ed0ed683cff69a26752f1053ee0e2d146ce -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 4ceb63d9b6e7ea8ca27cf9e5448a215d98936177
  scope_hash: 12b3ecc0a7360cd0909b39245b565545679169bc3eeede9f0cf77aacc55bcfad
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T08:43:27Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/check_release_pr_shape.ts:101-106 | The restored divergence note is self-inconsistent and its load-bearing clause is false against the interpreter it describes. It states that `fnmatch.translate` "branches on a `-` inside the class" (true of CPython 3.11/3.12; CPython 3.9 — the default `python3` here — branches on `'--'`) and then that "an invalid range throws in both languages — measured: `[z-a]` raises in `re.compile` and in `new RegExp` alike". Measured on this machine: `python3.11 -c "fnmatch.translate('[z-a]')"` yields `(?s:(?!))\Z`, which compiles and never matches — the empty-range removal the `-` arm exists for. Only `re.compile('[z-a]')` raw, bypassing `translate`, raises; that is not the comparison the port mirrors. So the note describes 3.11's branch predicate and 3.9's throw behaviour as one measurement, and under the 3.11 reading the port does diverge exactly where the note says it does not: `_COMPILED_GLOBS` is built at module load, so a reversed range in `ALLOWLIST_GLOBS` crashes the gate at import where Python would silently never match. No live defect — `[0-9]` is the only bracket pattern and both agree — but the artifact whose job is to record the divergence asserts there is none. | fixed | d592ca54f —  Measured: python3.9.6 `fnmatch` source has `if '--' not in stuff`; python3.11.15 has `if '-' not in stuff` plus "Remove empty ranges" and returns `(?s:(?!))\Z` for `[z-a]`; `new RegExp('[z-a]')` throws |
| 2 | low | src/scripts/check_release_pr_shape.ts:49-54 | The `?`-counterexample understates what the rejected alternative would admit, in the sentence written to bound it. It says `????-??-??` "admits not every sibling but any whose name happens to carry that shape" — but fnmatch `?` maps to `.` under the `s` flag, so it crosses `/` and the alternative also admits nested paths, not just siblings. Confirmed by building the `?` form of the glob: `agents/evidence/analysis/evidence-temperature-x/yz-ab-cd.md` matches. This file's own header docstring already flags the property ("`*` and `?` do NOT cross path separators is NOT a property of fnmatch"), and the shipped digit-class glob is correctly immune — `[0-9]` cannot match `/`, which is what the `nested/` denial at tests/scripts/check_release_pr_shape.test.ts:134 pins. | fixed | d592ca54f —  `new RegExp('^(?:.)$','s').test('/')` is true; replicated `?` glob matches a nested path |
