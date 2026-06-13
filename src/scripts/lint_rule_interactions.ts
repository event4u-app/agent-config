#!/usr/bin/env tsx
/**
 * Lint docs/contracts/rule-interactions.yml.
 *
 * TypeScript twin of `src/scripts/lint_rule_interactions.py` (ADR-092,
 * Phase 4 / Wave 4b). Mirrors the CLI contract EXACTLY — the `--quiet`
 * flag is a bare `sys.argv` membership check (NOT argparse, so there is no
 * real `-h`/`--help`), exit codes (1 on any failure, 0 clean), the
 * `fail()` path prints the issue block to STDOUT (Python `print`) then
 * exits 1, byte-identical messages and ordering, and rule/evidence
 * resolution via the `_lib/agent_src` twin. No behaviour changes.
 *
 * Validates schema, rule existence, declared-rule membership, allowed
 * relations, evidence-path existence, unique pair ids, and the required
 * anchor pairs for `non-destructive-by-default`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { resolve_logical, strip_source_prefix } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const MATRIX = path.join(ROOT, 'docs', 'contracts', 'rule-interactions.yml');

/** Mirror `QUIET = "--quiet" in sys.argv` (computed at import). */
const QUIET = process.argv.slice(2).includes('--quiet');

const ALLOWED_RELATIONS = new Set([
    'overrides',
    'narrows',
    'defers_to',
    'restates',
    'gates',
    'complements',
]);

const REQUIRED_PAIR_FIELDS = ['id', 'rules', 'relation', 'conflict', 'resolution', 'evidence'];

const ANCHOR_PARTNERS = new Set([
    'autonomous-execution',
    'scope-control',
    'commit-policy',
    'ask-when-uncertain',
    'verify-before-complete',
]);
const ANCHOR_RULE = 'non-destructive-by-default';

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _rule_exists(slug: string): boolean {
    return resolve_logical(`rules/${slug}.md`) !== null;
}

function _evidence_exists(file_part: string): boolean {
    const logical = strip_source_prefix(file_part);
    if (logical !== null) {
        return resolve_logical(logical) !== null;
    }
    return _exists(path.join(ROOT, file_part));
}

