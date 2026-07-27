/**
 * detect_n1_eloquent — deterministic N+1 pattern detection for Laravel/Eloquent PHP.
 *
 * Falsification spike S0.1 of the road-to-scale-and-history-discipline roadmap.
 * Failure class F1 (N+1 queries), rule R-A1, tier gate.
 *
 * Approach: lightweight line/brace scanning, no PHP AST. A foreach loop is
 * suspicious when its iterable derives from an Eloquent/DB query source
 * (::all(), ->get(), ->cursor(), DB::table(...)->get()) WITHOUT eager loading
 * (->with(...) on the source chain, or a ->load(...) call on the variable
 * before the loop). Inside such a loop, we flag:
 *   - static query calls (Model::find/where/..., DB::table(...))
 *   - lazy relation access on the loop variable (chained property access,
 *     count($var->rel), relation-method calls chained into query methods,
 *     foreach over $var->rel)
 *
 * NOT flagged (by construction): iterables from ->with()/->load(), constant
 * array literals (bounded loops), chunk() callbacks (unknown-source iterables
 * are skipped), whereIn-prefetch keyed lookups, plain scalar attribute access,
 * and chained access to known non-relation attributes (Carbon dates).
 *
 * Deterministic pattern detection only — instance-level correctness is handled
 * by the waiver process (see types.ts), never by this scanner claiming
 * judgment it does not have.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse_waiver, type Finding } from './types.js';
import { is_ignored_dir } from './types.js';

export interface FileInput {
    path: string;
    content: string;
}

/** Attributes commonly chained without being relations (Carbon casts etc.). */
const NON_RELATION_ATTRS = new Set([
    'created_at',
    'updated_at',
    'deleted_at',
    'published_at',
    'email_verified_at',
    'pivot',
]);

/** Query methods that, chained onto a relation method call, execute a query. */
const QUERY_CHAIN_METHODS = 'get|first|count|pluck|sum|avg|min|max|exists|paginate|value';

