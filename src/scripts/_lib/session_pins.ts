/**
 * Session pins — constraints the user set in a session, restored verbatim after
 * a compaction (road-to-state-and-pins-across-compaction Phase 2).
 *
 * A pin is a line starting with `pin:` at column zero in the human-authored
 * part of a `user_prompt_submit` text; `unpin:` removes one. No model decides
 * what is a pin (decision L1). Tool output and file content never reach that
 * event. What the event does carry besides the user's words — host-injected
 * regions, pastes, subagent messages — is excluded by recognising its framing:
 * fenced code, pasted blocks, own-line host regions, and everything from the
 * first line that contains anything tag-like or reads as a pasted document.
 * That is an inference from framing, not authentication: the guarantee is that
 * text in a recognised host framing can neither add nor delete a pin.
 *
 * Bounded at {@link MAX_PINS} × {@link MAX_PIN_CHARS}. A pin over either limit
 * is refused and the user is told which one; nothing is truncated.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
    has_stable_session_id,
    is_replay_mode,
    owns_session_state,
    prune_stale_session_states,
    session_state_file,
    update_text_under_lock,
} from '../hooks/state_io.js';
import { humanAuthoredLead, isSyntheticPrompt } from './prompt_shape.js';
import { admitStamp, presentButUnread, readRestoreRecord, SEEN_MAX } from './session_pins_record.js';

export const MAX_PINS = 12;
export const MAX_PIN_CHARS = 300;
/**
 * Bytes the held pins may occupy together, counted as JSON-escaped UTF-8. 12 pins of 300
 * plain ASCII characters fit (3,600 B), so the 12 x 300 promise holds as stated for
 * text that needs no escaping; quotes and backslashes count two bytes each and
 * non-ASCII characters two to four, so a set heavy in either reaches this first
 * and the user is told. Without it
 * the restore line could reach ~14 KB, over the host's 10,000-character
 * `additionalContext` line and over the subagent carrier's 9,728-byte reply.
 */
export const MAX_PINS_BYTES = 4096;
export const STATE_DIR = path.join('agents', 'state', 'session-pins');
export const KILL_SWITCH = 'AGENT_CONFIG_NO_SESSION_PINS';

export type Directive = { readonly kind: 'pin'; readonly text: string } | { readonly kind: 'unpin'; readonly text: string };

export interface PinState {
    readonly session_id: string;
    readonly pins: readonly string[];
    readonly updated_at: string;
}

export interface ApplyResult {
    readonly pins: readonly string[];
    readonly added: readonly string[];
    readonly removed: readonly string[];
    readonly duplicate: readonly string[];
    readonly tooLong: readonly string[];
    readonly overCap: readonly string[];
    readonly overBytes: readonly string[];
    readonly notFound: readonly string[];
}

// `[\s\S]*`, not `.*`: `.` stops at \r, U+2028 and U+2029, which would drop the
// rest of the line without a refusal. `normalise` turns them into spaces.
const PIN_LINE = /^pin:[ \t]*([\s\S]*)$/i;
const UNPIN_LINE = /^unpin:[ \t]*([\s\S]*)$/i;
/**
 * Markup inside a directive's own text that only a host envelope produces: a
 * closing tag, or an opener carrying attributes. `Array<string>` is neither.
 * Such a line is not applied — typed and injected text cannot be told apart on
 * it — and is counted, so the turn says so.
 */
function inlineEnvelope(line: string): boolean {
    if (/<\/[A-Za-z]/.test(line)) return true;
    // `<name`, whitespace, then `=` before the next `>`: read from where the next
    // `=` and `>` stand (one right-to-left pass), so a line of unclosed openers
    // stays linear instead of rescanning its tail once per opener.
    const nextEq: number[] = new Array<number>(line.length + 1);
    const nextGt: number[] = new Array<number>(line.length + 1);
    nextEq[line.length] = Infinity;
    nextGt[line.length] = Infinity;
    for (let i = line.length - 1; i >= 0; i--) {
        nextEq[i] = line[i] === '=' ? i : (nextEq[i + 1] as number);
        nextGt[i] = line[i] === '>' ? i : (nextGt[i + 1] as number);
    }
    for (const m of line.matchAll(/<[A-Za-z][\w:-]*(?=\s)/g)) {
        const after = (m.index ?? 0) + m[0].length;
        if ((nextEq[after] as number) < (nextGt[after] as number)) return true;
    }
    return false;
}
/**
 * An opener (`<system-reminder>`, `<agent-message >`, or `<agent-message` whose
 * attributes start on the next line) on a directive line whose closer stands
 * on a later line is an envelope too: the host began a region mid-line. Read
 * from where each closer name last occurs, one pass over the prompt, so the
 * check stays linear; a bare opener nothing closes later (`<b>`) stays text.
 */
const BARE_OPENER = /<([A-Za-z][\w:-]*)(?=[\s>]|$)/g;
const CLOSER = /<\/([A-Za-z][\w:-]*)/g;

function lastCloserAt(prompt: string): Map<string, number> {
    const last = new Map<string, number>();
    for (const m of prompt.matchAll(CLOSER)) last.set((m[1] ?? '').toLowerCase(), m.index ?? 0);
    return last;
}

