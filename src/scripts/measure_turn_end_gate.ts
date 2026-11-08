#!/usr/bin/env -S npx tsx
/**
 * `measure-turn-end-gate` — the false-positive pass roadmap
 * `road-to-conformance-round5.md` § 3.4 asks for, run against a REAL
 * transcript corpus rather than a hand-written one.
 *
 * Why this exists as a script and not as a number in a commit message: the
 * roadmap asks to "record measured precision per detector", and a recorded
 * figure nobody can re-derive is the same class of claim this whole round
 * exists to remove. One command, same store, same numbers.
 *
 * What it measures, and what it deliberately does NOT:
 *
 *   · FIRE RATE of each detector PER TURN, over the last assistant text of the
 *     turn — the population the shipped gate inspects. R2 finding 1: the first
 *     version scored every assistant ENTRY and published the result as a
 *     per-turn rate, which inflated the population ~8.6x and scored a
 *     closing-paragraph detector over mid-turn prose.
 *   · The independent scanner's own language total, printed for CONTEXT only.
 *     It is not an agreement figure and no overlap is claimed from it: the two
 *     instruments read different spans (its first prose line; this one strips
 *     code/quotes/paths from the reply and then scores lead-first via the same
 *     classifier), and this script does no per-turn matching between them.
 *     R2 finding 7 removed the per-session min/max arithmetic that used to
 *     report disjoint findings of equal count as full agreement.
 *   · DETECTORS C AND F, added 2026-09-11 for ADR-277's named open limit: that
 *     record ships detector F with its false-positive rate UNMEASURED and says
 *     so. The rate below is the fire rate over a real corpus, which is the
 *     upper bound on it — every fire is a turn the shipped gate would have
 *     refused, and how many of those were wrong still needs a human read of the
 *     turns. An upper bound is not a precision figure and is not reported as
 *     one.
 *   · The C-SILENT OVERLAP, which is the one number ADR-277 rests an argument
 *     on. The record claims detector C does not already cover F's case, and the
 *     evidence for it was a single unit test asserting C stays silent on F's
 *     input. This counts the same thing over the corpus: of the turns F fires
 *     on, how many did C leave alone. A low count would refute the record's own
 *     "two different questions deserve two detectors" and is worth finding.
 *   · DETECTOR E, which until 2026-09-11 was scored by NO instrument at all.
 *     That gap is not cosmetic: it is how a commit came to land under the title
 *     "detector E measured" over an evidence file measuring F, with nothing in
 *     the tree able to contradict it. E is also the only detector here that
 *     reads the turn's assistant TEXTS rather than its last reply, so it needs
 *     an accumulation the other four do not — built at the same two boundaries
 *     `readTranscriptTail` uses, for the same population-parity reason C and
 *     F's tool calls are.
 *   · It does NOT score detector D. D reads `ci_last` out of per-session
 *     runtime state, which no transcript carries, so a transcript-derived D
 *     figure would be a measurement of an absent file rather than of the
 *     detector.
 *   · It does NOT compute recall against the 20 promissory occurrences the
 *     round-5 audit reported. Those came from subagent transcript READING;
 *     `conformance_scan.ts` states in its own header that promissory
 *     closings are "deliberately NOT scanned", so there is no machine-
 *     readable ground truth to score against. Claiming a recall figure here
 *     would invent one.
 *   · KNOWN RESIDUAL, R2 finding 8, not fixed here: this script re-derives the
 *     language pin with `classify` per user entry, while the gate reads the pin
 *     `language_mirror_hook` persisted — which also applies a system-locale
 *     fallback and a keep-previous rule. Where those diverge, a turn can move
 *     between "pinned de", "pinned en" and "no obligation", so detector B's
 *     rate here is close to but not identical with the gate's. Reaching parity
 *     means reusing `nextState`, which is a larger change than a measurement
 *     correction and would itself need re-measuring.
 *
 *   · THE RETRY-CONDITIONED RE-REFUSAL SHARE, which every bullet above is
 *     silent about because until 2026-09-30 nothing produced it. It does NOT
 *     come from the corpus: it is read from the gate's own shadow records under
 *     `agents/runtime/state/turn-end-gate/*.shadow.json`, written live on an
 *     allow path by the instrument `turn-end-detector-demotion.md` registers as
 *     instrument 1. Reported per LAYER and then per detector, never pooled, and
 *     never as `0.0%` where it has no denominator — see `renderQ1`.
 *   · It does NOT print that contract's **Q1**, and the distinction is in the
 *     report's own header rather than only here. Q1 conditions BOTH its halves
 *     on the detector; the shadow record cannot, because it never stores which
 *     refusal produced a retry. The two disagree in direction and neither
 *     bounds the other, so no number this prints may be read against a bar.
 *   · It does not report promissory, completion or untested at all. Those three
 *     are skipped by the gate when a dispatch is open and the shadow record
 *     carries no dispatch flag, so their denominators would absorb silences
 *     nobody observed. The contract's attribution clause already forbids it.
 *
 * Usage:
 *   ./scripts-run src/scripts/measure_turn_end_gate --store <dir> [--limit N] [--show-fires]
 *   ./scripts-run src/scripts/measure_turn_end_gate --q1 [--workspace <dir>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { classify, isSyntheticPrompt } from './language_mirror_hook.js';
import { assistantText, scanSession } from './conformance_scan.js';
import { entryText, isSidechain } from './_lib/transcript_entry.js';
import { isTestPath } from './_lib/test_path.js';
import {
    detectDroppedDecision,
    detectLanguage,
    detectPromissory,
    detectUntestedChange,
    detectUnverifiedEdit,
    extractToolCalls,
    type ToolCall,
} from './hooks/turn_end_gate_hook.js';
import {
    DETECTOR_IDS,
    SHADOW_LAYERS,
    SHADOW_SUFFIX,
    emptyCounts,
    parseShadowRecord,
    refusalStateDir,
    type DetectorCounts,
    type RefusalDetectorId,
    type ShadowLayer,
    type ShadowRecord,
} from './_lib/turn_end_refusals.js';

// The shadow rollup lives with its one reader. It moved here from
// `_lib/turn_end_refusals.ts`, where nothing on the gate's own path imported it
// (road-to-measurement-helpers-living-with-their-measurement 1.2).
// ---------------------------------------------------------------------------
// Q1 — the shadow rollup (step 2.2)
// ---------------------------------------------------------------------------

/**
 * One layer's Q1 inputs, kept as counts so the ratio is computed where it is
 * read rather than stored.
 *
 * SPLIT BY LAYER BEFORE DETECTOR, and that order is the shape's whole point
 * rather than a presentation choice. A `stop_hook_active` retry follows ANY
 * stop concern's block — not only this gate's — so pooling the two layers
 * divides another concern's retries into this gate's refusals and calls the
 * result a re-refusal share. `ShadowRecord.retries_observed` is keyed the same
 * way so the denominator splits with the numerator; an independent review
 * found the first version pooling the denominator, which left the per-layer
 * ratio uncomputable even though every row already carried its `layer`.
 */