/** POSIX relative path under ROOT. */
function _relTo(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

function _isPlainDict(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Python repr of a value used inside the error strings. */
function _pyRepr(v: unknown): string {
    if (typeof v === 'string') {
        if (v.includes("'") && !v.includes('"')) {
            return `"${v.replace(/\\/g, '\\\\')}"`;
        }
        return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    if (v === null || v === undefined) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    return String(v);
}

/** sorted(list-of-strings). */
function _sorted(items: Iterable<string>): string[] {
    return [...items].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function _pyListRepr(items: readonly string[]): string {
    return `[${items.map((s) => _pyRepr(s)).join(', ')}]`;
}

/** Thrown to mirror `fail(errors)` → print block to stdout + SystemExit(1). */
class FailExit extends Error {
    constructor(public readonly errors: string[]) {
        super('fail');
        this.name = 'FailExit';
    }
}

function fail(errors: string[]): never {
    process.stdout.write(`❌  rule-interactions.yml — ${errors.length} issue(s):\n`);
    for (const e of errors) {
        process.stdout.write(`  • ${e}\n`);
    }
    throw new FailExit(errors);
}

function _run(): number {
    if (!_exists(MATRIX)) {
        fail([`${_relTo(MATRIX, ROOT)} is missing`]);
    }

    const data = parseYaml(fs.readFileSync(MATRIX, 'utf-8'), { version: '1.1' });
    const errors: string[] = [];

    if (!_isPlainDict(data)) {
        fail(['top-level YAML must be a mapping']);
    }

    if (data['version'] !== 1) {
        errors.push('version must be 1');
    }

    const declared_rules_raw = data['rules'] ?? [];
    const declared_rules = Array.isArray(declared_rules_raw) ? (declared_rules_raw as unknown[]) : [];
    if (!Array.isArray(declared_rules_raw) || declared_rules.length === 0) {
        errors.push('`rules:` must be a non-empty list of slugs');
    }

    for (const slug of declared_rules) {
        if (typeof slug !== 'string') {
            errors.push(`rule slug not a string: ${_pyRepr(slug)}`);
            continue;
        }
        if (!_rule_exists(slug)) {
            errors.push(`rule slug \`${slug}\` has no file under any source root (rules/${slug}.md)`);
        }
    }

    const pairs_raw = data['pairs'] ?? [];
    const pairs = Array.isArray(pairs_raw) ? (pairs_raw as unknown[]) : [];
    if (!Array.isArray(pairs_raw) || pairs.length === 0) {
        errors.push('`pairs:` must be a non-empty list');
    }

    const seen_ids = new Set<string>();
    const declared_set = new Set<string>(
        Array.isArray(declared_rules_raw)
            ? declared_rules.filter((r): r is string => typeof r === 'string')
            : [],
    );
    // Note: Python builds declared_set from the raw list (which may contain
    // non-strings); membership checks below use JS Set with string entries.
    const declared_set_all = new Set<unknown>(Array.isArray(declared_rules_raw) ? declared_rules : []);
    const anchor_partners_seen = new Set<string>();

    for (let idx = 0; idx < pairs.length; idx++) {
        const pair = pairs[idx];
        if (!_isPlainDict(pair)) {
            errors.push(`pair[${idx}] is not a mapping`);
            continue;
        }
        const missing = REQUIRED_PAIR_FIELDS.filter((f) => !(f in pair));
        if (missing.length > 0) {
            errors.push(`pair[${idx}] missing fields: ${_pyListRepr(_sorted(missing))}`);
            continue;
        }

        const pid = pair['id'];
        const pidStr = String(pid);
        if (seen_ids.has(pidStr)) {
            errors.push(`duplicate pair id: ${pidStr}`);
        }
        seen_ids.add(pidStr);

        const rules_pair = pair['rules'];
        if (!(Array.isArray(rules_pair) && rules_pair.length === 2)) {
            errors.push(`pair \`${pidStr}\` rules must be a 2-element list`);
            continue;
        }
        for (const r of rules_pair as unknown[]) {
            if (!declared_set_all.has(r)) {
                errors.push(`pair \`${pidStr}\` references undeclared rule \`${r}\``);
            }
        }

        const relation = pair['relation'];
        if (!ALLOWED_RELATIONS.has(relation as string)) {
            errors.push(
                `pair \`${pidStr}\` relation \`${relation}\` not in ${_pyListRepr(_sorted(ALLOWED_RELATIONS))}`,
            );
        }

        const evidence_raw = pair['evidence'] ?? [];
        const evidence = Array.isArray(evidence_raw) ? (evidence_raw as unknown[]) : [];
        if (!Array.isArray(evidence_raw) || evidence.length === 0) {
            errors.push(`pair \`${pidStr}\` evidence must be a non-empty list`);
        }
        for (const citation of evidence) {
            if (typeof citation !== 'string') {
                errors.push(`pair \`${pidStr}\` evidence item not a string: ${_pyRepr(citation)}`);
                continue;
            }
            const file_part = citation.split('#')[0] as string;
            if (!_evidence_exists(file_part)) {
                errors.push(`pair \`${pidStr}\` evidence path does not exist: ${file_part}`);
            }
        }

        // Anchor coverage check
        if ((rules_pair as unknown[]).includes(ANCHOR_RULE)) {
            const partner = (rules_pair as unknown[]).find((r) => r !== ANCHOR_RULE);
            if (typeof partner === 'string' && ANCHOR_PARTNERS.has(partner)) {
                anchor_partners_seen.add(partner);
            }
        }
    }

    const missing_anchors = _setDiff(ANCHOR_PARTNERS, anchor_partners_seen);
    if (missing_anchors.size > 0) {
        errors.push(
            `anchor pairs missing for \`${ANCHOR_RULE}\` × ${_pyListRepr(_sorted(missing_anchors))} ` +
                '(required by road-to-post-pr29-optimize.md P2.2)',
        );
    }

    if (errors.length > 0) {
        fail(errors);
    }

    if (!QUIET) {
        process.stdout.write(
            `✅  rule-interactions.yml clean — ${declared_rules.length} rules, ${pairs.length} pairs.\n`,
        );
    }
    return 0;
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

export function main(): number {
    try {
        return _run();
    } catch (e) {
        if (e instanceof FailExit) {
            return 1;
        }
        throw e;
    }
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export { ROOT, MATRIX, ALLOWED_RELATIONS, REQUIRED_PAIR_FIELDS, ANCHOR_PARTNERS, ANCHOR_RULE };
