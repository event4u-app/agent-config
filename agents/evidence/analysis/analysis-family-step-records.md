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

## AC-1

`analysis_target.test.ts` (15 cases) pins the resolver's module and `project_root`
semantics; `analysis_scope_line_doors.test.ts` is the per-door half and was red on
`analyze/repo`, which named neither the scope line nor the resolver, until its § 1
was given both.

## AC-2

`analyze:inbox` was the one door shipping its caps in prose alone and now carries
the same five keys as its siblings, pinned by `analyze_inbox_limits.test.ts` beside
`analyze_repo_limits`, `analyze_pr_limits` and `optimize_deep_limits`.

## AC-3

`analysis_analysts.test.ts` (19 cases, including an output that consulted another
analyst before the exchange, and a subagent never stamped cross-family) and
`analysis_exchange.test.ts` (9 cases, including a minority finding dropped silently
and one mentioned without a disposition).

## AC-4

`analysis_gate.test.ts` (17 cases) pinned the decision half only. The shared
context now carries the showing half — the four returned fields printed after every
exchange, and an offer is affordability rather than a decision — pinned by
`analysis_gate_surfacing.test.ts`, red before the edit.

## AC-5

Held. The mechanism is pinned on fixture rounds (`analysis_inbox_final`,
`analysis_publish`, `analysis_questions`); the replayed round this criterion names
is step 3.5, whose inputs are not in the repository. Blocker
`replay-round-is-maintainer-local`.

## AC-6

`analysis_anchors.test.ts` carries exactly those three cases, plus the no-signal
fixture that states feature mode anchored on `--goal`.

## AC-7

`analysis_pr_target.test.ts` (6 cases), `analysis_pr_optimize.test.ts` (10,
including a moved head stopping before the push and a fork yielding a patch) and
`analyze_pr_limits.test.ts` (the door makes no `gh` write call and never merges).

## AC-8

`analysis_run.test.ts` resumes a run killed in `emitted` without re-emitting and
reports a moved head instead of continuing; `analysis_publish.test.ts` opens no
second PR on a re-run and hands back when the remote head moves mid-push.

## AC-9

Closed at mechanism level. `analysis_run.test.ts` persists the record under
`agents/runtime/analysis/<round-id>/` and `analysis_run_record.test.ts` round-trips
it with one row per analyst and loop; the retro file names `analysis-run` five
times. Stated plainly: the evidence is fixture runs — zero production runs exist,
which is what step 6.6 is held on, not this criterion.

## AC-10

`analysis_family_aliases.test.ts` reads the projected frontmatter under
`dist/agent-src/commands/analyze/` — `analyze:reference-repo` and `optimize:deep`
as `replaces:` entries, `analyze:repo` as the live name until 6.2b renames it.
Sensitivity probed by removing one alias and watching the case go red.

## 1.1

Done 2026-10-18: the council (2/2 seats, peer review, $0) converged on a fourth
name, `analyze:reference`; ADR-288 D1 cites the record.

## 1.2

Done 2026-10-18: `docs/decisions/ADR-288-analysis-family-one-engine-four-doors.md`,
both owner answers recorded as D7 and D8.

## 1.3

Done 2026-10-19: `analyze:pr` (5.2) links it as the fourth door, beside
`analyze:repo`, `analyze:inbox` and `analyze:and-optimize`; `check_references` -> 0.

## 1.4

Done 2026-10-18 in ADR-288 D9. The 40-file small-scope size and the
1,500,000-token round ceiling are stated defaults under its Assumptions, not
measurements; the slicing size is the inbox's own measured 400 KB / 5-topic
threshold.

## 2.4b

Done 2026-10-18: `ANALYST_BOUNDS` in `cli_agency_bounds.ts` beside the unchanged
seat bounds, `cli` mode and `cliAnalystCommand` in `analysis_analysts.ts` (seen
red). Live probe `agents/evidence/analysis/analyst-cli-profile-probe-2026-10-18.md`:
claude and codex read the fixture and refused the sentinel; gemini drops its bound
in an untrusted folder and is refused.

## 1.2-spec

Records: the four doors (the foreign-source door per 1.1; `optimize:deep` renamed
`analyze:and-optimize` with an alias; `analyze:pr` new; `analyze:inbox` as the
final stage); the analyst class beside council member and implementer (D3); rounds
under `agents/runtime/analysis/<round-id>/` (D9); the second chaining exception — a
door invokes stages, never another door; the changed default end state (ready PR,
`--mode=plan` and `--no-pr` stop after validation without a push — an explicit
contract change, not a silent one); the push model (D7); the owner's fetch and
analyst-agency answers (D17); ADR-118 conformance — every loop, round and fix cycle
carries a numeric cap in the door's `limits:` block, no run-until-condition; no
`docs/contracts/` loop contract (D10). Alternatives: keep the optimize cluster; one
monolithic `/analyze`.

## 1.3-spec

`src/agent-src/contexts/execution/analysis-loop.md`, loaded on demand (0 standing
tokens): vocabulary (*pass* is an inbox extraction read, *loop* a deepening
iteration, *round* one exchange); the brief lifecycle (frozen after scope
resolution and at most one blocking scope question; a mid-run owner message opens a
new brief revision, recorded); the loop shape (`Loop N/M — lens — falsifiable goal
— inputs — must produce — stop-if`); the lenses of 2.3 and 2.5; evidence tiers
(`executed`, `read`, `claimed`, `inferred` — only the first two count for stopping
or "verified"); council roles (seat, synthesizer, gate judge; quorum two seats from
two providers, else `single-voice`); the `handoff-v1` shape for external analysts
(frontmatter `handoff: v1`, `phase`, `loop`, `pin`, `consolidates:` — the key
`lint_consolidation_lineage` reads; sections Findings vs tree · Kills · Decisions ·
Steps with `verify:` · Loop log; source names only in an `*.annex.md`).

## 2.3-spec

Each analyst runs seed + three loops, each over its analysis **and** its roadmap:
**Coverage** (what is there; code, not the README; what is wrongly marked
missing), **Adversary** (every retained item tested against named
counter-hypotheses — already present, contradicts a recorded decision, only
different, cost, license — killing nothing is legal when every test is recorded),
**Overbuild & sequencing** (smallest rung, duplicates folded, order). Each loop
appends a ledger row: lens, added / changed / killed items, each with an evidence
object (source identity and digest, method, claim supported or refuted, tier). A
loop with no `executed` or `read` evidence tied to a changed conclusion is
`no-external-signal` and does not count. All three lenses always run; loops 4–5
(`--loops`, cap 5) run only while the previous loop added a top-tier item; the
summary prints the real count.

## 2.4-spec

Reads the scope (the web once `source-fetch-authorization` allows), writes only
into its own round folder, never runs project scripts, never pushes. Modes:
`subagent` (same family, fresh context) and `external` (a `handoff-v1` file the
owner drops into `agents/tmp/<round-id>/` — today's practice). Every analyst gets
the same brief; outputs carry family and `context_relation` from
`src/scripts/_lib/review_independence.ts`; no seed or deepen output sees another
analyst's; a same-family analyst is never stamped cross-family. Default 3 analysts;
`--quick` or a scope under the pre-registered size runs 1 analyst and no
exchange.
