/**
 * Detector G of `turn-end-gate` — a completion claim wider than its evidence.
 *
 * It lives here rather than in the hook for the reason detector E does: the
 * hook sits at its source-size ceiling, and this module imports nothing from
 * it. The hook passes the two prose views in, so neither side imports the other.
 *
 * Two reasons share the one id, `coverage`, because both answer "is the claim
 * as wide as the evidence":
 *
 *   · `partial_ratio` — the reply claims done and reports `N of M` with N < M.
 *     The measured case: a book reported complete with about 165 of 405 pages
 *     covered.
 *   · `unlisted_surface` — the turn edited a runnable surface, ran nothing that
 *     drives it, and the reply claims done without saying what is not verified.
 *
 * It RECORDS and never refuses. A new detector owes pre-registered bars before
 * it can refuse a turn (`docs/contracts/turn-end-detector-demotion.md`), and a
 * ratio beside a claim is not always a claim about that ratio ("2 of 3 options"
 * in a reply that also says "fertig"). The arming decision reads a measurement
 * of how often it fires and on what.
 */
import * as path from 'node:path';

import { deriveLiveSurfaces, readText, type LiveSurface } from './live_surfaces.js';
import { commandSegments } from './verification_command.js';
import { RECORDED_SUFFIX, type RefusalDetectorId } from './turn_end_refusals.js';

/**
 * A completion claim in the delivered reply. Deliberately narrow: the German and
 * English closings the corpus actually produced, anchored to a line so a mid-reply
 * "fertig" inside a sentence about something else does not fire.
 *
 * Measured shapes it must catch (round 7, § Phase 1): "Fertig, Matze." ·
 * "Damit ist alles erledigt." · "Aufgabe erledigt." · "der komplette Auftrag ist
 * durch".
 *
 * Shared with detector D, which is why it lives here: detector G uses the same
 * trigger and adds no completion keyword of its own, per the 2026-08-12 council
 * bound quoted on `NEGATED_CLAIM_RE`.
 */
export const COMPLETION_RE =
    /(^|\n)\s*(?:\*\*)?(?:fertig\b|damit ist alles erledigt|aufgabe erledigt|alles erledigt\b|komplett(?:er)? (?:auftrag|abgearbeitet)|der komplette auftrag ist durch|done[.!]|all done\b|task complete)/i;

/**
 * The line the claim was found on says the opposite of a claim.
 *
 * A line-anchored keyword cannot tell "Fertig." from "Fertig ist der Fix noch
 * nicht." — both open with the same token, and the second is exactly the honest
 * status report this gate exists to ENCOURAGE. Measured 2026-08-12: three of ten
 * realistic closings were refused, and all three were "not done yet" lines.
 *
 * This is a negation check on the SAME line, not another attempt to enumerate
 * completion phrasings. The council that reviewed this guard (anthropic +
 * openai, 2026-08-12) stated the bound plainly: a finite pattern cannot cover an
 * infinite false-positive set, so extending the keyword list again would repeat
 * the move that has already failed three times on the sibling git guard. What
 * makes a block defensible here is not the pattern — it is that the pattern only
 * fires as a TRIGGER to consult structured CI state (`ci.settled`), which is the
 * council's Tier-2 shape. This check removes the cases where the prose itself
 * already contradicts the trigger.
 */
