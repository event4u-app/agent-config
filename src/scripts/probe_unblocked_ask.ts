#!/usr/bin/env tsx
/**
 * The unblocked-ask rate — the class `user-interaction` measured and then had
 * no instrument for.
 *
 * ## Why this one, and not one of the other 55
 *
 * `road-to-undeclared-obligation-disposition` Phase 2.1 ranks the
 * `cheaply-probeable` bucket by MEASURED failure rather than by feel, and the
 * ranking is lopsided: of 56 rules in that bucket, exactly **one** carries a
 * cited measurement of its own failure. `user-interaction.md:75` records a
 * 30-session conformance audit in which **every** malformed ask was a one-line
 * parenthetical or a trailing free-text offer, and states that **no gate ships**
 * for that class because `check_reply_consistency` inspects numbered-option
 * blocks — "exactly the surface that did not fail".
 *
 * That is the whole case for building this and not a fourth probe. Phase 2.3
 * caps the roadmap at one.
 *
 * ## What is counted
 *
 * A **hand-back** assistant turn — one immediately followed by a genuine user
 * turn, i.e. where the agent actually stopped — that HANDS A DECISION and
 * carries **no** numbered-options block. The rule's own § "The trigger is a
 * decision, not a format" says the obligation fires on handing a decision in any
 * form, so a trailing offer is an ask and owes a recommendation line.
 *
 * Of those, an ask is **malformed** when no recommendation line follows it.
 *
 * ## Honest bounds, and they are wide
 *
 * 1. **"Hands a decision" is a heuristic.** It matches offer shapes — *"soll ich
 *    …?"*, *"shall I …?"*, *"sag Bescheid, wenn …"*, *"willst du …?"* — anchored
 *    in the closing lines. A genuine clarifying question is deliberately NOT
 *    excluded, because `user-interaction` treats a bare yes/no as an ask too.
 *    Some rhetorical questions will be counted. The rate is therefore a
 *    CEILING for malformed asks of this class, not a point estimate.
 * 2. **Turns WITH a numbered block are excluded**, not judged. That surface
 *    already has `check_reply_consistency`; measuring it here would double-count
 *    a covered class and hide the uncovered one.
 * 3. **A recommendation line is matched on the label**, `Recommendation:` or
 *    `Empfehlung:` (with or without emphasis). A recommendation phrased without
 *    the label reads as malformed here. The rule requires the label — a
 *    wrong-language label is explicitly "no recommendation" — so this is the
 *    rule's own bar, but it is a bar on FORM.
 *
 * Both edges are printed. A reader who cannot see the bracket cannot judge the
 * number.
 *
 * The `form` dimension (road-to-asked-not-parked 1.1)
 *
 * Every unblocked ask is additionally partitioned by the FORM the ask took:
 *
 *   - `native` — the same assistant turn carries a tool call whose name is a
 *     structured-ask tool (`_lib/structured_ask.ts`, `isStructuredAskTool`).
 *   - `text`   — everything else, i.e. the ask was prose.
 *
 * The two are exhaustive and disjoint by construction, so `text + native`
 * always equals `unblockedAsks`. That identity is asserted in `--self-test`
 * rather than left to a reader to check.
 *
 * Expect `native` to be **0** on every corpus this repo can scan today: no host
 * in the capability registry carries an observed structured-ask tool, and
 * `structured_ask.ts` states why matching on a name-shape pattern is not a claim
 * that any host ships one. A measured zero and an uninstrumented zero look the
 * same in a report and are not the same fact — this axis is what makes them
 * distinguishable later.
 *
 * Usage:
 *   ./scripts-run src/scripts/probe_unblocked_ask [--limit N] [--store PATH] [--json]
 *   ./scripts-run src/scripts/probe_unblocked_ask --all-asks --store PATH [--store PATH …] --write
 *   ./scripts-run src/scripts/probe_unblocked_ask --self-test
 *   ./scripts-run src/scripts/probe_unblocked_ask --help
 *
 * Exit codes: 0 always — a measurement, not a gate. `--self-test` exits 1 when
 * the detector fails to fire on its fixtures.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { defaultStore, HARNESS_TEXT, isInjectedBody } from './conformance_scan.js';
import { isStructuredAskTool } from './_lib/structured_ask.js';
import { isSyntheticPrompt } from './_lib/prompt_shape.js';
import {
    census,
    classifyReply,
    emitFixtures,
    labelsFromLines,
    normaliseProducer,
    ownerReaching,
    readLabels,
    renderCensus,
    sample,
    sampleKey,
    type AskRow,
} from './_lib/decision_asks.js';

/** A numbered-options block — the surface `check_reply_consistency` already reads. */
export const NUMBERED_BLOCK = /^\s{0,3}(\d+)[.)]\s+\S/m;

