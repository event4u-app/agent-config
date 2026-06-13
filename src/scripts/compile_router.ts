#!/usr/bin/env tsx
/**
 * Compile rule frontmatter into `router.json`.
 *
 * TypeScript twin of `src/scripts/compile_router.py` (ADR-092, Phase 5). The
 * CLI contract is mirrored EXACTLY — the positional argv flags (`--pretty`,
 * `--check`), exit codes (0 = wrote / up-to-date; 1 = stale under --check), the
 * stdout/stderr split, byte-identical messages, AND byte-identical generated
 * `dist/router.json` (minified `separators=(",", ":")`) / `router.pretty.json`
 * (`indent=2`, `sort_keys=False` — insertion order preserved) output. Consumed
 * by `lint_rule_budget` / `check_router`, which must keep passing.
 *
 * Imports the `_lib/agent_settings` (`project_settings_path`,
 * `load_agent_settings`) and `_lib/agent_src` (`artefact_roots`) twins — the
 * SAME modules the Python original imports.
 *
 * No behaviour changes — latent Python quirks replicated.
 *
 * Reads `.agent-src.uncondensed/rules/*.md`; produces deterministic JSON
 * mapping kernel + tier-1 + tier-2 rules to their triggers and routed
 * artifacts, per `docs/contracts/rule-router.md`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { load_agent_settings, project_settings_path } from './_lib/agent_settings.js';
import { artefact_roots } from './_lib/agent_src.js';

type Json = unknown;
type JsonObject = Record<string, Json>;

const _HERE = fileURLToPath(import.meta.url);
// _HERE === <repo>/src/scripts/compile_router.ts ; the Python original derives
// ROOT = <file>.parent.parent.parent — two dirs up from src/scripts.
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
// ADR-017: rules now live across multiple source roots. Legacy
// .agent-src.uncondensed/rules/ is kept as a fallback for the pure-condensed
// consumer projection.
export const RULES_DIR = path.join(ROOT, '.agent-src.uncondensed', 'rules');
export const OUT_PATH = path.join(ROOT, 'dist', 'router.json');
const SETTINGS_PATH = project_settings_path(ROOT);
export const SCHEMA_VERSION = 1;

// Compile-time rule toggles. Maps rule-id → settings predicate.
// Rule omitted from router.json when predicate returns False.
const COMPILE_TIME_TOGGLES: Record<string, (s: JsonObject) => boolean> = {
    'telegraph-speak': (s: JsonObject): boolean => {
        const tg = (s['telegraph'] as JsonObject | undefined) ?? {};
        const enabled = tg['enabled'] === undefined ? true : tg['enabled'];
        const speak = tg['speak'] === undefined ? true : tg['speak'];
        return Boolean(enabled) && Boolean(speak);
    },
};

// Maps legacy tier values to the router-canonical names. See
// docs/contracts/rule-router.md § Backward compatibility.
const LEGACY_TIER_MAP: Record<string, string> = {
    '1': 'tier-1',
    '2': 'tier-2',
    '2a': 'tier-2',
    '3': 'tier-1',
    'mechanical-already': 'tier-1',
    kernel: 'kernel',
    'tier-1': 'tier-1',
    'tier-2': 'tier-2',
};

const ALLOWED_TIERS = new Set(['kernel', 'tier-1', 'tier-2']);
const ALLOWED_TRIGGER_KEYS = new Set([
    'keyword',
    'phrase',
    'intent',
    'file_pattern',
    'path_prefix',
    'command',
]);

function _parse_frontmatter(text: string): JsonObject {
    if (!text.startsWith('---\n')) {
        return {};
    }
    const end = text.indexOf('\n---', 4);
    if (end < 0) {
        return {};
    }
    const block = text.slice(4, end);
    // PyYAML safe_load with YAML 1.1 semantics (yes/no/on/off booleans etc.).
    const data = parseYaml(block, { version: '1.1' }) ?? {};
    return data !== null && typeof data === 'object' && !Array.isArray(data)
        ? (data as JsonObject)
        : {};
}

function _resolve_tier(rule_type: string, raw_tier: string): string {
    if (rule_type === 'always') {
        return 'kernel';
    }
    return LEGACY_TIER_MAP[String(raw_tier)] ?? 'tier-2';
}

function _normalize_trigger(item: Json): JsonObject | null {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
        return null;
    }
    const obj = item as JsonObject;
    const keys = Object.keys(obj).filter((k) => ALLOWED_TRIGGER_KEYS.has(k));
    if (keys.length !== 1) {
        return null;
    }
    const k = keys[0] as string;
    return { [k]: _pyStr(obj[k]) };
}

/** Mirror Python str() for scalar YAML values (used for trigger values). */
function _pyStr(v: Json): string {
    if (v === true) return 'True';
    if (v === false) return 'False';
    if (v === null) return 'None';
    return String(v);
}

function _load_settings(): JsonObject {
    // Centralized loader — tolerance contract handles missing file / malformed
    // YAML uniformly.
    return load_agent_settings({ project_path: SETTINGS_PATH }) as JsonObject;
}

