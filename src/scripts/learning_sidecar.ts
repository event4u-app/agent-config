#!/usr/bin/env tsx
/**
 * Learning sidecar — decay + corroboration + dead-end verdicting over the
 * memory intake JSONL (road-to-retrieval-substrate-hardening B3).
 *
 * `memory_signal` appends raw signals to `agents/memory/intake/signals-*.jsonl`
 * but nothing verdicts them: a one-off note and a pattern seen across five
 * sessions look identical to a reader. This aggregator turns the raw stream
 * into a verdict overlay:
 *
 *   - **Decay** — each signal contributes `0.5^(ageDays/30)` (30-day
 *     half-life from a fixed `now`), so stale signals fade.
 *   - **Corroboration** — a lesson is PROMOTED only at ≥2 distinct origins;
 *     a single session can never mint a lesson (council Q2 hard condition).
 *   - **Contested-by-recency** — when a subject carries conflicting claims,
 *     the most-recent claim resolves the verdict, flagged `contested`.
 *   - **Dead ends** — signals marked `polarity: dead_end` (in the record's
 *     extra) roll up into a "don't re-derive" ledger.
 *
 * Output is a gitignored sidecar (council Q2: intake-derived, local-only, NO
 * merge=union; proven lessons are MANUALLY curated into committed memory, never
 * auto-promoted) — it NEVER mutates the curated YAML truths. Deterministic:
 * byte-stable for a fixed `now` + a fixed intake set.
 *
 * `--format status` is the third, human-facing view (road-to-learning-you-can-
 * see Phase 2): the verdict counts, the top `preferred` lessons with their
 * corroboration and age, and the sentence saying what a promotion requires. It
 * is a FORMAT and not a verb (decision D2 cites ADR-041) — `memory:learn`
 * passes argv straight through, so a format needs no registry row — and it is
 * read-only to the point of refusing `--write` rather than ignoring it.
 *
 * Usage: learning_sidecar.ts [--intake-dir DIR] [--out-dir DIR] [--now ISO]
 *                            [--write] [--format text|json|status]
 * Exit codes: 0 ok, 2 usage error, 3 internal error.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const PROG = 'learning_sidecar.ts';

/** Half-life of a signal's weight, in days. */
export const HALF_LIFE_DAYS = 30;
/** Distinct origins required before a lesson is promoted. */
export const MIN_CORROBORATIONS = 2;
// cache-invalidation: regenerated wholesale from the intake JSONL on every run
// (no incremental/partial state); the in-file `schema_version` field is the
// format gate, so the path needs no version namespace (versioned-cache lint B5b).
export const SIDECAR_NAME = '.agent-learning.json';
export const LESSONS_NAME = 'LESSONS.md';
export const SCHEMA_VERSION = 1;

export type Polarity = 'preferred' | 'dead_end';
export type Verdict = 'preferred' | 'contested' | 'dead_end';

/** The output formats. `status` is the one-screen human view (read-only). */
export const FORMATS = ['text', 'json', 'status'] as const;
export type Format = (typeof FORMATS)[number];

export interface Signal {
    id: string;
    ts: string;
    tsMs: number;
    origin: string;
    entryType: string;
    path: string;
    body: string;
    polarity: Polarity;
}

export interface Lesson {
    entry_type: string;
    path: string;
    verdict: Verdict;
    score: number;
    corroborations: number;
    last_ts: string;
    body: string;
}

export interface Sidecar {
    schema_version: number;
    generated_at: string;
    lessons: Lesson[];
}

function _parseTsMs(ts: string): number | null {
    const t = Date.parse(ts);
    return Number.isNaN(t) ? null : t;
}

function _bodyHash(body: string): string {
    return createHash('sha256').update(body.trim().toLowerCase()).digest('hex').slice(0, 12);
}

function _globSignalFiles(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    return names
        .filter((n) => n.startsWith('signals-') && n.endsWith('.jsonl'))
        .sort()
        .map((n) => path.join(dir, n));
}

