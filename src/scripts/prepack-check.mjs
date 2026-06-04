#!/usr/bin/env node
/**
 * prepack-check.mjs — guard the published artifact.
 *
 * Runs during `npm pack` and `npm publish`. Asserts the compiled TS
 * CLI binary exists, is executable, and carries the Node shebang
 * before the tarball is built. Otherwise a silently-broken `dist/`
 * ships and every `npx @event4u/agent-config` greets the consumer
 * with a cryptic `Cannot find module` panic.
 *
 * Folded from external council pass 2026-05-18 (Phase 1.3 acceptance).
 *
 * Skip with PREPACK_SKIP_BUILD_CHECK=1 only for local `npm pack` dry-runs
 * that intentionally test the failure mode.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { argv, env, exit } from 'node:process';

const BIN = resolve('dist/cli/agent-config.js');
const SHEBANG = '#!/usr/bin/env node';

function die(msg) {
    process.stderr.write(`prepack-check: ${msg}\n`);
    exit(1);
}

if (env.PREPACK_SKIP_BUILD_CHECK === '1') {
    process.stderr.write('prepack-check: skipped (PREPACK_SKIP_BUILD_CHECK=1)\n');
    exit(0);
}

let st;
try {
    st = statSync(BIN);
} catch {
    die(`compiled CLI binary missing at ${BIN}. Run \`npm run build\` before \`npm pack\`.`);
}

if (!st.isFile()) {
    die(`${BIN} is not a regular file.`);
}

// Executable bit check (skip on Windows where mode bits are unreliable).
if (process.platform !== 'win32') {
    // 0o111 = any executable bit set
    if ((st.mode & 0o111) === 0) {
        die(`${BIN} is not executable. Build step must chmod +x the bin entry.`);
    }
}

const head = readFileSync(BIN, 'utf8').slice(0, SHEBANG.length);
if (head !== SHEBANG) {
    die(`${BIN} missing Node shebang. Expected "${SHEBANG}" as first line.`);
}

process.stderr.write(`prepack-check: ${BIN} OK\n`);

// Optional: invoked with --verbose dumps the size for tarball-budget bookkeeping.
if (argv.includes('--verbose')) {
    process.stderr.write(`prepack-check: size=${st.size} bytes\n`);
}
