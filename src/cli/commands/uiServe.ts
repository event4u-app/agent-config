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
 * Anti-regression: if `dist/ui/index.html` is missing we refuse to
 * start and point at `npm run build:ui` — same exit code as the rest
 * of the CLI's "missing prerequisite" failures.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pickFreePort, DEFAULT_PORT_RANGE } from '../../server/port.js';
import { mintToken } from '../../server/token.js';
import { createApp } from '../../server/app.js';
import { resolveWriteRoot, ensureWriteRoot } from '../../server/writeRoot.js';
import { PACKAGE_ROOT } from '../paths.js';
import { logger } from '../log/logger.js';

export interface UiServeOptions {
    port?: number;
    open?: boolean;
    uiDist?: string;
    allowHeadless?: boolean;
    /** Override CWD as the root used to resolve `.agent-config/`. */
    projectRoot?: string;
    /**
     * Initial UI hash route (e.g. `/settings`, `/wizard`). Used by
     * sibling subcommands (`settings`) to land the browser on a
     * specific page without forking the server boot path.
     */
    initialRoute?: string;
    /**
     * Dry-run — boot the server with all writes suppressed (preview-only).
     * See `agents/roadmaps/onboarding-wizard-takeover.md` § Dry-run.
     */
    dryRun?: boolean;
    /**
     * Enable the extended 10-step wizard (ai-tools + packs + modules
     * ahead of the canonical 7 settings steps). road-to-global-only-install
     * § Phase 1.5. Default off for `ui:serve`; `setup` flips this on so
     * the unified onboarding flow is the default landing.
     */
    extendedSteps?: boolean;
    /**
     * Initial wizard step index forwarded to the server when no
     * persisted state exists. road-to-unified-setup § B0 — `install`
     * passes 0 (AI tools); `setup` passes 3 (Identity).
     */
    initialStep?: number;
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

    const { writeRoot, legacyReadRoot, projectScopeRoot, mode } = resolveWriteRoot(
        opts.projectRoot !== undefined ? { override: opts.projectRoot } : {},
    );
    ensureWriteRoot(writeRoot);

    if (isHeadless() && opts.allowHeadless !== true) {
        logger.error('Headless environment detected (SSH or no DISPLAY).');
        logger.error("The local UI requires a desktop browser. Re-run with '--allow-headless' to start the server anyway");
        logger.error('and connect to it manually, or use the CLI subcommands instead.');
        return 2;
    }

    const port = opts.port ?? (await pickFreePort(DEFAULT_PORT_RANGE));
    const dryRun = opts.dryRun === true;
    const { token, path: tokenPath } = mintToken({ persist: !dryRun });

    if (dryRun) {
        logger.info('dry-run mode: no files will be written');
        logger.info(`storage (suppressed in dry-run): ${mode} → ${writeRoot}`);
    } else {
        logger.info(`storage: ${mode} → ${writeRoot}`);
    }
    if (legacyReadRoot !== null) {
        logger.info(`legacy-read fallback: ${legacyReadRoot}`);
    }

    const app = await createApp({
        writeRoot,
        legacyReadRoot,
        projectScopeRoot,
        mode,
        uiDistDir,
        token,
        expectedPort: port,
        dryRun,
        extendedSteps: opts.extendedSteps === true,
        ...(opts.initialStep !== undefined ? { initialStep: opts.initialStep } : {}),
    });

    try {
        await app.listen({ port, host: '127.0.0.1' });
    } catch (err) {
        logger.error(`failed to bind to 127.0.0.1:${port}: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }

    const hash = opts.initialRoute !== undefined && opts.initialRoute.length > 0
        ? `#${opts.initialRoute.startsWith('/') ? opts.initialRoute : `/${opts.initialRoute}`}`
        : '';
    const url = `http://127.0.0.1:${port}/?token=${token}${hash}`;
    logger.info(`agent-config UI on ${url}  (Ctrl-C to stop)`);
    if (tokenPath !== null) {
        logger.info(`token file: ${tokenPath}`);
    } else {
        logger.info('token file (suppressed in dry-run): in-memory only');
    }

    if (opts.open !== false && !isHeadless()) {
        await openBrowser(url);
    }

    const stop = async (signal: NodeJS.Signals): Promise<void> => {
        logger.info(`received ${signal} — shutting down`);
        try {
            await app.close();
        } finally {
            process.exit(0);
        }
    };
    process.on('SIGINT', () => { void stop('SIGINT'); });
    process.on('SIGTERM', () => { void stop('SIGTERM'); });

    return new Promise<number>(() => {
        // Resolves when the process exits via signal handler above.
    });
}
