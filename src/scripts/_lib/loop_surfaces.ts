/**
 * The loop-surface inventory, and the reach question it exists to answer.
 *
 * Why an inventory at all.
 *
 * `archive/road-to-wired-instruments.md` closed four instances of one defect —
 * an instrument this repository built, tested, and then connected to nothing —
 * one instance at a time, and shipped five hand-written `grep` acceptance
 * criteria instead of a detector. Two further instances were open the whole
 * time and nothing in the tree could notice them. This module is the reader
 * half of the fix: a declared list of loop surfaces and the exported helpers
 * they are supposed to call, plus the one predicate that says whether a
 * declared helper is called by anything at all.
 *
 * What it is NOT.
 *
 * Reader input. Nothing executes from it, no surface changes behaviour because
 * of it, and there is no runner. That is Risk 3 of the roadmap that introduced
 * it, stated as a constraint rather than a hope: the moment something
 * dispatches off this file it has become the loop engine a recorded decision
 * forbids.
 *
 * The reach predicate, and the correction that shaped it.
 *
 * The obvious predicate — "no file other than its own imports this export" —
 * was measured against `loop_guards.ts` and calls nine of its fourteen exports
 * dead. Most of those are wrong: a helper used by its own neighbours in the
 * same file is reached every time that file is. So the criterion is
 * occurrence-based and counts the declaration itself:
 *
 *     an export is DEAD when it appears in `src/` exactly once,
 *     including its own declaration.
 *
 * Two is enough, deliberately. A second occurrence anywhere in `src/` means
 * some production line names it; whether that line sits in the same file or
 * another one is not a difference this predicate needs to resolve, and
 * resolving it would mean writing a second import resolver.
 *
 * `tests/` is outside `src/` and therefore outside the count by construction —
 * which is the point. A test-only caller is exactly the state both open
 * instances are in.
 *
 * Why `cap` accepts a markdown anchor as well as a symbol.
 *
 * The roadmap step that specified this file asked for `file:symbol` and
 * "never prose". Reproduced against the tree on 2026-09-13, that is
 * unsatisfiable for two of the five surfaces and a category error for both:
 * `verify-repair-loop` and `experiment-loop` are SKILLS, and a skill's bound
 * is a documented knob, not a TypeScript constant. `grep -rn max_attempts
 * src/` returns hits only inside the skill's own directory.
 *
 * The property that requirement was reaching for is preserved exactly:
 * a bound must resolve to something that demonstrably EXISTS. So a `.ts`
 * target must be a defined symbol, a `.md` target must be a literal token
 * present in that file, and a markdown-bound row must additionally declare
 * `bound_kind: prose` — the prose-ness is recorded rather than inferred, and
 * `inventoryVerdict` reports those surfaces as a named set so a prose bound
 * can never be read as equal to a code one.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

export const INVENTORY_REL = 'src/config/loop-surfaces.yaml';

/** Fields every surface row must carry. Order is the order they are reported in. */
export const SURFACE_FIELDS = [
    'cap',
    'no_progress',
    'success_stop',
    'checker',
    'human_gate',
    'terminal_vocabulary',
    'production_consumers',
] as const;

export type SurfaceField = (typeof SURFACE_FIELDS)[number];

/** A loop surface — a thing that iterates under a bound. */
export interface LoopSurface {
    id: string;
    /** `code` or `prose` — which kind of artefact the surface itself is. */
    kind: string;
    /** `code` when `cap`/`no_progress` name symbols, `prose` when they name doc anchors. */
    bound_kind: string;
    cap: string;
    no_progress: string;
    success_stop: string;
    checker: string;
    human_gate: string;
    terminal_vocabulary: string;
    production_consumers: string[];
}

/**
 * An exported helper a surface is meant to call.
 *
 * Separated from surfaces because the reach question only applies here: a
 * surface is reached by being bound (a hook slot, a skill invocation), an
 * instrument is reached by being called, and only the second is answerable by
 * counting occurrences of a symbol.
 */
export interface LoopInstrument {
    id: string;
    file: string;
    role: string;
    /** `experimental` exempts it from the reach requirement — with a deadline. */
    status?: string | undefined;
    /** ISO `YYYY-MM-DD`. Required under `status: experimental`; a past date reds. */
    expires?: string | undefined;
    note?: string | undefined;
}

export interface Inventory {
    surfaces: LoopSurface[];
    instruments: LoopInstrument[];
}

