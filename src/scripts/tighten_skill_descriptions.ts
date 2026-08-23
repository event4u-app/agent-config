#!/usr/bin/env node
/**
 * Tighten skill descriptions toward a cap WITHOUT touching trigger vocabulary.
 *
 * The description is the routing surface. `lint_skill_descriptions` gates its
 * shape, `audit_skill_descriptions` ranks it and `optimize_skill_description`
 * tunes ONE skill against its own `evals/triggers.json`. None of them shortens
 * a corpus, which is why this exists — and why it is deliberately timid.
 *
 * THE FAILURE IT IS BUILT AGAINST. A rewriter asked to cut N chars strips
 * trigger vocabulary before it strips filler, because filler is the harder of
 * the two to identify. A description that loses its trigger phrase costs more
 * in missed routing than it ever saves in tokens, so this tool never rewrites:
 * it applies a closed list of audited, meaning-preserving transformations and
 * then REFUSES to write unless the informative-token set came out identical.
 *
 * "Informative token" is mechanical: lowercased, ≥4 chars, not in STOPWORDS.
 * The set — not the count — must match, so a transformation that swapped one
 * informative word for another of the same length is rejected too.
 *
 * A skill the transformations cannot bring under the cap is reported as a MISS
 * with the residual filler budget beside it, and left alone. That number is
 * what separates "a hand rewrite could still find filler here" from "the only
 * chars left to cut are informative ones" — the second is a genuine
 * trigger-loss wall and the honest reason to stop, and reporting it is the
 * point rather than a consolation for having stopped.
 *
 * Usage:
 *   tighten_skill_descriptions --cap 189            # report only (default)
 *   tighten_skill_descriptions --cap 189 --apply    # write the wins
 *   tighten_skill_descriptions --self-test
 *
 * Exit 0 on report and on apply; 1 only on a self-test failure or a usage
 * error. This is an authoring tool, not a gate.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { SRC_SKILLS } from './_lib/agent_src.js';

/** Words too short or too common to carry routing signal. */
const STOPWORDS = new Set([
    'when', 'with', 'from', 'that', 'this', 'they', 'them', 'then', 'than', 'into', 'over',
    'your', 'each', 'both', 'only', 'also', 'such', 'been', 'were', 'will', 'would', 'have',
    'here', 'what', 'which', 'while', 'their', 'there', 'these', 'those', 'about', 'after',
    'before', 'every', 'other', 'under', 'until', 'using', 'uses', 'used', 'more', 'most',
    'less', 'least', 'same', 'does', 'doing', 'done', 'make', 'makes', 'made',
]);

