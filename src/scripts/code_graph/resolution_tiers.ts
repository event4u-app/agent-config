/**
 * Resolution tiers that run BEFORE the repo-wide name lookup
 * (road-to-a-graph-that-is-shipped 2.3).
 *
 * The extractor's ladder ends in a same-name table across the whole
 * repository. That rung is a guess and is labelled one — `INFERRED`, via
 * `name-lookup`. Two configuration files in a normal project state the answer
 * outright, and reading them turns a guess into a fact:
 *
 * · `tsconfig.json` `compilerOptions.paths` — `@shared/x` IS `src/shared/x`,
 *   because the project says so. Without this tier the specifier is non-relative,
 *   so `resolveSpecifier` returns null and the import binds to `external:@shared/x`
 *   — a real module, correctly named, and the wrong one.
 * · `composer.json` `autoload.psr-4` — `App\Services\Mailer` IS
 *   `app/Services/Mailer.php`. Without this tier a PHP `use` is matched by BASE
 *   NAME with the namespace discarded, so two classes called `Mailer` in
 *   different namespaces are indistinguishable.
 *
 * Both are DECLARED mappings, so an edge resolved through one is EXTRACTED, not
 * INFERRED: the project's own config is as much a syntactic fact as an import
 * specifier is.
 *
 * Deterministic and IO-free at resolution time — the configs are read once by
 * the caller and passed in, so `buildGraph` stays pure and identical source
 * plus identical config yields identical bytes.
 */
import type { ResolvedVia } from './types.js';

/** Extensions a TS/JS alias target may carry, in resolution order. */
const ALIAS_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] as const;

export interface AliasRule {
    /** The pattern's literal prefix, e.g. `@shared/` for `@shared/*`. */
    prefix: string;
    /** Whether the pattern ended in `*` (a prefix rule) or was exact. */
    wildcard: boolean;
    /** Repo-relative substitution targets, already joined with `baseUrl`. */
    targets: string[];
}

export interface Psr4Rule {
    /** Namespace prefix WITH its trailing separator, e.g. `App\\`. */
    prefix: string;
    /** Repo-relative directories, with a trailing slash. */
    dirs: string[];
}

export interface ResolutionConfig {
    aliases: AliasRule[];
    psr4: Psr4Rule[];
}

export const EMPTY_RESOLUTION_CONFIG: ResolutionConfig = { aliases: [], psr4: [] };

/**
 * Parse JSON that may carry comments and trailing commas.
 *
 * `tsconfig.json` is JSONC by convention and this repository's own uses `//`
 * comments, so `JSON.parse` on it throws. Returning null rather than throwing
 * is deliberate: an unparseable config must degrade to "no tiers", never break
 * a build. Strings are walked rather than regex-stripped so a `//` inside a
 * path value survives.
 */
