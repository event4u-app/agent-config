/**
 * `agent-config init --validate-only` back-end — pre-flight-only run
 * (road-to-flow-learnings Phase 0).
 *
 * Builds the same global-scope source expansion the installer uses
 * (`expandWizardSources`), runs the typed pre-flight suite from
 * `src/install/preflight.ts`, prints every finding, and exits:
 *
 *   0 — no blocking finding (warnings/info allowed)
 *   1 — at least one blocking finding
 *   2 — argument / environment error
 *
 * Nothing is written. This is the "can this environment take the
 * install?" gate — the conformance command answers the post-install
 * twin ("is it installed and firing?").
 */

import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    hasBlockingFinding,
    runPreflight,
    type PreflightFinding,
} from '../../install/preflight.js';
import { GLOBAL_DEPLOY_SOURCES, expandWizardSources } from '../../install/wizard-plan.js';
import type { ConflictPolicy } from '../../install/types.js';

const _HERE = fileURLToPath(import.meta.url);

/** Package root — three levels above `src/scripts/_cli/`. */
const PACKAGE_ROOT = path.resolve(path.dirname(_HERE), '..', '..', '..');

const USAGE =
    'usage: cmd_preflight [-h] [--tools a,b,...] [--target DIR] [--json]\n';

const SEVERITY_SYMBOL: Record<PreflightFinding['severity'], string> = {
    blocking: '❌',
    warning: '⚠️ ',
    info: 'ℹ️ ',
};

class ArgError extends Error {}

interface Options {
    tools: string[];
    target: string;
    json: boolean;
}

function parse(argv: string[]): Options {
    const opts: Options = {
        tools: Object.keys(GLOBAL_DEPLOY_SOURCES),
        target: os.homedir(),
        json: false,
    };
    let i = 0;
    while (i < argv.length) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            process.exit(0);
        }
        if (a === '--json') {
            opts.json = true;
        } else if (a === '--tools' || a.startsWith('--tools=')) {
            let raw: string;
            if (a.includes('=')) {
                raw = a.slice(a.indexOf('=') + 1);
            } else {
                raw = String(argv[i + 1] ?? '');
                i += 1;
            }
            const list = raw
                .split(',')
                .map((t) => t.trim())
                .filter((t) => t.length > 0 && t !== 'all');
            if (list.length > 0) {
                opts.tools = list;
            }
        } else if (a === '--target' || a.startsWith('--target=')) {
            if (a.includes('=')) {
                opts.target = a.slice(a.indexOf('=') + 1);
            } else {
                opts.target = String(argv[i + 1] ?? '');
                i += 1;
            }
            if (!opts.target) {
                throw new ArgError('--target expects a value');
            }
        } else {
            throw new ArgError(`unrecognized argument ${a}`);
        }
        i += 1;
    }
    return opts;
}

export function main(argv: string[] | null = null): number {
    let opts: Options;
    try {
        opts = parse(argv !== null ? Array.from(argv) : process.argv.slice(2));
    } catch (exc) {
        if (exc instanceof ArgError) {
            process.stderr.write(USAGE);
            process.stderr.write(`cmd_preflight: error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    const policy: ConflictPolicy = {
        force: false,
        interactive: false,
        knownPaths: new Set<string>(),
        knownPointers: new Set<string>(),
        defaultStrategy: 'skip',
    };
    const sources = expandWizardSources({
        toolIds: opts.tools,
        packageRoot: PACKAGE_ROOT,
    });
    const findings = runPreflight({
        target: 'global',
        root: opts.target,
        sources,
        policy,
    });

    if (opts.json) {
        process.stdout.write(
            `${JSON.stringify({ target: opts.target, tools: opts.tools, findings }, null, 2)}\n`,
        );
    } else {
        process.stdout.write(`  🔎  pre-flight: ${opts.tools.length} tool(s) against ${opts.target}\n`);
        if (findings.length === 0) {
            process.stdout.write('  ✅ no findings\n');
        }
        for (const f of findings) {
            const sym = SEVERITY_SYMBOL[f.severity];
            process.stdout.write(`  ${sym} ${f.id}: ${f.message}\n`);
            if (f.severity !== 'info' && f.remedy) {
                process.stdout.write(`      fix: ${f.remedy}\n`);
            }
        }
    }
    return hasBlockingFinding(findings) ? 1 : 0;
}

// --- CLI entry ---

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

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main(process.argv.slice(2));
}
