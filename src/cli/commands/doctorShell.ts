/**
 * `doctor-shell` — native TS implementation.
 *
 * Probes the TS-shell environment: Node version, python3 availability,
 * package root resolution, and the Bash dispatcher's existence. This
 * complements (not replaces) the existing Python-side `doctor`, which
 * audits the consumer project itself.
 */

import { existsSync } from 'node:fs';
import { PythonNotFoundError, resolvePython } from '../python/resolvePython.js';
import { BASH_ENTRY, BASH_SHIM, CONSUMER_ROOT, PACKAGE_ROOT } from '../paths.js';
import { logger } from '../log/logger.js';

interface Check {
    name: string;
    ok: boolean;
    detail: string;
}

function checkNode(): Check {
    const required = 20;
    const version = process.versions.node;
    const major = Number.parseInt(version.split('.')[0] ?? '0', 10);
    return {
        name: 'node',
        ok: major >= required,
        detail: major >= required
            ? `v${version} (>= v${required}.0.0)`
            : `v${version} — need >= v${required}.11.0`,
    };
}

function checkPython(): Check {
    try {
        const resolved = resolvePython();
        return {
            name: 'python3',
            ok: true,
            detail: `${resolved.bin} — ${resolved.version}`,
        };
    } catch (err) {
        const message = err instanceof PythonNotFoundError
            ? 'not on PATH'
            : err instanceof Error ? err.message : String(err);
        return { name: 'python3', ok: false, detail: message };
    }
}

function checkPackageRoot(): Check {
    const ok = existsSync(`${PACKAGE_ROOT}/package.json`);
    return {
        name: 'package_root',
        ok,
        detail: ok ? PACKAGE_ROOT : `${PACKAGE_ROOT} (package.json missing)`,
    };
}

function checkBashEntry(): Check {
    const ok = existsSync(BASH_ENTRY);
    return {
        name: 'bash_entry',
        ok,
        detail: ok ? BASH_ENTRY : `${BASH_ENTRY} (not found)`,
    };
}

function checkBashShim(): Check {
    const ok = existsSync(BASH_SHIM);
    return {
        name: 'bash_shim',
        ok,
        detail: ok ? BASH_SHIM : `${BASH_SHIM} (not found)`,
    };
}

export function runDoctorShell(): number {
    const checks: Check[] = [
        checkNode(),
        checkPython(),
        checkPackageRoot(),
        checkBashEntry(),
        checkBashShim(),
    ];

    logger.info(`consumer_root: ${CONSUMER_ROOT}`);
    logger.info(`package_root:  ${PACKAGE_ROOT}`);
    logger.info('');
    let failed = 0;
    for (const c of checks) {
        const mark = c.ok ? 'ok  ' : 'FAIL';
        logger.info(`[${mark}] ${c.name.padEnd(14)} ${c.detail}`);
        if (!c.ok) failed += 1;
    }
    logger.info('');
    if (failed > 0) {
        logger.error(`${failed} check(s) failed`);
        return 1;
    }
    logger.info('all checks passed');
    return 0;
}
