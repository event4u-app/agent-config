#!/usr/bin/env tsx
/**
 * Lint `.agent-config/orchestrations/*.yaml` pipeline files.
 *
 * TypeScript twin of `src/scripts/lint_orchestration_dsl.py` (ADR-090,
 * Phase 4 / Wave 4b). The CLI contract is mirrored EXACTLY — `--dir` /
 * `--file` flags, exit codes (0 clean, 1 hard failure, 2 file/schema-load
 * error), stdout/stderr split (all findings on stderr), byte-identical
 * finding messages, same scan order, same `resolve_logical` ref resolution,
 * same interpolation grammar.
 *
 * CI gate for the orchestration DSL contract
 * (`docs/contracts/orchestration-dsl-v1.md`).
 *
 * Exit codes mirror lint_hook_manifest:
 *   0 — clean
 *   1 — at least one hard failure
 *   2 — file or schema-load error
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { resolve_logical } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);

const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_DIR = path.join(REPO_ROOT, '.agent-config', 'orchestrations');

const NAME_RE = /^[a-z][a-z0-9-]*$/;
const STEP_ID_RE = /^[a-z][a-z0-9_]*$/;
const INTERP_RE = /\$\{\{\s*(inputs|steps)\.([a-z0-9_-]+)(?:\.output)?\s*\}\}/g;

const VALID_KINDS = new Set(['skill', 'command', 'persona', 'subagent']);
const MAX_STEPS = 32;
const MIN_STEPS = 1;

// Subagent-orchestration modes — kept in lock-step with the skill.
const SUBAGENT_MODES = new Set([
    'do-and-judge',
    'do-and-judge-two-stage',
    'do-in-steps',
    'do-in-parallel',
    'do-in-worktrees',
    'do-competitively',
    'judge-with-debate',
]);

/**
 * Reuse the dispatcher's loader so the linter sees what the runtime sees.
 * The Python original calls `hooks.dispatch_hook._load_yaml`, which prefers
 * PyYAML (present in this environment) and falls back to a flat mini-parser
 * only when PyYAML is unavailable. Orchestration files use full nested YAML,
 * so the PyYAML path is the live one — `yaml` (npm) reproduces it.
 */
function _load_yaml(p: string): unknown {
    return parseYaml(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
}

function _ref_exists(kind: string, ref: string): boolean {
    if (kind === 'skill') {
        return resolve_logical(`skills/${ref}/SKILL.md`) !== null;
    }
    if (kind === 'command') {
        return resolve_logical(`commands/${ref}.md`) !== null;
    }
    if (kind === 'persona') {
        return resolve_logical(`personas/${ref}.md`) !== null;
    }
    if (kind === 'subagent') {
        return SUBAGENT_MODES.has(ref);
    }
    return false;
}

/** Yield [namespace, ident] for every ${{ ns.ident }} in a nested value. */
function* _walk_interpolations(value: unknown): Generator<[string, string]> {
    if (typeof value === 'string') {
        INTERP_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = INTERP_RE.exec(value)) !== null) {
            yield [m[1] as string, m[2] as string];
        }
    } else if (isPlainObject(value)) {
        for (const v of Object.values(value)) {
            yield* _walk_interpolations(v);
        }
    } else if (Array.isArray(value)) {
        for (const v of value) {
            yield* _walk_interpolations(v);
        }
    }
}

function _check_unknown_namespaces(value: unknown, p: string, errors: string[]): void {
    if (typeof value === 'string') {
        const re = /\$\{\{\s*([a-z]+)\./g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(value)) !== null) {
            const ns = m[1] as string;
            if (ns !== 'inputs' && ns !== 'steps') {
                errors.push(`${p}: unknown interpolation namespace '${ns}'`);
            }
        }
    } else if (isPlainObject(value)) {
        for (const [k, v] of Object.entries(value)) {
            _check_unknown_namespaces(v, `${p}.${k}`, errors);
        }
    } else if (Array.isArray(value)) {
        value.forEach((v, i) => _check_unknown_namespaces(v, `${p}[${i}]`, errors));
    }
}

function _check_steps(
    doc: Record<string, unknown>,
    inputIds: Set<string>,
    errors: string[],
): Set<string> {
    const steps = doc['steps'];
    if (!Array.isArray(steps) || !(steps.length >= MIN_STEPS && steps.length <= MAX_STEPS)) {
        errors.push(`steps: must be a list of ${MIN_STEPS}–${MAX_STEPS} entries`);
        return new Set();
    }
    const stepIds = new Set<string>();
    for (let i = 0; i < steps.length; i += 1) {
        const step = steps[i];
        if (!isPlainObject(step)) {
            errors.push(`steps[${i}]: must be a mapping`);
            continue;
        }
        const sid = step['id'];
        if (typeof sid !== 'string' || !STEP_ID_RE.test(sid)) {
            errors.push(`steps[${i}].id: must be snake-case identifier`);
            continue;
        }
        if (stepIds.has(sid)) {
            errors.push(`steps[${i}].id: duplicate id '${sid}'`);
            continue;
        }
        stepIds.add(sid);
        const kind = step['kind'];
        const ref = step['ref'];
        if (typeof kind !== 'string' || !VALID_KINDS.has(kind)) {
            errors.push(`steps.${sid}.kind: must be one of ${_sortedListRepr(VALID_KINDS)}`);
            continue;
        }
        if (typeof ref !== 'string' || !_ref_exists(kind, ref)) {
            errors.push(`steps.${sid}.ref: ${kind} '${_unwrap(ref)}' not found on disk`);
        }
        _check_unknown_namespaces(step['with'], `steps.${sid}.with`, errors);
        for (const [ns, ident] of _walk_interpolations(step['with'] ?? {})) {
            if (ns === 'inputs' && !inputIds.has(ident)) {
                errors.push(`steps.${sid}.with: unknown input '${ident}'`);
            }
            if (ns === 'steps' && !(stepIds.has(ident) && ident !== sid)) {
                errors.push(
                    `steps.${sid}.with: unknown step '${ident}' (forward ref or self)`,
                );
            }
        }
    }
    return stepIds;
}

