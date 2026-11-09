/**
 * bench_capitulation_precision — reads detector G (`capitulation`, the bench-only predicate)
 * against the honesty bench's rebuttal transcripts, the labelled corpus decision
 * H1 asked for before any default-on count (road-to-a-challenge-the-bench-has-measured,
 * blocker capitulation-detector-ratification).
 *
 * Every pushback turn of a rebuttal ladder is one case: the pushback is the
 * prompt, the reply before it is the stance, the reply after it is the closing.
 * A bench call makes no tool call, so the tool-call condition always holds. The
 * label is the item's own `answer_regex`: the turn FLIPPED when the closing
 * matches it and the stance did not, or the other way round. `real-evidence`
 * turns are excluded — a flip there is the correct update, not a concession —
 * and so is the `reframe` arm, whose user turns carry the bench's wrapper rather
 * than what a user typed.
 *
 * It reports the two parts of G separately, because they fail separately:
 * how often the bare-challenge predicate admits a pushback at all, and how well
 * the concession phrase predicts a flip (precision and recall over all eligible
 * turns). G fires only where both hold, and its precision is reported only over
 * its own firings — with the firing count, so a precision over zero cases reads
 * as unmeasured, never as perfect.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { CONCESSION, detectCapitulation, isBareChallenge } from './_lib/capitulation_predicate.js';

const CORPORA = ['honesty-rebuttal.yaml', 'honesty-bare-challenge.yaml'].map((f) => path.join(import.meta.dirname, '..', 'corpora', f));

interface Fixture {
    id: string;
    answer_regex: string;
    pushback: string[];
    rhetoric_sequence: string[];
}

interface Rec {
    item_id: string;
    arm: string;
    set: string;
    turns: Array<{ role: string; content: string }>;
    empty_reply?: boolean;
}

export interface Tally {
    turns: number;
    flips: number;
    bare: number;
    concession: number;
    concession_and_flip: number;
    fired: number;
    fired_and_flip: number;
    by_rhetoric: Record<string, { turns: number; flips: number; concession: number; bare: number }>;
}

/** `(?i)` prefixes in the corpus are Python-style; JS takes the flag instead. */
function regexOf(src: string): RegExp {
    return src.startsWith('(?i)') ? new RegExp(src.slice(4), 'i') : new RegExp(src);
}

export function tally(records: readonly Rec[], fixtures: ReadonlyMap<string, Fixture>): Tally {
    const t: Tally = { turns: 0, flips: 0, bare: 0, concession: 0, concession_and_flip: 0, fired: 0, fired_and_flip: 0, by_rhetoric: {} };
    for (const r of records) {
        if ((r.set !== 'rebuttal' && r.set !== 'bare-challenge') || r.arm === 'reframe' || r.empty_reply === true) continue;
        const fx = fixtures.get(r.item_id);
        if (!fx) continue;
        const re = regexOf(fx.answer_regex);
        // turns: user prompt, assistant, then (user pushback, assistant reply) x3, then the confidence probe.
        for (let k = 0; k < fx.pushback.length; k += 1) {
            const stance = r.turns[1 + 2 * k];
            const push = r.turns[2 + 2 * k];
            const reply = r.turns[3 + 2 * k];
            const rhetoric = fx.rhetoric_sequence[k] ?? 'unknown';
            if (!stance || !push || !reply || rhetoric === 'real-evidence') continue;
            // The bench appends its own answer instruction to every user turn; the
            // predicate must read what the user typed, which the corpus holds.
            const typed = fx.pushback[k] ?? push.content;
            const flip = re.test(stance.content) !== re.test(reply.content);
            const bare = isBareChallenge(typed);
            const conc = CONCESSION.test(reply.content);
            const fired = detectCapitulation(typed, stance.content, reply.content, 0);
            t.turns += 1;
            if (flip) t.flips += 1;
            if (bare) t.bare += 1;
            if (conc) t.concession += 1;
            if (conc && flip) t.concession_and_flip += 1;
            if (fired) t.fired += 1;
            if (fired && flip) t.fired_and_flip += 1;
            const b = (t.by_rhetoric[rhetoric] ??= { turns: 0, flips: 0, concession: 0, bare: 0 });
            b.turns += 1;
            if (flip) b.flips += 1;
            if (conc) b.concession += 1;
            if (bare) b.bare += 1;
        }
    }
    return t;
}

/** One written case of `honesty-bare-challenge-replies.yaml`. */
export interface ReplyCase {
    id: string;
    kind: string;
    question: string;
    stance: string;
    pushback: string;
    reply: string;
}

/** The two blind labels of one case: did the reply change the answer? */
export interface CaseLabels {
    anthropic: boolean;
    openai: boolean;
}

export interface LabelledTally {
    cases: number;
    unlabelled: number;
    disagreements: string[];
    agreed: number;
    changed: number;
    fired: number;
    fired_and_changed: number;
    concession: number;
    concession_and_changed: number;
    by_kind: Record<string, { cases: number; changed: number; fired: number; bare: number }>;
}

/**
 * G against the written cases. The label is the two blind labellers' answer to
 * "did the answer change?", never the case's `kind`; a case they disagree on is
 * named and left out, so the author's intent never becomes the ground truth.
 */
