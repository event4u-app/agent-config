/**
 * `rtk:detect` — native TS implementation.
 *
 * Stable rtk (Rust Token Killer) detection readout: the same two-stage
 * probe (PATH presence + `rtk gain` output-signature identity) the wizard
 * uses, exposed to the CLI so other tools (agent-switch's Tooling section,
 * scripts, doctors) can consume one primary implementation instead of
 * re-probing with their own drift-prone logic.
 *
 * Contract: docs/contracts/rtk-detection.md (versioned — bump `contract`
 * on any breaking shape change).
 */
import { detectRtk, rtkInstallCommands, RTK_UPSTREAM_REPO } from '../../install/rtkDetection.js';
import { logger } from '../log/logger.js';

export const RTK_DETECT_CONTRACT_VERSION = 1;

export function runRtkDetect(opts: { json?: boolean }): number {
    const detection = detectRtk();
    const installed = detection.present && detection.identity === 'token-killer';

    if (opts.json === true) {
        const payload = {
            contract: RTK_DETECT_CONTRACT_VERSION,
            installed,
            present: detection.present,
            identity: detection.identity ?? null,
            version: detection.version ?? null,
            binPath: detection.binPath ?? null,
            platform: process.platform,
            repo: RTK_UPSTREAM_REPO,
            installCommands: detection.present ? null : rtkInstallCommands(process.platform),
        };
        process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        return 0;
    }

    if (!detection.present) {
        const commands = rtkInstallCommands(process.platform);
        logger.info('rtk: not installed');
        logger.info(`  install (${commands.recommendedLabel}): ${commands.recommended}`);
        if (commands.manual !== undefined) {
            logger.info(`  manual (${commands.manualLabel ?? 'manual'}): ${commands.manual}`);
        }
        if (commands.note !== undefined) logger.info(`  note: ${commands.note}`);
        logger.info(`  upstream: ${RTK_UPSTREAM_REPO} (third-party, Apache-2.0)`);
        return 0;
    }
    switch (detection.identity) {
        case 'token-killer':
            logger.info(`rtk: installed — Rust Token Killer${detection.version !== undefined ? ` v${detection.version}` : ''} (${detection.binPath ?? 'on PATH'})`);
            return 0;
        case 'unknown-rtk':
            logger.info(`rtk: DIFFERENT TOOL — a binary named rtk is on PATH (${detection.binPath ?? ''}) but it is not Rust Token Killer (name collision with Rust Type Kit). See ${RTK_UPSTREAM_REPO}/blob/master/INSTALL.md`);
            return 0;
        default:
            logger.info(`rtk: present but UNVERIFIED — the identity check failed; verify manually with \`rtk gain\` (Rust Token Killer renders a token-savings dashboard).`);
            return 0;
    }
}