export const NEGATED_CLAIM_RE =
    /\b(noch nicht|nicht fertig|nicht durch|wäre verfrüht|ist verfrüht|not yet|not done|isn'?t done|nein)\b/i;

/** The line `at` falls on — the scope a negation has to appear in to count. */
export function lineAround(prose: string, at: number): string {
    // A match anchored on `(^|\n)\s*` can start at a newline, or before a blank
    // line; its line is the one the first non-blank character is on.
    while (at < prose.length && /\s/.test(prose[at] as string)) at += 1;
    const start = prose.lastIndexOf('\n', at) + 1;
    const end = prose.indexOf('\n', at);
    return prose.slice(start, end === -1 ? prose.length : end);
}

/** Detectors that record a finding and never refuse the turn. */
export const RECORD_ONLY_DETECTORS: ReadonlySet<RefusalDetectorId> = new Set<RefusalDetectorId>([
    'coverage',
]);

export type CoverageCode = 'partial_ratio' | 'unlisted_surface';

/** The shape the gate collects. Kept structural so this module imports no hook. */
export interface CoverageFinding {
    detector: 'coverage';
    evidence: string;
    reason: string;
    code: CoverageCode;
}

/** A `Not verified:` / `Nicht verifiziert:` line — the reply's own list of what it did not check. */
const NOT_VERIFIED_RE = /^[ \t]*(?:[-*][ \t]+)?(?:\*\*)?(?:not verified|nicht verifiziert)(?:\*\*)?[ \t]*:/im;

/** `165 of 405`, `165 von 405`, `40/41`. */
const RATIO_RE = /\b(\d+)\s*(?:of|von|\/)\s*(\d+)\b/gi;

/**
 * The reply with code, quotes and tables removed but ratios kept.
 *
 * `visibleProse` in the hook also drops every path-shaped token, and `40/41`
 * is one, so the ratio has to be read off this narrower view.
 */
function ratioProse(fenceStripped: string): string {
    return fenceStripped
        .replace(/`[^`\n]*`/g, ' ')
        .replace(/^[ \t]*>.*$/gm, ' ')
        .replace(/^[ \t]*\|.*\|[ \t]*$/gm, ' ');
}

/** Offsets covered by a `Not verified:` line and the non-blank block it opens. */
function notVerifiedSpans(text: string): Array<[number, number]> {
    const spans: Array<[number, number]> = [];
    const re = new RegExp(NOT_VERIFIED_RE.source, 'gim');
    for (const m of text.matchAll(re)) {
        const start = text.lastIndexOf('\n', m.index) + 1;
        const blank = text.slice(start).search(/\n[ \t]*\n/);
        spans.push([start, blank === -1 ? text.length : start + blank]);
    }
    return spans;
}

/** Whether the reply claims completion, on a line that does not negate it. */
export function completionClaimAt(visible: string): number | null {
    const m = COMPLETION_RE.exec(visible);
    if (m === null) return null;
    if (NEGATED_CLAIM_RE.test(lineAround(visible, m.index))) return null;
    return m.index;
}

/**
 * Reason `partial_ratio`: a completion claim and an `N of M` with N < M that
 * the reply did not list under what it has not verified.
 *
 * @param fenceStripped the reply with fenced blocks removed
 * @param visible       the hook's `visibleProse` of the same reply
 */
export function partialRatioIn(fenceStripped: string, visible: string): CoverageFinding | null {
    if (completionClaimAt(visible) === null) return null;
    const text = ratioProse(fenceStripped);
    const spans = notVerifiedSpans(text);
    for (const m of text.matchAll(RATIO_RE)) {
        const n = Number(m[1]);
        const total = Number(m[2]);
        if (!(n < total) || total === 0) continue;
        const at = m.index;
        if (spans.some(([s, e]) => at >= s && at < e)) continue;
        if (NEGATED_CLAIM_RE.test(lineAround(text, at))) continue;
        return {
            detector: 'coverage',
            code: 'partial_ratio',
            evidence: lineAround(text, at).trim().slice(0, 120),
            reason:
                `partial_ratio: a completion claim beside ${m[0]} — report what is left, or ` +
                'list it under "Not verified:" (verify-completion-evidence)',
        };
    }
    return null;
}

export interface RecordedCounts {
    counts: Record<string, number>;
    codes: Record<string, number>;
    first_at: string;
    last_at: string;
}

/** The structural slice of a transcript tool call this detector reads. */
export interface CallLike {
    name: string;
    command?: string;
    path?: string;
}

const EDIT_TOOLS: ReadonlySet<string> = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/** Surfaces a render or browser run reaches without naming them: a web page. */
const BROWSER_KINDS: ReadonlySet<LiveSurface['kind']> = new Set(['npm-script', 'playwright']);

/** The config path a `playwright test` run names (`--config X`, `-c X`, quoted or not); null when none. */
function playwrightConfig(command: string): string | null {
    const m = /\s(?:--config(?:=|\s+)|-c\s+)("[^"]+"|'[^']+'|\S+)/.exec(command);
    return m ? (m[1] as string).replace(/^["']|["']$/g, '') : null;
}

/** `start` run as one of the line's commands, not merely mentioned in one. */
function runsCommand(segs: readonly string[], start: string): boolean {
    return segs.some((x) => x === start || x.startsWith(`${start} `));
}

/** A segment that runs `playwright test` or `agent-config ui:render`, behind an env prefix or a runner. */
const PLAYWRIGHT_RUN = /^(?:\w+=\S*\s+)*(?:(?:npx|bunx|pnpm(?:\s+exec)?|yarn)\s+)?playwright\s+test\b/;
const RENDER_RUN = /^(?:\w+=\S*\s+)*(?:(?:npx|bunx|pnpm(?:\s+exec)?|yarn)\s+)?(?:\S*\/)?agent-config\s+ui:render\b/;

/**
 * A call that drove `surface`: its start command, its URL, or a render or browser
 * run over a web page. A `playwright test` run that names another config does not
 * drive a surface derived from this one.
 */
function drives(segs: readonly string[], surface: LiveSurface, root: string): boolean {
    const playwrightRuns = segs.filter((x) => PLAYWRIGHT_RUN.test(x));
    if (surface.kind === 'playwright' && playwrightRuns.length > 0) {
        const config = surface.derived_from.replace(/:\d+$/, '');
        return playwrightRuns.some((run) => {
            const named = playwrightConfig(run);
            return named === null || path.relative(root, path.resolve(root, named)).split(path.sep).join('/') === config;
        });
    }
    // A playwright run credits an npm surface only through this repo's own root config
    // (its webServer); a run naming another app's config does not.
    const servedBy = surface.webServerOf ?? [];
    if (surface.kind === 'npm-script' && servedBy.length > 0 && playwrightRuns.length > 0) {
        // Credit only through a config whose webServer starts this script: the one a run names,
        // or, with none named, any root config.
        const own = playwrightRuns.some((run) => {
            const named = playwrightConfig(run);
            if (named === null) return true;
            return servedBy.includes(path.relative(root, path.resolve(root, named)).split(path.sep).join('/'));
        });
        if (own) return true;
    }
    if (BROWSER_KINDS.has(surface.kind) && segs.some((x) => RENDER_RUN.test(x))) return true;
    if (surface.start !== null && runsCommand(segs, surface.start)) return true;
    // A URL counts in a command that is not just printing it, and as a whole host:port.
    if (surface.url === undefined) return false;
    const escaped = surface.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const url = new RegExp(`${escaped}(?![\\w])`);
    return segs.some((x) => !/^(?:echo|printf)\b/.test(x) && url.test(x));
}

/**
 * Reason `unlisted_surface`: a completion claim, a turn that edited a file
 * under a derived surface's root, no call that drove that surface, and no
 * `Not verified:` block naming it.
 *
 * The map is derived in memory (`deriveLiveSurfaces`), never written from the
 * Stop path: the gate runs in consumer repos, and a turn-end hook that drops a
 * file into one is a side effect nobody asked for.
 */
export function unlistedSurfaceIn(
    fenceStripped: string,
    visible: string,
    calls: readonly CallLike[],
    workspaceRoot: string,
    given?: readonly LiveSurface[],
): CoverageFinding | null {
    // The cheap checks first: most turn ends claim nothing or edit nothing, and
    // those never read the repo.
    if (completionClaimAt(visible) === null) return null;
    const edits = calls.filter((c) => EDIT_TOOLS.has(c.name) && c.path !== undefined).map((c) => c.path as string);
    if (edits.length === 0) return null;
    const surfaces = given ?? deriveLiveSurfaces(workspaceRoot);
    if (surfaces.length === 0) return null;
    // Each command split once, not once per surface.
    const commands = calls
        .map((c) => c.command ?? '')
        .filter((c) => c !== '')
        .map((c) => commandSegments(c).map((x) => x.trim()));
    // Inline code kept (backticks dropped): a list entry is often `npm run dev`.
    const text = fenceStripped.replace(/`/g, ' ');
    const listed = notVerifiedSpans(text).map(([s, e]) => text.slice(s, e)).join('\n');
    for (const surface of surfaces) {
        const root = path.resolve(workspaceRoot, surface.root);
        const edited = edits.find((p) => {
            const rel = path.relative(root, path.resolve(workspaceRoot, p));
            return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
        });
        if (edited === undefined) continue;
        if (commands.some((c) => drives(c, surface, workspaceRoot))) continue;
        const names = [surface.name, surface.start, surface.url].filter((x): x is string => typeof x === 'string');
        if (names.some((n) => namedIn(listed, n))) continue;
        return {
            detector: 'coverage',
            code: 'unlisted_surface',
            evidence: `${path.relative(workspaceRoot, edited)} under ${surface.kind} ${surface.name}`,
            reason:
                `unlisted_surface: a completion claim over ${surface.kind} "${surface.name}" ` +
                `(${surface.start ?? 'no start command'}), which nothing in the turn drove — drive it, ` +
                'or list it under "Not verified:" (verify-completion-evidence)',
        };
    }
    return null;
}

