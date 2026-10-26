#!/usr/bin/env tsx
/**
 * Routing traces from this machine's own sessions — `road-to-routing-assurance-live-floors`
 * 5.1 (the ledger), 5.2 (the drain that proposes corpus candidates) and the
 * read side of 5.4.
 *
 * The host already records every session: the prompt the human typed, the
 * skill listing it delivered, and each `Skill` call. This reads those records
 * in a batch — no daemon, no new hook — and keeps one row per prompt.
 *
 * ```
 * PROMPT TEXT STAYS ON THIS MACHINE. THE LEDGER IS GITIGNORED.
 * AN EXPORT CARRIES HASHES AND SKILL NAMES, NEVER FREE TEXT.
 * A CANDIDATE LANDS IN A CORPUS ONLY WITH A NAMED MAINTAINER'S CONFIRMATION.
 * ```
 *
 * Why not a new hook concern: the bundled dispatcher has almost no byte
 * headroom, and the transcript already carries all three fields 5.1 names —
 * a second recorder would duplicate a record the host writes anyway.
 *
 * Usage:
 *   routing_trace_ledger --harvest [--sessions DIR]... [--ledger PATH]
 *   routing_trace_ledger --export PATH [--ledger PATH]
 *   routing_trace_ledger --propose [--ledger PATH] [--candidates PATH]
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { readCorpus } from './compile_trigger_evals.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
export const LEDGER_DIR = path.join(REPO_ROOT, 'agents', 'runtime', 'routing-traces');
export const DEFAULT_LEDGER = path.join(LEDGER_DIR, 'ledger.jsonl');
export const DEFAULT_CANDIDATES = path.join(LEDGER_DIR, 'candidates.jsonl');

function sha256(s: string): string {
    return createHash('sha256').update(s).digest('hex');
}

/** One prompt and what its turn consulted. */
export interface TraceRow {
    session_id: string;
    turn_idx: number;
    /** Verbatim — 5.2 matches it against the corpus. Never exported. */
    prompt: string;
    prompt_sha256: string;
    /** Skill names called through the Skill tool before the next prompt, namespace stripped. */
    invoked: string[];
    /** sha256 over the sorted names of the last skill listing delivered, or null. */
    catalogue_sha256: string | null;
}

/** The export shape: every field a hash, an id, a count or a skill name. */
export type ExportRow = Omit<TraceRow, 'prompt'>;

const LISTING_LINE = /^-\s+([a-z0-9][a-z0-9:_-]+):\s/gm;

function obj(v: unknown): Record<string, unknown> | null {
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** A human prompt, or null for tool results, meta lines and command bodies. */
function promptOf(entry: Record<string, unknown>): string | null {
    if (entry['type'] !== 'user' || entry['isMeta'] === true) return null;
    const content = obj(entry['message'])?.['content'];
    if (typeof content === 'string') return content.trim() === '' ? null : content;
    return null;
}

/** Rows for one session transcript (JSONL text). */
export function harvestSession(jsonl: string, sessionId: string): TraceRow[] {
    const rows: TraceRow[] = [];
    let listing: string | null = null;
    let current: TraceRow | null = null;
    for (const line of jsonl.split('\n')) {
        if (line.trim() === '') continue;
        let entry: Record<string, unknown> | null;
        try {
            entry = obj(JSON.parse(line));
        } catch {
            continue;
        }
        if (entry === null) continue;
        const att = obj(entry['attachment']);
        if (att?.['type'] === 'skill_listing' && typeof att['content'] === 'string') {
            const names = [...(att['content'] as string).matchAll(LISTING_LINE)].map((m) => m[1] as string).sort();
            listing = sha256(names.join('\n'));
            continue;
        }
        const prompt = promptOf(entry);
        if (prompt !== null) {
            current = {
                session_id: sessionId,
                turn_idx: rows.length,
                prompt,
                prompt_sha256: sha256(prompt),
                invoked: [],
                catalogue_sha256: listing,
            };
            rows.push(current);
            continue;
        }
        if (entry['type'] !== 'assistant' || current === null) continue;
        const content = obj(entry['message'])?.['content'];
        if (!Array.isArray(content)) continue;
        for (const c of content) {
            const o = obj(c);
            const skill = obj(o?.['input'])?.['skill'];
            if (o?.['type'] === 'tool_use' && o['name'] === 'Skill' && typeof skill === 'string') {
                current.invoked.push(skill.replace(/^[^:]*:/, ''));
            }
        }
    }
    return rows;
}

/** Every `*.jsonl` directly under each directory, sorted. */
export function sessionFiles(dirs: readonly string[]): string[] {
    const out: string[] = [];
    for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        for (const n of fs.readdirSync(d).sort()) if (n.endsWith('.jsonl')) out.push(path.join(d, n));
    }
    return out;
}

/** This checkout's own transcript directories: the project and its worktrees. */
export function ownSessionDirs(repo: string = REPO_ROOT): string[] {
    const base = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(base)) return [];
    const slug = repo.replace(/[/.]/g, '-');
    const root = slug.replace(/--claude-worktrees-.*$/, '');
    return fs
        .readdirSync(base)
        .filter((n) => n === root || n.startsWith(`${root}--claude-worktrees-`))
        .map((n) => path.join(base, n));
}

function readLedger(file: string): TraceRow[] {
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as TraceRow);
}

/**
 * Refuse a ledger path git would track. The ledger holds prompt text, and a
 * convention is not a mechanism — git decides what is tracked.
 */
export function refuseTrackedLedger(file: string, repo: string = REPO_ROOT): void {
    const rel = path.relative(repo, path.resolve(file));
    if (rel.startsWith('..') || path.isAbsolute(rel)) return;
    const { status } = spawnSync('git', ['-C', repo, 'check-ignore', '-q', path.resolve(file)]);
    if (status !== 0 && status !== 128) {
        throw new Error(`routing_trace_ledger: ${rel} is not gitignored — the ledger holds prompt text and never leaves the machine`);
    }
}

