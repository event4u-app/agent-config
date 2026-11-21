/**
 * The decision-asks census: every ask that reached a human, who produced it,
 * what impact class the router would give it, and how the human answered.
 *
 * `probe_unblocked_ask` measures one malformed-ask class and excludes asks
 * that carry a numbered block. This module counts ALL asks, blocks included,
 * because the question here is not "was the ask well-formed" but "should it
 * have reached the owner at all". It is the library half; the CLI flags live on
 * `probe_unblocked_ask --all-asks`.
 *
 * Privacy: an {@link AskRow} keeps the ask's closing lines in memory so a
 * labeller can read them on stdout and fixtures can be emitted through the
 * low-impact redactor. Nothing here writes that text into the census artefact;
 * the artefact is counts and opaque ids only.
 */
import fs from 'node:fs';
import path from 'node:path';

import { classify_impact, type ImpactClass } from '../ai_council/necessity.js';
import { redact_low_impact_entry } from '../ai_council/redact_low_impact_entry.js';
import { classifyBucket } from './cc_transcript.js';
import { is_claude_builtin_name } from './claude_builtin_names.js';
import { isSyntheticPrompt } from './prompt_shape.js';

/** A numbered-options block. Same shape as `probe_unblocked_ask.NUMBERED_BLOCK`. */
const BLOCK = /^\s{0,3}(\d+)[.)]\s+\S/m;

/** The recommendation line and the option number it names, either language. */
const REC_NUMBER = /^\s{0,3}\**\s*(?:Recommendation|Empfehlung)\s*:?\**\s*(?:option\s+|\*\*)?(\d+)/im;

/** Replies that accept whatever the agent proposed, without picking a number. */
const CONTINUE_REPLY = /^(mach weiter|weiter|ok|okay|ja|yes|go)$/i; // md-language-check: ignore

export type ReplyClass = 'confirmed-recommendation' | 'overrode' | 'picked' | 'redirected';
export type SessionKind = 'interactive' | 'headless' | 'subagent';
export type CascadeLabel = 'dominant' | 'contested-technical' | 'owner-four' | 'other-owner-row';
export const CASCADE_LABELS: readonly CascadeLabel[] = [
    'dominant',
    'contested-technical',
    'owner-four',
    'other-owner-row',
];

/** The option number a recommendation line names, or null. */
export function recommendedNumber(text: string): number | null {
    const m = REC_NUMBER.exec(text);
    return m ? Number(m[1]) : null;
}

/** How the human answered an ask. */
export function classifyReply(askTail: string, reply: string): ReplyClass {
    const r = reply.trim().replace(/[.!\s]+$/u, '');
    if (CONTINUE_REPLY.test(r)) return 'confirmed-recommendation';
    if (/^\d+$/.test(r)) {
        const rec = recommendedNumber(askTail);
        if (rec === null) return 'picked';
        return Number(r) === rec ? 'confirmed-recommendation' : 'overrode';
    }
    return 'redirected';
}

/** True when the closing lines hand a decision: a numbered block or an offer shape. */
export function isAsk(tail: string, offerShapes: readonly RegExp[]): boolean {
    return BLOCK.test(tail) || offerShapes.some((re) => re.test(tail));
}

export interface AskRow {
    /** First eight characters of the session id. */
    session: string;
    /** Index of the asking turn in the session's turn list. */
    turn: number;
    producer: string;
    sessionKind: SessionKind;
    impact: ImpactClass;
    reply: ReplyClass;
    hasBlock: boolean;
    /** Closing lines of the ask. In memory only, never written to the artefact. */
    tail: string;
    /** The session belongs to this package's own project store. In memory only. */
    own: boolean;
}

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    kind: SessionKind;
    /** A slash command or Skill call carried by this turn, if any. */
    producer: string | null;
    genuine: boolean;
}

const COMMAND_NAME = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/;

let knownProducers: Set<string> | null = null;

/**
 * Command and skill names this package ships, read from `src/` under the
 * current directory. A producer outside this set is reported as
 * `other-project`: a consumer project's own skill name is not this package's
 * to publish in a tracked artefact, and it is not a producer this roadmap can
 * point at a cascade.
 */
