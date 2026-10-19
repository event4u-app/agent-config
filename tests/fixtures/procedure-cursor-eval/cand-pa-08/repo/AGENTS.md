# AGENTS.md

## Layout

- `src/importers/` holds the current supplier importers.
- `src/legacy-importers/` holds the old XML importers; do not change them without a migration plan.
- `src/index.js` schedules the nightly sync.

## Commands

- `npm start` runs the scheduler.
