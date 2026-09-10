---
adr: 273
status: accepted
date: 2026-09-10
decision: pack-size-caps-reset-on-a-reconstructed-clean-baseline
supersedes: —
superseded_by: —
type: structural
reopen_policy: directional
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E3
  basis:
    - src/config/pack-size-budget.json
    - src/scripts/check_pack_size.ts
    - agents/roadmaps/road-to-the-packed-payload-cap.md
    - package.json
review_trigger: >-
  `check_pack_size` gains a `.github` invocation, at which point the caps are
  measured by something other than a workstation and both figures here should be
  re-taken in that environment; or a change moves the commands that currently
  resolve through `src/scripts/` behind `dist/cli-delegate/`, which would make
  48.2 % of the tarball removable and the caps must then walk DOWN in the same
  change rather than stand.
---

# ADR-273 — the pack-size caps are reset on a reconstructed clean baseline

## Status

Accepted 2026-09-10. Decided by an AI council over three rounds under an owner
delegation covering this run. The owner delegated the decision; the council held
it, and the third round is where it changed shape, because the first two rested
on a measurement that turned out to be wrong.

## Context

`check_pack_size` routes on `payloadIsBuilt` (keyed on `dist/cli/**`): an
UNBUILT payload is judged against the absolute cap
`budgets.packed_size_mb.max`, a BUILT payload against the newest
`built_surface_measurement_*.built.packed_mb` on a `regression_pct: 10` line.

Both axes had been red for weeks, so the gate had stopped discriminating: it
reported the same failure on every branch. Its only caller is
`taskfiles/ci-fast.yml:846` — there is no `.github` invocation — so the
consequence was a permanently red local `task ci` rather than a blocked merge.

Three causes were separated by measurement rather than argued.

1. **25 gitignored `__pycache__/*.pyc` files were being packed.** `files[]`
   lists `src/scripts/`, and `.npmignore` cannot withhold what `files[]` admits.
   Removing the local caches took the binary axis from 28 observed / 3 allowed
   to 3 / 3.
2. **`dist/cli-delegate` had accumulated 105 esbuild chunks** dated 2026-07-31
   through 2026-09-07. Three esbuild invocations share one `--outdir` with
   `--splitting`, chunk names are content-hashed, and none of the three cleaned
   the directory, so every superseded chunk stayed and shipped. Worth 1.32 MB
   packed.
3. **The residual is genuine tree growth.**

The recorded 2026-08-24 built baseline was itself measured while causes 1 and 2
were already present, so the comparator was contaminated too.

## Decision

**Option (a) — reset both caps on freshly measured, reproducible readings, and
record the reconstruction that makes them comparable.**

- `budgets.packed_size_mb.max`: **9.1 → 11.5**, derived by this file's own
  documented formula `measurement × 1.095` from the measured 10.5056, giving
  11.5036 and rounded **down** to 11.5 — stricter than the formula, not looser.
- New `built_surface_measurement_2026_09_10` records unbuilt **10.5056** / 3037
  entries and built **12.4539** / 3240 entries, the latter being the lower of
  two readings taken in different checkouts.
- `build:cli-delegate` is prefixed with `rm -rf dist/cli-delegate` so cause 2
  cannot recur.
- The 2026-08-24 record is **annotated in place, not renamed**.

### Three council preconditions, all discharged before the reset

**Reproducibility.** Two independent pristine builds from one clean tree
produced byte-identical pack manifests — 3241 entries, 12,489,135 bytes, equal
line for line — and neither dirtied the tracked tree.

**Historical clean reconstruction.** The commit that recorded the old baseline
(`ab398ed05`) was checked out detached, `npm ci` run against its own lockfile, a
full `npm run build` performed, and the tree packed. Clean figure at that exact
revision: **10.1467 MB / 2785 entries**, against the recorded 10.5525 / 2808.
The old record carries **0.4058 MB / 23 entries** of pollution, so real
clean-to-clean growth is **+2.3424 MB / +456 entries** — *larger* than a naive
subtraction gives, because the pollution masked growth rather than inventing it.

**The `src/scripts` question.** See below; it is the reason there are three
rounds and not two.

## What the third round found, and why it matters more than the reset

Rounds 1 and 2 both asserted that WASM "compresses poorly" and that the three
`tree-sitter-*.wasm` grammars therefore accounted for most of the growth. One
seat used that to justify accepting it. **Both statements are false.**

Measured by adding one `!<subtree>/**` negation to `files[]` at a time and
re-packing — packed bytes, which is what the caps are in:

| subtree | packed MB | share |
|---|---|---|
| `src/scripts` | 6.0231 | 48.2 % |
| `dist/agent-src` | 2.6187 | 21.0 % |
| `dist/cli-delegate` | 0.6462 | 5.2 % |
| `dist/mcp` | 0.5319 | 4.3 % |
| `src/vendor` (the grammars) | 0.3752 | 3.0 % |
| `dist/hooks` | 0.3308 | 2.6 % |

3.807 MB unpacked → 0.3752 MB packed is ~90 % compression. The grammars are
19 % of the unbuilt growth, not the majority of it.

