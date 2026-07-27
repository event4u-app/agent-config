/**
 * Offload detection — spike S0.5, road-to-scale-and-history-discipline
 * Phase 0. Deterministic pattern detection for:
 *
 *   F9  (R-A8)  — offloadable-catalog calls inside a request handler
 *   F11 (R-A10) — non-durable async for must-not-lose work (fire-and-forget,
 *                 sync listeners doing catalog work, dispatchAfterResponse /
 *                 shutdown hooks carrying must-not-lose jobs)
 *
 * Scope-aware: the same call inside a queued job/listener/worker is the FIX,
 * not the bug, and never fires. Waivers (`// sync-required: <reason>`,
 * `// accepted-loss: <reason>`) mark findings as waived per types.parse_waiver.
 * The catalog itself is config data in offload_catalog.ts.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { Finding } from './types.js';
import { parse_waiver, is_ignored_dir } from './types.js';
import { ELOQUENT_CATALOG, TS_CATALOG, MUST_NOT_LOSE_NAME_RE, type StackCatalog } from './offload_catalog.js';

export type Stack = 'eloquent' | 'ts';

export interface SourceFile {
    path: string;
    content: string;
}

interface Span {
    start: number; // 0-indexed inclusive
    end: number; // 0-indexed inclusive
}

// ------------------------------------------------------------ helpers

/** Blank comment bodies and string contents, preserving line structure. */
function mask_code(text: string): string {
    let out = '';
    let i = 0;
    let mode: 'code' | 'line' | 'block' | 's1' | 's2' | 'tpl' = 'code';
    while (i < text.length) {
        const c = text[i];
        const next = text[i + 1];
        if (mode === 'code') {
            if (c === '/' && next === '/') {
                mode = 'line';
                out += '//';
                i += 2;
                continue;
            }
            if (c === '/' && next === '*') {
                mode = 'block';
                out += '  ';
                i += 2;
                continue;
            }
            if (c === "'") mode = 's1';
            else if (c === '"') mode = 's2';
            else if (c === '`') mode = 'tpl';
            out += c;
            i += 1;
            continue;
        }
        if (mode === 'line') {
            if (c === '\n') mode = 'code';
            out += c === '\n' ? c : c; // keep line comments verbatim (waivers live here)
            i += 1;
            continue;
        }
        if (mode === 'block') {
            if (c === '*' && next === '/') {
                mode = 'code';
                out += '  ';
                i += 2;
                continue;
            }
            out += c === '\n' ? '\n' : ' ';
            i += 1;
            continue;
        }
        // strings: keep the protocol prefix visible for URL catalog patterns
        if ((mode === 's1' && c === "'") || (mode === 's2' && c === '"') || (mode === 'tpl' && c === '`')) {
            mode = 'code';
            out += c;
            i += 1;
            continue;
        }
        if (c === '\\') {
            out += '\\' + (next ?? '');
            i += 2;
            continue;
        }
        out += c === '\n' ? '\n' : c;
        i += 1;
        continue;
    }
    return out;
}

/**
 * Blank string CONTENTS (quotes stay) — for brace math only, so a `{id}`
 * inside a route path or template literal cannot corrupt scope spans.
 */
function blank_strings(text: string): string {
    let out = '';
    let mode: 'code' | 's1' | 's2' | 'tpl' | 'line' | 'block' = 'code';
    for (let i = 0; i < text.length; i += 1) {
        const c = text[i];
        const next = text[i + 1];
        if (mode === 'code') {
            if (c === '/' && next === '/') mode = 'line';
            else if (c === '/' && next === '*') mode = 'block';
            else if (c === "'") mode = 's1';
            else if (c === '"') mode = 's2';
            else if (c === '`') mode = 'tpl';
            out += c;
            continue;
        }
        if (mode === 'line') {
            if (c === '\n') mode = 'code';
            out += c;
            continue;
        }
        if (mode === 'block') {
            if (c === '*' && next === '/') {
                mode = 'code';
                out += '*';
                continue;
            }
            out += c === '\n' ? '\n' : ' ';
            continue;
        }
        if (c === '\\') {
            out += '  ';
            i += 1;
            continue;
        }
        if ((mode === 's1' && c === "'") || (mode === 's2' && c === '"') || (mode === 'tpl' && c === '`')) {
            mode = 'code';
            out += c;
            continue;
        }
        out += c === '\n' ? '\n' : ' ';
    }
    return out;
}

/** Find the span of the brace block opening at/after `from` (0-indexed line). */
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
        if (opened && depth === 0) return { start: from, end: i };
    }
    return opened ? { start: from, end: lines.length - 1 } : null;
}

function in_spans(line0: number, spans: Span[]): boolean {
    return spans.some((s) => line0 >= s.start && line0 <= s.end);
}

// ------------------------------------------------------------ PHP scopes

interface PhpScopes {
    handler_spans: Span[];
    queued_spans: Span[]; // ShouldQueue job/listener bodies — never fire
    sync_listener_spans: Span[]; // listener WITHOUT ShouldQueue — F11 on catalog work
}