export interface ShadowLayerStats {
    layer: ShadowLayer;
    /**
     * Retries observed on this layer across every readable record — the
     * denominator, counting retries that came back CLEAN as well as refusing
     * ones. A clean retry writes no row, so without this a zero numerator and
     * "no retry happened" are the same empty list.
     */
    retries: number;
    /** Shadow rows on this layer, by detector — the numerators. */
    byDetector: DetectorCounts;
    /**
     * Rows on this layer, summed.
     *
     * MAY EXCEED `retries`, legitimately: one retry that would have been
     * refused by two detectors writes two rows, and the demotion contract's
     * attribution rule counts it once for each. A per-detector ratio stays
     * within [0, 1]; this total is not a share and is printed as a count.
     */
    rows: number;
}

/**
 * Rollup over every session's shadow record under a workspace.
 *
 * Two bounds travel with every number this carries. Both are properties of the
 * instrument rather than of a particular reading, both are stated on
 * `ShadowRecord`, and both are repeated here because a consumer reads this
 * type and not that comment:
 *
 *   - A retry whose transcript is unreadable or oversized records NOTHING —
 *     no row and no retry. The denominator shrinks with the numerator, so a
 *     Q1 read off this is an UPPER bound rather than a point estimate.
 *   - On a host that sends no `session_id`, every session shares one record
 *     and one counter. `files` below then counts FILES and not sessions, and
 *     a reader taking one for the other over-states the sample.
 */
export interface ShadowStats {
    /**
     * Shadow FILES parsed. Deliberately not named `sessions`: one file is one
     * session only on a host that sends a `session_id`.
     */
    files: number;
    /** Files present but unparseable. A non-zero value makes every rate a floor. */
    unreadable: number;
    /**
     * Rows dropped to `SHADOW_MAX_ROWS`, summed. Non-zero means the row arrays
     * are samples of their own sessions and every numerator is a floor.
     */
    dropped: number;
    byLayer: ShadowLayerStats[];
    earliest: string | null;
    latest: string | null;
}

/** A zeroed rollup, DERIVED from `SHADOW_LAYERS` for the reason `emptyCounts` gives. */
export function emptyShadowStats(): ShadowStats {
    return {
        files: 0,
        unreadable: 0,
        dropped: 0,
        byLayer: SHADOW_LAYERS.map((layer) => ({
            layer,
            retries: 0,
            byDetector: emptyCounts(),
            rows: 0,
        })),
        earliest: null,
        latest: null,
    };
}

/**
 * Aggregate every shadow record under a workspace.
 *
 * Reads through `parseShadowRecord`, never by hand: the gate writes these
 * files, and a reader carrying its own idea of their shape is how a producer
 * and a consumer drift apart — the exact seam the 2026-09-30 review round
 * found uncrossed between the verification recorder and its classifier.
 */
export function collectShadowStats(workspaceRoot: string): ShadowStats {
    const dir = refusalStateDir(workspaceRoot);
    const stats = emptyShadowStats();
    const byLayer = new Map(stats.byLayer.map((b) => [b.layer, b]));
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return stats;
    }
    for (const name of entries) {
        if (!name.endsWith(SHADOW_SUFFIX)) continue;
        let rec: ShadowRecord | null = null;
        try {
            rec = parseShadowRecord(fs.readFileSync(path.join(dir, name), 'utf-8'));
        } catch {
            rec = null;
        }
        if (rec === null) {
            stats.unreadable += 1;
            continue;
        }
        stats.files += 1;
        stats.dropped += rec.dropped;
        for (const layer of SHADOW_LAYERS) {
            const bucket = byLayer.get(layer);
            if (bucket !== undefined) bucket.retries += rec.retries_observed[layer] ?? 0;
        }
        for (const row of rec.would_refuse_again) {
            const bucket = byLayer.get(row.layer);
            if (bucket === undefined) continue;
            bucket.byDetector[row.detector] += 1;
            bucket.rows += 1;
        }
        // EMPTY STRINGS ARE SKIPPED, NOT COMPARED. `parseShadowRecord` coerces a
        // missing `first_at` to `''`, and `'' < <any ISO stamp>` is true, so a
        // record lacking the field would win the earliest comparison and the
        // report would print an empty window start beside a real end. An absent
        // timestamp is not an earlier one.
        if (rec.first_at !== '' && (stats.earliest === null || rec.first_at < stats.earliest)) {
            stats.earliest = rec.first_at;
        }
        if (rec.last_at !== '' && (stats.latest === null || rec.last_at > stats.latest)) {
            stats.latest = rec.last_at;
        }
    }
    return stats;
}