/** Lines (by index) whose directive text carries host framing; `lines` are the prompt's own. */
function envelopedLines(prompt: string, lines: readonly string[]): boolean[] {
    if (!lines.some(isDirectiveLine)) return lines.map(() => false);
    const closers = lastCloserAt(prompt);
    let offset = 0;
    return lines.map((line) => {
        const end = offset + line.length;
        offset = end + 1;
        if (!isDirectiveLine(line)) return false;
        if (inlineEnvelope(line)) return true;
        for (const m of line.matchAll(BARE_OPENER)) {
            if ((closers.get((m[1] ?? '').toLowerCase()) ?? -1) > end) return true;
        }
        return false;
    });
}
const PASTE_NAME = /^<(\/?)pasted_content(?=[\s>\/])/i;
// A line that is `<name`, anything, and a final `>`: no attribute grammar to
// get wrong, so a quoted `>` inside an attribute cannot hide an opener.
const REGION_LINE = /^\s*<(\/?)([A-Za-z][\w-]*)(?:\s.*)?>\s*$/;

/**
 * Pins are inert under the kill switch and during a replay: a replayed event
 * reads no pin state into any carrier — prompt, restore or subagent — and
 * writes none.
 */
export function pinsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return is_replay_mode() || (env[KILL_SWITCH] ?? '').trim() === '1';
}

/**
 * Character spans of pasted blocks in the original text, tags paired by depth.
 * An opener that never closes runs to the end; a closer with no opener covers
 * everything before it. Both are the safe reading.
 */
function pasteSpans(text: string): Array<readonly [number, number]> {
    const spans: Array<readonly [number, number]> = [];
    let depth = 0;
    let start = 0;
    let gt = -1;
    // Forward-only: each `<` is looked at once and the next `>` is found once
    // per stretch, so malformed openers with no `>` cost linear time.
    for (let lt = text.indexOf('<'); lt !== -1; lt = text.indexOf('<', lt + 1)) {
        if (gt < lt) gt = text.indexOf('>', lt);
        if (gt === -1) break;
        const m = PASTE_NAME.exec(text.slice(lt, Math.min(gt + 1, lt + 32)));
        if (m === null) continue;
        const end = gt + 1;
        if (m[1] === '/') {
            if (depth === 0) spans.push([0, end]);
            else if (--depth === 0) spans.push([start, end]);
        } else if (depth++ === 0) {
            start = lt;
        }
        lt = gt;
    }
    if (depth > 0) spans.push([start, text.length]);
    return spans;
}

/**
 * Lines inside fenced code, delimiters included, with CommonMark pairing: a
 * fence closes only on the same character, at least as long as the opener,
 * followed by nothing but spaces and tabs. An unclosed fence runs to the end.
 */
/**
 * A fence delimiter, read by a prefix scan rather than a regex: up to three
 * spaces, then a run of three or more backticks or tildes, then the rest. A
 * regex with a greedy run followed by `(.*)` backtracks quadratically when the
 * rest holds a line terminator `.` does not match; this cannot.
 */
function fenceOf(line: string): { readonly char: string; readonly len: number; readonly rest: string } | null {
    let i = 0;
    while (i < 3 && line[i] === ' ') i++;
    const char = line[i];
    if (char !== '`' && char !== '~') return null;
    let j = i;
    while (line[j] === char) j++;
    return j - i >= 3 ? { char, len: j - i, rest: line.slice(j) } : null;
}

function fencedLines(lines: readonly string[]): boolean[] {
    const out = lines.map(() => false);
    let open: { char: string; len: number } | null = null;
    lines.forEach((raw, i) => {
        const f = fenceOf(raw.replace(/\r$/, ''));
        if (open === null) {
            if (f !== null && !(f.char === '`' && f.rest.includes('`'))) {
                open = { char: f.char, len: f.len };
                out[i] = true;
            }
        } else {
            out[i] = true;
            if (f !== null && f.char === open.char && f.len >= open.len && /^[ \t]*$/.test(f.rest)) open = null;
        }
    });
    return out;
}

/**
 * Lines inside host-injected regions: a line that is nothing but an opening tag
 * (bare or with attributes, e.g. `<agent-message from="worker">`) opens one, a
 * line that is nothing but its closing tag closes it. One pass with a stack per
 * tag name, so every opener gets its own span independently — nesting and
 * overlap of different names cannot hide one another — and an opener that never
 * closes covers everything after it. Linear in the number of lines.
 */
function regionLines(lines: readonly string[]): boolean[] {
    const marks = new Array<number>(lines.length + 1).fill(0);
    const open = new Map<string, number[]>();
    lines.forEach((line, i) => {
        const m = REGION_LINE.exec(line);
        if (m === null) return;
        // An element that closes on its own line (`<b>x</b>`, `<br/>`) opens nothing.
        // Only a closer that ENDS the line counts: one inside an attribute value
        // (`note="</agent-message>"`) must not make an opener look self-contained.
        if (m[1] !== '/' && (line.trimEnd().toLowerCase().endsWith(`</${m[2]!.toLowerCase()}>`) || /\/>\s*$/.test(line))) return;
        const stack = open.get(m[2]!) ?? [];
        if (m[1] === '/') {
            const from = stack.pop();
            if (from !== undefined) {
                marks[from]! += 1;
                marks[i + 1]! -= 1;
            }
        } else {
            stack.push(i);
            open.set(m[2]!, stack);
        }
    });
    for (const stack of open.values()) {
        for (const from of stack) {
            marks[from]! += 1;
            marks[lines.length]! -= 1;
        }
    }
    let depth = 0;
    return lines.map((_, i) => (depth += marks[i]!) > 0);
}

