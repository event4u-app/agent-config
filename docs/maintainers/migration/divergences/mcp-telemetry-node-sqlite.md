# Divergence: mcp-telemetry twins use `node:sqlite` (node ≥ 22.5)

## Script

- Python: `src/scripts/mcp_telemetry_store.py`, `src/scripts/mcp_telemetry_query.py`
  (both use the stdlib `sqlite3` module)
- TypeScript: `src/scripts/mcp_telemetry_store.ts`, `src/scripts/mcp_telemetry_query.ts`
  (use the stdlib `node:sqlite` `DatabaseSync`)

(`mcp_telemetry_health.ts` has no SQLite dependency and runs on any node.)

## Symptom

Not an output mismatch — a **runtime-floor** difference. `node:sqlite` is only
available on **node ≥ 22.5**. The repo's CI workflows pin `node-version: '20'`,
so on a node-20 runner the store/query golden suites guard with
`skipIf(!hasNodeSqlite())` (mirroring the existing `hasPython3` skip) and do
not execute.

## Root cause

Python's `sqlite3` is stdlib and always present. The byte-parity contract for
these scripts is their **stdout** (query results, health summary); the SQLite
file itself lives under the gitignored, volatile `agents/runtime/mcp-telemetry/`
and is never byte-compared (it is a derived store). To mirror Python's
stdlib-only posture without adding an npm native dependency (`better-sqlite3`)
or a WASM bundle, the twins use node's own stdlib `node:sqlite`. Cross-runtime
interop is verified both directions (python-store → ts-query and
ts-store → py-query read each other's DB).

`node:sqlite` landed in node 22.5; `@types/node@20` ships no `sqlite.d.ts`, so a
minimal ambient declaration (`src/scripts/_lib/node_sqlite.d.ts`) was added for
`tsc` — runtime-free, no package.json/tsconfig change.

## Verdict

`intentional-improvement` — the TS twin is functionally equivalent (stdout
byte-identical, cross-runtime DB interop proven) and stdlib-only, matching
Python's dependency posture. The only cost is a higher node floor **for this
dev-internal tool**, which does not touch the consumer runtime.

**Consumer impact: none.** `mcp_telemetry_store`/`query` are dev-internal
tooling (`taskfiles/mcp.yml`), not part of the consumer bundle or the glama MCP
runtime. The package's published engine floor stays `node >=20.11`
(`package.json` `engines`); only `.github/workflows/migration-gates.yml` (the
python2ts migration gate) is bumped to node 22 so these parity suites run in CI
rather than skip.

## Evidence

`tests/scripts/mcp_telemetry_store.test.ts` (7) and
`tests/scripts/mcp_telemetry_query.test.ts` (8) assert byte-identical
stdout/stderr/exit (human + `--json`, all flags, error paths, idempotent
re-run, cross-runtime DB interop) via the shared harness
`tests/scripts/_mcp_telemetry.ts`. They run in CI on the node-22 migration
gate; they skip on any node < 22.5 with a clear marker.

## Approval

- Reviewer: migration orchestrator (dev-internal scope; consumer floor unchanged)
- Date: 2026-06-13
