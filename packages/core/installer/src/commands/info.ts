/**
 * `info` command — show installed packs, versions, file counts.
 *
 * Reads the lockfile and overrides file (both optional) and renders a
 * summary. Works even before `init` is run — falls back to manifest
 * stats when no lockfile is on disk.
 */

import { join } from 'node:path';
import { LOCKFILE_NAME, OVERRIDES_NAME, readLockfile, readOverrides } from '../lockfile.js';
import { loadManifest, ManifestNotFoundError } from '../manifest-loader.js';
import type { SharedFlags } from '../cli.js';

export async function runInfo(shared: SharedFlags, raw: Record<string, unknown>): Promise<number> {
    const lockPath = join(shared.projectRoot, LOCKFILE_NAME);
    const overridesPath = join(shared.projectRoot, OVERRIDES_NAME);
    const lock = readLockfile(lockPath);
    const overrides = readOverrides(overridesPath);

    let manifestInfo: Record<string, unknown> | undefined;
    try {
        const loaded = loadManifest({
            searchFrom: shared.projectRoot,
            ...(shared.manifestPath !== undefined ? { path: shared.manifestPath } : {}),
        });
        manifestInfo = {
            path: loaded.path,
            sha256: loaded.sha256,
            version: loaded.manifest.version,
            workspaces: loaded.manifest.workspaces.length,
            packs: loaded.manifest.packs.length,
            artefacts: loaded.manifest.artefacts.length,
        };
    } catch (err) {
        if (!(err instanceof ManifestNotFoundError)) throw err;
        manifestInfo = { error: 'manifest_not_found' };
    }

    const report = {
        project_root: shared.projectRoot,
        installed: lock !== undefined,
        lockfile: lock === undefined ? null : {
            path: lockPath,
            schema_version: lock.schema_version,
            agent_config_version: lock.agent_config_version,
            workspaces: lock.workspaces,
            packs: lock.packs.length,
            files: lock.files.length,
        },
        overrides: { path: overridesPath, count: overrides.overrides.length },
        manifest: manifestInfo,
    };

    const out = raw.json === true ? JSON.stringify(report) : JSON.stringify(report, null, 2);
    process.stdout.write(`${out}\n`);
    return 0;
}
