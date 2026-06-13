#!/usr/bin/env tsx
/**
 * Decision-engine settings validator (road-to-productization P2).
 *
 * TypeScript twin of `src/scripts/validate_decision_engine.py` (ADR-094,
 * Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY — no flags,
 * exit codes (0 clean/warn, 1 hard error, 3 internal), stdout (the
 * `::error::` / `::warning::` GitHub-annotation lines + the summary), same
 * file set (template + project local settings) and order. No behaviour
 * changes.
 *
 * The `decision_engine` block is parsed by the inlined port of
 * `work_engine.scoring.decision_engine.parse` (the validator only needs
 * `parse` + `any_gate_active`; the gate-evaluation surface is out of
 * scope here and not ported).
 *
 * jsonschema/parser ERROR PROSE is Python-version-dependent for malformed
 * YAML; this validator builds the `decision_engine:` config-error prose
 * itself (DecisionEngineConfigError messages), which IS a byte contract.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { project_settings_path } from './_lib/agent_settings.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

// Files we always validate. Template is canonical — its absence is a regression.
const TEMPLATE_PATH = path.join(REPO_ROOT, 'src', 'config', 'agent-settings.template.yml');
const LOCAL_PATHS = [project_settings_path(REPO_ROOT)];

// --- Inlined decision_engine.parse port (work_engine.scoring) ---------------

const ALLOWED_KEYS: ReadonlySet<string> = new Set([
    'surface_traces',
    'min_confidence',
    'block_on_risk',
    'require_memory_hits',
    'on_block',
    'ask_timeout_seconds',
    'on_block_fallback',
]);
const _LEVEL_VALUES: ReadonlySet<string> = new Set(['low', 'medium', 'high', 'off']);
const _ON_BLOCK_VALUES: ReadonlySet<string> = new Set(['stop', 'ask', 'warn']);
const _FALLBACK_VALUES: ReadonlySet<string> = new Set(['stop', 'warn']);

class DecisionEngineConfigError extends Error {}

interface DecisionEngineSettings {
    surface_traces: boolean;
    min_confidence: string;
    block_on_risk: string;
    require_memory_hits: boolean;
    on_block: string;
    ask_timeout_seconds: number;
    on_block_fallback: string;
}

function any_gate_active(s: DecisionEngineSettings): boolean {
    return s.min_confidence !== 'off' || s.block_on_risk !== 'off' || s.require_memory_hits;
}

/** Mirror Python `type(x).__name__` for the value classes the parser sees. */
function _pyTypeName(value: unknown): string {
    if (value === null || value === undefined) {
        return 'NoneType';
    }
    if (typeof value === 'boolean') {
        return 'bool';
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? 'int' : 'float';
    }
    if (typeof value === 'string') {
        return 'str';
    }
    if (Array.isArray(value)) {
        return 'list';
    }
    return 'dict';
}

/** Mirror Python `repr()` for the scalar values the parser emits in errors. */
function _pyRepr(value: unknown): string {
    if (value === null || value === undefined) {
        return 'None';
    }
    if (typeof value === 'boolean') {
        return value ? 'True' : 'False';
    }
    if (typeof value === 'string') {
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    return String(value);
}

function _coerce_bool(value: unknown, dflt: boolean): boolean {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === null || value === undefined) {
        return dflt;
    }
    if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        if (['true', 'yes', 'on', '1'].includes(s)) {
            return true;
        }
        if (['false', 'no', 'off', '0'].includes(s)) {
            return false;
        }
    }
    throw new DecisionEngineConfigError(`decision_engine.${_pyRepr(value)}: expected bool`);
}

function _coerce_level(value: unknown, key: string): string {
    if (value === null || value === undefined) {
        return 'off';
    }
    if (typeof value === 'boolean') {
        if (value === false) {
            return 'off';
        }
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: boolean True is not a valid level ` +
                '(quote a string: low/medium/high/off)',
        );
    }
    if (typeof value !== 'string') {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: expected string, got ${_pyTypeName(value)}`,
        );
    }
    const s = value.trim().toLowerCase();
    if (!_LEVEL_VALUES.has(s)) {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: invalid value ${_pyRepr(value)}. ` +
                'Allowed: ' +
                [..._LEVEL_VALUES].sort().join(', '),
        );
    }
    return s;
}

function _coerce_choice(value: unknown, key: string, allowed: ReadonlySet<string>): string {
    if (typeof value !== 'string') {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: expected string, got ${_pyTypeName(value)}`,
        );
    }
    const s = value.trim().toLowerCase();
    if (!allowed.has(s)) {
        throw new DecisionEngineConfigError(
            `decision_engine.${key}: invalid value ${_pyRepr(value)}. ` +
                'Allowed: ' +
                [...allowed].sort().join(', '),
        );
    }
    return s;
}

function _coerce_int(value: unknown, key: string): number {
    if (typeof value === 'boolean') {
        throw new DecisionEngineConfigError(`decision_engine.${key}: expected int, got bool`);
    }
    if (typeof value === 'number' && Number.isInteger(value)) {
        if (value < 0) {
            throw new DecisionEngineConfigError(`decision_engine.${key}: must be >= 0`);
        }
        return value;
    }
    throw new DecisionEngineConfigError(
        `decision_engine.${key}: expected int, got ${_pyTypeName(value)}`,
    );
}

function _get(obj: Record<string, unknown>, key: string, dflt?: unknown): unknown {
    return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : dflt;
}

