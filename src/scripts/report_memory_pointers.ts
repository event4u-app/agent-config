#!/usr/bin/env tsx
/**
 * Pointer-integrity report over the curated engineering memory store.
 *
 * WHY THIS EXISTS (road-to-context-fidelity Phase 2, spike cf02).
 * `memory_report` prints `staleness-rate=0.0%` over a store measured by hand at
 * **21.5 %** the same day. The 0.0 % is an artefact: all 107 entries carry the
 * same `last_validated` and the same `review_after_days: 365`, so the earliest
 * date any entry can read stale is 2027-07-09. The age axis is a check that
 * passes because it cannot fail.
 *
 * WHAT THIS IS NOT, AND THE MEASUREMENT THAT SETTLED IT.
 * This shipped as a staleness TRIAGE ranker — the council's Option 2, unanimous
 * 2/2 on 2026-08-19 — on the argument that pointer liveness would rank entries
 * for human re-verification. That claim was then measured against cf02's
 * hand-walked ground truth and **failed**: precision 0.0 % against a 20.6 %
 * base rate, recall 0.0 %, lift **0.00x** on the flagged set and 0.35x on the
 * dead-or-moved union. Worse than random, on the very corpus that motivated it.
 * The council's own pre-registered falsifier fired immediately. Full numbers and
 * reproduction: `agents/evidence/eval-findings/context-fidelity-cf04.md`.
 *
 * The mechanism is not mysterious. A curated entry's `body` is free prose, so
 * "does the tree still support this claim" is a SEMANTIC judgement no script
 * decides. What pointers measure is whether the entry's CITATIONS still resolve
 * — a different failure, and empirically an uncorrelated one. cf02 already
 * carried the counterexample: `typecheck-use-task-not-bare-tsc` cites live
 * files throughout and its stated reason is false.
 *
 * So the ranking claim is withdrawn and the name follows it. What survived
 * measurement, and all this report asserts, is pointer INTEGRITY:
 *   - `dead`        — a repo-rooted citation that resolves to nothing.
 *   - `moved`       — the file exists under a new path; re-anchor the citation.
 *   - `unparseable` — outside the grammar or gitignored; parser-coverage only.
 *   - anchor coverage — how many entries can be tied to a tree state at all.
 * Those are real documentation debt and a real prerequisite for the ladder.
 * None of them is evidence that an entry's claim is false.
 *
 * It NEVER writes to the store and NEVER demotes an entry. Demotion is
 * `memory_eviction.ts`, and the signal it acts on is a recorded HUMAN verdict.
 * Council 2026-08-19: "Automatic demotion: never from pointer-liveness or
 * anchor-drift output alone." The measurement above turned that from a
 * precaution into a finding.
 *
 * Not a gate: it always exits 0 and has no gate-coverage entry. A blocking gate
 * over a signal with 0.00x lift would be a merge blocker made of noise.
 *
 * Usage:
 *     report_memory_pointers                       # text report
 *     report_memory_pointers --format json
 *     report_memory_pointers --limit 10            # worst 10 entries only
 *     report_memory_pointers --path agents/memory
 *
 * Exit codes: 0 always (report), 3 = internal error.
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const PROG = 'report_memory_pointers.ts';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_STORE = 'agents/memory';

/** File extensions a bare path reference may carry. Bounded on purpose. */
const KNOWN_EXTENSIONS = new Set([
    '.ts', '.js', '.mjs', '.cjs', '.md', '.yml', '.yaml', '.json', '.sh', '.py', '.txt',
]);

/**
 * Pointer classes the grammar recognises. Anything backticked that looks
 * path-ish but matches no class is reported `unparseable` rather than
 * silently treated as live — council refinement 2026-08-19: "ambiguous
 * free-prose references should be reported as unparseable, not silently
 * treated as live."
 */