/**
 * Detectors whose share may NOT be reported off a shadow rollup, because the
 * record cannot tell a dispatch-suppressed retry from a clean one.
 *
 * `runDetectors` in `turn_end_gate_hook.ts` skips A, D and F when a subagent
 * dispatch is open — they did not run, so the turn is not an observation of
 * them staying silent. `recordShadow` then increments `retries_observed`
 * unconditionally and writes no dispatch flag, so every dispatch-suppressed
 * retry lands in those three denominators as a "would not have refused" that
 * nobody observed. In a suite whose delegation policy dispatches by default
 * that is not a rare branch.
 *
 * The demotion contract already forbids publishing it: *"A rollup that cannot
 * tell a dispatch-suppressed turn from a clean one may not report Q2 for A or
 * D at all."* This set is that clause applied to the shadow rollup, extended to
 * F — the contract's attribution paragraph names only A and D because it
 * predates F, while its own § The six detectors table and the gate both gate
 * all three. The wider set is the safe reading of a censoring rule.
 *
 * Closing this needs a `dispatch_open` flag on the shadow row, which is a
 * PRODUCER change. Until then these three are censored rather than estimated.
 */
export const DISPATCH_CENSORED_DETECTORS: ReadonlySet<RefusalDetectorId> =
    new Set<RefusalDetectorId>(['promissory', 'completion', 'untested']);

/**
 * The **retry-conditioned re-refusal share** for one detector on one layer, or
 * `null` when the layer observed no retry.
 *
 * ```
 * THIS IS NOT THE Q1 `turn-end-detector-demotion.md` REGISTERS BARS AGAINST.
 * NEVER COMPARE IT TO A BAR IN THAT TABLE.
 * ```
 *
 * The contract defines Q1 as *"of **a detector's** eligible initial refusals,
 * the share whose immediate retry is refused again by the same detector"*. Both
 * halves of that are conditioned on the detector. This function conditions
 * NEITHER: the denominator is every retry observed on the layer, whatever
 * refusal produced it, and the numerator is every row where this detector would
 * have fired, whatever refusal produced the retry.
 *
 * **They disagree in direction, so this is not a bound either.** Take ten
 * retries on a layer, nine following `verification` refusals and one following
 * a `language` refusal, with one `language` row. The contract's Q1 for B is
 * 1/1 = 100 % — bar crossed, a demotion study authorised. This function returns
 * 1/10 = 10 % — bar not crossed. Opposite verdicts on identical evidence. The
 * numerator can also run the other way, since a `language` row on a retry that
 * followed a `verification` refusal counts here and does not count there.
 *
 * **Why it is shaped this way, which is a producer limit rather than a choice.**
 * `ShadowRecord` carries no originating detector: `retries_observed` is keyed by
 * layer alone and a row records only what WOULD fire, never what did. The
 * session's `RefusalRecord` holds per-detector COUNTS for the whole session and
 * `refused_turn` for the last refused turn, so the per-turn origin needed to
 * condition this denominator is not on disk anywhere. Computing the registered
 * Q1 needs the producer to record it; that is named as the open residue on
 * `road-to-a-stop-that-holds` step 2.2 rather than papered over here.
 *
 * `null` RATHER THAN ZERO on an empty denominator, and that distinction is why
 * `retries_observed` exists at all: zero means "retries happened and this
 * detector would not have refused any of them", a finding about the detector,
 * while null means "nothing was observed", a finding about the sample.
 * Collapsing them publishes the second as the first.
 */
export function retryConditionedShare(
    stats: ShadowStats,
    layer: ShadowLayer,
    detector: RefusalDetectorId,
): number | null {
    const bucket = stats.byLayer.find((b) => b.layer === layer);
    if (bucket === undefined || bucket.retries === 0) return null;
    return bucket.byDetector[detector] / bucket.retries;
}

interface Counts {
    /**
     * TURNS, not entries. R2 finding 1: the first version incremented a counter
     * named `assistant_turns` on every assistant entry and ran both detectors on
     * each one, while the gate only ever evaluates the LAST assistant text of a
     * turn. A turn with k prose entries contributed k samples to the instrument
     * and 1 to the gate, so the published "18.0% of turns" was a per-ENTRY rate
     * wearing a per-turn label — and detector A, a closing-paragraph detector by
     * construction, was being scored over mid-turn prose.
     */
    turns: number;
    /** Assistant entries seen — kept only to show the ratio the old bug hid. */
    assistant_entries: number;
    promissory_fires: number;
    language_fires: number;
    /** Detector C — an edit with nothing run after it that could have checked it. */
    unverified_fires: number;
    /** Detector F — production source changed, no test touched, done claimed. */
    untested_fires: number;
    /** Detector E — an ask made earlier in the turn, absent from the closing reply. */
    dropped_fires: number;
    /**
     * Turns carrying two or more assistant texts — E's precondition, and the
     * same thing `turns_with_edit` is for C and F. Without it a low E rate is
     * unreadable: "rarely applicable" and "rarely right" are different verdicts
     * and only this denominator separates them.
     */
    turns_multi_text: number;
    /**
     * E fires inside a turn that also made a tool call. E was designed from a
     * stop-hook nudge producing a second assistant execution mid-turn, which is
     * a tool-bearing shape; a fire OUTSIDE it is the one to read first, because
     * it is the one the detector was not designed from.
     */
    dropped_with_tool: number;
    /**
     * Turns where F fired and C did NOT. ADR-277 argues C cannot stand in for
     * F; this is that argument's denominator-free form. F fires minus this is
     * the set both would have caught.
     */
    untested_c_silent: number;
    /** Turns that edited at least one file — F's and C's shared precondition. */
    turns_with_edit: number;
    /**
     * F's conditions, counted cumulatively, so a zero fire count is readable.
     * A detector that never fires is either narrow-and-right or inert, and the
     * difference is entirely in WHICH condition did the silencing — reporting
     * only the fire count leaves that unanswerable and invites the wrong one of
     * the two conclusions.
     */
    e1_production_source: number;
    /** …and touched no test file anywhere in the turn. */
    e2_no_test_touched: number;
    /**
     * Where F fired — session prefix and turn ordinal only, plus the detector's
     * own evidence span. ADR-277's open limit is a false-POSITIVE rate, and no
     * instrument can decide that: only a human reading the turn can say whether
     * a refusal would have been right. This is the pointer that makes the read
     * possible instead of leaving "measure it" as an instruction nobody can act
     * on. Printed only under `--show-fires`, because the spans carry the
     * consumer's own file paths.
     */
    untested_sites: { session: string; turn: number; evidence: string }[];
    /**
     * Where E fired, same shape and same reason as `untested_sites`: a fire
     * count is an upper bound on the false-positive rate and nothing more, so
     * the pointer that makes a human read possible ships with it.
     */
    dropped_sites: { session: string; turn: number; evidence: string }[];
    /**
     * C's fires split by what the turn edited (road-to-agent-throughput-recovery
     * 4.2): whether a docs-only exemption is worth proposing turns on how many
     * fires edited nothing but `agents/**` or `docs/**` markdown. The rows sum to
     * `unverified_fires`; a fire with no recorded path is `unknown`.
     */
    unverified_by_path_class: Record<EditPathClass, number>;
    /** Where C fired, with the class only — never the path. */
    unverified_sites: { session: string; turn: number; path_class: EditPathClass }[];
    /** The independent scanner's own per-session language total, for context. */
    scanner_language: number;
    sessions: number;
}