/**
 * The span of a prompt a pin may come from. Every exclusion — fenced code,
 * pasted blocks, injected regions — is computed on the ORIGINAL text, and a
 * line is eligible only if it overlaps none of them and lies before the first
 * pasted document (`humanAuthoredLead`). Nothing is removed before anything else
 * is recognised, so no filter can delete another's delimiters and let text out,
 * whatever the order or overlap of the wrappers. Excluded lines come back empty.
 */
export function capturableText(prompt: string): string {
    if (isSyntheticPrompt(prompt)) return '';
    const lines = prompt.split('\n');
    const pastes = pasteSpans(prompt);
    const fenced = fencedLines(lines);
    const regions = regionLines(lines);
    // Characters covered by a paste, as a prefix sum: one pass, so a line's
    // overlap with any paste is a constant-time lookup.
    const cover = new Array<number>(prompt.length + 1).fill(0);
    for (const [a, b] of pastes) {
        cover[a]! += 1;
        cover[b]! -= 1;
    }
    const covered = new Array<number>(prompt.length + 1).fill(0);
    for (let k = 0, depth = 0; k < prompt.length; k++) {
        depth += cover[k]!;
        covered[k + 1] = covered[k]! + (depth > 0 ? 1 : 0);
    }
    const insidePaste = (k: number): boolean => covered[k + 1]! - covered[k]! > 0;
    let offset = 0;
    const pasted = lines.map((line) => {
        const start = offset;
        const end = start + line.length;
        offset = end + 1;
        return start === end ? start < prompt.length && insidePaste(start) : covered[end]! - covered[start]! > 0;
    });
    const masked = lines.map((line, i) => (fenced[i] || regions[i] || pasted[i] ? '' : line));
    // The lead ends at the first line that CONTAINS something tag-like — `<`
    // then a letter, `/`, `!` or `?`, at any column — and is not inside a closed
    // host region or a paste, judged on the original text (a fenced line counts
    // too), or at the first remaining line that reads as a pasted document. No
    // tag grammar has to be right: a multi-line, malformed or mid-line envelope
    // opener still contains `<name`, so nothing after it can be a pin. The cost
    // is that prose such as `Array<string>` also ends the lead; pins typed
    // before it still count.
    const tagStart = lines.findIndex((line, i) => !regions[i] && !pasted[i] && /<[A-Za-z/!?]/.test(line));
    // A directive's own text may contain `<` (`pin: keep Array<string>`): that
    // line still counts, and the lead ends after it, so anything an opener on it
    // could start is still excluded.
    const tagEnd =
        tagStart !== -1 && masked[tagStart] !== '' && isDirectiveLine(masked[tagStart]!) ? tagStart + 1 : tagStart;
    const docHead = masked.findIndex((line) => line !== '' && humanAuthoredLead(line) === '');
    // A host frame the whole-prompt check recognises (`[SYSTEM NOTIFICATION …`,
    // a usage-reset notice, an agent-message sentence) can also follow typed
    // text; the lead ends at it. Each line is checked with the next one, the
    // agent-message frame being two lines, so the pass stays linear; a line
    // already hidden (fenced, pasted, inside a region) is not a frame.
    const frameHead = lines.findIndex((line, i) => masked[i] !== '' && isSyntheticPrompt(`${line}\n${lines[i + 1] ?? ''}`));
    const ends = [tagEnd, docHead, frameHead].filter((k) => k !== -1);
    const cutoff = ends.length === 0 ? -1 : Math.min(...ends);
    return (cutoff === -1 ? masked : masked.slice(0, cutoff)).join('\n');
}

/**
 * Control characters become spaces so a pin is one plain line wherever it is
 * restored: a newline inside a pin would otherwise start a line of its own in
 * the restore block, read as a separate instruction.
 */
function normalise(text: string): string {
    // Lone surrogates become U+FFFD: they would serialise as six-byte escapes,
    // past the four bytes per character every bound here is derived from.
    return text
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
        .replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]/g, ' ')
        .trim();
}

/**
 * Bytes the pins occupy inside a JSON string — what the restore line actually
 * carries. Escaping never shrinks a string, so this also bounds the plain-text
 * restore block, which adds only its fixed wrapper and a `- ` per pin.
 */
function bytes(pins: readonly string[]): number {
    return pins.reduce((n, p) => n + Buffer.byteLength(JSON.stringify(p), 'utf8') - 2, 0);
}

function isDirectiveLine(line: string): boolean {
    const l = line.replace(/\r$/, '');
    return PIN_LINE.test(l) || UNPIN_LINE.test(l);
}

/**
 * `pin:` / `unpin:` lines at column zero that capture did NOT read because of
 * where they stand — after a code block, a paste, a tag-like line or a heading,
 * where typed and injected text cannot be told apart. Counted so the turn can
 * say so: a directive that vanishes without a word is the failure the caps'
 * refusals exist to prevent.
 */
