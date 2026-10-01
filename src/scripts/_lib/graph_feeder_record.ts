/**
 * The graph feeder record — detector F's verdict and the code graph's, side by
 * side, on every stop where a graph existed (`road-to-a-graph-that-feeds-the-gate`
 * step 3.2).
 *
 * WHY A SEPARATE RECORD AND NOT `ShadowRecord` (D3). `ShadowRecord` is written
 * only on the `stop_hook_active` and `refused_turn` layers and is the Q1
 * instrument of `road-to-a-stop-that-holds` — a live measurement window with its
 * own denominator. Folding a second signal into it would contaminate a reading
 * somebody else is taking, which is a worse failure than a second file.
 *
 * WHY IT CHANGES NO VERDICT, AND WHAT THAT CLAIM DOES NOT COVER. Every function
 * here is wrapped, every failure path returns silently, and no caller branches on
 * the result, so no in-process path can move an exit code. It is NOT a claim
 * about latency, and an earlier version of this paragraph said "costs the turn
 * nothing", which a review correctly read as one: a stop in a repository with a
 * graph pays a `git status` spawn, a graph open and an `untested` walk. Nothing
 * measures that, and a host that timed a stop hook out would drop the gate's
 * refusal — a failure the comparative exit-code test cannot see, because both of
 * its runs complete. Named rather than implied away. Step 3.4 — promoting the
 * graph verdict into F — is DEFERRED behind step 3.3's recall measurement and
 * behind an owner amendment to ADR-277, and nothing here anticipates it.
 *
 * WHAT A ROW MAY CONTAIN. The fields are a closed set of enums, counts and
 * repo-relative source paths. There is no field able to hold a prompt, a file
 * body, a reply or a command — the same PII-exclusion-by-construction discipline
 * `domain-safety-pii` § Surface 2 asks of a log line, and the same shape
 * `ToolCall` already has. Paths are in the set because they are the evidence a
 * human labeller needs in step 3.3 and because the gate's own refusal text
 * already quotes them; they are capped so one turn cannot write an unbounded row.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { detectSources, type GraphState, NATIVE_CACHE_REL, pickSource } from '../code_graph/detect.js';
import { loadGraph } from '../code_graph/query.js';
import { untested } from '../code_graph/verbs.js';

/** At most this many edit paths per row. */
const MAX_PATHS = 5;

/**
 * At most this many rows per session file.
 *
 * `agents/state/` is local and gitignored, but "local" is not "free": a long
 * session appends on every turn end, and an instrument that grows without a
 * bound is the failure the gate's own refusal-state history already records.
 * Past the cap the writer stops rather than rotating — a truncated tail is a
 * readable sample, and a rotation would silently drop the earliest rows that a
 * recall reading most wants.
 */
export const MAX_ROWS_PER_SESSION = 200;

/** The graph's half of the verdict. `null` means the graph did not contribute. */
export type GraphVerdict = 'untested' | 'tested' | 'no-seeds' | null;

/** One stop, as the feeder records it. */
/**
 * The stop layer a row came from.
 *
 * A closed union rather than `string`. The header below calls these fields "a
 * closed set of enums", and a review pointed out the types did not enforce it —
 * the sets lived only in the call sites, so a later caller could widen either
 * with no type error and the prose would quietly become false.
 */
export type FeederLayer = 'live' | 'stop_hook_active' | 'refused_turn';

/** Detector F's evidence class, from the same closed set the detector uses. */
export type FeederMode = 'transcript' | 'record';

export interface GraphFeederRow {
    at: string;
    /** The turn's ordinal — how many genuine user prompts preceded it. */
    turn: number;
    /** Which stop layer produced this row: the live verdict, or a retry. */
    layer: FeederLayer;
    graph_state: GraphState;
    /** Did detector F fire on this turn? */
    f: boolean;
    /** F's evidence class when it fired — `transcript` or `record`. */
    f_mode: FeederMode | null;
    graph: GraphVerdict;
    /** How many changed symbols the graph found no test edge for. */
    graph_untested: number;
    /** How many it did find one for — so the ratio is readable. */
    graph_tested: number;
    /** The turn's edit paths, capped at {@link MAX_PATHS}. */
    paths: string[];
    /** How many edit paths there were in total, when the list is capped. */
    path_count: number;
}

