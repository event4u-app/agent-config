/**
 * Contradiction review between a project's instructions and its neighbours'
 * (road-to-neighbours-that-pull-their-weight step 2.2).
 *
 * REPORT-ONLY. Nothing here edits, gates or suppresses an instruction — the
 * output is a table a human reads. `neighbour-precedence` (step 2.1) is the
 * rubric: the "which wins" column is its source order applied to the two
 * sources, computed here, and the verdict column is one council seat's reading
 * of whether the pair actually disagrees.
 *
 * NO STATIC DETECTOR DECIDES ANYTHING. A static contradiction detector was
 * measured at 67 % false positives (`docs/contracts/rule-interactions.md`), so
 * this module only FORMS candidate pairs, and only from strong signals: a
 * shared subject word with opposite modality, or a skill name collision the
 * census already found. Whether a candidate is a contradiction is the seat's
 * call, never this file's.
 *
 * A neighbour body the shape scan refused (step 1.3) is never read here: the
 * caller passes only scanned sources, and a refused body contributes no line.
 */
import * as fs from 'node:fs';

/** Rank in `neighbour-precedence`'s source order — lower wins. */
export const RANK_PROJECT = 3;
export const RANK_SUITE = 4;
export const RANK_NEIGHBOUR_ALWAYS_ON = 6;
export const RANK_NEIGHBOUR_SKILL = 7;

const RANK_LABEL: Record<number, string> = {
    [RANK_PROJECT]: 'project instruction file',
    [RANK_SUITE]: "this suite's routed guidance",
    [RANK_NEIGHBOUR_ALWAYS_ON]: "neighbour's always-on text",
    [RANK_NEIGHBOUR_SKILL]: 'neighbour skill body (discoverable)',
};

export interface InstructionSource {
    /** Where the text came from, as printed. */
    label: string;
    file: string;
    rank: number;
}

export interface InstructionLine {
    source: InstructionSource;
    line: number;
    text: string;
    negative: boolean;
    stems: Set<string>;
}

export interface CandidatePair {
    kind: 'opposite-modality' | 'name-collision';
    a: { label: string; rank: number; text: string };
    b: { label: string; rank: number; text: string };
    /** The shared subject word, or the colliding name. */
    subject: string;
}

export type Verdict = 'contradiction' | 'compatible' | 'unclear';

