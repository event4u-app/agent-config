<!-- evidence-type: analysis -->

# SVG rules in the dispatch path — the two loading strategies, measured

Phase 0 of `road-to-svg-rules-in-the-dispatch-path`. An AI council of two
providers refused a hook-bundle ceiling raise 2/2 on 2026-10-11 and both seats
named the same sequencing: prototype the conditional chunk, measure both
strategies at runtime rather than in bytes, and only then choose. This is that
measurement. It asserts what was true when it was written and is never
re-bound.

Machine: darwin arm64, node v26.7.0, 2026-10-11. Tree:
`feat/svg-roadmaps-all-20261011` at the commit that carries this file.

## 0.1 — the prototype, and what it costs

The rule set is emitted as a second esbuild output and pulled in only when a
written path ends in `.svg`.

| Command | Reading |
|---|---|
| `./scripts-run src/scripts/check_hook_bundle_composition` (before) | 1,530,962 B / 1,550,000 B ceiling, 291 modules |
| `./scripts-run src/scripts/check_hook_bundle_composition` (with the routing enabled through the chunk) | **1,533,090 B** / 1,550,000 B ceiling, 292 modules |
| the same gate with `svg_rules` statically imported (built by the bench below) | **1,562,800 B** — 12,800 B over the ceiling |
| `wc -c < dist/hooks/svg_rules.chunk.cjs` | 32,987 B |
| `grep -c 'svg-structure-dangling-reference' dist/hooks/dispatch.js` | **0** — the rules are not in the shared bundle |
| `grep -c 'svg-structure-dangling-reference' dist/hooks/svg_rules.chunk.cjs` | 2 |

So the routing costs **2,128 bytes** in the bundle every hook event loads,
against **30,924** for the static import. The 1,562,800 reading reproduces the
roadmap's 1,562,931 to within 131 bytes on a tree three commits newer, which is
the cross-check that the two numbers describe the same thing.

### The four failure modes the step asked to capture

1. **`ConcernMain` is synchronous.** `concern_registry.ts:91` types it
   `(argv?) => number | undefined | void`. An `await import()` would make the
   concern return a Promise whose exit code is read as an object. The chunk is
   therefore emitted as **CJS** and pulled with `createRequire`, which is
   synchronous. This is the constraint that decided the chunk's format; an ESM
   chunk is only reachable by making every concern async, which is a different
   change.
2. **A missing chunk in a consumer install.** `package.json`'s `files` already
   carries `dist/`, so the sibling is packed with no whitelist edit — verified
   by reading the array, not assumed. The absent case is still handled: the
   loader returns `null` and the pass reports
   `verification: degraded` naming the expected path, rather than producing a
   clean SVG verdict for a file nothing checked. Pinned by
   `design_pass_svg.test.ts > rule-failure-does-not-reach-an-unrelated-event`.
3. **Path resolution through the banner.** The bundle resolves its own location
   via `__acReal(__acUrl.fileURLToPath(import.meta.url))`, and esbuild keeps
   `import.meta.url` in ESM output, so `path.dirname` of it is `dist/hooks/`.
   `rulesSpecifier` is exported and pinned on both branches so the algebra is
   testable without building a bundle.
4. **The four bundle gates.** `check_hook_bundle_composition` reads
   `build:hooks` from `package.json` and takes everything before the first
   `&& node `. The chunk build is chained **after**
   `node src/scripts/write_bundle_digest.mjs` for exactly that reason: the
   gate's probe build must not emit a chunk into the live `dist/hooks/`.
   `rebuild_hook_bundle.rewriteOutfile` matches the literal token
   `--outfile=dist/hooks/dispatch.js`, which the chunk build does not contain,
   so the self-heal path is unaffected. `write_bundle_digest` covers
   `dispatch.js` only — **the chunk has no sidecar digest**, which is recorded
   here as a known gap rather than claimed as covered.

## 0.2 — runtime, which is the axis the refusal asked for

