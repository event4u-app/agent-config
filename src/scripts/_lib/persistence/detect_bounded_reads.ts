/**
 * R-A3 bounded-reads (F3) + R-A9 event-decoupling heuristic (F10, ADVICE) —
 * road-to-scale-and-history-discipline Phase 2.
 *
 * R-A3 (gate) fires on two narrow, pattern-detectable shapes:
 *   1. `SELECT *` inside a raw query string in production PHP paths.
 *   2. A list-shaped controller method (`index` / `list*` / `all*`) that
 *      returns an UNBOUNDED Eloquent read — `Model::all()` or a builder
 *      chain ending in `->get()` with no `paginate` / `simplePaginate` /
 *      `cursorPaginate` / `limit` / `take` in the chain — directly in the
 *      response path.
 *
 * Anything wider (a bounded `get()` fed from a filtered scope, collections
 * post-processed in memory) is contextual and NOT flagged — the waiver
 * model applies (`// unbounded-ok` is intentionally NOT offered; bound the
 * read or paginate).
 *
 * R-A9 (advice, never gate): a handler body touching ≥3 distinct
 * side-effect domains (mail, http, notification, cache, log, storage,
 * event-dispatch) suggests the mutating call site is enumerating its
 * consumers — recommend observer/event + queued listeners.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from './types.js';
import { is_ignored_dir } from './types.js';

interface Span {
    start: number;
    end: number;
}

function brace_span(lines: string[], from: number): Span | null {
    let depth = 0;
    let opened = false;
    for (let i = from; i < lines.length; i += 1) {
        for (const ch of lines[i]!) {
            if (ch === '{') {
                depth += 1;
                opened = true;
            } else if (ch === '}') {
                depth -= 1;
                if (opened && depth === 0) return { start: from, end: i };
            }
        }
    }
    return null;
}

const LIST_METHOD_RE = /function\s+(index|list\w*|all\w*)\s*\(/;
const UNBOUNDED_ALL_RE = /\b[A-Z]\w+::all\s*\(\s*\)/;
const GET_CHAIN_RE = /->\s*get\s*\(\s*\)/;
const BOUND_RE = /paginate|simplePaginate|cursorPaginate|->\s*limit\s*\(|->\s*take\s*\(|->\s*first\s*\(/;

const SIDE_EFFECT_DOMAINS: Array<[string, RegExp]> = [
    ['mail', /\bMail::|\bNotification(Facade)?::send/],
    ['http', /\bHttp::/],
    ['cache', /\bCache::(put|forget|forever)/],
    ['log', /\bLog::(info|warning|error|debug)/],
    ['storage', /\bStorage::(put|delete|move)/],
    ['event', /\bevent\s*\(|\bEvent::dispatch/],
    ['sms', /\bTwilio|\bVonage/],
];

export function detect_bounded_reads(files: Array<{ path: string; content: string }>): Finding[] {
    const findings: Finding[] = [];
    for (const f of files) {
        const lines = f.content.split('\n');
        const is_controller =
            /Http[\\/]Controllers/.test(f.path) || /extends\s+Controller\b/.test(f.content);

        for (let i = 0; i < lines.length; i += 1) {
            const l = lines[i]!;

            // R-A3.1 — SELECT * in raw SQL strings (any production PHP file).
            if (/['"]\s*SELECT\s+\*\s+FROM\b/i.test(l) && !/limit\s+\d/i.test(l)) {
                findings.push({
                    failure_class: 'F3',
                    rule: 'R-A3',
                    file: f.path,
                    line: i + 1,
                    message: 'SELECT * in raw query — select the needed columns and bound the read',
                    tier: 'gate',
                });
                continue;
            }

            if (!is_controller) continue;

            // R-A3.2 — unbounded reads in list-shaped controller methods.
            const m = l.match(LIST_METHOD_RE);
            if (!m) continue;
            const span = brace_span(lines, i);
            if (!span) continue;
            for (let j = span.start; j <= span.end; j += 1) {
                const body_line = lines[j]!;
                if (BOUND_RE.test(body_line)) continue;
                if (UNBOUNDED_ALL_RE.test(body_line) || (GET_CHAIN_RE.test(body_line) && !BOUND_RE.test(body_line))) {
                    // The chain may be bounded on an earlier line of the same statement.
                    const stmt_window = lines.slice(Math.max(span.start, j - 3), j + 1).join(' ');
                    if (BOUND_RE.test(stmt_window)) continue;
                    findings.push({
                        failure_class: 'F3',
                        rule: 'R-A3',
                        file: f.path,
                        line: j + 1,
                        message: `unbounded read in list endpoint \`${m[1]}\` — paginate or declare a bound`,
                        tier: 'gate',
                    });
                }
            }
        }

        // R-A9 — side-effect fan-out heuristic (advice tier, controllers only).
        if (is_controller) {
            for (let i = 0; i < lines.length; i += 1) {
                const fn = lines[i]!.match(/function\s+(\w+)\s*\(/);
                if (!fn) continue;
                const span = brace_span(lines, i);
                if (!span) continue;
                const body = lines.slice(span.start, span.end + 1).join('\n');
                const domains = SIDE_EFFECT_DOMAINS.filter(([, re]) => re.test(body)).map(([d]) => d);
                if (domains.length >= 3) {
                    findings.push({
                        failure_class: 'F3', // reported under the pack umbrella; message names F10
                        rule: 'R-A9',
                        file: f.path,
                        line: i + 1,
                        message: `handler \`${fn[1]}\` fans out to ${domains.length} side-effect domains (${domains.join(', ')}) — consider a domain event + queued listeners (F10 heuristic)`,
                        tier: 'advice',
                    });
                }
                i = span.end;
            }
        }
    }
    return findings;
}

export function scan_dir(dir: string): Finding[] {
    const files: Array<{ path: string; content: string }> = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                if (!is_ignored_dir(e.name)) walk(p);
            }
            else if (p.endsWith('.php')) files.push({ path: p, content: fs.readFileSync(p, 'utf8') });
        }
    };
    walk(dir);
    return detect_bounded_reads(files);
}
