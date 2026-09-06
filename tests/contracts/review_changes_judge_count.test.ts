/**
 * The judge count in `review/changes/command.md` is read from its own table,
 * never typed beside it.
 *
 * WHY. Measured 2026-09-06 at `6af83a64b`: the command said "six specialized
 * judges" in its `description:` (`:12`), in its opening prose (`:27`) and in its
 * dispatch heading (`:112`), listed **seven** rows in the table at `:117-125`,
 * said "The seven judges weight equally" four lines later. Every one of those
 * cardinals was hand-typed, so the seventh judge landed and eleven sentences kept
 * counting six. The roster drifted the same way and one level deeper, which this
 * check found rather than assumed: `judge-spec-compliance` was a table row and a
 * dispatched judge while appearing in neither `routes_to:` nor `skills:`.
 *
 * THE CONTRACT. Every cardinal that counts the WHOLE judge set must equal the
 * row count of the table in the same file. The check compares against the row
 * count rather than against a literal, which is what keeps the two set-minus-one
 * passages legal: "the other six" counts seven minus the one under discussion
 * and is correct as written, and "the five that preceded it" is a dated
 * statement about the era before `overbuild-review-lens` existed. Both are
 * pinned verbatim below so a future mechanical `six` → `seven` sweep cannot
 * silently break them while closing a consistency finding.
 *
 * DENIAL POLARITY. `reddens on an eighth row` splices a row into the table and
 * touches nothing else; the audit must go red. `greens when both are updated`
 * splices the same row AND the prose; it must go green. A checker only ever seen
 * green has unknown sensitivity.
 */
import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COMMAND_REL = 'src/domains/engineering-base/review/changes/command.md';

const NUM = '(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';

const WORD_VALUE: Readonly<Record<string, number>> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
};

/**
 * Cardinals that count the whole set. The leading determiner is load-bearing:
 * without it, "whenever three judges raise nits" — an illustrative subset inside
 * the spec-judge rationale — reads as a set count and the check becomes noise.
 */
const SET_TOTAL_SHAPES: readonly RegExp[] = [
    new RegExp(
        `\\b(?:the|all|same|to|with|against|alongside|of)\\s+(?:same\\s+)?(${NUM})\\s+` +
            `(?:specialized\\s+|internal\\s+|in-session\\s+)?(?:judges?|lenses)\\b`,
        'gi',
    ),
    new RegExp(`\\ball\\s+(${NUM})\\b`, 'gi'),
];

export interface Cardinal {
    line: number;
    word: string;
    value: number;
    excerpt: string;
}

/**
 * Rows in the judge table — the authority every cardinal is checked against.
 * Anchored on the dispatch heading rather than on a row shape, so a second table
 * elsewhere in the file cannot be counted by accident.
 */