export function ignoredDirectiveCount(prompt: string): number {
    // A prompt read as synthetic as a whole captures nothing; its directive lines
    // are still counted, so a typed line after a host prefix is not lost silently.
    if (isSyntheticPrompt(prompt)) return prompt.split('\n').filter((line) => isDirectiveLine(line)).length;
    const eligible = capturableText(prompt).split('\n');
    const lines = prompt.split('\n');
    const enveloped = envelopedLines(prompt, lines);
    return lines.filter((line, i) => isDirectiveLine(line) && (eligible[i] !== line || enveloped[i])).length;
}

/** Every `pin:` / `unpin:` line, in the order typed. Empty bodies are ignored. */
export function extractDirectives(prompt: string): Directive[] {
    const out: Directive[] = [];
    const enveloped = envelopedLines(prompt, prompt.split('\n'));
    for (const [i, raw] of capturableText(prompt).split('\n').entries()) {
        const line = raw.replace(/\r$/, '');
        if (enveloped[i] === true) continue;
        const pin = PIN_LINE.exec(line);
        if (pin !== null) {
            const text = normalise(pin[1] ?? '');
            if (text !== '') out.push({ kind: 'pin', text });
            continue;
        }
        const unpin = UNPIN_LINE.exec(line);
        if (unpin !== null) {
            const text = normalise(unpin[1] ?? '');
            if (text !== '') out.push({ kind: 'unpin', text });
        }
    }
    return out;
}

/** Apply directives to a pin list. Pure; refusals are reported, never silently dropped. */
export function applyDirectives(current: readonly string[], directives: readonly Directive[]): ApplyResult {
    const pins = [...current];
    const added: string[] = [];
    const removed: string[] = [];
    const duplicate: string[] = [];
    const tooLong: string[] = [];
    const overCap: string[] = [];
    const overBytes: string[] = [];
    const notFound: string[] = [];
    for (const d of directives) {
        if (d.kind === 'unpin') {
            if (d.text.toLowerCase() === 'all') {
                removed.push(...pins.splice(0, pins.length));
                continue;
            }
            const i = pins.indexOf(d.text);
            if (i === -1) notFound.push(d.text);
            else removed.push(...pins.splice(i, 1));
            continue;
        }
        if ([...d.text].length > MAX_PIN_CHARS) tooLong.push(d.text);
        else if (pins.includes(d.text)) duplicate.push(d.text);
        else if (pins.length >= MAX_PINS) overCap.push(d.text);
        else if (bytes([...pins, d.text]) > MAX_PINS_BYTES) overBytes.push(d.text);
        else {
            pins.push(d.text);
            added.push(d.text);
        }
    }
    return { pins, added, removed, duplicate, tooLong, overCap, overBytes, notFound };
}

/** Code points a brief notice shows of a refused pin. */
const BRIEF_PREVIEW = 20;

function preview(text: string, max = 40): string {
    const chars = [...text];
    return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}

/** Entries named per list in a notice; the rest are counted, so a long prompt cannot grow it. */
export const NOTICE_LIST_MAX = 3;

function named(items: readonly string[]): string {
    const shown = items.slice(0, NOTICE_LIST_MAX).map((t) => `"${preview(t)}"`);
    const rest = items.length - shown.length;
    return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ');
}

/** What the user and the model are told on the turn a directive arrives. Bounded by construction. */
export function captureNotice(r: ApplyResult, brief = false): string {
    const lines: string[] = [`Session pins: ${r.pins.length}/${MAX_PINS} held.`];
    // Brief when a restatement follows in the same line: it lists the held set,
    // so only what was refused still needs naming, and the line stays bounded.
    if (!brief) {
        if (r.added.length > 0) lines.push(`Pinned: ${named(r.added)}.`);
        if (r.removed.length > 0) lines.push(`Unpinned: ${named(r.removed)}.`);
        if (r.duplicate.length > 0) lines.push(`Already pinned: ${named(r.duplicate)}.`);
        if (r.notFound.length > 0) lines.push(`No such pin to remove: ${named(r.notFound)}.`);
    }
    if (brief) {
        const counts = [
            r.tooLong.length > 0 ? `${r.tooLong.length} over ${MAX_PIN_CHARS} characters` : '',
            r.overCap.length > 0 ? `${r.overCap.length} over the ${MAX_PINS}-pin cap` : '',
            r.overBytes.length > 0 ? `${r.overBytes.length} over ${MAX_PINS_BYTES} bytes together` : '',
        ].filter((c) => c !== '');
        if (counts.length > 0) {
            const refused = [...r.tooLong, ...r.overCap, ...r.overBytes];
            const shown = refused.slice(0, NOTICE_LIST_MAX).map((t) => `"${preview(t, BRIEF_PREVIEW)}"`);
            const rest = refused.length - shown.length;
            lines.push(`NOT pinned: ${counts.join(', ')} — ${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}.`);
        }
        // A removal that matched nothing is said even here: the restatement
        // may not be emitted after all (a held record), and a silent failed
        // `unpin:` would leave the user believing a constraint is gone.
        if (r.notFound.length > 0) {
            const shown = r.notFound.slice(0, NOTICE_LIST_MAX).map((t) => `"${preview(t, BRIEF_PREVIEW)}"`);
            const rest = r.notFound.length - shown.length;
            lines.push(`No such pin to remove: ${shown.join(', ')}${rest > 0 ? ` and ${rest} more` : ''}.`);
        }
    } else {
        if (r.tooLong.length > 0) {
            lines.push(`NOT pinned, over ${MAX_PIN_CHARS} characters: ${named(r.tooLong)}. Shorten and pin again.`);
        }
        if (r.overCap.length > 0) {
            lines.push(`NOT pinned, ${MAX_PINS} pins already held: ${named(r.overCap)}. Remove one with \`unpin: <text>\` first.`);
        }
        if (r.overBytes.length > 0) {
            lines.push(`NOT pinned, the held pins would exceed ${MAX_PINS_BYTES} bytes together: ${named(r.overBytes)}. Remove or shorten a pin first.`);
        }
    }
    if (r.tooLong.length + r.overCap.length + r.overBytes.length > 0) {
        lines.push('Tell the user, in their language, which pins were refused and why.');
    }
    return lines.join('\n');
}