/**
 * The gate's own edit-tool set, duplicated here for ONE purpose: the
 * `turns_with_edit` context line. It is deliberately not re-exported from the
 * hook — nothing in the measurement depends on it, so a drift between the two
 * changes a printed denominator and never a scored rate.
 */
const _EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * The source-file shape detector F reads, restated here for the
 * CUMULATIVE-CONDITION breakdown only — never for a scored rate, which always
 * goes through `detectUntestedChange` itself. The test-path half is the shared
 * `_lib/test_path` predicate, so only this half can drift.
 *
 * Restating it is the lesser of two bad options. The alternative is exporting
 * another internal from the hook purely so a diagnostic line can be printed,
 * which widens the gate's public surface for a number that is context. If it
 * drifts from the hook's own, the breakdown stops adding to F's fire count and
 * the discrepancy is visible in the same output.
 */
const _SOURCE_EXT_RE =
    /\.(?:ts|tsx|js|jsx|mjs|cjs|vue|svelte|php|py|rb|go|rs|java|kt|swift|cs|scala|ex|exs)$/i;

export const EDIT_PATH_CLASSES = ['docs-md', 'code', 'mixed', 'unknown'] as const;
export type EditPathClass = (typeof EDIT_PATH_CLASSES)[number];

const _DOCS_MD_RE = /(?:^|\/)(?:agents|docs)\/.*\.md$/i;
const _ROOT_DOCS_MD_RE = /^(?:agents|docs)\/.*\.md$/i;

/**
 * `docs-md` when every edited path is `agents/**` or `docs/**` markdown at the
 * repository root. With the session's `root` known an absolute path is judged
 * relative to it, so `src/agents/x.md` or `node_modules/p/docs/y.md` is not
 * docs; without it the segment match is the only reading available.
 */
export function editPathClass(paths: readonly string[], root?: string): EditPathClass {
    if (paths.length === 0) return 'unknown';
    const isDocs = (p: string): boolean => {
        if (root === undefined) return _DOCS_MD_RE.test(p);
        const prefix = root.endsWith('/') ? root : `${root}/`;
        if (p.startsWith('/')) return p.startsWith(prefix) && _ROOT_DOCS_MD_RE.test(p.slice(prefix.length));
        return _ROOT_DOCS_MD_RE.test(p);
    };
    const docs = paths.filter(isDocs).length;
    if (docs === paths.length) return 'docs-md';
    return docs === 0 ? 'code' : 'mixed';
}

const _looksTestPath = isTestPath;

function _looksProductionSource(p: string): boolean {
    return _SOURCE_EXT_RE.test(p) && !_looksTestPath(p);
}

function sessionFiles(store: string, limit: number): string[] {
    let entries: string[];
    try {
        entries = fs.readdirSync(store).filter((f) => f.endsWith('.jsonl'));
    } catch {
        return [];
    }
    const withTime = entries.map((f) => {
        const p = path.join(store, f);
        let mtime = 0;
        try {
            mtime = fs.statSync(p).mtimeMs;
        } catch {
            /* unreadable — sorts last */
        }
        return { p, mtime };
    });
    withTime.sort((a, b) => b.mtime - a.mtime);
    return withTime.slice(0, limit).map((e) => e.p);
}

