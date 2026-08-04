#!/usr/bin/env node
/**
 * Detect-and-instruct check for the optional **media tooling** (B8 recorded
 * proof-page demos): `asciinema` (records a terminal session to a `.cast`) and
 * `agg` (converts a `.cast` → animated GIF).
 *
 * Per the `missing-tool-handling` rule the package NEVER installs a system
 * binary silently — it detects, prints the exact platform install command, and
 * exits non-zero (the same shape as the docker check in taskfiles/mcp.yml). So
 * every maintainer gets a consistent on-demand prompt; nobody gets a surprise
 * install. Called as the prereq of any B8 recording task.
 *
 * Exit 0 = all present · 1 = at least one missing (prints install hints).
 *
 * Usage:
 *   ./scripts-run src/scripts/check_media_deps
 *   ./scripts-run src/scripts/check_media_deps --quiet   # print only on failure
 */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _FILE = fileURLToPath(import.meta.url);

export interface MediaTool {
    bin: string;
    purpose: string;
    install: { darwin: string; linux: string; other: string };
}

export const MEDIA_TOOLS: MediaTool[] = [
    {
        bin: 'asciinema',
        purpose: 'record a terminal session to a .cast (B8 proof-page demos)',
        install: {
            darwin: 'brew install asciinema',
            linux: 'pipx install asciinema   # or your distro package manager',
            other: 'see the asciinema install docs for your platform',
        },
    },
    {
        bin: 'agg',
        purpose: 'convert a .cast → animated GIF (asciinema gif generator)',
        install: {
            darwin: 'brew install agg',
            linux: 'cargo install --locked agg   # or grab a release binary',
            other: 'see the agg install docs for your platform',
        },
    },
];

/** True when `bin` is runnable on PATH (probed with `--version`). */
export function isPresent(bin: string): boolean {
    const r = spawnSync(bin, ['--version'], { stdio: 'ignore' });
    // ENOENT → not on PATH. A non-zero exit with no spawn error still means the
    // binary exists (some tools return non-zero for --version), so key off error.
    return !r.error;
}

export function installHint(tool: MediaTool, platform: NodeJS.Platform = process.platform): string {
    if (platform === 'darwin') return tool.install.darwin;
    if (platform === 'linux') return tool.install.linux;
    return tool.install.other;
}

/** Return the subset of `tools` that are not installed. */
export function missingTools(tools: MediaTool[] = MEDIA_TOOLS): MediaTool[] {
    return tools.filter((t) => !isPresent(t.bin));
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const quiet = argv.includes('--quiet');

    // The scan scope is the declared tool list, not a directory: an empty
    // MEDIA_TOOLS probes nothing and still prints the ✅ "all present" line.
    // Deletion test: emptying the declaration would legitimately yield 0 only
    // if "no tooling is required", which is never true for a prereq check.
    // Exit 1 is the only failure code this CLI has, so a dead scope shares it.
    try {
        assertScanned({
            gate: 'check_media_deps',
            scanned: MEDIA_TOOLS.length,
            units: 'declared media tool(s)',
            roots: ['MEDIA_TOOLS (declared in src/scripts/check_media_deps.ts)'],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const missing = missingTools();
    if (missing.length === 0) {
        if (!quiet) {
            process.stdout.write(`✅  media tooling: ${MEDIA_TOOLS.map((t) => t.bin).join(' + ')} present.\n`);
        }
        return 0;
    }
    process.stderr.write(`❌  media tooling missing (${missing.map((t) => t.bin).join(', ')}) — required for B8 recorded demos.\n`);
    process.stderr.write('   The package never installs system binaries for you (missing-tool-handling). Install on demand:\n\n');
    for (const t of missing) {
        process.stderr.write(`   ${t.bin} — ${t.purpose}\n     ${installHint(t)}\n`);
    }
    process.stderr.write('\n   Then re-run this check.\n');
    return 1;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

const _isCli =
    _isCliEntry();
if (_isCli) process.exit(main());
