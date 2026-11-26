/**
 * `name.json` beside a run's `bracket.json` — the human name of an arena run
 * and the one-line decision it reached, as Agent Switch shows them.
 *
 *   { "v": 1,
 *     "name":     { "text": "…", "by": "user|agent", "at": "<ISO>" },
 *     "decision": { "text": "…", "by": "user|agent", "at": "<ISO>", "champion": "L004" } }
 *
 * Agent Switch writes the same file when the user renames a run, so a field the
 * user wrote (`by: "user"`) is never replaced by an agent write unless the
 * caller passes `force`. The bracket engine never reads or writes this file:
 * only the `bracket name` sub-command does, and it reads `bracket.json` only to
 * learn the current champion.
 */
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from '../_lib/fs_atomic.js';
import { BracketError } from './errors.js';

export const NAME_FILE = 'name.json';
export const NAME_SCHEMA = 1;
export const NAME_MAX = 120;
export const DECISION_MAX = 160;

export type NameAuthor = 'user' | 'agent';

export interface NameField {
    text: string;
    by: NameAuthor;
    at: string;
}

export interface DecisionField extends NameField {
    champion?: string;
}

export interface RunName {
    v: 1;
    name?: NameField;
    decision?: DecisionField;
}

// C0/C1 controls, line/paragraph separators, and the bidi embedding, override
// and isolate marks — anything that could break the one-line display or flip
// the text around it.
const UNSAFE = new RegExp('[' + ['\\u0000-\\u001F', '\\u007F-\\u009F', '\\u061C', '\\u200E\\u200F', '\\u2028\\u2029', '\\u202A-\\u202E', '\\u2066-\\u2069', '\\uFEFF'].join('') + ']', 'g');

/** One plain line: unsafe characters become spaces, whitespace collapses, ends trim. */
export function plainLine(raw: string): string {
    return raw.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim();
}

function isAuthor(v: unknown): v is NameAuthor {
    return v === 'user' || v === 'agent';
}

function readField(v: unknown): NameField | undefined {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined;
    const o = v as Record<string, unknown>;
    if (typeof o['text'] !== 'string' || !isAuthor(o['by']) || typeof o['at'] !== 'string') return undefined;
    return { text: o['text'], by: o['by'], at: o['at'] };
}

/** The run's `name.json`; `{ v: 1 }` when there is none. Throws `name-unreadable` on a file that is not one. */
export function readRunName(dir: string): RunName {
    const file = path.join(dir, NAME_FILE);
    if (!existsSync(file)) return { v: NAME_SCHEMA };
    let o: unknown;
    try {
        o = JSON.parse(readFileSync(file, 'utf8'));
    } catch {
        throw new BracketError('name-unreadable', `${file} is not JSON — pass --force to replace it`);
    }
    if (typeof o !== 'object' || o === null || Array.isArray(o) || (o as Record<string, unknown>)['v'] !== NAME_SCHEMA) {
        throw new BracketError('name-unreadable', `${file} is not a v1 name file — pass --force to replace it`);
    }
    const r = o as Record<string, unknown>;
    const out: RunName = { v: NAME_SCHEMA };
    const name = readField(r['name']);
    if (name) out.name = name;
    const decision = readField(r['decision']);
    if (decision) {
        const d = r['decision'] as Record<string, unknown>;
        out.decision = typeof d['champion'] === 'string' ? { ...decision, champion: d['champion'] } : decision;
    }
    return out;
}

export interface NameWrite {
    readonly field: 'name' | 'decision';
    readonly text: string;
    readonly force: boolean;
    readonly now: Date;
    /** Recorded with a decision; ignored for a name. */
    readonly champion?: string | null;
}

export interface NameWriteResult {
    readonly state: RunName;
    readonly change: 'set' | 'cleared' | 'unchanged';
}

/** Apply one agent write to `current`. Pure: refuses, never half-applies. */
export function applyAgentWrite(current: RunName, w: NameWrite): NameWriteResult {
    const text = plainLine(w.text);
    const max = w.field === 'name' ? NAME_MAX : DECISION_MAX;
    const length = [...text].length;
    if (length > max) throw new BracketError('name-too-long', `${w.field} is ${length} characters; at most ${max}`);
    const existing = current[w.field];
    if (existing?.by === 'user' && !w.force) {
        throw new BracketError('name-user-owned', `the ${w.field} was set by the user ("${existing.text}") — pass --force to replace it`);
    }
    const next: RunName = { ...current };
    if (text === '') {
        if (existing === undefined) return { state: current, change: 'unchanged' };
        delete next[w.field];
        return { state: next, change: 'cleared' };
    }
    const at = w.now.toISOString();
    if (w.field === 'name') next.name = { text, by: 'agent', at };
    else next.decision = w.champion ? { text, by: 'agent', at, champion: w.champion } : { text, by: 'agent', at };
    return { state: next, change: 'set' };
}

/** Write `name.json` atomically (temp file + rename, mode 0600). */
export function writeRunName(dir: string, state: RunName): string {
    const file = path.join(dir, NAME_FILE);
    const ordered: RunName = { v: NAME_SCHEMA };
    if (state.name) ordered.name = state.name;
    if (state.decision) ordered.decision = state.decision;
    write_atomic(file, `${JSON.stringify(ordered, null, 2)}\n`);
    return file;
}