export type PointerKind = 'path' | 'path-line' | 'dir' | 'adr' | 'wiki-link' | 'unparseable';
/**
 * `moved` is the state that made this instrument usable at all. The first
 * measured run flagged 18 entries of which 16 cited a roadmap that had simply
 * been archived — the file exists, at a new path, and the entry's CLAIM is
 * untouched by the move. Counting those as dead put the sweep's precision
 * (2/18 = 11 %) BELOW the store's own staleness base rate (21.5 %), i.e. the
 * ranking was worse than random. Relocation-awareness is what separates
 * "this pointer rotted" from "this file moved".
 */
export type PointerState = 'live' | 'moved' | 'dead' | 'unparseable';

export interface Pointer {
    raw: string;
    kind: PointerKind;
    state: PointerState;
    /** Repo-relative path this pointer resolves to, when it resolves at all. */
    target?: string;
    /** Why a `dead` pointer is dead — the half a reader acts on. */
    detail?: string;
}

export interface EntryReport {
    id: string;
    type: string;
    status: string;
    last_validated: string;
    review_after_days: number | null;
    /** The tree revision the entry was SEMANTICALLY verified against. */
    verified_at_commit: string | null;
    anchor_state: 'present' | 'missing' | 'unresolvable';
    pointers: Pointer[];
    dead: number;
    moved: number;
    live: number;
    unparseable: number;
    /** Cited paths that changed between the anchor and HEAD. */
    drifted: string[];
    rank: number;
}