That left the reset resting on a subtree worth 48.2 % of the tarball whose
necessity nobody had established — and `scripts-run`, the only obvious way to
execute those sources, needs `tsx`, a **devDependency** a consumer never
receives. Both seats independently specified the same settling test and both
proposed carrying it as a provisional clause on the raise.

**It was run instead of deferred.** Two real tarballs were built from this tree:
the full one at 12,489,135 B and one with `!src/scripts/**` at 6,466,000 B. Each
was installed with `--omit=dev --ignore-scripts` into an otherwise empty Node
project and driven through twelve entry points.

- Full install: `--version`, `--help`, `settings:get`, `packs:active`,
  `mcp:available`, `brand:status`, `hooks:status`, `council:status`,
  `routing:doctor`, `sessions:list` all succeed.
- Stripped install: only `--version` and `--help` survive. **Every other command
  exits 127** on a missing `src/scripts/_dispatch.bash`.

That file *is* the shipped consumer entry point, and it routes only *some*
commands to `dist/cli-delegate/`. The subtree is the dispatcher plus the targets
the bundle does not cover — not a second copy of the bundle. Retention is
proven, and the provisional clause is therefore **discharged here rather than
carried forward as a promise**.

## Consequences

- Both gate routes are green: unbuilt 10.506 against max 11.5, built 12.454
  against a derived ceiling of 13.699. All four content classes read 0.
- `task ci` discriminates again. A step change from here reds; the caps may only
  walk down.
- **Given up, stated rather than hidden:** the accretion between the clean
  8.4953 of 2026-08-24 and today's 10.5056 is absorbed into the new floor and
  will never be reviewed line by line. The ratchet buys detection of the *next*
  step change, not an audit of the last one.
- **The trust boundary is unchanged and still weak.** Both seats flagged it: the
  comparator lives in the branch that can also grow the payload, and no
  protected CI context reproduces either figure. Fixing that means adding a
  workflow invocation, which is a different review surface and outside a change
  whose roadmap says it must be "only that". It is the first half of this
  record's `review_trigger`.
- **Two further observations, recorded not fixed.** `build:cli` is `tsc`, which
  also never cleans its outDir — the same defect class, measured at 0.158 MB on
  an accumulating workstation, not fixed because `dist/install` is tracked and
  shares that root. And `dist/catalog-index-v1.json` (0.225 MB) ships through
  `files[]` but is written only by `build:mcp-catalog`, which neither
  `npm run build` nor `prepack` calls, so its presence in a published tarball
  depends on what someone happened to run.
- What the differential test does **not** establish: that no consumer
  deep-imports a path inside `src/scripts/`. That is a compatibility-policy
  question this record does not answer.

## Alternatives

**(b) Shrink back under the old caps.** Rejected on evidence, and the evidence
arrived late. Round 1 rejected it because the only candidates large enough were
"shipped executable sources or offline grammars". Round 3's attribution made
`src/scripts` a candidate worth 6.02 MB against a 1.40 MB shortfall — four times
what was needed — and one seat moved to "resolve that first". The differential
test then showed the subtree is load-bearing, which closes (b) properly rather
than by assumption.

**(c) Retire the absolute unbuilt cap, keep only the regression line.** Rejected
by both seats in round 1: it weakens an existing gate and does not address the
failure, which was on both axes.

**Rename the polluted key to `..._HISTORICAL_POLLUTED`.** Proposed by one seat
on the ground that the selector would then skip it. Checked against the code and
false: `check_pack_size.ts:599-601` filters on `/^built_surface_measurement_/`
and takes the lexicographic last, so the renamed key still matches — and would
lose to the 2026-09-10 key either way. Mutating a historical record for no
selector effect was rejected.

**Carry the raise as provisional with a binding revert clause.** Both seats'
round-3 position, and the right call *if* the test had been deferred. It was
run, so the branch it guarded resolved and the clause has nothing left to hold.

## Evidence

All figures are workstation readings and are labelled as such in
`src/config/pack-size-budget.json`; no CI reading of this gate exists or can,
because it has no `.github` invocation.

- `src/config/pack-size-budget.json` — `baseline_note_2026_09_10`,
  `built_surface_measurement_2026_09_10` and its `historical_clean_reconstruction`,
  `packed_attribution`, `src_scripts_necessity` and
  `second_defect_instance_not_fixed_here` sub-records.
- `src/scripts/check_pack_size.ts:593-603` — the lexicographic newest-key
  selector the rename question turned on.
- `src/scripts/_dispatch.bash:462-483` — the shipped dispatcher's own
  documentation of its tsx resolution order, including that `npx tsx` is a last
  resort.
- Council transcripts: `agents/runtime/council/responses/packed-payload-cap-*.md`
  (gitignored, local-only, pruned on the retention window — cited by shape, not
  as a durable link).

## References

- `agents/roadmaps/road-to-the-packed-payload-cap.md` — the roadmap this closes.
- ADR-264 — the sibling rule that a *grace* ceiling may not rise; a different
  file, a different ceiling, and untouched by this record.
