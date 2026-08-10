/**
 * `turn-end-gate` — the suite's FIRST concern that can refuse a turn-end.
 *
 * Round 5 of the conformance audit measured the thing this exists for: the
 * two BLOCKING carriers reached zero violations, neither ADVISORY carrier
 * did, and 19 language violations survived a pin that had fired 26-35
 * seconds earlier. The council read the same split from both sides —
 * "refusal-capable intercepts enforce; context injection requests". So this
 * is deliberately not another reminder. It is a check at the point of
 * delivery that can say no.
 *
 * Two detectors ride on one guard, because building the unsafe part twice
 * is how a second detector becomes a second outage:
 *
 *   A — promissory closing  (FC-5, 20 measured occurrences)
 *   B — language mismatch   (19 measured occurrences, fresh pin present)
 *
 * ## Re-entrancy — the shape, stated before registration
 *
 * `road-to-conformance-round6.md` § blocker records the hole this must not
 * fall into: "the re-entrancy guard is specified and unverified. What
 * happens when the refusal *itself* triggers the turn-end event?" Two
 * layers, each sufficient alone:
 *
 *   1. `stop_hook_active` — Claude sets it when a Stop follows a
 *      stop-hook block. Set ⇒ this turn was already refused ⇒ allow.
 *      Nothing else in `src/` reads this field today; it is the host's own
 *      answer to the question above.
 *
 *   2. A state marker keyed on the LAST USER MESSAGE, never on the reply.
 *      After a refusal the model writes a *new* reply, so a reply-keyed
 *      marker would let the same turn be refused again, and again. The
 *      user prompt does not change within a turn, so the same turn yields
 *      the same key and is refused at most once; the next genuine prompt
 *      yields a new key and the gate re-arms itself with no cleanup.
 *
 * The failure this ordering prevents is not a loop but a wedge: a turn that
 * can never end. Layer 2 also covers the host that does not send
 * `stop_hook_active` at all.
 *
 * ## Default OFF — and why, given the roadmap says otherwise
 *
 * `road-to-conformance-round5.md` § 3.6 asks for a kill-switch per
 * detector, "default on". The council recorded in round 6 (2026-08-08)
 * asked for the mechanism to be opt-in, "defaulting to off, so the
 * mechanism exists and soaks before it binds" — two prior hook-severity
 * mistakes plus a turn-end blast radius made default-on uninsurable in
 * their reading. Both are satisfied literally: the MASTER switch
 * (`hooks.turn_end_gate.enabled`) is default OFF, and WITHIN it both
 * detectors are default ON. A maintainer who opts in gets both without
 * further configuration; until then this concern is a no-op that costs one
 * settings read.
 *
 * CONTRACT: dispatcher-internal exit is 1 (EXIT_BLOCK) on a fire, 0
 * otherwise. `fail_closed: false` — deliberately. A crash in a turn-end
 * gate must resolve to "let the turn end", never to a wedge; promoting a
 * crash to a block is the outage this whole file is arranged to avoid.
 * Every unreadable input, missing transcript, absent pin, or malformed
 * state resolves to silence.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { load_agent_settings } from '../_lib/agent_settings.js';
import {
    classify,
    isSyntheticPrompt,
    STATE_FILE as LANGUAGE_STATE_FILE,
    type Verdict,
} from '../language_mirror_hook.js';
import { isSafeTranscriptPath } from './end_review_nudge_hook.js';
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import { atomic_write_json, is_replay_mode } from './state_io.js';

/** Dispatcher-internal block code. Pinned to 1 by `concern_block_exit_parity`. */
const EXIT_BLOCK = 1;
const EXIT_ALLOW = 0;

/** Detector identity, used in the state marker and the refusal text. */
export type DetectorId = 'promissory' | 'language';

export interface Finding {
    detector: DetectorId;
    /** The span that triggered it — quoted back so the refusal is actionable. */
    evidence: string;
    reason: string;
}

