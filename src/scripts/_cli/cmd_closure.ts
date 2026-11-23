/**
 * `agent-config closure:scan` and `agent-config closure:lint` — the two tools
 * `/challenge-me closure` runs, reachable from a consumer install.
 *
 * The command used to name `./scripts-run src/scripts/closure_scan` and
 * `./scripts-run src/scripts/lint_decision_classes`. `scripts-run` exists only
 * in the source checkout, so an agent following the command in a consumer
 * project hit a dead end, and the `npx tsx` fallback a direct run would reach is
 * the consumer-npm-bound path ADR-204 removed for every `_cli/` command. As a
 * `cmd_*.ts` entry this file is precompiled into `dist/cli-delegate/` and runs
 * on plain Node.
 *
 * Both verbs forward their argv verbatim: `closure:scan <roadmap.md>` and
 * `closure:lint [<project-root | roadmap.md> ...]`. Exit codes are the scripts'.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { main as closureScanMain } from '../closure_scan.js';
import { main as lintDecisionClassesMain } from '../lint_decision_classes.js';

const VERBS: Readonly<Record<string, (argv: readonly string[]) => number>> = {
    scan: closureScanMain,
    lint: lintDecisionClassesMain,
};

const USAGE =
    'usage: agent-config closure:scan <roadmap.md> [--json] [--rows] [--strict]\n' +
    '       agent-config closure:lint [<project-root | roadmap.md> ...] [--json] [--quiet]\n';

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const [verb, ...rest] = argv;
    if (verb === undefined || verb === '-h' || verb === '--help') {
        process.stdout.write(USAGE);
        return verb === undefined ? 2 : 0;
    }
    const run = VERBS[verb];
    if (run === undefined) {
        process.stderr.write(`unknown closure verb: ${verb}\n${USAGE}`);
        return 2;
    }
    return run(rest);
}

/** Defined by `build:cli-delegate` only — see `cmd_refresh.ts` for why. */
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
declare const __AGENT_CONFIG_CLI_DELEGATE__: boolean | undefined;

function _isCliEntry(): boolean {
    const bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
    const cliDelegate =
        typeof __AGENT_CONFIG_CLI_DELEGATE__ !== 'undefined' && __AGENT_CONFIG_CLI_DELEGATE__;
    if (bundled && !cliDelegate) return false;
    if (process.argv[1] === undefined) return false;
    if (cliDelegate && path.basename(process.argv[1], '.js') === 'cmd_closure') return true;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
