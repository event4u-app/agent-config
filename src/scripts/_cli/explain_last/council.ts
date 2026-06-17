/**
 * Resolve the `council` why-slot for the trace.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/council.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same candidate glob,
 * same ±1h run window, same most-recent pick, same member extraction
 * (first stripped line, 200-code-point slice), and the same deliberate
 * omission of cost-metadata fields. No behaviour changes.
 *
 * Picks the most recent `council-responses.json` whose `mtime` lies within
 * the run window (state file mtime ± 1h). Cost-metadata fields
 * (`input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`) are
 * intentionally NOT surfaced — they leak business-intelligence about spend
 * rate per the security-engineer council fix.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { scrub_string } from './scrubber.js';

const RUN_WINDOW_SECONDS = 3600;

/** Python `len()` (code-point count) for the 200-char verdict slice. */
function _pySlice200(s: string): string {
    const cps = Array.from(s);
    return cps.slice(0, 200).join('');
}

/** Python `str.splitlines()[0]` — first physical line; `[]` indexing matches. */
function _firstLine(s: string): string | undefined {
    // splitlines on the Python boundary set; only the first element is read.
    const m = s.split(/\r\n|[\n\r\v\f\x1c\x1d\x1e\x85]/);
    return m.length > 0 ? m[0] : undefined;
}

function _candidate_files(project_root: string): string[] {
    // council-ref-allowed: council loader implementation per roadmap.
    const sessions_root = path.join(
        project_root, 'agents', 'runtime', 'council', 'sessions',
    );
    const tmp_root = path.join(project_root, 'tmp');
    const candidates: string[] = [];
    if (_isDir(sessions_root)) {
        for (const sub of _iterdir(sessions_root)) {
            if (_isDir(sub)) {
                const candidate = path.join(sub, 'council-responses.json');
                if (fs.existsSync(candidate)) {
                    candidates.push(candidate);
                }
            }
        }
    }
    if (fs.existsSync(tmp_root)) {
        candidates.push(..._glob(tmp_root, 'council-', '.json').sort());
    }
    return candidates;
}

function _pick_recent(candidates: string[], anchor_mtime: number): string | null {
    let best: [number, string] | null = null;
    for (const p of candidates) {
        let mtime: number;
        try {
            mtime = fs.statSync(p).mtimeMs / 1000;
        } catch {
            continue;
        }
        if (Math.abs(mtime - anchor_mtime) > RUN_WINDOW_SECONDS) {
            continue;
        }
        if (best === null || mtime > best[0]) {
            best = [mtime, p];
        }
    }
    return best ? best[1] : null;
}

function _extract_member(entry: Record<string, unknown>): Record<string, unknown> | null {
    const provider = _pyTruthy(entry.provider) ? String(entry.provider) : '';
    const model = _pyTruthy(entry.model) ? String(entry.model) : '';
    const parts = [provider, model].filter((p) => p !== '');
    const member_id = parts.length > 0 ? parts.join('/') : 'unknown';
    const text = entry.text;
    if (typeof text !== 'string' || text.trim() === '') {
        return null;
    }
    const firstLine = _firstLine(text.trim()) ?? '';
    const verdict = scrub_string(_pySlice200(firstLine));
    const citations: unknown[] = [];
    for (const cite of (entry.citations as unknown[] | undefined) ?? []) {
        if (typeof cite === 'string') {
            citations.push(scrub_string(cite));
        }
    }
    return {
        member_id: scrub_string(member_id),
        verdict,
        citations,
    };
}

export function build(
    project_root: string,
    state_file: string,
): Record<string, unknown>[] | null {
    let anchor: number;
    try {
        anchor = fs.statSync(state_file).mtimeMs / 1000;
    } catch {
        return null;
    }
    const candidates = _candidate_files(project_root);
    if (candidates.length === 0) {
        return null;
    }
    const picked = _pick_recent(candidates, anchor);
    if (picked === null) {
        return null;
    }
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(picked, 'utf-8'));
    } catch {
        return null;
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        return null;
    }
    const members: Record<string, unknown>[] = [];
    for (const entry of ((raw as Record<string, unknown>).responses as unknown[] | undefined) ?? []) {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
            continue;
        }
        const member = _extract_member(entry as Record<string, unknown>);
        if (member !== null) {
            members.push(member);
        }
    }
    return members.length > 0 ? members : null;
}

// --- small fs helpers mirroring pathlib semantics -------------------------

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _iterdir(p: string): string[] {
    // pathlib.Path.iterdir() order is unspecified; the original sorts only
    // the tmp glob, not the sessions iterdir, so leave OS order here.
    let names: string[];
    try {
        names = fs.readdirSync(p);
    } catch {
        return [];
    }
    return names.map((n) => path.join(p, n));
}

function _glob(dir: string, prefix: string, suffix: string): string[] {
    // Path.glob("council-*.json") — non-recursive, matches the dir's entries.
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.startsWith(prefix) && n.endsWith(suffix))
        .map((n) => path.join(dir, n));
}

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