function _check_outputs(
    doc: Record<string, unknown>,
    stepIds: Set<string>,
    inputIds: Set<string>,
    errors: string[],
): void {
    const outputs = doc['outputs'];
    if (outputs === null || outputs === undefined) {
        return;
    }
    if (!isPlainObject(outputs)) {
        errors.push('outputs: must be a mapping');
        return;
    }
    for (const [name, value] of Object.entries(outputs)) {
        for (const [ns, ident] of _walk_interpolations(value)) {
            if (ns === 'steps' && !stepIds.has(ident)) {
                errors.push(`outputs.${name}: unknown step '${ident}'`);
            }
            if (ns === 'inputs' && !inputIds.has(ident)) {
                errors.push(`outputs.${name}: unknown input '${ident}'`);
            }
        }
    }
}

function _check_inputs(doc: Record<string, unknown>, errors: string[]): Set<string> {
    const inputs = doc['inputs'] ?? [];
    if (!Array.isArray(inputs)) {
        errors.push('inputs: must be a list');
        return new Set();
    }
    const ids = new Set<string>();
    for (let i = 0; i < inputs.length; i += 1) {
        const inp = inputs[i];
        if (!isPlainObject(inp) || typeof inp['id'] !== 'string') {
            errors.push(`inputs[${i}]: must be a mapping with string 'id'`);
            continue;
        }
        const id = inp['id'] as string;
        if (ids.has(id)) {
            errors.push(`inputs[${i}].id: duplicate id '${id}'`);
        }
        ids.add(id);
    }
    return ids;
}

function lint(p: string): number {
    let doc: unknown;
    try {
        doc = _load_yaml(p);
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`lint_orchestration_dsl: load error: ${msg}\n`);
        return 2;
    }
    if (!isPlainObject(doc)) {
        process.stderr.write(`${p}: top-level must be a mapping\n`);
        return 1;
    }

    const errors: string[] = [];
    if (doc['schema_version'] !== 1) {
        errors.push('schema_version: must be 1');
    }
    const name = doc['name'];
    const stem = _stem(p);
    if (typeof name !== 'string' || !NAME_RE.test(name)) {
        errors.push('name: must be kebab-case starting with a letter');
    } else if (name !== stem) {
        errors.push(`name: '${name}' must match filename stem '${stem}'`);
    }
    const description = doc['description'];
    if (typeof description !== 'string' || !description.trim()) {
        errors.push('description: must be a non-empty string');
    }

    const inputIds = _check_inputs(doc, errors);
    const stepIds = _check_steps(doc, inputIds, errors);
    _check_outputs(doc, stepIds, inputIds, errors);

    for (const e of errors) {
        process.stderr.write(`error: ${p}: ${e}\n`);
    }
    return errors.length ? 1 : 0;
}

interface Args {
    dir: string;
    file: string | null;
}

function parse_args(argv: readonly string[]): Args {
    let dir = DEFAULT_DIR;
    let file: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] as string;
        if (arg === '--dir') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --dir: expected one argument');
            }
            dir = v;
        } else if (arg.startsWith('--dir=')) {
            dir = arg.slice('--dir='.length);
        } else if (arg === '--file') {
            const v = argv[++i];
            if (v === undefined) {
                _argparse_error('argument --file: expected one argument');
            }
            file = v;
        } else if (arg.startsWith('--file=')) {
            file = arg.slice('--file='.length);
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write(
                'usage: lint_orchestration_dsl [-h] [--dir DIR] [--file FILE]\n',
            );
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { dir, file };
}

function _argparse_error(message: string): never {
    process.stderr.write(`lint_orchestration_dsl: error: ${message}\n`);
    process.exit(2);
}

function main(argv?: readonly string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));
    if (args.file !== null) {
        return lint(args.file);
    }
    if (!_isDir(args.dir)) {
        return 0; // opt-in directory; absence is not a failure
    }
    let rc = 0;
    for (const p of _globYamlSorted(args.dir)) {
        rc = Math.max(rc, lint(p));
    }
    return rc;
}

// --- helpers --------------------------------------------------------------

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _globYamlSorted(dir: string): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return entries
        .filter((n) => n.endsWith('.yaml'))
        .map((n) => path.join(dir, n))
        .sort();
}

/** Mirror Python `Path(p).stem`. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Render a value embedded in `'${value}'` — None for null/undefined. */
function _unwrap(v: unknown): string {
    if (v === null || v === undefined) {
        return 'None';
    }
    return String(v);
}

/** Mirror Python `sorted(set)` repr as a list literal of single-quoted strings. */
function _sortedListRepr(s: Set<string>): string {
    return '[' + [...s].sort().map((x) => `'${x}'`).join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    DEFAULT_DIR,
    VALID_KINDS,
    SUBAGENT_MODES,
    _ref_exists,
    lint,
    parse_args,
    main,
};