function parse(data: unknown): DecisionEngineSettings {
    const defaults: DecisionEngineSettings = {
        surface_traces: false,
        min_confidence: 'off',
        block_on_risk: 'off',
        require_memory_hits: false,
        on_block: 'stop',
        ask_timeout_seconds: 30,
        on_block_fallback: 'stop',
    };
    if (data === null || data === undefined) {
        return defaults;
    }
    if (typeof data !== 'object' || Array.isArray(data)) {
        throw new DecisionEngineConfigError(
            `decision_engine: must be a mapping, got ${_pyTypeName(data)}`,
        );
    }
    const obj = data as Record<string, unknown>;
    const unknown = Object.keys(obj).filter((k) => !ALLOWED_KEYS.has(k));
    if (unknown.length > 0) {
        throw new DecisionEngineConfigError(
            'decision_engine: unknown key(s): ' +
                unknown.slice().sort().join(', ') +
                '. Allowed: ' +
                [...ALLOWED_KEYS].sort().join(', '),
        );
    }
    return {
        surface_traces: _coerce_bool(_get(obj, 'surface_traces'), false),
        min_confidence: _coerce_level(_get(obj, 'min_confidence', 'off'), 'min_confidence'),
        block_on_risk: _coerce_level(_get(obj, 'block_on_risk', 'off'), 'block_on_risk'),
        require_memory_hits: _coerce_bool(_get(obj, 'require_memory_hits'), false),
        on_block: _coerce_choice(_get(obj, 'on_block', 'stop'), 'on_block', _ON_BLOCK_VALUES),
        ask_timeout_seconds: _coerce_int(
            _get(obj, 'ask_timeout_seconds', 30),
            'ask_timeout_seconds',
        ),
        on_block_fallback: _coerce_choice(
            _get(obj, 'on_block_fallback', 'stop'),
            'on_block_fallback',
            _FALLBACK_VALUES,
        ),
    };
}

// --- validator -------------------------------------------------------------

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _relTo(target: string): string {
    return path.relative(REPO_ROOT, target).split(path.sep).join('/');
}

/** Parse with the YAML 1.1 schema to match PyYAML safe_load semantics. */
function _safeLoad(text: string): unknown {
    return YAML.parse(text, { version: '1.1' });
}

function _load_yaml(p: string): Record<string, unknown> | null {
    if (!_isFile(p)) {
        return null;
    }
    let raw: unknown;
    try {
        raw = _safeLoad(fs.readFileSync(p, 'utf-8'));
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stdout.write(`::error file=${p}::malformed YAML: ${msg}\n`);
        return {};
    }
    if (raw === null || raw === undefined) {
        return {};
    }
    if (typeof raw !== 'object' || Array.isArray(raw)) {
        process.stdout.write(`::error file=${p}::top-level must be a mapping\n`);
        return {};
    }
    return raw as Record<string, unknown>;
}

function _validate(p: string, doc: Record<string, unknown>): [number, number] {
    let errors = 0;
    let warnings = 0;
    const block = _get(doc, 'decision_engine');
    if (block === null || block === undefined) {
        return [0, 0];
    }
    let settings: DecisionEngineSettings;
    try {
        settings = parse(block);
    } catch (exc) {
        if (exc instanceof DecisionEngineConfigError) {
            const rel = _relTo(p);
            process.stdout.write(`::error file=${rel}::decision_engine: ${exc.message}\n`);
            return [1, 0];
        }
        throw exc;
    }
    if (any_gate_active(settings)) {
        const hooksBlock = _get(doc, 'hooks') ?? {};
        if (
            hooksBlock !== null &&
            typeof hooksBlock === 'object' &&
            !Array.isArray(hooksBlock) &&
            (hooksBlock as Record<string, unknown>)['enabled'] === false
        ) {
            const rel = _relTo(p);
            process.stdout.write(
                `::warning file=${rel}::decision_engine gates configured ` +
                    '(min_confidence/block_on_risk/require_memory_hits) but ' +
                    'hooks.enabled=false — gates will not fire. Either enable ' +
                    'hooks or remove the gate keys.\n',
            );
            warnings += 1;
        }
    }
    return [errors, warnings];
}

function main(): number {
    let total_errors = 0;
    let total_warnings = 0;
    const paths: string[] = [];
    if (_isFile(TEMPLATE_PATH)) {
        paths.push(TEMPLATE_PATH);
    } else {
        process.stdout.write(`::error file=${TEMPLATE_PATH}::template missing\n`);
        return 1;
    }
    for (const candidate of LOCAL_PATHS) {
        if (_isFile(candidate)) {
            paths.push(candidate);
        }
    }
    for (const p of paths) {
        const doc = _load_yaml(p);
        if (doc === null) {
            continue;
        }
        const [errors, warnings] = _validate(p, doc);
        total_errors += errors;
        total_warnings += warnings;
    }
    if (total_errors) {
        return 1;
    }
    if (total_warnings) {
        process.stdout.write(
            `decision_engine: ${total_warnings} warning(s); see ::warning:: lines above\n`,
        );
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stdout.write(`::error::validate_decision_engine internal error: ${msg}\n`);
        process.exit(3);
    }
}

export {
    TEMPLATE_PATH,
    LOCAL_PATHS,
    DecisionEngineConfigError,
    parse,
    any_gate_active,
    main,
};