export function measure(store: string, limit: number): Counts {
    const c: Counts = {
        turns: 0,
        assistant_entries: 0,
        promissory_fires: 0,
        language_fires: 0,
        unverified_fires: 0,
        untested_fires: 0,
        dropped_fires: 0,
        turns_multi_text: 0,
        dropped_with_tool: 0,
        untested_c_silent: 0,
        turns_with_edit: 0,
        e1_production_source: 0,
        e2_no_test_touched: 0,
        untested_sites: [],
        dropped_sites: [],
        unverified_by_path_class: { 'docs-md': 0, code: 0, mixed: 0, unknown: 0 },
        unverified_sites: [],
        scanner_language: 0,
        sessions: 0,
    };

    for (const file of sessionFiles(store, limit)) {
        let lines: string[];
        try {
            lines = fs.readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim() !== '');
        } catch {
            continue;
        }
        c.sessions += 1;
        const sessionId = path.basename(file).slice(0, 8);

        // The independent scanner's own language total for this session,
        // reported side by side and NOT as agreement — see the header for why
        // no overlap is derivable from two totals (R2 finding 7).
        //
        // A throw is surfaced, not swallowed to zero: swallowing silently
        // reclassified a whole session's fires as scanner-disagreements.
        try {
            c.scanner_language += scanSession(sessionId, lines).violations.filter(
                (v) => v.check === 'language-pin',
            ).length;
        } catch (err) {
            process.stderr.write(
                `measure-turn-end-gate: scanSession failed for ${sessionId} — excluded from the scanner total: ${String(err)}\n`,
            );
        }

        let pinned: 'de' | 'en' | 'und' = 'und';
        // The LAST assistant text since the last genuine user prompt. This is
        // the population the gate inspects; anything else is a different
        // measurement wearing the same label (R2 finding 1).
        let pendingReply: string | null = null;
        let pendingPin: 'de' | 'en' | 'und' = 'und';
        // The turn's tool calls, rebuilt with the gate's OWN extractor and reset
        // at every genuine user prompt — the same two rules `readTranscriptTail`
        // applies. Detectors C and F read nothing else, so any divergence here
        // would move the measurement off the shipped gate's population.
        let pendingCalls: ToolCall[] = [];
        // Detector E's whole input: the turn's assistant texts in order, reset
        // on the same line the tool calls are. `readTranscriptTail` resets both
        // there for one reason — a genuine user prompt ends the turn, so an ask
        // it followed was answered rather than dropped — and splitting the two
        // resets would measure a detector nobody ships.
        //
        // ONE KNOWN DIVERGENCE, stated rather than discovered later: the gate
        // pushes `_messageText`'s result whenever a `text` block exists, so a
        // whitespace-only reply becomes an element there and is dropped here by
        // `assistantText`'s trim. It changes nothing while such a reply sits
        // mid-turn — it carries no options block either way — but a
        // whitespace-only CLOSING reply is E's `closing` in the gate and not
        // here. Keeping one extractor for `pendingReply` and this array is the
        // trade taken: the closing reply the two instruments score stays
        // identical, which is the property the rest of this script rests on.
        let pendingTexts: string[] = [];
        // The session's working directory as the transcript records it — the
        // root `editPathClass` judges an absolute edited path against.
        let sessionRoot: string | undefined;
        // Per-SESSION, because that is the only ordinal a reader can use to find
        // the turn again. `c.turns` is the corpus-wide running total, and
        // labelling it "turn" in a per-session pointer sends the reader to the
        // wrong turn of the right file — caught by reading the first fire this
        // script reported and finding it at a different ordinal.
        let sessionTurn = 0;

        const scoreTurn = (): void => {
            if (pendingReply === null) return;
            c.turns += 1;
            sessionTurn += 1;
            if (detectPromissory(pendingReply) !== null) c.promissory_fires += 1;
            if (detectLanguage(pendingReply, pendingPin) !== null) c.language_fires += 1;
            const cFired = detectUnverifiedEdit(pendingCalls) !== null;
            // Named for the detector it holds. It was `eFinding` until
            // 2026-09-11, holding F's finding in a file that also names a
            // detector E — the same mislabel that reached a commit title.
            const fFinding = detectUntestedChange(pendingReply, pendingCalls);
            if (cFired) {
                c.unverified_fires += 1;
                const cls = editPathClass(
                    pendingCalls
                        .filter((call) => _EDIT_TOOL_NAMES.has(call.name) && call.path !== undefined)
                        .map((call) => call.path as string),
                    sessionRoot,
                );
                c.unverified_by_path_class[cls] += 1;
                c.unverified_sites.push({ session: sessionId, turn: sessionTurn, path_class: cls });
            }
            if (fFinding !== null) {
                c.untested_fires += 1;
                if (!cFired) c.untested_c_silent += 1;
                c.untested_sites.push({
                    session: sessionId,
                    turn: sessionTurn,
                    evidence: fFinding.evidence,
                });
            }
            if (pendingTexts.length >= 2) c.turns_multi_text += 1;
            const eFinding = detectDroppedDecision(pendingTexts);
            if (eFinding !== null) {
                c.dropped_fires += 1;
                if (pendingCalls.length > 0) c.dropped_with_tool += 1;
                c.dropped_sites.push({
                    session: sessionId,
                    turn: sessionTurn,
                    evidence: eFinding.evidence,
                });
            }
            if (pendingCalls.some((call) => _EDIT_TOOL_NAMES.has(call.name))) {
                c.turns_with_edit += 1;
            }
            const editedPaths = pendingCalls
                .filter((call) => _EDIT_TOOL_NAMES.has(call.name) && call.path !== undefined)
                .map((call) => call.path as string);
            if (editedPaths.some(_looksProductionSource)) {
                c.e1_production_source += 1;
                if (!editedPaths.some(_looksTestPath)) c.e2_no_test_touched += 1;
            }
            pendingReply = null;
        };

        for (const raw of lines) {
            let entry: Record<string, unknown>;
            try {
                entry = JSON.parse(raw) as Record<string, unknown>;
            } catch {
                continue;
            }
            if (sessionRoot === undefined && typeof entry['cwd'] === 'string' && entry['cwd'] !== '') sessionRoot = entry['cwd'];

            const u = _userTurnText(entry);
            if (u !== null) {
                // `isSyntheticPrompt`, the SAME filter the gate uses for the
                // ordinal — not `isInjectedBody`. R2 round 2, finding 10: the
                // two filters classify differently, and any entry they disagree
                // about shifts this instrument's turn boundary away from the
                // gate's own. Population parity is the entire point of this
                // correction, so the filter has to be the same one.
                if (!isSyntheticPrompt(u)) {
                    scoreTurn(); // the previous turn ends here
                    pendingCalls = [];
                    pendingTexts = [];
                    const verdict = classify(u);
                    if (verdict.language !== 'und') pinned = verdict.language;
                }
                continue;
            }

            // Tool calls are collected BEFORE the text guard, exactly as the gate
            // does it: an assistant entry carrying only a `tool_use` block has no
            // text, so a `continue` above this line would drop precisely the
            // entries detectors C and F exist to read.
            if (entry['type'] === 'assistant' && !isSidechain(entry)) {
                const msg = entry['message'];
                if (typeof msg === 'object' && msg !== null && !Array.isArray(msg)) {
                    pendingCalls.push(
                        ...extractToolCalls((msg as Record<string, unknown>)['content']),
                    );
                }
            }

            const a = assistantText(entry);
            if (a === null || a.trim() === '') continue;
            c.assistant_entries += 1;
            // Overwrite: only the last one in the turn is the gate's input —
            // for every detector except E, which is why the append below is not
            // the same statement written twice.
            pendingReply = a;
            pendingTexts.push(a);
            pendingPin = pinned;
        }
        scoreTurn(); // the transcript's final turn
    }

    return c;
}

