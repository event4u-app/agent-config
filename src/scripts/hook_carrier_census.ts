/**
 * hook_carrier_census — where the claude hook carrier actually reaches a
 * dispatcher, per install path (road-to-a-hook-carrier-that-is-never-silent 0.1).
 *
 * For each install path — a source checkout, `npm i -g`, `npx` — a scratch
 * `HOME` is laid out in that path's shape, and the manifest-derived
 * `SessionStart` command is run under `/bin/sh` twice: under the launcher's
 * `PATH` (node plus whatever bin directory the install path puts on it) and
 * under `PATH=/usr/bin:/bin`, from a project directory with no local install.
 * Each run is made once without a staged runtime, the shape every machine had
 * before Phase 1, and once with one.
 *
 * The package in each fixture carries a stand-in dispatcher that only says it
 * was reached: what is under test is the command's resolution, not the bundle.
 * The `npx` package root is the layout npm 11 was observed to use; the report
 * states how that observation was made.
 *
 * Deterministic: no scratch path, date or host value reaches the report, so two
 * runs at one commit are byte-equal (`--check` compares).
 *
 * Usage:
 *   ./scripts-run src/scripts/hook_carrier_census            # print
 *   ./scripts-run src/scripts/hook_carrier_census --write    # write the report
 *   ./scripts-run src/scripts/hook_carrier_census --check    # exit 1 on drift
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { stageRuntime } from '../install/stagedRuntime.js';
import { build_claude_hook_matrix } from './_lib/claude_settings_hooks.js';
import { generatedByQuote } from './_lib/generated_by.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPORT_REL = 'agents/evidence/analysis/hook-carrier-census-2026-10.md';

/** Observed 2026-10-18 with npm 11.19.0: `npx -y --cache <c> @event4u/agent-config`. */
export const NPX_PACKAGE_REL = '_npx/4297e1a784ff86d4/node_modules/@event4u/agent-config';

const STAND_IN =
    "if (process.argv.includes('--read-exit')) process.stderr.write('dispatch_hook: --read-exit ok\\n');\n";

interface InstallPath {
    readonly id: 'checkout' | 'npm-global' | 'npx';
    /** Package root relative to the scratch HOME, as a reader would name it. */
    readonly rootLabel: string;
    readonly rootRel: string;
    readonly inCache: boolean;
    /** A bin directory this path puts on the launcher PATH, relative to HOME. */
    readonly binRel: string | null;
}

export const INSTALL_PATHS: readonly InstallPath[] = [
    { id: 'checkout', rootLabel: '<checkout>', rootRel: 'checkout', inCache: false, binRel: null },
    {
        id: 'npm-global',
        rootLabel: '<prefix>/lib/node_modules/@event4u/agent-config',
        rootRel: 'prefix/lib/node_modules/@event4u/agent-config',
        inCache: false,
        binRel: 'prefix/bin',
    },
    {
        id: 'npx',
        rootLabel: `<npm cache>/${NPX_PACKAGE_REL}`,
        rootRel: `npm-cache/${NPX_PACKAGE_REL}`,
        inCache: true,
        binRel: null,
    },
];

function write(p: string, body: string, mode?: number): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    if (mode !== undefined) fs.chmodSync(p, mode);
}

function layOut(home: string, ip: InstallPath): string {
    const root = path.join(home, ip.rootRel);
    write(path.join(root, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version: '0.0.0' }));
    write(path.join(root, 'src', 'scripts', 'hook_manifest.yaml'), 'schema_version: 1\n');
    write(path.join(root, 'dist', 'agent-src', 'rules', 'example.md'), '# example\n');
    write(path.join(root, 'dist', 'hooks', 'dispatch.js'), STAND_IN);
    if (ip.binRel !== null) {
        write(
            path.join(home, ip.binRel, 'agent-config'),
            `#!/bin/sh\nshift\nexec "${process.execPath}" "${path.join(root, 'dist', 'hooks', 'dispatch.js')}" "$@"\n`,
            0o755,
        );
    }
    return root;
}

function reaches(command: string, home: string, pathValue: string): boolean {
    const project = path.join(home, 'empty-project');
    fs.mkdirSync(project, { recursive: true });
    const probe = command.replace(/--min-version (\d+)/g, '--min-version $1 --read-exit');
    const res = spawnSync('/bin/sh', ['-c', probe], {
        cwd: project,
        input: '{}',
        encoding: 'utf-8',
        env: {
            PATH: pathValue,
            HOME: home,
            EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
            CLAUDE_PROJECT_DIR: project,
            AC_HOOK_PROBE: '1',
        },
        timeout: 30000,
    });
    return typeof res.stderr === 'string' && res.stderr.includes('--read-exit ok');
}

interface Row {
    readonly ip: InstallPath;
    readonly staged: boolean;
    readonly launcher: boolean;
    readonly stripped: boolean;
    readonly pointerRoot: string;
}

