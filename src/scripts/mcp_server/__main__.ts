// Entrypoint for the MCP stdio server (`node node_modules/.bin/tsx
// src/scripts/mcp_server/__main__.ts`). glama launches this file directly
// via `internal/glama/run`; Claude Desktop / Zed / Continue stdio-server
// configs point at the same entry through `agent-config mcp:run`. Keep
// this file flat so crash stack traces point at server.ts, not the
// bootstrap.
//
// `node __main__.js` (or importing this module as the package main) runs
// the server, mirroring the Python `if __name__ == "__main__": main()`
// guard via the standard-module-entry check.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main } from './server.js';

// Mirror `if __name__ == "__main__"`: run only when invoked directly,
// not when imported. Compare the resolved module path to argv[1]. Under
// the esbuild bundle (dist/mcp/server.mjs) the build banner detects the
// direct invocation before any module code runs, sets the global marker,
// and rewrites argv[1] to a sentinel (so inlined modules' CLI-entry
// guards cannot false-fire) — the marker is the bundle's signal here.
const _selfPath = fileURLToPath(import.meta.url);
const _invokedDirectly =
    (globalThis as { __AC_MCP_BUNDLE_DIRECT?: boolean }).__AC_MCP_BUNDLE_DIRECT === true ||
    (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath));

if (_invokedDirectly) {
    main();
}

export { main };
