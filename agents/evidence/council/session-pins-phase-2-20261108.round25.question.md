<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-11-08 for the ratification of
     branch feat/session-pins-phase-2 (round 25), committed verbatim beside the record. -->

# Ratification review — session pins in the language-mirror hook, and three budget rows

You are reviewing a change to the hook surface of a repository that ships
rules, skills and hooks for AI coding agents. Hooks run around the host's tool
calls and session events. A byte budget caps the hook bundle and the bytes each
hook may inject. Changes to the budget files need an independent review because
an agent must not ratify an increase in its own authority.

Judge the change below on one question: does it expand any authority — can the
new code block, deny, rewrite or inject anything, lower a ceiling, weaken a
gate, or reach the model's context? Answer with exactly one verdict and the
reasons:

- `ratified` — it expands authority, and the expansion is acceptable.
- `confirmed-non-expanding` — it expands no authority.
- `refused` — it expands authority in a way that should not merge, or the
  change does not let you tell.

Name anything in the change that contradicts its own description, and any
defect you find in the implementation: a way text the user did not type could
become a pin, a way a pin could be lost or truncated silently, a way one
session could read another's pins, an unbounded emission, or a failure that is
swallowed.

## What the branch says it does

A line the user types starting `pin: <text>` (column zero, outside fences,
pastes and injected regions) sets a session constraint; `unpin: <text>` /
`unpin: all` removes. `language-mirror` captures on `user_prompt_submit`,
stores per session, and after a compaction restores the stored pins once
(tool call or first prompt, whichever comes first) plus one restatement when
the tool call came first; `subagent-constraints` hands them to every subagent.
Caps 12 × 300 characters, 4,096 escaped bytes; refusals named, never
truncated. Kill switch `AGENT_CONFIG_NO_SESSION_PINS=1`. The pin module is a
lazy chunk.

Budget rows, exactly as the diff sets them: dispatch bundle 1,585,000 →
1,591,000 B (measured 1,590,367, +6,429 over origin/main); new pin chunk row
28,600 B (measured 27,750); subagent-constraints chunk 24,500 → 28,500 B
(measured 27,853); `language-mirror` injection row 2,048 → 5,888 B (worst
computed line 5,641 B), with a stated exception on the `post_tool_use` slot
row for the one restore fire per compaction.

## Rounds 1–23

Fixed earlier with mutation-checked tests; visible in the module below.

## Round 24 and what changed

1. **Opener recognition without an attribute grammar.** A region opener is a
   line that is `<name`, then anything, then a final `>` — a quoted `>` (or
   anything else) inside an attribute cannot hide it. An element that closes on
   its own line opens nothing, but only when the line *ends* with its closer,
   so `note="</agent-message>"` inside an attribute does not count. Tests: the
   reviewers' `detail="a > b"` prompt and a quoted closer, each with `pin:`
   and `unpin: all`; a pin typed after a host region with an inline element
   stays capturable.
2. **Structured restore outcome.** `restoreOutcome` returns `{ text, settled }`;
   `settled` is true only when the record was written or there was nothing to
   restore. `language-mirror` re-arms the retry boundary whenever it is false —
   a lock or write failure as well as an unreadable pin file or a missing
   module — instead of matching a message prefix. Test: the reviewers' chain
   (boundary write fails, then the tool restore cannot lock the record) — the
   next prompt restores.
3. **Forward-only paste scanner.** Each `<` is visited once and the next `>`
   is found once per stretch. Measured on 256,000 non-paste `<` with one far
   `>`: 13 ms, versus 1,662 ms when the `>` is searched again per `<`; the test
   asserts under 500 ms and goes red with the cache removed.

## The new module — `src/scripts/_lib/session_pins.ts`

~~~ts
/**
 * Session pins — constraints the user set in a session, restored verbatim after
 * a compaction (road-to-state-and-pins-across-compaction Phase 2).
 *
 * A pin is a line the user typed starting with `pin:` at column zero. Nothing
 * else creates one, and nothing else removes one: the capture reads only the
 * `user_prompt_submit` text, after dropping host-injected regions, pasted
 * blocks, fenced code and everything from the first pasted document on. Tool
 * output and file content never reach that event, so injected content can
 * neither add nor delete a pin. No model decides what is a pin (decision L1).
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

export const MAX_PINS = 12;
export const MAX_PIN_CHARS = 300;
/**
 * Bytes the held pins may occupy together, counted as JSON-escaped UTF-8. 12 ASCII pins of 300 fit
 * (3,600 B), so the 12 x 300 promise holds as stated for ASCII text; a set heavy
 * in multi-byte characters reaches this first and the user is told. Without it
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

const PIN_LINE = /^pin:[ \t]*(.*)$/i;
const UNPIN_LINE = /^unpin:[ \t]*(.*)$/i;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const PASTE_NAME = /^<(\/?)pasted_content(?=[\s>\/])/i;
// A line that is `<name`, anything, and a final `>`: no attribute grammar to
// get wrong, so a quoted `>` inside an attribute cannot hide an opener.
const REGION_LINE = /^\s*<(\/?)([A-Za-z][\w-]*)(?:\s.*)?>\s*$/;

export function pinsDisabled(env: NodeJS.ProcessEnv = process.env): boolean {
    return (env[KILL_SWITCH] ?? '').trim() === '1';
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
function fencedLines(lines: readonly string[]): boolean[] {
    const out = lines.map(() => false);
    let open: { char: string; len: number } | null = null;
    lines.forEach((raw, i) => {
        const m = FENCE_OPEN.exec(raw.replace(/\r$/, ''));
        if (open === null) {
            if (m !== null && !(m[1]!.startsWith('`') && (m[2] ?? '').includes('`'))) {
                open = { char: m[1]![0]!, len: m[1]!.length };
                out[i] = true;
            }
        } else {
            out[i] = true;
            if (m !== null && m[1]![0] === open.char && m[1]!.length >= open.len && /^[ \t]*$/.test(m[2] ?? '')) open = null;
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
    const masked = lines.map((line, i) => {
        const start = offset;
        const end = start + line.length;
        offset = end + 1;
        const pasted = start === end ? start < prompt.length && insidePaste(start) : covered[end]! - covered[start]! > 0;
        return fenced[i] || regions[i] || pasted ? '' : line;
    });
    // The lead ends at the first remaining line that reads as a pasted document.
    const cutoff = masked.findIndex((line) => line !== '' && humanAuthoredLead(line) === '');
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
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
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

/** Every `pin:` / `unpin:` line, in the order typed. Empty bodies are ignored. */
export function extractDirectives(prompt: string): Directive[] {
    const out: Directive[] = [];
    for (const raw of capturableText(prompt).split('\n')) {
        const line = raw.replace(/\r$/, '');
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
function presentButUnread(file: string): boolean {
    try {
        fs.lstatSync(file);
        return true;
    } catch (err) {
        return (err as NodeJS.ErrnoException).code !== 'ENOENT';
    }
}

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
    const directives = extractDirectives(prompt);
    if (directives.length === 0) return null;
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
    const own = fs.statSync(pinFile).mtimeMs;
    try {
        const peer = fs.statSync(path.join(consumer_root, LANGUAGE_STATE_DIR, path.basename(pinFile))).mtimeMs;
        return Math.max(own, peer);
    } catch {
        return own;
    }
}

/** A prune runs at most once a day per checkout; a stamp file's mtime says when the last one ran. */
export const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function pruneStalePins(consumer_root: string, now_ms: number): number {
    const stamp = path.join(consumer_root, STATE_DIR, '.last-prune');
    try {
        if (now_ms - fs.statSync(stamp).mtimeMs < PRUNE_INTERVAL_MS) return 0;
    } catch (err) {
        // No stamp yet: prune now. Any other failure: do not prune on a guess.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return 0;
    }
    try {
        fs.mkdirSync(path.dirname(stamp), { recursive: true });
        fs.writeFileSync(stamp, '');
    } catch {
        // A stamp that cannot be written only means the next capture prunes again.
    }
    return prune_stale_session_states(path.join(consumer_root, STATE_DIR), now_ms, PIN_RETENTION_DAYS, (target) =>
        sessionActivityMs(consumer_root, target),
    );
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

/**
 * Acknowledged stamps kept. The guarantee is narrowed to this window: a stamp
 * older than the session's last 512 acknowledged compactions is forgotten and
 * could reopen once. A stamp is about 45 bytes, so the record stays under
 * 25 KB; a paused event outliving 512 compactions is not a realistic case.
 */
export const SEEN_MAX = 512;

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
        return fs.readFileSync(file, 'utf8').trim();
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            process.stderr.write(`session-pins: compaction boundary unreadable (${String(err).slice(0, 120)})\n`);
        }
        return '';
    }
}

/**
 * Apply one event to the record under the lock and return what to emit:
 * `null` when the lock could not be had, otherwise the decision and the pin
 * block read INSIDE the transaction, so what is acknowledged is what is sent.
 * An unreadable pin file decides nothing and writes nothing.
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
    const outcome = update_text_under_lock(restorePath(consumer_root, session_id), (raw) => {
        block = currentBlock(consumer_root, session_id);
        if (block === RESTORE_FAILED) return null;
        let stored: RestoreState | null = null;
        // An unreadable record reads as `null` here: no stamp is then acknowledged, so it opens anyway.
        let invalid = false;
        if (raw !== null) {
            try {
                const parsed = JSON.parse(raw) as Partial<RestoreState>;
                if (owns_session_state(parsed, session_id) && typeof parsed.delivered === 'boolean') {
                    stored = {
                        session_id,
                        delivered: parsed.delivered,
                        pending: parsed.pending === true,
                        seen: Array.isArray(parsed.seen) ? parsed.seen.filter((x): x is string => typeof x === 'string') : [],
                    };
                } else {
                    invalid = true;
                }
            } catch {
                invalid = true;
            }
        }
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
    }, { strict: true });
    if (block === RESTORE_FAILED) return { decision: 'none', block };
    return outcome === 'failed' ? null : { decision, block };
}

const LOCK_FAILED_NOTE = '(Restore state unlocked: this may repeat.)';

/**
 * The restore for the hook (`post_tool_use` after a compaction), with the stamp
 * `language-mirror` read from its pin-lost marker: the block, '' when switched
 * off, nothing is pinned, or this compaction was already delivered (by a prompt,
 * or by an earlier tool call with the same stamp), or `RESTORE_FAILED`
 * (nothing settled, so a later prompt retries). An unknown stamp ('') counts as
 * open. Delivering also owes the next prompt one restatement, in case the
 * dispatcher drops this line under the per-turn budget.
 */