function packageProducers(): Set<string> {
    if (knownProducers !== null) return knownProducers;
    const out = new Set<string>();
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const en of entries) {
            const full = path.join(dir, en.name);
            if (en.isDirectory()) walk(full);
            else if (en.name === 'command.md') {
                const segs = path.relative('src/domains', dir).split(path.sep);
                const [a, b] = [segs.at(-2), segs.at(-1)];
                if (b !== undefined) out.add(b);
                if (a !== undefined && b !== undefined) out.add(`${a}:${b}`);
            }
        }
    };
    walk(path.join('src', 'domains'));
    try {
        for (const d of fs.readdirSync(path.join('src', 'skills'))) out.add(d);
    } catch {
        // no skills tree here: every skill reads as other-project
    }
    knownProducers = out;
    return out;
}

/**
 * The producer a slash command or Skill call names, normalised: a host
 * built-in (`/clear`, `/model`) resets to `freeform`, a package name keeps its
 * colon form without the slash, anything else is `other-project`.
 */
export function normaliseProducer(raw: string): string {
    const name = raw.replace(/^\//, '');
    if (is_claude_builtin_name(name) || name === 'btw') return 'freeform';
    return packageProducers().has(name) ? name : 'other-project';
}

function textOf(content: unknown): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
        .filter((b: { type?: string }) => b?.type === 'text')
        .map((b: { text?: string }) => b.text ?? '')
        .join('\n');
}

function skillOf(content: unknown): string | null {
    if (!Array.isArray(content)) return null;
    let found: string | null = null;
    for (const b of content as Array<{ type?: string; name?: string; input?: { skill?: unknown } }>) {
        if (b?.type === 'tool_use' && b.name === 'Skill' && typeof b.input?.skill === 'string') {
            found = b.input.skill;
        }
    }
    return found;
}

/** Parse transcript lines into the turns the census reads. */
export function parseTurns(lines: Iterable<string>): Turn[] {
    const out: Turn[] = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        let e: Record<string, unknown>;
        try {
            e = JSON.parse(line) as Record<string, unknown>;
        } catch {
            continue;
        }
        if (e['isCompactSummary'] === true) continue;
        if (e['type'] === 'user' && e['toolUseResult'] !== undefined) continue;
        const msg = e['message'] as { role?: string; content?: unknown } | undefined;
        const role = msg?.role;
        if (role !== 'user' && role !== 'assistant') continue;
        const kind: SessionKind =
            classifyBucket(e as Parameters<typeof classifyBucket>[0]) === 'subagent'
                ? 'subagent'
                : e['entrypoint'] === 'sdk-cli'
                  ? 'headless'
                  : 'interactive';
        const text = textOf(msg?.content);
        const cmd = role === 'user' ? COMMAND_NAME.exec(text)?.[1] ?? null : null;
        const rawProducer = cmd !== null ? cmd : role === 'assistant' ? skillOf(msg?.content) : null;
        const producer = rawProducer === null ? null : normaliseProducer(rawProducer);
        const genuine =
            role === 'user'
                ? text.trim() !== '' && !isSyntheticPrompt(text) && !/^(Base directory for this skill|<command-|<local-command|<task-notification)/.test(text)
                : text.trim() !== '';
        if (!genuine && producer === null) continue;
        out.push({ role, text, kind, producer, genuine });
    }
    return out;
}

/** Every ask in one session's turns. */
export function asksInTurns(
    ts: readonly Turn[],
    session: string,
    offerShapes: readonly RegExp[],
    own = false,
): AskRow[] {
    const rows: AskRow[] = [];
    let producer = 'freeform';
    for (let i = 0; i < ts.length; i += 1) {
        const t = ts[i] as Turn;
        if (t.producer !== null) producer = t.producer;
        if (t.role !== 'assistant' || !t.genuine) continue;
        const next = ts.slice(i + 1).find((n) => n.genuine);
        if (next === undefined || next.role !== 'user') continue;
        const tail = t.text.trimEnd().split('\n').slice(-12).join('\n');
        if (!isAsk(tail, offerShapes)) continue;
        rows.push({
            session,
            turn: i,
            producer,
            sessionKind: t.kind,
            impact: classify_impact(tail).impact_class,
            reply: classifyReply(tail, next.text),
            hasBlock: BLOCK.test(tail),
            tail,
            own,
        });
    }
    return rows;
}

