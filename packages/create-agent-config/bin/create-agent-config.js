#!/usr/bin/env node
// @event4u/create-agent-config — thin npm wrapper around scripts/install.
// Downloads the latest tagged @event4u/agent-config tarball into a temp dir,
// runs `bash scripts/install --tools=<picked> --yes`, then cleans up.
//
// Keeps the project-local Composer / npm package shape stable while giving
// users a `npx`-style one-liner: `npx @event4u/create-agent-config init`.

import { run } from "../src/install.js";

run(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`  ❌  ${err.message ?? err}\n`);
    process.exit(typeof err.exitCode === "number" ? err.exitCode : 1);
});