export function restoreFor(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv, stamp = ''): string {
    return restoreOutcome(consumer_root, session_id, env, stamp).text;
}

/**
 * The same restore as a structured result. `settled` is true only when the
 * record was written (or there was nothing to restore): the caller must keep a
 * retry armed otherwise, because the pin-lost marker is already cleared and the
 * line it emits may still be dropped.
 */
export function restoreOutcome(
    consumer_root: string,
    session_id: string,
    env: NodeJS.ProcessEnv,
    stamp = '',
): { readonly text: string; readonly settled: boolean } {
    if (pinsDisabled(env) || !has_stable_session_id(session_id)) return { text: '', settled: true };
    const r = transition(consumer_root, session_id, stamp, (cur) =>
        cur !== null && cur.delivered && stamp !== ''
            ? { next: null, decision: 'none' }
            : { next: { delivered: true, pending: true }, decision: 'deliver' },
    );
    if (r === null) {
        const block = currentBlock(consumer_root, session_id);
        if (block === '') return { text: '', settled: true };
        return { text: block === RESTORE_FAILED ? block : `${block}\n${LOCK_FAILED_NOTE}`, settled: false };
    }
    if (r.block === RESTORE_FAILED) return { text: RESTORE_FAILED, settled: false };
    return { text: r.decision === 'none' ? '' : r.block, settled: true };
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
 * boundary stamp not yet acknowledged, or an undelivered record) is delivered by this prompt,
 * owing nothing more; a delivered one that still owes a restatement is restated
 * once. The hook calls this only when a boundary exists or the record owes
 * something, so a lock failure here restates with a note rather than staying
 * silent.
 *
 * It runs AFTER this prompt's capture, so it states the set the user now holds
 * and a pin removed in this prompt is never restated.
 */
export function followUp(consumer_root: string, session_id: string, env: NodeJS.ProcessEnv): string {
    if (pinsDisabled(env) || !has_stable_session_id(session_id)) return '';
    const r = transition(consumer_root, session_id, readBoundary(boundaryPath(consumer_root, session_id)), (cur) => {
        if (cur !== null && !cur.delivered) return { next: { ...cur, delivered: true, pending: false }, decision: 'deliver' };
        if (cur !== null && cur.pending) return { next: { ...cur, pending: false }, decision: 'restate' };
        return { next: null, decision: 'none' };
    });
    // The hook calls this only when something is owed, so a lock failure
    // restates with a note rather than staying silent.
    const block = r === null ? currentBlock(consumer_root, session_id) : r.block;
    if (block === RESTORE_FAILED) return block;
    if ((r !== null && r.decision === 'none') || block === '') return '';
    const text = `Restated after the last compaction, in case the restore did not arrive:\n${block}`;
    return r === null ? `${text}\n${LOCK_FAILED_NOTE}` : text;
}

export const RESTORE_FAILED =
    'Session pins: could NOT be restored after this compaction — the pin file is unreadable or not this ' +
    "session's. Tell the user, and ask them to restate the constraints they pinned.";

/**
 * The surface `language-mirror` loads from the chunk. A function because the
 * shared chunk loader accepts a function export only.
 */
export function sessionPins(): SessionPins {
    return { captureFor, restoreFor, restoreOutcome, followUp };
}
export interface SessionPins {
    readonly restoreOutcome: typeof restoreOutcome;
    readonly captureFor: typeof captureFor;
    readonly restoreFor: typeof restoreFor;
    readonly followUp: typeof followUp;
}
~~~

## The new loader — `src/scripts/hooks/session_pins_loader.ts`

