/**
 * `doctor-shell` — native TS implementation.
 *
 * Probes the TS-shell environment: Node version, package root
 * resolution, and the Bash dispatcher's existence. The package runtime
 * is TypeScript-on-`tsx` — python3 is not a runtime dependency, so it is
 * not probed here.
 */

import { existsSync } from 'node:fs';
import { BASH_ENTRY, BASH_SHIM, CONSUMER_ROOT, PACKAGE_ROOT } from '../paths.js';
import { logger } from '../log/logger.js';
import { detectRtk } from '../../install/rtkDetection.js';

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

/**
 * rtk is an OPTIONAL third-party tool — its absence never fails the doctor
 * (ok stays true for every state); the row is an informational readout of
 * the two-stage identity probe (docs/contracts/rtk-detection.md).
 */
function checkRtk(): Check {
    const d = detectRtk();
    if (!d.present) return { name: 'rtk', ok: true, detail: 'not installed (optional; see `agent-config rtk:detect`)' };
    switch (d.identity) {
        case 'token-killer':
            return { name: 'rtk', ok: true, detail: `Rust Token Killer${d.version !== undefined ? ` v${d.version}` : ''} (${d.binPath ?? 'on PATH'})` };
        case 'unknown-rtk':
            return { name: 'rtk', ok: true, detail: 'DIFFERENT TOOL on PATH (name collision, not Rust Token Killer) — see `agent-config rtk:detect`' };
        default:
            return { name: 'rtk', ok: true, detail: 'present but unverified — run `rtk gain` manually' };
    }
}

export function runDoctorShell(): number {
    const checks: Check[] = [
        checkNode(),
        checkPackageRoot(),
        checkBashEntry(),
        checkBashShim(),
        checkRtk(),
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
