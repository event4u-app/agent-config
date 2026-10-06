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
 * source paths, repo-relative wherever the edit lay inside the workspace. There
 * is no field able to hold a prompt, a file body, a reply or a command — the same
 * PII-exclusion-by-construction discipline `domain-safety-pii` § Surface 2 asks
 * of a log line, and the same shape `ToolCall` already has. Paths are in the set
 * because they are the evidence a human labeller needs in step 3.3 and because
 * the gate's own refusal text already quotes them; they are capped so one turn
 * cannot write an unbounded row. An edit OUTSIDE the workspace root is the one
 * shape that could carry identifying content, and {@link buildFeederRow}
 * REDACTS it to {@link OUTSIDE_WORKSPACE} — it does not drop it, which was tried
 * and rejected for the reason recorded at that call site.
 *
 * WHERE THAT PROPERTY ACTUALLY HOLDS, stated at its real width. The redaction
 * lives in `buildFeederRow`, so it covers every row THIS module builds, which is
 * every row anything writes today. It is not enforced by the TYPE:
 * `GraphFeederRow.paths` is a plain `string[]` and {@link appendFeederRow} is
 * exported and checks nothing, so a future second writer could persist an
 * unredacted path with no compile error and no runtime guard. A completion
 * review pointed out that the previous wording — "true by construction" without
 * qualification — claimed exactly the convention it was disclaiming. The
 * field-shape half of the header IS by construction: there is no field a prompt
 * or a file body could occupy. The path-redaction half is by call site, and the
 * two are worth not conflating.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { detectSources, type GraphState, NATIVE_CACHE_REL, pickSource } from '../code_graph/detect.js';
import { loadGraph } from '../code_graph/query.js';
import { untested } from '../code_graph/verbs.js';

/** At most this many edit paths per row. */
const MAX_PATHS = 5;

/**
 * What a row stores in place of an edit that lay outside the workspace root.
 *
 * Not a path, deliberately: it carries no directory, no user name and no
 * project name, so it cannot be an egress surface when `paths` is handed to an
 * external labeller. It still tells that labeller an edit happened out of tree,
 * which is the difference between answering `cannot tell` and being misled.
 */
export const OUTSIDE_WORKSPACE = '<outside-workspace>';

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
 * Put edit paths into the shape the graph indexes them in.
 *
 * THE DEFECT THIS REPAIRS, measured before it was fixed. `ToolCall.path` carries
 * whatever the host wrote into `file_path`, and Claude Code writes an ABSOLUTE
 * path. The graph keys its node ids on repo-relative paths, so `seedsForFiles`
 * resolved nothing, `untested` returned an empty seed set, and the feeder wrote
 * `no-seeds`. 19 accrued rows carried a path; the 18 that reached the graph at
 * all recorded `no-seeds`, and the nineteenth was skipped on `behind:0`. Not one
 * of them was a fact about the code: the graph arm was mute for its whole
 * accrual window. Probed at `c58d7eae` against the real index —
 * `src/scripts/check_memory.ts` resolves 60 seeds relative and 0 absolute.
 *
 * It survived review because every fixture fed a relative path. A test never run
 * against the shape the host emits cannot see this, which is why the regression
 * test added with this fix is written against the absolute form.
 *
 * Repaired HERE rather than at the one call site, because `graphUntestedVerdict`
 * is exported and a second caller would meet the same silence.
 *
 * A path outside the workspace root is returned unchanged: it is not addressable
 * in the graph under any spelling, and rewriting it to `../..` would turn an
 * honest `no-seeds` into a relative-looking string that still indexes nothing.
 *
 * SEPARATORS ARE NORMALISED TO POSIX, and that is not cosmetic. The indexer
 * writes `source_file` through its own `toPosixRel`, and the store matches it by
 * exact string, so on a host whose `path.sep` is a backslash a raw
 * `path.relative` would emit `src\service.ts`, resolve no seeds, and record
 * `no-seeds` — reintroducing precisely the defect above as a platform-
 * conditional one. Found by the completion review of the commit that first fixed
 * it; neither regression test could have seen it, because both run on one
 * platform.
 */
