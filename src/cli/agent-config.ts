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
import { shouldInitLaunchGui, buildInitGuiOptions } from './initRouting.js';
import { runSettings } from './commands/settings.js';
import { runWorkspacesLs } from './commands/workspaces.js';
import { runPacksLs } from './commands/packs.js';
import { runCommandsLs, runCommandsExplain, looksLikeCommandTarget } from './commands/commands.js';
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
        .option('--project-root <path>', 'Override the project root used to resolve .agent-config/')
        .option('--dry-run', 'Boot with all writes suppressed (preview-only — no .agent-settings.yml / .agent-user.md / wizard-state.json mutations)')
        .action(async (opts: {
            port?: number;
            open?: boolean;
            uiDist?: string;
            allowHeadless?: boolean;
            projectRoot?: string;
            dryRun?: boolean;
        }) => {
            const code = await runUiServe(opts);
            process.exit(code);
        });

    program
        .command('settings')
        .description('Open the local Settings GUI (boots the UI server and lands on #/settings)')
        .option('--port <n>', 'Override the auto-picked port', (v) => Number.parseInt(v, 10))
        .option('--no-open', 'Do not launch the browser')
        .option('--ui-dist <path>', 'Override the dist/ui directory')
        .option('--allow-headless', 'Start even when SSH/no-DISPLAY is detected')
        .option('--project-root <path>', 'Override the project root used to resolve .agent-config/')
        .option('--dry-run', 'Boot with all writes suppressed (preview-only)')
        .action(async (opts: {
            port?: number;
            open?: boolean;
            uiDist?: string;
            allowHeadless?: boolean;
            projectRoot?: string;
            dryRun?: boolean;
        }) => {
            const code = await runSettings(opts);
            process.exit(code);
        });

    // `install` — install-flow alias for `ui:serve` that lands on Step 1
    // (AI tools, index 0) of the extended 13-step wizard. road-to-unified-setup
    // § B0 — same Fastify server, same bundle, only the initial step
    // differs from `setup`.
    program
        .command('install')
        .description('Open the install wizard (boots the UI server and lands on Step 1 / AI tools)')
        .option('--port <n>', 'Override the auto-picked port', (v) => Number.parseInt(v, 10))
        .option('--no-open', 'Do not launch the browser')
        .option('--ui-dist <path>', 'Override the dist/ui directory')
        .option('--allow-headless', 'Start even when SSH/no-DISPLAY is detected')
        .option('--project-root <path>', 'Override the project root used to resolve .agent-config/')
        .option('--dry-run', 'Boot with all writes suppressed (preview-only)')
        .action(async (opts: {
            port?: number;
            open?: boolean;
            uiDist?: string;
            allowHeadless?: boolean;
            projectRoot?: string;
            dryRun?: boolean;
        }) => {
            const forwarded: Parameters<typeof runUiServe>[0] = {
                initialRoute: '/wizard',
                extendedSteps: true,
                initialStep: 0,
                wizardMode: 'install',
            };
            if (opts.port !== undefined) forwarded.port = opts.port;
            if (opts.open !== undefined) forwarded.open = opts.open;
            if (opts.uiDist !== undefined) forwarded.uiDist = opts.uiDist;
            if (opts.allowHeadless !== undefined) forwarded.allowHeadless = opts.allowHeadless;
            if (opts.projectRoot !== undefined) forwarded.projectRoot = opts.projectRoot;
            if (opts.dryRun !== undefined) forwarded.dryRun = opts.dryRun;
            const code = await runUiServe(forwarded);
            process.exit(code);
        });

    // `setup` — onboarding-only alias for `ui:serve` that lands on the
    // `#/wizard` route. Replaces the deprecated `/onboard` chat skill.
    // road-to-unified-setup § B0: `setup` defaults to the extended
    // 13-step flow and lands on Identity (index 4) so the install-only lead
    // (ai-tools + roles + packs) is skipped. The project `modules` step is
    // NOT skipped — it sits at the end of the flow, so setup still walks it
    // (before review). Pass `--no-extended` to fall back to the
    // settings-only wizard.
    program
        .command('setup')
        .description('Open the onboarding wizard (boots the UI server and lands on Identity)')
        .option('--port <n>', 'Override the auto-picked port', (v) => Number.parseInt(v, 10))
        .option('--no-open', 'Do not launch the browser')
        .option('--ui-dist <path>', 'Override the dist/ui directory')
        .option('--allow-headless', 'Start even when SSH/no-DISPLAY is detected')
        .option('--project-root <path>', 'Override the project root used to resolve .agent-config/')
        .option('--dry-run', 'Boot with all writes suppressed (preview-only)')
        .option('--no-extended', 'Use the settings-only wizard (skip ai-tools, roles, packs, modules)')
        .action(async (opts: {
            port?: number;
            open?: boolean;
            uiDist?: string;
            allowHeadless?: boolean;
            projectRoot?: string;
            dryRun?: boolean;
            extended?: boolean;
        }) => {
            const extended = opts.extended !== false;
            const forwarded: Parameters<typeof runUiServe>[0] = {
                initialRoute: '/wizard',
                extendedSteps: extended,
                // Setup skips the welcome step (it keeps name/language in the
                // user-md form) and the install-only lead (ai-tools/roles/
                // packs). Extended → jump to Identity/editor (index 4);
                // non-extended → skip welcome to the first settings step (1).
                // The project `modules` step is reached later (end of the
                // flow), not skipped.
                initialStep: extended ? 4 : 1,
                wizardMode: 'setup',
            };
            if (opts.port !== undefined) forwarded.port = opts.port;
            if (opts.open !== undefined) forwarded.open = opts.open;
            if (opts.uiDist !== undefined) forwarded.uiDist = opts.uiDist;
            if (opts.allowHeadless !== undefined) forwarded.allowHeadless = opts.allowHeadless;
            if (opts.projectRoot !== undefined) forwarded.projectRoot = opts.projectRoot;
            if (opts.dryRun !== undefined) forwarded.dryRun = opts.dryRun;
            const code = await runUiServe(forwarded);
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

    const commands = program
        .command('commands')
        .description('Inspect the command surface from the discovery manifest');
    commands
        .command('ls', { isDefault: true })
        .description('List commands (command, pack, tier, visibility, intent)')
        .option('--pack <id>', 'Restrict to one owning pack')
        .option('--visible', 'Restrict to visible commands (tier 0/1)')
        .option('--json', 'Emit machine-readable JSON')
        .action((opts: { pack?: string; visible?: boolean; json?: boolean }) => {
            // exitCode (not process.exit) — the JSON payload exceeds the
            // 8 KiB pipe buffer; a hard exit truncates async stdout on macOS.
            process.exitCode = runCommandsLs(opts);
        });
    commands
        .command('explain <name>')
        .description("Print a command's intent, routes_to, owning pack, and tier")
        .option('--json', 'Emit machine-readable JSON')
        .action((name: string, opts: { json?: boolean }) => {
            process.exitCode = runCommandsExplain(name, opts);
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
    const native = ['versions', 'doctor-shell', 'ui:serve', 'settings', 'install', 'setup', 'workspaces', 'packs', 'commands', 'help'];
    if (head !== undefined && native.includes(head)) {
        await program.parseAsync(['node', 'agent-config', ...argv]);
        // Actions that don't hard-exit signal failure via process.exitCode.
        return typeof process.exitCode === 'number' ? process.exitCode : 0;
    }

    // `explain <command-name>` / `explain <cluster:sub>` → native command
    // explanation (6.0.0-C Step 5b). The legacy decision-trace explain
    // (`explain config|rule|route`) still delegates to Bash below.
    if (head === 'explain' && looksLikeCommandTarget(argv[1])) {
        return runCommandsExplain(argv[1] as string, { json: argv.includes('--json') });
    }

    // `init` is the install front-end: when the browser wizard can actually be
    // used (interactive TTY, display, no CLI-mode flags), open it and let it
    // drive the install via /api/v1/wizard/apply → install.py --apply-payload —
    // no CLI tool-picker, one installer. Otherwise fall through to the bash CLI
    // install (road-to-single-install-source-of-truth § Phase 4 follow-up).
    if (head === 'init' && shouldInitLaunchGui(argv.slice(1))) {
        return runUiServe(buildInitGuiOptions(argv.slice(1)));
    }

    // Everything else forwards to the Bash dispatcher verbatim.
    return delegateToBash({ args: argv });
}

main(process.argv.slice(2))
    .then((code) => {
        // Flush queued async stdout before the hard exit — on macOS a pipe'd
        // stdout is async and process.exit() truncates anything past the
        // 8 KiB pipe buffer (e.g. `commands ls --json`). The empty write's
        // callback fires only after every prior chunk reached the OS.
        process.exitCode = code;
        process.stdout.write('', () => process.exit(code));
    })
    .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(message);
        process.exit(1);
    });