~~~ts
/**
 * Loads session pins (`_lib/session_pins.ts`) for `language-mirror` — the
 * conditional-chunk pattern of `svg_rules_loader.ts`, whose header carries the
 * reasons. The capture and the restore run on a `pin:` prompt and after a
 * compaction only, so the dispatch bundle every event loads carries this loader
 * and not the module. Null instead of a throw: a missing chunk costs the pins,
 * which the caller reports, and never the dispatch.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SessionPins } from '../_lib/session_pins.js';
import { isBundled, loadChunkExport } from './svg_rules_loader.js';

export const SESSION_PINS_CHUNK = 'session_pins.chunk.cjs';

export function sessionPinsSpecifier(selfUrl: string, bundled: boolean): string {
    const self = fileURLToPath(selfUrl);
    const dir = path.dirname(self);
    if (bundled) return path.join(dir, SESSION_PINS_CHUNK);
    return path.join(dir, '..', '_lib', `session_pins${self.endsWith('.ts') ? '.ts' : '.js'}`);
}

export function loadSessionPins(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): SessionPins | null {
    let specifier: string;
    try {
        specifier = sessionPinsSpecifier(selfUrl, bundled);
    } catch {
        return null;
    }
    const api = loadChunkExport<() => SessionPins>(selfUrl, specifier, 'sessionPins', bundled);
    try {
        return api === null ? null : api();
    } catch {
        return null;
    }
}
~~~

## The complete diff of the existing files (one line of context)

~~~diff
diff --git a/src/config/hook-bundle-budget.json b/src/config/hook-bundle-budget.json
index 7bc9321439..16668b4997 100644
--- a/src/config/hook-bundle-budget.json
+++ b/src/config/hook-bundle-budget.json
@@ -6,3 +6,3 @@
     "review_by": "2027-10-01",
-    "max_bytes": 1585000,
+    "max_bytes": 1591000,
     "max_bytes_derivation": "Measured 1,514,715 bytes on origin/main at 213d87055 (the gate's own reading, APFS-cloned node_modules so no worktree path artefacts). The ceiling is that reading plus ~2.3 % of headroom, rounded to 1,550,000, on the same doctrine as the 2026-10-01 registration: a bundle is rebuilt from source on every run, so an esbuild minor that renames symbols moves the figure by hundreds of bytes with no change to this tree, and a ceiling one byte above the reading would red on that. Composition is healthy at this reading and was checked rather than assumed: one YAML package (258,833 bytes) and 1,238,525 bytes of own source, so the growth is own code, not a re-entered dependency. The 1,564,211-byte pre-swap regression this roadmap closed still cannot reappear under it. RAISED to 1,550,500 on 2026-10-23 for the InstructionsLoaded binding (237 bytes against 51 of headroom); the reasoning and the measured alternative are the `raise_log` entry whose `to` is 1,550,500, so this paragraph describes the 1,550,000 registration and the raise is recorded there rather than restated.",
@@ -232,2 +232,21 @@
             "what_would_have_caught_it": "Nothing earlier: the growth is the contract stub builder the installed layer and the promotion share."
+        },
+        {
+            "date": "2026-11-08",
+            "from": 1585000,
+            "to": 1591000,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.1-2.2)",
+            "what_was_added": "Session pins in `language-mirror`: the `pin:` prompt test, the kill-switch check before any load, the pin-file existence check that turns a missing chunk after a compaction into a reported failure, the per-prompt mtime touch that keeps an active session's pins out of retention, the read of the restore record and the boundary stamp that turns the prompt path on only for an open compaction or an owed restatement, every pin step gated on the kill switch, the activity touch on tool calls, diagnostics for unreadable boundaries and stamps, a loader guard, the retry re-arm after any restore that did not settle (a structured outcome, not a message prefix), an existence check that treats only `ENOENT` as no pins, one unique stamp per compaction written to the pin-lost marker and the compaction boundary, the stamp read back for the tool-call restore, the call into the pin chunk on capture and after a compaction, the combined language-plus-pins restore in `_reEmitAfterCompaction`, and `hooks/session_pins_loader.ts` (+6,429 B: 1,583,938 B on origin/main to 1,590,367 B, both measured with `build:hooks` on APFS-cloned node_modules).",
+            "why_it_could_not_be_avoided": "Room was made first: the pin module itself (capture, caps, state, restore text) ships as its own chunk, which took the first measurement from +7,211 B to +6,429 B. What stays in the bundle is the part that must run on every prompt and every post-compaction tool call of the eager `language-mirror` concern: the directive test, the loader and the restore branch. Roadmap 2.2 requires the language-mirror marker path, so a lazy concern of its own was not an option.",
+            "what_would_have_caught_it": "Nothing earlier: the base headroom (1,062 B) was smaller than the loader and the restore branch together. Sized to the measurement plus 633 bytes of headroom (the strict-lock option in `hooks/state_io.ts` is part of the measurement)."
+        },
+        {
+            "date": "2026-11-08",
+            "chunk": "src/scripts/hooks/subagent_constraints_hook.ts",
+            "from": 24500,
+            "to": 28500,
+            "by": "agent, feat/session-pins-phase-2 (road-to-state-and-pins-across-compaction 2.2)",
+            "what_was_added": "The parent session's pins handed to every subagent: `subagentPinsText` and the read of the pin file through `_lib/session_pins.ts` (+4,010 B: 23,843 B on origin/main to 27,853 B), including the notice a subagent gets when the pin file cannot be read.",
+            "why_it_could_not_be_avoided": "A subagent starts without the conversation its pins were typed in, and roadmap 2.2 names this carrier. The chunk imports the same reader the capture writes with, so the two cannot disagree about the file; loading the pin chunk from inside another CJS chunk has no `import.meta.url` to resolve it from.",
+            "what_would_have_caught_it": "Nothing earlier: the growth is the feature. Sized to the measurement plus about 3 %."
         }
@@ -253,2 +272,8 @@
         },
+        {
+            "entry": "src/scripts/_lib/session_pins.ts",
+            "max_bytes": 28600,
+            "registered_at": "2026-11-08",
+            "derivation": "Measured 27,750 bytes on 2026-11-08 (capture under a strict file lock that never replaces an unreadable file, eligibility computed in linear time from fence, paste and injected-region spans of the original text (attributed envelopes included, opener recognition with no attribute grammar, a forward-only paste-tag scanner), lone surrogates normalised, caps, lossless per-session state that is never overwritten when it cannot be read whole, a reported restore failure, the once-per-compaction restatement coordinated across prompt and tool order with one restore record per session changed only under the per-file lock, each delivery adding the compaction's stamp to a set of acknowledged stamps in that lock (the most recent 512; nothing moves backward within that window), pins read inside that transaction, the tool-call restore keyed on its own stamp, a once-a-day retention prune, the subagent reader, activity-based retention, restore text, and the parts of `_lib/prompt_shape` and `hooks/state_io` they import). The ceiling is that reading plus about 3 %, rounded, with no growth queued. Loaded by `language-mirror` through `hooks/session_pins_loader.ts` on a prompt carrying a `pin:` or `unpin:` line and on the one tool call after a compaction; a missing chunk is reported on the capture turn and costs the pin restore, never the language restore or the dispatch."
+        },
         {
@@ -285,3 +310,3 @@
             "entry": "src/scripts/hooks/subagent_constraints_hook.ts",
-            "max_bytes": 24500,
+            "max_bytes": 28500,
             "registered_at": "2026-10-24",
diff --git a/src/config/hook-token-budget.json b/src/config/hook-token-budget.json
index 7a40295422..6642165242 100644
--- a/src/config/hook-token-budget.json
+++ b/src/config/hook-token-budget.json
@@ -16,4 +16,4 @@
   "session-canary_reason": "full canary contract once at session_start; the per-turn beat is one line",
-  "language-mirror": 2048,
-  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn",
+  "language-mirror": 5888,
+  "language-mirror_reason": "the measured 626-wrong-turn failure class justifies a full-paragraph pin per turn (at most 771 B per reply line, measured). RAISED 2048 -> 5888 on 2026-11-08 by road-to-state-and-pins-across-compaction 2.1-2.3: the same concern now carries the user's session pins, on three fires only — the turn a prompt carries a `pin:`/`unpin:` line (language pin plus a capture notice naming at most 3 entries per list, 40 characters each), the one tool call after a compaction (language pin plus the pins verbatim), and the first prompt after a compaction (the pins restated once — before the tool-call restore when the prompt comes first, which then carries the language pin only, or after it in case the dispatcher dropped it under the per-turn budget — with any capture notice of that prompt cut to counts and at most 3 short previews of refused pins). Every other turn is unchanged. The bound is by construction: pins are capped at 12 x 300 characters and 4,096 JSON-escaped bytes together (`MAX_PINS_BYTES` in `_lib/session_pins.ts`). Worst shapes computed from the caps: 5,641 B (capture plus restatement with the restore record unlockable: quote-heavy pins at the byte cap, system-locale pin, refusal counts plus 3 refused previews of 20 four-byte characters, and the one-line lock-failure note), the row leaving 247 B above it; 5,054 B (tool-call restore), 4,778 B (capture notice with every list full of 4-byte characters); `tests/scripts/session_pins.test.ts` asserts a combined line against this row. All stay under the host's 10,000-character additionalContext line.",
   "council-availability": 1536,
@@ -51,2 +51,3 @@
   "post_tool_use": 2048,
+  "post_tool_use_reason": "Per ordinary fire. ONE named exception, stated rather than hidden: the single tool call after a compaction carries the `language-mirror` restore (language pin plus session pins, at most about 5,090 B, see that row), once per compaction event — the same restore role session_start plays for the rule layer. The bench replays fixtures with no pin state, so it cannot see that fire; the runtime per-turn aggregate in `hooks/injection_budget.ts` still applies to it: beside a full prompt slot and a second post_tool_use concern at its cap the restore is kept, and only a turn that has already spent the per-turn ceiling drops it. A dropped restore is not lost: the first prompt after the compaction restates the pins once, at the start of a fresh turn, from the set the user holds after that prompt's own directives. That restatement rides `user_prompt_submit`, inside the `language-mirror` row above.",
   "stop": 2048,
diff --git a/src/scripts/hook_chunks.mjs b/src/scripts/hook_chunks.mjs
index abc137a56e..904b33fbbe 100644
--- a/src/scripts/hook_chunks.mjs
+++ b/src/scripts/hook_chunks.mjs
@@ -35,2 +35,5 @@ export const HOOK_CHUNKS = Object.freeze([
     }),
+    // Required by `language-mirror` on a `pin:` prompt and after a compaction
+    // alone (`session_pins_loader.ts`).
+    Object.freeze({ entry: 'src/scripts/_lib/session_pins.ts', outfile: 'dist/hooks/session_pins.chunk.cjs' }),
     // Required by `design-pass` on a UI write alone (`design_consistency_loader.ts`).
diff --git a/src/scripts/hooks/state_io.ts b/src/scripts/hooks/state_io.ts
index 537a2bae97..e926e7e1cc 100644
--- a/src/scripts/hooks/state_io.ts
+++ b/src/scripts/hooks/state_io.ts
@@ -405,3 +405,3 @@ function _acquire_lock(
   lock_path: string,
-  options: { blocking?: boolean } = {},
+  options: { blocking?: boolean; strict?: boolean } = {},
 ): number | null {
@@ -433,3 +433,5 @@ function _acquire_lock(
         // mode here is a lost guard, and the alternative is a lost write.
-        return fd;
+        // `strict` callers (session pins) prefer the reported failure: a write
+        // without exclusion can silently drop a user's constraint.
+        return options.strict === true ? give_up() : fd;
       }
@@ -1046,3 +1048,3 @@ export function update_text_under_lock(
   transform: (loaded: string | null) => string | null,
-  options: { blocking?: boolean } = {},
+  options: { blocking?: boolean; strict?: boolean } = {},
 ): LockedUpdateResult {
@@ -1069,3 +1071,3 @@ export function update_text_under_lock(
   try {
-    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true });
+    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true, strict: options.strict === true });
   } catch {
diff --git a/src/scripts/hooks/subagent_constraints_hook.ts b/src/scripts/hooks/subagent_constraints_hook.ts
index 228fff782d..5fee4169ff 100644
--- a/src/scripts/hooks/subagent_constraints_hook.ts
+++ b/src/scripts/hooks/subagent_constraints_hook.ts
@@ -35,2 +35,6 @@
  *
+ * Every subagent, whatever its definition, also receives the parent session's
+ * pins (`_lib/session_pins.ts`) ahead of the digest; a session without pins
+ * changes nothing here.
+ *
  * Ships in its own chunk (decision A9), `yaml` external like `chat_history`'s:
@@ -46,2 +50,3 @@ import { parse as parseYaml } from 'yaml';
 import { lawSections, ruleBody } from '../_lib/rule_law_section.js';
+import { pinsDisabled, pinsForSubagent } from '../_lib/session_pins.js';
 import { EXIT_ALLOW, EXIT_WARN } from './exit_codes.js';
@@ -511,4 +516,36 @@ export function digestFor(envelope: unknown, env: NodeJS.ProcessEnv = process.en
     const configDir = env['CLAUDE_CONFIG_DIR'] || path.join(os.homedir(), '.claude');
-    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return null;
-    return instructionDigest(projectDir, EMISSION_MAX_BYTES, configDir);
+    const sessionId = str(envelope, 'session_id') ?? str(payload, 'session_id');
+    const pins = pinsDisabled(env) || sessionId === null ? '' : subagentPinsText(pinsForSubagent(projectDir, sessionId));
+    if (!definitionSkipsInstructions(projectDir, agentType, configDir)) return pins === '' ? null : pins;
+    if (pins === '') return instructionDigest(projectDir, EMISSION_MAX_BYTES, configDir);
+    // Pins go first: they are the user's own words for this session, and the
+    // 12 x 300 cap keeps them far under the line ceiling, so the digest keeps
+    // the rest of the room.
+    const separator = '\n\n';
+    const room = EMISSION_MAX_BYTES - escBytes(pins + separator);
+    if (room > 0) return pins + separator + instructionDigest(projectDir, room, configDir);
+    // Unreachable under today's caps (a test holds the margin); said rather than silent if a cap moves.
+    process.stderr.write('subagent-constraints: session pins filled the reply; the instruction digest was left out\n');
+    return pins;
+}
+
+/**
+ * The parent session's pins, handed to every subagent it starts
+ * (road-to-state-and-pins-across-compaction 2.2) — a subagent starts without
+ * the conversation the pins were typed in, whatever its definition says.
+ */
+export function subagentPinsText(pins: readonly string[] | null): string {
+    if (pins === null) {
+        return (
+            "<session-pins>\nThe session that started you has pinned constraints, but they could not be read. " +
+            'Before any change the user might have constrained, say so and ask.\n</session-pins>'
+        );
+    }
+    if (pins.length === 0) return '';
+    return [
+        '<session-pins>',
+        'Constraints the user pinned in the session that started you. They apply to your work too:',
+        ...pins.map((p) => `- ${p}`),
+        '</session-pins>',
+    ].join('\n');
 }
diff --git a/src/scripts/language_mirror_hook.ts b/src/scripts/language_mirror_hook.ts
index bcd7f20679..a7d06804c8 100644
--- a/src/scripts/language_mirror_hook.ts
+++ b/src/scripts/language_mirror_hook.ts
@@ -68,2 +68,8 @@
  *