export interface SweepResult {
    scanned: number;
    entries: EntryReport[];
    stores: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A 7-40 char lowercase hex string is the only accepted anchor shape. */
export function isCommitish(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{7,40}$/.test(value);
}

/**
 * Extract candidate pointers from one entry body.
 *
 * The grammar is deliberately narrow: backtick spans, `[[wiki-links]]`, and
 * bare `ADR-NNN` ids. Prose outside backticks is never parsed — a sentence
 * naming a file is not a pointer, and treating it as one is how a triage
 * instrument starts manufacturing findings.
 */
export function extractPointers(body: string): Array<{ raw: string; kind: PointerKind }> {
    const out: Array<{ raw: string; kind: PointerKind }> = [];
    const seen = new Set<string>();

    const push = (raw: string, kind: PointerKind): void => {
        const dedupKey = `${kind} ${raw}`;
        if (seen.has(dedupKey)) return;
        seen.add(dedupKey);
        out.push({ raw, kind });
    };

    for (const m of body.matchAll(/\[\[([^\]]+)\]\]/g)) {
        push((m[1] ?? '').trim(), 'wiki-link');
    }
    for (const m of body.matchAll(/\bADR-(\d{2,4})\b/g)) {
        push(`ADR-${m[1] ?? ''}`, 'adr');
    }
    for (const m of body.matchAll(/`([^`\n]+)`/g)) {
        const raw = (m[1] ?? '').trim();
        if (!raw || /\s/.test(raw)) continue;
        // Three shapes are NOT pointers and are dropped before classification,
        // because flagging them is how a triage list stops being read:
        //   `<pack>/<name>/command.md` — a template, not a claim about a file
        //   `~/.claude/settings.json`  — outside the repo, unresolvable here
        //   `/optimize-project`        — a slash-command name, not a path
        if (raw.includes('<') || raw.includes('>')) continue;
        if (raw.includes('*')) continue; // a glob describes a set, not a file
        if (raw.startsWith('~')) continue;
        if (/^\/[A-Za-z][\w:-]*$/.test(raw)) continue;

        const lineMatch = /^([\w./@+-]+):(\d+)(?:-\d+)?$/.exec(raw);
        if (lineMatch && KNOWN_EXTENSIONS.has(path.extname(lineMatch[1] ?? ''))) {
            push(raw, 'path-line');
            continue;
        }
        // A trailing separator names a directory — mechanically resolvable and
        // worth resolving: `src/domains/` disappearing is exactly the kind of
        // structural move that invalidates a whole batch of entries at once.
        if (raw.endsWith('/') && raw.length > 1) {
            push(raw, 'dir');
            continue;
        }
        // A bare path needs a separator AND a known extension. `--flag`,
        // `some_function()`, and `task ci` are not paths and must not be
        // ranked as dead ones.
        if (raw.includes('/') && KNOWN_EXTENSIONS.has(path.extname(raw))) {
            push(raw, 'path');
            continue;
        }
        // Path-ish but unmatched: a separator and no recognised extension, or
        // an extension and no separator. Reported as parser coverage, never
        // resolved, and never ranked — see `rankOf`.
        if (raw.includes('/') || KNOWN_EXTENSIONS.has(path.extname(raw))) {
            push(raw, 'unparseable');
        }
    }
    return out;
}

/**
 * Top-level names of the repo, cached. A pointer whose first segment is not
 * one of them is a FRAGMENT (`analyze/decision.md`, `charge.ts:13`,
 * `archive/`) rather than a repo-relative path, and resolving a fragment
 * against the repo root manufactures a dead pointer out of a live claim.
 *
 * The trade-off is stated rather than hidden: this also demotes a genuinely
 * dead reference to a top-level directory that ADR-051 retired from `dead` to
 * `unparseable`, because its first segment no longer exists to match. A triage
 * instrument must under-flag rather than over-flag — an unread queue catches
 * nothing at all. (The retired directory is not named here: adding the literal
 * anywhere under `src/` is what `check_no_new_legacy_path` forbids, and a
 * docstring citing a dead path as an example is still a citation.)
 */
let _repoRootNames: Set<string> | null = null;
function repoRootNames(): Set<string> {
    if (_repoRootNames == null) {
        try {
            _repoRootNames = new Set(fs.readdirSync(REPO_ROOT));
        } catch {
            _repoRootNames = new Set();
        }
    }
    return _repoRootNames;
}

/**
 * basename → tracked paths, built once from `git ls-files`. Used to tell a
 * relocated file from a deleted one.
 */
let _basenameIndex: Map<string, string[]> | null = null;
function basenameIndex(): Map<string, string[]> {
    if (_basenameIndex == null) {
        _basenameIndex = new Map();
        const res = spawnSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
        if (res.status === 0 && typeof res.stdout === 'string') {
            for (const line of res.stdout.split('\n')) {
                const rel = line.trim();
                if (!rel) continue;
                const base = path.basename(rel);
                const bucket = _basenameIndex.get(base);
                if (bucket) bucket.push(rel);
                else _basenameIndex.set(base, [rel]);
            }
        }
    }
    return _basenameIndex;
}

/**
 * Is this path ignored by git?
 *
 * An ignored path (`agents/tmp/…`, `agents/runtime/council/responses/…`) is
 * local state that is absent from every clone by design. Its absence says
 * nothing about the entry that cites it, so reporting it as dead is a defect
 * in the instrument rather than a finding about the store — and it was the
 * single largest false-positive class in the first measured run (6 of 10).
 */
function isGitIgnored(relPath: string): boolean {
    const res = spawnSync('git', ['check-ignore', '-q', '--no-index', relPath], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
    });
    return res.status === 0;
}

function relocationsOf(relPath: string): string[] {
    return (basenameIndex().get(path.basename(relPath)) ?? []).filter((p) => p !== relPath).sort();
}

function isRepoRooted(relPath: string): boolean {
    const first = relPath.split('/')[0] ?? '';
    return first.length > 0 && repoRootNames().has(first);
}

function fileLineCount(abs: string): number {
    try {
        const text = fs.readFileSync(abs, 'utf-8');
        if (text === '') return 0;
        const n = text.split('\n').length;
        return text.endsWith('\n') ? n - 1 : n;
    } catch {
        return 0;
    }
}

function resolveAdr(id: string): string | null {
    const num = id.slice(4);
    for (const dir of ['docs/decisions', 'docs/adr']) {
        const abs = path.join(REPO_ROOT, dir);
        let names: string[];
        try {
            names = fs.readdirSync(abs);
        } catch {
            continue;
        }
        const hit = names.find((n) => n.startsWith(`ADR-${num}-`) || n === `ADR-${num}.md`);
        if (hit) return path.posix.join(dir, hit);
    }
    return null;
}

/** Resolve one candidate against the tree. Pure w.r.t. the store, not the FS. */
export function resolvePointer(
    candidate: { raw: string; kind: PointerKind },
    knownIds: ReadonlySet<string>,
): Pointer {
    const { raw, kind } = candidate;
    if (kind === 'unparseable') {
        return { raw, kind, state: 'unparseable', detail: 'no pointer class matched' };
    }
    if (kind === 'wiki-link') {
        return knownIds.has(raw)
            ? { raw, kind, state: 'live', target: raw }
            : { raw, kind, state: 'dead', detail: 'no curated entry carries this id' };
    }
    if (kind === 'adr') {
        const hit = resolveAdr(raw);
        return hit
            ? { raw, kind, state: 'live', target: hit }
            : { raw, kind, state: 'dead', detail: 'no ADR file with this number' };
    }
    const [relPath, lineStr] = kind === 'path-line' ? raw.split(':') : [raw, null];
    if (!isRepoRooted(relPath)) {
        return { raw, kind, state: 'unparseable', detail: 'not repo-rooted — first segment is not a top-level name' };
    }
    const abs = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(abs)) {
        if (isGitIgnored(relPath)) {
            return { raw, kind, state: 'unparseable', target: relPath, detail: 'gitignored — absent by design, not rotted' };
        }
        const moved = kind === 'dir' ? [] : relocationsOf(relPath);
        if (moved.length > 0) {
            return {
                raw,
                kind,
                state: 'moved',
                target: relPath,
                detail: `now at ${moved.slice(0, 2).join(', ')}${moved.length > 2 ? ` (+${moved.length - 2})` : ''}`,
            };
        }
        return { raw, kind, state: 'dead', target: relPath, detail: 'path does not exist' };
    }
    if (kind === 'dir' && !fs.statSync(abs).isDirectory()) {
        return { raw, kind, state: 'dead', target: relPath, detail: 'exists but is not a directory' };
    }
    if (kind === 'path-line' && lineStr) {
        const want = parseInt(lineStr, 10);
        const have = fileLineCount(abs);
        if (want > have) {
            return {
                raw,
                kind,
                state: 'dead',
                target: relPath,
                detail: `line ${want} is past end of file (${have} lines)`,
            };
        }
    }
    return { raw, kind, state: 'live', target: relPath };
}

/**
 * Paths cited by the entry that changed between its anchor and HEAD.
 *
 * The anchor means "the revision this entry was semantically verified
 * against", so drift is a re-verification prompt, never a staleness verdict —
 * a file can change a hundred times without touching the claim.
 */
function driftedPaths(anchor: string, targets: readonly string[]): string[] {
    if (targets.length === 0) return [];
    const res = spawnSync(
        'git',
        ['diff', '--name-only', `${anchor}..HEAD`, '--', ...targets],
        { cwd: REPO_ROOT, encoding: 'utf-8' },
    );
    if (res.status !== 0 || typeof res.stdout !== 'string') return [];
    return res.stdout.split('\n').map((s) => s.trim()).filter(Boolean).sort();
}

function anchorResolves(anchor: string): boolean {
    const res = spawnSync('git', ['cat-file', '-e', `${anchor}^{commit}`], {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
    });
    return res.status === 0;
}

function readStore(storeDir: string): Array<{ file: string; type: string; entries: Array<Record<string, unknown>> }> {
    const abs = path.isAbsolute(storeDir) ? storeDir : path.join(REPO_ROOT, storeDir);
    let names: string[];
    try {
        names = fs.readdirSync(abs).filter((n) => n.endsWith('.yml') || n.endsWith('.yaml'));
    } catch {
        return [];
    }
    names.sort();
    const out: Array<{ file: string; type: string; entries: Array<Record<string, unknown>> }> = [];
    for (const name of names) {
        const file = path.join(abs, name);
        let parsed: unknown;
        try {
            parsed = YAML.parse(fs.readFileSync(file, 'utf-8'));
        } catch {
            continue;
        }
        const entries: Array<Record<string, unknown>> = [];
        if (isPlainObject(parsed) && Array.isArray(parsed['entries'])) {
            for (const item of parsed['entries'] as unknown[]) {
                if (isPlainObject(item)) entries.push(item);
            }
        }
        out.push({
            file: path.relative(REPO_ROOT, file),
            type: name.replace(/\.(ya?ml)$/, ''),
            entries,
        });
    }
    return out;
}

function bodyOf(entry: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const f of ['body', 'rule', 'symptom', 'description', 'summary', 'key']) {
        const v = entry[f];
        if (typeof v === 'string' && v.trim()) parts.push(v);
    }
    return parts.join('\n');
}

function asString(v: unknown): string {
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
}

/**
 * Order entries by how much pointer repair they need. NOT a staleness score —
 * that claim was measured at 0.00x lift and withdrawn (see the header).
 *
 * Dead citations dominate because they are the only unambiguous integrity
 * defect. Drift and a missing anchor are weaker: they say the entry cannot be
 * re-checked cheaply, not that anything about it is wrong.
 *
 * `unparseable` deliberately contributes NOTHING. It measures the grammar's
 * coverage, not the entry's health, and the first run proved why: counting it
 * put all 107 of 107 entries in the report, which is a list nobody reads.
 */
export function rankOf(r: Omit<EntryReport, 'rank'>): number {
    return r.dead * 100 + r.moved * 2 + r.drifted.length * 5 + (r.anchor_state === 'present' ? 0 : 1);
}

/**
 * An entry is listed only on a structural defect — never on age, anchor state,
 * or parser coverage.
 *
 * `moved` is deliberately outside this predicate. A cited path that now lives
 * somewhere else is a documentation fix (re-anchor the citation), not a defect
 * in the entry, and treating the two alike is what put the first measured
 * precision below the base rate.
 */
export function isFlagged(r: Pick<EntryReport, 'dead' | 'drifted'>): boolean {
    return r.dead > 0 || r.drifted.length > 0;
}

export function sweep(storeDir: string): SweepResult {
    const stores = readStore(storeDir);
    const knownIds = new Set<string>();
    for (const s of stores) {
        for (const e of s.entries) {
            const id = asString(e['id']);
            if (id) knownIds.add(id);
        }
    }

    const reports: EntryReport[] = [];
    for (const s of stores) {
        for (const e of s.entries) {
            const candidates = extractPointers(bodyOf(e));
            const pointers = candidates.map((c) => resolvePointer(c, knownIds));
            const anchorRaw = e['verified_at_commit'];
            let anchor_state: EntryReport['anchor_state'] = 'missing';
            let verified_at_commit: string | null = null;
            let drifted: string[] = [];
            if (isCommitish(anchorRaw)) {
                verified_at_commit = anchorRaw;
                if (anchorResolves(anchorRaw)) {
                    anchor_state = 'present';
                    const targets = [
                        ...new Set(
                            pointers
                                .filter((p) => p.state === 'live' && p.target && p.kind !== 'wiki-link')
                                .map((p) => p.target as string),
                        ),
                    ].sort();
                    drifted = driftedPaths(anchorRaw, targets);
                } else {
                    anchor_state = 'unresolvable';
                }
            } else if (anchorRaw != null) {
                anchor_state = 'unresolvable';
            }

            const base: Omit<EntryReport, 'rank'> = {
                id: asString(e['id']),
                type: s.type,
                status: asString(e['status']),
                last_validated: asString(e['last_validated']),
                review_after_days: typeof e['review_after_days'] === 'number' ? (e['review_after_days'] as number) : null,
                verified_at_commit,
                anchor_state,
                pointers,
                dead: pointers.filter((p) => p.state === 'dead').length,
                moved: pointers.filter((p) => p.state === 'moved').length,
                live: pointers.filter((p) => p.state === 'live').length,
                unparseable: pointers.filter((p) => p.state === 'unparseable').length,
                drifted,
            };
            reports.push({ ...base, rank: rankOf(base) });
        }
    }

    reports.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
    return { scanned: reports.length, entries: reports, stores: stores.map((s) => s.file) };
}

function renderText(result: SweepResult, limit: number | null): string {
    const lines: string[] = [];
    const flagged = result.entries.filter((e) => isFlagged(e));
    const sum = (pick: (e: EntryReport) => number): number => result.entries.reduce((n, e) => n + pick(e), 0);
    const unparseable = sum((e) => e.unparseable);
    const resolved = sum((e) => e.live) + sum((e) => e.dead) + sum((e) => e.moved);
    const coverage = resolved + unparseable === 0 ? 100 : (resolved / (resolved + unparseable)) * 100;
    lines.push(`${PROG} · pointer integrity, NOT staleness — measured lift over base rate: 0.00x (cf04)`);
    lines.push(`scanned: ${result.scanned} entr(ies) across ${result.stores.length} store(s)`);
    lines.push(
        `flagged: ${flagged.length} · dead pointers: ${sum((e) => e.dead)}` +
            ` · moved (re-anchor, not re-verify): ${sum((e) => e.moved)}` +
            ` · missing anchor: ${result.entries.filter((e) => e.anchor_state !== 'present').length}`,
    );
    lines.push(`parser coverage: ${coverage.toFixed(1)}% (${resolved} resolved / ${unparseable} unparseable)`);
    lines.push('');
    const shown = limit == null ? flagged : flagged.slice(0, limit);
    for (const e of shown) {
        lines.push(`  [${e.rank}] ${e.type}/${e.id}`);
        for (const p of e.pointers.filter((x) => x.state === 'dead')) {
            lines.push(`        dead ${p.kind}: ${p.raw} — ${p.detail ?? ''}`);
        }
        for (const p of e.pointers.filter((x) => x.state === 'unparseable')) {
            lines.push(`        unparseable: ${p.raw}`);
        }
        if (e.drifted.length) {
            lines.push(`        drifted since ${e.verified_at_commit}: ${e.drifted.join(', ')}`);
        }
        if (e.anchor_state !== 'present') {
            lines.push(`        anchor ${e.anchor_state} — cannot tell a verified entry from a re-stamped one`);
        }
    }
    if (limit != null && flagged.length > limit) {
        lines.push(`  … ${flagged.length - limit} more (raise --limit)`);
    }
    return lines.join('\n');
}

export function main(argv: readonly string[]): number {
    let storeDir = DEFAULT_STORE;
    let format = 'text';
    let limit: number | null = null;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--path') storeDir = argv[++i] ?? DEFAULT_STORE;
        else if (a === '--format') format = argv[++i] ?? 'text';
        else if (a === '--limit') limit = parseInt(argv[++i] ?? '0', 10) || null;
        else if (a === '--help' || a === '-h') {
            process.stdout.write(
                `usage: ${PROG} [--path DIR] [--format text|json] [--limit N]\n` +
                    `Pointer integrity of curated memory entries: dead, moved,\n` +
                    `unparseable citations plus anchor coverage. NOT a staleness\n` +
                    `signal — that claim measured 0.00x lift and was withdrawn.\n` +
                    `Never writes, never demotes, always exits 0.\n`,
            );
            return 0;
        }
    }

    const result = sweep(storeDir);
    try {
        assertScanned({
            gate: PROG,
            scanned: result.scanned,
            units: 'entr(ies)',
            roots: [storeDir],
            allowEmpty: 'a consumer install may carry no curated memory at all',
        });
    } catch (e) {
        if (e instanceof DeadScopeError) {
            process.stderr.write(`${e.message}\n`);
            return 0;
        }
        throw e;
    }

    if (format === 'json') {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
        process.stdout.write(`${renderText(result, limit)}\n`);
    }
    return 0;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
    try {
        process.exit(main(process.argv.slice(2)));
    } catch (e) {
        process.stderr.write(`${PROG}: internal error: ${(e as Error).message}\n`);
        process.exit(3);
    }
}
