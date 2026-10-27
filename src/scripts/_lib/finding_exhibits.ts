/**
 * Typed exhibits on review findings — the shape, and nothing that resolves it.
 *
 * `review-findings.schema.json` declares the four types, but the repository's
 * Draft-07 subset validator resolves no `oneOf`, so the per-type required
 * fields live here. `self_review_gate.parseFindings` uses
 * {@link wellFormedExhibit} to keep or drop what a model returned, and
 * `check_finding_exhibits.ts` resolves the kept ones against a commit. One
 * definition, two readers.
 */

export const EXHIBIT_TYPES = ['presence', 'absence', 'pair', 'executed'] as const;
export type ExhibitType = (typeof EXHIBIT_TYPES)[number];

/** Longest verbatim quote a `presence` exhibit may carry. */
export const MAX_QUOTE_CHARS = 300;

const COMMIT_RE = /^[0-9a-f]{7,40}$/;

export interface PresenceExhibit {
    readonly type: 'presence';
    readonly path: string;
    readonly line: number;
    readonly quote: string;
    readonly commit: string;
}

export interface AbsenceExhibit {
    readonly type: 'absence';
    readonly path_glob: string;
    readonly pattern: string;
    readonly commit: string;
    readonly expected: number;
}

export interface PairExhibit {
    readonly type: 'pair';
    readonly legs: readonly [PresenceExhibit, PresenceExhibit];
}

export interface ExecutedExhibit {
    readonly type: 'executed';
    readonly command: string;
    readonly exit_code: number;
    readonly output_digest: string;
}

export type Exhibit = PresenceExhibit | AbsenceExhibit | PairExhibit | ExecutedExhibit;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const posInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1;

function presence(v: Record<string, unknown>): PresenceExhibit | null {
    if (!nonEmpty(v.path) || !posInt(v.line) || !nonEmpty(v.quote) || v.quote.length > MAX_QUOTE_CHARS) return null;
    if (typeof v.commit !== 'string' || !COMMIT_RE.test(v.commit)) return null;
    return { type: 'presence', path: v.path, line: v.line, quote: v.quote, commit: v.commit };
}

/** The exhibit with exactly its type's fields, or `null` when it is malformed. */
export function wellFormedExhibit(v: unknown): Exhibit | null {
    if (!isObj(v)) return null;
    switch (v.type) {
        case 'presence':
            return presence(v);
        case 'absence':
            if (!nonEmpty(v.path_glob) || !nonEmpty(v.pattern)) return null;
            if (typeof v.commit !== 'string' || !COMMIT_RE.test(v.commit)) return null;
            if (typeof v.expected !== 'number' || !Number.isInteger(v.expected) || v.expected < 0) return null;
            return { type: 'absence', path_glob: v.path_glob, pattern: v.pattern, commit: v.commit, expected: v.expected };
        case 'pair': {
            if (!Array.isArray(v.legs) || v.legs.length !== 2) return null;
            const a = isObj(v.legs[0]) && v.legs[0].type === 'presence' ? presence(v.legs[0]) : null;
            const b = isObj(v.legs[1]) && v.legs[1].type === 'presence' ? presence(v.legs[1]) : null;
            return a && b ? { type: 'pair', legs: [a, b] } : null;
        }
        case 'executed':
            if (!nonEmpty(v.command) || !nonEmpty(v.output_digest)) return null;
            if (typeof v.exit_code !== 'number' || !Number.isInteger(v.exit_code)) return null;
            return { type: 'executed', command: v.command, exit_code: v.exit_code, output_digest: v.output_digest };
        default:
            return null;
    }
}

const LINE_SUFFIX_RE = /:(\d+)(?:-\d+)?$/;

/**
 * Split a `file` value that carries a smuggled line reference.
 * `src/x.ts:42` and `src/x.ts:42-50` become `{ path: 'src/x.ts', line: 42 }`;
 * a value without a suffix comes back unchanged with no line.
 */
export function splitLineSuffix(file: string): { path: string; line?: number } {
    const m = LINE_SUFFIX_RE.exec(file);
    if (!m) return { path: file };
    const line = Number(m[1]);
    return line >= 1 ? { path: file.slice(0, m.index), line } : { path: file.slice(0, m.index) };
}
