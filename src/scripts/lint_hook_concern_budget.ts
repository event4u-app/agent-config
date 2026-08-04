#!/usr/bin/env tsx
/**
 * Lint the hook concern budget against `src/scripts/hook_manifest.yaml`.
 *
 * Ported from the retired Python `src/scripts/lint_hook_concern_budget.py` (ADR-200,
 * Phase 4 / Wave 4b). Mirrors the CLI contract EXACTLY — `--manifest` /
 * `--settings` / `--strict` argparse flags, exit codes (0 clean or warn-only,
 * 1 schema load failed, 2 hard-fail with violations), byte-identical
 * `warn:` / `error:` stderr lines and ordering, the same hand-rolled
 * `.agent-settings.yml` `hooks.concern_budget.*` line walker, and the same
 * defaults. No behaviour changes.
 *
 * the retired Python implementation imports `hooks.dispatch_hook._load_yaml` (which is
 * `yaml.safe_load(text) or {}` when PyYAML is present). That hook module is
 * not yet ported, so this twin inlines the equivalent `yaml`-package load
 * (version 1.1 → PyYAML safe_load parity). When the dispatch_hook twin
 * lands, this loader should delegate to it.
 *
 * `--strict` upgrades warn-only to hard-fail regardless of settings.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { project_settings_path } from './_lib/agent_settings.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const DEFAULT_SETTINGS = project_settings_path(REPO_ROOT);

const DEFAULT_MAX_PER_EVENT = 8;
const DEFAULT_TIER1: string[] = [];
const DEFAULT_HARD_FAIL = false;

type Manifest = Record<string, unknown>;

/**
 * Inlined equivalent of `hooks.dispatch_hook._load_yaml`:
 * `yaml.safe_load(text) or {}`. version '1.1' matches PyYAML safe_load.
 */
function _load_manifest(p: string): Manifest {
    const text = fs.readFileSync(p, 'utf-8');
    const data = parseYaml(text, { version: '1.1' });
    if (data === null || data === undefined || data === false || data === '') {
        return {};
    }
    return data as Manifest;
}