/** Walk every source root for rule files. First root wins per id. */
function _iter_rule_files(): string[] {
    const seen = new Map<string, string>();
    const roots = artefact_roots();
    if (roots.length === 0) {
        // Pure-condensed fallback for consumer projections that vendor the flat
        // dist/agent-src/ tree without sources.
        if (_isDir(RULES_DIR)) {
            for (const p of _globMd(RULES_DIR)) {
                const stem = _stem(p);
                if (!seen.has(stem)) seen.set(stem, p);
            }
        }
    } else {
        for (const src_root of roots) {
            const rd = path.join(src_root, 'rules');
            if (!_isDir(rd)) continue;
            for (const p of _globMd(rd)) {
                const stem = _stem(p);
                if (!seen.has(stem)) seen.set(stem, p);
            }
        }
    }
    return [...seen.keys()].sort().map((k) => seen.get(k) as string);
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Sorted *.md files (immediate children), mirroring sorted(dir.glob("*.md")). */
function _globMd(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries) {
        if (e.isFile() && e.name.endsWith('.md')) {
            out.push(path.join(dir, e.name));
        }
    }
    // sorted() compares full POSIX paths; within one dir the basename order
    // matches. Sort on the full path for parity.
    out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return out;
}

function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot <= 0 ? base : base.slice(0, dot);
}

function _collect(): JsonObject {
    const settings = _load_settings();
    const kernel: string[] = [];
    const tiered: Record<string, JsonObject[]> = { 'tier-1': [], 'tier-2': [] };
    for (const p of _iter_rule_files()) {
        const fm = _parse_frontmatter(fs.readFileSync(p, 'utf-8'));
        if (Object.keys(fm).length === 0) {
            continue;
        }
        const rule_id = _stem(p);
        if (rule_id in COMPILE_TIME_TOGGLES) {
            if (!(COMPILE_TIME_TOGGLES[rule_id] as (s: JsonObject) => boolean)(settings)) {
                continue;
            }
        }
        const rule_type = String(fm['type'] ?? 'auto');
        // Manual rules are reference-only (ADR-004) — no router emission.
        if (rule_type === 'manual') {
            continue;
        }
        const tier = _resolve_tier(rule_type, String(fm['tier'] ?? ''));
        if (!ALLOWED_TIERS.has(tier)) {
            continue;
        }
        if (tier === 'kernel') {
            kernel.push(rule_id);
            continue;
        }
        const triggers_raw = (fm['triggers'] as Json[] | null | undefined) ?? [];
        const triggers = triggers_raw
            .map((x) => _normalize_trigger(x))
            .filter((t): t is JsonObject => t !== null);
        const routes_to = ((fm['routes_to'] as Json[] | null | undefined) ?? [])
            .map((x) => String(x))
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const entry: JsonObject = { id: rule_id, triggers, routes_to };
        (tiered[tier] as JsonObject[]).push(entry);
    }
    for (const k of Object.keys(tiered)) {
        (tiered[k] as JsonObject[]).sort((a, b) =>
            (a['id'] as string) < (b['id'] as string) ? -1 : (a['id'] as string) > (b['id'] as string) ? 1 : 0,
        );
    }
    const out: JsonObject = { kernel: [...kernel].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)) };
    for (const [k, v] of Object.entries(tiered)) {
        out[k.replace(/-/g, '_')] = v;
    }
    return out;
}

export function build(): JsonObject {
    const collected = _collect();
    return {
        schema_version: SCHEMA_VERSION,
        kernel: collected['kernel'],
        tier_1: collected['tier_1'],
        tier_2: collected['tier_2'],
        profiles: {
            minimal: ['__kernel__'],
            balanced: ['__kernel__', '__tier_1__'],
            full: ['__kernel__', '__tier_1__', '__tier_2__'],
        },
    };
}

const PRETTY_PATH = OUT_PATH.replace(/\.json$/, '.pretty.json');

export function main(argv: readonly string[]): number {
    const out = build();
    // Default: minified. `--pretty` writes the human-readable variant ONLY.
    const pretty_text = JSON.stringify(out, null, 2) + '\n';
    const minified_text = JSON.stringify(out) + '\n';
    const wantPretty = argv.includes('--pretty');
    const text = wantPretty ? pretty_text : minified_text;
    const target_path = wantPretty ? PRETTY_PATH : OUT_PATH;
    if (argv.includes('--check')) {
        let current: string | null = null;
        try {
            current = fs.readFileSync(OUT_PATH, 'utf-8');
        } catch {
            current = null;
        }
        if (current === null || current !== minified_text) {
            process.stderr.write('router.json out of date — run scripts/compile_router.py\n');
            return 1;
        }
        process.stdout.write('✅  router.json is up to date\n');
        return 0;
    }
    fs.mkdirSync(path.dirname(target_path), { recursive: true });
    fs.writeFileSync(target_path, text, 'utf-8');
    const k = (out['kernel'] as unknown[]).length;
    const t1 = (out['tier_1'] as unknown[]).length;
    const t2 = (out['tier_2'] as unknown[]).length;
    const fmt = wantPretty ? 'pretty' : 'minified';
    process.stdout.write(
        `✅  ${path.basename(target_path)} (${fmt}) — kernel=${k}  tier-1=${t1}  tier-2=${t2}\n`,
    );
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main(process.argv.slice(2)));
}
