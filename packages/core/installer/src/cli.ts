#!/usr/bin/env node
/**
 * `agent-config-installer` — TypeScript Core Installer CLI entry point.
 *
 * Phase 3.1 wires the commander surface and the shared `--interactive`
 * / `--non-interactive` / `--agent` mode flags. Command bodies live in
 * `./commands/*.ts` and start as stubs that print the resolved
 * configuration; subsequent phases fill in the behaviour.
 *
 * Architecture: ADR-016. Manifest: ADR-015.
 */

import { Command, Option } from 'commander';
import { runGui } from './commands/gui.js';
import { runInfo } from './commands/info.js';
import { runInit } from './commands/init.js';
import { runPrune } from './commands/prune.js';
import { runSync } from './commands/sync.js';
import { runValidate } from './commands/validate.js';

export type RunMode = 'interactive' | 'non-interactive' | 'agent';
export type InstallScope = 'global' | 'project';

export interface SharedFlags {
    readonly mode: RunMode;
    readonly projectRoot: string;
    readonly manifestPath?: string;
    readonly dryRun: boolean;
    readonly yes: boolean;
    readonly scope: InstallScope;
}

function attachSharedFlags(cmd: Command): Command {
    return cmd
        .addOption(new Option('--interactive', 'Force interactive TUI mode').conflicts(['nonInteractive', 'agent']))
        .addOption(new Option('--non-interactive', 'CI-safe flag-driven mode').conflicts(['interactive', 'agent']))
        .addOption(new Option('--agent', 'Structured JSON over stdio').conflicts(['interactive', 'nonInteractive']))
        .option('--project-root <path>', 'Override the consumer project root', process.cwd())
        .option('--manifest <path>', 'Override the discovery-manifest path (default: walk up for dist/discovery)')
        .option('--dry-run', 'Resolve plan, do not write', false)
        .option('--yes', 'Auto-confirm all prompts (non-interactive only)', false)
        .addOption(
            new Option(
                '--scope <mode>',
                'Install scope: global (default, consumer) | project (maintainer-only, requires AGENT_CONFIG_DEV_MODE=1)',
            )
                .choices(['global', 'project'])
                .default('global'),
        );
}

function resolveMode(opts: Record<string, unknown>): RunMode {
    if (opts.agent === true) return 'agent';
    if (opts.nonInteractive === true) return 'non-interactive';
    if (opts.interactive === true) return 'interactive';
    return process.stdin.isTTY === true ? 'interactive' : 'non-interactive';
}

/**
 * road-to-global-only-install § Phase 3.4 — TypeScript CLI mirror of the
 * bash + Python consumer-global-only gate. Mirrors the bash gate in
 * `scripts/install` and the Python `_enforce_consumer_global_only`:
 * `--scope=project` is reserved for maintainers and requires
 * `AGENT_CONFIG_DEV_MODE=1`. Throws so the top-level catch in
 * `buildProgram`'s entry point surfaces a clean directive error.
 */
export function resolveScope(opts: Record<string, unknown>): InstallScope {
    const raw = typeof opts.scope === 'string' ? opts.scope : 'global';
    if (raw !== 'global' && raw !== 'project') {
        throw new Error(`--scope: invalid value '${raw}' (expected global|project)`);
    }
    if (raw === 'project' && process.env.AGENT_CONFIG_DEV_MODE !== '1') {
        throw new Error(
            "--scope=project is reserved for maintainers (ADR-020 — consumer installs are global-only). " +
                "Set AGENT_CONFIG_DEV_MODE=1 to opt in. See docs/maintainers/dev-mode.md.",
        );
    }
    return raw;
}

function resolveShared(opts: Record<string, unknown>): SharedFlags {
    const flags: SharedFlags = {
        mode: resolveMode(opts),
        projectRoot: typeof opts.projectRoot === 'string' ? opts.projectRoot : process.cwd(),
        ...(typeof opts.manifest === 'string' ? { manifestPath: opts.manifest } : {}),
        dryRun: opts.dryRun === true,
        yes: opts.yes === true,
        scope: resolveScope(opts),
    };
    return flags;
}

