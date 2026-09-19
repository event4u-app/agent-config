/**
 * Release holds — parse a roadmap's `## Release holds` declarations and
 * evaluate each one against the checkboxes that open and clear it.
 *
 * Template rule 28 is the contract. The one sentence that governs every
 * decision in this file: a hold is a positive declaration about a named tree
 * state, never a side effect of open checkboxes. Roadmap *incompleteness* is
 * never a release condition, so nothing here counts open boxes.
 *
 * NO THIRD PARSER. The checkbox vocabulary comes from `check_roadmap_trackable`
 * and the fence-blanking and inline-marker grammar from `lint_roadmap_blockers`
 * — the two gates that already own those shapes. A copy would drift, and the
 * drift would be silent: a marker this file accepted and `lint_roadmap_blockers`
 * rejected would be a hold that reddens one gate and is invisible to the other.
 *
 * The load-bearing asymmetry, from rule 28's state table: `not-evaluable`
 * REFUSES. There is no path on which "could not evaluate" reads as safe, which
 * is why every parse failure in this file produces a hold in that state rather
 * than an absent hold or a thrown error.
 */

import { readFileSync } from 'node:fs';
import * as path from 'node:path';

import { CHECKBOX_RE } from '../check_roadmap_trackable.js';
import { _stripFencedCode } from '../lint_roadmap_blockers.js';
import { entryConditionParts, _frontmatter } from '../lint_roadmap_later_disposition.js';

/** Rule 28's state table. Only `unopened` and `cleared` permit a cut. */
export type HoldState = 'unopened' | 'open' | 'cleared' | 'not-evaluable';

/** Rule 28's channel vocabulary. An omitted `Channel:` parses to `all`. */
export type HoldChannel = 'all' | 'latest';

/**
 * Which cut is being checked, in rule 28's own two tokens.
 *
 * `all` (the default) is a STABLE `X.Y.Z` cut: every open hold refuses it,
 * because a `latest` hold refuses a stable cut and an `all` hold refuses
 * everything. `latest` is a `-next.N` PRERELEASE: only `all` holds refuse it,
 * because a `latest` hold permits the opt-in channel by its own definition.
 *
 * The two tokens are the hold field's tokens on purpose — one vocabulary, not
 * two — and they name the set of hold channels that refuse the cut, which is
 * the only reading under which the flag's two values give different answers.
 */
export type CutChannel = 'all' | 'latest';

export interface Hold {
    readonly id: string;
    readonly channel: HoldChannel;
    readonly openedBy: string;
    readonly clearedBy: string;
    /** The clearing step's `verify:` text — the command that proves the fix. */
    readonly clearVerify: string;
    readonly state: HoldState;
    readonly file: string;
    /** Non-empty iff `state === 'not-evaluable'`; each entry is a reason. */
    readonly malformed: readonly string[];
}

const HOLDS_SECTION_RE = /^##[ \t]+Release[ \t]+holds[ \t]*$/im;
const NEXT_H2_RE = /^##[ \t]+\S/m;
const HOLD_HEADING_RE = /^###[ \t]+hold:[ \t]*(.+?)[ \t]*$/gim;

