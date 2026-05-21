/**
 * Installer + shipped-pack version constants.
 *
 * `AGENT_CONFIG_VERSION` is the @event4u/agent-config package version
 * baked into the lockfile so `sync` can detect upstream changes.
 * `PACK_VERSION` mirrors it for individual pack rows — virtual packs
 * inherit the suite version until they are split into separate
 * registries (Phase 6).
 *
 * Both values are kept in sync with `packages/core/installer/package.json`
 * `version` field and the suite-level `package.json` version. A future
 * phase replaces this with a generated module produced at build time.
 */

export const AGENT_CONFIG_VERSION = '0.1.0';
export const PACK_VERSION = '0.1.0';
