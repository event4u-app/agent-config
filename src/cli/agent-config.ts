#!/usr/bin/env node
/**
 * `agent-config` — TS shell entry point.
 *
 * Phase 2 behaviour:
 *   - Parses `--version`, `--help`, `versions`, `doctor-shell` natively.
 *   - Forwards every other registered subcommand to the Bash dispatcher
 *     via `delegateToBash` (preserves all existing dispatch logic).
 *   - Unknown subcommands also forward (the Bash dispatcher prints
 *     the canonical "unknown command" error) so the TS shell never
 *     drifts from the Bash subcommand surface.
 *
 * Phase 5 will reverse the delegation direction.
 */

import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { PACKAGE_JSON } from './paths.js';
import { delegateToBash } from './bash/runBash.js';
import { runVersions } from './commands/versions.js';
import { runDoctorShell } from './commands/doctorShell.js';
import { runUiServe } from './commands/uiServe.js';
import { runWorkspacesLs } from './commands/workspaces.js';
import { runPacksLs } from './commands/packs.js';
import { logger } from './log/logger.js';
import { REGISTRY } from './registry.js';

function readVersion(): string {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
}

function buildHelp(): string {
    const lines: string[] = [
        'agent-config — event4u/agent-config CLI (TS shell)',
        '',
        'Usage:',
        '  agent-config <command> [options]',
        '  agent-config --help',
        '  agent-config --version',
        '',
        'Native commands (TS shell):',
    ];
    for (const entry of REGISTRY) {
        if (entry.disposition !== 'native') continue;
        const synopsis = entry.synopsis ?? '';
        lines.push(`  ${entry.name.padEnd(22)} ${synopsis}`);
    }
    lines.push('');
    lines.push('All other subcommands delegate to the Bash dispatcher.');
    lines.push('Run `agent-config help --tier=all` for the full Bash-side surface.');
    return lines.join('\n');
}

async function main(argv: readonly string[]): Promise<number> {
    const program = new Command();
    program
        .name('agent-config')
        .description('event4u/agent-config CLI shell')
        .version(readVersion(), '-V, --version', 'Print package version')
        .helpOption('-h, --help', 'Show this help')
        .allowUnknownOption(true)
        .allowExcessArguments(true);

    program
        .command('versions')
        .description('List @event4u/agent-config versions')
        .option('--offline', 'Skip npm registry probe')
        .option('--json', 'Emit machine-readable JSON')
        .option('--limit <n>', 'Show at most N recent versions', (v) => Number.parseInt(v, 10), 10)
        .action(async (opts: { offline?: boolean; json?: boolean; limit?: number }) => {
            const code = await runVersions(opts);
            process.exit(code);
        });

    program
        .command('doctor-shell')
        .description('Probe the TS-shell environment')
        .action(() => {
            const code = runDoctorShell();
            process.exit(code);
        });

    program
        .command('ui:serve')
        .description('Start the local UI server (127.0.0.1, auto-picked port)')
        .option('--port <n>', 'Override the auto-picked port', (v) => Number.parseInt(v, 10))
        .option('--no-open', 'Do not launch the browser')
        .option('--ui-dist <path>', 'Override the dist/ui directory')
        .option('--allow-headless', 'Start even when SSH/no-DISPLAY is detected')
        .action(async (opts: { port?: number; open?: boolean; uiDist?: string; allowHeadless?: boolean }) => {
            const code = await runUiServe(opts);
            process.exit(code);
        });

    const workspaces = program
        .command('workspaces')
        .description('Inspect workspaces from the discovery manifest');
    workspaces
        .command('ls')
        .description('List workspaces (id, label, default_packs)')
        .option('--json', 'Emit machine-readable JSON')
        .action((opts: { json?: boolean }) => {
            const code = runWorkspacesLs(opts);
            process.exit(code);
        });

    const packs = program
        .command('packs')
        .description('Inspect packs from the discovery manifest');
    packs
        .command('ls')
        .description('List packs (id, label, workspaces, artefact_count)')
        .option('--json', 'Emit machine-readable JSON')
        .action((opts: { json?: boolean }) => {
            const code = runPacksLs(opts);
            process.exit(code);
        });

    program
        .command('help')
        .description('Show help (delegates to Bash for --tier=1|all)')
        .allowUnknownOption(true)
        .allowExcessArguments(true)
        .action(async () => {
            const rest = argv.slice(argv.indexOf('help') + 1);
            if (rest.length === 0) {
                process.stdout.write(`${buildHelp()}\n`);
                process.exit(0);
            }
            const code = await delegateToBash({ args: ['help', ...rest] });
            process.exit(code);
        });

    // Bare invocation → print TS-shell help.
    if (argv.length === 0) {
        process.stdout.write(`${buildHelp()}\n`);
        return 0;
    }

    const head = argv[0];
    if (head === '--help' || head === '-h') {
        process.stdout.write(`${buildHelp()}\n`);
        return 0;
    }
    if (head === '--version' || head === '-V') {
        process.stdout.write(`${readVersion()}\n`);
        return 0;
    }

    // Native subcommand → commander handles it (exits inside action).
    const native = ['versions', 'doctor-shell', 'ui:serve', 'workspaces', 'packs', 'help'];
    if (head !== undefined && native.includes(head)) {
        await program.parseAsync(['node', 'agent-config', ...argv]);
        return 0;
    }

    // Everything else forwards to the Bash dispatcher verbatim.
    return delegateToBash({ args: argv });
}

main(process.argv.slice(2))
    .then((code) => { process.exit(code); })
    .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message);
        process.exit(1);
    });
