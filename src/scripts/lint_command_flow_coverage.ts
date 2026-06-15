#!/usr/bin/env tsx
/**
 * Command → flow coverage lint (the Flows primary view).
 *
 * TypeScript twin of `src/scripts/lint_command_flow_coverage.py` (ADR-200,
 * Phase 4 / Wave 4b). Mirrors the CLI contract EXACTLY — the `--quiet`
 * argparse flag, exit codes (0 clean, 1 violations, 3 internal error),
 * byte-identical stdout/stderr lines, the same violation ordering
 * (closed-set check, then bucket/duplicate scan in YAML order, then
 * sorted orphans, then sorted phantoms), and the same logical command refs
 * via the `_lib/agent_src` twin's `_iter_domains_commands`. No behaviour
 * changes.
 *
 * Asserts that `src/flows/surface-map.yaml` classifies EVERY command in the
 * source-of-truth command tree into exactly one flow / platform-surface
 * bucket.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { _iter_domains_commands } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SURFACE_MAP = path.join(ROOT, 'src', 'flows', 'surface-map.yaml');

// The closed user-work flow set.
const CLOSED_FLOWS = new Set(['discovery', 'implementation', 'review', 'delivery']);

/** Logical refs (`feature/plan`, `commit/in-chunks`) for every command. */
function _domains_command_refs(): Set<string> {
    const out = new Set<string>();
    for (const [, logical] of _iter_domains_commands()) {
        // logical[len("commands/"):-len(".md")]
        out.add(logical.slice('commands/'.length, logical.length - '.md'.length));
    }
    return out;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** POSIX relative path under ROOT. */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _load_map(): Record<string, unknown> {
    if (!_isFile(SURFACE_MAP)) {
        throw new FileNotFoundError(`missing ${_relTo(SURFACE_MAP, ROOT)}`);
    }
    const data = parseYaml(fs.readFileSync(SURFACE_MAP, 'utf-8'), { version: '1.1' });
    if (data === null || data === undefined || data === false || data === '') {
        return {};
    }
    return data as Record<string, unknown>;
}

class FileNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileNotFoundError';
    }
}

/** Python sorted() over strings (code-point order, matching default str sort). */
function _sorted(items: Iterable<string>): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function _pyListRepr(items: readonly string[]): string {
    return `[${items.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}]`;
}

interface ParsedArgs {
    quiet: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write('usage: lint_command_flow_coverage.py [-h] [--quiet]\n');
    process.stderr.write(`lint_command_flow_coverage.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_command_flow_coverage.py [-h] [--quiet]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { quiet };
}

export function main(): number {
    const args = parse_args(process.argv.slice(2));

    let data: Record<string, unknown>;
    let real: Set<string>;
    try {
        data = _load_map();
        real = _domains_command_refs();
    } catch (exc) {
        const msg = exc instanceof Error ? exc.message : String(exc);
        process.stderr.write(`lint_command_flow_coverage: internal error — ${msg}\n`);
        return 3;
    }

    const user_flows = new Set<string>(
        (Array.isArray(data['user_work_flows']) ? (data['user_work_flows'] as unknown[]) : [])
            .map((x) => String(x)),
    );
    const surfaces = new Set<string>(
        (Array.isArray(data['platform_surfaces']) ? (data['platform_surfaces'] as unknown[]) : [])
            .map((x) => String(x)),
    );
    const allowed = new Set<string>([...user_flows, ...surfaces]);
    const buckets =
        data['commands'] && typeof data['commands'] === 'object' && !Array.isArray(data['commands'])
            ? (data['commands'] as Record<string, unknown>)
            : {};

    const violations: string[] = [];

    // Check 4 — declared user-work flows match the closed set.
    if (!_setEq(user_flows, CLOSED_FLOWS)) {
        violations.push(
            `user_work_flows ${_pyListRepr(_sorted(user_flows))} != closed set ` +
                `${_pyListRepr(_sorted(CLOSED_FLOWS))} ` +
                '(a new user-work flow is an ADR-gated governance decision)',
        );
    }

    // Build the flat ref→bucket index; catch duplicates and bad buckets.
    const seen: Map<string, string> = new Map();
    for (const [bucket, refs] of Object.entries(buckets)) {
        if (!allowed.has(bucket)) {
            violations.push(`bucket '${bucket}' is not in user_work_flows ∪ platform_surfaces`);
        }
        const refList = Array.isArray(refs) ? (refs as unknown[]).map((x) => String(x)) : [];
        for (const ref of refList) {
            if (seen.has(ref)) {
                violations.push(`command '${ref}' classified twice: '${seen.get(ref)}' and '${bucket}'`);
            } else {
                seen.set(ref, bucket);
            }
        }
    }

    const mapped = new Set(seen.keys());

    // Check 1 — no orphan.
    for (const ref of _sorted(_setDiff(real, mapped))) {
        violations.push(`orphan: command '${ref}' has no flow/surface in surface-map.yaml`);
    }

    // Check 2 — no phantom.
    for (const ref of _sorted(_setDiff(mapped, real))) {
        violations.push(`phantom: surface-map ref '${ref}' backs no src/domains command`);
    }

    if (violations.length > 0) {
        process.stderr.write(
            `lint_command_flow_coverage: ${violations.length} violation(s) ` +
                `(${real.size} commands, ${mapped.size} mapped)\n`,
        );
        for (const v of violations) {
            process.stderr.write(`  ✗ ${v}\n`);
        }
        return 1;
    }

    if (!args.quiet) {
        // per = {b: len(r or []) for b, r in buckets.items()} — dict repr.
        const perEntries: string[] = [];
        for (const [b, r] of Object.entries(buckets)) {
            const n = Array.isArray(r) ? (r as unknown[]).length : 0;
            perEntries.push(`'${b}': ${n}`);
        }
        const per = `{${perEntries.join(', ')}}`;
        process.stdout.write(
            `lint_command_flow_coverage: OK — ${real.size} commands fully classified ` +
                `across ${Object.keys(buckets).length} buckets ${per}\n`,
        );
    }
    return 0;
}

function _setEq(a: Set<string>, b: Set<string>): boolean {
    if (a.size !== b.size) {
        return false;
    }
    for (const x of a) {
        if (!b.has(x)) {
            return false;
        }
    }
    return true;
}

function _setDiff(a: Set<string>, b: Set<string>): Set<string> {
    const out = new Set<string>();
    for (const x of a) {
        if (!b.has(x)) {
            out.add(x);
        }
    }
    return out;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, SURFACE_MAP, CLOSED_FLOWS };
