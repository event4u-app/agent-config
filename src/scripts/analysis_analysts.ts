/**
 * analysis_analysts.ts — the analyst class of the analysis doors: a planned
 * count, one shared brief, independence-stamped outputs and the `handoff-v1`
 * drops external sessions leave under `agents/tmp/<round-id>/`.
 *
 * An analyst is neither a council seat nor an implementer: it reads the scope,
 * writes only into its own round folder and never pushes. Diversity comes from
 * model family, so every analyst runs the same brief and the stamp records the
 * family honestly — a same-family subagent can never read as cross-family.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { independenceFields, type ContextRelation, type IndependenceFields } from './_lib/review_independence.js';

export const DEFAULT_ANALYSTS = 3;
export const MAX_ANALYSTS = 5;
export const DROPS_REL = 'agents/tmp';

export type AnalystMode = 'subagent' | 'external';
export type AnalystPhase = 'seed' | 'deepen';
export const HANDOFF_PHASES = ['seed', 'deepen', 'exchange'] as const;
export type HandoffPhase = (typeof HANDOFF_PHASES)[number];

/** Providers whose family `review_independence.ts` can place. */
const KNOWN_FAMILIES = new Set(['anthropic', 'openai', 'gemini', 'xai', 'perplexity']);

export class AnalystError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AnalystError';
    }
}

export interface AnalystPlan {
    count: number;
    exchange: boolean;
    reason: 'default' | 'quick' | 'small-scope';
}

export function planAnalysts(opts: {
    quick?: boolean;
    analysts?: number;
    scopeFiles?: number;
    smallScopeFiles?: number;
}): AnalystPlan {
    const count = opts.analysts ?? DEFAULT_ANALYSTS;
    if (!Number.isInteger(count) || count < 1 || count > MAX_ANALYSTS) {
        throw new AnalystError(`analyst count must be an integer from 1 to ${MAX_ANALYSTS}, got ${count}`);
    }
    if (opts.quick === true) return { count: 1, exchange: false, reason: 'quick' };
    if (opts.scopeFiles !== undefined && opts.smallScopeFiles !== undefined && opts.scopeFiles < opts.smallScopeFiles) {
        return { count: 1, exchange: false, reason: 'small-scope' };
    }
    return { count, exchange: count > 1, reason: 'default' };
}

export function briefDigest(brief: string): string {
    return `sha256:${createHash('sha256').update(brief).digest('hex')}`;
}

export interface AnalystOutput extends IndependenceFields {
    analyst_id: string;
    mode: AnalystMode;
    family: string;
    phase: AnalystPhase;
    brief_digest: string;
    body: string;
    /** Analyst ids whose output this one read. Empty for every seed and deepen output. */
    consulted: string[];
}

export function stampOutput(input: {
    analyst_id: string;
    mode: AnalystMode;
    hostFamily: string;
    family?: string | undefined;
    context_relation?: ContextRelation;
    phase: AnalystPhase;
    brief: string;
    body: string;
    consulted: string[];
}): AnalystOutput {
    let family: string;
    if (input.mode === 'subagent') {
        if (input.family !== undefined && input.family !== input.hostFamily) {
            throw new AnalystError(
                `${input.analyst_id}: a subagent analyst runs in the host family ${input.hostFamily}, not ${input.family}`,
            );
        }
        family = input.hostFamily;
    } else {
        family = input.family ?? 'unknown';
    }
    const relation: ContextRelation = input.context_relation ?? (input.mode === 'subagent' ? 'fresh' : 'unknown');
    const members = KNOWN_FAMILIES.has(family) && KNOWN_FAMILIES.has(input.hostFamily) ? [input.hostFamily, family] : [];
    return {
        analyst_id: input.analyst_id,
        mode: input.mode,
        family,
        phase: input.phase,
        brief_digest: briefDigest(input.brief),
        body: input.body,
        consulted: [...input.consulted],
        ...independenceFields(members, relation),
    };
}

/** Every reason a round's seed and deepen outputs are not independent. Empty means clean. */
export function roundViolations(outputs: readonly AnalystOutput[]): string[] {
    const out: string[] = [];
    const first = outputs[0];
    const ids = new Set(outputs.map((o) => o.analyst_id));
    for (const o of outputs) {
        if (first !== undefined && o.brief_digest !== first.brief_digest) {
            out.push(`${o.analyst_id} (${o.phase}) ran on a different brief than ${first.analyst_id}`);
        }
        for (const c of o.consulted) {
            if (c !== o.analyst_id && ids.has(c)) out.push(`${o.analyst_id} (${o.phase}) consulted ${c} before the exchange`);
        }
        if (o.mode === 'subagent' && o.review_independence === 'cross-family') {
            out.push(`${o.analyst_id} is a subagent stamped cross-family`);
        }
    }
    return out;
}

export interface Handoff {
    analyst_id: string;
    file: string;
    phase: HandoffPhase;
    loop: number;
    pin: string;
    family: string | undefined;
    consolidates: string[];
    body: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export function parseHandoff(text: string, file: string): Handoff {
    const m = FRONTMATTER_RE.exec(text);
    if (m === null) throw new AnalystError(`${file}: no frontmatter`);
    const fm = (parseYaml(m[1] as string) ?? {}) as Record<string, unknown>;
    if (fm['handoff'] !== 'v1') throw new AnalystError(`${file}: handoff must be v1, got ${JSON.stringify(fm['handoff'])}`);
    const phase = fm['phase'];
    if (!HANDOFF_PHASES.includes(phase as HandoffPhase)) {
        throw new AnalystError(`${file}: phase must be one of ${HANDOFF_PHASES.join(', ')}`);
    }
    const loop = fm['loop'];
    if (typeof loop !== 'number' || !Number.isInteger(loop) || loop < 0) throw new AnalystError(`${file}: loop must be an integer`);
    const pin = fm['pin'];
    if (typeof pin !== 'string' || pin.length === 0) throw new AnalystError(`${file}: pin is required`);
    const consolidates = Array.isArray(fm['consolidates']) ? fm['consolidates'].map(String) : [];
    return {
        analyst_id: `ext:${path.basename(file, '.md')}`,
        file,
        phase: phase as HandoffPhase,
        loop,
        pin,
        family: typeof fm['family'] === 'string' ? fm['family'] : undefined,
        consolidates,
        body: m[2] as string,
    };
}

/**
 * Reads the owner's drops for one round. Source names live only in
 * `*.annex.md`, which is never an output; anything else without a valid
 * `handoff: v1` header is skipped with its reason rather than guessed at.
 */
export function readExternalDrops(
    projectRoot: string,
    roundId: string,
): { handoffs: Handoff[]; skipped: Array<{ file: string; reason: string }> } {
    const dir = path.join(projectRoot, DROPS_REL, roundId);
    if (!fs.existsSync(dir)) return { handoffs: [], skipped: [] };
    const handoffs: Handoff[] = [];
    const skipped: Array<{ file: string; reason: string }> = [];
    for (const file of fs.readdirSync(dir).sort()) {
        if (!file.endsWith('.md') || file.endsWith('.annex.md')) continue;
        try {
            handoffs.push(parseHandoff(fs.readFileSync(path.join(dir, file), 'utf8'), file));
        } catch (err) {
            skipped.push({ file, reason: err instanceof Error ? err.message : String(err) });
        }
    }
    return { handoffs, skipped };
}