/** Read a file line by line without holding it as one string (stores reach hundreds of MB). */
export function* fileLines(file: string): Generator<string> {
    const fd = fs.openSync(file, 'r');
    try {
        const buf = Buffer.alloc(1 << 20);
        let rest = '';
        for (;;) {
            const n = fs.readSync(fd, buf, 0, buf.length, null);
            if (n === 0) break;
            const chunk = rest + buf.toString('utf8', 0, n);
            const parts = chunk.split('\n');
            rest = parts.pop() ?? '';
            yield* parts;
        }
        if (rest) yield rest;
    } finally {
        fs.closeSync(fd);
    }
}

function listJsonl(root: string): string[] {
    const out: string[] = [];
    const stack = [root];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const en of entries) {
            const full = path.join(dir, en.name);
            if (en.isDirectory()) stack.push(full);
            else if (en.isFile() && en.name.endsWith('.jsonl') && !/\.orphaned-/.test(en.name)) out.push(full);
        }
    }
    return out.sort();
}

export interface CensusResult {
    stores: string[];
    files: number;
    /** Session files seen in more than one store, counted once. */
    duplicates: number;
    rows: AskRow[];
}

/** Scan every store; a session id seen twice (a symlinked or copied store) counts once. */
export function census(stores: readonly string[], offerShapes: readonly RegExp[]): CensusResult {
    const seen = new Set<string>();
    const res: CensusResult = { stores: [...stores], files: 0, duplicates: 0, rows: [] };
    for (const store of stores) {
        for (const file of listJsonl(store)) {
            const id = path.relative(store, file).split(path.sep).slice(-3).join('/');
            const key = path.basename(file) + (file.includes(`${path.sep}subagents${path.sep}`) ? `@${id}` : '');
            if (seen.has(key)) {
                res.duplicates += 1;
                continue;
            }
            seen.add(key);
            res.files += 1;
            const session = path.basename(file, '.jsonl').replace(/^agent-/, '').slice(0, 8);
            const own = /event4u-agent-config/.test(file);
            res.rows.push(...asksInTurns(parseTurns(fileLines(file)), session, offerShapes, own));
        }
    }
    return res;
}

/** Deterministic PRNG so a seeded sample is reproducible. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** The owner-reaching asks: interactive sessions only. */
export function ownerReaching(rows: readonly AskRow[]): AskRow[] {
    return rows.filter((r) => r.sessionKind === 'interactive');
}

/** A seeded sample of the owner-reaching asks; every ask when there are fewer than `n`. */
export function sample(rows: readonly AskRow[], n: number, seed: number): AskRow[] {
    const pool = ownerReaching(rows).sort((a, b) => a.session.localeCompare(b.session) || a.turn - b.turn);
    const rnd = mulberry32(seed);
    for (let i = pool.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rnd() * (i + 1));
        [pool[i], pool[j]] = [pool[j] as AskRow, pool[i] as AskRow];
    }
    return pool.slice(0, n);
}