const CHANNEL_FIELD_RE = /^-[ \t]*\*\*Channel:\*\*[ \t]*`?([A-Za-z-]+)`?/im;
const OPENED_BY_FIELD_RE = /^-[ \t]*\*\*Opened by:\*\*[ \t]*`?([^`\n<]+?)`?[ \t]*$/im;
const CLEARED_BY_FIELD_RE = /^-[ \t]*\*\*Cleared by:\*\*[ \t]*`?([^`\n<]+?)`?[ \t]*$/im;
const STATE_FIELD_RE = /^-[ \t]*\*\*State:\*\*[ \t]*\S/im;
const WHY_NOT_GUARD_RE = /^-[ \t]*\*\*Why not a guard:\*\*[ \t]*\S/im;

/**
 * An inline hold marker, and it must sit on a real checkbox line.
 *
 * Same shape as `lint_roadmap_blockers`' `BLOCKED_BY_LINE_RE`, and for the same
 * reason that file states: a marker in prose is documentation, not a binding.
 * `CHECKBOX_RE`'s own source is spliced in so the accepted mark set cannot
 * drift from the dashboard's.
 */
const CHECKBOX_PREFIX = CHECKBOX_RE.source.replace(/^\^/, '').replace(/\[ \\t\\f\\v\]$/, '');
const OPENS_MARKER_RE = new RegExp(
    `^${CHECKBOX_PREFIX}.*<!--[ \\t]*opens-hold:[ \\t]*([a-z0-9-]+)[ \\t]*-->`,
    'i',
);
const CLEARS_MARKER_RE = new RegExp(
    `^${CHECKBOX_PREFIX}.*<!--[ \\t]*clears-hold:[ \\t]*([a-z0-9-]+)[ \\t]*-->`,
    'i',
);
/** The same two markers ANYWHERE, so a marker off a checkbox is detectable. */
const LOOSE_MARKER_RE = /<!--[ \t]*(opens|clears)-hold:[ \t]*([a-z0-9-]+)[ \t]*-->/gi;

/** Rule 13 applies inside a hold entry too — no version, tag or date. */
const VERSION_IN_ENTRY_RE = /\bv?\d+\.\d+\.\d+\b|\b\d{4}-\d{2}-\d{2}\b/;

/** A `verify:` field on the clearing step (rule 23). */
const VERIFY_FIELD_RE = /^[ \t]*verify:[ \t]*\S/im;

function isChecked(mark: string): boolean {
    return mark === 'x' || mark === 'X';
}

/** The mark of the checkbox carrying `marker` for `id`, or null if absent. */
function markerMark(lines: readonly string[], re: RegExp, id: string): string | null {
    for (const line of lines) {
        const m = re.exec(line);
        if (m && m[2]?.toLowerCase() === id.toLowerCase()) {
            return m[1] ?? null;
        }
    }
    return null;
}

/**
 * The lines of the step a marker sits on, plus its continuation lines.
 *
 * A `verify:` field belongs to the step, and a step's body runs on until the
 * next checkbox or a blank-line-then-heading. Returning the span rather than
 * the single line is what lets the clearer's `verify:` be found at all.
 */
function stepSpan(lines: readonly string[], re: RegExp, id: string): string[] {
    for (let i = 0; i < lines.length; i += 1) {
        const m = re.exec(lines[i]!);
        if (!m || m[2]?.toLowerCase() !== id.toLowerCase()) {
            continue;
        }
        const span = [lines[i]!];
        for (let j = i + 1; j < lines.length; j += 1) {
            const next = lines[j]!;
            if (CHECKBOX_RE.test(next) || /^#{1,6}[ \t]/.test(next)) {
                break;
            }
            span.push(next);
        }
        return span;
    }
    return [];
}

/**
 * Parse and evaluate every hold declared in `text`.
 *
 * A file with no `## Release holds` section yields `[]` — the normal shape, and
 * deliberately not an error: rule 28's default is that there is no hold.
 */
export function evaluateHolds(text: string, file: string): Hold[] {
    const stripped = _stripFencedCode(text);
    const sectionMatch = HOLDS_SECTION_RE.exec(stripped);
    const lines = stripped.split('\n');

    // A marker with no section is a binding pointing at nothing. It cannot be
    // ignored (that would fail open) and it has no entry to report against, so
    // it becomes a not-evaluable hold under the id the marker names.
    if (!sectionMatch) {
        const orphans = new Map<string, string>();
        LOOSE_MARKER_RE.lastIndex = 0;
        let lm: RegExpExecArray | null;
        while ((lm = LOOSE_MARKER_RE.exec(stripped)) !== null) {
            orphans.set(lm[2]!.toLowerCase(), lm[1]!.toLowerCase());
        }
        return [...orphans.keys()].sort().map((id) => ({
            id,
            channel: 'all' as const,
            openedBy: '',
            clearedBy: '',
            clearVerify: '',
            state: 'not-evaluable' as const,
            file,
            malformed: [`marker \`${id}\` has no \`## Release holds\` entry`],
        }));
    }

    const rest = stripped.slice(sectionMatch.index + sectionMatch[0].length);
    const h2 = NEXT_H2_RE.exec(rest);
    const section = h2 ? rest.slice(0, h2.index) : rest;

    const entries: { id: string; body: string }[] = [];
    HOLD_HEADING_RE.lastIndex = 0;
    let hm: RegExpExecArray | null;
    const starts: { id: string; at: number; end: number }[] = [];
    while ((hm = HOLD_HEADING_RE.exec(section)) !== null) {
        starts.push({ id: hm[1]!.trim(), at: hm.index, end: HOLD_HEADING_RE.lastIndex });
    }
    for (let i = 0; i < starts.length; i += 1) {
        const next = starts[i + 1]?.at ?? section.length;
        entries.push({ id: starts[i]!.id, body: section.slice(starts[i]!.end, next) });
    }

    const seen = new Map<string, number>();
    for (const e of entries) {
        const k = e.id.toLowerCase();
        seen.set(k, (seen.get(k) ?? 0) + 1);
    }

    return entries.map(({ id, body }) => {
        const malformed: string[] = [];

        if ((seen.get(id.toLowerCase()) ?? 0) > 1) {
            malformed.push(`duplicate hold id \`${id}\``);
        }
        if (!/^[a-z0-9-]+$/.test(id)) {
            malformed.push(`hold id \`${id}\` is not kebab-case`);
        }

        const chanRaw = CHANNEL_FIELD_RE.exec(body)?.[1]?.toLowerCase();
        let channel: HoldChannel = 'all';
        if (chanRaw === undefined) {
            channel = 'all';
        } else if (chanRaw === 'all' || chanRaw === 'latest') {
            channel = chanRaw;
        } else {
            malformed.push(`\`Channel: ${chanRaw}\` is not \`all\` or \`latest\``);
        }

        const openedBy = OPENED_BY_FIELD_RE.exec(body)?.[1]?.trim() ?? '';
        const clearedBy = CLEARED_BY_FIELD_RE.exec(body)?.[1]?.trim() ?? '';
        if (!openedBy) {
            malformed.push('missing `Opened by:`');
        }
        if (!clearedBy) {
            malformed.push('missing `Cleared by:`');
        }
        if (!STATE_FIELD_RE.test(body)) {
            malformed.push('missing `State:`');
        }
        // Rule 28 makes this one mandatory by name: it is the field that keeps
        // a hold the last rung rather than the first tool.
        if (!WHY_NOT_GUARD_RE.test(body)) {
            malformed.push('missing `Why not a guard:` (rule 28 makes it mandatory)');
        }
        if (VERSION_IN_ENTRY_RE.test(body)) {
            malformed.push('hold entry names a version, tag or date (rule 13)');
        }

        const openMark = markerMark(lines, OPENS_MARKER_RE, id);
        const clearMark = markerMark(lines, CLEARS_MARKER_RE, id);
        const clearSpan = stepSpan(lines, CLEARS_MARKER_RE, id).join('\n');
        const clearVerify = (/^[ \t]*verify:[ \t]*(\S.*)$/im.exec(clearSpan)?.[1] ?? '').trim();
        if (openMark === null) {
            malformed.push(`no checkbox carries \`opens-hold: ${id}\``);
        }
        if (clearMark === null) {
            malformed.push(`no checkbox carries \`clears-hold: ${id}\``);
        }
        if (clearMark !== null && !VERIFY_FIELD_RE.test(clearSpan)) {
            malformed.push(`the \`clears-hold: ${id}\` step carries no \`verify:\` field`);
        }

        if (malformed.length > 0) {
            return {
                id,
                channel,
                openedBy,
                clearedBy,
                clearVerify,
                state: 'not-evaluable' as const,
                file,
                malformed,
            };
        }

        const state: HoldState = !isChecked(openMark!)
            ? 'unopened'
            : isChecked(clearMark!)
              ? 'cleared'
              : 'open';

        return { id, channel, openedBy, clearedBy, clearVerify, state, file, malformed: [] };
    });
}

/**
 * Read and evaluate one file. An unreadable file is `not-evaluable`, never
 * absent — rule 28's state table has no row on which a read failure permits.
 */
export function evaluateFile(path: string): Hold[] {
    let text: string;
    try {
        text = readFileSync(path, 'utf8');
    } catch (exc) {
        return [
            {
                id: '<unreadable>',
                channel: 'all',
                openedBy: '',
                clearedBy: '',
                clearVerify: '',
                state: 'not-evaluable',
                file: path,
                malformed: [`file could not be read: ${(exc as Error).message}`],
            },
        ];
    }
    try {
        return evaluateHolds(text, path);
    } catch (exc) {
        return [
            {
                id: '<evaluator-error>',
                channel: 'all',
                openedBy: '',
                clearedBy: '',
                clearVerify: '',
                state: 'not-evaluable',
                file: path,
                malformed: [`evaluator errored: ${(exc as Error).message}`],
            },
        ];
    }
}

/** Does `hold` refuse a cut on `cut`? See `CutChannel` for the two tokens. */
export function refuses(hold: Hold, cut: CutChannel): boolean {
    if (hold.state === 'not-evaluable') {
        return true;
    }
    if (hold.state !== 'open') {
        return false;
    }
    return cut === 'all' ? true : hold.channel === 'all';
}

/* ------------------------------------------------------------------ *
 * Lifecycle — rule 28's per-folder half.
 *
 * "A window does not disappear by moving the file." The three folders answer
 * differently and the difference is the whole point:
 *
 *   archive/, skipped/  the move is REFUSED while a window is open. Both mean
 *                       "no further work", and an open window is unfinished
 *                       work by definition, so the move would retire a refusal
 *                       nobody would ever clear.
 *   later/              the move is PERMITTED — the work resumes — but the open
 *                       window must be named in `entry_condition.what`, so the
 *                       thing that has to come back is written where the wake
 *                       contract can be read. It still lists and still refuses.
 *
 * Deletion is NOT handled here and cannot be: a gate sees files, and a deleted
 * file is not one. Rule 12 forbids the delete; this is a recorded residual.
 * ------------------------------------------------------------------ */

/** The folders a move is refused into while a window is open. */
export const REFUSING_DIRS = ['archive', 'skipped'] as const;

export interface LifecycleViolation {
    readonly file: string;
    readonly holdId: string;
    readonly reason: string;
}

/** The `agents/roadmaps/` subfolder of `file`, or `''` for the active root. */
export function holdFolder(file: string): string {
    const m = /agents\/roadmaps\/([^/]+)\//.exec(file.split(path.sep).join('/'));
    return m ? m[1]! : '';
}

/**
 * Lifecycle violations for one already-evaluated file.
 *
 * Takes the holds rather than re-reading, so the caller's evaluation is the one
 * reported on — a second read could disagree with the first and the disagreement
 * would be invisible.
 */
export function lifecycleViolations(
    file: string,
    holds: readonly Hold[],
    text: string,
): LifecycleViolation[] {
    const out: LifecycleViolation[] = [];
    const folder = holdFolder(file);
    // `not-evaluable` is deliberately included: a declaration nobody can read
    // is not a declaration anybody can clear, so retiring it is the same defect.
    const live = holds.filter((h) => h.state === 'open' || h.state === 'not-evaluable');
    if (live.length === 0) {
        return out;
    }

    if ((REFUSING_DIRS as readonly string[]).includes(folder)) {
        for (const h of live) {
            out.push({
                file,
                holdId: h.id,
                reason:
                    `refused: a roadmap with a ${h.state} window may not live in \`${folder}/\` ` +
                    `— finish the clearing step \`${h.clearedBy || '?'}\` first, or move it to \`later/\``,
            });
        }
        return out;
    }

    if (folder === 'later') {
        const what = entryConditionParts(_frontmatter(text)).parts['what'] ?? '';
        for (const h of live) {
            if (!what.toLowerCase().includes(h.id.toLowerCase())) {
                out.push({
                    file,
                    holdId: h.id,
                    reason:
                        `a \`later/\` roadmap with an ${h.state} window must name the hold id in ` +
                        `\`entry_condition.what\` — it is absent there`,
                });
            }
        }
    }
    return out;
}

/**
 * The refusal message, or `null` when the cut is permitted.
 *
 * One formatter, used by BOTH `check_release_holds --require-safe` and
 * `release.ts`'s pre-flight, because two copies would drift and the drift would
 * land where it hurts most: an operator reading one message at the CLI and a
 * different one at the cut.
 *
 * Five fields per hold — roadmap, hold, opener, closer, and the closer's
 * `verify:` command — because a refusal that does not say what to run to clear
 * it has told the operator they are stuck rather than what to do.
 */
export function refusalReport(holds: readonly Hold[], cut: CutChannel): string | null {
    const blocking = holds.filter((h) => refuses(h, cut));
    if (blocking.length === 0) {
        return null;
    }
    const lines: string[] = [
        `release-holds: REFUSED — ${blocking.length} hold(s) block this cut (channel ${cut})`,
    ];
    for (const h of blocking) {
        lines.push('');
        lines.push(`  hold: ${h.id}   [${h.state}, channel ${h.channel}]`);
        lines.push(`  roadmap:    ${h.file}`);
        if (h.state === 'not-evaluable') {
            for (const why of h.malformed) {
                lines.push(`  not evaluable: ${why}`);
            }
            continue;
        }
        lines.push(`  opened by:  ${h.openedBy}`);
        lines.push(`  cleared by: ${h.clearedBy}`);
        lines.push(`  its verify: ${h.clearVerify || '(none recorded)'}`);
    }
    lines.push(
        '',
        '  Three ways forward, and the choice is yours — there is no override flag:',
        '    1. finish the clearing step (run its `verify:` above, then flip it)',
        '    2. cut `-next.N` instead, if every blocking hold is `Channel: latest`',
        '    3. use a release line — docs/contracts/release-trunk-sync.md',
    );
    return lines.join('\n');
}