/** The recommendation line, matched on its label. Either language. */
export const RECOMMENDATION = /^\s{0,3}\**\s*(Recommendation|Empfehlung)\s*:?\**/im;

/**
 * Offer shapes that hand a decision without a block. Every one of these is a
 * shape the 2026-08-06 audit found in a REAL malformed ask.
 */
export const OFFER_SHAPES: readonly RegExp[] = [
    /\bsoll(en)? ich\b[^.!?]{0,120}\?/i,
    /\bwillst du\b[^.!?]{0,120}\?/i,
    /\bm(ö|oe)chtest du\b[^.!?]{0,120}\?/i,
    /\bsag (mir )?bescheid,? (wenn|ob|falls)\b/i,
    /\bwenn du (willst|m(ö|oe)chtest),? (dann )?(mache|kann|nehme|ziehe)\b/i,
    /\bshall i\b[^.!?]{0,120}\?/i,
    /\bshould i\b[^.!?]{0,120}\?/i,
    /\bdo you want me to\b[^.!?]{0,120}\?/i,
    /\bwould you like me to\b[^.!?]{0,120}\?/i,
    /\blet me know (if|whether)\b/i,
];

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    at: string;
    /** Tool names invoked in this turn — empty for a user turn. */
    tools: string[];
}

function turns(lines: string[]): Turn[] {
    const out: Turn[] = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        let e: Record<string, unknown>;
        try {
            e = JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue;
        }
        if (e['isSidechain'] === true) continue;
        if (e['type'] === 'user' && e['toolUseResult'] !== undefined) continue;
        if (e['isCompactSummary'] === true) continue;
        const msg = e['message'] as { role?: string; content?: unknown } | undefined;
        const role = msg?.role;
        if (role !== 'user' && role !== 'assistant') continue;
        const c = msg?.content;
        const text =
            typeof c === 'string'
                ? c
                : Array.isArray(c)
                  ? c
                        .filter((b: { type?: string }) => b?.type === 'text')
                        .map((b: { text?: string }) => b.text ?? '')
                        .join('\n')
                  : '';
        const tools = Array.isArray(c)
            ? c
                  .filter((b: { type?: string }) => b?.type === 'tool_use')
                  .map((b: { name?: string }) => String(b?.name ?? ''))
                  .filter((n: string) => n !== '')
            : [];
        if (!text.trim()) continue;
        if (role === 'assistant' && HARNESS_TEXT.test(text.trim())) continue;
        if (role === 'user' && (isSyntheticPrompt(text) || isInjectedBody(text))) continue;
        out.push({ role, text, at: String(e['timestamp'] ?? ''), tools });
    }
    return out;
}

export interface AskVerdict {
    /** The turn hands a decision with no numbered block. */
    unblockedAsk: boolean;
    /** …and carries no recommendation label. */
    malformed: boolean;
}

/** Classify one assistant hand-back's closing lines. */
export function classifyTail(tail: string): AskVerdict {
    if (NUMBERED_BLOCK.test(tail)) return { unblockedAsk: false, malformed: false };
    const offers = OFFER_SHAPES.some((re) => re.test(tail));
    if (!offers) return { unblockedAsk: false, malformed: false };
    return { unblockedAsk: true, malformed: !RECOMMENDATION.test(tail) };
}

/** The ask FORM partition. Exhaustive and disjoint: `text + native === unblockedAsks`. */
export interface FormBreakdown {
    text: number;
    native: number;
}

/**
 * Which FORM an ask took. `native` iff the turn carried a structured-ask tool
 * call; `text` otherwise. Exported so the partition is one function rather than
 * an inline condition a later edit can quietly make non-exhaustive.
 */
