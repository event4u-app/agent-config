#!/usr/bin/env node
/**
 * Vocabulary linter for `src/config/discovery/{workspaces,packs}.yml`.
 *
 * TypeScript twin of `src/scripts/lint_discovery_vocabulary.py` (ADR-089,
 * Phase 4 / Wave 4b). Mirrors the Python CLI contract exactly: `--quiet`
 * flag, same scan scope, finding messages, stdout/stderr split (errors to
 * stderr, OK line to stdout), and exit codes (0 clean, 1 on failure, 2 if
 * YAML loader is unavailable — N/A here, `yaml` is bundled). No behaviour
 * changes — latent quirks replicated.
 *
 * Source-of-truth check: the YAML files MUST mirror the closed vocabulary in
 * ADR-013 exactly. Cross-reference + bidirectional integrity + non-overlap
 * (ADR-010) + acyclic `requires` graph, identical to the Python source.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
// REPO_ROOT = Path(__file__).resolve().parent.parent.parent
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const WORKSPACES_YML = path.join(REPO_ROOT, 'src', 'config', 'discovery', 'workspaces.yml');
const PACKS_YML = path.join(REPO_ROOT, 'src', 'config', 'discovery', 'packs.yml');

// Frozen ADR-013 vocabularies. Amendments require an ADR-013 edit + this list.
const ADR_WORKSPACES: ReadonlySet<string> = new Set<string>([
    'engineering', 'product', 'finance', 'founder', 'gtm', 'ops',
    'small-business', 'construction', 'agent-config-maintainer',
]);
const ADR_PACKS: ReadonlySet<string> = new Set<string>([
    'engineering-base', 'php', 'laravel', 'symfony', 'javascript',
    'typescript', 'react', 'nextjs', 'python', 'product-basic',
    'product-discovery', 'finance-basic', 'finance-advanced',
    'gtm-sales', 'gtm-marketing', 'ops-people', 'founder-strategy', 'small-business',
    'construction', 'ai-video', 'fun', 'meta', 'git', 'frontend-design',
]);

// ADR-010 non-overlap reservations.
const RULE_LOADING_TIER_RESERVED: ReadonlySet<string> = new Set<string>([
    'minimal', 'balanced', 'full', 'custom',
]);
const PROFILE_ID_RESERVED: ReadonlySet<string> = new Set<string>([
    'founder', 'developer', 'content_creator', 'agency', 'finance', 'ops',
]);

// Capability-pack size classes (docs/contracts/capability-packs.md).
const SIZE_CLASSES: ReadonlySet<string> = new Set<string>([
    'core', 'small', 'medium', 'large', 'platform',
]);

type Entry = Record<string, unknown>;

/** Mirror Python `sorted()` of a string set: codepoint ascending. */
function _sorted(values: Iterable<string>): string[] {
    return Array.from(values).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Python `repr(list[str])` — e.g. ['a', 'b']. */
function _reprList(values: readonly string[]): string {
    return `[${values.map((v) => `'${v}'`).join(', ')}]`;
}

/** Python truthiness for the values that appear here (None / "" / [] falsy). */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    return Boolean(value);
}

/** Canonical `requires` edges, falling back to legacy `requires_hint`. */
function _requires_of(pk: Entry): string[] {
    // Python: pk.get("requires") or pk.get("requires_hint") or []
    // — Python truthiness, where an empty list / None / "" are falsy.
    const req = pk['requires'];
    const hint = pk['requires_hint'];
    const chosen = _pyTruthy(req) ? req : _pyTruthy(hint) ? hint : [];
    return Array.isArray(chosen) ? (chosen as string[]) : [];
}

/** Return a node cycle in the `requires` graph, or null if acyclic. */
function _detect_requires_cycle(packs: readonly Entry[]): string[] | null {
    const graph = new Map<unknown, string[]>();
    for (const pk of packs) {
        graph.set(pk['id'], _requires_of(pk));
    }
    const WHITE = 0;
    const GREY = 1;
    const BLACK = 2;
    const color = new Map<unknown, number>();
    for (const pid of graph.keys()) {
        color.set(pid, WHITE);
    }

    function visit(node: string, p: string[]): string[] | null {
        color.set(node, GREY);
        for (const dep of graph.get(node) ?? []) {
            if (!color.has(dep)) {
                // dangling — reported separately
                continue;
            }
            if (color.get(dep) === GREY) {
                return [...p.slice(p.indexOf(dep)), dep];
            }
            if (color.get(dep) === WHITE) {
                const cyc = visit(dep, [...p, dep]);
                if (cyc) {
                    return cyc;
                }
            }
        }
        color.set(node, BLACK);
        return null;
    }

    for (const pid of graph.keys()) {
        if (color.get(pid) === WHITE) {
            const cyc = visit(pid as string, [pid as string]);
            if (cyc) {
                return cyc;
            }
        }
    }
    return null;
}

