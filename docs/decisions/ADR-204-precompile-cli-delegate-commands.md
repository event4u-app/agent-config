---
adr: 204
status: accepted
date: 2026-07-31
decision: precompile-cli-delegate-commands
supersedes: —
superseded_by: —
phase: road-to-credible-install Phase 1 · completion of the tsx flip
type: structural
review_trigger: >-
  Reopen when (a) the `unpacked_size_mb` budget becomes binding and the ~1.40 MB
  `dist/cli-delegate/` bundle is the cheapest thing to cut — at which point the
  question is per-command lazy fetch, not a return to `npx tsx`; (b) a host
  ships a first-class TypeScript runtime so a `.ts` entry needs no transform at
  all, making the bundle dead weight; or (c) esbuild's `--splitting` output
  stops working on a supported Node line, which would force the single-bundle
  shape this ADR rejected on parse-cost grounds. A renewed claim that the
  delegate commands are "maintainer-only" does NOT reopen this — that claim is
  what the decision falsifies.
---

## Status

Accepted 2026-07-31.

> **Update 2026-08-04:** review_trigger (a) fired — the first real packed
> measurement at the 9.17.0 release came in at 28.22 MB against max 28. The
> maintainer resolved it by **removing the `unpacked_size_mb` budget key**
> (tarball size is no longer gated; the umbrella still measures it as
> evidence), not by cutting the `dist/cli-delegate/` bundle. References in
> this ADR to that gate as "the confirming measurement" describe the state
> at acceptance time.

## Context

`tsx` is a devDependency, so the published package ships no `tsx`. That is
deliberate: the road-to-credible-install Phase 1 sweep (2026-07-27) moved it
out of `dependencies` after precompiling the two hot paths — hooks
(`dist/hooks/dispatch.js`) and the MCP server (`dist/mcp/server.mjs`) — and
`tests/scripts/runtime_dependencies.test.ts` now pins that contract, asserting
`tsx` is absent from `dependencies`.

The sweep justified the remaining `npx tsx` fallback with this claim, recorded
in the roadmap:

> Remaining tsx sites are dev-tree/npx-fallback only: require_tsx/exec_ts fall
> back to `npx tsx` for **delegate maintainer commands** (one-time download in
> a consumer, documented safety net)

**That claim was false.** `src/scripts/_dispatch.bash` dispatches 18 commands
through `exec_ts "$PACKAGE_ROOT/src/scripts/_cli/cmd_*.ts"`, and at least 9 of
them are Tier-0/Tier-1 consumer surface listed in the consumer `--help`:
`sync`, `validate`, `doctor`, `update`, `upgrade`, `export`, `prune`,
`uninstall`, `versions`. `upgrade` is the documented way a consumer updates
the package. None of these are maintainer commands.

Two consequences followed, both measured 2026-07-31:

1. **The EBADDEVENGINES exposure was never removed, only relocated.** `npx tsx`
   runs in the CONSUMER's cwd, so the consumer's npm config and
   `engines`/`devEngines` constraints apply. A consumer pinning e.g.
   `node <24` hard-fails — the exact 8.1.0 regression the flip claimed to have
   closed. It moved from the hook path to the consumer command path.
2. **Every invocation paid a latency tax.** Cold-start p50, this machine,
   12 spawns per variant after one warm-up, `--help` only:

   | command | `npx tsx` (before) | bundle (after) |
   |---|---|---|
   | `versions` | 349 ms | 56 ms |
   | `upgrade` | 346 ms | 61 ms |
   | `sync` | 392 ms | 70 ms |
   | `doctor` | 388 ms | 71 ms |

The trigger was a maintainer running the canonical update path and getting the
fallback warning on stderr:

```
$ npx -y @event4u/agent-config upgrade
⚠️  agent-config: package-local tsx not found — falling back to `npx tsx`
```

## Decision

**Precompile the `_cli` delegate command surface, one esbuild entry per
command with `--splitting`, and prefer it in `exec_ts`.**

- `npm run build:cli-delegate` bundles `src/scripts/_cli/cmd_*.ts` to
  `dist/cli-delegate/` (ESM, `--splitting`, `--target=node20`), wired into
  `npm run build` so `prepack` emits it.
- `exec_ts` maps `src/scripts/_cli/<name>.ts` → `dist/cli-delegate/<name>.js`
  and `exec node`s the bundle when it exists. The tsx path stays as the
  dev-tree route and as the fallback for every non-`_cli` caller. `tsx` stays
  a devDependency — the Phase 1 contract is honoured, not reverted.
- The banner is the minimal `createRequire` shim already used by
  `build:install-bundle`. This is **required**, not cosmetic: without it the
  CJS `yaml` package's dynamic `require` fails at runtime with
  `Dynamic require of "process" is not supported`, which took down `doctor`,
  `sync` and `memory_get` in the first probe. The larger `build:hooks` banner
  (which rewrites `argv[1]` to a sentinel to stop inlined CLI-entry guards
  from false-firing) is deliberately NOT used — per-command entries *should*
  fire their own entry guard, and the minimal banner was verified to run all
  20 `_cli` entries.