export function parseJsonc(text: string): unknown | null {
    let out = '';
    let inString = false;
    let escaped = false;
    let i = 0;
    while (i < text.length) {
        const ch = text[i] as string;
        if (inString) {
            out += ch;
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === '"') inString = false;
            i += 1;
            continue;
        }
        if (ch === '"') {
            inString = true;
            out += ch;
            i += 1;
            continue;
        }
        if (ch === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') i += 1;
            continue;
        }
        if (ch === '/' && text[i + 1] === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
            i += 2;
            continue;
        }
        out += ch;
        i += 1;
    }
    // Trailing commas before a closing brace/bracket.
    out = out.replace(/,(\s*[}\]])/g, '$1');
    try {
        return JSON.parse(out) as unknown;
    } catch {
        return null;
    }
}

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Normalise a repo-relative path fragment: no leading `./`, no trailing `/`. */
function normalizeFragment(p: string): string {
    return p.replace(/^\.\//, '').replace(/\/+$/, '');
}

/**
 * Build the alias tier from a parsed `tsconfig.json`.
 *
 * `baseUrl` is resolved relative to the tsconfig's own directory, which for a
 * root tsconfig is the repo root — so `baseUrl: "./src"` plus `"@shared/*":
 * ["shared/*"]` yields the repo-relative prefix `src/shared/`.
 */
export function aliasRulesFrom(tsconfig: unknown): AliasRule[] {
    if (!isRecord(tsconfig)) return [];
    const co = tsconfig['compilerOptions'];
    if (!isRecord(co)) return [];
    const paths = co['paths'];
    if (!isRecord(paths)) return [];
    const baseUrl = typeof co['baseUrl'] === 'string' ? normalizeFragment(co['baseUrl']) : '';
    const rules: AliasRule[] = [];
    for (const [pattern, valueRaw] of Object.entries(paths)) {
        if (!Array.isArray(valueRaw)) continue;
        const wildcard = pattern.endsWith('*');
        const prefix = wildcard ? pattern.slice(0, -1) : pattern;
        const targets: string[] = [];
        for (const v of valueRaw) {
            if (typeof v !== 'string') continue;
            const tgt = wildcard ? (v.endsWith('*') ? v.slice(0, -1) : v) : v;
            const joined = baseUrl ? `${baseUrl}/${normalizeFragment(tgt)}` : normalizeFragment(tgt);
            targets.push(joined.replace(/\/+$/, ''));
        }
        if (targets.length) rules.push({ prefix, wildcard, targets });
    }
    // Longest prefix first: `@shared/deep/` must beat `@shared/` when both are
    // declared, which is TypeScript's own rule and not a preference.
    rules.sort((a, b) => b.prefix.length - a.prefix.length);
    return rules;
}

/** Build the PSR-4 tier from a parsed `composer.json`. */
export function psr4RulesFrom(composer: unknown): Psr4Rule[] {
    if (!isRecord(composer)) return [];
    const rules: Psr4Rule[] = [];
    for (const key of ['autoload', 'autoload-dev']) {
        const block = composer[key];
        if (!isRecord(block)) continue;
        const psr4 = block['psr-4'];
        if (!isRecord(psr4)) continue;
        for (const [ns, valueRaw] of Object.entries(psr4)) {
            const dirsRaw = Array.isArray(valueRaw) ? valueRaw : [valueRaw];
            const dirs = dirsRaw
                .filter((d): d is string => typeof d === 'string')
                .map((d) => {
                    const n = normalizeFragment(d);
                    return n === '' ? '' : `${n}/`;
                });
            if (dirs.length) rules.push({ prefix: ns, dirs });
        }
    }
    // Longest namespace first — PSR-4's own most-specific-wins rule.
    rules.sort((a, b) => b.prefix.length - a.prefix.length);
    return rules;
}

function firstExisting(candidate: string, fileIds: ReadonlySet<string>): string | null {
    if (fileIds.has(candidate)) return candidate;
    // TS source imports `@shared/mailer.js` and the file on disk is
    // `mailer.ts`, so the RUNTIME extension is stripped before the candidate
    // list is tried — the same normalisation `resolveSpecifier` does for a
    // relative specifier. Without it every alias in an ESM-style codebase
    // misses, which is most of them.
    const stem = candidate.replace(/\.(js|jsx|mjs|cjs)$/, '');
    for (const e of ALIAS_EXTS) if (fileIds.has(stem + e)) return stem + e;
    for (const e of ALIAS_EXTS) if (fileIds.has(`${candidate}/index${e}`)) return `${candidate}/index${e}`;
    return null;
}

/**
 * Resolve a non-relative TS/JS specifier through the alias tier.
 *
 * Returns null when no rule matches or the mapped file is not in the graph —
 * an alias pointing outside the built root is not a hit, and claiming it as one
 * would be worse than the `external:` binding it replaces.
 */
export function resolveAlias(spec: string, config: ResolutionConfig, fileIds: ReadonlySet<string>): string | null {
    for (const rule of config.aliases) {
        if (rule.wildcard) {
            if (!spec.startsWith(rule.prefix)) continue;
            const rest = spec.slice(rule.prefix.length);
            for (const t of rule.targets) {
                const hit = firstExisting(rest ? `${t}/${rest}` : t, fileIds);
                if (hit) return hit;
            }
        } else {
            if (spec !== rule.prefix) continue;
            for (const t of rule.targets) {
                const hit = firstExisting(t, fileIds);
                if (hit) return hit;
            }
        }
    }
    return null;
}

/**
 * Resolve a fully-qualified PHP class name through the PSR-4 tier.
 *
 * `App\Services\Mailer` under `{"App\\": "app/"}` becomes
 * `app/Services/Mailer.php`. A leading backslash is tolerated because `use
 * \App\X` is legal and means the same thing.
 */
export function resolvePsr4(fqcn: string, config: ResolutionConfig, fileIds: ReadonlySet<string>): string | null {
    const name = fqcn.replace(/^\\+/, '');
    for (const rule of config.psr4) {
        if (!name.startsWith(rule.prefix)) continue;
        const rest = name.slice(rule.prefix.length).replace(/\\/g, '/');
        if (!rest) continue;
        for (const d of rule.dirs) {
            const candidate = `${d}${rest}.php`;
            if (fileIds.has(candidate)) return candidate;
        }
    }
    return null;
}

/** The `resolved_via` value each tier stamps on the edges it produces. */
export const ALIAS_VIA: ResolvedVia = 'path-alias';
export const PSR4_VIA: ResolvedVia = 'psr4';