/** `path/to/file.ts:SYMBOL` or `path/to/file.md:ANCHOR`. */
const BOUND_TARGET = /^([A-Za-z0-9_./-]+\.(?:ts|js|md)):([A-Za-z_$][A-Za-z0-9_$-]*)$/;

function str(row: Record<string, unknown>, key: string): string {
    const v = row[key];
    return v === undefined || v === null ? '' : String(v);
}

export function readInventory(root: string): Inventory | null {
    const p = path.join(root, INVENTORY_REL);
    if (!fs.existsSync(p)) return null;
    const doc = parseYaml(fs.readFileSync(p, 'utf-8')) as {
        surfaces?: Record<string, Record<string, unknown>>;
        instruments?: Record<string, Record<string, unknown>>;
    } | null;

    const surfaces: LoopSurface[] = [];
    for (const [id, row] of Object.entries(doc?.surfaces ?? {})) {
        surfaces.push({
            id,
            kind: str(row, 'kind'),
            bound_kind: str(row, 'bound_kind'),
            cap: str(row, 'cap'),
            no_progress: str(row, 'no_progress'),
            success_stop: str(row, 'success_stop'),
            checker: str(row, 'checker'),
            human_gate: str(row, 'human_gate'),
            terminal_vocabulary: str(row, 'terminal_vocabulary'),
            production_consumers: Array.isArray(row['production_consumers'])
                ? (row['production_consumers'] as unknown[]).map(String)
                : [],
        });
    }

    const instruments: LoopInstrument[] = [];
    for (const [id, row] of Object.entries(doc?.instruments ?? {})) {
        instruments.push({
            id,
            file: str(row, 'file'),
            role: str(row, 'role'),
            status: row['status'] === undefined ? undefined : String(row['status']),
            expires: row['expires'] === undefined ? undefined : String(row['expires']),
            note: row['note'] === undefined ? undefined : String(row['note']),
        });
    }

    surfaces.sort((a, b) => a.id.localeCompare(b.id));
    instruments.sort((a, b) => a.id.localeCompare(b.id));
    return { surfaces, instruments };
}

/** Every `.ts` / `.js` file under `src/`, sorted. Cached per root. */
const sourceCache = new Map<string, string[]>();

export function sourceFiles(root: string): string[] {
    const hit = sourceCache.get(root);
    if (hit !== undefined) return hit;
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name === 'node_modules') continue;
                walk(full);
            } else if (e.name.endsWith('.ts') || e.name.endsWith('.js')) {
                out.push(full);
            }
        }
    };
    walk(path.join(root, 'src'));
    sourceCache.set(root, out);
    return out;
}

/** Drop the file-list cache. The self-test builds throwaway trees. */
export function resetSourceCache(): void {
    sourceCache.clear();
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * How many times `symbol` occurs anywhere under `src/`, declaration included.
 *
 * Word-bounded, so `stallSignal` does not match `stallSignalled`. Deliberately
 * text-level: a symbol resolver would have to model re-exports, barrel files
 * and type-only imports to beat this, and would then be a second
 * implementation of the compiler. The loose version's failure mode is a count
 * that is too HIGH — reporting a dead export as live, which is the quiet
 * direction. It never manufactures an accusation.
 */
export function occurrences(root: string, symbol: string): number {
    if (symbol === '') return 0;
    const re = new RegExp(`\\b${escapeRe(symbol)}\\b`, 'g');
    let n = 0;
    for (const f of sourceFiles(root)) {
        n += (fs.readFileSync(f, 'utf-8').match(re) ?? []).length;
    }
    return n;
}

/** Does `file` DEFINE `symbol` (a `.ts` target) or merely contain it (a `.md` anchor)? */
export function resolvesTarget(root: string, file: string, token: string): boolean {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) return false;
    const text = fs.readFileSync(p, 'utf-8');
    const esc = escapeRe(token);
    if (file.endsWith('.md')) return new RegExp(`\\b${esc}\\b`).test(text);
    const decl = new RegExp(`\\b(?:const|let|var|function|interface|type|class|enum)\\s+${esc}\\b`);
    if (decl.test(text)) return true;
    // Object keys, union members and class fields: `TOKEN:` / `TOKEN(` at line start.
    return new RegExp(`^\\s*(?:readonly\\s+)?${esc}\\s*[:(]`, 'm').test(text);
}

export interface ReachFinding {
    id: string;
    file: string;
    /** `dead` · `expired` · `no-expiry` · `bad-status` — why it reds. */
    reason: string;
    detail: string;
}