/** Append new rows, deduplicated on (session, turn). Returns the count added. */
export function appendRows(file: string, rows: readonly TraceRow[]): number {
    refuseTrackedLedger(file);
    const seen = new Set(readLedger(file).map((r) => `${r.session_id}\0${String(r.turn_idx)}`));
    const fresh = rows.filter((r) => !seen.has(`${r.session_id}\0${String(r.turn_idx)}`));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, fresh.map((r) => JSON.stringify(r) + '\n').join(''));
    return fresh.length;
}

/** The export: the prompt removed, everything else kept. */
export function exportRows(rows: readonly TraceRow[]): ExportRow[] {
    return rows.map(({ prompt: _prompt, ...rest }) => rest);
}

/** A proposed corpus addition: a prompt that invoked a skill its corpus does not hold. */
export interface Candidate {
    skill: string;
    prompt: string;
    prompt_sha256: string;
    source: { session_id: string; turn_idx: number };
    /** null until a maintainer confirms; a candidate without it cannot land. */
    confirmed_by: string | null;
}

function norm(s: string): string {
    return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * 5.2 — recall blind spots: rows where a skill was invoked but that skill's
 * corpus has no positive matching the prompt. One candidate per (skill,
 * prompt). Only skills that carry a corpus are proposed against — a skill with
 * none is a coverage gap the 0.3 ratchet owns, not a candidate.
 */
export function proposeCandidates(rows: readonly TraceRow[], skillsRoot: string): Candidate[] {
    const positives = new Map<string, Set<string>>();
    for (const q of readCorpus(skillsRoot)) {
        if (!q.trigger) continue;
        const set = positives.get(q.skill) ?? new Set<string>();
        set.add(norm(q.query));
        positives.set(q.skill, set);
    }
    const out = new Map<string, Candidate>();
    for (const r of rows) {
        for (const skill of new Set(r.invoked)) {
            const known = positives.get(skill);
            if (known === undefined || known.has(norm(r.prompt))) continue;
            const key = `${skill}\0${r.prompt_sha256}`;
            if (!out.has(key)) {
                out.set(key, {
                    skill,
                    prompt: r.prompt,
                    prompt_sha256: r.prompt_sha256,
                    source: { session_id: r.session_id, turn_idx: r.turn_idx },
                    confirmed_by: null,
                });
            }
        }
    }
    return [...out.values()];
}

/**
 * Land a confirmed candidate as a positive in its skill's `triggers.json`.
 * Refuses an unconfirmed one: the drain proposes, a maintainer decides.
 */
export function landCandidate(c: Candidate, skillsRoot: string, id: string): void {
    if (c.confirmed_by === null || c.confirmed_by.trim() === '') {
        throw new Error(`landCandidate: ${c.skill}/${c.prompt_sha256.slice(0, 12)} is unconfirmed — a maintainer confirms before it lands`);
    }
    const file = path.join(skillsRoot, c.skill, 'evals', 'triggers.json');
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { queries?: unknown[] };
    if (!Array.isArray(doc.queries)) {
        throw new Error(`landCandidate: ${c.skill} uses the should_trigger shape; land by hand`);
    }
    doc.queries.push({ id, q: c.prompt, trigger: true, class: 'exemplar', source: 'trace' });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
}

function arg(argv: readonly string[], name: string): string | null {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && i + 1 < argv.length ? (argv[i + 1] as string) : null;
}

function args(argv: readonly string[], name: string): string[] {
    const out: string[] = [];
    argv.forEach((a, i) => {
        if (a === `--${name}` && i + 1 < argv.length) out.push(argv[i + 1] as string);
    });
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const ledger = arg(argv, 'ledger') ?? DEFAULT_LEDGER;
    if (argv.includes('--harvest')) {
        const dirs = args(argv, 'sessions');
        const files = sessionFiles(dirs.length > 0 ? dirs : ownSessionDirs());
        const rows = files.flatMap((f) => harvestSession(fs.readFileSync(f, 'utf8'), path.basename(f, '.jsonl')));
        const added = appendRows(ledger, rows);
        process.stdout.write(
            `routing_trace_ledger: ${String(files.length)} session(s), ${String(rows.length)} prompt(s), ` +
                `${String(rows.filter((r) => r.invoked.length > 0).length)} with a skill call, ${String(added)} new -> ${ledger}\n`,
        );
        return 0;
    }
    const exportPath = arg(argv, 'export');
    if (exportPath !== null) {
        const rows = exportRows(readLedger(ledger));
        fs.writeFileSync(exportPath, rows.map((r) => JSON.stringify(r) + '\n').join(''));
        process.stdout.write(`routing_trace_ledger: exported ${String(rows.length)} row(s), no prompt text -> ${exportPath}\n`);
        return 0;
    }
    if (argv.includes('--propose')) {
        const out = arg(argv, 'candidates') ?? DEFAULT_CANDIDATES;
        refuseTrackedLedger(out);
        const candidates = proposeCandidates(readLedger(ledger), arg(argv, 'skills') ?? path.join(REPO_ROOT, 'src', 'skills'));
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, candidates.map((c) => JSON.stringify(c) + '\n').join(''));
        process.stdout.write(
            `routing_trace_ledger: ${String(candidates.length)} unconfirmed candidate(s) -> ${out}\n` +
                'Nothing lands until a maintainer sets confirmed_by.\n',
        );
        return 0;
    }
    process.stderr.write('usage: routing_trace_ledger --harvest | --export PATH | --propose\n');
    return 2;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