export function askForm(tools: readonly string[]): 'text' | 'native' {
    return tools.some((n) => isStructuredAskTool(n)) ? 'native' : 'text';
}

export interface Result {
    handbacks: number;
    withBlock: number;
    unblockedAsks: number;
    malformed: number;
    form: FormBreakdown;
    samples: { session: string; at: string; span: string }[];
}

export function measure(store: string, limit: number): Result {
    const r: Result = {
        handbacks: 0,
        withBlock: 0,
        unblockedAsks: 0,
        malformed: 0,
        form: { text: 0, native: 0 },
        samples: [],
    };
    let files: string[];
    try {
        files = fs.readdirSync(store).filter((f) => f.endsWith('.jsonl'));
    } catch {
        return r;
    }
    const ordered = files
        .map((f) => ({ f, m: fs.statSync(path.join(store, f)).mtimeMs }))
        .sort((a, b) => b.m - a.m)
        .slice(0, limit)
        .map((x) => x.f);

    for (const f of ordered) {
        const session = f.replace(/\.jsonl$/, '').slice(0, 8);
        const ts = turns(fs.readFileSync(path.join(store, f), 'utf8').split('\n'));
        for (let i = 0; i < ts.length; i += 1) {
            const t = ts[i] as Turn;
            if (t.role !== 'assistant') continue;
            const next = ts[i + 1];
            if (next !== undefined && next.role !== 'user') continue;
            r.handbacks += 1;
            // Closing lines only: an offer buried mid-reply is not the hand-back.
            const tail = t.text.trimEnd().split('\n').slice(-8).join('\n');
            if (NUMBERED_BLOCK.test(tail)) {
                r.withBlock += 1;
                continue;
            }
            const v = classifyTail(tail);
            if (!v.unblockedAsk) continue;
            r.unblockedAsks += 1;
            r.form[askForm(t.tools)] += 1;
            if (v.malformed) {
                r.malformed += 1;
                if (r.samples.length < 5) {
                    const hit = OFFER_SHAPES.find((re) => re.test(tail));
                    r.samples.push({
                        session,
                        at: t.at,
                        span: (tail.match(hit as RegExp)?.[0] ?? '').slice(0, 110),
                    });
                }
            }
        }
    }
    return r;
}

/**
 * The `--all-asks` fixtures.
 *
 * Each case drives `main` over a fixture store, the way an operator would, so a
 * missing mode fails here rather than passing on a unit that nobody calls.
 */
