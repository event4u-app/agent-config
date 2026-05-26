# Bench-AB Fixture

> Neutral TypeScript demo project. Two clones of this directory tree are materialised under `internal/bench/ab/clones/{with,without}/` by `scripts/bench_ab_clone.py`. The `with` clone gets an installed `.claude/`, `.augment/`, `AGENTS.md`, `CLAUDE.md`. The `without` clone gets nothing extra.

Both variants execute the same task corpus against this tree. The fixture should be small, plausible, and stable — it is the experimental control surface.

## Domain shape

A small "task manager" CLI: parse a JSON file of tasks, filter, format, write back. Touches:

- A parser (`src/parser.ts`) — string handling, error paths.
- A formatter (`src/formatter.ts`) — pure function with edge cases.
- A CLI entry (`src/cli.ts`) — small surface.
- Tests under `tests/`.

This is small enough that the corpus tasks (bug-fix, feature-add, refactor, UI-audit, test-add) can each land in a sensible location, big enough that the model has to choose what to read.

## Why TypeScript over Laravel

- No PHP runtime / Composer install needed inside each clone.
- TypeScript syntax errors surface fast — useful for the structural success criteria in Track B.
- The skill suite spans PHP and TS equally; neither is a fairness gift to either variant.

## Not run during the bench

The fixture is **never executed** as a real Node project. Its `package.json` exists so an agent operating on it sees a plausible project shape. No `npm install` is performed by the bench; no test runner is invoked. Track B's success criteria are **structural** (file existed, file modified, regex matched in transcript) — not "did the tests pass". That is intentional and documented in the parent roadmap.