/** The verbatim restore block, or '' when there is nothing to restore. */
export function restoreText(pins: readonly string[]): string {
    if (pins.length === 0) return '';
    return [
        '<session-pins>',
        'Constraints the user pinned earlier in this session, restored verbatim after compaction. They still apply:',
        ...pins.map((p) => `- ${p}`),
        '</session-pins>',
    ].join('\n');
}

export function statePath(consumer_root: string, session_id: string): string {
    return path.join(consumer_root, session_state_file(STATE_DIR, session_id));
}

/** What a pin file holds: nothing yet, this session's pins, or something that must not be overwritten. */
export type PinRead = { readonly state: 'absent' | 'ok'; readonly pins: string[] } | { readonly state: 'invalid'; readonly pins: [] };

/**
 * Parse a pin file's text. Absent is an empty set; a file that does not parse,
 * belongs to another session or has no pin list is `invalid` — never read as
 * empty, because the next capture would then overwrite whatever it held.
 */
export function parsePins(raw: string | null, session_id: string): PinRead {
    if (raw === null) return { state: 'absent', pins: [] };
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { state: 'invalid', pins: [] };
    }
    const list = (parsed as { pins?: unknown } | null)?.pins;
    if (!owns_session_state(parsed, session_id) || !Array.isArray(list)) return { state: 'invalid', pins: [] };
    // Lossless or nothing: a list this module would not have written — a
    // non-string, an empty or control-character entry, one over a cap — is
    // `invalid` as a whole. Filtering it instead would let the next capture
    // persist the shorter list and silently drop the entries it skipped.
    const kept: string[] = [];
    for (const p of list) {
        if (typeof p !== 'string' || p === '' || normalise(p) !== p || [...p].length > MAX_PIN_CHARS) {
            return { state: 'invalid', pins: [] };
        }
        kept.push(p);
    }
    if (kept.length > MAX_PINS || bytes(kept) > MAX_PINS_BYTES || new Set(kept).size !== kept.length) {
        return { state: 'invalid', pins: [] };
    }
    return { state: 'ok', pins: kept };
}

/** True when `file` exists (or cannot even be checked) — so a `null` read was a failure, not absence. */
function readRaw(file: string): string | null {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
    }
}

/**
 * The pins a subagent should carry: the list, or `null` when a pin file exists
 * but cannot be read whole as this session's — which the caller reports
 * rather than treating as "no pins".
 */
export function pinsForSubagent(consumer_root: string, session_id: string): string[] | null {
    if (!has_stable_session_id(session_id)) return [];
    try {
        const read = parsePins(readRaw(statePath(consumer_root, session_id)), session_id);
        return read.state === 'invalid' ? null : read.pins;
    } catch {
        return null;
    }
}


/** A direct write for callers that set the whole list — the test suite's seam. Capture never uses it. */
export function savePins(consumer_root: string, session_id: string, pins: readonly string[], now: string): void {
    const state: PinState = { session_id, pins: [...pins], updated_at: now };
    const outcome = update_text_under_lock(statePath(consumer_root, session_id), () => `${JSON.stringify(state, null, 2)}\n`, {
        strict: true,
    });
    if (outcome !== 'written') throw new Error(`session-pins: write ${outcome}`);
}

/**
 * The `user_prompt_submit` half: apply this prompt's directives and return the
 * capture notice, or null when the prompt carries none. Read, apply and write
 * run under one lock on the file, so two overlapping prompts cannot drop each
 * other's change. A file that cannot be read as this session's pins is left
 * untouched and reported — the user must not believe a pin is held that is not,
 * nor lose the ones they had to a silent overwrite.
 */
export function capture(consumer_root: string, session_id: string, prompt: string, now: string, brief = false): string | null {
    const ignored = ignoredDirectiveCount(prompt);
    const ignoredLine =
        ignored === 0
            ? ''
            : isSyntheticPrompt(prompt)
              ? `Session pins: ${ignored} pin:/unpin: line(s) in this host-generated prompt were NOT applied — only a prompt the user ` +
                'typed can set a pin. If the user meant them, tell them to type them in a message of their own.'
              : `Session pins: ${ignored} pin:/unpin: line(s) in this prompt were NOT applied — they come after a code block, a paste, ` +
                'a tag-like line or a heading, or carry markup inside them, where injected text cannot be told apart. Tell the user to ' +
                'type them on a line of their own before such content.';
    const directives = extractDirectives(prompt);
    if (directives.length === 0) return ignoredLine === '' ? null : ignoredLine;
    const notice = captureDirectives(consumer_root, session_id, directives, now, brief);
    return ignoredLine === '' ? notice : `${notice}\n${ignoredLine}`;
}