function allAsksSelfTest(): number {
    let failed = 0;
    const check = (ok: boolean, name: string, detail: string): void => {
        process.stdout.write(`${ok ? '✅' : '❌'}  ${name}${ok ? '' : ` — ${detail}`}\n`);
        if (!ok) failed += 1;
    };
    const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-all-asks-'));
    const mk = (role: string, content: unknown, extra: Record<string, unknown> = {}): string =>
        JSON.stringify({ type: role, timestamp: '2026-01-01T00:00:00Z', entrypoint: 'cli', ...extra, message: { role, content } });
    const block = '1. merge it\n2. hold it\n\nRecommendation: 1';
    try {
        fs.mkdirSync(path.join(fx, '-x-event4u-agent-config'), { recursive: true });
        fs.writeFileSync(
            path.join(fx, '-x-event4u-agent-config', 'aaaaaaaa-0000.jsonl'),
            [
                mk('user', '<command-name>/roadmap:next</command-name>'),
                mk('assistant', [{ type: 'text', text: block }]),
                mk('user', '1'),
                mk('assistant', [{ type: 'text', text: block }]),
                mk('user', 'mach weiter'),
                mk('assistant', [{ type: 'text', text: block }]),
                mk('user', 'weiter'),
                mk('assistant', [{ type: 'text', text: block }]),
                mk('user', 'ok'),
                mk('assistant', [{ type: 'text', text: block }]),
                mk('user', '2'),
                mk('assistant', [{ type: 'text', text: block }]),
                mk('user', 'no, open an issue instead'),
                mk('assistant', [{ type: 'text', text: 'Soll ich das so umsetzen?' }], { isSidechain: true }),
                mk('user', 'ja', { isSidechain: true }),
            ].join('\n'),
            'utf8',
        );
        let out = '';
        const write = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((chunk: string): boolean => {
            out += chunk;
            return true;
        }) as typeof process.stdout.write;
        try {
            main(['--all-asks', '--store', fx, '--json']);
        } finally {
            process.stdout.write = write;
        }
        let rows: AskRow[] = [];
        try {
            rows = (JSON.parse(out) as { rows: AskRow[] }).rows ?? [];
        } catch {
            rows = [];
        }
        const replies = rows.map((r) => r.reply);
        check(rows.filter((r) => r.hasBlock).length >= 6, 'a hand-back with a numbered block counts as an ask', `asks ${String(rows.length)}`);
        check(replies[0] === 'confirmed-recommendation', 'reply 1 to Recommendation: 1 is confirmed-recommendation', String(replies[0]));
        check(
            replies[1] === 'confirmed-recommendation' && replies[2] === 'confirmed-recommendation' && replies[3] === 'confirmed-recommendation',
            'mach weiter, weiter and ok are confirmed-recommendation',
            replies.slice(1, 4).join(','),
        );
        check(replies[4] === 'overrode', 'picking another number is overrode', String(replies[4]));
        check(replies[5] === 'redirected', 'free text is redirected', String(replies[5]));
        check(rows[6]?.sessionKind === 'subagent', 'an isSidechain turn is tagged subagent', String(rows[6]?.sessionKind));
        check(rows[0]?.producer === 'roadmap:next', 'the producer is the last slash command', String(rows[0]?.producer));
        check(classifyReply('no recommendation here', '3') === 'picked', 'a number with no recommendation is picked', '');
        const owner = ownerReaching(rows);
        const md = renderCensus(
            { stores: [fx], files: 1, duplicates: 0, rows },
            { commit: 'abc', date: '2026-01-01', command: 'x', reported: 269, sampleRows: sample(rows, 3, 1), seed: 1 },
        );
        check(md.includes(`measured: ${String(owner.length)} · reported: 269`), 'the artefact states measured next to reported', '');
        check(!md.includes('open an issue instead') && !md.includes('merge it'), 'the artefact carries no transcript text', '');
        const labelled = md.replace(/\| \? \| \? \|$/m, '| dominant | fixture-labeller |');
        const labels = readLabels(labelled);
        check(labels.size === 1, 'a filled label row reads back', String(labels.size));
        const fdir = path.join(fx, 'fixtures');
        const em = emitFixtures(sample(census([fx], OFFER_SHAPES).rows, 3, 1), labels, fdir);
        check(em.written === 1 && fs.readdirSync(fdir).length === 1, 'one fixture per labelled row', JSON.stringify(em));
        const dup = census([fx, fx], []);
        check(dup.duplicates === 1, 'a session seen in two stores counts once', String(dup.duplicates));
        check(sampleKey({ session: 'aaaaaaaa', turn: 3 }) === 'aaaaaaaa#3', 'sample keys are session#turn', '');
        check(
            normaliseProducer('/clear') === 'freeform' && normaliseProducer('some-consumer-skill') === 'other-project',
            'a host built-in resets the producer and a foreign name is other-project',
            `${normaliseProducer('/clear')} ${normaliseProducer('some-consumer-skill')}`,
        );
    } finally {
        fs.rmSync(fx, { recursive: true, force: true });
    }
    return failed;
}

/**
 * Prove the detector fires, and prove it stays silent where it must.
 *
 * An instrument never seen fire has unknown sensitivity — and one that fires on
 * everything measures nothing, which is why the negative cases are here too.
 */
