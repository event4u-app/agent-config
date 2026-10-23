<!-- evidence-type: analysis -->
# Code-graph providers — baseline and readings, 2026-10-23

> `road-to-graph-providers-for-every-stack` 0.2, 3.5, 5.1, 7.1 and 7.2. Built at
> `main@4502d328f` before any code moved, with `code-graph build --force` and
> `code-graph map --no-verify` on three trees. Two full runs produced identical bytes.

## Trees

| Tree | What it is |
|---|---|
| this repository | the agent-config working tree at the pin |
| Fixture L | the MIT Laravel application pinned in `road-to-a-map-that-draws-itself`, at `045c6a98cac2` |
| synthetic | five files: a TypeScript package with `main` / `bin`, a Python module pair, one HTML template |

## Baseline checksums (SHA-256, first 16 hex)

| Tree | graph.json | map.json | MAP.md |
|---|---|---|---|
| this repository | `9595fc48a4e687ac` | `8da87b86b6c51dc5` | `7c84fb96c14e8b3e` |
| Fixture L | `884ac13eed081cd4` | `43cba985d3852183` | `18b3422667576c95` |
| synthetic | `b36b3f4e23f4d686` | `4758f8372cd83ad7` | `bb5fe0c80b919222` |

## Baseline readings

"Unconnected" counts file nodes with no stated, cross-file edge (member edges and the guess
mechanisms `name-lookup`, `dynamic`, `foreign` excluded). The definition is this file's own;
it reads 11.5 % on Fixture L where the source plan reported 11.3 % under a slightly different
counting rule.

| Tree | Files | Unconnected | Routes | Routes resolved | Edges |
|---|---|---|---|---|---|
| this repository | 10,452 | 1,890 (18.1 %) | 0 | 0 | 226,306 |
| Fixture L | 2,235 | 256 (11.5 %) | 340 | 340 | 104,062 |
| synthetic | 5 | 0 (0 %) | 0 | 0 | 11 |

## After Phase 1 (the seam)

| Tree | graph.json | map.json | MAP.md |
|---|---|---|---|
| Fixture L | `884ac13eed081cd4` (identical) | `43cba985d3852183` (identical) | `18b3422667576c95` (identical) |
| synthetic | `b36b3f4e23f4d686` (identical) | `4758f8372cd83ad7` (identical) | `bb5fe0c80b919222` (identical) |

This repository: Laravel was previously applied to every PHP file. With marker detection it
runs only in the fixture packages whose `composer.json` requires `laravel/framework` or an
`illuminate/*` package, or that carry an `artisan` file, and only on their files.
`schema-call` edges 13 → 6 and table nodes 8 → 3: the removed ones sat in fixture trees with
no Laravel marker (`tests/fixtures/persistence/**`, `internal/bench/scale-history/**`).

## After Phase 2 (schema 6)

| Tree | Unconnected | Routes resolved | Edges |
|---|---|---|---|
| Fixture L | 255 (11.4 %) | 340 / 340 | 105,477 (+1,415: a method now `uses` the models its body names) |
| synthetic | 0 | — | 11 (unchanged) |

Hook bundle after the trust allowlist: 1,550,446 B against the 1,550,500 B ceiling. The
trust lists live once in `types.ts` and the schema gate reads them; the optional
`provider_id` type check was left out of `validate.ts` to stay inside the budget.

## The default pass (Phase 3)

Edges per mechanism, and a precision sample read by hand against the source line. A
mechanism under the 90 % bar is off by default.

| Mechanism | This repository | Fixture L | Precision sample | Default |
|---|---|---|---|---|
| `literal-path` | 433 | 102 | 25 / 25 (repository) · 20 / 20 (Fixture L) | on |
| `literal-dotted` | — | 6 | 3 / 6 — `trans('common.sort')`, a translation key, matched a view of the same name | **off** |
| `fs-route` | 9 | 0 | 9 / 9 | on |

Two corrections from the first reading, before the sample above: a literal inside a
backtick span is usually a mention in a comment and is no longer read; and a literal may
name code, a document or a template, never a data file or a dotfile (the first run drew 832
JSON, YAML and dotfile nodes into the map, among them a worktree's `.git` file).
On Fixture L most `literal-path` edges are `export {X} from './y'` re-exports, which the
extractor does not turn into edges — the default pass closes that gap as a side effect.

Fixture L after Phase 3: 255 unconnected (11.4 %), 340 / 340 routes. Hook bundle:
1,550,498 B against 1,550,500 B.

## Final readings (Phase 7)

Fixture L after every phase: 255 unconnected files (11.4 %, baseline 11.5 %), 340 / 340
routes resolved, one fluent route-builder call contested by the Laravel provider and
removed. The synthetic tree gains one `literal-path` edge (its HTML template) and nothing
else. This repository activates all 19 providers, each through a fixture package under
`tests/fixtures/`; its graph changes by the schema rename, the default-pass edges and those
fixture packages' provider edges.

Provider oracles (positive and negative per relation claimed; each provider's core
mechanism was neutralised once and an oracle went red before it was restored):

| Test file | Passed |
|---|---|
| angular | 9 / 9 |
| aspnetcore | 8 / 8 |
| django | 13 / 13 |
| express | 6 / 6 |
| fastapi | 8 / 8 |
| flask | 8 / 8 |
| go-http | 10 / 10 |
| laravel | 16 / 16 |
| nestjs | 7 / 7 |
| nextjs | 10 / 10 |
| nuxt | 6 / 6 |
| react-router | 9 / 9 |
| spring | 9 / 9 |
| sqlalchemy | 8 / 8 |
| sveltekit | 8 / 8 |
| symfony | 12 / 12 |
| typeorm | 8 / 8 |
| vue-router | 7 / 7 |
| wordpress | 11 / 11 |

## Grammar payload (5.1)

Pristine built tarball, `npm pack --dry-run --json --ignore-scripts` after `npm run build`:
base 15.683 MB · with the C# grammar 15.937 MB · with C# and Ruby 16.103 MB, against the
built regression line 15.949 MB (14.4989 × 1.10). C# shipped; Ruby and Rails (5.4) wait for
the budget decision recorded in the roadmap. The vendored C# grammar is ABI 13; the loader
pins the ABI per language (`csharp: 13`), still an exact match.