/**
 * The text of a user-role entry, read the way `readTranscriptTail` reads it.
 *
 * Deliberately NOT `conformance_scan.userText`, and the difference is the whole
 * point: that reader also returns null when the text CONTAINS
 * `<system-reminder>` anywhere, while the gate nulls only on a missing text
 * block and then filters with `isSyntheticPrompt`, which matches the marker at
 * the START. An ordinary Claude Code prompt carries an appended reminder block,
 * so the two disagree on the most common user entry there is — and an entry
 * this instrument skips is one where the turn never resets, merging consecutive
 * genuine turns into one. That made detector E fire on asks the user had
 * answered and deflated the turn denominator at the same time, which is the
 * exact class of divergence the header promises parity on (R2 round 3,
 * finding 1).
 */
function _userTurnText(entry: Record<string, unknown>): string | null {
    if (entry['type'] !== 'user' || isSidechain(entry)) return null;
    const text = entryText(entry);
    return text.trim() === '' ? null : text;
}

export function renderFires(c: Counts): string {
    if (c.untested_sites.length === 0) return '  detector F fired on no turn in this corpus.';
    return c.untested_sites
        .map((site) => `  ${site.session} turn ${String(site.turn)} — ${site.evidence}`)
        .join('\n');
}

/** C's fires with their edited-path class, for the 4.2 table. */
export function renderUnverifiedFires(c: Counts): string {
    if (c.unverified_sites.length === 0) return '  detector C fired on no turn in this corpus.';
    return c.unverified_sites
        .map((site) => `  ${site.session} turn ${String(site.turn)} — ${site.path_class}`)
        .join('\n');
}

/**
 * E's fires, as a separate function rather than a widened `renderFires`: the
 * two lists answer different questions and a caller printing one must not
 * silently start printing the other.
 */
export function renderDroppedFires(c: Counts): string {
    if (c.dropped_sites.length === 0) return '  detector E fired on no turn in this corpus.';
    return c.dropped_sites
        .map((site) => `  ${site.session} turn ${String(site.turn)} — ${site.evidence}`)
        .join('\n');
}

export function render(c: Counts): string {
    const pct = (n: number): string => (c.turns === 0 ? '0.0' : ((100 * n) / c.turns).toFixed(1));
    return [
        `measure-turn-end-gate · ${c.sessions} sessions · ${c.turns} turns · ${c.assistant_entries} assistant entries`,
        '',
        `  detector A (promissory)  fires on ${c.promissory_fires} turns  (${pct(c.promissory_fires)}%)`,
        `  detector B (language)    fires on ${c.language_fires} turns  (${pct(c.language_fires)}%)`,
        `  detector C (unverified)  fires on ${c.unverified_fires} turns  (${pct(c.unverified_fires)}%)`,
        ...EDIT_PATH_CLASSES.map((k) => `    by edited path: ${k.padEnd(10)}${String(c.unverified_by_path_class[k])}`),
        `  detector E (dropped)     fires on ${c.dropped_fires} turns  (${pct(c.dropped_fires)}%)`,
        `  detector F (untested)    fires on ${c.untested_fires} turns  (${pct(c.untested_fires)}%)`,
        '',
        `  Turns that edited a file at all: ${c.turns_with_edit} — C's and F's shared`,
        '  precondition, printed so a low F rate can be read as "rarely applicable"',
        '  rather than as "rarely right".',
        '',
        "  F's three conditions, cumulative — where the silence comes from:",
        `    1. edited production source          ${c.e1_production_source} turns`,
        `    2. …and touched no test file         ${c.e2_no_test_touched} turns`,
        `    3. …and claimed done  (= F fires)    ${c.untested_fires} turns`,
        '  A large drop at step 2 means the corpus writes its tests; a large drop at',
        '  step 3 means the turns that did not are also not claiming to be finished.',
        '  Only the first reading says the detector is narrow-and-right.',
        '',
        `  Turns carrying two or more assistant texts: ${c.turns_multi_text} — E's precondition,`,
        '  and the same reading `turns_with_edit` supports for C and F: a turn with one',
        '  reply cannot drop a question an earlier reply asked.',
        `    Of E's ${c.dropped_fires} fires, ${c.dropped_with_tool} sit in a turn that also made a tool call.`,
        '    That is the shape E was designed from — a stop-hook nudge or a reviewer',
        '    return producing a second assistant execution inside one user turn. A fire',
        '    outside it is the one to read first, being the one nothing predicted.',
        '',
        `  Of F's ${c.untested_fires} fires, detector C was SILENT on ${c.untested_c_silent}.`,
        '    That is the number ADR-277 rests its "two different questions deserve two',
        '    detectors" argument on, measured here over the corpus rather than over the',
        '    one unit test that asserted it. A count at or near zero refutes the record.',
        '',
        '  These are FIRE RATES, never precision. Every fire is a turn the shipped gate',
        '  would have refused; how many of those refusals were WRONG needs a human read',
        "  of the turns, and this script does not claim to have done one. ADR-277's",
        '  open limit is the false-positive rate, and an upper bound is not it.',
        '',
        '  Detector D is absent by construction: it reads `ci_last` from per-session',
        '  runtime state, which no transcript carries.',
        '',
        '  Rates are per TURN, over the last assistant text of each turn — the same',
        '  population the shipped gate inspects. The entry count is printed beside',
        '  the turn count because the first version of this script scored every',
        '  assistant ENTRY and labelled the result per-turn; the gap between the two',
        '  numbers is the size of that error.',
        '',
        `  For context only, the independent scanner's own language total: ${c.scanner_language}`,
        '    NOT an agreement figure. The two instruments read different spans (its',
        '    first prose line vs. this stripped, lead-first-scored reply) and this',
        '    script does no per-turn matching between them, so no overlap can be claimed from these',
        '    two totals — the previous version claimed one from per-session min/max',
        '    arithmetic, which reports disjoint findings of equal count as full',
        '    agreement.',
        '',
        '  No recall figure for detector A: promissory closings are not machine-',
        '  scanned anywhere in this tree, so there is no ground truth to score.',
    ].join('\n');
}