export function selfTest(): number {
    const cases: Array<[string, string, boolean, boolean]> = [
        ['a trailing German offer with no recommendation', 'Fertig.\n\nSag Bescheid, wenn ich die drei Zeilen mitnehmen soll.', true, true],
        ['a bare yes/no offer', 'Der Branch ist grün.\n\nSoll ich das so umsetzen?', true, true],
        ['an English trailing offer', 'Done.\n\nLet me know if you want the second half too.', true, true],
        ['an offer WITH a recommendation label', 'Soll ich das so umsetzen?\n\n**Empfehlung:** ja, es ist reversibel.', true, false],
        ['a numbered block is excluded — another gate reads it', '1. do it\n2. skip it\n\nRecommendation: 1', false, false],
        ['an ordinary statement hands nothing', 'Fixed the schema lint; force-pushed b17c4ef8.', false, false],
        ['a question about the code is not an offer to act', 'Why does this function take a callback?', false, false],
    ];
    let failed = 0;
    for (const [name, tail, wantAsk, wantMalformed] of cases) {
        const v = classifyTail(tail);
        const ok = v.unblockedAsk === wantAsk && v.malformed === wantMalformed;
        process.stdout.write(
            `${ok ? '✅' : '❌'}  ${name} — ask=${String(v.unblockedAsk)} malformed=${String(v.malformed)}` +
                (ok ? '\n' : ` (wanted ask=${String(wantAsk)} malformed=${String(wantMalformed)})\n`),
        );
        if (!ok) failed += 1;
    }
    for (const [tools, want] of [
        [[], 'text'],
        [['Bash', 'Read'], 'text'],
        [['AskUserQuestion'], 'native'],
        [['ask_user_question'], 'native'],
    ] as Array<[string[], 'text' | 'native']>) {
        const got = askForm(tools);
        const ok = got === want;
        process.stdout.write(
            `${ok ? '✅' : '❌'}  form of [${tools.join(', ')}] — ${got}` +
                (ok ? '\n' : ` (wanted ${want})\n`),
        );
        if (!ok) failed += 1;
    }
    const fx = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-ask-form-'));
    try {
        const mk = (role: string, blocks: unknown): string =>
            JSON.stringify({ type: role, timestamp: '2026-01-01T00:00:00Z', message: { role, content: blocks } });
        fs.writeFileSync(
            path.join(fx, 'fixture.jsonl'),
            [
                mk('assistant', [{ type: 'text', text: 'Done.\n\nSoll ich das so umsetzen?' }]),
                mk('user', 'ja'),
                mk('assistant', [
                    { type: 'text', text: 'Done.\n\nShall I take the second half too?' },
                    { type: 'tool_use', name: 'AskUserQuestion' },
                ]),
                mk('user', 'ja'),
            ].join('\n'),
            'utf8',
        );
        const r = measure(fx, 10);
        const sums = r.form.text + r.form.native === r.unblockedAsks;
        process.stdout.write(
            `${sums ? '✅' : '❌'}  form partition is exhaustive — text ${String(r.form.text)} + ` +
                `native ${String(r.form.native)} = unblocked ${String(r.unblockedAsks)}\n`,
        );
        if (!sums) failed += 1;
        const split = r.form.text === 1 && r.form.native === 1;
        process.stdout.write(
            `${split ? '✅' : '❌'}  the fixture's two asks split one per class\n`,
        );
        if (!split) failed += 1;
    } finally {
        fs.rmSync(fx, { recursive: true, force: true });
    }
    failed += allAsksSelfTest();
    const positives = cases.filter((c) => c[3]).length;
    if (positives < 3) {
        process.stderr.write('❌  probe_unblocked_ask --self-test: fewer than 3 positive cases — a truncated suite must fail.\n');
        return 1;
    }
    process.stdout.write(
        `\nprobe_unblocked_ask --self-test: ${String(cases.length - failed)}/${String(cases.length)} case(s) behaved ` +
            `(${String(positives)} positive, ${String(cases.length - positives)} negative)\n`,
    );
    return failed > 0 ? 1 : 0;
}

