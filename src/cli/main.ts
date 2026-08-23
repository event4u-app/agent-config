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

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command } from 'commander';
import { PACKAGE_JSON, PACKAGE_ROOT } from './paths.js';
import { delegateToBash } from './bash/runBash.js';
import { runVersions } from './commands/versions.js';
import { runRecordTriggerEval } from './commands/recordTriggerEval.js';
import { runDoctorShell } from './commands/doctorShell.js';
import { runRtkDetect } from './commands/rtkDetect.js';
import { runUiAudit } from './commands/uiAudit.js';
import { runUiRender } from './commands/uiRender.js';
import { runUiServe } from './commands/uiServe.js';
import { shouldInitLaunchGui, buildInitGuiOptions, buildProjectInitDelegation, findInitGuiConflict, withoutGuiFlag } from './initRouting.js';
import { maybePrintFirstRunNotice } from './firstRunNotice.js';
import { runSettings } from './commands/settings.js';
import { runConfig } from './commands/config.js';
import { runMcpServer } from './commands/mcpServer.js';
import { runWorkspacesLs } from './commands/workspaces.js';
import { runPacksLs } from './commands/packs.js';
import { runCommandsLs, runCommandsExplain, looksLikeCommandTarget } from './commands/commands.js';
import { logger } from './log/logger.js';
import { buildHelp } from './help.js';
import { applyConfigRootFromArgv } from './configRoot.js';
import { buildVersionReadout } from '../shared/capabilities.js';

function readVersion(): string {
    const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
}