+ * SESSION PINS ride the same marker (road-to-state-and-pins-across-compaction
+ * Phase 2): a prompt line starting `pin:` is captured on this event, and the one
+ * `post_tool_use` after a compaction restores the pins with the language pin.
+ * The pin module ships as its own chunk (`hooks/session_pins_loader.ts`); its
+ * header carries the capture rules and the caps.
+ *
  * Never blocks (`fail_closed: false`, `severity: advisory`). Exit 0 always.
@@ -90,2 +96,7 @@ import {
 } from "./_lib/prompt_shape.js";
+import { loadSessionPins } from "./hooks/session_pins_loader.js";
+import type { SessionPins } from "./_lib/session_pins.js";
+
+/** How the pin module is reached; injectable because a test runner cannot `require` the TS source. */
+export type PinsLoader = () => SessionPins | null;
 
@@ -636,3 +647,3 @@ function _migrateLegacyMarker(consumer_root: string): void {
 
-export function _setPinLost(consumer_root: string, session_id: string): void {
+export function _setPinLost(consumer_root: string, session_id: string, stamp: string = new Date().toISOString()): void {
   if (is_replay_mode()) return;
@@ -640,3 +651,3 @@ export function _setPinLost(consumer_root: string, session_id: string): void {
   try {
-    atomic_write_text(path.join(consumer_root, pinLostMarker(session_id)), new Date().toISOString());
+    atomic_write_text(path.join(consumer_root, pinLostMarker(session_id)), stamp);
   } catch (err) {
@@ -688,2 +699,4 @@ export function _reEmitAfterCompaction(
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
@@ -701,3 +714,16 @@ export function _reEmitAfterCompaction(
   // threshold.
-  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
+  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {
+    // Re-checked inside the lock: two tool calls can both see the marker before
+    // either takes the lock, and only the first may restore this compaction.
+    if (!_pinLost(consumer_root, session_id)) {
+      return EXIT_ALLOW;
+    }
+    let stamp = "";
+    try {
+      stamp = fs.readFileSync(path.join(consumer_root, pinLostMarker(session_id)), "utf8").trim();
+    } catch (err) {
+      // Unknown stamp: the restore still delivers, without duplicate suppression.
+      process.stderr.write(`session-pins: compaction stamp unreadable (${_errText(err)})\n`);
+    }
+    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
     const language = previous.language as Verdict | undefined;
@@ -707,4 +733,29 @@ export function _reEmitAfterCompaction(
     _clearPinLost(consumer_root, session_id);
-    if (language !== "de" && language !== "en") {
-      return EXIT_ALLOW;
+    // Session pins ride the same marker (road-to-state-and-pins-across-compaction
+    // 2.2): one restore per compaction event, no second mechanism. They are
+    // owned by their own per-session file, so they restore even when no
+    // language is pinned.
+    // Loaded only when this session has a pin file; a missing module is then a
+    // failed restore the user is told about, never an empty one.
+    // The pin-lost marker is cleared above. Anything short of a settled restore
+    // — a lock or write failure, an unreadable pin file, a missing module —
+    // therefore re-arms the boundary with a fresh stamp, so a later prompt
+    // retries even when this compaction's own boundary write had failed.
+    let pins = "";
+    if (!pinsOff(env) && mayHavePins(consumer_root, session_id)) {
+      const outcome = safeLoad(load_pins)?.restoreOutcome(consumer_root, session_id, env, stamp) ?? {
+        text: "Session pins: could NOT be restored after this compaction — the pin module could not be loaded. Tell the user.",
+        settled: false,
+      };
+      pins = outcome.text;
+      if (!outcome.settled) {
+        try {
+          atomic_write_text(
+            `${pinFile(consumer_root, session_id).slice(0, -5)}.boundary`,
+            `${new Date().toISOString()} ${process.pid} ${Math.random()}`,
+          );
+        } catch (err) {
+          process.stderr.write(`session-pins: retry not armed (${_errText(err)})\n`);
+        }
+      }
     }
@@ -712,5 +763,4 @@ export function _reEmitAfterCompaction(
     // `nextState`, for the same shared-state reason.
-    if (!_ownsPin(previous, session_id)) {
-      return EXIT_ALLOW;
-    }
+    let restoreLanguage =
+      (language === "de" || language === "en") && _ownsPin(previous, session_id);
     // The pin is about to be fresh in context again, so the distance counter
@@ -723,6 +773,10 @@ export function _reEmitAfterCompaction(
     // the "compaction wins" invariant this file documents. Same fail-closed policy
-    // as the distance path: no durable reset, no emit.
-    if (!_resetDistance(consumer_root, previous, session_id, write_json)) {
+    // as the distance path: no durable reset, no language emit.
+    if (restoreLanguage && !_resetDistance(consumer_root, previous, session_id, write_json)) {
+      restoreLanguage = false;
+    }
+    if (!restoreLanguage && pins === "") {
       return EXIT_ALLOW;
     }
+    const lang = language as Exclude<Verdict, "und">;
     process.stdout.write(
@@ -730,4 +784,6 @@ export function _reEmitAfterCompaction(
         decision: "warn",
-        reason: noticeText(language, source),
-        additional_context: pinText(language, source),
+        reason: restoreLanguage ? noticeText(lang, source) : "Session pins restored after compaction.",
+        additional_context: [restoreLanguage ? pinText(lang, source) : "", pins]
+          .filter((part) => part !== "")
+          .join("\n\n"),
       })}\n`,
@@ -1043,5 +1099,7 @@ export function _onToolUse(
   write_json: StateWriter = atomic_write_json,
+  env: NodeJS.ProcessEnv = process.env,
+  load_pins: PinsLoader = loadSessionPins,
 ): number {
   if (_pinLost(consumer_root, session_id)) {
-    return _reEmitAfterCompaction(consumer_root, session_id, write_json);
+    return _reEmitAfterCompaction(consumer_root, session_id, write_json, env, load_pins);
   }
@@ -1050,5 +1108,32 @@ export function _onToolUse(
 
+/**
+ * A prompt that could carry a pin directive. Checked here, in the bundle, so
+ * the pin chunk is loaded for such prompts only; the chunk decides which lines
+ * count, and a missing chunk is said, never swallowed.
+ */
+const PIN_DIRECTIVE = /^(?:un)?pin:/im;
+/** A loader that throws is a missing module, never a crashed hook. */
+const safeLoad = (load: PinsLoader): SessionPins | null => {
+  try {
+    return load();
+  } catch {
+    return null;
+  }
+};
+const PINS_DIR = path.join("agents", "state", "session-pins");
+const pinsOff = (env: NodeJS.ProcessEnv): boolean => (env["AGENT_CONFIG_NO_SESSION_PINS"] ?? "").trim() === "1";
+const pinFile = (root: string, sid: string): string => path.join(root, session_state_file(PINS_DIR, sid));
+/** Only a definite `ENOENT` means "no pins"; any other failure is uncertain and goes to the module, which reports it. */
+const mayHavePins = (root: string, sid: string): boolean => {
+  try {
+    fs.lstatSync(pinFile(root, sid));
+    return true;
+  } catch (err) {
+    return (err as NodeJS.ErrnoException).code !== "ENOENT";
+  }
+};
+
 export function run(
   stdin_text: string,
-  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter },
+  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter; load_pins?: PinsLoader },
 ): number {
@@ -1084,3 +1169,16 @@ export function run(
   if (event === "pre_compact") {
-    _setPinLost(options.consumer_root, _sessionId(envelope));
+    // One unique stamp names this compaction, written to the pin-lost marker
+    // (read by the tool-call restore) and, for session pins, to the boundary
+    // (read by the prompt path) — two separate writes. Either one alone is
+    // enough to restore the pins.
+    const sid = _sessionId(envelope);
+    const stamp = `${new Date().toISOString()} ${process.pid} ${Math.random()}`;
+    _setPinLost(options.consumer_root, sid, stamp);
+    if (hasStableSessionId(sid) && !is_replay_mode() && !pinsOff(options.env ?? process.env) && mayHavePins(options.consumer_root, sid)) {
+      try {
+        atomic_write_text(`${pinFile(options.consumer_root, sid).slice(0, -5)}.boundary`, stamp);
+      } catch (err) {
+        process.stderr.write(`session-pins: compaction boundary not written (${_errText(err)})\n`);
+      }
+    }
     return EXIT_ALLOW;
@@ -1088,3 +1186,24 @@ export function run(
   if (event === "post_tool_use") {
-    return _onToolUse(options.consumer_root, _sessionId(envelope), options.write_json);
+    // Tool calls are activity too: a session running tools without prompts and
+    // with no language pinned would otherwise age its pins out of retention.
+    const tsid = _sessionId(envelope);
+    if (hasStableSessionId(tsid) && !is_replay_mode() && !pinsOff(options.env ?? process.env)) {
+      try {
+        const now = new Date();
+        fs.utimesSync(pinFile(options.consumer_root, tsid), now, now);
+      } catch (err) {
+        // No pin file is the normal case; anything else would let retention
+        // prune a tool-only session's pins, so it is said.
+        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
+          process.stderr.write(`session-pins: activity touch failed (${_errText(err)})\n`);
+        }
+      }
+    }
+    return _onToolUse(
+      options.consumer_root,
+      _sessionId(envelope),
+      options.write_json,
+      options.env ?? process.env,
+      options.load_pins ?? loadSessionPins,
+    );
   }
@@ -1156,5 +1275,85 @@ export function run(
 
+  // Session pins (road-to-state-and-pins-across-compaction 2.1): captured from
+  // this prompt's `pin:` lines only. The notice is emitted on the turn a
+  // directive arrives and never otherwise — no standing bytes.
+  // A missing module is told apart from a prompt whose `pin:` lines were all
+  // excluded (fenced, pasted) or switched off: only the first is a failure.
+  const env = options.env ?? process.env;
+  const pinModule = PIN_DIRECTIVE.test(prompt) && !pinsOff(env) ? safeLoad(options.load_pins ?? loadSessionPins) : undefined;
+  // A compaction since the last prompt leaves a pending marker: this prompt
+  // restates the pins (`followUp`), after its own capture so a pin removed now
+  // is never restated.
+  const base = stateful ? pinFile(options.consumer_root, session_id).slice(0, -5) : "";
+  // Only an open compaction (undelivered) or an owed restatement turns this
+  // on — a record whose debt is paid must not keep loading the module.
+  let owed = false;
+  if (stateful && !pinsOff(env)) {
+    let seen: string[] = [];
+    try {
+      const record = JSON.parse(fs.readFileSync(`${base}.restore.json`, "utf8")) as Record<string, unknown>;
+      owed = record["session_id"] !== session_id || record["delivered"] !== true || record["pending"] === true;
+      seen = Array.isArray(record["seen"]) ? record["seen"].filter((x): x is string => typeof x === "string") : [];
+    } catch (err) {
+      // Absent is nothing owed; unreadable or corrupt is handed to the module,
+      // which treats it as an open compaction rather than as settled.
+      owed = (err as NodeJS.ErrnoException).code !== "ENOENT";
+    }
+    try {
+      // Same reading as the module: an empty or unreadable boundary is
+      // unknown, and a stamp already acknowledged is never reopened.
+      const stamp = fs.readFileSync(`${base}.boundary`, "utf8").trim();
+      owed = owed || (stamp !== "" && !seen.includes(stamp));
+    } catch (err) {
+      // Absent: nothing to open. Unreadable: also nothing the prompt path can
+      // open — the tool-call restore carries its own stamp — but it is said.
+      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
+        process.stderr.write(`session-pins: compaction boundary unreadable (${_errText(err)}); the tool-call restore covers it\n`);
+      }
+    }
+  }
+  const restatePending = stateful && !pinsOff(env) && owed;
+  // Every substantive prompt marks the pins as belonging to a live session, so
+  // retention measures activity even when no language is pinned.
+  if (stateful && !is_replay_mode() && !pinsOff(env)) {
+    try {
+      const now = new Date();
+      fs.utimesSync(pinFile(options.consumer_root, session_id), now, now);
+    } catch (err) {
+      // No pin file is the normal case; anything else would let retention
+      // prune an active session's pins, so it is said.
+      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
+        process.stderr.write(`session-pins: activity touch failed (${_errText(err)})\n`);
+      }
+    }
+  }
+  const pinNotice =
+    pinModule === undefined
+      ? null
+      : pinModule === null
+        ? "Session pins: the pin module could not be loaded, so any pin: or unpin: line in this prompt was NOT applied. Tell the user."
+        : pinModule.captureFor(options.consumer_root, session_id, prompt, env, restatePending);
+  let pinFollowUp = "";
+  if (restatePending) {
+    const mod = pinModule ?? safeLoad(options.load_pins ?? loadSessionPins);
+    pinFollowUp =
+      mod?.followUp(options.consumer_root, session_id, env) ??
+      "Session pins: could NOT be restated after the last compaction — the pin module could not be loaded. Tell the user.";
+  }
+  const pinText_ = [pinNotice ?? "", pinFollowUp].filter((t) => t !== "").join("\n\n");
+  const pinOut = pinText_ === "" ? null : pinText_;
+
   if (effective === "de" || effective === "en") {
+    const context = pinText(effective, effectiveSource);
+    process.stdout.write(
+      `${JSON.stringify({
+        decision: "warn",
+        reason: noticeText(effective, effectiveSource),
+        additional_context: pinOut === null ? context : `${context}\n\n${pinOut}`,
+      })}\n`,
+    );
+    return EXIT_WARN;
+  }
+  if (pinOut !== null) {
     process.stdout.write(
-      `${JSON.stringify({ decision: "warn", reason: noticeText(effective, effectiveSource), additional_context: pinText(effective, effectiveSource) })}\n`,
+      `${JSON.stringify({ decision: "warn", reason: "Session pins updated.", additional_context: pinOut })}\n`,
     );
~~~

## Helpers the change relies on

### `hooks/state_io.ts` (after this change)

~~~ts
function _acquire_lock(
  lock_path: string,
  options: { blocking?: boolean; strict?: boolean } = {},
): number | null {
  const blocking = options.blocking ?? true;
  // Open (and keep) the sentinel lock file with O_CREAT | O_RDWR — never
  // truncated, just an fd, exactly like the Python fcntl path. The file
  // stays on disk alongside the target after release.
  const fd = fs.openSync(lock_path, "a", 0o644);
  const held = lock_path + ".held";
  const give_up = (): null => {
    try {
      fs.closeSync(fd);
    } catch {
      /* ignore */
    }
    return null;
  };
  const start = Date.now();
  for (;;) {
    try {
      const heldFd = fs.openSync(held, "wx", 0o644);
      fs.closeSync(heldFd);
      return fd;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
        // Unexpected error (a read-only mount, a vanished parent) — proceed
        // without the companion guard rather than wedge the never-block hook
        // contract. Pre-existing behaviour, deliberately retained: the failure
        // mode here is a lost guard, and the alternative is a lost write.
        // `strict` callers (session pins) prefer the reported failure: a write
        // without exclusion can silently drop a user's constraint.
        return options.strict === true ? give_up() : fd;
      }
      // EEXIST: somebody holds it. Decide from the COMPANION, never from how
      // long we have waited.
      let age_ms: number;
      try {
        age_ms = Date.now() - fs.statSync(held).mtimeMs;
      } catch {
        // Vanished between the open and the stat — the holder just released.
        // Retry at once: this is real progress, not a spin.
        continue;
      }
      if (age_ms >= LOCK_STALE_MS) {
        // A genuine staleness check: the companion itself has been untouched
        // for longer than any live critical section here can last. Removing it
        // is progress, so the immediate retry is bounded.
        try {
          fs.rmSync(held, { force: true });
        } catch {
          /* a peer reclaimed it first — the retry below sees the new one */
        }
        continue;
      }
      // A LIVE peer holds it.
      if (!blocking) {
        return give_up();
      }
      if (Date.now() - start > LOCK_ACQUIRE_DEADLINE_MS) {
        // Waited long enough. Report failure — never evict a fresh companion,
        // which is exactly the eviction that made two impatient callers destroy
        // each other's exclusion.
        return give_up();
      }
      _sleep(LOCK_SPIN_SLEEP_MS);
    }
  }
}

/**
 * Read a TEXT file, transform it, and write it back — the WHOLE sequence under
 * one lock.
 *
 * The text sibling of {@link update_json_under_lock}, added for P3 of
 * `b-stop-async-split-prerequisites` (council 2026-08-20, option (a),
 * "P3 before anything else"). The concrete case is
 * `agents/runtime/state/dispatch-issues.jsonl`, which had NO lock and NO
 * tmp+rename: `log_dispatch_issue` read the whole capped log, appended a line,
 * and `writeFileSync`'d the target directly.
 *
 * That is corruption-capable rather than merely lossy, and the distinction is
 * why this needed its own primitive instead of a comment. `writeFileSync`
 * truncates and then writes, so a concurrent reader can observe a half-written
 * log and a concurrent writer can interleave into one — and the file is written
 * precisely when something has ALREADY gone wrong, so the evidence destroyed is
 * the evidence of the failure being reported. Two concurrent dispatchers in one
 * workspace is a supported configuration (two platforms installed side by side),
 * and a host that runs tool calls in parallel produces it without any second
 * platform at all.
 *
 * `transform` receives the file's content as read INSIDE the lock — `null` when
 * the file does not exist, so a caller can tell "absent" from "empty" — and
 * returns what to write. Returning `null` writes nothing and still counts as
 * success.
 *
 * Returns `written` / `skipped` / `failed`, the same three-state contract
 * `update_json_under_lock` carries since `bcbb0380b` — a boolean could not tell
 * a deliberate decline from a failure, and every member of the union is a truthy
 * string, so `if (!result)` is a silent no-op rather than a compile error. Under
 * `AGENT_CONFIG_REPLAY=1` this reports `failed` without touching the tree.
 */
export function update_text_under_lock(
  target: string,
  transform: (loaded: string | null) => string | null,
  options: { blocking?: boolean; strict?: boolean } = {},
): LockedUpdateResult {
  if (is_replay_mode()) return "failed";
  const targetPath = path.resolve(target);
  const state_dir = path.dirname(targetPath);
  try {
    fs.mkdirSync(state_dir, { recursive: true });
  } catch {
    return "failed";
  }
  // FILE-keyed, matching `update_json_under_lock` rather than
  // `_atomic_write_text`. Converged onto the sibling deliberately after
  // `bcbb0380b` landed the measured argument: a read-modify-write needs mutual
  // exclusion against writers of THIS file and nothing else, and the shared
  // directory lock was measured paying the full cost of exclusion for writes
  // that require none (8 workers: slowest 138-267 ms shared vs 83-95 ms
  // unshared). This function was written against the directory-keyed primitive
  // one commit earlier; leaving it there would have made
  // `dispatch-issues.jsonl` serialise against every unrelated
  // `atomic_write_text` in the state dir.
  const lock_path = _target_lock_path(targetPath);
  let fd: number | null;
  try {
    fd = _acquire_lock(lock_path, { blocking: options.blocking ?? true, strict: options.strict === true });
  } catch {
    return "failed";
  }
  // FAIL CLOSED, for the same reason the JSON sibling does: an append without
  // exclusion is the truncating write this function exists to prevent.
  if (fd === null) return "failed";
  try {
    let loaded: string | null = null;
    try {
      loaded = fs.readFileSync(targetPath, "utf-8");
    } catch {
      // Absent or unreadable. `null` lets the transform distinguish the two
      // from an empty file, which matters for an append-only log: an
      // unreadable existing log must not be silently replaced by one line.
    }
    const next = transform(loaded);
    if (next === null) return "skipped"; // deliberate no-write, not a failure
    _publish_text_locked(targetPath, next);
    return "written";
  } catch {
    return "failed";
  } finally {
    _release_lock(fd, lock_path);
  }
}

/**
 * Does a loaded session-state object belong to `session_id`?
 *
 * THE DIGEST PATH IS NOT THE WHOLE GUARANTEE, which is the correction this
 * function exists to carry. `session_state_file` says callers "keep an in-file
 * `session_id` as a cheap integrity check" — and a cross-model review
 * (2026-08-20, both seats, blocking) found the two `turn-end-gate` readers
 * consuming state without ever making that check, so the sentence described a
 * discipline no consumer followed. A file that arrives at the wrong digest path
 * by a copy, a restore, a hand-edit, or a buggy writer was accepted whole; the
 * sharp case is a foreign `ci_last: {settled: true}`, which vouches for a CI run
 * this session never made and lets a premature completion claim through a
 * BLOCKING gate.
 *
 * EXACT match, and an absent owner is foreign. There is no compatibility window
 * to honour: the digest layout has never shipped for either concern, so no
 * deployed version ever wrote an ownerless hashed file — a permissive branch
 * would be dead code that weakens the guarantee its own doc comment states.
 * (The language hook's `_ownsPin` learned this in its round 3 and now delegates
 * here.)
 */
export function owns_session_state(state: unknown, session_id: string): boolean {
  if (typeof state !== "object" || state === null || Array.isArray(state)) return false;
  return (state as Record<string, unknown>)["session_id"] === session_id;
}
~~~

### `_lib/prompt_shape.ts`

~~~ts
const DOCUMENT_HEAD = /^\s*(#{1,6}\s|-{3,}\s*$|={3,}\s*$|<[A-Za-z][\w-]*>\s*$)/;

/**
 * Is this "prompt" a harness-generated turn rather than something a human typed?
 *
 * MEASURED, IN THE LANGUAGE HOOK'S OWN AUDIT (round 5, 2026-08-07). The state
 * file read mid-session:
 *
 *   { "language": "en", "source": "prompt", "prompt_chars": 6627,
 *     "de_markers": 0, "en_markers": 63 }
 *
 * No human wrote those 6,627 characters. They were a background-task completion
 * notification, injected as a user turn, which `user_prompt_submit` sees and the
 * hook classified as the trigger — flipping a German session to `en` for every
 * later turn, and recording `source: "prompt"`, a false provenance claim.
 *
 * The markers are structural, not linguistic: the harness stamps these turns
 * with fixed envelope tags. Matching prose would misfire on a human quoting a
 * notification; matching the tags cannot, because a human typing
 * `<task-notification>` is quoting, and a quote does not open at character zero.
 *
 * Deliberately conservative: an unrecognised synthetic shape falls through and
 * is treated as a chat message. Under-filtering keeps prior behaviour;
 * over-filtering would silently stop pinning real prompts, which is worse.
 * Measured across 1 540 user-role entries: 509 open at character zero with a
 * marker, and in 0 of them does human text survive wrapper removal.
 *
 * `<agent-message` added 2026-10-03, by the same under-filtering it warns
 * about: a subagent hand-back reaches this slot as `<agent-message from="…">`,
 * and 12 of the 153 hook-sourced user records in this project's capture open
 * with it. It pinned a German session to `en`, after which the turn-end gate
 * refused each German reply — a reply language derived from a frame nobody
 * typed. Its literal stops before the `>` because the element carries an
 * attribute; the anchor at character zero is unchanged.
 *
 * **The fourth shape has NO envelope tag, and it is the exception this file's
 * own "structural, not linguistic" rule has to name rather than quietly break.**
 * The host resumes a rate-limited session with a plain sentence —
 * `Your claude.ai usage limit has reset. Continue the task you were working
 * on…` — carrying no element, no bracket and no stamp. 5 of the 153
 * hook-sourced user records in this project's capture open with it. Measured
 * 2026-10-03: it pinned a German session to `en` with `prompt_chars: 148`,
 * which is that sentence's exact length, and every German reply for the rest
 * of the run was then refused by the turn-end gate as wrong-language.
 *
 * Matching prose is what the paragraph above warns against, so what makes this
 * one admissible is stated rather than assumed: it is a FIXED host string, not
 * a linguistic pattern, and the character-zero anchor does the same work a tag
 * would — a human asking *why did I get "Your claude.ai usage limit has
 * reset"* does not open with it. A test pins that direction. If the host ever
 * reworded the sentence this guard would silently stop matching, which is the
 * honest failure mode: it under-filters back to today's behaviour rather than
 * misfiring on a real turn.
 *
 * It is deliberately NOT added to `machine_wake.ts`. There the same
 * misclassification retains an authorization instead of mis-pinning a reply,
 * and a prose match is too weak a warrant for that consequence — see the
 * asymmetry note below, which this is the first real test of.
 *
 * **A SECOND VOCABULARY ANSWERS THIS SAME QUESTION AND THE TWO HAVE DRIFTED.**
 * `_lib/machine_wake.ts`'s `humanTypedThisTurn` guards per-turn STATE on this
 * slot (the git-authorization ledger, the suggestion latch) while this one
 * guards the language pin. As of this change both know `<task-notification>`,
 * `<system-reminder>` and `<agent-message`; only this one knows
 * `[SYSTEM NOTIFICATION`, `<local-command-caveat>` and the host's framed
 * agent-message delivery (`AGENT_MESSAGE_FRAME`). That asymmetry is NOT
 * obviously a defect and was deliberately left: mistaking a real turn for a
 * machine one costs a mis-pinned reply here and a RETAINED AUTHORIZATION
 * there, so the two sides do not want the same error budget — and
 * `<local-command-caveat>` in particular precedes a real typed prompt. Unify
 * them only with that asymmetry answered, never as tidying.
 */
export function isSyntheticPrompt(prompt: string): boolean {
  const head = prompt.trimStart().slice(0, 400);
  return (
    head.startsWith("[SYSTEM NOTIFICATION - NOT USER INPUT]") ||
    head.startsWith("<task-notification>") ||
    head.startsWith("<system-reminder>") ||
    head.startsWith("<local-command-caveat>") ||
    head.startsWith("<agent-message") ||
    head.startsWith("Your claude.ai usage limit has reset") ||
    /^\[SYSTEM NOTIFICATION\b/.test(head) ||
    AGENT_MESSAGE_FRAME.test(head)
  );
}

/**
 * The part of a prompt a human plausibly typed: everything before the first
 * pasted document begins.
 *
 * Callers pass text that has already had output-shaped pastes removed. Returning
 * the LEAD rather than a filtered whole is deliberate — a paste can be
 * interleaved, and reassembling the human fragments would invent a text nobody
 * wrote. The lead is the one span whose authorship is not in question.
 */
export function humanAuthoredLead(text: string): string {
  const kept: string[] = [];
  for (const line of text.split("\n")) {
    if (DOCUMENT_HEAD.test(line)) {
      break;
    }
    kept.push(line);
  }
  return kept.join("\n");
}
~~~

### `hooks/svg_rules_loader.ts`

~~~ts
/**
 * Require the function `name` from a conditional chunk, or null. Shared so a
 * second chunk loader adds no copy of this logic to the dispatch bundle.
 */
export function loadChunkExport<T>(selfUrl: string, specifier: string, name: string, bundled: boolean): T | null {
    try {
        // The chunk runs inside the dispatch process, so it gets the bundle's
        // own integrity check: a mismatch with its sidecar is not executed.
        // No sidecar is `unverifiable` and allowed, as for `dispatch.js`.
        if (bundled && verifyBundle(specifier).state === 'mismatch') return null;
        const fn = (createRequire(selfUrl)(specifier) as Record<string, unknown>)[name];
        return typeof fn === 'function' ? (fn as T) : null;
    } catch {
        return null;
    }
}
~~~

## Dispatcher-level test — `tests/hooks/session_pins_dispatch.test.ts`

~~~ts
// Session pins through the real dispatcher (`dispatch_hook.ts`), not the
// concern in isolation: every concern the manifest binds on these claude events
// runs beside `language-mirror`, and the dispatcher's own emission shaping
// (`shapeEmissions`, the per-turn budget) decides what reaches the host line.
// The council asked for this in rounds 4, 8 and 10 of the ratification.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { boundaryPath, restorePath } from '../../src/scripts/_lib/session_pins.js';
import { turnSpendPath } from '../../src/scripts/hooks/injection_budget.js';

let project: string;

beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'pins-dispatch-'));
    spawnSync('git', ['init', '-q'], { cwd: project });
});

afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
});

/** One host event through the dispatcher; the host-facing context line it printed. */
function dispatch(event: string, nativeEvent: string, payload: Record<string, unknown>): string {
    const tsx = path.resolve('node_modules/.bin/tsx');
    const r = spawnSync(
        tsx,
        [
            path.resolve('src/scripts/hooks/dispatch_hook.ts'),
            '--platform',
            'claude',
            '--event',
            event,
            '--native-event',
            nativeEvent,
            '--project-dir',
            project,
        ],
        {
            input: JSON.stringify({ session_id: 'dispatch-s', hook_event_name: nativeEvent, cwd: project, ...payload }),
            env: { ...process.env, CLAUDE_PROJECT_DIR: project, AGENT_CONFIG_REPLAY: '', LANG: 'C' },
            encoding: 'utf8',
            timeout: 60_000,
        },
    );
    // A crashed or timed-out dispatcher must fail the test, not satisfy a negative assertion.
    expect(r.error).toBeUndefined();
    expect(r.signal).toBeNull();
    expect(r.status).toBe(0);
    const line = (r.stdout ?? '').trim().split('\n').pop() ?? '';
    if (line === '') return '';
    const parsed = JSON.parse(line) as { hookSpecificOutput?: { additionalContext?: string } };
    return parsed.hookSpecificOutput?.additionalContext ?? '';
}

describe('session pins through the dispatcher', () => {
    it('capture, compaction, tool-call restore and one restatement reach the host line, in that order', () => {
        const pins = Array.from({ length: 12 }, (_, i) => `pin: ${`rule ${i} `.padEnd(300, 'x')}`).join('\n');
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: pins })).toContain('Session pins: 12/12 held.');

        expect(dispatch('pre_compact', 'PreCompact', { trigger: 'auto' })).not.toContain('<session-pins>');

        const restore = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(restore).toContain('<session-pins>');
        expect(restore).toContain(`- ${'rule 11 '.padEnd(300, 'x')}`);

        const restated = dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' });
        expect(restated).toContain('Restated after the last compaction');

        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).not.toContain('<session-pins>');
    }, 240_000);

    it('prompt before tool call: the prompt carries the pins and the tool restore does not repeat them', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).toContain('- never push to main');
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).not.toContain(
            '<session-pins>',
        );
    }, 240_000);

    it('failure injection: a tool restore dropped by the real per-turn budget is restated by the next prompt', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        // The turn has already spent the ceiling: the dispatcher's own counter, read before shaping.
        const ceiling = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_turn_aggregate_bytes: { ceiling_bytes: number };
        }).per_turn_aggregate_bytes.ceiling_bytes;
        const spend = turnSpendPath(project, 'dispatch-s');
        fs.mkdirSync(path.dirname(spend), { recursive: true });
        fs.writeFileSync(spend, JSON.stringify({ session: 'dispatch-s', bytes: ceiling }));
        const dropped = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        expect(dropped).not.toContain('<session-pins>');
        const restated = dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' });
        expect(restated).toContain('Restated after the last compaction');
        expect(restated).toContain('- never push to main');
    }, 240_000);

    it('failure injection: an unreadable boundary still restores through the tool call', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const b = boundaryPath(project, 'dispatch-s');
        fs.rmSync(b);
        fs.mkdirSync(b);
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).not.toContain('<session-pins>');
        expect(dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} })).toContain(
            '- never push to main',
        );
    }, 240_000);

    it('failure injection: a held restore-record lock still delivers, saying so', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const companion = `${restorePath(project, 'dispatch-s')}.lock.held`;
        fs.mkdirSync(path.dirname(companion), { recursive: true });
        fs.writeFileSync(companion, '');
        const line = dispatch('post_tool_use', 'PostToolUse', { tool_name: 'Bash', tool_input: { command: 'ls' }, tool_response: {} });
        fs.rmSync(companion, { force: true });
        expect(line).toContain('- never push to main');
        expect(line).toContain('unlocked');
    }, 240_000);

    it('failure injection: a prompt-first restore is not dropped even when the previous turn spent the whole ceiling', () => {
        dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'pin: never push to main' });
        dispatch('pre_compact', 'PreCompact', { trigger: 'auto' });
        const ceiling = (JSON.parse(fs.readFileSync('src/config/hook-token-budget.json', 'utf8')) as {
            per_turn_aggregate_bytes: { ceiling_bytes: number };
        }).per_turn_aggregate_bytes.ceiling_bytes;
        const spend = turnSpendPath(project, 'dispatch-s');
        fs.mkdirSync(path.dirname(spend), { recursive: true });
        fs.writeFileSync(spend, JSON.stringify({ session: 'dispatch-s', bytes: ceiling }));
        // A prompt starts a new turn, so the dispatcher resets the counter before shaping.
        expect(dispatch('user_prompt_submit', 'UserPromptSubmit', { prompt: 'continue' })).toContain('- never push to main');
    }, 240_000);
});
~~~

## Unit tests — `tests/scripts/session_pins.test.ts` (157, all green)

- 2.1 capture — only an explicit line-start marker in the typed prompt captures `pin:` lines in order and ignores everything else
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from indented
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from mid-line
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from fenced code
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from pasted block
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from after a pasted document
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from host-injected region
- 2.1 capture — only an explicit line-start marker in the typed prompt does not capture a pin from empty body
- 2.1 capture — only an explicit line-start marker in the typed prompt a synthetic turn (task notification, system reminder) carries no capturable text
- 2.1 capture — only an explicit line-start marker in the typed prompt control characters cannot smuggle a second line into a pin
- 2.1 capture — only an explicit line-start marker in the typed prompt the hook stores a pin from a typed prompt and tells the turn
- 2.1 capture — only an explicit line-start marker in the typed prompt a prompt without a directive emits no pin notice — no standing bytes
- 2.1 capture — only an explicit line-start marker in the typed prompt `unpin:` removes one pin, `unpin: all` removes every pin
- 2.1 capture — only an explicit line-start marker in the typed prompt a synthetic prompt cannot remove a pin either
- 2.1 capture — only an explicit line-start marker in the typed prompt the kill switch stores nothing
- 2.1 capture — only an explicit line-start marker in the typed prompt pins are per session — one session never reads another one’s
- 2.2 restore — one re-emit after compaction, verbatim re-emits the pins verbatim on the first tool call after pre_compact, then goes quiet
- 2.2 restore — one re-emit after compaction, verbatim restores the language pin and the session pins together in one line
- 2.2 restore — one re-emit after compaction, verbatim restores pins although no language is pinned
- 2.2 restore — one re-emit after compaction, verbatim no pins and no language: the marker is consumed silently
- 2.2 restore — one re-emit after compaction, verbatim a post_tool_use without a compaction never re-emits pins
- 2.2 restore — one re-emit after compaction, verbatim the kill switch suppresses the restore
- 2.2 restore — one re-emit after compaction, verbatim a subagent receives the parent session’s pins
- 2.2 restore — one re-emit after compaction, verbatim a subagent of a session without pins gets nothing from this path
- 2.3 caps — overflow is refused and reported, never truncated refuses the 13th pin and says so
- 2.3 caps — overflow is refused and reported, never truncated a prompt with a hundred refused pins still produces a bounded notice
- 2.3 caps — overflow is refused and reported, never truncated refuses a pin over 300 characters whole, never a prefix of it
- 2.3 caps — overflow is refused and reported, never truncated admits exactly 300 characters, counted as characters not bytes
- 2.3 caps — overflow is refused and reported, never truncated 12 ASCII pins of 300 characters all fit the byte bound
- 2.3 caps — overflow is refused and reported, never truncated refuses a pin that would take the set over 4096 bytes, and says so
- 2.3 caps — overflow is refused and reported, never truncated the byte bound counts JSON escaping, so quote-heavy pins cannot double the restore line
- 2.3 caps — overflow is refused and reported, never truncated a duplicate pin is reported, not stored twice
- 2.3 caps — overflow is refused and reported, never truncated a hand-edited file over a cap reads as no pins, and is never rewritten as a filtered copy
- 2.3 caps — overflow is refused and reported, never truncated the worst admitted restore stays under the host 10,000-character line
- the chunk boundary a prompt with a directive and no loadable module tells the turn the pin was not stored
- the chunk boundary a prompt without a directive never loads the module
- the chunk boundary a missing module after a compaction costs the pins, never the language restore
- the chunk boundary bundled: an absent, a throwing or an export-less chunk loads as null
- the chunk boundary bundled, the module is the sibling chunk; from source, the _lib module
- council round 1 findings — regressions a ``` line inside a ```` block does not reopen capture; the text after the real close does count
- council round 1 findings — regressions a ~~~ line does not close a ``` fence, and a fence with an info string does not close one
- council round 1 findings — regressions an unclosed fence hides everything after it
- council round 1 findings — regressions removing a pasted block cannot splice its neighbours into a directive
- council round 1 findings — regressions a pin typed on its own line after a paste still counts
- council round 1 findings — regressions an unclosed pasted block hides everything after it
- council round 1 findings — regressions a prompt whose pin lines were all excluded gets no notice, and never the module-failure one
- council round 1 findings — regressions a pin file holding malformed JSON is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding another session’s file is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding no pin list is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding a non-string entry beside a valid one is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding an oversized entry beside a valid one is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding a control character in an entry is left untouched and the turn is told
- council round 1 findings — regressions a pin file holding a duplicate entry is left untouched and the turn is told
- council round 1 findings — regressions overlapping captures in separate processes lose no pin
- council round 1 findings — regressions retention follows session activity, not the age of the pin file
- the restore under the runtime per-turn budget survives beside every other post_tool_use concern at its slot cap, after a full prompt slot
- the restore under the runtime per-turn budget is dropped — and the drop recorded — only when the turn has already spent the ceiling
- council round 2 findings — regressions an invalid pin file after a compaction is reported, not restored as empty
- council round 2 findings — regressions a missing module after a compaction is reported when the session has pins, silent when it has none
- council round 2 findings — regressions with pins switched off, a missing module produces no notice and is never loaded
- council round 2 findings — regressions a prompt keeps the pins of a session with no language pin alive
- council round 2 findings — regressions the worst admitted pins plus the digest stay inside the subagent reply cap
- council round 3 findings — regressions a paste nested inside a paste cannot close the outer one early
- council round 3 findings — regressions a nested paste whose outer block never closes hides everything after it
- council round 3 findings — regressions a stray closing tag after a complete paste drops what came before it too
- council round 3 findings — regressions a closing paste tag with no opener drops everything before it
- council round 3 findings — regressions the full pipeline through the hook keeps a nested-paste directive out of the store
- the first prompt after a compaction restates the pins once restates them on the next prompt, then never again for that compaction
- the first prompt after a compaction restates the pins once `unpin: all` in that prompt is applied first, so nothing is restated
- the first prompt after a compaction restates the pins once a pin removed in that prompt is not restated; the rest are
- the first prompt after a compaction restates the pins once an unreadable pin file at that prompt is reported, not silently skipped
- the first prompt after a compaction restates the pins once a pin file that cannot even be opened at that prompt is reported too
- the first prompt after a compaction restates the pins once a missing module at that prompt is reported
- the first prompt after a compaction restates the pins once capture and restatement on one prompt stay inside the language-mirror row
- council round 3 — a subagent is told when the pins cannot be read an unreadable pin file gives the subagent a notice, not silence
- council round 5 — one transition per compaction, whichever event comes first prompt before tool call: the prompt restates, the tool restore then carries the language only, nothing repeats
- council round 5 — one transition per compaction, whichever event comes first tool call before prompt: restore, then one restatement, then silence
- council round 5 — one transition per compaction, whichever event comes first a marker that cannot be removed is never acted on, so nothing repeats on every prompt
- council round 5 — one transition per compaction, whichever event comes first two settlements of one marker restate once
- council round 5 — one transition per compaction, whichever event comes first the subagent reply cap leaves at least 4 KB for the digest beside the largest admissible pin block
- council round 6 — restore state belongs to one compaction a restatement from compaction A cannot suppress the restore of compaction B
- council round 6 — restore state belongs to one compaction prompt first: consecutive prompts before any tool call restate once
- council round 6 — restore state belongs to one compaction simultaneous prompt-first settlements restate once
- council round 6 — restore state belongs to one compaction retention prunes at most once a day
- council round 7 — fences keep their typed boundaries; one delivery per compaction a paste after a fence line cannot turn it into a closing fence
- council round 7 — fences keep their typed boundaries; one delivery per compaction through the hook, that shape neither adds a pin nor removes the held ones
- council round 7 — fences keep their typed boundaries; one delivery per compaction a prompt delivering while the tool restore runs: exactly one of them carries the pins
- council round 7 — fences keep their typed boundaries; one delivery per compaction tool first then prompt: the tool restores and the prompt restates once — two, never three
- council round 7 — fences keep their typed boundaries; one delivery per compaction a delivery marker left from an earlier compaction (failed reset) is replaced, not obeyed
- council round 7 — fences keep their typed boundaries; one delivery per compaction a restore record that cannot be locked is said in the restore line itself
- council round 8 — one transaction per event over one restore record every interleaving of one compaction delivers at most twice and the first prompt never misses
- council round 8 — one transaction per event over one restore record a restatement owed by an older compaction is dropped when a newer one is delivered by a prompt
- council round 8 — one transaction per event over one restore record concurrent tool calls and prompts after one compaction, as separate hook processes: one delivery per side at most, never none
- council round 9/10 — generations, paid debts, and the lock-failure bound a boundary written while a delivery holds the record survives it and opens the next compaction
- council round 9/10 — generations, paid debts, and the lock-failure bound a compaction opened while a restatement is owed replaces the debt with its own delivery
- council round 9/10 — generations, paid debts, and the lock-failure bound a lock failure on the owed restatement restates with a note instead of staying silent
- council round 9/10 — generations, paid debts, and the lock-failure bound once the debt is paid, later prompts do not load the module
- council round 9/10 — generations, paid debts, and the lock-failure bound the lock-failure branch of a combined capture and restatement stays inside the row
- council round 11 — the compaction boundary needs neither the lock nor the chunk a missing chunk at pre_compact still opens the compaction for the later restore
- council round 11 — the compaction boundary needs neither the lock nor the chunk after a settled compaction, the first prompt of the next one delivers before any tool call
- council round 11 — the compaction boundary needs neither the lock nor the chunk with no record at all, a boundary still makes the first prompt deliver
- council round 11 — the compaction boundary needs neither the lock nor the chunk the record is never removed outside its lock: a held lock at pre_compact leaves it, and the boundary still opens the compaction
- council round 12 — acknowledge the boundary, then remove it a write that fails after the transaction read the boundary leaves the boundary, so the compaction stays open
- council round 12 — acknowledge the boundary, then remove it an acknowledged boundary stays in place and does not reopen the compaction
- council round 12 — acknowledge the boundary, then remove it a newer boundary written during a delivery is never removed by its cleanup
- council round 12 — acknowledge the boundary, then remove it after a compaction, a restore record that is unparseable counts as unsettled, not as settled
- council round 12 — acknowledge the boundary, then remove it after a compaction, a restore record that is another session counts as unsettled, not as settled
- council round 12 — acknowledge the boundary, then remove it without a compaction, a broken restore record injects nothing
- council round 13 — nothing deletes the boundary; nothing settles before the pins are read an unreadable pin file reports and settles nothing; the next prompt delivers once it reads
- council round 13 — nothing deletes the boundary; nothing settles before the pins are read an unreadable boundary opens the compaction but is never acknowledged
- council round 13 — nothing deletes the boundary; nothing settles before the pins are read a new boundary replaces the old one and opens the next compaction
- council round 13 — nothing deletes the boundary; nothing settles before the pins are read with pins switched off, pre_compact writes no boundary and a prompt touches nothing
- council round 13 — nothing deletes the boundary; nothing settles before the pins are read a prompt-first delivery is the first fire of a turn: the runtime per-turn budget cannot drop it
- council round 14 — failed boundary writes, empty and unreadable boundaries a boundary that cannot be written still restores the next compaction (previous one delivered by tool)
- council round 14 — failed boundary writes, empty and unreadable boundaries a boundary that cannot be written still restores the next compaction (previous one delivered by prompt)
- council round 14 — failed boundary writes, empty and unreadable boundaries an empty boundary is unknown to the bundle and the module alike: the prompt waits, the tool restore delivers
- council round 14 — failed boundary writes, empty and unreadable boundaries an unreadable boundary never makes prompts deliver; the tool restore of that compaction does, once
- council round 15 — the tool restore carries its own stamp a second tool restore with the same stamp delivers nothing — the record, not a race, prevents the duplicate
- council round 15 — the tool restore carries its own stamp prompt-first A, then B before any tool call with B's boundary write failing: B is still restored
- council round 15 — an absent or empty boundary opens nothing on the prompt path the module: with the boundary gone, a settled record owes the prompt nothing
- council round 15 — an absent or empty boundary opens nothing on the prompt path the bundle: an empty boundary after a settled compaction does not even load the module
- council round 16 — acknowledgements never move backward sequential: B restored after its boundary write failed, then a prompt reads the old stamp A — A is not reopened, B's restatement is paid once
- council round 16 — acknowledgements never move backward interleaved: a paused prompt holding an older acknowledged stamp delivers nothing and keeps the newer acknowledgement
- council round 16 — acknowledgements never move backward the bundle does not even load the module for an older acknowledged stamp
- council round 17 — fence closers, the acknowledgement window, isolated writes a closer followed by a non-breaking space does not close the fence: neither pin nor unpin inside applies
- council round 17 — fence closers, the acknowledgement window, isolated writes a closer followed only by spaces and tabs does close the fence
- council round 17 — fence closers, the acknowledgement window, isolated writes a stamp stays acknowledged across 512 later compactions, and the window is what the code says
- council round 17 — fence closers, the acknowledgement window, isolated writes a pin-lost marker that cannot be written does not stop the boundary write
- council round 18 — tool calls keep pins alive a tool call refreshes the pin file of a session with no language pinned
- council round 19 — replay, prune and loader failures a replayed prompt neither stores a pin nor claims it tried
- council round 19 — replay, prune and loader failures a prune stamp that cannot be read does not trigger a prune
- council round 19 — replay, prune and loader failures a loader that throws is a missing module, never a crashed hook
- council round 20 — helper contracts tightened where capture relies on them an unreadable pin file is never replaced by a capture
- council round 20 — helper contracts tightened where capture relies on them a nested same-name injected region cannot expose a pin or an unpin
- council round 21 — fence membership first, well-formed text, strict exclusion a stray closing paste tag inside a fence cannot break the fence and let pin or unpin out
- council round 21 — fence membership first, well-formed text, strict exclusion fence membership is read from the text as typed: a region inside a fence stays hidden, a line after the fence counts
- council round 21 — fence membership first, well-formed text, strict exclusion a lone surrogate becomes U+FFFD, so no stored or previewed character serialises past four bytes
- council round 21 — fence membership first, well-formed text, strict exclusion every notice category full of four-byte characters stays inside the language-mirror row
- council round 21 — fence membership first, well-formed text, strict exclusion when the lock guard cannot be created, a capture reports failure instead of writing without exclusion
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a paste spanning fences cannot release a directive, whatever the order of the wrappers
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a paste spanning fences with unpin cannot release a directive, whatever the order of the wrappers
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a region spanning fences cannot release a directive, whatever the order of the wrappers
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a fence spanning a paste cannot release a directive, whatever the order of the wrappers
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a compaction whose boundary write failed and whose tool restore fails (unreadable pins) is retried by a later prompt
- council round 22 — exclusions are spans of the original text; failed restores keep a retry a compaction whose boundary write failed and whose tool restore fails (missing module) is retried by a later prompt
- the shipped chunk built with the shipping options and loaded through the bundled path, it captures and restores
- host regions are removed, not a reason to drop what the user typed after them a pin typed after a host-injected region is captured
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths an attributed agent message in a composite prompt cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths an attributed region nested in another cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths an unclosed region opener inside a fence cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths overlapping regions of different names cannot create or delete a pin
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths capture stays linear on an adversarial prompt of unmatched tags and pastes
- council round 23 — attributed envelopes, independent region spans, linear work, uncertain paths a pin directory that cannot be checked is not treated as "no pins": the tool restore reports instead of staying silent
- council round 24 — quoted attributes, settled restores, malformed paste tags a quoted > inside an attribute cannot hide an envelope opener
- council round 24 — quoted attributes, settled restores, malformed paste tags a closer quoted inside an attribute cannot hide an envelope opener
- council round 24 — quoted attributes, settled restores, malformed paste tags malformed paste openers with no closing > parse in linear time
- council round 24 — quoted attributes, settled restores, malformed paste tags a tool restore that cannot lock the record re-arms the retry, even when the boundary write had failed
