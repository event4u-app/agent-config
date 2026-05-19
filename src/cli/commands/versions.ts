/**
 * `versions` — native TS implementation.
 *
 * Lists the currently-pinned `@event4u/agent-config` version (from
 * package.json), plus the latest available on npm. Offline mode skips
 * the registry probe.
 *
 * Bash equivalent: `cmd_versions` in `scripts/agent-config`.
 */

import { readFileSync } from 'node:fs';
import { execa } from 'execa';
import { PACKAGE_JSON } from '../paths.js';
import { logger } from '../log/logger.js';

interface VersionsOptions {
    offline?: boolean;
    json?: boolean;
    limit?: number;
}

interface VersionsResult {
    current: string;
    latest: string | null;
    available: readonly string[];
}

function readCurrent(): string {
    const raw = readFileSync(PACKAGE_JSON, 'utf8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    if (typeof pkg.version !== 'string') {
        throw new Error('package.json missing string `version` field');
    }
    return pkg.version;
}

async function fetchAvailable(limit: number): Promise<readonly string[]> {
    try {
        const { stdout } = await execa(
            'npm',
            ['view', '@event4u/agent-config', 'versions', '--json'],
            { reject: false, timeout: 10_000 },
        );
        const parsed: unknown = JSON.parse(stdout);
        if (!Array.isArray(parsed)) return [];
        return (parsed as string[]).slice(-limit).reverse();
    } catch {
        return [];
    }
}

export async function runVersions(opts: VersionsOptions = {}): Promise<number> {
    const current = readCurrent();
    const limit = opts.limit ?? 10;
    const available = opts.offline ? [] : await fetchAvailable(limit);
    const latest = available[0] ?? null;

    const result: VersionsResult = { current, latest, available };

    if (opts.json) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return 0;
    }

    logger.info(`current: ${current}`);
    if (opts.offline) {
        logger.info('(offline — registry not queried)');
        return 0;
    }
    if (!latest) {
        logger.info('latest:  (npm registry unreachable)');
        return 0;
    }
    logger.info(`latest:  ${latest}${latest === current ? ' (you are on latest)' : ''}`);
    if (available.length > 1) {
        logger.info('');
        logger.info('Recent versions:');
        for (const v of available) {
            const marker = v === current ? ' (current)' : v === latest ? ' (latest)' : '';
            logger.info(`  - ${v}${marker}`);
        }
    }
    return 0;
}