export function feederFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(workspaceRoot, 'agents', 'state', 'graph-feeder', `${sessionKey}.jsonl`);
}

/**
 * Run `untested` over the turn's edit paths.
 *
 * Returns `null` — the graph contributed nothing — for every reason there is:
 * no usable source, a SCIP index with no owned reader, no edit paths, or any
 * throw at all. A verdict this module cannot stand behind is not a verdict.
 */
export function graphUntestedVerdict(
    root: string,
    state: GraphState,
    paths: readonly string[],
): { verdict: GraphVerdict; untested: number; tested: number } {
    const none = { verdict: null, untested: 0, tested: 0 } as const;
    // `behind:N` and `absent` contribute nothing, by the step's own terms: an
    // answer from an index that predates the change is not evidence about the
    // change.
    if (state !== 'fresh' && state !== 'edited') return none;
    if (paths.length === 0) return none;
    let picked;
    try {
        picked = pickSource(detectSources(root, path.join(root, NATIVE_CACHE_REL)));
    } catch {
        return none;
    }
    if (!picked || picked.kind === 'scip') return none;
    let g;
    try {
        g = loadGraph(picked.path, `${picked.kind}:${path.relative(root, picked.path)}`);
    } catch {
        return none;
    }
    try {
        const r = untested(g, paths, state);
        if (r.seeds.length === 0) return { verdict: 'no-seeds', untested: 0, tested: 0 };
        return {
            verdict: r.untested.length > 0 ? 'untested' : 'tested',
            untested: r.untested.length,
            tested: r.tested.length,
        };
    } catch {
        return none;
    } finally {
        // The handle owns an open database; a stop hook that leaked one per turn
        // would hold a descriptor for the life of the session.
        try {
            g.close();
        } catch {
            /* nothing to do about a failed close */
        }
    }
}

/** Append one row, or do nothing at all. Never throws, never returns a verdict. */
export function appendFeederRow(workspaceRoot: string, sessionKey: string, row: GraphFeederRow): void {
    try {
        const file = feederFile(workspaceRoot, sessionKey);
        let existing = 0;
        try {
            existing = fs
                .readFileSync(file, 'utf-8')
                .split('\n')
                .filter((l) => l.trim() !== '').length;
        } catch {
            /* absent is zero */
        }
        if (existing >= MAX_ROWS_PER_SESSION) return;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, `${JSON.stringify(row)}\n`);
    } catch {
        // An instrument is never a reason to change what the gate does.
    }
}

/** Read a session's rows back, skipping anything unparseable. */
export function readFeederRows(workspaceRoot: string, sessionKey: string): GraphFeederRow[] {
    try {
        return fs
            .readFileSync(feederFile(workspaceRoot, sessionKey), 'utf-8')
            .split('\n')
            .filter((l) => l.trim() !== '')
            .map((l) => {
                try {
                    return JSON.parse(l) as GraphFeederRow;
                } catch {
                    return null;
                }
            })
            .filter((r): r is GraphFeederRow => r !== null);
    } catch {
        return [];
    }
}

/** Build the row. Pure, so the shape can be asserted without a filesystem. */
export function buildFeederRow(input: {
    turn: number;
    layer: FeederLayer;
    state: GraphState;
    fFired: boolean;
    fMode: FeederMode | null;
    paths: readonly string[];
    graph: { verdict: GraphVerdict; untested: number; tested: number };
    at?: string;
}): GraphFeederRow {
    return {
        at: input.at ?? new Date().toISOString(),
        turn: input.turn,
        layer: input.layer,
        graph_state: input.state,
        f: input.fFired,
        f_mode: input.fMode,
        graph: input.graph.verdict,
        graph_untested: input.graph.untested,
        graph_tested: input.graph.tested,
        paths: input.paths.slice(0, MAX_PATHS).map((p) => p),
        path_count: input.paths.length,
    };
}
