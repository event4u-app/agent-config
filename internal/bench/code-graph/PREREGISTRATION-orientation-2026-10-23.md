# Pre-registration — orientation with and without the map, 2026-10-23

> Registered BEFORE the first run (road-to-a-map-that-draws-itself 8.3). Not comparable to the
> graph-vs-grep reports beside it: those measure symbol retrieval, this measures orientation —
> finding where something lives and what it touches. No threshold below may be renegotiated
> after a result is seen.

## Question

Does an agent that may read `agents/map/MAP.md` and the area pages orient faster, and no less
correctly, than one restricted to grep / glob / read?

## Subjects

| Subject | Pin |
|---|---|
| This repository | the PR head the run is recorded against |
| Fixture L — an MIT Laravel application | commit `045c6a98` of its upstream (the identity is recorded outside the tree) |

The map of each subject is built with `agent-config code-graph map` before the run.

## Questions and answer key

The key was derived from the source with grep and file reads, not from the map.

| ID | Subject | Question | Key (scored) |
|---|---|---|---|
| R1 | this repo | Which group of files makes up the AI-council CLI subsystem, and what is its central file? | names `src/scripts/council_cli.ts` as central **and** at least two files under `src/scripts/ai_council/` |
| R2 | this repo | Outside `src/scripts/code_graph/`, which repository files does `src/scripts/code_graph/query.ts` depend on? | `src/scripts/_lib/lexical_index.ts`, and no other out-of-directory file |
| R3 | this repo | Which files under `src/scripts/_lib/` are imported by the most other files? Name the top three. | `scan_scope.ts` first; at least two of `scan_scope.ts`, `gate_self_test.ts`, `gate_ledger.ts` |
| L1 | Fixture L | What does the web route `GET /books` touch: which controller method handles it and which view does it render? | `BookController::index` **and** `resources/views/books/index.blade.php` |
| L2 | Fixture L | Which controller handles the bookshelf ("shelves") pages? | `BookshelfController` |
| L3 | Fixture L | Which model owns the `pages` table, and which models does it declare Eloquent relations to? | `app/Entities/Models/Page.php` **and** at least three of `Chapter`, `PageRevision`, `Attachment`, `EntityPageData` |

Scoring per answer: 1 when every **and**-part of the key holds, 0 otherwise. Wrong extra claims do
not cost a point but are recorded.

## Arms

- **A — search only.** Grep, glob and read anywhere in the subject **except** `agents/map/`.
- **B — map first.** The same tools, plus `agents/map/MAP.md` and `agents/map/areas/*.md`.

Each question runs once per arm, in a fresh subagent of the same model, with the same prompt apart
from the one tool-scope sentence. The prompt states no expected outcome.

## Measured

Correctness (0/1), tool calls, total tokens, as reported by the harness for each subagent.

## Bars, fixed now

- **B wins** if its correctness sum is ≥ A's **and** its median tool calls are ≤ 0.8 × A's.
- **B loses** if its correctness sum is below A's.
- Anything else is a **tie**.

On a win, the `code-intelligence` skill routes orientation questions to `MAP.md` first; on a tie
or a loss the map stays on demand and the context hook stays as it is (roadmap step 5.4). The
result is published either way, in `internal/bench/reports/`.

## Honest limits, stated before the data

Six questions, one run per arm, one model: this can show a large difference and cannot show a
small one. A tie is the expected result for anything under roughly a third fewer tool calls.
