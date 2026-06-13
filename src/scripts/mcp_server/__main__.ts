// Entrypoint — TS twin of `scripts/mcp_server/__main__.py`
// (`python -m scripts.mcp_server`).
//
// Required by Claude Desktop / Zed / Continue stdio-server config on the
// Python side; the .py stays the runtime entry until a later phase (glama
// still launches `python -m scripts.mcp_server`). This twin coexists and
// forwards to `server.main()`; keep this file flat so crash stack traces
// point at server.ts, not the bootstrap.
//
// `node __main__.js` (or importing this module as the package main) runs
// the server, mirroring the Python `if __name__ == "__main__": main()`
// guard via the standard-module-entry check.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { main } from './server.js';

// Mirror `if __name__ == "__main__"`: run only when invoked directly,
// not when imported. Compare the resolved module path to argv[1].
const _selfPath = fileURLToPath(import.meta.url);
const _invokedDirectly =
    process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(_selfPath);

if (_invokedDirectly) {
    main();
}

export { main };
