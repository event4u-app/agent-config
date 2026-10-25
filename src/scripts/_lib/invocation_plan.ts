/**
 * invocation_plan.ts — the order an input's stages run in, decided from what
 * they do rather than from the order they were typed.
 *
 * Contract: `src/agent-src/contexts/execution/invocation-plan.md`. The agent
 * splits the input into stages and tags each with its effects, the object each
 * effect touches, and the constraint markers C1–C5; this function applies the
 * rewrite rules R0–R5 and returns the executed order, the coalesced sinks, and
 * the one `Order:` line — only when the order differs. Zero model calls.
 *
 * A reorder never widens authority: the plan only moves and merges effects the
 * input already named, and never moves an outward or irreversible one.
 */

export const EFFECTS = {
    'local-write': { sink: false, supersedable: false, fixed: false },
    commit: { sink: false, supersedable: false, fixed: false },
    read: { sink: false, supersedable: false, fixed: false },
    regenerate: { sink: true, supersedable: true, fixed: false },
    'full-suite': { sink: true, supersedable: true, fixed: false },
    push: { sink: true, supersedable: true, fixed: false },
    'pr-open': { sink: true, supersedable: true, fixed: false },
    'pr-update': { sink: true, supersedable: true, fixed: false },
    'ci-settle': { sink: true, supersedable: true, fixed: false },
    council: { sink: true, supersedable: false, fixed: false },
    'outward-message': { sink: true, supersedable: false, fixed: true },
    merge: { sink: true, supersedable: false, fixed: true },
    release: { sink: true, supersedable: false, fixed: true },
    deploy: { sink: true, supersedable: false, fixed: true },
    destructive: { sink: true, supersedable: false, fixed: true },
} as const;

export type Effect = keyof typeof EFFECTS;
export type StageKind = 'analysis' | 'author' | 'implement' | 'test' | 'check' | 'other';

/** Effects that change an object, and so supersede an earlier sink on it. */
const WRITES: ReadonlySet<Effect> = new Set(['local-write', 'commit', 'regenerate']);

/** Within one step, delivery runs in this order after the step's own work. */
const SINK_RANK: Readonly<Partial<Record<Effect, number>>> = {
    regenerate: 0,
    'full-suite': 1,
    push: 2,
    'pr-open': 3,
    'pr-update': 4,
    'ci-settle': 5,
};

/** R0 — orders the method already mandates: [earlier kind, later kinds, why]. */
const METHOD: ReadonlyArray<readonly [StageKind, readonly StageKind[], string]> = [
    ['analysis', ['author', 'implement'], 'analysis first'],
    ['test', ['implement'], 'test-first'],
];

export interface EffectRef {
    effect: Effect;
    object: string;
}

export interface StageInput {
    id: string;
    kind?: StageKind;
    effects: EffectRef[];
    /** C4 — stages whose output this one reads. */
    dependsOn?: string[];
    /** C3 — a stated reason pins this stage's sinks where they are. */
    reason?: string;
    /** R3 — later stages this cheap check can make unnecessary. */
    voids?: string[];
}

export interface InvocationInput {
    stages: StageInput[];
    /** C1 — an explicit order marker ("in dieser Reihenfolge", "strictly in this order"). */
    literal?: boolean;
    /** C2 — a review fence: nothing crosses it, and the run stops after this stage. */
    fenceAfter?: string;
}

export interface PlannedEffect extends EffectRef {
    /** The stages this effect came from; more than one after a coalesce. */
    from: string[];
}

export interface PlanStep {
    id: string;
    effects: PlannedEffect[];
}

export interface CoalescedSink extends EffectRef {
    from: string[];
    at: string;
}

export interface InvocationPlan {
    /** False for a single sink-free stage: the plan costs nothing there. */
    fires: boolean;
    order: PlanStep[];
    coalesced: CoalescedSink[];
    fence: string | null;
    line: string | null;
}

export class InvocationPlanError extends Error {}

function validate(input: InvocationInput): void {
    const known = new Set<string>();
    for (const s of input.stages) {
        if (known.has(s.id)) throw new InvocationPlanError(`duplicate stage id ${JSON.stringify(s.id)}`);
        known.add(s.id);
        for (const e of s.effects) {
            if (!Object.prototype.hasOwnProperty.call(EFFECTS, e.effect)) throw new InvocationPlanError(`unknown effect ${JSON.stringify(e.effect)} in ${s.id}`);
        }
    }
    const refs = [...input.stages.flatMap((s) => [...(s.dependsOn ?? []), ...(s.voids ?? [])]), ...(input.fenceAfter ? [input.fenceAfter] : [])];
    for (const r of refs) if (!known.has(r)) throw new InvocationPlanError(`unknown stage ${JSON.stringify(r)}`);
}

