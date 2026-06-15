#!/usr/bin/env tsx
/**
 * Lint the hook concern budget against `src/scripts/hook_manifest.yaml`.
 *
 * TypeScript twin of `src/scripts/lint_hook_concern_budget.py` (ADR-200,
 * Phase 4 / Wave 4b). Mirrors the CLI contract EXACTLY — `--manifest` /
 * `--settings` / `--strict` argparse flags, exit codes (0 clean or warn-only,
 * 1 schema load failed, 2 hard-fail with violations), byte-identical
 * `warn:` / `error:` stderr lines and ordering, the same hand-rolled
 * `.agent-settings.yml` `hooks.concern_budget.*` line walker, and the same
 * defaults. No behaviour changes.
 *
 * The Python original imports `hooks.dispatch_hook._load_yaml` (which is
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

function _check_concern_counts(
    manifest: Manifest,
    max_per_event: number,
    warnings: string[],
): void {
    const platforms = manifest['platforms'] ?? {};
    if (!_isPlainDict(platforms)) {
        return;
    }
    for (const [plat, block] of Object.entries(platforms)) {
        if (!_isPlainDict(block) || block['fallback_only']) {
            continue;
        }
        for (const [event, names] of Object.entries(block)) {
            if (!Array.isArray(names)) {
                continue;
            }
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
}

function _check_fail_closed_tier(manifest: Manifest, tier1: string[], errors: string[]): void {
    const concerns = manifest['concerns'] ?? {};
    if (!_isPlainDict(concerns)) {
        return;
    }
    const allowed = new Set(tier1);
    for (const [name, spec] of Object.entries(concerns)) {
        if (!_isPlainDict(spec)) {
            continue;
        }
        if (spec['fail_closed'] === true && !allowed.has(name)) {
            errors.push(
                `concerns.${name}: fail_closed=true but not declared in ` +
                    'hooks.concern_budget.tier1_concerns. Promotion to Tier-1 ' +
                    'is explicit opt-in (Phase 1 evidence required).',
            );
        }
    }
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
    _check_concern_counts(manifest, max_per_event, warnings);
    _check_fail_closed_tier(manifest, tier1, errors);

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

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
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