/** Read + normalise every well-formed signal record. Malformed lines skipped. */
export function readSignals(intakeDir: string): Signal[] {
    const out: Signal[] = [];
    for (const file of _globSignalFiles(intakeDir)) {
        let content: string;
        try {
            content = fs.readFileSync(file, 'utf-8');
        } catch {
            continue;
        }
        for (const raw of content.split('\n')) {
            const line = raw.trim();
            if (!line) continue;
            let obj: unknown;
            try {
                obj = JSON.parse(line);
            } catch {
                continue;
            }
            if (typeof obj !== 'object' || obj === null) continue;
            const r = obj as Record<string, unknown>;
            const ts = typeof r['ts'] === 'string' ? r['ts'] : '';
            const tsMs = _parseTsMs(ts);
            const entryType = typeof r['entry_type'] === 'string' ? r['entry_type'] : '';
            const p = typeof r['path'] === 'string' ? r['path'] : '';
            const body = typeof r['body'] === 'string' ? r['body'] : '';
            if (tsMs === null || !entryType || !p || !body) continue;
            const pol = r['polarity'] === 'dead_end' ? 'dead_end' : 'preferred';
            out.push({
                id: typeof r['id'] === 'string' ? r['id'] : '',
                ts,
                tsMs,
                origin: typeof r['origin'] === 'string' ? r['origin'] : 'unknown',
                entryType,
                path: p,
                body,
                polarity: pol,
            });
        }
    }
    return out;
}

/** Deterministic verdict rollup over the signal set at a fixed `now`. */
export function aggregate(signals: readonly Signal[], nowMs: number): Lesson[] {
    const halfLifeMs = HALF_LIFE_DAYS * 24 * 60 * 60 * 1000;
    // group key → claim bodyHash → aggregated claim
    const groups = new Map<
        string,
        {
            entryType: string;
            path: string;
            claims: Map<
                string,
                { body: string; polarity: Polarity; origins: Set<string>; score: number; lastMs: number; lastTs: string }
            >;
        }
    >();

    for (const s of signals) {
        const gk = `${s.entryType}\0${s.path}`;
        let g = groups.get(gk);
        if (g === undefined) {
            g = { entryType: s.entryType, path: s.path, claims: new Map() };
            groups.set(gk, g);
        }
        const ck = _bodyHash(s.body);
        let c = g.claims.get(ck);
        if (c === undefined) {
            c = { body: s.body, polarity: s.polarity, origins: new Set(), score: 0, lastMs: -1, lastTs: '' };
            g.claims.set(ck, c);
        }
        // Weight decays with age; future-dated signals are clamped to weight 1.
        const ageMs = Math.max(0, nowMs - s.tsMs);
        c.score += Math.pow(0.5, ageMs / halfLifeMs);
        c.origins.add(s.origin);
        if (s.tsMs > c.lastMs) {
            c.lastMs = s.tsMs;
            c.lastTs = s.ts;
            c.polarity = s.polarity; // most-recent signal sets the claim polarity
        }
    }

    const lessons: Lesson[] = [];
    for (const g of groups.values()) {
        const claims = [...g.claims.values()].sort(
            (a, b) => b.score - a.score || b.lastMs - a.lastMs || (a.body < b.body ? -1 : 1),
        );
        const top = claims[0];
        if (top === undefined) continue;
        const corroborations = top.origins.size;
        // A lesson needs ≥2 distinct origins — a single session never mints one.
        if (corroborations < MIN_CORROBORATIONS) continue;

        // Contested when a second claim is ALSO corroborated (≥2 origins) — the
        // subject has competing, independently-seen positions; recency resolves
        // which body is surfaced, but the verdict is flagged contested.
        const secondCorroborated = claims.slice(1).some((c) => c.origins.size >= MIN_CORROBORATIONS);
        let verdict: Verdict;
        if (secondCorroborated) verdict = 'contested';
        else if (top.polarity === 'dead_end') verdict = 'dead_end';
        else verdict = 'preferred';

        lessons.push({
            entry_type: g.entryType,
            path: g.path,
            verdict,
            score: Math.round(top.score * 1000) / 1000,
            corroborations,
            last_ts: top.lastTs,
            body: top.body,
        });
    }
    // Stable order: by type, then path.
    lessons.sort((a, b) =>
        a.entry_type < b.entry_type
            ? -1
            : a.entry_type > b.entry_type
              ? 1
              : a.path < b.path
                ? -1
                : a.path > b.path
                  ? 1
                  : 0,
    );
    return lessons;
}

