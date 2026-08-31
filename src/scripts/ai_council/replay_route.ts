/**
 * The route half of decision replay — step 10.1.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence` step 10.1:
 * *"Extend decision replay (`ai_council/replay.ts`) with: ladder council
 * resolution, council-internal topology, initial route, escalation, stage
 * outputs, stop reason, synthesis policy, cost, latency, final verdict"*,
 * verified by *"a replayed run reproduces the recorded route"*.
 *
 * ## Why a separate module, and why the existing renderer is untouched
 *
 * `replay.ts` is a py2ts parity port whose header pins Python-mirroring
 * behaviour down to `round-half-to-even` float formatting and a trailing
 * `rstrip()`. Editing its renderer to interleave new sections would put every
 * one of those parity notes at risk for a purely additive feature. So the route
 * record lives here, renders as its own appendable section, and the existing
 * output is byte-identical for every caller that does not pass one — which the
 * test asserts rather than assumes.
 *
 * ## Nine of the ten fields are populated; one is structurally unavailable
 *
 * `councilInternalTopology` is typed `null` and only `null`. No topology
 * selector exists — 7.2 is open and nothing in `src/` is named
 * `topology_selector` or exports `selectTopology` — so a populated value would
 * be invented. {@link auditRouteRecord} reports it as
 * `structurally-unavailable`, which is a different report from "missing" and is
 * the distinction the whole record exists to preserve.
 *
 * ## Round-trip is the verify clause
 *
 * {@link renderRouteSection} and {@link parseRouteSection} are inverses over
 * the record's own fields, so "a replayed run reproduces the recorded route" is
 * decidable: render, parse, compare. Numbers are rendered at fixed precision so
 * the comparison is exact rather than approximate.
 *
 * Pure and offline.
 */
import type { LadderRung, LadderVerdict } from '../_lib/judgment_ladder.js';
import type { SynthesisStrategyId } from './synthesis_strategy.js';

/** How the ONE task-side resolver landed on council. */
export interface LadderResolution {
    readonly rung: LadderRung;
    readonly verdict: LadderVerdict;
    readonly reason: string;
}

/** One deliberation stage and what it produced. */
export interface StageOutput {
    readonly stage: string;
    /** Findings, critiques or verdict lines the stage emitted. */
    readonly produced: number;
    readonly calls: number;
}

export interface RouteEscalation {
    readonly escalated: boolean;
    readonly from: string | null;
    readonly to: string | null;
    readonly reason: string;
}

/** Every field 10.1 names, with the unavailable one typed as unavailable. */
export interface CouncilRouteRecord {
    readonly ladderResolution: LadderResolution;
    /**
     * FUTURE MECHANISM. Typed `null` and only `null`: no selector exists, so a
     * value here would be invented. Widening this type is the change that makes
     * 10.1 closable.
     */
    readonly councilInternalTopology: null;
    readonly initialRoute: string;
    readonly escalation: RouteEscalation;
    readonly stageOutputs: readonly StageOutput[];
    /** `null` means the run completed all configured rounds — not "unknown". */
    readonly stopReason: string | null;
    readonly synthesisPolicy: SynthesisStrategyId | null;
    readonly costCalls: number;
    readonly costUsd: number;
    readonly latencyMs: number;
    readonly finalVerdict: string;
}

/** The ten field names 10.1 enumerates, in its own order. */
export const ROUTE_FIELDS: readonly string[] = Object.freeze([
    'ladderResolution',
    'councilInternalTopology',
    'initialRoute',
    'escalation',
    'stageOutputs',
    'stopReason',
    'synthesisPolicy',
    'costCalls',
    'costUsd',
    'latencyMs',
    'finalVerdict',
]);

export type FieldState = 'populated' | 'structurally-unavailable' | 'missing';

/**
 * Per-field state. `structurally-unavailable` and `missing` are different
 * claims: the first says the tree cannot produce a value, the second says the
 * caller did not supply one.
 */
export function auditRouteRecord(record: CouncilRouteRecord): Record<string, FieldState> {
    const out: Record<string, FieldState> = {};
    for (const f of ROUTE_FIELDS) {
        if (f === 'councilInternalTopology') {
            out[f] = 'structurally-unavailable';
            continue;
        }
        const v = (record as unknown as Record<string, unknown>)[f];
        // `stopReason: null` is a real value ("ran to completion"), and so is
        // `synthesisPolicy: null` ("host synthesis, no strategy recorded"); an
        // ABSENT key is what counts as missing.
        out[f] = Object.prototype.hasOwnProperty.call(record, f) && v !== undefined ? 'populated' : 'missing';
    }
    return out;
}

/** USD is rendered at 4 decimals so render→parse→compare is exact. */
const USD_PRECISION = 4;

