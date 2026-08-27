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
 * Usage:
 *   ./scripts-run src/scripts/probe_unblocked_ask [--limit N] [--store PATH] [--json]
 *   ./scripts-run src/scripts/probe_unblocked_ask --self-test
 *
 * Exit codes: 0 always — a measurement, not a gate. `--self-test` exits 1 when
 * the detector fails to fire on its fixtures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { defaultStore, HARNESS_TEXT, isInjectedBody } from './conformance_scan.js';
import { isSyntheticPrompt } from './_lib/prompt_shape.js';

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
        if (!text.trim()) continue;
        if (role === 'assistant' && HARNESS_TEXT.test(text.trim())) continue;
        if (role === 'user' && (isSyntheticPrompt(text) || isInjectedBody(text))) continue;
        out.push({ role, text, at: String(e['timestamp'] ?? '') });
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

export interface Result {
    handbacks: number;
    withBlock: number;
    unblockedAsks: number;
    malformed: number;
    samples: { session: string; at: string; span: string }[];
}

export function measure(store: string, limit: number): Result {
    const r: Result = { handbacks: 0, withBlock: 0, unblockedAsks: 0, malformed: 0, samples: [] };
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

export function main(argv: string[]): number {
    let limit = 60;
    let storeArg: string | null = null;
    let json = false;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '--limit') limit = Number(argv[++i]);
        else if (a === '--store') storeArg = String(argv[++i]);
        else if (a === '--json') json = true;
        // --self-test runs BEFORE the store is resolved: the fixtures are
        // in-process, and resolving a transcript store that may not exist here
        // would make the sensitivity proof depend on the host having one.
        else if (a === '--self-test') return selfTest();
        else {
            process.stderr.write(`probe_unblocked_ask: unrecognized argument: ${a}\n`);
            return 0;
        }
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