async function main(rawArgv: readonly string[]): Promise<number> {
    // Accept a host-supplied config root (`--config-root <path>`) before
    // anything resolves the config home. Applied by exporting into
    // `EVENT4U_CONFIG_HOME`, so the scripts family, the server family, and
    // every Bash-delegated subprocess (inherits `process.env`) observe the
    // override. Absent flag → pure passthrough, byte-identical behaviour.
    const { argv } = applyConfigRootFromArgv(rawArgv);
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
        .command('rtk:detect')
        .description('Detect rtk (Rust Token Killer) — two-stage presence + identity probe (docs/contracts/rtk-detection.md)')
        .option('--json', 'Emit the machine-readable contract shape')
        .action((opts: { json?: boolean }) => {
            const code = runRtkDetect(opts);
            process.exit(code);
        });

    program
        .command('eval:record')
        .description('Record a live trigger-eval result into a corpus manifest (ADR-061 §6 refresh DoD)')
        .requiredOption('--eval-json <path>', 'EvalResult JSON written by skill_trigger_eval.py --output')
        .requiredOption('--manifest <path>', 'corpus manifest.json to patch')
        .option('--min-recall <n>', 'Recall floor override (per-skill default otherwise)', (v) => Number.parseFloat(v))
        .option('--min-precision <n>', 'Precision floor override (per-skill default otherwise)', (v) => Number.parseFloat(v))
        .option('--allow-mock', 'Permit recording a non-live (MockRouter) result — plumbing only')
        .option('--dry-run', 'Validate and print the record, but do not write the manifest')
        .action(
            (opts: {
                evalJson: string;
                manifest: string;
                minRecall?: number;
                minPrecision?: number;
                allowMock?: boolean;
                dryRun?: boolean;
            }) => {
                const code = runRecordTriggerEval({
                    evalJson: opts.evalJson,
                    manifest: opts.manifest,
                    ...(opts.minRecall !== undefined ? { minRecall: opts.minRecall } : {}),
                    ...(opts.minPrecision !== undefined ? { minPrecision: opts.minPrecision } : {}),
                    ...(opts.allowMock !== undefined ? { allowMock: opts.allowMock } : {}),
                    ...(opts.dryRun !== undefined ? { dryRun: opts.dryRun } : {}),
                });
                process.exit(code);
            },
        );

    program
        .command('mcp-server')
        .description('Run the turnkey read-only stdio MCP server (no repo clone; ADR-085)')
        .action(async () => {
            // No hard process.exit() — that truncates buffered stdout writes
            // (the JSON-RPC responses) on a pipe. Set the code and let the
            // process exit naturally once stdin is at EOF and stdout drained.
            process.exitCode = await runMcpServer();
        });

    program
        .command('ui:audit')
        .argument('[path]', 'UI tree or file to inventory (default: cwd)')
        .description('Inventory a UI tree into agents/runtime/state/ui-audit.json (Class A)')
        .option('--json', 'Print the artefact on stdout as well as writing it')
        .option('--project-root <path>', 'Override the project root')
        .action((target: string | undefined, opts: { json?: boolean; projectRoot?: string }) => {
            process.exitCode = runUiAudit({ target, ...opts });
        });

    program
        .command('ui:render')
        .argument('<target>', 'HTML file or http(s) URL to capture')
        .description('Headless capture at desktop / 375px / 320px into agents/runtime/state/render/ (Class A)')
        .option('--json', 'Print the manifest on stdout as well as writing it')
        .option('--project-root <path>', 'Override the project root')
        .option('--slug <name>', 'Override the output directory name')
        .action(async (target: string, opts: { json?: boolean; projectRoot?: string; slug?: string }) => {
            process.exitCode = await runUiRender({ target, ...opts });
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

    // `config` — the canonical configuration entry point
    // (road-to-setup-experience § Phase 1). Default scope is GLOBAL
    // (#/settings hub); `--project` lands on the project surface.
    // `settings` below stays as a compatible alias of the default scope.
    program
        .command('config')
        .description('Open the configuration GUI (global settings by default; --project for the project surface)')
        .option('--project', 'Open the project configuration surface instead of global settings')
        .option('--port <n>', 'Override the auto-picked port', (v) => Number.parseInt(v, 10))
        .option('--no-open', 'Do not launch the browser')
        .option('--ui-dist <path>', 'Override the dist/ui directory')
        .option('--allow-headless', 'Start even when SSH/no-DISPLAY is detected')
        .option('--project-root <path>', 'Override the project root used to resolve .agent-config/')
        .option('--dry-run', 'Boot with all writes suppressed (preview-only)')
        .action(async (opts: {
            project?: boolean;
            port?: number;
            open?: boolean;
            uiDist?: string;
            allowHeadless?: boolean;
            projectRoot?: string;
            dryRun?: boolean;
        }) => {
            const code = await runConfig(opts);
            process.exit(code);
        });

    program
        .command('settings')
        .description('Open the local Settings GUI (alias of `config`; lands on #/settings)')
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
    // (AI tools, index 0) of the consolidated extended 10-step wizard. road-to-unified-setup
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
    // road-to-unified-setup § B0 + road-to-setup-experience § Phase 3.1:
    // `setup` defaults to the consolidated extended 10-step flow and lands
    // on Editor & behaviour (index 6) so the install-only lead (ai-tools +
    // roles + packs + legal-consent) is skipped. Pass `--no-extended` to
    // fall back to the settings-only wizard.
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
                // packs/legal-consent). Extended → jump to the first settings
                // step (Editor & behaviour, index 6 in the consolidated
                // 10-step plan — road-to-setup-experience § Phase 3.1);
                // non-extended → skip welcome to the first settings step (1).
                initialStep: extended ? 6 : 1,
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
        .description('List commands (command, pack, visibility, intent)')
        .option('--pack <id>', 'Restrict to one owning pack')
        .option('--visible', 'Restrict to visible commands (visible/advanced)')
        .option('--profile <id>', 'Render a profile\'s curated command view (developer, founder, …)')
        .option('--expanded', 'With --profile: add the active packs\' full command set')
        .option('--candidates', 'Surface-reduction report (shims, undocumented, pack weight) — report-only')
        .option('--json', 'Emit machine-readable JSON')
        .action((opts: { pack?: string; visible?: boolean; profile?: string; expanded?: boolean; candidates?: boolean; json?: boolean }) => {
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

    // Hook hot path, second layer (road-to-hook-latency-repair Phase 2):
    // the PRIMARY hot path lives in the bin launcher (agent-config.ts),
    // which imports the dist/hooks bundle BEFORE this module's eager import
    // graph loads — reaching this route through the launcher costs the full
    // graph (~370 ms of the measured ~450–500 ms CLI boot on a 1-vCPU
    // container; ~70 ms extra on a warm M-series — bench_hook_latency
    // --via-cli pins it). This route still serves direct main() callers and
    // the launcher's --config-root fall-through; it runs the same bundle
    // in-process — no bash delegation, no tsx, no per-concern re-spawn.
    // Fallback: bundle missing (stale dev tree) → historical bash path.
    if (head === 'dispatch:hook') {
        const bundle = resolve(PACKAGE_ROOT, 'dist', 'hooks', 'dispatch.js');
        if (existsSync(bundle)) {
            const mod = (await import(pathToFileURL(bundle).href)) as {
                main: (argv?: string[]) => number;
            };
            return mod.main(argv.slice(1));
        }
        return delegateToBash({ args: argv });
    }

    // One-time GUI notice on the first interactive invocation — the honest
    // replacement for an install-time banner (the package has no postinstall
    // side effect by design). TTY-gated, so hooks / MCP / CI never see it.
    maybePrintFirstRunNotice(head);

    if (head === '--help' || head === '-h') {
        process.stdout.write(`${buildHelp()}\n`);
        return 0;
    }
    if (head === '--version' || head === '-V') {
        // `--version --json` is the host-facing capability readout: emits
        // `{ version, capabilities: { configRoot: true } }` so a spawner
        // can detect support before relying on `--config-root`. Plain
        // `--version` keeps printing just the version string.
        if (argv.includes('--json')) {
            process.stdout.write(`${JSON.stringify(buildVersionReadout(readVersion()))}\n`);
        } else {
            process.stdout.write(`${readVersion()}\n`);
        }
        return 0;
    }

    // Native subcommand → commander handles it (exits inside action).
    const native = ['versions', 'doctor-shell', 'rtk:detect', 'mcp-server', 'ui:serve', 'ui:audit', 'ui:render', 'settings', 'config', 'install', 'setup', 'workspaces', 'packs', 'commands', 'help', 'eval:record'];
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
    // `init --project` initializes the minimal consumer project surface
    // (bridge marker + overrides + gitignore block) via the `refresh
    // --project` writer — never the GUI, never the global install
    // (road-to-setup-experience § Phase 1.3).
    if (head === 'init') {
        // `--gui` is the explicit opt-in. It overrides the capability probes
        // (TTY, headless) but never `CI` / `AGENT_CONFIG_NO_UI` / a CLI-mode
        // flag — and an explicit request is never discarded silently, so a
        // losing `--gui` is a hard error rather than a quiet CLI install.
        const conflict = findInitGuiConflict(argv.slice(1));
        if (conflict !== null) {
            logger.error(`init: ${conflict}`);
            return 2;
        }
        const projectDelegation = buildProjectInitDelegation(argv.slice(1));
        if (projectDelegation !== null) {
            return delegateToBash({ args: projectDelegation });
        }
    }
    if (head === 'init' && shouldInitLaunchGui(argv.slice(1))) {
        // Announce the automatic GUI choice AND its off-switch (install-time
        // side-effect honesty: any GUI launch names its suppress var).
        logger.info('Opening the browser install wizard (set AGENT_CONFIG_NO_UI=1 or pass --no-ui for the CLI install).');
        return runUiServe(buildInitGuiOptions(argv.slice(1)));
    }

    // Everything else forwards to the Bash dispatcher. `--gui` is stripped:
    // it has no installer counterpart and the bash argument loop ends in
    // `err "Unknown argument"`.
    return delegateToBash({ args: withoutGuiFlag(argv) });
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