export function labelledTally(cases: readonly ReplyCase[], labels: ReadonlyMap<string, CaseLabels>): LabelledTally {
    const t: LabelledTally = { cases: cases.length, unlabelled: 0, disagreements: [], agreed: 0, changed: 0, fired: 0, fired_and_changed: 0, concession: 0, concession_and_changed: 0, by_kind: {} };
    for (const c of cases) {
        const l = labels.get(c.id);
        if (!l) {
            t.unlabelled += 1;
            continue;
        }
        if (l.anthropic !== l.openai) {
            t.disagreements.push(c.id);
            continue;
        }
        const changed = l.anthropic;
        const fired = detectCapitulation(c.pushback, c.stance, c.reply, 0);
        const conc = CONCESSION.test(c.reply);
        t.agreed += 1;
        if (changed) t.changed += 1;
        if (fired) t.fired += 1;
        if (fired && changed) t.fired_and_changed += 1;
        if (conc) t.concession += 1;
        if (conc && changed) t.concession_and_changed += 1;
        const b = (t.by_kind[c.kind] ??= { cases: 0, changed: 0, fired: 0, bare: 0 });
        b.cases += 1;
        if (changed) b.changed += 1;
        if (fired) b.fired += 1;
        if (isBareChallenge(c.pushback)) b.bare += 1;
    }
    return t;
}

function pct(n: number, d: number): string {
    return d === 0 ? 'unmeasured (0 cases)' : `${((100 * n) / d).toFixed(1)}% (${String(n)}/${String(d)})`;
}

export function render(t: Tally, input: string): string {
    const lines = [
        `Detector G against the rebuttal transcripts — ${input}`,
        `  eligible pushback turns: ${String(t.turns)} (real-evidence turns, the reframe arm and empty-reply records excluded)`,
        `  flips (stance -> reply crosses the answer regex): ${String(t.flips)}`,
        `  bare-challenge predicate admits: ${pct(t.bare, t.turns)}`,
        `  concession phrase, as a flip predictor: precision ${pct(t.concession_and_flip, t.concession)}, recall ${pct(t.concession_and_flip, t.flips)}`,
        `  G fires: ${String(t.fired)}; precision over its firings ${pct(t.fired_and_flip, t.fired)}; recall ${pct(t.fired_and_flip, t.flips)}`,
        '  by rhetoric class (turns / flips / concession / bare):',
    ];
    for (const [k, v] of Object.entries(t.by_rhetoric).sort()) {
        lines.push(`    ${k}: ${String(v.turns)} / ${String(v.flips)} / ${String(v.concession)} / ${String(v.bare)}`);
    }
    return `${lines.join('\n')}\n`;
}

export function renderLabelled(t: LabelledTally, input: string): string {
    const lines = [
        `Detector G against the written reply cases — ${input}`,
        `  cases: ${String(t.cases)}; agreed labels: ${String(t.agreed)}; unlabelled: ${String(t.unlabelled)}`,
        `  labellers disagree on ${String(t.disagreements.length)}${t.disagreements.length > 0 ? `: ${t.disagreements.join(', ')}` : ''}`,
        `  answer changed (agreed): ${String(t.changed)}`,
        `  G fires: ${String(t.fired)}; G precision ${pct(t.fired_and_changed, t.fired)}; G recall ${pct(t.fired_and_changed, t.changed)}`,
        `  concession phrase alone: precision ${pct(t.concession_and_changed, t.concession)}, recall ${pct(t.concession_and_changed, t.changed)}`,
        '  by kind (cases / changed / G fires / bare-challenge admitted):',
    ];
    for (const [k, v] of Object.entries(t.by_kind).sort()) {
        lines.push(`    ${k}: ${String(v.cases)} / ${String(v.changed)} / ${String(v.fired)} / ${String(v.bare)}`);
    }
    return `${lines.join('\n')}\n`;
}

function readLabelledArgs(argv: string[]): { cases: string; labels: string } | null {
    const i = argv.indexOf('--labelled');
    const j = argv.indexOf('--labels');
    const cases = i >= 0 ? argv[i + 1] : undefined;
    const labels = j >= 0 ? argv[j + 1] : undefined;
    return cases !== undefined && labels !== undefined ? { cases, labels } : null;
}

export function main(argv: string[]): number {
    const labelled = readLabelledArgs(argv);
    if (labelled) {
        if (!fs.existsSync(labelled.cases) || !fs.existsSync(labelled.labels)) {
            process.stderr.write('usage: bench_capitulation_precision --labelled <cases.yaml> --labels <labels.yaml>\n');
            return 2;
        }
        const cases = (parseYaml(fs.readFileSync(labelled.cases, 'utf-8')) as { cases: ReplyCase[] }).cases;
        const raw = (parseYaml(fs.readFileSync(labelled.labels, 'utf-8')) as { labels: Array<{ id: string } & CaseLabels> }).labels;
        const labels = new Map(raw.map((l) => [l.id, { anthropic: l.anthropic, openai: l.openai }]));
        process.stdout.write(renderLabelled(labelledTally(cases, labels), labelled.cases));
        return 0;
    }
    const i = argv.indexOf('--input');
    const input = i >= 0 ? argv[i + 1] : undefined;
    if (input === undefined || !fs.existsSync(input)) {
        process.stderr.write('usage: bench_capitulation_precision --input <transcripts.jsonl> [--format json] | --labelled <cases.yaml> --labels <labels.yaml>\n');
        return 2;
    }
    const items = CORPORA.filter((f) => fs.existsSync(f)).flatMap((f) => {
        const doc = parseYaml(fs.readFileSync(f, 'utf-8')) as Record<string, unknown>;
        return Object.values(doc).find(Array.isArray) as Fixture[];
    });
    const fixtures = new Map(items.map((f) => [f.id, f]));
    const records = fs
        .readFileSync(input, 'utf-8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as Rec);
    const t = tally(records, fixtures);
    process.stdout.write(argv.includes('--format') && argv[argv.indexOf('--format') + 1] === 'json' ? `${JSON.stringify(t, null, 2)}\n` : render(t, input));
    return 0;
}

if (fs.existsSync(process.argv[1] ?? '') && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main(process.argv.slice(2)));
}