const isFixed = (s: StageInput): boolean => s.effects.some((e) => EFFECTS[e.effect].fixed);
const isSink = (e: EffectRef): boolean => EFFECTS[e.effect].sink;

function identity(input: InvocationInput, fires: boolean): InvocationPlan {
    return {
        fires,
        order: input.stages.map((s) => ({ id: s.id, effects: s.effects.map((e) => ({ ...e, from: [s.id] })) })),
        coalesced: [],
        fence: input.fenceAfter ?? null,
        line: null,
    };
}

/** C2 and C5 cut the input into segments no stage and no sink crosses. */
function segments(input: InvocationInput): StageInput[][] {
    const out: StageInput[][] = [];
    let cur: StageInput[] = [];
    for (const s of input.stages) {
        if (isFixed(s)) {
            if (cur.length > 0) out.push(cur);
            out.push([s]);
            cur = [];
            continue;
        }
        cur.push(s);
        if (s.id === input.fenceAfter) {
            out.push(cur);
            cur = [];
        }
    }
    if (cur.length > 0) out.push(cur);
    return out;
}

interface Edge {
    before: string;
    after: string;
    phrase: string;
}

function reaches(edges: readonly Edge[], from: string, to: string): boolean {
    const seen = new Set<string>();
    const stack = [from];
    while (stack.length > 0) {
        const n = stack.pop() as string;
        if (n === to) return true;
        if (seen.has(n)) continue;
        seen.add(n);
        for (const e of edges) if (e.before === n) stack.push(e.after);
    }
    return false;
}

/**
 * A stage still waits when it settles CI on an object no later stage of the
 * segment writes. A stage with a stated reason (C3) is pinned, never moved.
 */
function waits(seg: readonly StageInput[], i: number): boolean {
    const s = seg[i] as StageInput;
    if (s.reason !== undefined) return false;
    return s.effects.some(
        (e) => e.effect === 'ci-settle' && !seg.slice(i + 1).some((l) => l.effects.some((w) => w.object === e.object && WRITES.has(w.effect))),
    );
}

/** R0, R3, R4 as soft edges under the C4 hard edges; a stable topological sort keeps R5. */
function orderStages(seg: readonly StageInput[]): { stages: StageInput[]; moves: string[] } {
    const hard: Edge[] = seg.flatMap((s) => (s.dependsOn ?? []).map((d) => ({ before: d, after: s.id, phrase: '' })));
    const edges: Edge[] = [...hard];
    const idx = new Map(seg.map((s, i) => [s.id, i]));
    const soft: Edge[] = [];
    for (const [early, lates, why] of METHOD) {
        for (const a of seg.filter((s) => s.kind === early)) {
            for (const b of seg.filter((s) => s.kind !== undefined && lates.includes(s.kind))) {
                soft.push({ before: a.id, after: b.id, phrase: `${a.id} before ${b.id} — ${why}` });
            }
        }
    }
    for (const c of seg) for (const v of c.voids ?? []) soft.push({ before: c.id, after: v, phrase: `${c.id} before ${v} — it can void ${v}` });
    seg.forEach((w, i) => {
        if (!waits(seg, i)) return;
        for (const l of seg.slice(i + 1)) soft.push({ before: l.id, after: w.id, phrase: `${w.id} after ${l.id} — waits last` });
    });
    const applied: Edge[] = [];
    for (const e of soft) {
        if (e.before === e.after || reaches(edges, e.after, e.before)) continue;
        edges.push(e);
        applied.push(e);
    }

    const remaining = new Set(seg.map((s) => s.id));
    const stages: StageInput[] = [];
    while (remaining.size > 0) {
        const ready = seg.filter((s) => remaining.has(s.id) && !edges.some((e) => e.after === s.id && remaining.has(e.before)));
        const next = ready[0] as StageInput;
        stages.push(next);
        remaining.delete(next.id);
    }
    const pos = new Map(stages.map((s, i) => [s.id, i]));
    const moves = applied
        .filter((e) => (idx.get(e.before) as number) > (idx.get(e.after) as number) && (pos.get(e.before) as number) < (pos.get(e.after) as number))
        .map((e) => e.phrase);
    return { stages, moves };
}

/** R1 deferred delivery, then R2 coalesce, over one ordered segment. */
function deliver(stages: readonly StageInput[]): { steps: PlanStep[]; moves: string[] } {
    const steps: PlanStep[] = stages.map((s) => ({ id: s.id, effects: [] }));
    const moved = new Map<string, { effects: Effect[]; object: string; to: string }>();
    stages.forEach((s, p) => {
        for (const e of s.effects) {
            let at = p;
            if (isSink(e) && EFFECTS[e.effect].supersedable && s.reason === undefined) {
                stages.forEach((l, q) => {
                    if (q > at && l.effects.some((w) => w.object === e.object && WRITES.has(w.effect))) at = q;
                });
            }
            (steps[at] as PlanStep).effects.push({ ...e, from: [s.id] });
            if (at !== p) {
                const to = (stages[at] as StageInput).id;
                const key = `${s.id}\u0000${to}`;
                const m = moved.get(key) ?? { effects: [], object: e.object, to };
                m.effects.push(e.effect);
                moved.set(key, m);
            }
        }
    });
    const moves = [...moved.entries()].map(([key, m]) => `${m.effects.join(', ')} of ${key.split('\u0000')[0] as string} move after ${m.to} — ${m.to} writes ${m.object}`);
    return { steps, moves };
}