`node agents/runtime/tmp/svg-chunk-bench.mjs` (the script is gitignored; it is
reproduced from this artefact's description). Two bundles of the design-pass
concern built from the same tree with `__AGENT_CONFIG_BUNDLE__=true`, one
loading the rules through the chunk and one importing them statically. Cold
start is a fresh `node` process per sample, which is what a hook dispatch is.
n = 21 per row.

| Strategy | Event | Bundle bytes | p10 | **median** | p90 |
|---|---|---|---|---|---|
| chunk | `.svg` write | 65,100 | 31.96 | **33.47 ms** | 34.25 |
| chunk | non-`.svg` write | 65,100 | 29.15 | **29.55 ms** | 31.17 |
| static | `.svg` write | 94,372 | 32.44 | **33.35 ms** | 35.02 |
| static | non-`.svg` write | 94,372 | 29.86 | **30.38 ms** | 30.86 |

The chunk's own first `require`, measured on its own in a bare process:
**1.896 ms** median (min 1.746, max 2.808, n = 21).

Reading it:

- On an `.svg` write the two are **indistinguishable** — 33.47 against 33.35,
  a 0.12 ms gap inside overlapping p10-p90 bands. The chunk's ~1.9 ms first
  require is paid back by the 29 KB the static bundle has to parse first.
- On every other write the chunk is **0.83 ms faster** and loads nothing. That
  is the dispatch the bundle actually performs most of the time.
- Risk 2 of the roadmap — "the chunk's first-use cost is worse than the bytes
  it saves" — is **not observed**. The crossover would need `.svg` writes to
  dominate the event mix, and even then the two medians agree.

### What this reading does NOT establish

The concern is driven **directly** here, not through `dist/hooks/dispatch.js`.
Driving the full dispatcher was tried and the design-pass concern returns
`allow` with no output under it — for a `.tsx` target as well as an `.svg` one,
i.e. a property of that harness that predates this change and is not caused by
it. The numbers above therefore describe the concern's own cold start, not the
whole dispatcher's. The bytes measured by `check_hook_bundle_composition`
above are the dispatcher-level figure and are unaffected by this.

Two measurement bugs were found and fixed in this script before the table was
trusted, and both produced plausible-looking output:

- The first draft invoked `dispatch.js` without `--platform`, so all 15 samples
  per row timed an argument error. The four medians agreed to within 0.6 ms
  because they were four copies of the same failure.
- The second draft shared one project root across strategies. The concern
  dedupes findings against `agents/runtime/state/design-pass-hook.json`, so the
  rows that ran second read an already-drained file and reported
  `exercised: false` for a build that works. Every row in the table above
  carries an `exercised` flag asserted from the sample's own output before the
  timing is kept.

## 0.3 — containment

`npx vitest run tests/scripts/design_pass_svg.test.ts --reporter=verbose` — 5
passed. `rule-failure-does-not-reach-an-unrelated-event` exercises an absent
chunk, a chunk that throws at module scope, a chunk with no `scanSvg` export,
and a working chunk, and asserts the first three return `null` without throwing
while the fourth returns a function — so "null" is not simply what the loader
always says. The non-`.svg` half is pinned on `isSvgAsset`, which is the
expression that guards the call site.

The test went red twice on the way and both reds were real: `require` caches by
resolved path, so rewriting one chunk file in place served the first module to
every later case; and the bundled branch is unreachable from a test runner
where the esbuild define is absent, which is why `loadSvgScanUncached` takes an
explicit `bundled` argument the hook path never passes.

## The choice this settles (roadmap 1.1)

**(a), the conditional chunk.** It is never slower on the event that uses the
rules, is faster on every other event, and leaves 16,910 bytes of headroom
under the existing ceiling instead of asking for 12,800 more. No budget change
is taken, so the roadmap's AC-4 and Risk 5 — "the ceiling becomes a precedent
for bundling any domain concern" — are discharged by not setting the precedent.