const NEGATION = /\b(never|don't|do not|must not|mustn't|should not|shouldn't|avoid|stop)\b/iu;
const DIRECTIVE_WORD = /\b(always|must|should|never|don't|do not|avoid)\b/iu;
const NON_IMPERATIVE_START = new Set([
    'the', 'a', 'an', 'this', 'that', 'these', 'those', 'it', 'its', 'we', 'you', 'i', 'our',
    'they', 'there', 'when', 'if', 'see', 'for', 'in', 'on', 'as', 'by', 'with', 'from',
]);
const STOP = new Set([
    'always', 'never', 'must', 'should', 'avoid', 'stop', 'don', 'with', 'without', 'that', 'this',
    'they', 'them', 'then', 'than', 'into', 'from', 'your', 'when', 'what', 'will', 'each', 'every',
    'only', 'also', 'here', 'there', 'have', 'been', 'more', 'some', 'such', 'like', 'just',
]);

/** A crude stem — enough to meet `wait` and `waiting`, never a lemmatiser. */
export function stem(word: string): string {
    let w = word.toLowerCase().replace(/[^a-z]/gu, '');
    for (const suffix of ['ing', 'ed', 'es', 's']) {
        if (w.length > suffix.length + 3 && w.endsWith(suffix)) {
            w = w.slice(0, -suffix.length);
            break;
        }
    }
    return w;
}

/** Is this line phrased as an instruction at all? */
export function isDirective(text: string): boolean {
    if (DIRECTIVE_WORD.test(text)) return true;
    const first = (text.split(/\s+/u)[0] ?? '').toLowerCase().replace(/[^a-z']/gu, '');
    return first.length > 0 && !NON_IMPERATIVE_START.has(first);
}

/** Directive lines of one markdown source, outside fences and frontmatter. */
export function extractInstructions(source: InstructionSource, body?: string): InstructionLine[] {
    let text: string;
    try {
        text = body ?? fs.readFileSync(source.file, 'utf-8');
    } catch {
        return [];
    }
    const out: InstructionLine[] = [];
    let fenced = false;
    let frontmatter = false;
    text.split('\n').forEach((raw, i) => {
        const line = raw.trim();
        if (i === 0 && line === '---') {
            frontmatter = true;
            return;
        }
        if (frontmatter) {
            if (line === '---') frontmatter = false;
            return;
        }
        if (line.startsWith('```') || line.startsWith('~~~')) {
            fenced = !fenced;
            return;
        }
        if (fenced || line === '' || line.startsWith('#') || line.startsWith('|') || line.startsWith('>')) return;
        const clean = line.replace(/^([-*+]|\d+\.)\s+/u, '').replace(/[*_`]/gu, '');
        if (clean.split(/\s+/u).length < 3 || !isDirective(clean)) return;
        const stems = new Set(
            clean
                .split(/\s+/u)
                .map(stem)
                .filter((s) => s.length >= 4 && !STOP.has(s)),
        );
        out.push({ source, line: i + 1, text: clean, negative: NEGATION.test(clean), stems });
    });
    return out;
}

function where(l: InstructionLine): string {
    return `${l.source.label}:${l.line}`;
}

/**
 * Candidate pairs from opposite modality over a shared subject word.
 *
 * Only ACROSS ranks — two lines of one source rank are one author's
 * contradiction, which is not what this review is for — and only where one
 * side is negative and the other is not. One pair per line pair, naming the
 * first shared stem in sorted order so the output is stable.
 */
export function modalityPairs(lines: readonly InstructionLine[], cap = 20): CandidatePair[] {
    const out: CandidatePair[] = [];
    for (let i = 0; i < lines.length && out.length < cap; i += 1) {
        for (let j = i + 1; j < lines.length && out.length < cap; j += 1) {
            const x = lines[i] as InstructionLine;
            const y = lines[j] as InstructionLine;
            if (x.source.rank === y.source.rank || x.negative === y.negative) continue;
            const shared = [...x.stems].filter((s) => y.stems.has(s)).sort();
            if (shared.length === 0) continue;
            const [hi, lo] = x.source.rank <= y.source.rank ? [x, y] : [y, x];
            out.push({
                kind: 'opposite-modality',
                a: { label: where(hi), rank: hi.source.rank, text: hi.text },
                b: { label: where(lo), rank: lo.source.rank, text: lo.text },
                subject: shared[0] as string,
            });
        }
    }
    return out;
}

/** A neighbour skill that shares a name with one of ours — the census's `shadowed`. */
export function collisionPair(neighbourQualified: string, ourName: string): CandidatePair {
    return {
        kind: 'name-collision',
        a: { label: `suite:${ourName}`, rank: RANK_SUITE, text: `this suite's skill \`${ourName}\`` },
        b: {
            label: neighbourQualified,
            rank: RANK_NEIGHBOUR_SKILL,
            text: `neighbour skill \`${neighbourQualified}\``,
        },
        subject: ourName,
    };
}

/** "Which wins by 2.1" — the lower rank, named. */
export function winnerBy21(p: CandidatePair): string {
    const w = p.a.rank <= p.b.rank ? p.a : p.b;
    return `${w.label} (rank ${w.rank}, ${RANK_LABEL[w.rank] ?? 'unranked'})`;
}

/** The single-seat prompt. States no expected verdict (evaluator-independence). */
export function seatPrompt(pairs: readonly CandidatePair[], rubric: string): string {
    const rows = pairs.map(
        (p, i) => `PAIR ${i + 1} (${p.kind}, subject "${p.subject}")\n  A [${p.a.label}]: ${p.a.text}\n  B [${p.b.label}]: ${p.b.text}`,
    );
    return [
        '# Neighbour contradiction review',
        '',
        'For each pair, decide whether A and B give an agent instructions that cannot both be followed.',
        'Answer one line per pair, exactly `PAIR <n>: contradiction`, `PAIR <n>: compatible` or `PAIR <n>: unclear`,',
        'then at most one sentence of reason on the same line. The rubric for which source wins is below; you do not',
        'need to restate it.',
        '',
        '## Rubric — neighbour-precedence',
        '',
        rubric.trim(),
        '',
        '## Pairs',
        '',
        ...rows,
        '',
    ].join('\n');
}

/** Read `PAIR <n>: <verdict>` lines; a pair the seat did not answer is `unclear`. */
export function parseVerdicts(text: string, count: number): Verdict[] {
    const out: Verdict[] = Array.from({ length: count }, () => 'unclear');
    for (const m of text.matchAll(/PAIR\s+(\d+)\s*:\s*(contradiction|compatible|unclear)/giu)) {
        const n = Number(m[1]) - 1;
        if (n >= 0 && n < count) out[n] = (m[2] ?? 'unclear').toLowerCase() as Verdict;
    }
    return out;
}

export interface ReviewRow {
    pair: string;
    verdict: Verdict;
    wins: string;
}

/** The table, from pairs and a seat's verdicts. */
export function reviewRows(pairs: readonly CandidatePair[], verdicts: readonly Verdict[]): ReviewRow[] {
    return pairs.map((p, i) => ({
        pair: `${p.a.label} "${p.a.text}" × ${p.b.label} "${p.b.text}"`,
        verdict: verdicts[i] ?? 'unclear',
        wins: winnerBy21(p),
    }));
}

export function renderReview(rows: readonly ReviewRow[]): string[] {
    if (rows.length === 0) return ['  no candidate pairs — nothing to review'];
    return ['  pair | verdict | which wins by 2.1', ...rows.map((r) => `  ${r.pair} | ${r.verdict} | ${r.wins}`)];
}
