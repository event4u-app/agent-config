# Findings: drain-road-to-drain-commands
<!-- completion-review: v1 | reviewed: 2026-08-21 | scope: 2d12f784336ece72551747eed9bdb66367b126d6e14a45dabb927af91f274c14 | diff: 62e6b65c2ab3846314d1dd05a5411548216be6f7 | reviewer: r2-fresh-subagent-drain-road-to-drain-commands | prompt_hash: bb41a84d753e1056a9101e83cbba9d97287688bd970d95ef94c5f2aaab9f3fbc -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-08-21 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 62e6b65c2ab3846314d1dd05a5411548216be6f7
  scope_hash: 2d12f784336ece72551747eed9bdb66367b126d6e14a45dabb927af91f274c14
  roadmap: agents/roadmaps/road-to-drain-commands.md
  roadmap_hash: f4bc0895efecba296042f235f8ec483490ab6e4280620e2ea75e8837bd2f8282
  ac_hash: 188021fb998afe8f9cc88bcdcd23e8762e75b922de5a4b76cab8729d3de506a2
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-08-21T12:52:55Z
-->

**Four rounds ran. This artefact carries round 4's findings with their
outcomes**; rounds 1-3 are in this file's git history, each committed before
its own fixes so a reader can check a review against what it actually reviewed.

The loop does not converge on its own: every fix moves the scope hash, so a
fifth round would bind to a fifth scope and so on. It is stopped here, at the
top of the recorded budget, with the reason stated rather than the appearance
of closure manufactured. What each round bought, so the cost is auditable:

What each round bought, so the cost is auditable. **Round 1** — the command was
in no surface map (CI-blocking), plus two real bugs in the new gate: an
inherited PATH producing a false red, and a string-compare entry guard
producing a *silent green*, the exact class the gate exists to remove.
**Round 2** — round 1's own fix was a safety regression: it reclassified all
five halt conditions as intra-roadmap, so under `--all` a Hard-Floor trigger
would have been recorded and skipped. **Round 3** — the governance record
asserted `--merge` ships active, 250 lines above the blocker saying it does
not, and refuted one of round 2's findings by measurement. **Round 4** —
`pr-close` is not a `GitOp` at all, so an irreversible action on a third
party's PR shipped unguarded while merging was gated; and the justification
prose had substituted a plausible mechanism for the observed one.

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
| 1 | high | src/domains/git/pr/merge/command.md:176 | § 4 shipped an ACTIVE path that closes third-party PRs. Verified: `pr-close` is not a `GitOp` at all in `git_authorization_hook.ts:150` — neither blocked nor warned. So while merge was inert, the command still authorised an irreversible-to-the-author external action with zero guard coverage and no this-turn confirmation naming the exact PR, which `non-destructive-by-default` puts on the Hard Floor. FIXED in the same push: closing now requires an explicit this-turn confirmation naming the PR number and the PRs the content landed via. | fixed | AC-5 / non-destructive-by-default · fixed in 0814e5e33 |
| 2 | high | src/scripts/check_hook_bundle_content.ts:1 | A new 203-line gate with no test file, while both siblings have one. It is local-only and a declared no-op in CI, so nothing automated exercises it: a rename of `build:hooks`, `rewriteOutfile` or `LIVE_REL` silently degrades it to exit 2 or a permanent pass. AC-2 asks for both outcomes demonstrated; the demonstration existed only as prose. FIXED: a test file locks the red, the green, the empty-scope no-op and the refuse-to-guess paths. | fixed | AC-2 · fixed in 0814e5e33 |
| 3 | high | src/domains/git/pr/merge/command.md:7 | `intent` and `description` both promised merging, and the description propagates verbatim into six shipped surfaces (catalog, index, command-flows, pack README, dist projection, eval cases). A router or catalog reader that never opens the file saw only the merge promise. FIXED: both now say prepare-to-mergeable and name the gate. | fixed | AC-5 · fixed in 0814e5e33 |
| 4 | high | src/domains/product-basic/roadmap/process-full/command.md:211 | Self-contradiction on the halt set: line 211 calls the five halt conditions exhaustive, while the unconditional delivery loop introduces a conflict-outside-the-four-classes stop. For a bare non-`--all` run that is a sixth stop reason outside the exhaustive five, and "kill switch rather than halt reason" does not reconcile it — a run that stops has stopped. FIXED: the delivery stop is named as halt condition 6, scoped to runs that reach delivery. | fixed | AC-4 · fixed in 0814e5e33 |
| 5 | medium | src/domains/git/pr/merge/command.md:257 | § 6 told the run to read `LEDGER_MAX_AGE_MS` from the SOURCE, while this same diff's central lesson is that the built bundle is what enforces it and a source read can return a value the guard is not applying — the 2026-08-21 failure re-expressed as an instruction. FIXED: the read asserts source-equals-bundle first, via the gate this diff adds. | fixed | AC-1 · fixed in 0814e5e33 |
| 6 | medium | src/config/estate-count-budget.json:526 | Three step counts for one roadmap disagreed in one diff. The budget `why` is the record the estate ratchet is justified by, which is the one place an off-by-two should not sit. FIXED: the budget prose now carries the same measured figure as the frontmatter, and both name what they count. | fixed | AC-8 · fixed in 0814e5e33 |
| 7 | medium | src/scripts/check_hook_bundle_content.ts:11 | The load-bearing "measured, not hypothetical" justification was causally unsound: an ordinary edit updates the source mtime, so the freshness gate would go RED, not green. The green is explained by the gate being pre-push and not having been run. The gate is still worth having; the cited mechanism did not match the cited observation, and the same paragraph was repeated in ci-fast.yml and ADR-239. FIXED in all three: the observation is stated as what it was, and the mtime-vs-content argument is made from the cases that actually defeat mtime. | fixed | AC-2 · fixed in 0814e5e33 |
| 8 | medium | docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md:155 | The ADR cites a roadmap by path. `no-roadmap-references` forbids a stable artifact citing a specific roadmap, and an accepted ADR is permanent while the roadmap is archived on completion. `check_no_roadmap_refs` is blind here — `docs/decisions/` is not in its stable-tree set. FIXED: the citation names the roadmap without a path. | fixed | no-roadmap-references · fixed in 0814e5e33 |
| 9 | medium | dist/agent-src/commands/pr/merge.md:58 | Every relative link in the shipped projection is unresolvable. Measured on this tree, so is every one of the sibling `dist/agent-src/commands/pr/create.md`'s twelve — the condenser copies verbatim (ADR-201) and a link cannot resolve in both trees. This is pre-existing projection debt, not something this diff introduces, and per `minimal-safe-diff` it is recorded rather than repaired here. The links resolve in `src/`, which is where they are authored and read. | accepted-risk | pre-existing projection debt; repairing it here is the drive-by `minimal-safe-diff` forbids |
| 10 | low | agents/roadmaps/road-to-drain-commands.md:46 | The guard header withholds the widened expression and marker text so a regression grep is not defeated by the guard's own prose; the same diff then planted the exact marker literal into a tracked roadmap twice. Conformant with AC-1, which scopes the ban to the guard, but it nullifies the reasoning. FIXED: the roadmap describes the marker instead of reciting it. | fixed | AC-1 · fixed in 0814e5e33 |
| 11 | low | src/scripts/check_hook_bundle_content.ts:64 | `PROBE_REL` was a fixed path, so two concurrent invocations race: the first `finally` deletes the other's output and the survivor reports "rebuild failed" — a false red on a pre-push gate, the failure mode the PATH comment above it exists to avoid. FIXED: a pid suffix. | fixed | — · fixed in 0814e5e33 |
| 12 | low | internal/reports/secret-scanner-adversarial.json:3 | Unrelated regeneration churn riding in a scoped diff — only the `generated` date changed. FIXED: reverted. The eval fixture's 13 cases against a documented 5-10 band is left as is: the linter enforces the floor only, and the extra cases are the negative routing cases this change needs. | fixed | minimal-safe-diff · fixed in 0814e5e33 |