/** `name` as a whole word of `text`: `dev` is named by "dev (npm run dev)", not by "development". */
function namedIn(text: string, name: string): boolean {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?:^|[^\\w-])${escaped}(?:$|[^\\w-])`, 'i').test(text);
}

/** Both reasons, ratio first: the hook's one entry point for detector G. */
export function coverageGapIn(
    fenceStripped: string,
    visible: string,
    calls: readonly CallLike[],
    workspaceRoot: string | undefined,
): CoverageFinding | null {
    const ratio = partialRatioIn(fenceStripped, visible);
    if (ratio !== null || workspaceRoot === undefined) return ratio;
    try {
        return unlistedSurfaceIn(fenceStripped, visible, calls, workspaceRoot);
    } catch {
        // A surface read that fails is no finding; this detector never decides a turn.
        return null;
    }
}

/** Fold record-only findings into a session's counters. Pure. */
export function foldRecorded(
    prev: RecordedCounts | null,
    findings: ReadonlyArray<{ detector: string; code?: string }>,
    at: string,
): RecordedCounts {
    const counts = { ...(prev?.counts ?? {}) };
    const codes = { ...(prev?.codes ?? {}) };
    for (const f of findings) {
        counts[f.detector] = (counts[f.detector] ?? 0) + 1;
        if (f.code !== undefined) codes[f.code] = (codes[f.code] ?? 0) + 1;
    }
    return { counts, codes, first_at: prev?.first_at ?? at, last_at: at };
}

/** The entries of `v` that are non-negative safe integers; anything else is dropped. */
function countsOnly(v: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (typeof v !== 'object' || v === null || Array.isArray(v)) return out;
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
        if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0) out[k] = n;
    }
    return out;
}

/** Read a session's record-only counters; anything unreadable starts fresh. */
export function readRecorded(file: string): RecordedCounts | null {
    try {
        // Bounded, non-blocking, regular files only: a FIFO here must not stall the Stop hook.
        const raw = readText(file);
        if (raw === null) return null;
        const o = JSON.parse(raw) as Partial<RecordedCounts>;
        if (typeof o.counts !== 'object' || o.counts === null) return null;
        return {
            counts: countsOnly(o.counts),
            codes: countsOnly(o.codes),
            first_at: typeof o.first_at === 'string' ? o.first_at : '',
            last_at: typeof o.last_at === 'string' ? o.last_at : '',
        };
    } catch {
        return null;
    }
}

export function recordedFile(stateDir: string, sessionKey: string): string {
    // Only a derived key (`deriveSessionKey`: 32 hex characters) names a counter file.
    if (!/^[0-9a-f]{32}$/.test(sessionKey)) throw new Error('recordedFile: not a derived session key');
    return path.join(stateDir, `${sessionKey}${RECORDED_SUFFIX}`);
}