function captureDirectives(
    consumer_root: string,
    session_id: string,
    directives: readonly Directive[],
    now: string,
    brief: boolean,
): string {
    if (!has_stable_session_id(session_id)) {
        return 'Session pins: NOT stored — this host sent no session id, so a pin could not be restored. Tell the user.';
    }
    let notice: string | null = null;
    let invalid = false;
    const file = statePath(consumer_root, session_id);
    const outcome = update_text_under_lock(file, (raw) => {
        // The shared locked reader passes `null` for an unreadable file as well
        // as for an absent one; only a file that is really absent may start
        // empty, so anything else is checked here, inside the lock.
        const read = raw === null && presentButUnread(file) ? ({ state: 'invalid', pins: [] } as PinRead) : parsePins(raw, session_id);
        if (read.state === 'invalid') {
            invalid = true;
            return null;
        }
        const result = applyDirectives(read.pins, directives);
        notice = captureNotice(result, brief);
        const state: PinState = { session_id, pins: [...result.pins], updated_at: now };
        return `${JSON.stringify(state, null, 2)}\n`;
    }, { strict: true });
    if (invalid) {
        return (
            'Session pins: NOT changed — the pin file for this session is unreadable or not this session\'s, ' +
            `so it was left as it is (${STATE_DIR}). Tell the user.`
        );
    }
    if (outcome !== 'written' || notice === null) {
        return 'Session pins: NOT stored, the state write failed or the file was busy. Tell the user.';
    }
    return notice;
}

/**
 * Days a session may be inactive before its pins are removed. A pin file is
 * written only when a pin changes, so its own age says nothing about whether
 * the session is still running; the age read here is the newer of the pin file
 * and the session's `language-mirror` state, which the hook rewrites on every
 * tool call while a language is pinned. Both are keyed on the same digest of the session id. 30 days is a
 * convention, not a measurement.
 */
export const PIN_RETENTION_DAYS = 30;
const LANGUAGE_STATE_DIR = path.join('agents', 'state', 'language-mirror');

export function sessionActivityMs(consumer_root: string, pinFile: string): number {
    let own: number;
    try {
        own = fs.statSync(pinFile).mtimeMs;
    } catch {
        // Cannot tell how old it is: treat it as active rather than prune on a guess.
        return Date.now();
    }
    try {
        const peer = fs.statSync(path.join(consumer_root, LANGUAGE_STATE_DIR, path.basename(pinFile))).mtimeMs;
        return Math.max(own, peer);
    } catch {
        return own;
    }
}

/** A prune runs on a capture, at most once a day per checkout; a stamp file's mtime says when the last one ran. */
export const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function pruneStalePins(consumer_root: string, now_ms: number): number {
    const stamp = path.join(consumer_root, STATE_DIR, '.last-prune');
    try {
        if (now_ms - fs.statSync(stamp).mtimeMs < PRUNE_INTERVAL_MS) return 0;
    } catch (err) {
        // No stamp yet: prune now. Any other failure: do not prune on a guess, and say so.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            process.stderr.write(`session-pins: retention prune skipped, its stamp is unreadable (${String(err).slice(0, 120)})\n`);
            return 0;
        }
    }
    try {
        fs.mkdirSync(path.dirname(stamp), { recursive: true });
        fs.writeFileSync(stamp, '');
    } catch {
        // A stamp that cannot be written only means the next capture prunes again.
    }
    const dir = path.join(consumer_root, STATE_DIR);
    // A companion `.json` (the restore record) lives as long as its session's
    // pin file is active; on its own mtime alone it would go while the session
    // still compacts, and a forgotten stamp could reopen an old compaction.
    let removed = prune_stale_session_states(dir, now_ms, PIN_RETENTION_DAYS, (target) => {
        const own = sessionActivityMs(consumer_root, target);
        const digest = /^([0-9a-f]{32})\.(?!json$)/.exec(path.basename(target))?.[1];
        const pinFile = digest === undefined ? '' : path.join(dir, `${digest}.json`);
        return pinFile !== '' && fs.existsSync(pinFile) ? Math.max(own, sessionActivityMs(consumer_root, pinFile)) : own;
    });
    // The boundary and old lock sentinels are not `.json`, so the pass above
    // leaves them; each goes once its session's pin file is gone and it is
    // itself past retention. Lock generations are the pass above's to prune.
    const cutoff = now_ms - PIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return removed;
    }
    for (const name of names) {
        const digest = /^([0-9a-f]{32})\./.exec(name)?.[1];
        // A lock generation (`.lock.held[.<g>]`, the state_io lock these files
        // are written under) is never removed by age: the pass above keeps each
        // lock's highest one on purpose (hooks/state_io.ts). A bare `.lock` is
        // the retired sentinel of the lock before it and goes like the rest.
        if (digest === undefined || name === `${digest}.json` || /\.lock\.held(\.\d+)?$/.test(name) || fs.existsSync(path.join(dir, `${digest}.json`))) continue;
        const file = path.join(dir, name);
        try {
            if (fs.statSync(file).mtimeMs < cutoff) {
                fs.rmSync(file, { force: true });
                removed += 1;
            }
        } catch {
            // Housekeeping only.
        }
    }
    return removed;
}

