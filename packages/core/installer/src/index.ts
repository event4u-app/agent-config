/**
 * Public entry point for `@event4u/installer`.
 *
 * Embedders (e.g. the browser wizard in Phase 6, the legacy `src/cli/`
 * shell during Phase 4 migration) import from this module. The CLI
 * binary lives in `./cli.js`.
 */

export type {
    AgentDone,
    AgentError,
    AgentQuestion,
    AgentResponse,
    AgentResponseStatus,
    DiscoveryManifest,
    Lockfile,
    LockfileFile,
    LockfilePack,
    ManifestArtefact,
    ManifestInstall,
    ManifestPack,
    ManifestTrust,
    ManifestWorkspace,
    OverrideEntry,
    OverridesFile,
} from './types.js';

export {
    artefactsForPacks,
    findManifestPath,
    findPack,
    findWorkspace,
    loadManifest,
    ManifestNotFoundError,
    ManifestParseError,
} from './manifest-loader.js';
export type { LoadedManifest, LoadManifestOptions } from './manifest-loader.js';

export {
    LOCKFILE_NAME,
    LockfileParseError,
    OVERRIDES_NAME,
    OverridesParseError,
    lockfileFromYaml,
    lockfileToYaml,
    readLockfile,
    readOverrides,
} from './lockfile.js';

export { ensureWithinRoot, openStaging } from './io/atomic-write.js';
export type { OpenStagingOptions, StagedWrite, StagingSession } from './io/atomic-write.js';

export { sha256OfFile, sha256OfFileSync, sha256OfString } from './io/sha256.js';