function tally<K extends string>(rows: readonly AskRow[], key: (r: AskRow) => K): Array<[K, number]> {
    const m = new Map<K, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export interface RenderOptions {
    commit: string;
    date: string;
    command: string;
    reported: number;
    sampleRows: readonly AskRow[];
    seed: number;
    labels?: ReadonlyMap<string, { label: CascadeLabel; by: string }>;
    /** The instruction the labeller received, recorded with its verdicts (`evaluator-independence`). */
    labelPrompt?: string;
}

export const sampleKey = (r: Pick<AskRow, 'session' | 'turn'>): string => `${r.session}#${String(r.turn)}`;

/** The census artefact: counts and opaque ids, never transcript text. */
export function renderCensus(res: CensusResult, o: RenderOptions): string {
    const owner = ownerReaching(res.rows);
    const lines: string[] = [
        '<!-- evidence-type: analysis -->',
        '',
        `# Decision-asks census — ${o.date}`,
        '',
        '| Field | Value |',
        '|---|---|',
        `| Commit | \`${o.commit}\` |`,
        `| Command | \`${o.command}\` |`,
        `| Stores | ${String(res.stores.length)} (${res.stores.map((s) => `\`${s.replace(/^\/Users\/[^/]+/, '~')}\``).join(', ')}) |`,
        `| Session files | ${String(res.files)} read, ${String(res.duplicates)} duplicate(s) skipped |`,
        '',
        'Generated by `probe_unblocked_ask --all-asks --write`. Counts and opaque ids only: no',
        'transcript text is written here (`domain-safety-pii`).',
        '',
        '## Total',
        '',
        `measured: ${String(owner.length)} · reported: ${String(o.reported)}`,
        '',
        `All asks across every session kind: ${String(res.rows.length)}. Owner-reaching means an ask in an`,
        'interactive session answered by a genuine user turn; headless (`sdk-cli`) and subagent asks',
        'are answered by a script or an orchestrator, not the owner.',
        '',
        `The closest like-for-like figure to the reported one ("answered mostly with 1 or mach weiter") is`,
        `the confirmed-recommendation count: ${String(owner.filter((r) => r.reply === 'confirmed-recommendation').length)}.`,
        '',
        'Why the measured total differs from the reported one: the reported figure came from a',
        'throughput analysis with no recorded derivation. This census counts every hand-back whose',
        'closing lines carry a numbered block or an offer shape, over every local store, once per',
        'session id, over the full retention window of each store. Any gap is therefore a',
        'difference in window, in what counts as an ask, or in deduplication, and the reported',
        'figure cannot be re-derived to say which.',
        '',
        '## By session kind',
        '',
        '| Kind | Asks |',
        '|---|---|',
        ...tally(res.rows, (r) => r.sessionKind).map(([k, n]) => `| ${k} | ${String(n)} |`),
        '',
        '## Owner-reaching asks by reply',
        '',
        '| Reply | Asks |',
        '|---|---|',
        ...tally(owner, (r) => r.reply).map(([k, n]) => `| ${k} | ${String(n)} |`),
        '',
        '## Owner-reaching asks by impact class',
        '',
        '| Impact | Asks |',
        '|---|---|',
        ...tally(owner, (r) => r.impact).map(([k, n]) => `| ${k} | ${String(n)} |`),
        '',
        '## Owner-reaching asks by producer (top 15)',
        '',
        '| Producer | Asks |',
        '|---|---|',
        ...tally(owner, (r) => r.producer).slice(0, 15).map(([k, n]) => `| \`${k}\` | ${String(n)} |`),
        '',
    ];
    if (o.sampleRows.length > 0) {
        lines.push(
            `## Label sheet (seed ${String(o.seed)}, ${String(o.sampleRows.length)} rows)`,
            '',
            'Labels: `dominant` (one option dominates, the agent should decide), `contested-technical`',
            '(a real technical trade-off, the council decides), `owner-four` (purpose, lowering a',
            'safety floor, irreversible, money above a delegated cap), `other-owner-row` (an owner',
            'row outside the four). The labeller is a session that did not write the census.',
            '',
            '| Row | Ask | Producer | Impact | Reply | Label | Labeller |',
            '|---|---|---|---|---|---|---|',
        );
        o.sampleRows.forEach((r, i) => {
            const l = o.labels?.get(sampleKey(r));
            lines.push(
                `| S${String(i + 1).padStart(2, '0')} | \`${sampleKey(r)}\` | \`${r.producer}\` | ${r.impact} | ${r.reply} | ${l?.label ?? '?'} | ${l?.by ?? '?'} |`,
            );
        });
        lines.push('');
        if (o.labelPrompt !== undefined) {
            lines.push(
                '### The labeller\'s instruction',
                '',
                'Recorded verbatim. The sample text followed it on stdin, produced by the same command with',
                '`--show-sample`, so it is reproducible without being stored here.',
                '',
                '~~~text',
                o.labelPrompt.trim(),
                '~~~',
                '',
            );
        }
        const ranking = producerRanking(o.sampleRows, o.labels);
        if (ranking.length > 0) {
            lines.push(
                '## Producer ranking',
                '',
                'Labelled rows marked `dominant` or `contested-technical` that reached the owner, per',
                'producer: where pointing an ask site at the cascade pays most.',
                '',
                '| Producer | Rows | Share |',
                '|---|---|---|',
                ...ranking.map(([p, n, s]) => `| \`${p}\` | ${String(n)} | ${s} |`),
                '',
            );
        }
    }
    return lines.join('\n');
}

