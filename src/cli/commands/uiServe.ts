/**
 * `agent-config ui:serve` — launch the embedded local server.
 *
 * Flow:
 *   1. Refuse to start in a headless context (no DISPLAY, $SSH_CONNECTION
 *      set) unless `--allow-headless` is passed. Council critical-challenger
 *      mandate: the GUI must not silently break the headless contract.
 *   2. Pick a free port in 41000–41999 (or honour `--port`).
 *   3. Mint a per-process bearer token + persist it under
 *      `~/.event4u/agent-config/local-server.token` (mode 0600).
 *   4. Boot Fastify via `createApp`, listen on 127.0.0.1 only.
 *   5. Print the URL (with token query param) on stdout, install
 *      SIGINT/SIGTERM handlers that close the server cleanly.
 *   6. Open the user's browser unless `--no-open` is set.
 *
 * `--headless` mode (legacy skill-bridge IPC):
 *   - implies `--no-open`, skips the SSH/DISPLAY headless refusal,
 *   - probes for and reclaims stale `.agent-config/skill-bridge.*`
 *     files on boot (or refuses to start if a live bridge owns them),
 *   - writes `skill-bridge.port` / `skill-bridge.token` /
 *     `skill-bridge.pid` post-bind at mode 0600,
 *   - prints exactly one `AGENT_CONFIG_READY: ...` sentinel line to
 *     stdout so a parent process can latch onto the running server,
 *   - unlinks the discovery files on graceful shutdown.
 *
 * The `/onboard` chat skill no longer consumes this mode (2026-05-20
 * pivot to in-process `agent-config onboard:finish`, per
 * `docs/contracts/onboard-skill-wizard-bridge.md` § 0). The flag
 * survives for potential future consumers; remove it in a separate
 * PR if no consumer adopts it before GA.
 *
 * Anti-regression: if `dist/ui/index.html` is missing we refuse to
 * start and point at `npm run build:ui` — same exit code as the rest
 * of the CLI's "missing prerequisite" failures.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pickFreePort, DEFAULT_PORT_RANGE } from '../../server/port.js';
import { mintToken } from '../../server/token.js';
import { createApp } from '../../server/app.js';
import {
    probeStaleBridge,
    writeDiscoveryFiles,
    unlinkDiscoveryFiles,
} from '../../server/skillBridge.js';
import { PACKAGE_JSON, PACKAGE_ROOT } from '../paths.js';
import { logger } from '../log/logger.js';

export interface UiServeOptions {
    port?: number;
    open?: boolean;
    uiDist?: string;
    allowHeadless?: boolean;
    /** Skill-bridge mode: no browser, write discovery files, print READY sentinel. */
    headless?: boolean;
    /** Override CWD as the root used to resolve `.agent-config/`. */
    projectRoot?: string;
    /**
     * Initial UI hash route (e.g. `/settings`, `/wizard`). Used by
     * sibling subcommands (`settings`) to land the browser on a
     * specific page without forking the server boot path.
     */
    initialRoute?: string;
}

function readPackageVersion(): string {
    try {
        const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8')) as { version?: unknown };
        return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
    } catch {
        return '0.0.0';
    }
}

function isHeadless(): boolean {
    if (process.env['SSH_CONNECTION']) return true;
    if (process.platform === 'linux' && !process.env['DISPLAY']) return true;
    return false;
}

async function openBrowser(url: string): Promise<void> {
    try {
        const mod = (await import('open')) as { default: (target: string) => Promise<unknown> };
        await mod.default(url);
    } catch (err) {
        logger.warn(`unable to open browser automatically: ${err instanceof Error ? err.message : String(err)}`);
    }
}

export async function runUiServe(opts: UiServeOptions): Promise<number> {
    const uiDistDir = resolve(opts.uiDist ?? resolve(PACKAGE_ROOT, 'dist', 'ui'));
    const indexHtml = resolve(uiDistDir, 'index.html');
    if (!existsSync(indexHtml)) {
        logger.error(`UI bundle not found at ${uiDistDir}.`);
        logger.error("Run 'npm run build:ui' (or 'npm run build') first.");
        return 1;
    }

    const headlessMode = opts.headless === true;
    const projectRoot = resolve(opts.projectRoot ?? process.cwd());

    // Skill-bridge mode is invoked by a parent process, never directly by a
    // user. The SSH/DISPLAY guard would only obstruct that handshake.
    if (!headlessMode && isHeadless() && opts.allowHeadless !== true) {
        logger.error('Headless environment detected (SSH or no DISPLAY).');
        logger.error("The local UI requires a desktop browser. Re-run with '--allow-headless' to start the server anyway");
        logger.error('and connect to it manually, or use the CLI subcommands instead.');
        return 2;
    }

    if (headlessMode) {
        const stale = await probeStaleBridge(projectRoot);
        if (stale.status === 'live') {
            logger.error(
                `agent-config: another skill-bridge is already live on 127.0.0.1:${stale.livePort ?? '?'}` +
                ` (pid=${stale.livePid ?? '?'}). Stop it before starting a new --headless server.`,
            );
            return 3;
        }
    }

    const port = opts.port ?? (await pickFreePort(DEFAULT_PORT_RANGE));
    const { token, path: tokenPath } = mintToken();

    const app = await createApp({
        projectRoot,
        uiDistDir,
        token,
        expectedPort: port,
    });

    try {
        await app.listen({ port, host: '127.0.0.1' });
    } catch (err) {
        logger.error(`failed to bind to 127.0.0.1:${port}: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }

    if (headlessMode) {
        try {
            await writeDiscoveryFiles({ projectRoot, port, token, pid: process.pid });
        } catch (err) {
            logger.error(`failed to write skill-bridge discovery files: ${err instanceof Error ? err.message : String(err)}`);
            await app.close().catch(() => undefined);
            return 4;
        }
        // Exactly one prefix-marked sentinel line, then continue. Other
        // logger.* output is routed through Fastify/pino to stderr per
        // bridge contract § 2 so the skill can grep stdout cleanly.
        process.stdout.write(
            `AGENT_CONFIG_READY: port=${port} tokenFile=${tokenPath} pid=${process.pid} version=${readPackageVersion()}\n`,
        );
    } else {
        const hash = opts.initialRoute !== undefined && opts.initialRoute.length > 0
            ? `#${opts.initialRoute.startsWith('/') ? opts.initialRoute : `/${opts.initialRoute}`}`
            : '';
        const url = `http://127.0.0.1:${port}/?token=${token}${hash}`;
        logger.info(`agent-config UI on ${url}  (Ctrl-C to stop)`);
        logger.info(`token file: ${tokenPath}`);

        if (opts.open !== false && !isHeadless()) {
            await openBrowser(url);
        }
    }

    const stop = async (signal: NodeJS.Signals): Promise<void> => {
        if (!headlessMode) logger.info(`received ${signal} — shutting down`);
        try {
            await app.close();
        } finally {
            if (headlessMode) {
                await unlinkDiscoveryFiles(projectRoot).catch(() => undefined);
            }
            process.exit(0);
        }
    };
    process.on('SIGINT', () => { void stop('SIGINT'); });
    process.on('SIGTERM', () => { void stop('SIGTERM'); });

    return new Promise<number>(() => {
        // Resolves when the process exits via signal handler above.
    });
}