function php_scopes(file: string, lines: string[]): PhpScopes {
    const text = lines.join('\n');
    const blanked = blank_strings(text).split('\n');
    const handler_spans: Span[] = [];
    const queued_spans: Span[] = [];
    const sync_listener_spans: Span[] = [];

    const is_controller_file =
        /Http[\\/]Controllers/.test(file) || /extends\s+Controller\b/.test(text);
    const is_listener_file = /namespace\s+App\\Listeners|[\\/]Listeners[\\/]/.test(file + '\n' + text);
    const is_job_file = /namespace\s+App\\Jobs|[\\/]Jobs[\\/]/.test(file + '\n' + text);

    for (let i = 0; i < lines.length; i += 1) {
        const l = lines[i]!;
        // Class bodies
        const cls = l.match(/\bclass\s+(\w+)/);
        if (cls) {
            const span = brace_span(blanked, i);
            if (!span) continue;
            const head = lines.slice(i, Math.min(i + 3, lines.length)).join(' ');
            const implements_queue = /implements[^{]*\bShouldQueue\b/.test(head);
            if (implements_queue) queued_spans.push(span);
            else if (is_listener_file) sync_listener_spans.push(span);
            else if (is_controller_file || /extends\s+Controller\b/.test(head)) handler_spans.push(span);
            else if (is_job_file) queued_spans.push(span); // non-queued job class: treated as worker context
        }
        // Route closures
        if (/Route::(get|post|put|patch|delete|any)\s*\(/.test(l) && /function\s*\(/.test(lines.slice(i, i + 2).join(' '))) {
            const span = brace_span(blanked, i);
            if (span) handler_spans.push(span);
        }
    }
    return { handler_spans, queued_spans, sync_listener_spans };
}

// ------------------------------------------------------------ TS scopes

interface TsScopes {
    handler_spans: Span[];
    worker: boolean; // whole file is worker/queue context
}

function ts_scopes(file: string, lines: string[]): TsScopes {
    const text = lines.join('\n');
    const blanked = blank_strings(text).split('\n');
    const worker =
        /[\\/](workers?|queues?|jobs|consumers?)[\\/]/.test(file) ||
        /new\s+Worker\s*\(/.test(text) ||
        /[\\/]scripts[\\/]/.test(file);
    const handler_spans: Span[] = [];
    if (!worker) {
        for (let i = 0; i < lines.length; i += 1) {
            const l = lines[i]!;
            if (
                /\b(app|router|fastify)\.(get|post|put|patch|delete|all)\s*\(/.test(l) ||
                /export\s+(default\s+)?async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(l) ||
                /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=/.test(l)
            ) {
                const span = brace_span(blanked, i);
                if (span) handler_spans.push(span);
            }
        }
    }
    return { handler_spans, worker };
}

// ------------------------------------------------------------ detection

function make_finding(
    file: string,
    lines: string[],
    line0: number,
    failure_class: 'F9' | 'F11',
    rule: 'R-A8' | 'R-A10',
    message: string,
): Finding {
    const waiver = parse_waiver(lines, line0);
    return {
        failure_class,
        rule,
        file,
        line: line0 + 1,
        message,
        tier: 'gate',
        ...(waiver ? { waived: true, waiver_reason: waiver.reason } : {}),
    };
}

function detect_php(file: SourceFile, catalog: StackCatalog): Finding[] {
    const lines = file.content.split('\n');
    const masked_lines = mask_code(file.content).split('\n');
    const scopes = php_scopes(file.path, lines);
    const findings: Finding[] = [];

    const catalog_hit = (l: string): { label: string; must_not_lose: boolean } | null => {
        for (const alt of catalog.allowed_alternatives) {
            if (new RegExp(alt).test(l)) return null;
        }
        for (const entry of catalog.offloadable) {
            if (new RegExp(entry.pattern).test(l)) return entry;
        }
        return null;
    };

    for (let i = 0; i < masked_lines.length; i += 1) {
        const l = masked_lines[i]!;
        if (in_spans(i, scopes.queued_spans)) continue;

        const in_handler = in_spans(i, scopes.handler_spans);
        const in_sync_listener = in_spans(i, scopes.sync_listener_spans);
        if (!in_handler && !in_sync_listener) continue;

        // Notification::send — queued when the notification class (in-file)
        // implements ShouldQueue; conservative skip when the class is unknown.
        if (/Notification(Facade)?::send\s*\(/.test(l)) {
            const cls = l.match(/new\s+(\w+)\s*\(/);
            const queued =
                !cls ||
                new RegExp(String.raw`class\s+${cls[1]}[^{]*implements[^{]*ShouldQueue`).test(
                    file.content,
                );
            if (!queued) {
                findings.push(
                    make_finding(file.path, lines, i, 'F9', 'R-A8', 'synchronous notification send in request handler — queue it (ShouldQueue)'),
                );
            }
            continue;
        }

        const hit = catalog_hit(l);
        if (hit) {
            if (in_sync_listener) {
                findings.push(
                    make_finding(file.path, lines, i, 'F11', 'R-A10', `${hit.label} in a NON-queued listener — runs synchronously in the firing request; implement ShouldQueue`),
                );
            } else {
                findings.push(
                    make_finding(file.path, lines, i, 'F9', 'R-A8', `${hit.label} in request handler — offload to a queued job (validate → persist → dispatch → respond)`),
                );
            }
            continue;
        }

        if (in_handler) {
            // Unbounded bulk mutation: ::query()->update( without a ->where( in the chain.
            if (/::query\(\)\s*->\s*update\s*\(/.test(l) && !/->\s*where/.test(l)) {
                findings.push(
                    make_finding(file.path, lines, i, 'F9', 'R-A8', 'unbounded bulk mutation over a whole table in the handler — offload or bound it'),
                );
                continue;
            }
            // dispatchAfterResponse for must-not-lose job classes.
            const dar = l.match(/\b(\w+)::dispatchAfterResponse\s*\(/);
            if (dar && MUST_NOT_LOSE_NAME_RE.test(dar[1]!)) {
                findings.push(
                    make_finding(file.path, lines, i, 'F11', 'R-A10', `dispatchAfterResponse(${dar[1]}) — in-process after-response work is lost on process kill; use a durable queue`),
                );
                continue;
            }
            // register_shutdown_function carrying catalog work.
            if (/register_shutdown_function\s*\(/.test(l)) {
                const span = brace_span(masked_lines, i) ?? { start: i, end: Math.min(i + 10, masked_lines.length - 1) };
                const body = masked_lines.slice(span.start, span.end + 1).join('\n');
                const inner = catalog.offloadable.find((e) => new RegExp(e.pattern).test(body));
                if (inner) {
                    findings.push(
                        make_finding(file.path, lines, i, 'F11', 'R-A10', `${inner.label} inside a shutdown hook — silently lost on process kill; use a durable queue`),
                    );
                }
            }
        }
    }
    return findings;
}

function detect_ts(file: SourceFile, catalog: StackCatalog): Finding[] {
    const lines = file.content.split('\n');
    const masked_lines = mask_code(file.content).split('\n');
    const scopes = ts_scopes(file.path, lines);
    if (scopes.worker) return [];
    const findings: Finding[] = [];

    for (let i = 0; i < masked_lines.length; i += 1) {
        if (!in_spans(i, scopes.handler_spans)) continue;
        const l = masked_lines[i]!;

        let allowed = false;
        for (const alt of catalog.allowed_alternatives) {
            if (new RegExp(alt).test(l)) {
                allowed = true;
                break;
            }
        }
        if (allowed) continue;

        // setTimeout/setImmediate background work carrying catalog calls.
        if (/\b(setTimeout|setImmediate)\s*\(/.test(l)) {
            const span = brace_span(masked_lines, i) ?? { start: i, end: Math.min(i + 10, masked_lines.length - 1) };
            const body = masked_lines.slice(span.start, span.end + 1).join('\n');
            const inner = catalog.offloadable.find(
                (e) => e.must_not_lose && new RegExp(e.pattern).test(body),
            );
            if (inner) {
                findings.push(
                    make_finding(file.path, lines, i, 'F11', 'R-A10', `${inner.label} inside setTimeout — in-process fire-and-forget is lost on process kill; use a durable queue`),
                );
                continue;
            }
        }

        const hit = catalog.offloadable.find((e) => new RegExp(e.pattern).test(l));
        if (!hit) continue;

        // Unbounded updateMany: no `where` on the same statement line.
        if (hit.label === 'unbounded bulk mutation' && /where\s*:/.test(l)) continue;

        const fire_and_forget =
            hit.must_not_lose &&
            !/\bawait\b/.test(l) &&
            !/\breturn\b/.test(l) &&
            !/\.then\s*\(/.test(l) &&
            !/=\s*\w/.test(l.split(l.match(new RegExp(hit.pattern))?.[0] ?? '')[0] ?? '');

        if (fire_and_forget) {
            findings.push(
                make_finding(file.path, lines, i, 'F11', 'R-A10', `un-awaited ${hit.label} in request handler — fire-and-forget must-not-lose work; use a durable queue`),
            );
        } else {
            findings.push(
                make_finding(file.path, lines, i, 'F9', 'R-A8', `${hit.label} in request handler — offload to a queued job (validate → persist → dispatch → respond)`),
            );
        }
    }
    return findings;
}

// ------------------------------------------------------------ public API

export function detect_offload(files: SourceFile[], stack: Stack): Finding[] {
    const catalog = stack === 'eloquent' ? ELOQUENT_CATALOG : TS_CATALOG;
    const out: Finding[] = [];
    for (const f of files) {
        out.push(...(stack === 'eloquent' ? detect_php(f, catalog) : detect_ts(f, catalog)));
    }
    return out;
}

export function scan_dir(dir: string, stack: Stack): Finding[] {
    const files: SourceFile[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                if (!is_ignored_dir(e.name)) walk(p);
            }
            else if (stack === 'eloquent' ? p.endsWith('.php') : /\.(ts|js|mjs)$/.test(p)) {
                files.push({ path: p, content: fs.readFileSync(p, 'utf8') });
            }
        }
    };
    walk(dir);
    return detect_offload(files, stack);
}
