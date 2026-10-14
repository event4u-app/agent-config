# Findings: drain-four-drifted-vendor-pages
<!-- completion-review: v1 | reviewed: 2026-10-14 | scope: a95cfbd2be6193dda91ef0ecd046c24add05e82722fca7253e1f36cde8a6206a | diff: a853e235e10f61beffcd67ac78d34b16622fb3af | reviewer: r2-fresh-subagent-drain-four-drifted-vendor-pages | prompt_hash: 4ca8a57ad24ed003e3189c50a9cfbea5bfa26bc04ecf3e220b23be278f12b8cb -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-drain-four-drifted-vendor-pages"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-14 -->

<!-- context-manifest: v1
inputs:
  diff_sha: a853e235e10f61beffcd67ac78d34b16622fb3af
  scope_hash: a95cfbd2be6193dda91ef0ecd046c24add05e82722fca7253e1f36cde8a6206a
  roadmap: agents/roadmaps/archive/road-to-re-establishing-four-drifted-vendor-pages.md
  roadmap_hash: d1c06f55664a94414e41711aa9d47a0c7c8cac4e50de302fcb542ec2357a3c62
  ac_hash: 9177b5025bfc210404254faf14b8fcb1859646e899978dae0dde50367c93e065
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-14T15:26:33Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/scripts/_lib/source_shape.ts:110 | The lookbehind `(?<![A-Za-z0-9.-])` silences EVERY github.com subdomain, not only the documentation host it was written for. `api.github.com/repos/<owner>/<repo>`, `gist.github.com/<user>/<id>` and `codeload.github.com/<owner>/<repo>` fired before this change (mis-parsed, but fired, so `repoSlugHits` flagged the line) and now produce zero hits — a new false-negative path through the source-confidentiality shape check. The added test pins only `docs.github.com` and the bare host, so nothing shows the wider silencing; a narrower exclusion (e.g. `docs.` only, or parsing `/repos/<o>/<r>` on `api.`) would have fixed the reported mis-read without opening it. | open | |
| 2 | medium | src/scripts/_lib/host_listing_model.ts:88 | The re-read found that the only upstream basis for `charsPerToken: 4` (the "≈8,000 characters on 200k" illustration) is gone, but the change only re-dated prose: `CLAUDE_CODE_LISTING_DEFAULTS` is still headed "Documented Claude Code defaults, read 2026-08-22" and still ships `charsPerToken: 4` as if documented, `budget-unit-is-chars` keeps `provenance: 'upstream-prose'` although no current upstream prose carries it, and `host_docs_pages.yaml:57` (`why`) still says the model "cites this page for every number in it" while the page was re-established at a new digest. The roadmap's skills-page finding ("the four modelled facts still hold") and the re-dated row therefore certify a page that no longer supports one of the model's four defaults; the drift was recorded but not carried into the model's own provenance. | open | |
| 3 | low | agents/roadmaps/stubs/road-to-scheduled-reds-that-reach-someone.md:26 | "none but the digest watch writes anything when it fails, and none grants `issues: write`" — the second clause, read with the same scope as the first, is false after this branch: the digest watch's `route-drift` job now grants `issues: write`. Should say "none other". | open | |
<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