// ---------------------------------------------------------------------------
// Text extraction — what counts as "user-visible prose"
// ---------------------------------------------------------------------------

/**
 * Strip everything `language-and-tone` already exempts from the mirror
 * obligation: fenced code, inline code, block quotes (quoted tool output),
 * URLs, and bare paths/identifiers. What remains is the prose the rule
 * actually binds.
 *
 * Deliberately conservative — over-stripping costs a missed detection,
 * under-stripping costs a false refusal, and a blocking guard with a false
 * positive rate teaches users to bypass it.
 */
export function visibleProse(reply: string): string {
    let text = reply;
    // Fenced blocks, both ``` and ~~~ (markdown-safe-codeblocks ships both).
    //
    // CommonMark allows the CLOSING fence to be LONGER than the opener, so a
    // `\1` backreference does not match valid markdown. R2 finding 5 reproduced
    // the consequence: on a three-tilde block closed with four, pass 1 missed
    // and the greedy tail-drop below deleted the rest of the reply — including
    // the closing paragraph detector A exists to read. Match the fence
    // CHARACTER and require at least as many of it, per the spec.
    text = text.replace(
        /^[ \t]*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^[ \t]*(?:`{3,}|~{3,})[ \t]*$/gm,
        (block, opener: string) => {
            const ch = opener[0]!;
            // Only treat it as closed when the closer uses the SAME character
            // and is not shorter — otherwise leave it to the tail-drop.
            const closer = /(?:^|\n)[ \t]*([`~]{3,})[ \t]*$/.exec(block)?.[1] ?? '';
            return closer[0] === ch && closer.length >= opener.length ? ' ' : block;
        },
    );
    // A genuinely unterminated fence at the end of a reply — drop the tail.
    // Reached only when the pass above left the block intact.
    text = text.replace(/^[ \t]*(?:`{3,}|~{3,})[\s\S]*$/m, ' ');
    // Inline code.
    text = text.replace(/`[^`\n]*`/g, ' ');
    // Block quotes — the shape quoted tool output takes.
    text = text.replace(/^[ \t]*>.*$/gm, ' ');
    // Markdown tables — cells are frequently identifiers and paths.
    text = text.replace(/^[ \t]*\|.*\|[ \t]*$/gm, ' ');
    // URLs.
    text = text.replace(/\bhttps?:\/\/\S+/g, ' ');
    // Path-shaped and identifier-shaped tokens.
    text = text.replace(/\S*\/\S+/g, ' ');
    text = text.replace(/\b[\w.-]+\.(ts|js|md|json|ya?ml|py|php|txt|sh)\b/g, ' ');
    return text;
}

/** The final user-visible paragraph — where a promissory closing lives. */
export function finalParagraph(reply: string): string {
    const prose = visibleProse(reply).trim();
    if (!prose) return '';
    const paragraphs = prose
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);
    return paragraphs.length === 0 ? '' : paragraphs[paragraphs.length - 1]!;
}

// ---------------------------------------------------------------------------
// Detector A — promissory closing
// ---------------------------------------------------------------------------

/**
 * A commitment to work not yet performed. Both languages, because the
 * measured corpus is bilingual and a German-only list would have caught
 * roughly half of the 20.
 */