/** `n` with a unit that agrees with it. One place, so no line has to remember. */
function plural(n: number, one: string, many = `${one}s`): string {
    return `${String(n)} ${n === 1 ? one : many}`;
}

/**
 * The retry-conditioned re-refusal share, read from the shadow records rather
 * than from a transcript. `road-to-a-stop-that-holds` step 2.2; the producer is
 * step 2.1.
 *
 * ```
 * THIS IS NOT THE Q1 `turn-end-detector-demotion.md` REGISTERS BARS AGAINST,
 * AND THE REPORT SAYS SO IN ITS OWN HEADER.
 * ```
 *
 * The first version of this renderer called the number Q1 outright. An
 * independent review (2026-10-01) showed the two are different quantities that
 * disagree in direction, not one quantity with a looser denominator — see
 * `retryConditionedShare` for the worked ten-retry example. The rename and this
 * header are that finding, acted on rather than noted.
 *
 * A DIFFERENT SOURCE FROM EVERY OTHER NUMBER THIS SCRIPT PRINTS, which is why
 * it is a separate renderer rather than another line in `render`. The fire
 * rates above are replayed out of a transcript corpus; this comes out of
 * `agents/runtime/state/turn-end-gate/*.shadow.json`, written live by the gate
 * on an allow path. The two cannot be joined — a shadow record carries no
 * transcript and a transcript carries no shadow record — so printing them from
 * one `Counts` object would invite exactly the cross-instrument arithmetic R2
 * finding 7 removed from the language totals.
 *
 * NULL IS PRINTED AS `—`, NEVER AS `0.0%`. The two mean opposite things and
 * `retryConditionedShare` keeps them apart for that reason; collapsing them at
 * the render layer would undo the distinction one line before a human reads it.
 *
 * THE RESOLVED WORKSPACE IS PRINTED, because the one failure mode here is quiet:
 * `--workspace` takes any path, a worktree carries no `agents/runtime/`, and the
 * report for a wrong directory is a confident "no shadow record". A reading
 * pasted into an evidence file must carry the directory that produced it.
 */