function _relToRoot(p: string): string {
    return path.relative(REPO_ROOT, p);
}

class SystemExitError extends Error {
    constructor(public readonly detail: string) {
        super(detail);
    }
}

function _load(p: string): Entry[] {
    if (!fs.existsSync(p)) {
        throw new SystemExitError(`ERROR: missing ${_relToRoot(p)}`);
    }
    const data = parseYaml(fs.readFileSync(p, 'utf-8')) ?? [];
    if (!Array.isArray(data)) {
        throw new SystemExitError(`ERROR: ${_relToRoot(p)} must be a YAML list`);
    }
    return data as Entry[];
}

/** Python `for x in value or []` — falsy (null/undefined/empty) yields nothing. */
function _iterList(value: unknown): unknown[] {
    if (Array.isArray(value) && value.length > 0) {
        return value;
    }
    return [];
}

function lint(quiet: boolean): number {
    const errors: string[] = [];
    const workspaces = _load(WORKSPACES_YML);
    const packs = _load(PACKS_YML);

    const ws_ids = new Set<unknown>(workspaces.map((entry) => entry['id']));
    const pack_ids = new Set<unknown>(packs.map((entry) => entry['id']));

    // String-typed views for set arithmetic that mirrors Python's behaviour
    // (id values are strings in the real files).
    const ws_ids_str = new Set<string>(
        [...ws_ids].filter((v): v is string => typeof v === 'string'),
    );
    const pack_ids_str = new Set<string>(
        [...pack_ids].filter((v): v is string => typeof v === 'string'),
    );

    // 1. ADR frozen-set parity.
    const missing_ws = _sorted([...ADR_WORKSPACES].filter((x) => !ws_ids.has(x)));
    const extra_ws = _sorted([...ws_ids_str].filter((x) => !ADR_WORKSPACES.has(x)));
    if (missing_ws.length > 0) {
        errors.push(`workspaces.yml missing ADR-013 ids: ${_reprList(missing_ws)}`);
    }
    if (extra_ws.length > 0) {
        errors.push(`workspaces.yml has ids not in ADR-013: ${_reprList(extra_ws)}`);
    }
    const missing_p = _sorted([...ADR_PACKS].filter((x) => !pack_ids.has(x)));
    const extra_p = _sorted([...pack_ids_str].filter((x) => !ADR_PACKS.has(x)));
    if (missing_p.length > 0) {
        errors.push(`packs.yml missing ADR-013 ids: ${_reprList(missing_p)}`);
    }
    if (extra_p.length > 0) {
        errors.push(`packs.yml has ids not in ADR-013: ${_reprList(extra_p)}`);
    }

    // 2. Cross-reference: workspace default/optional packs → pack ids.
    for (const ws of workspaces) {
        const wid = ws['id'];
        for (const key of ['default_packs', 'optional_packs']) {
            for (const pid of _iterList(ws[key])) {
                if (!pack_ids.has(pid)) {
                    errors.push(`workspaces.yml '${wid}'.${key} → unknown pack '${pid}'`);
                }
            }
        }
    }

    // 3. Cross-reference: pack workspaces → workspace ids.
    for (const pk of packs) {
        const pid = pk['id'];
        for (const wid of _iterList(pk['workspaces'])) {
            if (!ws_ids.has(wid)) {
                errors.push(`packs.yml '${pid}'.workspaces → unknown workspace '${wid}'`);
            }
        }
        // requires / requires_hint (capability-packs.md): hard dependency edges.
        for (const dep of _requires_of(pk)) {
            if (!pack_ids.has(dep)) {
                errors.push(`packs.yml '${pid}'.requires → unknown pack '${dep}'`);
            }
        }
        // suggests (capability-packs.md): soft companion edges.
        for (const sug of _iterList(pk['suggests'])) {
            if (!pack_ids.has(sug)) {
                errors.push(`packs.yml '${pid}'.suggests → unknown pack '${sug}'`);
            } else if (sug === pid) {
                errors.push(`packs.yml '${pid}'.suggests → must not reference itself`);
            }
        }
        // size_class (capability-packs.md): closed enum when present.
        const sc = pk['size_class'] ?? null;
        if (sc !== null && !SIZE_CLASSES.has(sc as string)) {
            errors.push(
                `packs.yml '${pid}'.size_class → invalid '${sc}' ` +
                    `(allowed: ${_reprList(_sorted(SIZE_CLASSES))})`,
            );
        }
        // domain + size_class are co-required: both present or both absent.
        const has_domain = (pk['domain'] ?? null) !== null;
        const has_size = sc !== null;
        if (has_domain !== has_size) {
            errors.push(
                `packs.yml '${pid}': domain and size_class are co-required — ` +
                    `got domain=${_pyBool(has_domain)}, size_class=${_pyBool(has_size)}`,
            );
        }
        // cluster (road-to-wizard-ux-improvements § Phase 4): advisory wizard
        // grouping; the value must be a known pack id and not self-referential.
        const cluster = pk['cluster'] ?? null;
        if (cluster !== null) {
            if (!pack_ids.has(cluster)) {
                errors.push(`packs.yml '${pid}'.cluster → unknown pack '${cluster}'`);
            } else if (cluster === pid) {
                errors.push(`packs.yml '${pid}'.cluster → must not reference itself`);
            }
        }
    }

    // 4. Bidirectional integrity (council HIGH fold-in).
    const pack_by_id = new Map<unknown, Entry>();
    for (const pk of packs) {
        pack_by_id.set(pk['id'], pk);
    }
    const ws_by_id = new Map<unknown, Entry>();
    for (const ws of workspaces) {
        ws_by_id.set(ws['id'], ws);
    }
    for (const ws of workspaces) {
        const wid = ws['id'];
        for (const key of ['default_packs', 'optional_packs']) {
            for (const pid of _iterList(ws[key])) {
                const pk = pack_by_id.get(pid);
                if (pk) {
                    const wsList = _asList(pk['workspaces']);
                    if (!wsList.includes(wid)) {
                        errors.push(
                            `bidir: workspace '${wid}'.${key} lists '${pid}' but ` +
                                `pack '${pid}'.workspaces does not list '${wid}'`,
                        );
                    }
                }
            }
        }
    }
    for (const pk of packs) {
        const pid = pk['id'];
        for (const wid of _iterList(pk['workspaces'])) {
            const ws = ws_by_id.get(wid);
            if (ws) {
                const listed = new Set<unknown>([
                    ..._asList(ws['default_packs']),
                    ..._asList(ws['optional_packs']),
                ]);
                if (!listed.has(pid)) {
                    errors.push(
                        `bidir: pack '${pid}'.workspaces lists '${wid}' but ` +
                            `workspace '${wid}' does not list '${pid}' in default/optional_packs`,
                    );
                }
            }
        }
    }

    // 5. Non-overlap (ADR-010).
    const overlap_cost = _sorted(
        [...pack_ids_str].filter((x) => RULE_LOADING_TIER_RESERVED.has(x)),
    );
    if (overlap_cost.length > 0) {
        errors.push(`pack ids collide with rule_loading_tier values: ${_reprList(overlap_cost)}`);
    }
    const overlap_profile = _sorted(
        [...pack_ids_str].filter((x) => PROFILE_ID_RESERVED.has(x)),
    );
    if (overlap_profile.length > 0) {
        errors.push(`pack ids collide with profile.id values: ${_reprList(overlap_profile)}`);
    }

    // 6. requires graph must be acyclic (capability-packs.md graph invariant).
    const cycle = _detect_requires_cycle(packs);
    if (cycle) {
        errors.push(`packs.yml requires graph has a cycle: ${cycle.join(' → ')}`);
    }

    if (errors.length > 0) {
        for (const e of errors) {
            process.stderr.write(`❌ ${e}\n`);
        }
        return 1;
    }
    if (!quiet) {
        process.stdout.write(
            `✅ discovery vocabulary OK — ${ws_ids.size} workspaces · ${pack_ids.size} packs\n`,
        );
    }
    return 0;
}

/** Python `bool` repr: True / False. */
function _pyBool(b: boolean): string {
    return b ? 'True' : 'False';
}

/** Python `value or []` for membership tests in bidir checks. */
function _asList(value: unknown): unknown[] {
    if (Array.isArray(value) && value.length > 0) {
        return value;
    }
    return [];
}

function main(): number {
    const quiet = process.argv.slice(2).includes('--quiet');
    try {
        return lint(quiet);
    } catch (err) {
        if (err instanceof SystemExitError) {
            process.stderr.write(`${err.detail}\n`);
            return 1;
        }
        throw err;
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    type Entry,
    REPO_ROOT,
    WORKSPACES_YML,
    PACKS_YML,
    ADR_WORKSPACES,
    ADR_PACKS,
    RULE_LOADING_TIER_RESERVED,
    PROFILE_ID_RESERVED,
    SIZE_CLASSES,
    _requires_of,
    _detect_requires_cycle,
    lint,
    main,
};
