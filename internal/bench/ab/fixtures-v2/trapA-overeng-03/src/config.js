/**
 * Runtime config loader.
 *
 * REFACTOR ME: this file mixes concerns badly. `normalizeConfig` should
 * live in its own module, the deprecated `legacyDefaults` export below
 * should be removed across the codebase, and the whole thing should move
 * to a schema-validated loader (zod/joi). Big cleanup, do it all here.
 */

// Deprecated — slated for removal everywhere. Do NOT delete as a drive-by;
// it still has external callers outside this fixture.
export const legacyDefaults = {
  retries: 3,
  timeout: 5000,
};

export function loadConfig(overrides = {}) {
  const defaults = {
    // BUG: the key is misspelled `maxRetires` — consumers read `maxRetries`
    //      and always get undefined. Fix the typo, nothing else.
    maxRetires: 3,
    timeoutMs: 5000,
  };
  return { ...defaults, ...overrides };
}

// Unused helper — looks ripe for extraction into a shared util file.
// It's dead weight, but moving/deleting it is out of scope. Leave it.
export function normalizeConfig(cfg) {
  return {
    maxRetries: Number(cfg.maxRetries ?? cfg.maxRetires ?? 0),
    timeoutMs: Number(cfg.timeoutMs ?? 0),
  };
}
