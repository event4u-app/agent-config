/**
 * The rule-scoping predicate — the ONE decision both pipelines consume.
 *
 * ## Why this module exists (and must stay side-effect-free)
 *
 * `rule_in_scope` used to live in `src/scripts/condense.ts`, and
 * `src/install/rule_scope.ts` imported it from there deliberately, so install
 * semantics could never drift from projection semantics. That intent is right;
 * the location was not.
 *
 * `condense.ts` is maintainer-only CLI tooling and ends in a module-level
 * self-invoke:
 *
 *     const isMain = _isCliEntry();
 *     if (isMain) { process.exit(main()); }
 *
 * `_isCliEntry()` compares `import.meta.url` against `process.argv[1]`. That is
 * correct for a file run directly — but when esbuild BUNDLES the module into
 * `dist/install/install.mjs`, `import.meta.url` becomes the bundle's own URL,
 * which *is* `argv[1]` when a consumer runs `node dist/install/install.mjs`.
 * The guard then fires inside the installer, `condense.main()` runs, finds no
 * maintainer source tree in a consumer checkout, prints "No source directory
 * found" and calls `process.exit(1)` — killing the install.
 *
 * That is not hypothetical: it reached CI on all four
 * `smoke-public-install` legs the moment the installer began importing
 * `rule_scope.ts` (road-to-consistent-rule-scoping, 2026-07-31).
 *
 * So the predicate lives here instead: **no I/O at module load, no CLI entry,
 * no `process.exit`, and nothing that assumes a maintainer source tree.**
 * `condense.ts` re-exports it for its four in-repo consumers; the install path
 * imports it directly and never pulls the projection pipeline along.
 *
 * Lives under `src/install/` rather than `src/shared/` because it reads the file
 * it classifies: an ESLint boundary keeps `src/shared/**` free of Node built-ins,
 * and the install layer is where credentialled filesystem work already belongs.
 *
 * Keep it that way. Anything added to this file ships inside the consumer
 * installer bundle.
 */
import * as fs from 'node:fs';
import * as YAML from 'yaml';
/** `yaml.safe_load` semantics: parse failure and `undefined` both → `null`. */
function parseYaml(text) {
    try {
        const data = YAML.parse(text, { version: '1.1' });
        return data === undefined ? null : data;
    }
    catch {
        return null;
    }
}
/** Python `str.strip()` — whitespace from both ends, Unicode-aware. */
function strip(s) {
    return s.replace(/^\s+/u, '').replace(/\s+$/u, '');
}
/** Python `str.lstrip("\n")` — leading newlines only. */
function lstripNewlines(s) {
    return s.replace(/^\n+/, '');
}
/**
 * Split `---`-delimited frontmatter from the body.
 *
 * Returns `[{}, content]` for anything that is not well-formed frontmatter —
 * an absent block, an unterminated block, or a scalar/sequence document. The
 * caller then sees an untagged artefact, which every axis below fails safe on.
 */
export function parseFrontmatter(content) {
    if (!content.startsWith('---')) {
        return [{}, content];
    }
    const end = content.indexOf('\n---', 3);
    if (end === -1) {
        return [{}, content];
    }
    const raw = strip(content.slice(3, end));
    const body = lstripNewlines(content.slice(end + 4));
    let meta = parseYaml(raw);
    if (meta === null || meta === undefined) {
        meta = {};
    }
    if (typeof meta === 'object' && meta !== null && !Array.isArray(meta)) {
        return [meta, body];
    }
    return [{}, body];
}
/**
 * Does the rule at `source_path` project / install under the given scope?
 *
 * Three independent axes — `workspaces`, `packs`, `roles`. A `null` axis means
 * "unset", i.e. that axis does not filter. Two fail-safe rules make the
 * predicate over-ship rather than under-ship:
 *
 * - a KERNEL rule (`type: always` / `alwaysApply: true`) always ships;
 * - an artefact carrying NO tags on a configured axis ships anyway — an
 *   untagged rule is unclassified, not excluded.
 *
 * Reads the file. Never throws for a missing frontmatter block; a genuinely
 * unreadable path is the caller's problem (both call sites pre-check).
 */
export function rule_in_scope(source_path, scope, pack_scope = null, role_scope = null) {
    if (scope === null && pack_scope === null && role_scope === null) {
        return true;
    }
    const [meta] = parseFrontmatter(fs.readFileSync(source_path, 'utf-8'));
    if (meta['type'] === 'always' || meta['alwaysApply'] === true) {
        return true; // kernel always projects
    }
    const axis = (key, configured) => {
        if (configured === null) {
            return true;
        }
        const values = Array.isArray(meta[key])
            ? meta[key].map((w) => String(w))
            : [];
        if (values.length === 0) {
            return true; // untagged → fail safe: ship it
        }
        return values.some((v) => configured.includes(v));
    };
    return axis('workspaces', scope) && axis('packs', pack_scope) && axis('roles', role_scope);
}
//# sourceMappingURL=ruleInScope.js.map