/** The capture for the hook: kill switch, capture, then housekeeping. */
export function captureFor(
    consumer_root: string,
    session_id: string,
    prompt: string,
    env: NodeJS.ProcessEnv,
    brief = false,
): string | null {
    // A replayed event never changes live state, and must not claim it tried.
    if (pinsDisabled(env) || is_replay_mode()) return null;
    const notice = capture(consumer_root, session_id, prompt, new Date().toISOString(), brief);
    if (notice !== null) {
        try {
            pruneStalePins(consumer_root, Date.now());
        } catch (err) {
            // Housekeeping only; a failed prune leaves an old file, never a wrong pin.
            process.stderr.write(`session-pins: retention prune failed (${String(err).slice(0, 120)})\n`);
        }
    }
    return notice;
}

/**
 * Restore state of one session, one record, changed only under the per-file
 * lock: was the latest opened compaction's restore delivered, is one
 * restatement still owed to a prompt, and which compaction stamps have been
 * acknowledged (the most recent {@link SEEN_MAX} — the guarantees below hold
 * within that window).
 *
 * `pre_compact` writes one unique stamp to two places, each with its own
 * atomic write (the pair is not atomic, and the protocol does not need it to
 * be): `language-mirror`'s pin-lost marker, which the tool-call restore reads
 * before clearing it, and `.boundary`, which the prompt path reads. This module
 * deletes neither. An event's stamp opens a compaction only if it has never
 * been acknowledged — a set, not a single value, so a stale or older stamp
 * (a paused prompt, or `.boundary` still holding the previous stamp after its
 * write failed) can neither reopen its compaction nor displace a newer one. No
 * clock, no ordering. A second tool restore with the same stamp finds it
 * acknowledged; an unreadable or empty boundary is unknown, not open.
 */
interface RestoreState {
    readonly session_id: string;
    readonly delivered: boolean;
    readonly pending: boolean;
    readonly seen: readonly string[];
}

export { SEEN_MAX };

export function restorePath(consumer_root: string, session_id: string): string {
    return statePath(consumer_root, session_id).replace(/\.json$/, '.restore.json');
}

export function boundaryPath(consumer_root: string, session_id: string): string {
    return statePath(consumer_root, session_id).replace(/\.json$/, '.boundary');
}

type Decision = 'deliver' | 'restate' | 'none';
type Open = { readonly delivered: boolean; readonly pending: boolean };

/** The boundary's stamp, or '' when absent, empty or unreadable — shared reading with the bundle. */
function readBoundary(file: string): string {
    try {
        return admitStamp(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            process.stderr.write(`session-pins: compaction boundary unreadable (${String(err).slice(0, 120)})\n`);
        }
        return '';
    }
}

/**
 * Apply one event to the record under the lock and return what to emit. The
 * lock is tried once and never waited for: both callers run on a hook's hot
 * path (and the tool-call restore inside the session's tool-write lock), so a
 * peer holding the record makes this a failed transaction at once.
 *
 * `null` when the transaction failed (lock not had, or the record not
 * written), `none` when the record exists but
 * cannot be read, otherwise the decision and the pin
 * block read INSIDE the transaction, so what is acknowledged is the snapshot
 * that is sent. A capture committing in parallel (another file, another lock)
 * may change the pins after that read; the restore then shows the earlier
 * state and the capture's own notice shows the change.
 * An unreadable pin file is handled like any block: its failure notice is what
 * gets delivered and recorded, so it is said at most as often as the pins are.
 *
 * `stamp` names the compaction the event belongs to ('' when it names none).
 * A stamp never acknowledged opens the compaction fresh and joins the set in
 * the same write. An unparseable record, or one of another
 * session, counts as open: a duplicate is the cheaper failure than a loss.
 */
function transition(
    consumer_root: string,
    session_id: string,
    stamp: string,
    decide: (current: Open | null) => { next: Open | null; decision: Decision },
): { decision: Decision; block: string } | null {
    let decision: Decision = 'none';
    let block = '';
    let unreadable = false;
    const file = restorePath(consumer_root, session_id);
    const outcome = update_text_under_lock(file, (raw) => {
        // A record that exists but cannot be read is not an absent one: read as
        // absent, its acknowledged stamps would vanish and a settled compaction
        // would reopen. Nothing is decided or written; the caller reports it.
        if (raw === null && presentButUnread(file)) {
            unreadable = true;
            return null;
        }
        block = currentBlock(consumer_root, session_id);
        const read = readRestoreRecord(raw, session_id);
        const invalid = read === 'invalid';
        const stored: RestoreState | null = read === null || read === 'invalid' ? null : { session_id, ...read };
        const seen = stored?.seen ?? [];
        // Opening needs a compaction signal: a broken record never injects pins
        // on its own, it only stops a stamp from counting as acknowledged.
        const opens = stamp !== '' && (invalid || !seen.includes(stamp));
        const step = decide(opens ? { delivered: false, pending: false } : stored);
        decision = step.decision;
        if (step.next === null) return null;
        const acknowledged = opens && stamp !== '' ? [...seen, stamp].slice(-SEEN_MAX) : seen;
        const next: RestoreState = { session_id, ...step.next, seen: acknowledged };
        return `${JSON.stringify(next)}\n`;
    }, { strict: true, blocking: false });
    if (unreadable) {
        // Not a lock failure: the callers' one-shot unrecorded branch is for that
        // only. Nothing is emitted from a record nobody can read.
        process.stderr.write('session-pins: restore record unreadable; nothing restored or recorded from it\n');
        return { decision: 'none', block: '' };
    }
    return outcome === 'failed' ? null : { decision, block };
}

