/**
 * Re-read one witness against the working tree (ADR-303: the graph is an index,
 * the source is the truth).
 *
 * Readers hash what they read in four ways — the trimmed line, the line without
 * trailing blanks, the raw line, or several raw lines joined by `\n` — and one
 * hashes a single name on the line. The witness does not record which, so every
 * form is tried at the recorded line; a multi-line span is hashed incrementally
 * line by line, so trying spans up to `max_span_lines` long costs one pass over
 * those lines, not one pass per length.
 *
 * States: `confirmed` — the span is at its line; `moved` — the span is within
 * `move_window_lines` of it; `changed` — the span is gone but the fact's name is
 * still in the file; `gone` — neither the span nor the name is, or the file is.
 * A fact with no recorded hash (a native symbol) is checked by its name alone,
 * so it can be `confirmed`, `moved` or `gone`, never `changed`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { WitnessKind } from '../lanes/lane_fact.js';
import defaults from './defaults.json';

export type CheckState = 'confirmed' | 'moved' | 'changed' | 'gone';

/** A witness's kind as recorded, else inferred: a hash means a span, no hash a name. */
export function witnessKind(w: { hash: string | null; kind?: WitnessKind }): WitnessKind {
    return w.kind ?? (w.hash ? 'span' : 'name');
}

export interface WitnessInput {
    file: string;
    /** 1-based; 0 when the fact has no line. */
    line: number;
    hash: string | null;
    /** The name a reader would search for: a column, a method, a service. */
    name: string;
}

export interface WitnessResult {
    state: CheckState;
    /** `file:line` as recorded. */
    at: string;
    /** Where the span (or name) is now, when it is somewhere else. */
    now_at?: string;
    /** `hash` when a span hash decided it, `name` when only the name could. */
    by: 'hash' | 'name';
}

export interface CheckOptions {
    window?: number;
    maxSpan?: number;
}

const FNV_OFFSET = 0x811c9dc5;

function fnvFeed(h: number, text: string): number {
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h;
}

const hex = (h: number): string => (h >>> 0).toString(16).padStart(8, '0');

/** Reads each file once per check run; a path outside the root reads as absent. */
export class FileCache {
    private readonly cache = new Map<string, string[] | null>();
    private readonly rootReal: string;

    constructor(readonly root: string) {
        let r: string;
        try {
            r = fs.realpathSync(root);
        } catch {
            r = path.resolve(root);
        }
        this.rootReal = r;
    }

    lines(file: string): string[] | null {
        if (this.cache.has(file)) return this.cache.get(file) ?? null;
        let out: string[] | null = null;
        if (file !== '' && !path.isAbsolute(file)) {
            const full = path.resolve(this.rootReal, file);
            if (full.startsWith(this.rootReal + path.sep)) {
                try {
                    out = fs.readFileSync(full, 'utf-8').split('\n');
                } catch {
                    out = null;
                }
            }
        }
        this.cache.set(file, out);
        return out;
    }
}

/** Does any hashing form of the span starting at `start` (0-based) produce `want`? */
function spanMatches(lines: readonly string[], start: number, want: string, maxSpan: number): boolean {
    const first = lines[start];
    if (first === undefined) return false;
    if (hex(fnvFeed(FNV_OFFSET, first.trim())) === want) return true;
    if (hex(fnvFeed(FNV_OFFSET, first.trimEnd())) === want) return true;
    let h = fnvFeed(FNV_OFFSET, first);
    if (hex(h) === want) return true;
    for (const tok of first.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) {
        if (hex(fnvFeed(FNV_OFFSET, tok)) === want) return true;
    }
    for (let k = 1; k < maxSpan && start + k < lines.length; k++) {
        h = fnvFeed(h, '\n');
        h = fnvFeed(h, lines[start + k] as string);
        if (hex(h) === want) return true;
    }
    return false;
}

/** The last name segment of a label or id: `posts.title` → `title`, `App\\Post::save` → `save`. */
export function nameToken(labelOrId: string): string {
    const parts = labelOrId.split(/[.#:\\/]+/).filter(Boolean);
    return (parts[parts.length - 1] ?? labelOrId).replace(/@\d+$/, '').replace(/\(\)$/, '');
}

function nameMatcher(name: string): RegExp | null {
    if (name.trim() === '') return null;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return /^\w+$/.test(name) ? new RegExp(`(?<![A-Za-z0-9_])${esc}(?![A-Za-z0-9_])`) : new RegExp(esc);
}

/** The occurrence of `re` nearest to `from` (0-based), within `limit` lines either way, or -1. */
function nearest(lines: readonly string[], from: number, limit: number, test: (i: number) => boolean): number {
    if (from >= 0 && from < lines.length && test(from)) return from;
    for (let d = 1; d <= limit; d++) {
        if (from - d >= 0 && from - d < lines.length && test(from - d)) return from - d;
        if (from + d < lines.length && from + d >= 0 && test(from + d)) return from + d;
    }
    return -1;
}

export function checkWitness(files: FileCache, w: WitnessInput, opts: CheckOptions = {}): WitnessResult {
    const window = opts.window ?? defaults.move_window_lines;
    const maxSpan = opts.maxSpan ?? defaults.max_span_lines;
    const at = w.line > 0 ? `${w.file}:${w.line}` : w.file;
    const lines = files.lines(w.file);
    if (lines === null) return { state: 'gone', at, by: w.hash ? 'hash' : 'name' };
    const origin = Math.max(0, w.line - 1);
    const re = nameMatcher(w.name);
    const nameAt = (i: number): boolean => re !== null && re.test(lines[i] ?? '');
    const where = (i: number): string => `${w.file}:${i + 1}`;

    if (w.hash) {
        if (w.line > 0 && spanMatches(lines, origin, w.hash, maxSpan)) return { state: 'confirmed', at, by: 'hash' };
        const moved = nearest(lines, origin, window, (i) => i !== origin && spanMatches(lines, i, w.hash as string, maxSpan));
        if (moved >= 0) return { state: 'moved', at, now_at: where(moved), by: 'hash' };
        const named = nearest(lines, origin, lines.length, nameAt);
        if (named >= 0) return { state: 'changed', at, now_at: where(named), by: 'hash' };
        return { state: 'gone', at, by: 'hash' };
    }
    if (re === null) return { state: 'confirmed', at, by: 'name' };
    if (w.line > 0 && nameAt(origin)) return { state: 'confirmed', at, by: 'name' };
    const named = nearest(lines, origin, lines.length, nameAt);
    if (named >= 0) return { state: 'moved', at, now_at: where(named), by: 'name' };
    return { state: 'gone', at, by: 'name' };
}
