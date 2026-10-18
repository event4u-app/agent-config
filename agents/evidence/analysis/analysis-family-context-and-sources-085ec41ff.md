<!-- evidence-type: analysis -->

# Analysis family — context and source disposition, 2026-10-15

Moved verbatim on 2026-10-18 from `agents/roadmaps/road-to-an-analysis-family-that-deepens-itself.md`
when the roadmap reached the lightweight 600-line cap. Dated evidence: the findings
were read at `085ec41ff`; the disposition records how the inbox round `inbox-2026-10-s`
was folded. Only the two section headings were lowered one level in the move.

### Context — what the tree shows at `085ec41ff`

| # | Finding | Evidence |
|---|---|---|
| F1 | The pipeline exists nowhere; its parts do | `grep -rl repo-loop agents/roadmaps src` → 0; loop contract `src/domains/analysis-workbench/analyze/repo/command.md:81-96`, `:290-344`; inbox passes `analyze/inbox/command.md:127-178` |
| F2 | No command resolves its scope | `grep -c 'trace-root\|resolve_project_root'` → 0 in `analyze/repo`, `analyze/inbox`, `meta/optimize/deep`; resolver `src/scripts/_lib/agent_settings.ts:554`, `:768` |
| F3 | Directive (b)'s module exception fails both ways | reproduced (Phase 4b of the run): from `app/Modules/Foo/src` with an unmarked `Foo/agents/` the walk returns the repository root; with `Foo/agents/roadmaps/` it returns the module and loses the outer project; `detect_module_roots` places `app/Modules` at `high` |
| F4 | `doctor --trace-root --json` reports root, anchor and trace, never a module or scope kind | run at HEAD; `src/scripts/_cli/cmd_doctor.ts:3189-3209` |
| F5 | The reference and inbox commands only improve this package | `workspaces: [agent-config-maintainer]` at `analyze/repo/command.md:21-22`, `analyze/inbox/command.md:15-16`; anchor table reads `docs/CLAIMS.md` (`analyze/repo/command.md:128`) |
| F6 | No research step | `grep -ciE 'websearch\|web search'` → 0 in `analyze/repo`, `analyze/inbox`, `meta/optimize/deep` |
| F7 | Council seats cannot be "the other analyst" | "It never edits, never runs a command, never fetches" — `src/scripts/ai_council/cli_agency_bounds.ts:4-6` |
| F8 | The exchange instruments have no production caller | `scoreNextCall`, `auditMinorityRetention`, `evaluateStop`, `selectCrossExamTarget` each occur only in their own file under `src/` (`selectCrossExamTarget` also in `topology_vocabulary.ts`, a vocabulary entry) |
| F9 | The final stage may not deliver | `analyze/inbox/command.md:50` forbids branch, worktree and PR; `/create-pr` defaults to a silent draft (`src/domains/git/pr/create/command.md:350`) |
| F10 | `agents/tmp/` is the owner's | "the agent never writes files into it" — `docs/contracts/agents-layout.md:118`; `agents/runtime/` is gitignored (`.gitignore:211`) |
| F11 | The router knows six of nine sub-commands | keyword table and menu `analyze/command.md:60-67`, `:78-86`, "all six options" `:100`; `routes_to` lists nine |
| F12 | Chaining has exactly one exception | `roadmap-repos → repo`, `analyze/command.md` § Rules |
| F13 | `optimize:deep` already is "analyse and improve this project" | analysis, council, roadmaps, PR, N loops, `engineering` workspace — `src/domains/meta/optimize/deep/command.md:20-38`; limits pinned by `tests/scripts/optimize_deep_limits.test.ts` |
| F14 | `council:pr` asks for a number and has no apply path | `src/domains/meta/council/pr/command.md:31-38` |
| F15 | A pre-registered claim binds five mechanisms of `analyze:repo` — and two of them have already moved | `docs/CLAIMS.md:496-500` (unbacked, 180 days from 2026-08-12); `git log --since=2026-08-12` on the command shows `f1d5f3f3a` (bound-claim gate, 2026-09-07) and `26dd1905e`/`7c728f35b` (`--deep` ceiling four-part → three-part, 2026-10-15). A "byte-identical freeze" from registration is already impossible |
| F16 | ADR-118 bounds loop surfaces | "no run-until-condition goal command" and no "loop-design contract/checklist artifact" — `docs/decisions/ADR-118-loop-engineering-boundaries.md:119-127`; every door here is a consumer surface |
| F17 | Visible sub-commands need a controlled verb | `lint_command_verbs.ts` gates `visibility: visible\|advanced`; `and` is not in `src/config/discovery/command-verbs.yml`. Today's analyze subs are `internal` |
| F18 | Adding skills is closed | the skills catalog is a gated bucket of `src/config/preamble-payload-budget.json`, which fails on growth |

### Source disposition

**Lineage.** `lint_consolidation_lineage` is clean. Source A's exchange final
omits the council review — discharge 3: the review reached it through Source C,
which consolidates it, and A adds nothing beyond that. Source C omits A's final
(written later) — discharge 1: folded here (A's D01–D10, W0–W7, A01–A12 map onto
Phases 1–6 and AC-1–AC-10). Dropped between A's seed and A's final: the core
prompt → 4.4; the fixture benchmark → 1.4; `learning_value`, retro events and
catch-up jobs → K4; blind A/B and canary → 6.6.

**Kill register.**

| ID | Killed | Why |
|---|---|---|
| K1 | Majority vote on facts | facts are settled by the tree; the source set's literature on conformity |
| K2 | Tools for council seats | seats stay oracles (D3) |
| K3 | A new resolver over workspace manifests | `detect_module_roots` already places module parents (F3 reproduced) |
| K4 | A `learning_value` score, retro event list, retro call per run | the retro owns triage and its one-learning rule |
| K5 | `status: blocked` | not a roadmap status; `ready` + `> Blocked until` (D4) |
| K6 | A model judge as the emission gate | uncalibrated; 3.2 is deterministic |
| K7 | Mandatory owner confirmation of every imported directive | recreates the blocking D5 removes; 3.4 binds by provenance |
| K8 | `--handoff` writes into `agents/tmp/` | F10 |
| K9 | A release-scoring mode on `analyze:pr` | not asked for; a PR review repeated across models needs no own surface |
| K10 | A fifth command for prompts | `--emit-prompts` on the source door (4.4) |
| K11 | Nine per-capability settings keys | flags cover it (`--no-network`, `--no-pr`, `--comment`, `--mode=plan`); a settings key is a public surface |
| K12 | Auto-merge, PR comments by default, source names in branch / round / PR text | merge stays this-turn gated; posting opt-in; source silence |
| K13 | The peer review's two "everyone missed" items — a 30-second read-only validator wedge, and whether AI-optimised plans are the right problem | the first names a product the source set does not mention (context drift in the seat); the second is answered by directive (a) |

| K14 | A separate evidence file for the directives; inbox step files; a percentage on the extra-round offer; three roadmaps instead of one | directives sit in this header; step files are `road-to-steps-the-skill-cannot-skip`'s; 2.6 gives a band; one shared first slice |