/** The appendable section. Deterministic — no clock, no randomness. */
export function renderRouteSection(record: CouncilRouteRecord): string {
    const stages = record.stageOutputs
        .map((s) => `  - ${s.stage}: produced ${String(s.produced)}, ${String(s.calls)} call(s)`)
        .join('\n');
    return [
        '',
        '## Route',
        '',
        `- ladder: rung ${String(record.ladderResolution.rung)} / ${record.ladderResolution.verdict} — ${record.ladderResolution.reason}`,
        '- council-internal topology: (not applicable — no topology selector exists)',
        `- initial route: ${record.initialRoute}`,
        `- escalation: ${
            record.escalation.escalated
                ? `${String(record.escalation.from)} → ${String(record.escalation.to)} — ${record.escalation.reason}`
                : `none — ${record.escalation.reason}`
        }`,
        '- stage outputs:',
        stages === '' ? '  - (none recorded)' : stages,
        `- stop reason: ${record.stopReason ?? '(ran to completion)'}`,
        `- synthesis policy: ${record.synthesisPolicy ?? '(host synthesis)'}`,
        `- cost: ${String(record.costCalls)} call(s), $${record.costUsd.toFixed(USD_PRECISION)}`,
        `- latency: ${String(record.latencyMs)} ms`,
        `- final verdict: ${record.finalVerdict}`,
        '',
    ].join('\n');
}

const _LADDER_RE = /^- ladder: rung (\S+) \/ (\S+) — ([\s\S]*)$/;
const _COST_RE = /^- cost: (\d+) call\(s\), \$([0-9.]+)$/;

/** Parse a rendered section back into the record. Inverse of {@link renderRouteSection}. */
export function parseRouteSection(section: string): CouncilRouteRecord | null {
    const lines = section.split('\n');
    const get = (prefix: string): string | null => {
        const l = lines.find((x) => x.startsWith(prefix));
        return l === undefined ? null : l.slice(prefix.length);
    };
    const ladderLine = lines.find((l) => l.startsWith('- ladder: '));
    const ladder = ladderLine === undefined ? null : _LADDER_RE.exec(ladderLine);
    const costLine = lines.find((l) => l.startsWith('- cost: '));
    const cost = costLine === undefined ? null : _COST_RE.exec(costLine);
    if (ladder === null || cost === null) return null;

    const rungRaw = ladder[1] as string;
    const escRaw = get('- escalation: ') ?? '';
    const escalated = !escRaw.startsWith('none — ');
    const arrow = escRaw.split(' — ')[0] ?? '';
    const [from, to] = escalated ? arrow.split(' → ') : [null, null];

    const stageOutputs: StageOutput[] = [];
    const start = lines.indexOf('- stage outputs:');
    for (let i = start + 1; i < lines.length && (lines[i] as string).startsWith('  - '); i++) {
        const m = /^ {2}- (.+): produced (\d+), (\d+) call\(s\)$/.exec(lines[i] as string);
        if (m) stageOutputs.push({ stage: m[1] as string, produced: Number(m[2]), calls: Number(m[3]) });
    }

    const stop = get('- stop reason: ') ?? '';
    const policy = get('- synthesis policy: ') ?? '';
    return {
        ladderResolution: {
            rung: (rungRaw === 'null' ? null : Number(rungRaw)) as LadderRung,
            verdict: ladder[2] as LadderVerdict,
            reason: ladder[3] as string,
        },
        councilInternalTopology: null,
        initialRoute: get('- initial route: ') ?? '',
        escalation: {
            escalated,
            from: from ?? null,
            to: to ?? null,
            reason: escRaw.split(' — ').slice(1).join(' — '),
        },
        stageOutputs,
        stopReason: stop === '(ran to completion)' ? null : stop,
        synthesisPolicy: policy === '(host synthesis)' ? null : (policy as SynthesisStrategyId),
        costCalls: Number(cost[1]),
        costUsd: Number(cost[2]),
        latencyMs: Number(get('- latency: ')?.replace(/ ms$/, '') ?? '0'),
        finalVerdict: get('- final verdict: ') ?? '',
    };
}

/** The verify clause, executable: does a replay reproduce the recorded route? */
export function replayReproducesRoute(record: CouncilRouteRecord): boolean {
    const parsed = parseRouteSection(renderRouteSection(record));
    return parsed !== null && JSON.stringify(parsed) === JSON.stringify(record);
}

/**
 * Append the route section to an existing replay body.
 *
 * `null` returns the body UNCHANGED — byte for byte — which is what keeps
 * `replay.ts`'s parity contract intact for every caller that does not record a
 * route.
 */
export function withRouteSection(replayBody: string, record: CouncilRouteRecord | null): string {
    return record === null ? replayBody : `${replayBody}${renderRouteSection(record)}`;
}