/** Producers ranked by labelled rows that should not have reached the owner. */
export function producerRanking(
    rows: readonly AskRow[],
    labels: ReadonlyMap<string, { label: CascadeLabel; by: string }> | undefined,
): Array<[string, number, string]> {
    if (!labels) return [];
    const misrouted = rows.filter((r) => {
        const l = labels.get(sampleKey(r))?.label;
        return l === 'dominant' || l === 'contested-technical';
    });
    const total = misrouted.length;
    return tally(misrouted, (r) => r.producer).map(([p, n]) => [p, n, `${((100 * n) / Math.max(total, 1)).toFixed(0)} %`]);
}

/** Labels read back from an artefact's label sheet, keyed by `session#turn`. */
export function readLabels(artefact: string): Map<string, { label: CascadeLabel; by: string }> {
    const out = new Map<string, { label: CascadeLabel; by: string }>();
    for (const line of artefact.split('\n')) {
        const m = /^\| S\d+ \| `([^`]+)` \|.*\| ([a-z-]+|\?) \| ([^|]+) \|$/.exec(line.trim());
        if (!m) continue;
        const label = m[2] as CascadeLabel;
        if (!CASCADE_LABELS.includes(label)) continue;
        out.set(m[1] as string, { label, by: (m[3] as string).trim() });
    }
    return out;
}

export interface FixtureEmit {
    written: number;
    refused: number;
    /** Labelled rows from another project's sessions: never written into this package. */
    otherProject: number;
}

/** One fixture per labelled row; a row the low-impact redactor refuses is dropped and counted. */
export function emitFixtures(
    rows: readonly AskRow[],
    labels: ReadonlyMap<string, { label: CascadeLabel; by: string }>,
    dir: string,
): FixtureEmit {
    fs.mkdirSync(dir, { recursive: true });
    const res: FixtureEmit = { written: 0, refused: 0, otherProject: 0 };
    rows.forEach((r, i) => {
        const l = labels.get(sampleKey(r));
        if (!l) return;
        if (!r.own) {
            res.otherProject += 1;
            return;
        }
        const question = r.tail.trim();
        const foreignLink = /https?:\/\/(?!github\.com\/event4u-app\/agent-config\b)\S+/.test(question);
        if (foreignLink || !redact_low_impact_entry(question).ok) {
            res.refused += 1;
            return;
        }
        const id = `S${String(i + 1).padStart(2, '0')}`;
        fs.writeFileSync(
            path.join(dir, `${id}.md`),
            [
                '---',
                `row: ${id}`,
                `label: ${l.label}`,
                `producer: "${r.producer}"`,
                `impact: ${r.impact}`,
                `reply: ${r.reply}`,
                '---',
                '',
                question,
                '',
            ].join('\n'),
            'utf8',
        );
        res.written += 1;
    });
    return res;
}

/** Fixture frontmatter and question body, for tests that read the corpus. */
export function readFixture(file: string): { label: CascadeLabel; producer: string; question: string } {
    const raw = fs.readFileSync(file, 'utf8');
    const m = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(raw);
    const fm = m?.[1] ?? '';
    return {
        label: (/^label: (.+)$/m.exec(fm)?.[1] ?? '') as CascadeLabel,
        producer: (/^producer: "(.*)"$/m.exec(fm)?.[1] ?? ''),
        question: (m?.[2] ?? '').trim(),
    };
}

/**
 * Labels from a labeller's output (`S01 dominant` per line), keyed onto the
 * sample rows by position. Lines that name no known label are skipped.
 */
export function labelsFromLines(
    text: string,
    rows: readonly AskRow[],
    by: string,
): Map<string, { label: CascadeLabel; by: string }> {
    const out = new Map<string, { label: CascadeLabel; by: string }>();
    for (const line of text.split('\n')) {
        const m = /^S(\d+)\s+([a-z-]+)\s*$/.exec(line.trim());
        if (!m) continue;
        const row = rows[Number(m[1]) - 1];
        const label = m[2] as CascadeLabel;
        if (row === undefined || !CASCADE_LABELS.includes(label)) continue;
        out.set(sampleKey(row), { label, by });
    }
    return out;
}