const LOCK_FAILED_NOTE = '(Restore state could not be recorded: this may repeat once.)';

/**
 * The restore for the hook (`post_tool_use` after a compaction), with the stamp
 * `language-mirror` read from the pin-lost marker it has already removed: the
 * block, '' when switched off, nothing is pinned, or this compaction was already
 * delivered (by a prompt, or by an earlier tool call with the same stamp), or
 * `RESTORE_FAILED`. An unknown stamp ('') delivers only when nothing was
 * delivered yet. Delivering also owes
 * the next prompt one restatement, in case the dispatcher drops this line.
 *
 * A record that cannot be locked or written still delivers, unrecorded and with a note:
 * the marker is gone, so this cannot repeat, and the prompt path may then
 * deliver and restate once more. That is the whole bound — at most three pin
 * lines per compaction (this one, a prompt delivery, one restatement).
 */
export function restoreFor(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv, rawStamp = ''): string {
    // A replay keeps the marker and cannot write the record, so without this the
    // unrecorded branch below would emit on every replayed call.
    if (pinsDisabled(env) || is_replay_mode() || !has_stable_session_id(session_id)) return '';
    const stamp = admitStamp(rawStamp);
    const r = transition(consumer_root, session_id, stamp, (cur) =>
        // A delivered record is never delivered again from a tool call, whatever
        // the stamp: with a known stamp the record speaks for this compaction,
        // and with an unknown one ('') the prompt path, keyed on the boundary,
        // carries it — re-delivering here would renew a restatement already paid.
        cur !== null && cur.delivered
            ? { next: null, decision: 'none' }
            : { next: { delivered: true, pending: true }, decision: 'deliver' },
    );
    if (r === null) {
        const block = currentBlock(consumer_root, session_id);
        return block === '' || block === RESTORE_FAILED ? block : `${block}\n${LOCK_FAILED_NOTE}`;
    }
    return r.decision === 'none' ? '' : r.block;
}

/** The current restore block, '' with nothing pinned, or `RESTORE_FAILED`. */
function currentBlock(consumer_root: string, session_id: string): string {
    let read: PinRead;
    try {
        read = parsePins(readRaw(statePath(consumer_root, session_id)), session_id);
    } catch {
        return RESTORE_FAILED;
    }
    return read.state === 'invalid' ? RESTORE_FAILED : restoreText(read.pins);
}

/**
 * The `user_prompt_submit` side, in one transaction: an open compaction (a
 * boundary stamp not yet acknowledged, or an undelivered record) is delivered by this prompt
 * and still owes one restatement — the record commits before the host has the
 * line, and a process that dies in between must not settle a delivery nobody
 * saw, so a duplicate is the price; a delivered one that still owes a
 * restatement is restated once. A record that cannot be locked emits nothing
 * here (stderr only), so every line this path emits is a recorded one.
 *
 * It runs AFTER this prompt's capture, so it states the set the user now holds
 * and a pin removed in this prompt is never restated.
 */
export function followUp(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv): string {
    if (pinsDisabled(env) || is_replay_mode() || !has_stable_session_id(session_id)) return '';
    const stamp = readBoundary(boundaryPath(consumer_root, session_id));
    const r = transition(consumer_root, session_id, stamp, (cur) => {
        if (cur !== null && !cur.delivered) return { next: { ...cur, delivered: true, pending: true }, decision: 'deliver' };
        if (cur !== null && cur.pending) return { next: { ...cur, pending: false }, decision: 'restate' };
        return { next: null, decision: 'none' };
    });
    // Only a committed transition emits here: an unrecorded line could repeat
    // on every prompt. The tool-call restore carries its own unrecorded line.
    if (r === null) {
        process.stderr.write('session-pins: restore record not lockable or not writable; the pins are not restated on this prompt\n');
        return '';
    }
    if (r.decision === 'none' || r.block === '') return '';
    if (r.block === RESTORE_FAILED) return RESTORE_FAILED;
    return `Restated after the last compaction, in case the restore did not arrive:\n${r.block}`;
}

export const RESTORE_FAILED =
    'Session pins: could NOT be restored after this compaction — the pin file is unreadable or not this ' +
    "session's. Tell the user, and ask them to restate the constraints they pinned.";

/**
 * The surface `language-mirror` loads from the chunk. A function because the
 * shared chunk loader accepts a function export only.
 */
export function sessionPins(): SessionPins {
    return { captureFor, restoreFor, followUp };
}
export interface SessionPins {
    readonly captureFor: typeof captureFor;
    readonly restoreFor: typeof restoreFor;
    readonly followUp: typeof followUp;
}