/** Static entry points on a model class that build/execute a query. */
const STATIC_QUERY_RE =
    /\b[A-Z]\w*::(?:find|findOrFail|where|whereIn|firstWhere|first|all|query|count|pluck|exists|sum)\s*\(/;
const DB_TABLE_RE = /\bDB::table\s*\(/;

/** Strip line comments and quoted string contents so braces/parens scan cleanly. */
function strip_noise(line: string): string {
    return line
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/\/\/.*$/, '');
}

type SourceKind = 'query' | 'eager-query' | 'constant' | 'other';

/** Classify a right-hand-side expression as a query source (eager or not). */
function classify_expr(expr: string): SourceKind {
    const e = expr.trim();
    if (e.startsWith('[')) return 'constant';
    const is_query =
        /\b[A-Z]\w*::(?:all|cursor)\s*\(\s*\)/.test(e) ||
        ((/^[A-Z]\w*::/.test(e) || DB_TABLE_RE.test(e)) && /->(?:get|cursor)\s*\(\s*\)/.test(e));
    if (!is_query) return 'other';
    return /(?:::|->)with\s*\(/.test(e) ? 'eager-query' : 'query';
}

/** Find the line index of the matching close brace for a block opening at open_idx. */
function find_block_end(lines: string[], open_idx: number): number {
    let depth = 0;
    let opened = false;
    for (let i = open_idx; i < lines.length; i++) {
        const clean = strip_noise(lines[i]!);
        for (const ch of clean) {
            if (ch === '{') {
                depth++;
                opened = true;
            } else if (ch === '}') {
                depth--;
                if (opened && depth === 0) return i;
            }
        }
    }
    return lines.length - 1;
}

interface InnerHit {
    line_idx: number;
    detail: string;
}

/** Scan a loop body for per-iteration query patterns relative to the loop variable. */
function scan_loop_body(lines: string[], start: number, end: number, loop_var: string): InnerHit[] {
    const hits: InnerHit[] = [];
    const v = loop_var.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lazy_chain_re = new RegExp(`\\$${v}->(\\w+)(?!\\s*\\()->`);
    const count_lazy_re = new RegExp(`\\bcount\\(\\s*\\$${v}->(\\w+)\\s*\\)`);
    const relation_method_query_re = new RegExp(
        `\\$${v}->\\w+\\(\\)\\s*->\\s*(?:${QUERY_CHAIN_METHODS})\\s*\\(`,
    );
    const foreach_lazy_re = new RegExp(`foreach\\s*\\(\\s*\\$${v}->(\\w+)`);

    for (let i = start; i <= end; i++) {
        const clean = strip_noise(lines[i]!);

        if (STATIC_QUERY_RE.test(clean) || DB_TABLE_RE.test(clean)) {
            hits.push({ line_idx: i, detail: 'query call inside loop body' });
            continue;
        }
        const chain = clean.match(lazy_chain_re);
        if (chain && chain[1] && !NON_RELATION_ATTRS.has(chain[1])) {
            hits.push({
                line_idx: i,
                detail: `lazy relation access $${loop_var}->${chain[1]} inside loop body`,
            });
            continue;
        }
        const counted = clean.match(count_lazy_re);
        if (counted && counted[1] && !NON_RELATION_ATTRS.has(counted[1])) {
            hits.push({
                line_idx: i,
                detail: `count() over lazy relation $${loop_var}->${counted[1]} inside loop body`,
            });
            continue;
        }
        if (relation_method_query_re.test(clean)) {
            hits.push({
                line_idx: i,
                detail: `relation-method query on $${loop_var} inside loop body`,
            });
            continue;
        }
        const inner_iter = clean.match(foreach_lazy_re);
        if (inner_iter && inner_iter[1] && !NON_RELATION_ATTRS.has(inner_iter[1])) {
            hits.push({
                line_idx: i,
                detail: `iteration over lazy relation $${loop_var}->${inner_iter[1]}`,
            });
        }
    }
    return hits;
}

/** Detect N+1 query patterns in the given PHP files. Returns F1 gate findings. */
export function detect_n1(files: FileInput[]): Finding[] {
    const findings: Finding[] = [];

    for (const { path, content } of files) {
        const lines = content.split('\n');

        // Pass 1 — track variable sources: assignments + ->load() eager upgrades.
        const sources = new Map<string, SourceKind>();
        for (const raw of lines) {
            const clean = strip_noise(raw);
            const assign = clean.match(/^\s*\$(\w+)\s*=\s*(.+);\s*$/);
            if (assign) {
                sources.set(assign[1]!, classify_expr(assign[2]!));
                continue;
            }
            const loaded = clean.match(/^\s*\$(\w+)->load(?:Missing)?\s*\(/);
            if (loaded && sources.get(loaded[1]!) === 'query') {
                sources.set(loaded[1]!, 'eager-query');
            }
        }

        // Pass 2 — analyze foreach loops whose iterable is a non-eager query source.
        for (let i = 0; i < lines.length; i++) {
            const clean = strip_noise(lines[i]!);
            const fe = clean.match(/foreach\s*\(\s*(.+?)\s+as\s+(?:\$\w+\s*=>\s*)?\$(\w+)\s*\)/);
            if (!fe) continue;

            const [, src_expr, loop_var] = fe;
            const var_ref = src_expr!.trim().match(/^\$(\w+)$/);
            const kind: SourceKind = var_ref
                ? (sources.get(var_ref[1]!) ?? 'other')
                : classify_expr(src_expr!);
            if (kind !== 'query') continue;

            const body_end = find_block_end(lines, i);
            for (const hit of scan_loop_body(lines, i + 1, body_end, loop_var!)) {
                const finding: Finding = {
                    failure_class: 'F1',
                    rule: 'R-A1',
                    file: path,
                    line: hit.line_idx + 1,
                    message: `N+1: ${hit.detail}; iterable ${src_expr!.trim()} is a non-eager query result`,
                    tier: 'gate',
                };
                const waiver = parse_waiver(lines, hit.line_idx);
                if (waiver) {
                    finding.waived = true;
                    finding.waiver_reason = waiver.reason;
                }
                findings.push(finding);
            }
        }
    }

    return findings;
}

/** Convenience: recursively scan a directory for .php files and run detect_n1. */
export function scan_dir(dir: string): Finding[] {
    const files: FileInput[] = [];
    const walk = (d: string): void => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
            const full = join(d, entry.name);
            if (entry.isDirectory()) {
                if (!is_ignored_dir(entry.name)) walk(full);
            }
            else if (entry.name.endsWith('.php')) {
                files.push({ path: relative(process.cwd(), full), content: readFileSync(full, 'utf8') });
            }
        }
    };
    walk(dir);
    return detect_n1(files);
}