const PROMISSORY = [
    /\bich melde mich\b/i,
    /\bmelde ich (mich|dir|Dir)\b/i,
    /\bich melde\b/i,
    /\bich berichte\b/i,
    /\bich (sage|gebe) (dir |Dir )?Bescheid\b/i,
    /\bals n(ä|ae)chstes (werde|mache|baue|pr(ü|ue)fe) ich\b/i,
    // German puts the infinitive at the END of the clause ("ich werde jetzt
    // die Tests schreiben"), so the verb cannot be matched adjacent to
    // "werde" — it has to be looked for across the rest of the sentence.
    //
    // The lookahead excludes a stated REFUSAL to act: declining to do
    // something is not a promise to do it. R2 finding 4 reproduced four live
    // false refusals against the old `\bnicht\b`-only version — "Ich werde
    // nichts anfassen" (no word boundary after `nicht`), "keine Tests
    // schreiben", "niemals raten", and the passive non-promise "Ich werde
    // gefragt, ob …". Each was a false refusal on a BLOCKING guard, which is
    // the precision failure the council warning is about.
    /\bich werde\b(?![^.!?\n]*\b(?:nicht|nichts|kein(?:e|en|em|er|es)?|niemals|nie)\b)(?![^.!?\n]*\b(?:gefragt|gebeten|informiert|benachrichtigt)\b)[^.!?\n]*\b\w{3,}en\b/i,
    /\bI(?:'| wi)ll (report|let you know|update you|follow up)\b/i,
    /\bI(?:'| wi)ll (now |then )?\w+ (it|that|this|next)\b/i,
    /\bnext,? I(?:'| wi)ll\b/i,
    /\bI am going to\b/i,
];

/**
 * A legitimate hand-back is the opposite speech act: it gives the decision
 * to the user and ends the turn on purpose. `scope-control` requires
 * exactly this shape, so refusing it would put two rules in direct conflict.
 */
const HANDBACK = [
    /\bdas entscheidest (du|Du)\b/i,
    /\bdeine Entscheidung\b/i,
    /\bich fasse .{0,40}nicht ungefragt an\b/i,
    /\bsag (Bescheid|ein Wort)\b/i,
    /\bwarte auf (deine|Deine|dein|Dein)\b/i,
    /\byour call\b/i,
    /\byou decide\b/i,
    /\blet me know (which|if|whether)\b/i,
    /\bwaiting for your\b/i,
];

/**
 * Fires when the FINAL paragraph promises work, the turn hands nothing
 * back, and no question is put to the user. All three, because the
 * measured false-positive shapes are exactly the ones that fail one of them.
 */
export function detectPromissory(reply: string): Finding | null {
    const tail = finalParagraph(reply);
    if (!tail) return null;

    // A blocking question IS the stop condition — never refuse one.
    if (tail.includes('?')) return null;
    if (HANDBACK.some((re) => re.test(tail))) return null;

    for (const re of PROMISSORY) {
        const m = tail.match(re);
        if (m) {
            return {
                detector: 'promissory',
                evidence: m[0],
                reason:
                    'the closing paragraph promises work that has not been performed, ' +
                    'and the turn asks the user nothing — so nothing ends this turn but the promise itself',
            };
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Detector B — language mismatch
// ---------------------------------------------------------------------------

export interface LanguagePin {
    language: Verdict;
}

/** Read the pin the language-mirror hook wrote. Absent ⇒ no obligation. */
export function readLanguagePin(workspaceRoot: string): Verdict {
    try {
        const raw = fs.readFileSync(path.join(workspaceRoot, LANGUAGE_STATE_FILE), 'utf-8');
        const decoded: unknown = JSON.parse(raw);
        if (typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
            const lang = (decoded as Record<string, unknown>)['language'];
            if (lang === 'de' || lang === 'en') return lang;
        }
    } catch {
        // no pin, unreadable pin, malformed pin — all mean "no obligation"
    }
    return 'und';
}

/**
 * Fires only when the classifier is CONFIDENT the prose is the other
 * language. `classify` returns `und` below its marker floor, and `und`
 * never fires — a short reply is not evidence of drift.
 *
 * WHAT IS ACTUALLY CLASSIFIED, stated accurately because R2 finding 9 caught
 * this file claiming otherwise in three places. `visibleProse` strips code,
 * quotes, tables, URLs and paths from the whole reply — but `classify` then
 * applies `instructionText` (which drops output-shaped lines and their
 * followers) and `humanAuthoredLead`, and RETURNS ON THE LEAD ALONE when the
 * lead is determined. So in the common case the verdict comes from the reply's
 * opening chunk, not from all of it, and indented prose is discarded before
 * scoring.
 *
 * That is deliberately left as-is rather than swapped for a full-text scorer:
 * sharing one classifier with `language_mirror_hook` is what stops the pin and
 * the detector disagreeing about what language a turn is in, and changing the
 * scoring surface would change the measured rate, which needs its own
 * measurement rather than a quiet edit. What is fixed here is the CLAIM —
 * including the one this function used to put in its own refusal text, where an
 * inflated description of the evidence is worst.
 */
export function detectLanguage(reply: string, pinned: Verdict): Finding | null {
    if (pinned !== 'de' && pinned !== 'en') return null;
    const prose = visibleProse(reply);
    const verdict = classify(prose);
    if (verdict.language === 'und') return null;
    if (verdict.language === pinned) return null;
    return {
        detector: 'language',
        evidence: prose.trim().slice(0, 120),
        reason:
            `the pinned reply language is "${pinned}" but the reply classifies as ` +
            `"${verdict.language}" (${verdict.de_markers} de / ${verdict.en_markers} en markers; ` +
            'code, quotes, tables, URLs and paths excluded, then scored lead-first ' +
            'by the same classifier that sets the pin)',
    };
}

// ---------------------------------------------------------------------------
// Re-entrancy — the guard, keyed on the turn, not on the reply
// ---------------------------------------------------------------------------

function stateDir(workspaceRoot: string): string {
    return path.join(workspaceRoot, 'agents', 'runtime', 'state', 'turn-end-gate');
}

/**
 * ONE file per session, not one per refused turn. R2 finding 17: per-turn files
 * accumulated without bound and without a TTL, because "re-arms itself with no
 * cleanup" described the key rotating, not the files being removed.
 */
function sessionStateFile(workspaceRoot: string, sessionKey: string): string {
    return path.join(stateDir(workspaceRoot), `${sessionKey}.json`);
}

export function deriveSessionKey(sessionId: string): string {
    return crypto.createHash('sha256').update(sessionId).digest('hex').slice(0, 32);
}

/**
 * A turn's identity is its ORDINAL — how many genuine user prompts the
 * transcript has carried — never the prompt's text.
 *
 * R2 findings 2 and 3 killed the text-keyed version, in both directions:
 *
 *   · keying on sha256(session + last user text) made every REPEAT of a prompt
 *     collide with the earlier refused turn, so the second "weiter" / "ok" /
 *     "1" was allowed unconditionally. Repeated short continuations are the
 *     dominant prompt shape in the corpus this gate was built from, so the
 *     gate disabled itself exactly where it was needed;
 *   · taking the last user-role entry made the key drift WITHIN one turn,
 *     because a compaction summary and a `<system-reminder>` both arrive in the
 *     user role. A new key mid-turn re-arms the marker, which is the wedge
 *     layer 2 exists to prevent on hosts that send no `stop_hook_active`.
 *
 * An ordinal over `isSyntheticPrompt`-filtered entries fixes both at once: it
 * is distinct for every real turn regardless of what the user typed, and it
 * does not move when the harness injects a user-role entry.
 */
export function alreadyRefusedTurn(
    workspaceRoot: string,
    sessionKey: string,
    turnOrdinal: number,
): boolean {
    try {
        const raw = fs.readFileSync(sessionStateFile(workspaceRoot, sessionKey), 'utf-8');
        const decoded: unknown = JSON.parse(raw);
        if (typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
            return (decoded as Record<string, unknown>)['refused_turn'] === turnOrdinal;
        }
    } catch {
        // absent, unreadable, or malformed state means "not refused yet" —
        // fail-open, per this hook's contract.
    }
    return false;
}

function markRefusedTurn(
    workspaceRoot: string,
    sessionKey: string,
    turnOrdinal: number,
    detector: DetectorId,
): void {
    if (is_replay_mode()) return;
    try {
        atomic_write_json(sessionStateFile(workspaceRoot, sessionKey), {
            refused_at: new Date().toISOString(),
            refused_turn: turnOrdinal,
            detector,
        });
    } catch {
        // A state-write failure must never wedge the turn. Losing the marker
        // costs at most one extra refusal; failing closed here would cost the
        // session.
    }
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export interface TranscriptTail {
    lastAssistant: string;
    /**
     * How many GENUINE user prompts the transcript carries — harness-injected
     * user-role entries excluded via `isSyntheticPrompt`. This is the turn's
     * identity; see `alreadyRefusedTurn` for why the prompt's text is not.
     */
    turnOrdinal: number;
}

/**
 * The last assistant text, plus the turn ordinal, from a Claude JSONL
 * transcript. Mirrors `chat_history._extract_claude_transcript_response` for
 * the assistant half.
 *
 * `isSyntheticPrompt` is applied to every user-role entry — the same filter
 * `language_mirror_hook` uses, and for the same reason it was added there
 * (round-5 § 6.5): a background-task notification and a `<system-reminder>`
 * both occupy the user role without being chat messages. Counting them would
 * move the turn ordinal mid-turn, which is R2 finding 3.
 */
export function readTranscriptTail(
    transcriptPath: string,
    opts: { homeDir?: string; maxBytes?: number } = {},
): TranscriptTail {
    const empty: TranscriptTail = { lastAssistant: '', turnOrdinal: 0 };
    if (!transcriptPath || !isSafeTranscriptPath(transcriptPath, opts)) return empty;
    let lines: string[];
    try {
        lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
    } catch {
        return empty;
    }
    let lastAssistant = '';
    let turnOrdinal = 0;
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        let obj: unknown;
        try {
            obj = JSON.parse(line);
        } catch {
            continue;
        }
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) continue;
        const entry = obj as Record<string, unknown>;
        const role = entry['type'];
        if (role !== 'assistant' && role !== 'user') continue;
        const msg = entry['message'];
        if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) continue;
        const text = _messageText((msg as Record<string, unknown>)['content']);
        if (text === null) continue;
        if (role === 'assistant') {
            lastAssistant = text;
        } else if (!isSyntheticPrompt(text)) {
            turnOrdinal += 1;
        }
    }
    return { lastAssistant: lastAssistant.trim(), turnOrdinal };
}

function _messageText(content: unknown): string | null {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return null;
    const parts: string[] = [];
    for (const blk of content) {
        if (typeof blk !== 'object' || blk === null || Array.isArray(blk)) continue;
        const b = blk as Record<string, unknown>;
        if (b['type'] !== 'text') continue;
        const t = b['text'];
        if (typeof t === 'string') parts.push(t);
    }
    return parts.length > 0 ? parts.join('\n') : null;
}

// ---------------------------------------------------------------------------
// Settings — master OFF, detectors ON within it
// ---------------------------------------------------------------------------

export interface GateSettings {
    enabled: boolean;
    promissory: boolean;
    language: boolean;
}

/**
 * YAML spellings a human writes for "on". The `yaml` package parses to the 1.2
 * core schema, where `yes` is the STRING "yes" rather than a boolean — so a
 * maintainer who writes `enabled: yes` means it, and a reader that silently
 * treats it as off is the R2 finding-6b defect wearing a parser instead of a
 * regex. Anything not in this set is off; there is no truthiness guessing.
 */
function _isOn(v: unknown): boolean | null {
    if (typeof v === 'boolean') return v;
    if (typeof v !== 'string') return null;
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === 'yes' || s === 'on') return true;
    if (s === 'false' || s === 'no' || s === 'off') return false;
    return null;
}

/**
 * Read the three switches through the real settings cascade.
 *
 * The previous version hand-walked `<workspaceRoot>/.agent-settings.yml` for
 * speed, and R2 finding 6 found three defects in that trade: it ignored the
 * user-global layer entirely (so a maintainer who opts in globally got no gate
 * AND no diagnostic), its end-of-line-anchored regex read
 * `enabled: true  # soak opt-in` as FALSE, and it accepted a `turn_end_gate:`
 * block under ANY parent as ON because a text walker has no notion of a parent.
 *
 * The stated reason for skipping the cascade does not survive contact with the
 * sibling concerns: `delegation-nudge` calls `load_agent_settings` on
 * `user_prompt_submit`, i.e. every turn. Correctness on a gate that can refuse
 * a turn-end outranks one settings read per turn-end.
 */
export function readGateSettings(workspaceRoot: string): GateSettings {
    const off: GateSettings = { enabled: false, promissory: true, language: true };
    let settings: Record<string, unknown>;
    try {
        settings = load_agent_settings({ cwd: workspaceRoot }) as Record<string, unknown>;
    } catch {
        return off;
    }
    const hooks = settings['hooks'];
    if (typeof hooks !== 'object' || hooks === null || Array.isArray(hooks)) return off;
    const block = (hooks as Record<string, unknown>)['turn_end_gate'];
    if (typeof block !== 'object' || block === null || Array.isArray(block)) return off;
    const gate = block as Record<string, unknown>;
    const flag = (name: string, dflt: boolean): boolean => {
        const v = _isOn(gate[name]);
        return v === null ? dflt : v;
    };
    return {
        enabled: flag('enabled', false),
        promissory: flag('promissory', true),
        language: flag('language', true),
    };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

export function main(): number {
    let envelope: JsonObject;
    let payload: JsonObject;
    try {
        [envelope, payload] = unwrap(readHookStdin(), 'claude');
    } catch {
        return EXIT_ALLOW;
    }

    // Layer 1 — the host's own answer to "did I already refuse this turn?".
    if (payload['stop_hook_active'] === true) return EXIT_ALLOW;

    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined) || process.cwd();

    const settings = readGateSettings(workspaceRoot);
    if (!settings.enabled) return EXIT_ALLOW;

    const transcriptPath = str(
        (payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined,
    );
    // No override of the home-confinement check on the production path. R2
    // finding 13: the previous `AGENT_CONFIG_TRANSCRIPT_HOME` widened the one
    // security-relevant predicate in this hook, and an env var that relaxes a
    // path-confinement check IS a bypass of it, whatever the comment says. The
    // tests set `HOME` on the spawned process instead — `os.homedir()` honours
    // it — so the branch is still exercised with no product-code seam.
    const { lastAssistant, turnOrdinal } = readTranscriptTail(transcriptPath);
    if (!lastAssistant) return EXIT_ALLOW;

    // Layer 2 — keyed on the turn's ORDINAL, never on the prompt's text.
    const sessionKey = deriveSessionKey(
        str(envelope['session_id'] as JsonValue | undefined) || 'unknown-session',
    );
    if (alreadyRefusedTurn(workspaceRoot, sessionKey, turnOrdinal)) return EXIT_ALLOW;

    const findings: Finding[] = [];
    if (settings.promissory) {
        const f = detectPromissory(lastAssistant);
        if (f) findings.push(f);
    }
    if (settings.language) {
        const f = detectLanguage(lastAssistant, readLanguagePin(workspaceRoot));
        if (f) findings.push(f);
    }
    if (findings.length === 0) return EXIT_ALLOW;

    markRefusedTurn(workspaceRoot, sessionKey, turnOrdinal, findings[0]!.detector);

    const lines = findings.map(
        (f) => `  · ${f.detector}: ${f.reason}\n    evidence: ${JSON.stringify(f.evidence)}`,
    );
    process.stderr.write(
        `turn-end-gate: REFUSED — this turn is not finished.\n${lines.join('\n')}\n` +
            '  Do the promised work now, or correct the language, then end the turn.\n' +
            '  This turn will not be refused a second time.\n' +
            '  Disable: hooks.turn_end_gate.enabled: false in .agent-settings.yml\n',
    );
    return EXIT_BLOCK;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
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