export function runCensus(): Row[] {
    const command = build_claude_hook_matrix(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'))['SessionStart'];
    if (command === undefined) throw new Error('no SessionStart command in the matrix');
    const rows: Row[] = [];
    for (const ip of INSTALL_PATHS) {
        for (const staged of [false, true]) {
            const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-carrier-census-'));
            try {
                const root = layOut(home, ip);
                const runtime = path.join(home, '.event4u', 'agent-config', 'runtime');
                if (staged) stageRuntime({ packageRoot: root, runtimeRoot: runtime, nodePath: process.execPath });
                const launcherPath = [path.dirname(process.execPath), ...(ip.binRel ? [path.join(home, ip.binRel)] : []), '/usr/bin', '/bin'].join(':');
                rows.push({
                    ip,
                    staged,
                    launcher: reaches(command, home, launcherPath),
                    stripped: reaches(command, home, '/usr/bin:/bin'),
                    pointerRoot: staged
                        ? `~/.event4u/agent-config/runtime/current/dist/agent-src/rules/`
                        : `${ip.rootLabel}/dist/agent-src/rules/`,
                });
            } finally {
                fs.rmSync(home, { recursive: true, force: true });
            }
        }
    }
    return rows;
}

function tail(command: string): string {
    return (command.split(';').pop() ?? '').trim().split(/\s+/).slice(0, 2).join(' ');
}

function yn(b: boolean): string {
    return b ? 'reached' : '**not reached**';
}

/**
 * The Reading's first two bullets, checked against the cells. They are prose,
 * and `--check` compares the file only against a regenerated copy carrying the
 * same prose, so a flipped cell would otherwise leave a report that contradicts
 * its own table.
 */
export function readingContradictions(rows: readonly Row[]): string[] {
    const out: string[] = [];
    for (const r of rows) {
        const where = `${r.ip.id} (${r.staged ? 'staged' : 'unstaged'})`;
        if (r.staged && !(r.launcher && r.stripped)) out.push(`${where}: staged, yet a PATH did not reach the dispatcher`);
        if (!r.staged && r.stripped) out.push(`${where}: unstaged, yet the stripped PATH reached the dispatcher`);
        if (!r.staged && r.launcher !== (r.ip.id === 'npm-global')) out.push(`${where}: launcher PATH ${yn(r.launcher)}`);
    }
    return out;
}

export function renderReport(rows: readonly Row[]): string {
    const contradictions = readingContradictions(rows);
    if (contradictions.length > 0) {
        throw new Error(`hook_carrier_census: the Reading no longer matches the cells — ${contradictions.join('; ')}`);
    }
    const command = build_claude_hook_matrix(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'))['SessionStart'] ?? '';
    const lines = [
        '<!-- evidence-type: analysis -->',
        '',
        '# The claude hook carrier, per install path',
        '',
        generatedByQuote('hook_carrier_census', 'Evidence for'),
        '> `road-to-a-hook-carrier-that-is-never-silent` step 0.1. Regenerate with',
        '> `--write`; `--check` fails when this file and a fresh run disagree.',
        '',
        '## Method',
        '',
        'Each install path is laid out under a scratch `HOME` and the manifest-derived',
        '`SessionStart` command is run under `/bin/sh` from a project directory with no',
        'local install. "Launcher PATH" is node plus the bin directory the path puts on',
        '`PATH`; "stripped" is `PATH=/usr/bin:/bin`. The package carries a stand-in',
        'dispatcher that only reports being reached, so the cells measure the command\'s',
        'resolution and nothing the bundle does. "Unstaged" is a machine without',
        '`~/.event4u/agent-config/runtime/`, which is every machine installed before',
        'Phase 1; "staged" is one an install of this tree has staged.',
        '',
        `Command tail (the statement after the last \`;\`, first two words): \`${tail(command)}\`.`,
        '',
        '## Cells',
        '',
        '| Install path | Package root | Under a package-manager cache | Runtime | Launcher PATH | Stripped PATH | Stub pointer root |',
        '|---|---|---|---|---|---|---|',
    ];
    for (const r of rows) {
        lines.push(
            `| ${r.ip.id} | \`${r.ip.rootLabel}\` | ${r.ip.inCache ? 'yes' : 'no'} | ${r.staged ? 'staged' : 'unstaged'} | ` +
                `${yn(r.launcher)} | ${yn(r.stripped)} | \`${r.pointerRoot}\` |`,
        );
    }
    lines.push(
        '',
        '## Reading',
        '',
        '- Unstaged, only `npm i -g` reaches a dispatcher, and only while its bin',
        '  directory is on the launcher `PATH`; every unstaged stripped-PATH cell is',
        '  silent. That is the defect the roadmap names: on a checkout or `npx` install',
        '  no hook concern runs, the three `fail_closed` guards included.',
        '- Staged, every cell reaches the dispatcher, because the command runs the',
        '  staged bundle with the node recorded at install before it consults `PATH`.',
        '- The `npx` root sits under the npm cache. Its layout was observed on',
        '  2026-10-18 with npm 11.19.0 by `npx -y --cache <scratch> @event4u/agent-config',
        '  --version` with the global prefix pointed at an empty directory: the package',
        `  landed at \`<cache>/${NPX_PACKAGE_REL}\`. With a global install on`,
        '  `PATH` the same command ran the global binary and placed nothing in the cache',
        '  at all, so an `npx` row on such a machine is really the `npm-global` row.',
        '- Unstaged stub pointers are rooted at the package root, which for `npx` is',
        '  that cache; staged pointers resolve under the machine root.',
        '',
    );
    return lines.join('\n');
}

export function main(argv: readonly string[]): number {
    const report = renderReport(runCensus());
    const target = path.join(REPO_ROOT, REPORT_REL);
    if (argv.includes('--check')) {
        const onDisk = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
        if (onDisk !== report) {
            process.stderr.write(`hook_carrier_census: ${REPORT_REL} is stale — re-run with --write\n`);
            return 1;
        }
        process.stdout.write(`hook_carrier_census: ${REPORT_REL} is current\n`);
        return 0;
    }
    if (argv.includes('--write')) {
        fs.writeFileSync(target, report);
        process.stdout.write(`hook_carrier_census: wrote ${REPORT_REL}\n`);
        return 0;
    }
    process.stdout.write(report);
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = main(process.argv.slice(2));
}
