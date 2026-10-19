<!-- evidence-type: analysis -->

# Analysis family — step completion records

Moved verbatim on 2026-10-19 from `agents/roadmaps/road-to-an-analysis-family-that-deepens-itself.md`
when the roadmap passed the lightweight 600-line cap. Each section is the dated
completion note of one closed step as it stood in the roadmap, with the
indentation stripped; the step keeps a one-line pointer here.

## 3.3

Done 2026-10-18 in `src/scripts/analysis_publish.ts`
over a `PublishPort` (in-memory remote in `tests/scripts/analysis_publish.test.ts`,
git and gh in `gitGhPort`); the outside-path refusal and the fourth-red
hand-back were seen red by neutralising each check. The isDraft read is the
port's `gh pr view --json isDraft`; its first live exercise is the first
publication after 3.5, which itself runs `--no-pr`.
2026-10-18: council review of #2461 (2/2) found the stage trusted its caller (branch, lease, base SHA, allowed set, body,
clone redirects); fixed before any caller exists via `PublicationTarget`, a leased push and run-directory inputs.

## 4.2b

Done 2026-10-18 in `src/scripts/network_sources.ts`: URL reads with
credential, scheme and private-address refusal at every redirect hop,
redirect and size caps (private-host refusal seen red); depth-1 clones
with hooks off and the pin checked; the S1, S2 codebook with `ENC1:`
identities in `intake.md`; the research brief in the analyst prompt. DNS
is checked before the request, not pinned for it — the rebinding residual
is named in the module.

## 4.3

Done
2026-10-18 in `src/scripts/analysis_anchors.ts` (issue default type seen red
as `defect`); `analyze:repo` § 1a documents it, both doors carry the
`engineering` workspace and stay `internal`. Failing tests need a run and
come from the door, not the census; stack axes from `project-analysis-core`
are not wired here.

## 4.4

Done 2026-10-18 in `src/scripts/analysis_prompts.ts`
(`foldLanes` keyed by tree anchor, seen red keyed by finding id;
`emitPrompts` and its CLI), wired into the `analyze:repo` door text and
argument hint; the emitted frontmatter parses through `parseHandoff`.

## 4.5

Done
2026-10-19: moved to `src/domains/analysis-workbench/analyze/and-optimize/`
with `replaces: [optimize-deep, optimize:deep]`, `/optimize deep` routes
there, the limits test passes at the new path unchanged otherwise; the
projected door carries both aliases (`tests/scripts/analysis_and_optimize.test.ts`);
`readSet` in `src/scripts/analysis_and_optimize.ts` reads anchors and code
under the scope root (module case seen red with `project_root`); Steps
0–5 re-expressed over 2.1–3.3.

## 3.4

Done 2026-10-19: the
ban is replaced by § Where the work happens (publish via
`analysis_publish.ts`, `--no-pr`, `vcs: none`); `roundUnion`,
`directiveBinding`, `convergenceRow`, `planLanes` and `foldLaneLedgers`
in `src/scripts/analysis_inbox_final.ts` (unchecked-directive, contradicted
transcript turn and ledger-less lane cases seen red); Phase 1 reads the
round union, Phase 2b runs lanes, Phase 6c is the final loop.

## 5.2

Done 2026-10-19: `src/domains/analysis-workbench/analyze/pr/command.md`
over `reviewPr` in `src/scripts/analysis_pr_review.ts` (throwaway
worktree, same-family disprover refused, threshold 0.7, dedupe,
introduced-vs-pre-existing from the diff); the unconditional-comment and
same-family cases were seen red. Finding the defect stays model work in
the door; the module decides what of it is reported.

## 5.3

Done 2026-10-19 in `src/scripts/analysis_pr_optimize.ts`
(moved-head and round-cap cases seen red); the port has no merge and no
approve, and the push leases the expected head.

## 6.1

Done 2026-10-19: eleven entries, each with a table row, a
keyword row, a menu entry and one eval case
(`tests/scripts/analyze_router_routes.test.ts`, a dropped menu entry seen
red); the escape reads `routes_to`.

## 6.2

Done 2026-10-19: clusters table, surface map, both packs and READMEs,
catalog, index, command flows and evals regenerated or edited; the
remaining hits are alias lines, ADR-288's record and archived changelogs.

## 6.3

Done 2026-10-18 in
`src/scripts/analysis_run_record.ts` (built, validated, written atomically;
an unread turnaround or exchange is `missing`, never 0). No door writes it
yet: that is the door wiring of 3.4, 4.5 and 5.2.
