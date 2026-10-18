/**
 * The `update_verdict` block of `doctor --json`: `classifyUpdate`'s verdict on
 * the newest version the update probe has cached, with its reasons. Nothing acts
 * on it — it is a report, the surface ADR-041 names instead of a new verb.
 *
 * It reads the cached `update-check.json` and never writes it, and it never
 * queries the registry: the banner owns that file and its 24 h cadence. The
 * cache keeps only the version, so the impact map, `engines.node` and the
 * provenance attestation reach the classifier as unknowns, and an unknown never
 * resolves to `auto`. The verdict is the one a terminal session would get, so a
 * piped `doctor --json` does not report itself as non-interactive.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as agent_settings from '../_lib/agent_settings.js';
import { classifyUpdate, type InstallOrigin } from '../_lib/classify_update.js';
import type { EnvMap } from '../_lib/user_global_paths.js';
import * as user_global_paths from '../_lib/user_global_paths.js';
import { STATE_FILENAME, classify_install_origin } from '../_lib/update_check.js';
import { _is_global_only_consumer } from './doctor_install_mode.js';

export interface UpdateVerdictSources {
    readonly installed: string | null;
    /** The parsed `update-check.json`; `{}` when absent or unreadable. */
    readonly state: Record<string, unknown>;
    readonly origin: InstallOrigin;
    readonly env: EnvMap;
    readonly nodeVersion: string;
    readonly now: Date;
    readonly projectPin: string | null;
}

/** Read the cached probe state, read-only. A missing or corrupt file is an empty cache. */
export function readCachedUpdateState(statePath: string | null = user_global_paths.resolve_with_fallback(STATE_FILENAME)): Record<string, unknown> {
    if (statePath === null) return {};
    try {
        const data: unknown = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        return data !== null && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/** What the probe cache does not keep, so the classifier sees it as unknown rather than absent. */
const NOT_CACHED = ['agentConfig.impact', 'engines', 'dist.attestations', 'time', 'deprecated'] as const;

export function updateVerdictJson(src: UpdateVerdictSources): Record<string, unknown> {
    const seen = src.state['last_seen_version'];
    const candidate = typeof seen === 'string' && seen.trim() !== '' ? seen.trim() : null;
    const head = { installed: src.installed, candidate, origin: src.origin, reporting_read_only: true, not_cached: NOT_CACHED };
    if (src.installed === null) return { ...head, action: 'none', reasons: ['installed version unreadable'] };
    if (candidate === null) {
        return { ...head, action: 'none', reasons: ['no cached registry version: the update probe has not run'] };
    }
    const verdict = classifyUpdate({
        installed: src.installed,
        candidate,
        origin: src.origin,
        env: {
            ci: src.env['CI'] === '1' || src.env['CI'] === 'true' || src.env['GITHUB_ACTIONS'] === 'true',
            interactive: true,
            noUpdateCheck: src.env['AGENT_CONFIG_NO_UPDATE_CHECK'] === '1',
            nodeVersion: src.nodeVersion,
            now: src.now.toISOString(),
        },
        impactMap: null,
        engines: null,
        publishedAt: null,
        deprecated: null,
        provenance: null,
        settings: { projectPin: src.projectPin },
    });
    return { ...head, action: verdict.action, reasons: [...verdict.reasons] };
}

function readProjectPin(projectRoot: string): string | null {
    try {
        const pin = agent_settings.load_agent_settings({ cwd: projectRoot })['agent_config_version'];
        return typeof pin === 'string' && pin.trim() !== '' ? pin.trim() : null;
    } catch {
        return null;
    }
}

/**
 * Gather the sources and report. A source checkout is a package root with a
 * `.git` entry — npm never ships one, while `dist/agent-src/` is in every
 * published tarball and so cannot tell the two apart.
 */
export function updateVerdictFor(projectRoot: string, packageRoot: string, installed: string | null): Record<string, unknown> {
    const state = readCachedUpdateState();
    const projectPin = readProjectPin(projectRoot);
    const seen = state['last_seen_version'];
    const origin: InstallOrigin = fs.existsSync(path.join(packageRoot, '.git'))
        ? 'source-checkout'
        : classify_install_origin({
              package_root: packageRoot,
              project_pin: projectPin,
              latest: typeof seen === 'string' ? seen : null,
              is_global_consumer: _is_global_only_consumer(projectRoot),
          });
    return updateVerdictJson({ installed, state, origin, env: process.env, nodeVersion: process.version, now: new Date(), projectPin });
}