export function buildProgram(): Command {
    const program = new Command();
    program
        .name('agent-config-installer')
        .description('@event4u/agent-config installer — init, sync, validate, prune, info')
        .version('0.1.0', '-V, --version', 'Print installer version')
        .helpOption('-h, --help', 'Show this help');

    attachSharedFlags(program.command('init'))
        .description('First-time install — pick workspaces + packs, write files + lockfile')
        .option('--workspaces <ids>', 'Comma-separated workspace ids (non-interactive)')
        .option('--packs <ids>', 'Comma-separated pack ids (non-interactive)')
        .option('--profile <id>', 'Pre-defined workspace + pack bundle (non-interactive)')
        .option('--exclude <ids>', 'Comma-separated pack ids to exclude from auto-selection')
        .option(
            '--accept-advisory <ids>',
            'Comma-separated pack ids whose advisory/restricted/experimental artefacts you accept (non-interactive)',
        )
        .option('--answer <kv...>', 'Agent-mode answer (format: question_id=value)')
        .option('--gui', 'Launch the local browser wizard (Phase 6) instead of the TUI', false)
        .option('--gui-port <port>', 'Bind the GUI server to a fixed port (default: ephemeral)')
        .option('--gui-idle <seconds>', 'GUI server idle timeout in seconds (default: 600)')
        .option('--no-open', 'Do not auto-open the browser when --gui is set', false)
        .action(async (opts: Record<string, unknown>) => {
            const code = await runInit(resolveShared(opts), opts);
            process.exit(code);
        });

    attachSharedFlags(program.command('sync'))
        .description('Pull upstream changes via the merge decision matrix (ADR-016 § 3)')
        .option('--force', 'Override drift-blocks (use with care)', false)
        .option(
            '--accept-advisory <ids>',
            'Comma-separated pack ids whose trust-tier escalation you accept (Phase 5.1 / ADR-018)',
        )
        .option('--json', 'Emit machine-readable plan', false)
        .action(async (opts: Record<string, unknown>) => {
            const code = await runSync(resolveShared(opts), opts);
            process.exit(code);
        });

    attachSharedFlags(program.command('validate'))
        .description('Assert lockfile sha256s match disk; exit non-zero on drift')
        .option('--json', 'Emit machine-readable report', false)
        .action(async (opts: Record<string, unknown>) => {
            const code = await runValidate(resolveShared(opts), opts);
            process.exit(code);
        });

    attachSharedFlags(program.command('prune'))
        .description('Remove files no longer referenced by the lockfile')
        .option('--json', 'Emit machine-readable report', false)
        .action(async (opts: Record<string, unknown>) => {
            const code = await runPrune(resolveShared(opts), opts);
            process.exit(code);
        });

    attachSharedFlags(program.command('info'))
        .description('Show installed packs, versions, file counts')
        .option('--json', 'Emit machine-readable report', false)
        .action(async (opts: Record<string, unknown>) => {
            const code = await runInfo(resolveShared(opts), opts);
            process.exit(code);
        });

    attachSharedFlags(program.command('gui'))
        .description('Boot the browser-wizard server (post-install spawn target for scripts/install.py)')
        .option('--port <port>', 'Bind to a fixed port (default: ephemeral)')
        .option('--idle <seconds>', 'Idle timeout in seconds (default: 600)')
        .option('--no-open', 'Do not auto-open the browser', false)
        .action(async (opts: Record<string, unknown>) => {
            const code = await runGui(resolveShared(opts), opts);
            process.exit(code);
        });

    return program;
}

/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
    buildProgram().parseAsync(process.argv).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`agent-config-installer: ${message}\n`);
        process.exit(1);
    });
}
/* c8 ignore stop */