export function toRepoRelative(root: string, paths: readonly string[]): string[] {
    let realRoot: string | null = null;
    return paths.map((p) => {
        if (!path.isAbsolute(p)) return p;
        // RAW FIRST, RESOLVED ONLY AS A FALLBACK. The indexer keys `source_file`
        // through a plain tree walk with NO realpath, so the raw spelling is the
        // one it agrees with. Resolving unconditionally fixes a symlinked ROOT
        // and breaks the opposite shape: an in-tree file reached through an
        // in-repo symlink whose target leaves the workspace would relativise to
        // a `..` segment and be redacted off the row — destroying the labelling
        // evidence for a path that is in the tree, which is the harm the
        // redact-rather-than-drop argument exists to prevent. Trying the raw
        // comparison first keeps both: the common case matches the indexer, and
        // the resolved walk is spent only when the raw answer says foreign.
        const raw = _relativeInside(root, p);
        if (raw !== null) return raw;
        realRoot ??= _resolveReal(root);
        return _relativeInside(realRoot, _resolveReal(p)) ?? p;
    });
}

/**
 * `from` -> `to` as a POSIX repo-relative path, or `null` when `to` is outside.
 *
 * `rel === ''` means `to` IS the root, which is emphatically not outside it —
 * folding that into the escape branch made the row say the opposite of the
 * truth. The `..` test is for a leading `..` SEGMENT, not a leading `..` string:
 * `startsWith('..')` also matches an in-tree first segment that merely begins
 * with two dots, such as `..cache/service.ts`.
 */
function _relativeInside(from: string, to: string): string | null {
    let rel: string;
    try {
        rel = path.relative(from, to);
    } catch {
        return null;
    }
    if (rel === '') return '.';
    if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
    return rel.split(path.sep).join('/');
}

/**
 * The real location of a path, for comparing one host-supplied string to
 * another.
 *
 * WHY THIS IS NOT OPTIONAL. `workspace_root` and a tool call's `file_path` are
 * two independently produced strings, and they routinely disagree about
 * symlinks: macOS `/tmp` resolves to `/private/tmp`, and a worktree session's
 * project dir can resolve to the parent checkout. Relativising them raw sends
 * EVERY in-repo path down the foreign branch, which would return the graph to
 * `no-seeds` and — now that the row redacts a foreign path — would also destroy
 * the labelling evidence instead of merely failing to resolve it. That is
 * strictly worse than the defect this module was repaired for, and it fails the
 * same way: silently. A completion review found it; no fixture could, because
 * every fixture builds its paths from the same realpathed root string.
 *
 * It walks up to the NEAREST EXISTING ancestor and rejoins the remainder, so a
 * file the turn deleted — or a root that does not exist, as a pure unit test's
 * does — still resolves through whatever part of the chain is real. The walk
 * has to be symmetric or it introduces the very bug it fixes: resolving the root
 * through an existing ancestor while leaving the path unresolved makes the two
 * disagree by exactly the symlink prefix. That asymmetry was in the first
 * version of this function and the suite's own POSIX test caught it.
 *
 * KNOWN REMAINING LIMIT: a case-insensitive filesystem can still present the
 * same file under two spellings this does not reconcile. Named rather than
 * silently assumed away.
 */
function _resolveReal(p: string): string {
    const abs = path.resolve(p);
    const tail: string[] = [];
    let cur = abs;
    for (;;) {
        try {
            const real = fs.realpathSync(cur);
            return tail.length === 0 ? real : path.join(real, ...[...tail].reverse());
        } catch {
            const parent = path.dirname(cur);
            // Reached the filesystem root with nothing resolvable — the absolute
            // form is the best answer available, and it is still symmetric
            // because the other side took the same walk.
            if (parent === cur) return abs;
            tail.push(path.basename(cur));
            cur = parent;
        }
    }
}