interface SettingsBlock {
    max_per_event?: number;
    hard_fail?: boolean;
    tier1_concerns?: string[];
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Minimal YAML walk for `hooks.concern_budget.*`. Mirrors the Python
 * `_read_settings_block` line walker verbatim — no YAML dependency,
 * tolerant of missing keys / blocks.
 */
function _read_settings_block(settings_path: string): SettingsBlock {
    const out: SettingsBlock = {};
    if (!_isFile(settings_path)) {
        return out;
    }
    let in_hooks = false;
    let in_budget = false;
    let in_tier1 = false;
    let text: string;
    try {
        text = fs.readFileSync(settings_path, 'utf-8');
    } catch {
        return out;
    }
    for (const raw of text.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (/^hooks\s*:\s*(?:#.*)?$/.test(line)) {
            in_hooks = true;
            in_budget = false;
            in_tier1 = false;
            continue;
        }
        if (in_hooks && /^\S/.test(line)) {
            in_hooks = false;
            in_budget = false;
            in_tier1 = false;
        }
        if (in_hooks && /^\s{2}concern_budget\s*:\s*(?:#.*)?$/.test(line)) {
            in_budget = true;
            in_tier1 = false;
            continue;
        }
        if (in_budget && /^\s{2}\S/.test(line)) {
            in_budget = false;
            in_tier1 = false;
        }
        if (in_budget) {
            let m = /^\s{4}max_per_event\s*:\s*(\d+)/.exec(line);
            if (m) {
                out.max_per_event = Number.parseInt(m[1] as string, 10);
                in_tier1 = false;
                continue;
            }
            m = /^\s{4}hard_fail\s*:\s*(true|false)/.exec(line);
            if (m) {
                out.hard_fail = m[1] === 'true';
                in_tier1 = false;
                continue;
            }
            if (/^\s{4}tier1_concerns\s*:\s*\[\s*\]/.test(line)) {
                out.tier1_concerns = [];
                in_tier1 = false;
                continue;
            }
            if (/^\s{4}tier1_concerns\s*:\s*(?:#.*)?$/.test(line)) {
                if (out.tier1_concerns === undefined) {
                    out.tier1_concerns = [];
                }
                in_tier1 = true;
                continue;
            }
            if (in_tier1) {
                m = /^\s{6}-\s*([A-Za-z0-9_-]+)/.exec(line);
                if (m) {
                    if (out.tier1_concerns === undefined) {
                        out.tier1_concerns = [];
                    }
                    out.tier1_concerns.push(m[1] as string);
                }
            }
        }
    }
    return out;
}

function _isPlainDict(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** @returns the number of platform/event concern lists inspected. */
function _check_concern_counts(
    manifest: Manifest,
    max_per_event: number,
    warnings: string[],
): number {
    let inspected = 0;
    const platforms = manifest['platforms'] ?? {};
    if (!_isPlainDict(platforms)) {
        return inspected;
    }
    for (const [plat, block] of Object.entries(platforms)) {
        if (!_isPlainDict(block) || block['fallback_only']) {
            continue;
        }
        for (const [event, names] of Object.entries(block)) {
            if (!Array.isArray(names)) {
                continue;
            }
            inspected += 1;
            const count = names.length;
            if (count > max_per_event) {
                warnings.push(
                    `platforms.${plat}.${event}: ${count} concerns ` +
                        `(threshold ${max_per_event}). Trim or raise ` +
                        'hooks.concern_budget.max_per_event in .agent-settings.yml.',
                );
            }
        }
    }
    return inspected;
}

/** @returns the number of concern declarations inspected. */
function _check_fail_closed_tier(manifest: Manifest, tier1: string[], errors: string[]): number {
    let inspected = 0;
    const concerns = manifest['concerns'] ?? {};
    if (!_isPlainDict(concerns)) {
        return inspected;
    }
    const allowed = new Set(tier1);
    for (const [name, spec] of Object.entries(concerns)) {
        if (!_isPlainDict(spec)) {
            continue;
        }
        inspected += 1;
        if (spec['fail_closed'] === true && !allowed.has(name)) {
            errors.push(
                `concerns.${name}: fail_closed=true but not declared in ` +
                    'hooks.concern_budget.tier1_concerns. Promotion to Tier-1 ' +
                    'is explicit opt-in (Phase 1 evidence required).',
            );
        }
    }
    return inspected;
}

export function lint(
    manifest_path: string,
    settings_path: string,
    options: { strict?: boolean } = {},
): number {
    const strict = options.strict ?? false;
    if (!_isFile(manifest_path)) {
        process.stderr.write(`lint_hook_concern_budget: file not found: ${manifest_path}\n`);
        return 1;
    }
    let manifest: unknown;
    try {
        manifest = _load_manifest(manifest_path);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`lint_hook_concern_budget: load error: ${msg}\n`);
        return 1;
    }
    if (!_isPlainDict(manifest)) {
        process.stderr.write('lint_hook_concern_budget: manifest is not a mapping\n');
        return 1;
    }

    const settings = _read_settings_block(settings_path);
    const max_per_event = settings.max_per_event ?? DEFAULT_MAX_PER_EVENT;
    const tier1 = settings.tier1_concerns ?? DEFAULT_TIER1;
    const hard_fail = (settings.hard_fail ?? DEFAULT_HARD_FAIL) || strict;

    const warnings: string[] = [];
    const errors: string[] = [];
    const inspected =
        _check_concern_counts(manifest, max_per_event, warnings) +
        _check_fail_closed_tier(manifest, tier1, errors);

    // The manifest loads and parses, then every walk below silently tolerates a
    // shape it does not recognise — no `platforms:`, no `concerns:`, a renamed
    // top-level key — and the gate exits 0 having budgeted nothing. Counts units
    // INSPECTED (platform/event concern lists + concern declarations), not
    // warnings or errors. Exit 1 is the load-failure code and is the right one
    // here: the manifest was readable but carried nothing this gate governs; 2
    // is reserved for a hard-fail WITH violations.
    try {
        assertScanned({
            gate: 'lint_hook_concern_budget',
            scanned: inspected,
            units: 'manifest concern unit(s)',
            roots: [manifest_path],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // The message already carries the gate name as its prefix.
            process.stderr.write(`${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    for (const w of warnings) {
        process.stderr.write(`warn: ${w}\n`);
    }
    for (const e of errors) {
        process.stderr.write(`error: ${e}\n`);
    }

    if (hard_fail && (warnings.length > 0 || errors.length > 0)) {
        return 2;
    }
    return 0;
}

interface ParsedArgs {
    manifest: string;
    settings: string;
    strict: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write(
        'usage: lint_hook_concern_budget.py [-h] [--manifest MANIFEST]\n' +
            '                                   [--settings SETTINGS] [--strict]\n',
    );
    process.stderr.write(`lint_hook_concern_budget.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let manifest = DEFAULT_MANIFEST;
    let settings = DEFAULT_SETTINGS;
    let strict = false;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]!;
        if (arg === '--manifest') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --manifest: expected one argument');
            }
            manifest = v;
        } else if (arg.startsWith('--manifest=')) {
            manifest = arg.slice('--manifest='.length);
        } else if (arg === '--settings') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --settings: expected one argument');
            }
            settings = v;
        } else if (arg.startsWith('--settings=')) {
            settings = arg.slice('--settings='.length);
        } else if (arg === '--strict') {
            strict = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_hook_concern_budget.py [-h] [--manifest MANIFEST]\n' +
                    '                                   [--settings SETTINGS] [--strict]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { manifest, settings, strict };
}

export function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    return lint(args.manifest, args.settings, { strict: args.strict });
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    DEFAULT_MANIFEST,
    DEFAULT_SETTINGS,
    DEFAULT_MAX_PER_EVENT,
    DEFAULT_TIER1,
    DEFAULT_HARD_FAIL,
    _read_settings_block,
    type SettingsBlock,
};