function coalesce(steps: PlanStep[]): CoalescedSink[] {
    const out: CoalescedSink[] = [];
    const opened = new Set<string>();
    for (const step of steps) {
        const merged: PlannedEffect[] = [];
        for (const e of step.effects) {
            const isPr = e.effect === 'pr-open' || e.effect === 'pr-update';
            const twin = merged.find(
                (m) => m.object === e.object && isSink(m) && (m.effect === e.effect || (isPr && (m.effect === 'pr-open' || m.effect === 'pr-update'))),
            );
            if (twin === undefined) {
                merged.push({ ...e, from: [...e.from] });
                continue;
            }
            for (const f of e.from) if (!twin.from.includes(f)) twin.from.push(f);
            // An open and an update of one PR in a single delivery: it opens, unless an earlier step already did.
            if (isPr && twin.effect !== e.effect) twin.effect =opened.has(e.object) ? 'pr-update' : 'pr-open';
        }
        for (const m of merged) {
            if (m.effect === 'pr-open') opened.add(m.object);
            if (m.from.length > 1) out.push({ effect: m.effect, object: m.object, from: m.from, at: step.id });
        }
        const work = merged.filter((m) => !isSink(m) || SINK_RANK[m.effect] === undefined);
        const delivery = merged.filter((m) => isSink(m) && SINK_RANK[m.effect] !== undefined).sort((a, b) => (SINK_RANK[a.effect] as number) - (SINK_RANK[b.effect] as number));
        step.effects = [...work, ...delivery];
    }
    return out;
}

export function linearize(input: InvocationInput): InvocationPlan {
    validate(input);
    const fires = input.stages.length >= 2 || input.stages.some((s) => s.effects.some(isSink));
    if (!fires || input.literal === true) return identity(input, fires);

    const order: PlanStep[] = [];
    const phrases: string[] = [];
    for (const seg of segments(input)) {
        const { stages, moves } = orderStages(seg);
        const delivered = deliver(stages);
        order.push(...delivered.steps);
        phrases.push(...moves, ...delivered.moves);
    }
    const coalesced = coalesce(order);
    return {
        fires,
        order: order.filter((s) => s.effects.length > 0),
        coalesced,
        fence: input.fenceAfter ?? null,
        line: phrases.length === 0 ? null : `Order: ${phrases.join('; ')}.`,
    };
}

/**
 * Amendment: the same mission with stages added, removed or re-ordered. Plans
 * what is left — never the stages already done — and continues.
 */
export function replan(input: InvocationInput, done: readonly string[]): InvocationPlan {
    const gone = new Set(done);
    const stages: StageInput[] = input.stages
        .filter((s) => !gone.has(s.id))
        .map((s) => ({
            ...s,
            ...(s.dependsOn ? { dependsOn: s.dependsOn.filter((d) => !gone.has(d)) } : {}),
            ...(s.voids ? { voids: s.voids.filter((v) => !gone.has(v)) } : {}),
        }));
    const { fenceAfter, ...rest } = input;
    return linearize({ ...rest, stages, ...(fenceAfter !== undefined && !gone.has(fenceAfter) ? { fenceAfter } : {}) });
}

/**
 * A stage fails or blocks: the delivery deferred from stages that finished
 * still runs now, and says it is partial. Deferral never means nothing lands.
 */
export function deliveryOnFailure(plan: InvocationPlan, failed: string): { effects: PlannedEffect[]; partial: true; line: string } {
    const at = plan.order.findIndex((s) => s.id === failed);
    if (at < 0) throw new InvocationPlanError(`unknown stage ${JSON.stringify(failed)}`);
    const finished = new Set(plan.order.slice(0, at).map((s) => s.id));
    for (const s of plan.order.slice(0, at)) for (const e of s.effects) for (const f of e.from) finished.add(f);
    const effects = plan.order
        .slice(at)
        .flatMap((s) => s.effects)
        .filter((e) => isSink(e) && EFFECTS[e.effect].supersedable && e.from.some((f) => f !== failed && finished.has(f)))
        .map((e) => ({ ...e, from: e.from.filter((f) => f !== failed) }));
    return { effects, partial: true, line: `Partial: ${failed} did not finish; delivering what the earlier stages completed.` };
}