const HELP = `probe_unblocked_ask — the unblocked-ask rate, and the FORM each ask took.

Usage:
  probe_unblocked_ask [--limit N] [--store PATH] [--json]
  probe_unblocked_ask --self-test
  probe_unblocked_ask --help

Dimensions reported:
  hand-back turns    assistant turns immediately followed by a user turn
  unblocked asks     …that hand a decision with no numbered-options block
  malformed          …of those, carrying no Recommendation:/Empfehlung: label
  form               the ask FORM partition of the unblocked asks:
                       native  the turn carried a structured-ask tool call
                       text    the ask was prose
                     text + native always equals the unblocked-ask total.
                     native is 0 wherever no host has an observed structured-ask
                     tool — a measured zero, not an uninstrumented one.

Options:
  --limit N     most recent N sessions (default 60)
  --store PATH  transcript store (default: the host's own)
  --json        emit the Result object instead of the report
  --self-test   run the detector fixtures, incl. the form-partition identity
  --help        this text

Decision-asks census:
  --all-asks              count EVERY ask, numbered blocks included, with producer,
                          session kind, impact class and reply class (default --json)
  --store PATH            repeatable; each store is scanned recursively, a session
                          id seen twice counts once
  --write [PATH]          write the census artefact (counts only, never text)
  --sample N --seed S     add a seeded label sheet of N owner-reaching asks
  --show-sample           print the sample's ask text to stdout for the labeller
  --labels FILE           read labels back from a census artefact
  --label-file FILE       read a labeller's 'S01 <label>' lines onto the sample
  --labeller ID           who labelled (recorded per row)
  --label-prompt FILE     the labeller's instruction, recorded in the artefact
  --emit-fixtures DIR     one redacted fixture per labelled row (needs --labels)
  --reported N            the figure the census is reconciled against (default 269)
`;

/**
 * `--all-asks`: the decision-asks census. Every ask, blocks included, with its
 * producer, session kind, impact class and reply class.
 */
