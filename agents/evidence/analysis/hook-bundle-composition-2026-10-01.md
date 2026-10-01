<!-- evidence-type: analysis -->

# Hook-bundle composition, 2026-10-01

Step 1.1 of `road-to-a-hook-bundle-with-one-yaml-reader`. The supplied rescore
that opened that roadmap quoted a 1,417,597 → 1,564,211-byte growth and blamed a
second YAML parser. Neither figure was re-derived when the roadmap was written —
the verifying worktree had no built bundle — so this file re-measures before
anything is changed, and then measures again after.

## How it was built

`npm run build:hooks` (the shipped script, flags unmodified) in a worktree whose
`node_modules` is an APFS clone of the main checkout's, NOT a symlink. The
distinction is Risk 2 of the owning roadmap: esbuild resolves module paths
through the symlink and writes the main checkout's absolute paths into the
bundle, which changes both its contents and its size. The per-package figures
come from a second esbuild run with the identical flags plus `--metafile`,
written outside the repo.

Measured on one darwin machine, Node 26.7.0, esbuild as pinned in this tree.
`yaml` 2.9.0, `js-yaml` 5.4.1.

## Before — `block_config_weakening.ts` still importing `js-yaml`

Bundle: **1,564,211 bytes**, which reproduces the rescore's figure exactly.
277 modules. `bytesInOutput` by owning package:

| Package | Bytes in output | Share of bundle |
|---|---:|---:|
| `(src)` — this tree's own modules | 1,192,010 | 76.24 % |
| `yaml` | 258,839 | 16.55 % |
| `js-yaml` | 95,846 | 6.13 % |

Source modules importing a YAML reader, from the same metafile — this is the
list the D1 decision turns on, and it was not available when D1 was written:

| Importer | Reader |
|---|---|
| `src/scripts/hooks/dispatch_hook.ts` | `yaml` |
| `src/scripts/hooks/host_lowering.ts` | `yaml` |
| `src/scripts/ai_council/config.ts` | `yaml` |
| `src/scripts/memory_lookup.ts` | `yaml` |
| `src/scripts/memory_report.ts` | `yaml` |
| `src/scripts/profile_staleness_hook.ts` | `yaml` |
| `src/scripts/surface_probe_hook.ts` | `yaml` |
| `src/scripts/hooks/block_config_weakening.ts` | `js-yaml` |

## D1 re-checked against the measurement, not assumed

D1 reads: keep `yaml`, drop `js-yaml`, **revisit if 1.1 shows `js-yaml` is the
smaller of the two and both callers can move to it.**

The first half of that condition FIRED: `js-yaml` is the smaller by 162,993
bytes. The second half did not, and it is a conjunction. There are not "both
callers" — there are seven `yaml` importers against one `js-yaml` importer, and
one of the seven is `dispatch_hook.ts`, the dispatcher itself. Dropping `yaml`
instead would have saved 162,993 more bytes and cost seven ports on the path
whose correctness this roadmap's risk register ranks first, including the module
that decides whether a guard runs at all.

So D1 stands as written, on evidence that could have overturned it. The
condition is recorded as evaluated rather than silently satisfied, because a
revisit clause that fires halfway and is never mentioned is indistinguishable
from one nobody read.

`js-yaml` is NOT removed from `package.json`. Thirty-odd modules outside the
hook bundle import it; the roadmap's goal is its absence from
`dist/hooks/dispatch.js`, not from the package.

## After — the same build with `block_config_weakening.ts` on `yaml`

Bundle: **1,468,237 bytes**. 276 modules.

| Package | Bytes in output | Share of bundle |
|---|---:|---:|
| `(src)` | 1,192,111 | 81.23 % |
| `yaml` | 258,833 | 17.64 % |

`js-yaml` contributes zero bytes — it is absent from the module graph, not
merely small in it.

| Quantity | Before | After | Delta |
|---|---:|---:|---:|
| `dist/hooks/dispatch.js` bytes | 1,564,211 | 1,468,237 | −95,974 (−6.14 %) |
| YAML packages in the bundle | 2 | 1 | −1 |
| Modules | 277 | 276 | −1 |

The 101-byte rise in `(src)` is the replacement import and its comment; the
6-byte fall in `yaml` is esbuild renaming fewer symbols once one collision
source is gone. Both are reported rather than rounded away because the headline
delta is the sum of the three, and a table whose rows do not add up is the thing
this file exists not to be.

## What this does NOT establish

Nothing about dispatch LATENCY. The bundle is 6.14 % smaller; whether that is
observable at the slot budgets in `src/config/hook-latency-budget.json` is a
separate measurement this file did not take, and the per-concern p95 rows there
are not re-derived here. The earlier reading recorded in that file —
`_revisit_if_FIRED_2026_09_30`, which attributed ~2 ms to a +1.34 % bundle growth
on one branch — would predict a few milliseconds back in the other direction, and
a prediction is not a reading.

Nothing about the OTHER two bundles either. `dist/install/install.mjs` and
`dist/mcp/server.mjs` carry their own module graphs and were not measured.
