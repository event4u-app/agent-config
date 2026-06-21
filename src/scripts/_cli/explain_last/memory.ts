/**
 * Resolve the `memory` why-slot for the trace.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/memory.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same two sources, same
 * coercion order, same `float()` semantics, same `None`-on-empty branch.
 * No behaviour changes.
 *
 * Two sources are consulted:
 *
 * - `state.memory[]` — the work-engine writes per-run memory hits here
 *   during the `memory` step. Each entry carries `{entry_id, hit_score,
 *   used_in}` already shaped to the trace contract.
 * - `<root>/.agent-memory/hits.jsonl` — optional sidecar produced by the
 *   memory-MCP integration. Filtered to entries tagged with the run id
 *   when present.
 *
 * Returns `null` when neither source produced a non-empty list (the schema
 * accepts a null memory slot so the renderer can drop the section cleanly).
 *
 * Parity note (ADR-200): Python's `hit_score = float(...)` always yields a
 * `float`, even for integer inputs, so `json.dumps` renders `0.0` not `0`.
 * The twin carries it as a `PyFloat` marker so the downstream JSON
 * serializer (and the section renderer's `:.2f`) stays byte-identical.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { scrub_string } from './scrubber.js';

/**
 * Marker for a Python `float`. JS has no int/float distinction; a
 * `PyFloat` makes `json.dumps` render integer-valued floats as `N.0`.
 * Mirrors the established convention in the migrated scripts.
 */
export class PyFloat {
    constructor(readonly value: number) {}
}

const MEMORY_SIDECAR = path.join('.agent-memory', 'hits.jsonl');

/** Python truthiness (empty string / 0 / null / empty container falsy). */
function _pyTruthy(value: unknown): boolean {
    if (value === null || value === undefined) {
        return false;
    }
    if (typeof value === 'string') {
        return value.length > 0;
    }
    if (typeof value === 'number') {
        return value !== 0 && !Number.isNaN(value);
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'object') {
        return Object.keys(value as object).length > 0;
    }
    return true;
}

/** Python `float()` — `TypeError`/`ValueError` paths return `null` (→ 0.0 fallback). */
function _coerceFloat(value: unknown): number | null {
    if (typeof value === 'number') {
        return value;
    }
    if (typeof value === 'boolean') {
        return value ? 1.0 : 0.0; // float(True)=1.0, float(False)=0.0
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') {
            return null;
        }
        const lowered = trimmed.toLowerCase();
        if (['inf', 'infinity', '+inf', '+infinity'].includes(lowered)) {
            return Infinity;
        }
        if (['-inf', '-infinity'].includes(lowered)) {
            return -Infinity;
        }
        if (['nan', '+nan', '-nan'].includes(lowered)) {
            return NaN;
        }
        if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(trimmed)) {
            return null;
        }
        const n = Number(trimmed);
        return Number.isNaN(n) ? null : n;
    }
    return null; // dict/list/None → TypeError → fallback
}

function _coerce_entry(raw: Record<string, unknown>): Record<string, unknown> | null {
    // entry_id = raw.get("entry_id") or raw.get("id")
    const entry_id = _pyTruthy(raw.entry_id) ? raw.entry_id : (raw.id ?? null);
    if (typeof entry_id !== 'string' || entry_id.trim() === '') {
        return null;
    }
    // hit_score = raw.get("hit_score"); if None: hit_score = raw.get("score", 0.0)
    let hitRaw: unknown = raw.hit_score ?? null;
    if (hitRaw === null || hitRaw === undefined) {
        hitRaw = 'score' in raw ? raw.score : 0.0;
    }
    const coerced = _coerceFloat(hitRaw);
    const hit_score = new PyFloat(coerced === null ? 0.0 : coerced);
    // used_in = raw.get("used_in") or raw.get("step") or "unspecified"
    const used_in = _pyTruthy(raw.used_in)
        ? raw.used_in
        : (_pyTruthy(raw.step) ? raw.step : 'unspecified');
    return {
        entry_id: scrub_string(entry_id.trim()),
        hit_score,
        used_in: scrub_string(String(used_in)),
    };
}

function _from_state(state: Record<string, unknown>): Record<string, unknown>[] {
    const entries: Record<string, unknown>[] = [];
    for (const raw of (state.memory as unknown[] | undefined) ?? []) {
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            continue;
        }
        const entry = _coerce_entry(raw as Record<string, unknown>);
        if (entry !== null) {
            entries.push(entry);
        }
    }
    return entries;
}

/**
 * Python `str.splitlines()` (no args). Splits on the Python line-boundary
 * set (`\n \r \r\n \v \f \x1c \x1d \x1e \x85    `) and emits no
 * trailing empty element when the string ends on a break.
 */
function _splitlines(s: string): string[] {
    if (s === '') {
        return [];
    }
    const breaks = new Set([
        '\n', '\r', '\v', '\f',
        '\x1c', '\x1d', '\x1e', '\x85',
        ' ', ' ',
    ]);
    const out: string[] = [];
    let cur = '';
    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i] as string;
        if (ch === '\r' && s[i + 1] === '\n') {
            out.push(cur);
            cur = '';
            i += 1;
            continue;
        }
        if (breaks.has(ch)) {
            out.push(cur);
            cur = '';
            continue;
        }
        cur += ch;
    }
    if (cur !== '') {
        out.push(cur);
    }
    return out;
}

function _from_sidecar(project_root: string, run_id: string | null): Record<string, unknown>[] {
    const p = path.join(project_root, MEMORY_SIDECAR);
    if (!fs.existsSync(p)) {
        return [];
    }
    const entries: Record<string, unknown>[] = [];
    let content: string;
    try {
        content = fs.readFileSync(p, 'utf-8');
    } catch {
        return [];
    }
    for (let line of _splitlines(content)) {
        line = line.trim();
        if (!line) {
            continue;
        }
        let raw: unknown;
        try {
            raw = JSON.parse(line);
        } catch {
            continue; // json.JSONDecodeError → skip line
        }
        if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
            continue;
        }
        const rawDict = raw as Record<string, unknown>;
        // if run_id and raw.get("run_id") not in (None, run_id): continue
        if (run_id) {
            const got = rawDict.run_id ?? null;
            if (got !== null && got !== run_id) {
                continue;
            }
        }
        const entry = _coerce_entry(rawDict);
        if (entry !== null) {
            entries.push(entry);
        }
    }
    return entries;
}

export function build(
    project_root: string,
    state: Record<string, unknown>,
): Record<string, unknown>[] | null {
    // run_id = (state.get("input") or {}).get("data", {}).get("id")
    const input = _pyTruthy(state.input) ? (state.input as Record<string, unknown>) : {};
    const dataRaw = 'data' in input ? input.data : {};
    const data =
        typeof dataRaw === 'object' && dataRaw !== null && !Array.isArray(dataRaw)
            ? (dataRaw as Record<string, unknown>)
            : {};
    const run_id = data.id;
    const entries = _from_state(state);
    entries.push(
        ..._from_sidecar(project_root, typeof run_id === 'string' ? run_id : null),
    );
    return entries.length > 0 ? entries : null;
}