export function judgeTableRowCount(text: string): number {
    const lines = text.split('\n');
    const heading = lines.findIndex((l) => /^#+\s*4\.\s*Dispatch to the /.test(l));
    if (heading < 0) throw new Error(`${COMMAND_REL}: judge-dispatch heading not found`);
    let sep = -1;
    for (let i = heading + 1; i < lines.length; i += 1) {
        if (/^\|[\s\-:|]+\|\s*$/.test(lines[i] ?? '')) {
            sep = i;
            break;
        }
        if (/^#+\s/.test(lines[i] ?? '')) break;
    }
    if (sep < 0) throw new Error(`${COMMAND_REL}: no judge table under the dispatch heading`);
    let rows = 0;
    for (let i = sep + 1; i < lines.length; i += 1) {
        if (!(lines[i] ?? '').startsWith('|')) break;
        rows += 1;
    }
    return rows;
}

/** The judge ids the table lists, in table order — the roster half of the same authority. */
export function judgeTableIds(text: string): string[] {
    const lines = text.split('\n');
    const heading = lines.findIndex((l) => /^#+\s*4\.\s*Dispatch to the /.test(l));
    let sep = -1;
    for (let i = heading + 1; i < lines.length; i += 1) {
        if (/^\|[\s\-:|]+\|\s*$/.test(lines[i] ?? '')) {
            sep = i;
            break;
        }
    }
    const out: string[] = [];
    for (let i = sep + 1; i < lines.length; i += 1) {
        const line = lines[i] ?? '';
        if (!line.startsWith('|')) break;
        const m = /\[`([a-z0-9-]+)`\]/.exec(line);
        if (m?.[1] !== undefined) out.push(m[1]);
    }
    return out;
}

/**
 * Every whole-set cardinal, with its line. Newlines collapse to spaces for
 * matching — `\n` → ` ` preserves character offsets exactly — so a cardinal
 * wrapped across two source lines ("with the seven\n  internal judges") is not
 * invisible to a line-by-line scan.
 */
export function setCardinals(text: string): Cardinal[] {
    const flat = text.replace(/\n/g, ' ');
    const lineStarts: number[] = [0];
    for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') lineStarts.push(i + 1);
    const lineOf = (offset: number): number => {
        let lo = 0;
        let hi = lineStarts.length - 1;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if ((lineStarts[mid] ?? 0) <= offset) lo = mid;
            else hi = mid - 1;
        }
        return lo + 1;
    };

    const seen = new Set<number>();
    const out: Cardinal[] = [];
    for (const shape of SET_TOTAL_SHAPES) {
        shape.lastIndex = 0;
        let m: RegExpExecArray | null = shape.exec(flat);
        while (m !== null) {
            const word = (m[1] ?? '').toLowerCase();
            const at = m.index + m[0].toLowerCase().indexOf(word);
            if (!seen.has(at)) {
                seen.add(at);
                out.push({
                    line: lineOf(at),
                    word,
                    value: WORD_VALUE[word] ?? -1,
                    excerpt: flat.slice(Math.max(0, m.index - 20), m.index + m[0].length + 20).trim(),
                });
            }
            m = shape.exec(flat);
        }
    }
    return out.sort((a, b) => a.line - b.line);
}

/** Cardinals that disagree with the table. Empty is the green state. */
export function auditJudgeCardinals(text: string): { rows: number; findings: Cardinal[] } {
    const rows = judgeTableRowCount(text);
    return { rows, findings: setCardinals(text).filter((c) => c.value !== rows) };
}

const SOURCE = fs.readFileSync(join(REPO_ROOT, COMMAND_REL), 'utf-8');

describe('review/changes — the judge count comes from the table', () => {
    it('reads a real table, not an empty one', () => {
        expect(judgeTableRowCount(SOURCE)).toBeGreaterThanOrEqual(5);
    });

    it('finds the cardinals at all — a checker over zero matches is green over nothing', () => {
        expect(setCardinals(SOURCE).length).toBeGreaterThanOrEqual(8);
    });

    it('every whole-set cardinal equals the table row count', () => {
        const { rows, findings } = auditJudgeCardinals(SOURCE);
        expect(
            findings.map((f) => `${COMMAND_REL}:${String(f.line)} — "${f.word}" (table has ${String(rows)}): ${f.excerpt}`),
        ).toEqual([]);
    });

    it('the frontmatter routes_to and skills carry every judge the table lists', () => {
        // The same defect one level down, found by this check on 2026-09-06:
        // `judge-spec-compliance` was a table row, was dispatched by the prose,
        // and appeared in NEITHER frontmatter list. A cardinal is not the only
        // thing that drifts away from a table — a roster does too.
        const ids = judgeTableIds(SOURCE);
        expect(ids).toHaveLength(judgeTableRowCount(SOURCE));
        const listOf = (key: string): string =>
            SOURCE.split('\n').find((l) => l.startsWith(`${key}:`)) ?? '';
        for (const key of ['routes_to', 'skills']) {
            const line = listOf(key);
            expect(line).not.toBe('');
            for (const id of ids) expect({ key, id, present: line.includes(id) }).toEqual({ key, id, present: true });
        }
    });
});

describe('review — the cluster head counts the same table', () => {
    // Found by the same reading, one file up: the orchestrator advertised
    // `changes` as a "five-judge self-review" in its description and in its
    // routing menu. A count typed on a neighbouring surface drifts exactly like
    // a count typed on the same page.
    const HEAD_REL = 'src/domains/engineering-base/review/command.md';
    const HEAD = fs.readFileSync(join(REPO_ROOT, HEAD_REL), 'utf-8');

    it('every "<n>-judge" cardinal on the head matches the table', () => {
        const found = [...HEAD.matchAll(new RegExp(`\\b(${NUM})-judge\\b`, 'gi'))].map((m) =>
            (m[1] ?? '').toLowerCase(),
        );
        expect(found.length).toBeGreaterThan(0);
        for (const w of found) expect(WORD_VALUE[w]).toBe(judgeTableRowCount(SOURCE));
    });
});

describe('review/changes — the set-minus-one passages stay untouched', () => {
    // These count a subset by construction and would be broken, not fixed, by a
    // mechanical sweep. Pinned verbatim so the sweep is visible if it happens.
    it('"the other six" — seven minus the seventh, present tense', () => {
        expect(SOURCE).toContain('The other six all ask whether the diff is *good*');
    });

    it('"the five that preceded it" — the era before the spec judge, past tense', () => {
        expect(SOURCE).toContain('The five that preceded it');
        expect(SOURCE).toContain('used to pass\nthis path with five green verdicts');
    });

    it('neither passage is read as a whole-set cardinal', () => {
        const lines = SOURCE.split('\n');
        const protectedLines = new Set(
            lines
                .map((l, i) => (/The other six all ask|The five that preceded it/.test(l) ? i + 1 : -1))
                .filter((n) => n > 0),
        );
        expect(protectedLines.size).toBe(2);
        for (const c of setCardinals(SOURCE)) expect(protectedLines.has(c.line)).toBe(false);
    });
});

describe('review/changes — denial polarity', () => {
    /** Splice one more row directly under the last row of the judge table. */
    function withEighthRow(text: string): string {
        const lines = text.split('\n');
        const heading = lines.findIndex((l) => /^#+\s*4\.\s*Dispatch to the /.test(l));
        let sep = -1;
        for (let i = heading + 1; i < lines.length; i += 1) {
            if (/^\|[\s\-:|]+\|\s*$/.test(lines[i] ?? '')) {
                sep = i;
                break;
            }
        }
        let last = sep;
        while ((lines[last + 1] ?? '').startsWith('|')) last += 1;
        lines.splice(last + 1, 0, '| [`judge-invented`](../../skills/judge-invented/SKILL.md) | A row nobody mentioned in the prose |');
        return lines.join('\n');
    }

    it('reddens when a row is added and the prose is not touched', () => {
        const mutated = withEighthRow(SOURCE);
        const { rows, findings } = auditJudgeCardinals(mutated);
        expect(rows).toBe(judgeTableRowCount(SOURCE) + 1);
        expect(findings.length).toBeGreaterThan(0);
    });

    it('greens when both the table and the prose are updated', () => {
        const both = withEighthRow(SOURCE).replace(/\bseven\b/g, 'eight').replace(/\bSeven\b/g, 'Eight');
        expect(auditJudgeCardinals(both).findings).toEqual([]);
    });

    it('reddens when one prose cardinal alone is reverted', () => {
        const one = SOURCE.replace('Dispatch to the seven judges', 'Dispatch to the six judges');
        expect(one).not.toBe(SOURCE);
        expect(auditJudgeCardinals(one).findings.map((f) => f.word)).toEqual(['six']);
    });
});
