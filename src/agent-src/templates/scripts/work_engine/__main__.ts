/**
 * Module entry point — lets the work engine run as a script.
 *
 * TypeScript twin of `work_engine/__main__.py` (ADR-096 py2ts Phase 1 —
 * work_engine TOP/integration layer). The Python source is the
 * `python3 -m work_engine` shim (`from .cli import main; sys.exit(main())`).
 * The twin mirrors it: import `main`, run it, and set `process.exitCode` to the
 * returned code — never `process.exit`, per ADR-096 (so flushing + cleanup run
 * exactly as Node's natural shutdown does).
 */

import { main } from './cli.js';

process.exitCode = main();