export function renderQ1(stats: ShadowStats, today: string, workspace?: string): string {
    const lines: string[] = [
        `measure-turn-end-gate · retry-conditioned re-refusal share · ${plural(stats.files, 'shadow record')} · read ${today}`,
        '  NOT the Q1 `turn-end-detector-demotion.md` registers bars against — see',
        '  the note below the table before comparing any number here to a bar.',
    ];
    if (workspace !== undefined) {
        lines.push(`  workspace: ${path.resolve(workspace)}`);
    }
    lines.push('');
    if (stats.files === 0) {
        lines.push(
            '  No readable shadow record under this workspace. The share has no',
            '  denominator and is not reported as zero — a gate that has never been',
            '  retried is not a gate whose retries all came back clean.',
        );
        if (stats.unreadable > 0) {
            lines.push(
                '',
                `  ${plural(stats.unreadable, 'shadow file')} present but UNREADABLE, so "none" above`,
                '  means none could be parsed rather than none exists. That is a defect to',
                '  investigate, not an empty sample.',
            );
        }
        return lines.join('\n');
    }
    for (const layer of SHADOW_LAYERS) {
        const bucket = stats.byLayer.find((b) => b.layer === layer);
        if (bucket === undefined) continue;
        lines.push(
            `  layer ${layer} — ${plural(bucket.retries, 'retry', 'retries')} observed, ${plural(bucket.rows, 'shadow row')}`,
        );
        if (bucket.retries === 0) {
            lines.push('    (no retry on this layer; every share below would have no denominator)');
        }
        for (const id of DETECTOR_IDS) {
            if (DISPATCH_CENSORED_DETECTORS.has(id)) {
                lines.push(`    ${id.padEnd(17)} censored   (dispatch-suppressed retries are indistinguishable)`);
                continue;
            }
            const share = retryConditionedShare(stats, layer, id);
            // A dash denies a measurement; a count beside it reads like one. The
            // `(0 / 0)` the first version printed there was the denial and the
            // measurement on the same line.
            if (share === null) {
                lines.push(`    ${id.padEnd(17)}      —`);
                continue;
            }
            const shown = `${(100 * share).toFixed(1)}%`.padStart(6);
            lines.push(`    ${id.padEnd(17)} ${shown}   (${String(bucket.byDetector[id])} / ${String(bucket.retries)})`);
        }
        lines.push('');
    }
    lines.push(
        '  WHAT THIS IS, precisely, because the contract defines a DIFFERENT number',
        '  under a similar name. Printed here: of the retries observed on a layer,',
        "  the share a detector would have refused. The contract's Q1: of a",
        "  DETECTOR'S OWN initial refusals, the share whose retry that same detector",
        '  refuses again. Both halves of the contract definition are conditioned on',
        '  the detector; neither half here is, because `ShadowRecord` does not record',
        '  which refusal produced a retry. The two disagree in direction and neither',
        '  bounds the other, so no number above may be read against a bar in',
        "  `turn-end-detector-demotion.md` § The bars. Closing that needs the",
        '  PRODUCER to record the originating detector.',
        '',
        '  THREE DETECTORS ARE CENSORED, and the contract requires it rather than',
        '  this renderer choosing it. `runDetectors` skips promissory, completion and',
        "  untested when a dispatch is open, and the shadow record carries no dispatch",
        '  flag — so those retries would enter their denominators as observations of',
        '  silence that nobody made. The attribution clause already forbids reporting',
        '  a detector a rollup cannot separate that way.',
        '',
        '  GROUPED BY LAYER FIRST, and the grouping is load-bearing rather than',
        '  cosmetic. A `stop_hook_active` retry follows ANY stop concern\'s block, not',
        '  only this gate\'s, so a pooled share divides another concern\'s retries into',
        '  this gate\'s refusals. `retries_observed` is keyed by layer so the',
        '  denominator splits with the numerator.',
        '',
        '  TWO FURTHER BOUNDS ON EVERY NUMBER ABOVE, both properties of the instrument:',
        '    1. A retry whose transcript is absent, oversized or textless records',
        '       NOTHING — no row and no retry. Numerator and denominator shrink',
        '       together, so each share is an UPPER bound, never a point estimate.',
        '    2. On a host that sends no `session_id` every session shares one record.',
        '       The record count above is FILES; it equals sessions only where the',
        '       host sends an id.',
        '',
        '  A share above may be well-formed and still unreadable as a rate if the',
        '  record count is small. The count is printed first for that reason.',
    );
    if (stats.dropped > 0) {
        lines.push(
            '',
            `  ${plural(stats.dropped, 'row')} dropped to the per-session cap: every numerator above is a FLOOR.`,
        );
    }
    if (stats.unreadable > 0) {
        lines.push(
            '',
            `  ${plural(stats.unreadable, 'shadow file')} present but unreadable — same reading, same direction.`,
        );
    }
    if (stats.earliest !== null && stats.latest !== null) {
        lines.push('', `  Window observed: ${stats.earliest} … ${stats.latest}`);
    }
    return lines.join('\n');
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let store = '';
    let limit = 30;
    let showFires = false;
    let q1Only = false;
    let workspace = process.cwd();
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--store' && argv[i + 1] !== undefined) {
            store = argv[i + 1]!;
            i += 1;
        } else if (argv[i] === '--show-fires') {
            showFires = true;
        } else if (argv[i] === '--q1') {
            q1Only = true;
        } else if (argv[i] === '--workspace' && argv[i + 1] !== undefined) {
            workspace = argv[i + 1]!;
            i += 1;
        } else if (argv[i] === '--limit' && argv[i + 1] !== undefined) {
            // R2 finding 15: an unvalidated parseInt made `--limit abc` yield
            // NaN, `slice(0, NaN)` return nothing, and the script exit 2 with
            // "no .jsonl sessions under <store>" — a real input error reported
            // as a missing corpus.
            const parsed = Number.parseInt(argv[i + 1]!, 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
                process.stderr.write(
                    `measure-turn-end-gate: --limit must be a positive integer, got ${JSON.stringify(argv[i + 1])}\n`,
                );
                return 2;
            }
            limit = parsed;
            i += 1;
        }
    }
    const today = new Date().toISOString().slice(0, 10);
    // `--q1` needs no transcript corpus: the shadow records are the source, and
    // requiring a `--store` for them would make the one reading this roadmap
    // asks for contingent on an unrelated input. Deliberately NOT a silent
    // default of the store path — a reading over the wrong workspace is the
    // failure mode here, and it is quiet.
    if (q1Only) {
        process.stdout.write(`${renderQ1(collectShadowStats(workspace), today, workspace)}\n`);
        return 0;
    }
    if (!store) {
        process.stderr.write('measure-turn-end-gate: --store <transcript dir> is required\n');
        return 2;
    }
    const counts = measure(store, limit);
    if (counts.sessions === 0) {
        // A measurement over zero sessions that exits 0 is the repo's own
        // "gates that scan nothing" failure. Refuse instead.
        process.stderr.write(`measure-turn-end-gate: no .jsonl sessions under ${store}\n`);
        return 2;
    }
    process.stdout.write(`${render(counts)}\n`);
    // Q1 rides on the default report because step 2.2 asks that
    // `measure_turn_end_gate` PRINT it, not that it offer to. A reader who
    // never learns the flag exists still sees the number.
    process.stdout.write(`\n${renderQ1(collectShadowStats(workspace), today, workspace)}\n`);
    if (showFires) {
        process.stdout.write(`\n  detector F fired here — read these turns before\n  calling any of them a false positive:\n${renderFires(counts)}\n`);
        process.stdout.write(`\n  detector E fired here — same reading, same reason:\n${renderDroppedFires(counts)}\n`);
        process.stdout.write(`\n  detector C fired here, with the edited-path class:\n${renderUnverifiedFires(counts)}\n`);
    }
    return 0;
}

// Bundle-safety, same guard as the sibling hook. R2 finding 15: a substring
// test on argv[1] auto-runs the module when esbuild inlines it into a bundle,
// where every module shares the bundle's `import.meta.url`.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
