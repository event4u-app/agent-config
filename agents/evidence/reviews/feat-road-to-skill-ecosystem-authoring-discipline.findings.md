# Findings: feat-road-to-skill-ecosystem-authoring-discipline
<!-- completion-review: v1 | reviewed: 2026-08-06 | scope: 277582b7c9f8b34802b0941330482838e57e6e5504fa0b233dbb99fa2a03908c | diff: f0ebea51b823bd50e979ccf6ba66660bec3eef83 | reviewer: r2-fresh-subagent-feat-road-to-skill-ecosystem-authoring-discipline -->

<!-- context-manifest: v1
inputs:
  diff_sha: f0ebea51b823bd50e979ccf6ba66660bec3eef83
  scope_hash: 277582b7c9f8b34802b0941330482838e57e6e5504fa0b233dbb99fa2a03908c
  roadmap: agents/roadmaps/road-to-skill-ecosystem-authoring-discipline.md
  roadmap_hash: c6a77f37dab8ac16111843e3c95babc9b6e91e68d016b6a499b3cffc87225824
  ac_hash: 0b8c2cf1e27f79e1dce7dc4c2651d62e0e3a301b53f95b191adaa99d5f82634d
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-06T01:30:33Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | high | src/scripts/lint_token_budget_discipline.ts:104 | `classify_size` applies `PROXY_ERROR_MARGIN` only UPWARD, so it guards a proxy reading low — but ADR-217's own measurement shows the proxy reading HIGH on the largest artifact (3,518 vs 3,331 exact). Without the tokenizer, `design-system-capture` hard-fails exit 2 on the one artifact the ADR rules in-band and orders not to split. `js-tiktoken` is a devDependency, so any run without dev deps flips the verdict. The ADR's review_trigger claims the margin check detects proxy misclassification across a boundary; it cannot, in the only direction the corpus exhibits. | open |  |
| 2 | high | src/scripts/lint_mandated_lines.ts:151 | The quote class is `[\"“”'']` — two straight apostrophes and no U+2018/U+2019. `Authorization: the user's roadmap step says to push` passes (a paraphrase, and literally the documentation-is-not-authorization case the contract names), while `Authorization: ‘push it and open the PR’` is rejected. Both directions are wrong. | open |  |
| 3 | high | tests/scripts/lint_mandated_lines.test.ts:57 | The test guarding finding 2 uses a fixture with no apostrophe, so it passes over the broken character class. Changing it to the equally natural "the user's earlier ask" makes the same assertion fail — the test asserts what this input happens to produce, not the rule. | open |  |
| 4 | high | src/scripts/lint_mandated_lines.ts:110 | `checkReport` does no fence stripping. A report claiming a fix and a push, followed by a fenced block quoting the contract's own merged-block example, returns ZERO findings — the § Brevity illustration in `mandated-lines.md` is a working bypass for both checkable obligations. | open |  |
| 5 | medium | src/agent-src/contexts/execution/mandated-lines.md:5 | The contract says it is loaded by four rules. Only `downstream-changes` links it. `think-before-action` (edited by this very diff), `non-destructive-by-default`, and `commit-policy` contain zero mentions, so the intent, authorization, and commit lines have no routing edge from the rule that owns their decision point. | open |  |
| 6 | medium | src/agent-src/contexts/execution/mandated-lines.md:45 | The canonical Intent example wraps across two blockquote lines; `INTENT_RE` captures one physical line, so the document's own model-correct artifact fails its own checker with `intent-slots` (2 slots, not 3). | open |  |
| 7 | medium | src/domains/meta/optimize/deep/command.md:210 | The new `decision-review` link is correct for the src layout and wrong in the projection: `dist/agent-src/commands/optimize/deep.md` resolves it to a non-existent `<repo-root>/skills/…`. Sibling commands projected into the same directory use the dist-relative `../../skills/…`. | open |  |
| 8 | medium | taskfiles/ci-fast.yml:697 | `report-imperative-density` is invoked by nothing — no `Taskfile.yml` entry, no workflow. `check_ci_local_parity` computes the local set as the closure of the `ci`/`consistency` roots, so an orphan task is invisible to both directions of the parity check. The acceptance criterion is discharged by a task no chain runs. | open |  |
| 9 | medium | docs/contracts/adversarial-review-protocol.md:231 | § 3 now makes `Confidence` a mandatory ledger field, but § 4 — declared the only sanctioned solicitation and unchanged here — still specifies the six-field row. A review solicited with the sanctioned prompt returns no confidence column, so the unverified-S0 rule never reaches the reviewer that must apply it. | open |  |
| 10 | medium | docs/contracts/adversarial-review-protocol.md:191 | New normative text says every per-check rubric in a judge artifact carries a scope column, a do-not-flag list, and a gate-owned exclusion. Across all seven judge skills: zero scope columns, one partial do-not-flag, no gate-owned exclusion, and none updated in this diff. An every-X-carries-Y mandate with no compliant instance and no gate. | open |  |
| 11 | medium | src/scripts/lint_token_budget_discipline.ts:103 | `classify_size` is exported with a docstring justifying the extraction as making the boundary cases trivial to test — and has no test. The existing suite is untouched by this branch. The named boundary case is exactly the one that would have exposed finding 1. | open |  |
| 12 | low | src/scripts/lint_mandated_lines.ts:53 | Triggers are unnegated substring matches, so a report that explicitly denies the action owes the line: "No code changed … I submitted no findings upstream" produces `missing-authorization`. | open |  |
| 13 | low | src/scripts/lint_mandated_lines.ts:119 | `INTENT_RE.exec` is non-global, so only the first Intent line is validated and the verdict depends on line order — one well-formed line satisfies a report claiming any number of behaviour changes. | open |  |
| 14 | low | src/scripts/report_imperative_density.ts:82 | Three `proseLines` defects: a leading `---` horizontal rule is read as frontmatter and swallows content; an unclosed fence drops the file remainder; the fence toggle ignores the fence character, so `~~~` closes a backtick block. Advisory-only, so the effect is a silently wrong denominator. | open |  |

## Binding-review disposition

Round 1, scope `277582b7c9f8b34802b0941330482838e57e6e5504fa0b233dbb99fa2a03908c`.
Counts: 14 findings — 0 critical, 4 high, 7 medium, 3 low.

Fresh-context reviewer over the branch diff, the roadmap, and the real files.
Committed BEFORE any fix so the findings-before-fixes ancestry is real.

Checked and deliberately NOT filed: none of the six pre-filter edits removed a
scope limit — all six changed what is *reported*, not what is *looked at*, and a
grep for surviving pre-filter phrasings returned zero, so the "six found, six
fixed" claim holds. The `unresolved` branch is reachable (proxy 3,302–3,500).
Exact-path behaviour at 3,500 and 3,501 is correct. The projected
`mandated-lines.md` is byte-identical to source. The regenerated dashboard is
internally consistent.