export interface ShapeFinding {
    id: string;
    reason: string;
    detail: string;
}

export interface InventoryVerdict {
    /** Surfaces with a missing field, or a bound that resolves to nothing. */
    shape: ShapeFinding[];
    /** Declared instruments with no production consumer and no valid exemption. */
    reach: ReachFinding[];
    /** Instruments reported live — the does-not-over-fire evidence. */
    live: string[];
    /** Instruments held by a valid, unexpired `experimental` exemption. */
    exempt: string[];
    /** Surfaces whose bound is documented prose, not a code symbol. Reported, never red. */
    proseBound: string[];
}

/** An instrument is reached when it occurs more than once in `src/`. */
export const REACH_MINIMUM_OCCURRENCES = 2;

const BOUND_FIELDS = ['cap', 'no_progress'] as const;

function checkSurface(root: string, s: LoopSurface, shape: ShapeFinding[]): void {
    for (const f of SURFACE_FIELDS) {
        const v = s[f];
        const empty = Array.isArray(v) ? v.length === 0 : String(v).trim() === '';
        if (empty) shape.push({ id: s.id, reason: 'missing-field', detail: `\`${f}\` is empty` });
    }
    if (s.bound_kind !== 'code' && s.bound_kind !== 'prose') {
        shape.push({
            id: s.id,
            reason: 'bad-bound-kind',
            detail: `\`bound_kind: ${s.bound_kind}\` — must be \`code\` or \`prose\``,
        });
    }
    for (const f of BOUND_FIELDS) {
        const raw = String(s[f]).trim();
        if (raw === '') continue;
        const m = BOUND_TARGET.exec(raw);
        if (m === null) {
            shape.push({
                id: s.id,
                reason: 'not-a-target',
                detail: `\`${f}: ${raw}\` is not \`path/to/file.{ts,js,md}:TOKEN\``,
            });
            continue;
        }
        const [, file, token] = m as unknown as [string, string, string];
        // A markdown bound must SAY it is prose. Undeclared, it would read as a
        // code bound in every report that aggregates this file.
        if (file.endsWith('.md') && s.bound_kind !== 'prose') {
            shape.push({
                id: s.id,
                reason: 'undeclared-prose-bound',
                detail: `\`${f}\` points into ${file} but the row is \`bound_kind: ${s.bound_kind}\``,
            });
        }
        if (!resolvesTarget(root, file, token)) {
            shape.push({
                id: s.id,
                reason: 'unresolved-target',
                detail: `\`${f}\` names ${token} in ${file}, which does not carry it`,
            });
        }
    }
}

function checkInstrument(root: string, i: LoopInstrument, day: string, v: InventoryVerdict): void {
    if (i.status !== undefined && i.status !== 'experimental') {
        v.reach.push({
            id: i.id,
            file: i.file,
            reason: 'bad-status',
            detail: `\`status: ${i.status}\` is not a recognised exemption (only \`experimental\`)`,
        });
        return;
    }
    if (i.status === 'experimental') {
        const exp = (i.expires ?? '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) {
            v.reach.push({
                id: i.id,
                file: i.file,
                reason: 'no-expiry',
                detail: 'an `experimental` exemption needs `expires: YYYY-MM-DD`',
            });
            return;
        }
        if (exp <= day) {
            v.reach.push({
                id: i.id,
                file: i.file,
                reason: 'expired',
                detail: `the \`experimental\` exemption lapsed on ${exp} — decide, or move the date with a reason`,
            });
            return;
        }
        v.exempt.push(i.id);
        return;
    }
    const n = occurrences(root, i.id);
    if (n < REACH_MINIMUM_OCCURRENCES) {
        v.reach.push({
            id: i.id,
            file: i.file,
            reason: 'dead',
            detail: `occurs ${String(n)}× in src/ (own declaration included) — nothing calls it`,
        });
    } else {
        v.live.push(i.id);
    }
}

export function inventoryVerdict(root: string, today = new Date()): InventoryVerdict {
    const v: InventoryVerdict = { shape: [], reach: [], live: [], exempt: [], proseBound: [] };
    const inv = readInventory(root);
    if (inv === null) return v;

    for (const s of inv.surfaces) {
        checkSurface(root, s, v.shape);
        if (s.bound_kind === 'prose') v.proseBound.push(s.id);
    }
    const day = today.toISOString().slice(0, 10);
    for (const i of inv.instruments) checkInstrument(root, i, day, v);

    v.live.sort();
    v.exempt.sort();
    v.proseBound.sort();
    return v;
}
