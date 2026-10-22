/**
 * analysis_inbox_final.ts — what makes `analyze:inbox` the final stage of the
 * analysis doors (step 3.4, ADR-288 D1).
 *
 * - `roundUnion`: one round is the runtime round folder plus the owner's drops,
 *   read as one set; lineage comes from the round's manifest, not from
 *   filenames; an opaque round id skips the Phase 1 rename.
 * - `directiveBinding`: which turns bind, by provenance.
 * - `convergenceRow`: the final Convergence loop names every binding directive
 *   it checked, or it is refused.
 * - `planLanes` / `foldLaneLedgers`: a round above the slicing size runs as
 *   parallel lanes, each with its own census and point ledger, folded once.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { isOpaqueRoundId } from './_lib/source_shape.js';
import { DROPS_REL } from './analysis_analysts.js';
import { RUN_STATE_FILE, RUNS_REL } from './analysis_run.js';

/**
 * ADR-288 D9: the inbox's default batch threshold. Adoption rate fell as round
 * size rose over five consecutive rounds, and this is where it was cut.
 */
export const INBOX_LANE_MAX_BYTES = 400_000;
export const INBOX_LANE_MAX_TOPICS = 5;
export const ROUND_MANIFEST = 'manifest.json';

export class InboxFinalError extends Error {}

export interface RoundFile {
    rel: string;
    origin: 'runtime' | 'drop';
}

export interface RoundUnion {
    files: RoundFile[];
    lineage: Record<string, string[]>;
    renameBeforeTriage: boolean;
}

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const BOOKKEEPING = new Set([RUN_STATE_FILE, ROUND_MANIFEST]);

function listFiles(projectRoot: string, rel: string): string[] {
    const dir = path.join(projectRoot, rel);
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.')) continue;
        const r = `${rel}/${entry.name}`;
        if (entry.isDirectory()) out.push(...listFiles(projectRoot, r));
        else if (entry.isFile()) out.push(r);
    }
    return out;
}

export function roundUnion(projectRoot: string, roundId: string): RoundUnion {
    if (!SEGMENT.test(roundId) || roundId.includes('..')) {
        throw new InboxFinalError(`round id ${JSON.stringify(roundId)} is not a single folder name`);
    }
    const runtimeRel = `${RUNS_REL}/${roundId}`;
    const runtime = listFiles(projectRoot, runtimeRel)
        .filter((r) => !BOOKKEEPING.has(r.slice(runtimeRel.length + 1)))
        .map((rel): RoundFile => ({ rel, origin: 'runtime' }));
    const drops = listFiles(projectRoot, `${DROPS_REL}/${roundId}`).map((rel): RoundFile => ({ rel, origin: 'drop' }));
    let lineage: Record<string, string[]> = {};
    const manifest = path.join(projectRoot, runtimeRel, ROUND_MANIFEST);
    if (fs.existsSync(manifest)) {
        let data: { lineage?: unknown };
        try {
            data = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { lineage?: unknown };
        } catch (err) {
            throw new InboxFinalError(`${ROUND_MANIFEST} is not readable JSON (${err instanceof Error ? err.message : String(err)})`);
        }
        const raw = data.lineage ?? {};
        const isMap = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
        if (!isMap || !Object.values(raw).every((v) => Array.isArray(v) && v.every((x) => typeof x === 'string'))) {
            throw new InboxFinalError(`${ROUND_MANIFEST} carries a lineage that is not a map of file lists`);
        }
        lineage = raw as Record<string, string[]>;
    }
    return { files: [...runtime, ...drops], lineage, renameBeforeTriage: !isOpaqueRoundId(roundId) };
}

export interface Directive {
    id: string;
    role: 'user' | 'assistant';
    provenance: 'current-session' | 'transcript-structured' | 'transcript-recovered';
    text: string;
    /** Another input that contradicts this one, when there is one. */
    contradictedBy?: string;
}

/** `binds` constrains the run; `batch` joins the owner's post-action batch (step 2.7); `claim` is verified like any claim. */
export function directiveBinding(d: Directive): 'binds' | 'batch' | 'claim' {
    if (d.role !== 'user') return 'claim';
    if (d.provenance === 'current-session') return 'binds';
    if (d.provenance === 'transcript-structured') return d.contradictedBy === undefined ? 'binds' : 'batch';
    return 'batch';
}

export interface DirectiveCheck {
    directive: string;
    roadmap: string;
    verdict: 'honoured' | 'violated' | 'not-applicable';
    evidence: string;
}

export interface ConvergenceRow {
    lens: 'convergence';
    directives_checked: string[];
    violated: string[];
    checks: DirectiveCheck[];
}

export function convergenceRow(directives: readonly Directive[], checks: readonly DirectiveCheck[]): ConvergenceRow {
    const binding = directives.filter((d) => directiveBinding(d) === 'binds').map((d) => d.id);
    const checked = new Set(checks.filter((c) => c.evidence.trim() !== '').map((c) => c.directive));
    const missing = binding.filter((id) => !checked.has(id));
    if (missing.length > 0) throw new InboxFinalError(`final Convergence loop left binding directive(s) unchecked: ${missing.join(', ')}`);
    const violated = [...new Set(checks.filter((c) => c.verdict === 'violated').map((c) => c.directive))];
    return { lens: 'convergence', directives_checked: binding, violated, checks: [...checks] };
}

export interface Lane {
    lane: string;
    topics: string[];
}

/** First-fit by size into lanes under both thresholds; one lane when the round fits. */
export function planLanes(topics: ReadonlyArray<{ topic: string; bytes: number }>): Lane[] {
    const lanes: Array<Lane & { bytes: number }> = [];
    for (const t of [...topics].sort((a, b) => b.bytes - a.bytes || a.topic.localeCompare(b.topic))) {
        const fit = lanes.find((l) => l.topics.length < INBOX_LANE_MAX_TOPICS && l.bytes + t.bytes <= INBOX_LANE_MAX_BYTES);
        if (fit !== undefined) {
            fit.topics.push(t.topic);
            fit.bytes += t.bytes;
        } else {
            lanes.push({ lane: '', topics: [t.topic], bytes: t.bytes });
        }
    }
    return lanes.map((l, i) => ({ lane: `L${i + 1}`, topics: l.topics }));
}

export interface LaneLedger {
    lane: string;
    /** The lane's own anchor census — the denominator its reading cannot shrink. */
    census: number;
    points: Array<{ id: string; disposition: string }>;
}

export function foldLaneLedgers(lanes: readonly LaneLedger[]): { lanes: number; census: number; points: number } {
    const laneIds = new Set<string>();
    const pointLane = new Map<string, string>();
    for (const l of lanes) {
        if (!(l.census > 0) || !Array.isArray(l.points)) {
            throw new InboxFinalError(`lane ${l.lane} has no census or no point ledger of its own; a fold without one loses that lane`);
        }
        if (laneIds.has(l.lane)) throw new InboxFinalError(`lane ${l.lane} appears twice; its census would be counted twice`);
        laneIds.add(l.lane);
        for (const p of l.points) {
            const other = pointLane.get(p.id);
            if (other !== undefined) throw new InboxFinalError(`point ${p.id} sits in lanes ${other} and ${l.lane}; a topic belongs to one lane`);
            pointLane.set(p.id, l.lane);
        }
    }
    return {
        lanes: lanes.length,
        census: lanes.reduce((n, l) => n + l.census, 0),
        points: lanes.reduce((n, l) => n + l.points.length, 0),
    };
}