export function buildSidecar(intakeDir: string, nowIso: string): Sidecar {
    return buildSidecarFromSignals(readSignals(intakeDir), nowIso);
}

/**
 * The half of `buildSidecar` that does not read the disk.
 *
 * Split out for a caller that needs BOTH the input count and the output
 * lessons from one pass — the session-end dogfood ledger records `signals_in`
 * beside `lessons_out`, and reading the intake twice to get them would make the
 * two numbers describe two different reads under the 2 s budget they exist to
 * measure.
 */
export function buildSidecarFromSignals(signals: readonly Signal[], nowIso: string): Sidecar {
    const nowMs = _parseTsMs(nowIso) ?? 0;
    return { schema_version: SCHEMA_VERSION, generated_at: nowIso, lessons: aggregate(signals, nowMs) };
}

/** Render the human dead-ends + contested ledger. */
export function renderLessonsMd(sidecar: Sidecar): string {
    const dead = sidecar.lessons.filter((l) => l.verdict === 'dead_end');
    const contested = sidecar.lessons.filter((l) => l.verdict === 'contested');
    const L: string[] = [];
    L.push('# Lessons (generated — do not edit)');
    L.push('');
    L.push(`> Regenerated from the intake signal log by \`${PROG}\`. Local-only,`);
    L.push('> intake-derived; never a substitute for curated memory. Proven lessons');
    L.push('> should be MANUALLY promoted into `agents/memory/<type>/*.yml`.');
    L.push('');
    L.push('## Known dead ends — don\'t re-derive');
    L.push('');
    if (dead.length === 0) {
        L.push('_None corroborated yet._');
    } else {
        for (const l of dead) L.push(`- \`${l.entry_type}\` @ \`${l.path}\` — ${l.body}`);
    }
    L.push('');
    L.push('## Contested — recency-resolved, verify before relying');
    L.push('');
    if (contested.length === 0) {
        L.push('_None._');
    } else {
        for (const l of contested) L.push(`- \`${l.entry_type}\` @ \`${l.path}\` — ${l.body}`);
    }
    L.push('');
    return L.join('\n');
}

/** How many `preferred` lessons the status screen lists before it stops. */
export const STATUS_TOP_N = 5;

/**
 * The human step. Printed as the LAST line of the status screen, because this
 * tree writes no rule and no skill on its own: a lesson becomes a durable
 * artefact only when a person carries it through `/memory:propose` or the
 * `learning-to-rule-or-skill` skill. A list of preferred lessons is one flag
 * away from `--apply`, and naming the hand-off on every screen is the cheapest
 * standing answer to "why is there no button".
 */
export const PROMOTION_HANDOFF =
    'Promote by hand: /memory:propose · src/skills/learning-to-rule-or-skill/SKILL.md';

/**
 * One screen answering "what has this learned?" — verdict counts, the top
 * `preferred` lessons with their corroboration and age, and what a promotion
 * requires. READ ONLY by construction: it takes a built sidecar and returns a
 * string, so there is no path from this function to the disk.
 */
export function renderStatus(sidecar: Sidecar): string {
    const byVerdict: Record<Verdict, number> = { preferred: 0, contested: 0, dead_end: 0 };
    for (const l of sidecar.lessons) byVerdict[l.verdict] += 1;

    const nowMs = _parseTsMs(sidecar.generated_at) ?? 0;
    const L: string[] = [];
    L.push(`${PROG}: ${String(sidecar.lessons.length)} lesson(s) as of ${sidecar.generated_at}`);
    L.push(
        `preferred: ${String(byVerdict.preferred)} · ` +
            `contested: ${String(byVerdict.contested)} · ` +
            `dead-end: ${String(byVerdict.dead_end)}`,
    );
    L.push('');

    const preferred = sidecar.lessons
        .filter((l) => l.verdict === 'preferred')
        .sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : 1))
        .slice(0, STATUS_TOP_N);
    L.push(`Top ${String(STATUS_TOP_N)} preferred:`);
    if (preferred.length === 0) {
        L.push('  (none — a lesson needs corroboration before it appears here)');
    } else {
        preferred.forEach((l, i) => {
            // Age is floored, so a lesson seen hours ago reads `0d old` rather
            // than rounding up into a day it has not lived.
            const ageDays = Math.max(0, Math.floor((nowMs - (_parseTsMs(l.last_ts) ?? nowMs)) / 86400000));
            L.push(
                `  ${String(i + 1)}. ${l.entry_type} @ ${l.path} — ` +
                    `${String(l.corroborations)} origins, ${String(ageDays)}d old`,
            );
            L.push(`     ${l.body}`);
        });
    }
    L.push('');
    L.push(
        `A lesson is promoted at ${String(MIN_CORROBORATIONS)} distinct origins, ` +
            `weighted by a ${String(HALF_LIFE_DAYS)}-day half-life; nothing here promotes itself.`,
    );
    L.push(PROMOTION_HANDOFF);
    return `${L.join('\n')}\n`;
}

