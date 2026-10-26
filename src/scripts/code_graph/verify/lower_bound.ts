/**
 * A usage list from the graph is a lower bound: a reader cannot see a call or a
 * column read whose name is built at run time. Every usage answer is therefore
 * paired with a plain text search for the name, and stated as "known places N
 * (+M only by text search)". A file the text search finds and the graph does
 * not is logged as a reader gap — evidence for the next reader fix, not a
 * finding about the code.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { gitProbe } from '../../_lib/spawn_env.js';
import defaults from './defaults.json';

export interface LowerBound {
    name: string;
    /** Files the graph names as using it. */
    known: number;
    /** Files only the text search finds, beyond the known ones and the declaration. */
    text_only: number;
    /** Up to `text_search_shown` of them, `file:line` of the first hit. */
    text_only_at: string[];
    /** One line: `known places N (+M only by text search)`. */
    line: string;
    /** Set when the text search could not run; then M is unknown, not zero. */
    unavailable?: string;
}

/**
 * Text hits for `name`: the first line per file. `git grep` over tracked and
 * untracked-but-not-ignored files, fixed string, whole word for an identifier.
 */
export function textHits(root: string, name: string): Map<string, number> | null {
    const word = /^\w+$/.test(name);
    let out: string;
    try {
        out = gitProbe(root, ['grep', '-n', '-I', '-F', '--untracked', ...(word ? ['-w'] : []), '-e', name, '--'], { maxBuffer: 64 * 1024 * 1024, timeout: 20_000 });
    } catch (e) {
        // git grep exits 1 when nothing matches; that is an answer, not a failure.
        if ((e as { status?: number }).status === 1) return new Map();
        return null;
    }
    const hits = new Map<string, number>();
    for (const raw of out.split('\n')) {
        const m = /^(.*?):(\d+):/.exec(raw);
        if (!m) continue;
        const file = m[1] as string;
        if (!hits.has(file)) hits.set(file, Number(m[2]));
    }
    return hits;
}

/**
 * `knownFiles` — files the graph answer names; `declared` — files the subject
 * itself is declared in (a text hit there is the declaration, not a usage).
 */
export function lowerBound(root: string, name: string, knownFiles: Iterable<string>, declared: Iterable<string>, gapLog?: string): LowerBound {
    const known = new Set(knownFiles);
    const skip = new Set([...known, ...declared]);
    const hits = name.trim() === '' ? new Map<string, number>() : textHits(root, name);
    if (hits === null) {
        return { name, known: known.size, text_only: 0, text_only_at: [], line: `known places ${known.size} (+? only by text search: search unavailable)`, unavailable: 'git grep failed' };
    }
    const only = [...hits].filter(([f]) => !skip.has(f)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const at = only.slice(0, defaults.text_search_shown).map(([f, l]) => `${f}:${l}`);
    if (gapLog && only.length > 0) {
        try {
            fs.mkdirSync(path.dirname(gapLog), { recursive: true });
            fs.appendFileSync(gapLog, `${JSON.stringify({ at: new Date().toISOString(), name, known: known.size, text_only: only.length, sample: at })}\n`);
        } catch {
            /* a log that cannot be written changes no answer */
        }
    }
    return { name, known: known.size, text_only: only.length, text_only_at: at, line: `known places ${known.size} (+${only.length} only by text search)` };
}