/**
 * Would storing this path put content from outside the workspace on the row?
 *
 * Broader than `path.isAbsolute` on purpose. Two shapes bypass that test while
 * carrying exactly the identifying content the marker exists to withhold from
 * the external labeller: an out-of-tree path already in relative form
 * (`../other-project/x.ts`), and a foreign-platform absolute path, which POSIX
 * `path.isAbsolute` reports as relative. Both were found by a completion review.
 */
function _escapesWorkspace(p: string): boolean {
    return (
        path.isAbsolute(p) ||
        path.win32.isAbsolute(p) ||
        p === '..' ||
        p.startsWith('../') ||
        p.startsWith(`..${path.sep}`)
    );
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
    // The graph indexes repo-relative paths; a host hands us absolute ones.
    // NOT before the early returns below. Relativising walks the filesystem once
    // per absolute path, and this runs inside a stop hook whose latency the
    // module header names as an unmeasured risk — a host that timed the hook out
    // would drop the gate's refusal. Spending those syscalls only to discover
    // there is no usable source is cost for nothing.
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
        const r = untested(g, toRepoRelative(root, paths), state);
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

/**
 * Build the row.
 *
 * NO LONGER PURE, and the previous line of this docstring still claimed it was.
 * Relativising reads the filesystem — `toRepoRelative` falls back to
 * `fs.realpathSync` when the raw comparison says foreign — so this touches disk
 * for any absolute path outside the root, and the unit tests that pass a
 * non-existent `/workspace` root walk real directories on the way to answering.
 * It is still DETERMINISTIC given the tree, which is what the tests actually
 * rely on. A completion review caught the stale claim; in a module whose header
 * argues its guarantees hold by construction rather than by convention, a
 * docstring that has quietly stopped being true is the same defect class as the
 * rest of this change.
 *
 * `root` is required rather than optional, and relativising happens HERE rather
 * than at the call site, for two reasons that point the same way. The caller is
 * `turn_end_gate_hook.ts`, which sits against a shrink-only 1,500-line source
 * budget it is exactly at — so the five lines this would cost there are five
 * lines it does not have, and its own header already says such things belong in
 * `_lib`. And a caller that can omit the root is a caller that can reintroduce
 * the absolute-path defect {@link toRepoRelative} exists to close: the stored
 * paths a step-3.3 labeller reads must be the paths the verdict was taken over.
 */
export function buildFeederRow(input: {
    /** The workspace root the paths are made relative to. */
    root: string;
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
        // An out-of-workspace edit is REDACTED, not dropped and not stored
        // verbatim. After relativising, a still-absolute path is exactly one
        // that lay outside the root.
        //
        // Verbatim is an egress surface: `paths` is handed to external council
        // seats at step 3.3's labelling, and a home-rooted path names a real
        // user and an unrelated project.
        //
        // Dropping it looked right and was worse, which a completion review
        // caught before it shipped. It would have shortened `paths` below
        // `path_count` and so reused the protocol's truncation signal for a
        // second, different cause — two meanings on one wire, with no field
        // separating them. Worse, a turn editing one in-repo file and one file
        // outside the root would then be excluded from labelling altogether,
        // losing a perfectly labellable in-repo path from a corpus that is
        // blocked precisely for want of rows.
        //
        // The marker keeps the lengths equal, so truncation stays the only
        // cause of `path_count > paths.length`; keeps the row honest that an
        // edit happened outside the tree, so a labeller can answer
        // `cannot tell` rather than be silently misled; and carries nothing
        // identifying. The graph's answer is unchanged either way — the probe
        // sees the real path and resolves no seeds for it.
        paths: toRepoRelative(input.root, input.paths.slice(0, MAX_PATHS)).map((p) =>
            _escapesWorkspace(p) ? OUTSIDE_WORKSPACE : p,
        ),
        path_count: input.paths.length,
    };
}