function allAsksMain(o: {
    stores: string[];
    json: boolean;
    write: string | null;
    sampleN: number;
    seed: number;
    reported: number;
    labels: string | null;
    emitFixtures: string | null;
    showSample: boolean;
    labelFile: string | null;
    labeller: string;
    labelPrompt: string | null;
}): number {
    const res = census(o.stores, OFFER_SHAPES);
    if (o.json) {
        process.stdout.write(`${JSON.stringify({ ...res, rows: res.rows.map((r) => ({ ...r, tail: undefined })) }, null, 2)}\n`);
        return 0;
    }
    const picked = o.sampleN > 0 ? sample(res.rows, o.sampleN, o.seed) : [];
    const labels =
        o.labelFile !== null
            ? labelsFromLines(fs.readFileSync(o.labelFile, 'utf8'), picked, o.labeller)
            : o.labels !== null && fs.existsSync(o.labels)
              ? readLabels(fs.readFileSync(o.labels, 'utf8'))
              : undefined;
    if (o.showSample) {
        // stdout only, for the labeller: the artefact never carries this text.
        picked.forEach((r, i) => {
            process.stdout.write(`--- S${String(i + 1).padStart(2, '0')} ${sampleKey(r)} ${r.producer} ${r.impact} ${r.reply}\n${r.tail}\n\n`);
        });
        return 0;
    }
    if (o.emitFixtures !== null) {
        if (!labels) {
            process.stderr.write('probe_unblocked_ask: --emit-fixtures needs --labels <census artefact>\n');
            return 0;
        }
        const em = emitFixtures(picked, labels, o.emitFixtures);
        process.stdout.write(
            `fixtures: ${String(em.written)} written, ${String(em.refused)} refused by the redactor, ` +
                `${String(em.otherProject)} from another project's sessions skipped\n`,
        );
        return 0;
    }
    const date = new Date().toISOString().slice(0, 10);
    let commit = 'unknown';
    try {
        commit = execFileSync('git', ['rev-parse', '--short=10', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
        // not a checkout: the artefact says so rather than inventing a pin
    }
    const md = renderCensus(res, {
        commit,
        date,
        command: `probe_unblocked_ask ${process.argv
            .slice(2)
            .join(' ')
            .replace(/\/(?:private|tmp|var)\/\S*\/([^/\s]+)/g, '<local>/$1')
            .replace(/\/Users\/[^/ ]+/g, '~')}`,
        reported: o.reported,
        sampleRows: picked,
        seed: o.seed,
        ...(labels ? { labels } : {}),
        ...(o.labelPrompt !== null ? { labelPrompt: fs.readFileSync(o.labelPrompt, 'utf8') } : {}),
    });
    const target = o.write ?? path.join('agents', 'evidence', 'analysis', `decision-asks-census-${date}.md`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${md}\n`, 'utf8');
    const owner = ownerReaching(res.rows).length;
    process.stdout.write(`decision-asks census: ${String(res.rows.length)} ask(s), ${String(owner)} owner-reaching → ${target}\n`);
    return 0;
}

export function main(argv: string[]): number {
    let limit = 60;
    let storeArg: string | null = null;
    const stores: string[] = [];
    let json = false;
    let allAsks = false;
    let write: string | null = null;
    let doWrite = false;
    let sampleN = 0;
    let seed = 20261121;
    let reported = 269;
    let labels: string | null = null;
    let fixturesDir: string | null = null;
    let showSample = false;
    let labelFile: string | null = null;
    let labeller = 'unknown';
    let labelPrompt: string | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--limit') limit = Number(argv[++i]);
        else if (a === '--store') {
            storeArg = String(argv[++i]);
            stores.push(storeArg);
        } else if (a === '--json') json = true;
        else if (a === '--all-asks') allAsks = true;
        else if (a === '--write') {
            doWrite = true;
            const nx = argv[i + 1];
            if (nx !== undefined && !nx.startsWith('--')) write = String(argv[++i]);
        } else if (a === '--sample') sampleN = Number(argv[++i]);
        else if (a === '--seed') seed = Number(argv[++i]);
        else if (a === '--reported') reported = Number(argv[++i]);
        else if (a === '--labels') labels = String(argv[++i]);
        else if (a === '--emit-fixtures') fixturesDir = String(argv[++i]);
        else if (a === '--show-sample') showSample = true;
        else if (a === '--label-file') labelFile = String(argv[++i]);
        else if (a === '--labeller') labeller = String(argv[++i]);
        else if (a === '--label-prompt') labelPrompt = String(argv[++i]);
        // --self-test runs BEFORE the store is resolved: the fixtures are
        // in-process, and resolving a transcript store that may not exist here
        // would make the sensitivity proof depend on the host having one.
        else if (a === '--self-test') return selfTest();
        else if (a === '--help' || a === '-h') {
            process.stdout.write(HELP);
            return 0;
        }
        else {
            process.stderr.write(`probe_unblocked_ask: unrecognized argument: ${a}\n`);
            return 0;
        }
    }
    if (allAsks) {
        if (!doWrite && !json && !showSample && fixturesDir === null) json = true;
        return allAsksMain({
            stores: stores.length > 0 ? stores : [defaultStore(process.cwd())],
            json,
            write,
            sampleN,
            seed,
            reported,
            labels,
            emitFixtures: fixturesDir,
            showSample,
            labelFile,
            labeller,
            labelPrompt,
        });
    }
    const store = storeArg ?? defaultStore(process.cwd());
    const r = measure(store, limit);
    if (json) {
        process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
        return 0;
    }
    const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`);
    process.stdout.write(
        `probe_unblocked_ask · ${String(limit)} most recent session(s) under ${store}\n` +
            `  hand-back turns          ${String(r.handbacks)}\n` +
            `  …with a numbered block   ${String(r.withBlock)}  (excluded — check_reply_consistency reads that surface)\n` +
            `  …unblocked asks          ${String(r.unblockedAsks)}  ${pct(r.unblockedAsks, r.handbacks)} of hand-backs\n` +
            `  …of those, malformed     ${String(r.malformed)}  ${pct(r.malformed, r.unblockedAsks)} of unblocked asks\n` +
            `  form: text               ${String(r.form.text)}  ${pct(r.form.text, r.unblockedAsks)} of unblocked asks\n` +
            `  form: native             ${String(r.form.native)}  ${pct(r.form.native, r.unblockedAsks)} of unblocked asks\n` +
            `  form: text + native      ${String(r.form.text + r.form.native)}  (must equal unblocked asks: ${String(r.unblockedAsks)})\n` +
            '\n  CEILING, not a point estimate: "hands a decision" is a heuristic and a\n' +
            '  rhetorical question can match it. A recommendation is matched on its LABEL,\n' +
            '  which is the rule\'s own bar but a bar on form.\n',
    );
    for (const s of r.samples) {
        process.stdout.write(`    · ${s.session} ${s.at}: ${s.span}\n`);
    }
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