export function informativeTokens(s: string): Set<string> {
    const out = new Set<string>();
    for (const raw of s.toLowerCase().split(/[^a-z0-9'’\-]+/)) {
        const t = raw.replace(/^[-']+|[-']+$/g, '');
        if (t.length < 4) continue;
        if (STOPWORDS.has(t)) continue;
        out.add(t);
    }
    return out;
}

/**
 * The closed transformation list. Each is meaning-preserving in English and
 * removes only connective or punctuation characters — never a content word.
 * `why` is printed in the report so a reviewer can audit the list itself.
 */
export const TRANSFORMS: readonly { why: string; apply: (s: string) => string }[] = [
    { why: '"Use when X" → "When X" (the imperative adds nothing a reader needs)', apply: (s) => s.replace(/^Use when /, 'When ') },
    { why: '"in order to" → "to"', apply: (s) => s.replace(/\bin order to\b/g, 'to') },
    { why: 'Oxford comma removed (house style)', apply: (s) => s.replace(/,(\s+)and\b/g, '$1and') },
    { why: 'collapsed runs of whitespace', apply: (s) => s.replace(/  +/g, ' ') },
];

/**
 * Filler still available AFTER the transforms — the chars a hand rewrite could
 * remove without touching an informative token. Deliberately generous: it
 * counts every stopword occurrence and every separator run, so a MISS reported
 * with a small budget is a strong claim and one with a large budget is an
 * invitation to rewrite by hand, not a wall.
 */
export function fillerBudget(s: string): number {
    let n = 0;
    for (const raw of s.toLowerCase().split(/([^a-z0-9'’\-]+)/)) {
        const t = raw.replace(/^[-']+|[-']+$/g, '');
        if (t.length === 0) continue;
        if (/^[^a-z0-9]+$/.test(raw) && raw.length > 1) n += raw.length - 1;
        else if (t.length < 4 || STOPWORDS.has(t)) n += t.length + 1;
    }
    return n;
}

export type Outcome = 'already_under' | 'tightened' | 'miss';

export interface Result {
    skill: string;
    before: number;
    after: number;
    outcome: Outcome;
    /** Chars of filler still removable by hand at `after`. Only set on a miss. */
    filler_left: number;
    applied: string[];
    text: string | null;
}

export function tighten(skill: string, desc: string, cap: number): Result {
    const before = desc.length;
    if (before <= cap) {
        return { skill, before, after: before, outcome: 'already_under', filler_left: 0, applied: [], text: null };
    }
    const want = informativeTokens(desc);
    let cur = desc;
    const applied: string[] = [];
    for (const t of TRANSFORMS) {
        const next = t.apply(cur).trim();
        if (next === cur) continue;
        // Reject any transformation that moved the informative set, even if it
        // shortened the string. A same-length swap is still a routing change.
        const got = informativeTokens(next);
        if (got.size !== want.size || [...want].some((w) => !got.has(w))) continue;
        cur = next;
        applied.push(t.why);
    }
    if (cur.length <= cap) {
        return { skill, before, after: cur.length, outcome: 'tightened', filler_left: 0, applied, text: cur };
    }
    return {
        skill,
        before,
        after: cur.length,
        outcome: 'miss',
        filler_left: fillerBudget(cur),
        applied,
        text: null,
    };
}

const DESC_RE = /^(description:[ \t]*)(.*?)[ \t]*$/m;

function unquote(v: string): { text: string; quote: string } {
    const q = v.length > 1 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0] ? String(v[0]) : '';
    return { text: q ? v.slice(1, -1) : v, quote: q };
}

interface Skill {
    name: string;
    file: string;
    raw: string;
    desc: string;
    quote: string;
}

function collect(root: string): Skill[] {
    const out: Skill[] = [];
    if (!fs.existsSync(root)) return out;
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const file = path.join(root, d.name, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        const raw = fs.readFileSync(file, 'utf-8');
        const m = DESC_RE.exec(raw);
        if (m === null) continue;
        const { text, quote } = unquote(String(m[2]));
        out.push({ name: d.name, file, raw, desc: text, quote });
    }
    return out;
}

function selfTest(): number {
    const cases: { name: string; desc: string; cap: number; outcome: Outcome; after?: number }[] = [
        { name: 'under cap is untouched', desc: 'Short one.', cap: 189, outcome: 'already_under' },
        {
            name: 'the Use-when prefix is the cheapest real win',
            desc: 'Use when ' + 'x'.repeat(184),
            cap: 189,
            outcome: 'tightened',
            after: 189,
        },
        {
            name: 'nothing to remove is a miss, not a silent truncation',
            desc: 'sqlinjection '.repeat(16),
            cap: 100,
            outcome: 'miss',
        },
    ];
    let pass = 0;
    let fail = 0;
    for (const c of cases) {
        const r = tighten(c.name, c.desc, c.cap);
        const ok = r.outcome === c.outcome && (c.after === undefined || r.after === c.after);
        if (ok) pass += 1;
        else {
            fail += 1;
            console.error(`❌ ${c.name}: outcome=${r.outcome} after=${r.after}`);
        }
    }
    // The load-bearing guard: a transformation that changed the informative
    // set must be refused even though it shortens.
    const before = informativeTokens('deploy kubernetes manifests');
    const after = informativeTokens('deploy kubernetes manifest');
    if (before.size === after.size && [...before].every((t) => after.has(t))) {
        fail += 1;
        console.error('❌ informativeTokens: singular/plural must NOT compare equal — the guard would let a word change through');
    } else {
        pass += 1;
    }
    process.stdout.write(`tighten_skill_descriptions --self-test: ${pass} pass, ${fail} fail\n`);
    return fail === 0 ? 0 : 1;
}

function main(argv: string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const capIdx = argv.indexOf('--cap');
    const cap = capIdx >= 0 && argv[capIdx + 1] !== undefined ? Number(argv[capIdx + 1]) : 189;
    if (!Number.isInteger(cap) || cap < 40) {
        process.stderr.write('--cap must be an integer ≥ 40\n');
        return 1;
    }
    const apply = argv.includes('--apply');
    const skills = collect(SRC_SKILLS());
    if (skills.length === 0) {
        process.stderr.write(`no skills found under ${SRC_SKILLS()} — refusing to report a zero\n`);
        return 1;
    }
    const results = skills.map((s) => tighten(s.name, s.desc, cap));
    const wins = results.filter((r) => r.outcome === 'tightened');
    const misses = results.filter((r) => r.outcome === 'miss');

    if (apply) {
        for (const r of wins) {
            const s = skills.find((x) => x.name === r.skill);
            if (s === undefined || r.text === null) continue;
            const replaced = s.raw.replace(DESC_RE, (_m, k: string) => `${k}${s.quote}${String(r.text)}${s.quote}`);
            fs.writeFileSync(s.file, replaced);
        }
    }

    const savedChars = wins.reduce((a, r) => a + (r.before - r.after), 0);
    process.stdout.write(`cap ${cap} · ${skills.length} skill(s)\n`);
    process.stdout.write(`tightened: ${wins.length} (${savedChars} chars, ≈${Math.round(savedChars / 4)} tok)${apply ? ' — WRITTEN' : ' — dry run'}\n`);
    process.stdout.write(
        `misses:    ${misses.length} (left alone — the closed transformation list did not reach the cap)\n`,
    );
    if (misses.length > 0) {
        const need = Math.max(...misses.map((m) => m.after - cap));
        const minFiller = Math.min(...misses.map((m) => m.filler_left));
        process.stdout.write(
            minFiller > need
                ? `           read the table: every miss still holds ≥ ${minFiller} chars of filler against a need of ≤ ${need}, ` +
                      'so these are limits of THIS tool, not trigger-loss walls. A hand rewrite is available.\n'
                : '           at least one miss is close to its filler floor — there a cut would start taking informative tokens.\n',
        );
    }
    if (misses.length > 0) {
        process.stdout.write('\n| skill | len | over | filler left |\n|---|---|---|---|\n');
        for (const m of misses.sort((a, b) => b.after - a.after)) {
            process.stdout.write(`| \`${m.skill}\` | ${m.after} | +${m.after - cap} | ${m.filler_left} |\n`);
        }
    }
    process.stdout.write(`scanned: ${skills.length}\n`);
    return 0;
}

if (process.argv[1] !== undefined && process.argv[1].includes('tighten_skill_descriptions')) {
    process.exit(main(process.argv.slice(2)));
}
