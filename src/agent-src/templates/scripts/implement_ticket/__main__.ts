/**
 * Deprecated CLI entry point — delegates to `work_engine`.
 *
 * TypeScript twin of `implement_ticket/__main__.py` (ADR-200, Python→TypeScript
 * migration). `python3 -m implement_ticket` still works because the
 * Golden-Transcript freeze-guard pins that invocation; the twin mirrors it 1:1 —
 * import `main`, run it, and set `process.exitCode` to the returned code, never
 * `process.exit` (per ADR-200, so flushing + cleanup run as Node's natural
 * shutdown does).
 *
 * --- Parity notes (ADR-200) ---
 *
 * - The Python module imports `main` from `work_engine.cli`. The Python package
 *   `__init__` emits a `DeprecationWarning` on import and registers
 *   `implement_ticket.*` → `work_engine.*` `sys.modules` aliases; those are
 *   import-resolution side effects with no observable stdout/stderr for the
 *   `-m` entrypoint (the warning is suppressed by default under `python3 -m`
 *   unless `-W` is set), so the twin imports `main` directly from the shipped
 *   `work_engine` CLI twin with no behavioural difference for this path.
 * - `if __name__ == "__main__": sys.exit(main())` → set `process.exitCode`
 *   from `main()`; `sys.exit(int)` and a bare `process.exitCode =` produce the
 *   same process exit status without tearing down mid-flush.
 */

import { main } from '../work_engine/cli.js';

process.exitCode = main();