export function main(argv: string[]): number {
    let intakeDir = path.join('agents', 'memory', 'intake');
    let outDir = path.join('agents', 'memory');
    let nowIso = '';
    let write = false;
    let format: Format = 'text';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--intake-dir') intakeDir = argv[++i] ?? intakeDir;
        else if (a === '--out-dir') outDir = argv[++i] ?? outDir;
        else if (a === '--now') nowIso = argv[++i] ?? '';
        else if (a === '--write') write = true;
        else if (a === '--format') {
            const raw = argv[++i] ?? '';
            // Validated rather than cast. With two formats an unknown value
            // fell through to `text` and looked like it had worked; with three,
            // a typo in `status` would silently print the one-line text form
            // and a reader would take that for the screen they asked for.
            if (!(FORMATS as readonly string[]).includes(raw)) {
                process.stderr.write(
                    `${PROG}: error: argument --format: invalid choice: '${raw}' ` +
                        `(choose from ${FORMATS.map((f) => `'${f}'`).join(', ')})\n`,
                );
                return 2;
            }
            format = raw as Format;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                `usage: ${PROG} [--intake-dir DIR] [--out-dir DIR] [--now ISO] [--write] ` +
                    `[--format ${FORMATS.join('|')}]\n`,
            );
            return 0;
        } else {
            process.stderr.write(`${PROG}: error: unknown argument ${a}\n`);
            return 2;
        }
    }
    if (format === 'status' && write) {
        // Refused, not ignored. The acceptance criterion is that the screen
        // leaves `git status` identical; ignoring the flag would honour that
        // too, but it would do so silently, and a caller who asked for a write
        // deserves to be told it did not happen.
        process.stderr.write(`${PROG}: error: --format status is read-only; drop --write\n`);
        return 2;
    }
    if (!nowIso) {
        // Deterministic by contract: refuse to guess `now` from the clock when
        // writing, so output is reproducible. Callers pass --now explicitly.
        nowIso = new Date(0).toISOString();
    }

    let sidecar: Sidecar;
    try {
        sidecar = buildSidecar(intakeDir, nowIso);
    } catch (exc) {
        process.stderr.write(`${PROG}: internal error: ${String(exc)}\n`);
        return 3;
    }

    if (write) {
        fs.mkdirSync(outDir, { recursive: true });
        // cache-invalidation: regenerated wholesale from the intake JSONL on
        // every run; the `schema_version` field is the format gate. No stale
        // partial state to version-namespace (versioned-cache lint B5b).
        fs.writeFileSync(path.join(outDir, SIDECAR_NAME), JSON.stringify(sidecar, null, 2) + '\n');
        fs.writeFileSync(path.join(outDir, LESSONS_NAME), renderLessonsMd(sidecar));
    }
    if (format === 'json') {
        process.stdout.write(JSON.stringify(sidecar, null, 2) + '\n');
        return 0;
    }
    if (format === 'status') {
        process.stdout.write(renderStatus(sidecar));
        return 0;
    }
    const byVerdict = { preferred: 0, contested: 0, dead_end: 0 };
    for (const l of sidecar.lessons) byVerdict[l.verdict] += 1;
    process.stdout.write(
        `${PROG}: ${sidecar.lessons.length} lesson(s) — ` +
            `${byVerdict.preferred} preferred, ${byVerdict.contested} contested, ${byVerdict.dead_end} dead-end` +
            `${write ? ' (written)' : ''}\n`,
    );
    return 0;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _bundled = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
if (!_bundled && fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
    process.exit(main(process.argv.slice(2)));
}
