<!-- evidence-type: analysis -->

# The retired hook-bundle ratchet (2026-10-01 → 2026-11-20)

The full file is in git: `git show 2eef08c00b:src/config/hook-bundle-budget.json`
(78 KB). This note keeps what a later reader needs without opening it.

## What it was

- `max_bytes` for `dist/hooks/dispatch.js`, `shrink_only: true`, raised only
  with a `raise_log` entry naming what was added and why it could not be
  avoided, enforced against the base revision since 2026-10.
- 18 per-chunk ceilings and one chunk-group ceiling, with the same raise rule.
- `max_yaml_packages: 1` over a closed list of four YAML package names.
- On the ratification gate's watched set, so every raise also needed a
  two-provider council record.

## What it cost

- 28 `raise_log` entries in six weeks: 18 on the bundle, 10 on chunks. The
  ceiling went from 1,500,000 to 1,595,100 B; the smallest raise was 94 B.
- At the last pin the gate read 1,595,089 B: 11 B of headroom.
- At least one code change was made worse to fit (a `provider_id` type check
  dropped "for its last 2 bytes", #2603), and two steps of
  `road-to-a-map-that-knows-what-happened` shipped unwired for lack of 1 B.

## What it caught, and what it missed

- Caught: the second YAML parser (95,846 B) that opened it, and twice a concern
  that dragged about 5 KB of an unrelated module into the bundle.
- Missed: a second YAML copy loaded at runtime on every dispatch through
  `createRequire(import.meta.url)('yaml')` in `settings.ts`, which esbuild does
  not bundle and which therefore contributed 0 B to the metafile it read.

## What replaced it

`road-to-a-hook-system-that-pays-for-what-it-does` Phase 1 and 3: a package
allowlist (any unlisted npm package in the bundle fails), one backstop at the
reading plus about 20 %, chunk sizes reported rather than gated, and a runtime
load-set check for the class the byte gate could not see. Owner directive:
`agents/evidence/owner-directives/2026-11-20-hook-bundle-budget-and-hook-economy.md`.
