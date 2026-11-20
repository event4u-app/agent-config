/**
 * bundled_yaml — hands the dispatch bundle's own `yaml` copy to the lazy chunks.
 *
 * Chunks keep `yaml` external (`hook_chunks.mjs`) so a 258 KB parser is not
 * shipped twice. Without this, their `require('yaml')` loaded a SECOND copy from
 * `node_modules` at runtime on every event that loads such a chunk — 72 files
 * read on `post_tool_use`, `user_prompt_submit` and `stop` (load trace,
 * 2026-11-20). The chunk banner in `hook_chunks.mjs` reads this global first and
 * falls back to a real `require` when it is absent, so a chunk loaded outside
 * the bundle (a test, the spawn fallback) behaves exactly as before.
 *
 * The value is the package's CommonJS `module.exports`, which is what a plain
 * `require('yaml')` returns — so the chunk sees the same object shape either way.
 */
import * as yamlNamespace from 'yaml';

export const BUNDLED_YAML_GLOBAL = '__acBundledYaml';

const ns = yamlNamespace as unknown as { default?: unknown };
(globalThis as Record<string, unknown>)[BUNDLED_YAML_GLOBAL] = ns.default ?? yamlNamespace;