### Why one entry per command, not one bundle with a router

A single combined bundle was the shape both council members assumed. It was
rejected on the council's own objection: a monolith is one file, and V8 parses
the whole file before executing any of it, so `versions` would pay the parse
cost of every other command's imports. `--splitting` gives per-command entries
(8–10 KB each) over shared vendor chunks, which is what the measured 56–71 ms
reflects. It also needs no router and no `main`-export change — `cmd_doctor.ts`
is the one `_cli` command that does not export `main`, and under this shape
that does not matter.

## Council input (2026-07-31, `claude-sonnet-4-5` + `gpt-4o`, 2 rounds, $0.106)

Both members recommended bundling the whole surface. The load-bearing
contribution was `claude-sonnet-4-5`'s condition:

> Option A is only acceptable if the combined bundle passes a <100 ms
> cold-start performance gate, measured before commitment. […] removing a rare
> failure class by introducing a common latency regression is a bad trade.

That condition was correct to demand and is **satisfied**: 56–71 ms, and the
premise it guarded against is inverted — the bundle is ~5.7x *faster* than the
status quo, because an `npx` spawn costs more than parsing a split bundle. The
same member's parse-cost argument is what selected the split shape over the
monolith.

Two council recommendations were **not** adopted, with reasons:

- *"Add a `max_cli_bundle_kb` entry to `evaluator-budgets.json` and enforce it
  in CI."* Not adopted. `check_evaluator_budgets.ts` errors on any budget key
  with no measurement supplied (`no measurement supplied`), so an unwired key
  would break the evaluator gate rather than guard anything. The size risk is
  already gated: the bundle lands inside the tarball, so `unpacked_size_mb`
  (max 28) catches an overflow at release. Its `method` text was extended to
  name the third bundle.
- *A `--help`-list-based coverage test.* Not adopted; the same member's
  objection to it was right (`--help` is a runtime artifact). The contract test
  is static instead — see below.

## Consequences

- The consumer-facing CLI is tsx-free end to end. Verified in a consumer-like
  tree (local `tsx` and `node_modules/tsx` moved aside): without the bundle the
  fallback warning appears, with the bundle it is gone, same stdout and exit
  code.
- `dist/cli-delegate/` is ~1.40 MB across 38 files (20 entries + 18 shared
  chunks), measured with `stat` over the emitted `.js`. Tarball impact is a
  **projection**, not a measurement: 26.05 MB last measured + 1.40 = ~27.45 MB
  against a max of 28. The worktree has no complete `dist/`, so `npm pack`
  could not confirm it here — the release-PR `unpacked_size_mb` gate is the
  confirming measurement, and it has ~0.55 MB of headroom left.
- A new `_cli` command is bundled automatically: the build globs the directory
  rather than listing entries.
- `check_bundle_path_leakage.ts` gained `dist/cli-delegate` in `BUNDLE_ROOTS`.
  Without it, the build-machine path-leakage class that cost three manual
  rebuild-and-diff fixes in 9.1 would have been able to regrow in the new
  bundle unwatched.
- The contract test in `tests/scripts/runtime_dependencies.test.ts` pins the
  outcome structurally: the dispatcher preference, the build script and its
  `--outdir`, its wiring into `build`, the entry glob, that every dispatcher
  `_cli` target is inside that glob, and that `_cli` basenames are unique
  (the mapping is basename-based, so a collision would shadow a command).
  Both removal paths were probed and turn the test red.

## Alternatives considered

- **Move `tsx` back into `dependencies`.** Rejected: reverts an accepted
  decision, fails the pinned contract test, and re-ships a ~1.5 MB runtime
  dependency to solve a problem precompilation solves without it.
- **Bundle only `upgrade`.** Rejected: fixes the reported symptom and leaves
  `sync`/`doctor`/`validate` — run far more often — on the same broken path.
  Fails the `council-removal-depth-principle` (remove at the depth that ends
  the class).
- **Bundle only the 9 consumer-tier commands.** Rejected: needs a
  hand-maintained per-command list, which is the thing that drifts, and one
  glob over the directory is strictly simpler than a curated subset.
- **Harden the `npx` fallback (`npx --prefix "$PACKAGE_ROOT"`, quieter
  warning).** Rejected: keeps a ~300 ms `npx` round-trip on every invocation
  and keeps the consumer-cwd npm-config exposure. It treats the warning as the
  defect; the defect is the dependency on the consumer's npm environment.

## References

- `src/scripts/_dispatch.bash` — `cli_delegate_bundle()` + `exec_ts()`.
- `package.json` — `build:cli-delegate`, wired into `build`.
- `tests/scripts/runtime_dependencies.test.ts` — the pinned contract.
- `src/scripts/check_bundle_path_leakage.ts` — `BUNDLE_ROOTS`.
- `docs/decisions/ADR-200-python-to-typescript-migration.md` — the migration
  that introduced the tsx runtime dependency this completes the removal of.
