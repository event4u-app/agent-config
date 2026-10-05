# Findings: fix-release-shape-allows-its-own-census
<!-- completion-review: v1 | reviewed: 2026-10-05 | scope: e059e511554fc668753980ca42df868f21a441e91f6c6f7a3b46f8f1a954bd19 | diff: 558f6219ec9227d7f187cd658432aee0c5d91b71 | reviewer: r2-fresh-subagent-fix-release-shape-allows-its-own-census | prompt_hash: e1af5b63e1872cf1b82f3ebea90294fbc00fa235cb1058c906a2e2d6d908f534 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-fix-release-shape-allows-its-own-census"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-05 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 558f6219ec9227d7f187cd658432aee0c5d91b71
  scope_hash: e059e511554fc668753980ca42df868f21a441e91f6c6f7a3b46f8f1a954bd19
  roadmap: none
  roadmap_hash: none
  ac_hash: none
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-05T10:14:15Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | tests/scripts/report_evidence_temperature.test.ts:233 | The sensitivity probes (`expect(lateOnThe5th.getDate()).toBe(6)` and its `America/New_York` twin) assert two *environment* properties — that the runtime applies a runtime `process.env.TZ` assignment, and that real tzdata resolves those zone names. Neither is a property of `censusDateStamp`. On any leg where the assignment is not honoured or the zone falls back to UTC (musl/Alpine images without tzdata, a Windows leg, a container with `ICU` stripped), both probes red while the implementation under test is correct. The branch adds no guard, no `skipIf`, and no pinned `TZ` in the runner config, so the failure mode is a red test on a correct implementation rather than a skip. The comment names "verified on v26" — one runtime, one platform — as the whole basis. | open | |
| 2 | low | docs/contracts/release-pr-gating.md:162 | "It does admit five `src/**` paths and two under `templates/`" presents two overlapping sets as if they were additive. `src/agent-src/templates/agents/agent-project-settings.example.yml` is simultaneously one of the five `src/**` entries and one of the two under `templates/`, so the distinct count is six, not seven. The apposition that follows ("pack and domain metadata, their READMEs, and the project-settings template pin with its `dist/` twin") does enumerate six — so the prose and the numbers disagree with each other in a section this diff rewrote specifically so a reader can predict the gate by counting. | open | |
| 3 | low | docs/contracts/release-pr-gating.md:174 | The `smoke` row drops `package.json` from its justification; the prior row carried "`package.json` runtime behaviour". `package.json` is in the allowlist, is named two paragraphs earlier as the trigger for this very workflow ("Both trigger on `package.json`"), and is called out in the new opening blockquote as carrying `bin`, `files`, `dependencies` and `engines` — i.e. exactly the fields a public-install smoke test exists to exercise. The row that most needs the content-blindness caveat is now the one row that neither states it nor points at the blockquote that records it. | open | |
| 4 | low | docs/contracts/release-pr-gating.md:174 | Same row: "the two admitted `templates/` files **are a** version-pinned example settings file" applies a singular predicate to a plural subject. The two paths are a source template and its regenerated `dist/` twin; as written the clause reads as a count error in a sentence whose only job is to account for how many files are admitted. | open | |
| 5 | low | docs/contracts/release-pr-gating.md:111 | The new parity test closes one of the two drift mechanisms this section indicts, and the surrounding prose does not say which. It binds the § Release-PR shape enumeration to `ALLOWLIST_GLOBS`; nothing prevents a *third* prose copy of the path set reappearing — which is the failure the same diff just repaired by emptying the blockquote. The cut-surface table immediately below already restates allowlist-derived path claims ("no `scripts/install*`", "no `install.sh` / `scripts/install.py` / `tests/test_install.sh`", "no `scripts/install_global*.py`, `scripts/cmd_export.py`") that no test parses, so the mechanism the section calls weak — "an instruction to edit both was the only thing binding them, and it failed" — is still the only thing binding those rows. | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
