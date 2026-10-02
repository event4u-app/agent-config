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
 * FIVE detectors ride on one guard, because building the unsafe part twice
 * is how a second detector becomes a second outage:
 *
 *   A — promissory closing  (FC-5, 20 measured occurrences)
 *   B — language mismatch   (19 measured occurrences, fresh pin present)
 *   C — unverified edit     (the turn changed a file and ran nothing that could
 *                            have checked it — verify-before-complete's gate,
 *                            read off the turn's TOOL CALLS rather than its
 *                            prose, which is why `readTranscriptTail` collects
 *                            them: `_messageText` keeps `type === 'text'` blocks
 *                            only, so tool activity is invisible to A and B.)
 *   D — completion claim    (a claim of done carrying no fresh evidence; landed
 *                            under conformance round 7 § Phase 1.)
 *   E — pending decision    (an earlier reply in the SAME user turn put numbered
 *                            options to the user and the closing reply carries
 *                            none — the turn asked and then dropped the ask.
 *                            Read off `assistantTurnTexts`, which is why that
 *                            field exists: every other detector reads
 *                            `lastAssistant` alone and therefore cannot see a
 *                            question that was asked one reply earlier.)
 *
 * TWO of the five are CONDITIONAL, and saying "unconditional" here would be the
 * same stale-header defect this block corrects below. A and D are the
 * completion-adjacent pair an open subagent dispatch excuses, so `runDetectors()`
 * runs them only when `dispatchOpen` is false; B, C and E run on every turn-end.
 * That narrowing is deliberate (Phase 3 Step 2, narrowed again by R2 round 2) and
 * is the third allow path, alongside the two re-entrancy layers — see the
 * per-detector list in `runDetectors()`.
 *
 * This block said "Three" and listed A/B/C until 2026-08-18, while `DetectorId`
 * below has carried four since round 7. `DETECTOR_IDS` in
 * `_lib/turn_end_refusals.ts` is read off that union rather than off this
 * comment for exactly that reason, and the count is corrected here rather than
 * left as a stale header the next reader has to disbelieve. E made it five.
 *
 * ## Removal condition
 *
 * This is a BLOCKING concern, so it owes one — see
 * `docs/contracts/turn-end-detector-demotion.md` for the pre-registered
 * per-detector bars, their sample floors, and the reason a crossed bar
 * authorises a staged study rather than a demotion. Two things that contract
 * says about the guard below are worth meeting here: the re-entrancy layers cap
 * a turn at ONE refusal, which makes a re-refusal share unobservable and the
 * three-strikes non-termination valve unreachable. Both are properties of this
 * design, not gaps in the counters.
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
 *   2. A per-session state file holding the ORDINAL of the last refused turn —
 *      never the prompt's text, and never the reply. One file per session, not
 *      one per refused turn.
 *
 *      The first version keyed on sha256(session_id + last user text) with a
 *      file per turn, and R2 found that wrong in three directions at once: a
 *      REPEATED prompt ("weiter", "ok", "1") collided with the earlier refused
 *      turn and was allowed unconditionally; the key drifted WITHIN a turn
 *      because a compaction summary, a `<system-reminder>` and a sidechain
 *      prompt all arrive in the user role; and the files accumulated with no
 *      TTL. The ordinal — a count of `isSyntheticPrompt`-filtered,
 *      non-sidechain user entries — is distinct for every real turn whatever
 *      the user typed, and stable across harness injections.
 *
 *      No longer true, and corrected here rather than left as a stale admission:
 *      the files ARE pruned. `road-to-stop-gate-honesty` step 1.2 added a
 *      90-day retention (`pruneAgedRefusalState`), run at `session_start` by the
 *      session-register concern. The record also COUNTS now instead of
 *      overwriting itself — see `markRefusedTurn`.
 *
 * The failure this ordering prevents is not a loop but a wedge: a turn that
 * can never end. Layer 2 also covers the host that does not send
 * `stop_hook_active` at all — with one honest limit: a host that sends no
 * `session_id` either falls into a shared bucket where an unrelated session's
 * matching ordinal reads as already-refused, so on such a host layer 2
 * degrades to "may under-refuse" and layer 1 is the real guard.
 *
 * ## Always armed — the switch was removed, and why
 *
 * This gate shipped behind `hooks.turn_end_gate.enabled`, default OFF, on the
 * council's round-6 reading: "the mechanism exists and soaks before it binds."
 * The maintainer removed the switch on 2026-08-12, and the decisive argument
 * was that the soak the switch was protecting could never happen — a concern
 * that is off does not run, so "merged in its own PR with its own soak period"
 * (the second condition of `blocker: stop-refusal-decision`) was unsatisfiable
 * for as long as the condition's own mechanism stayed disabled. A default-off
 * safety gate is not a soaking gate; it is an absent one.
 *
 * What replaces the switch is not "always refuse". It is the detectors' own
 * trigger conditions, which is where the judgement belonged in the first
 * place: A fires only on a closing paragraph that promises work, B only when a
 * language pin exists AND the reply misses it, C only when the turn edited a
 * file and then ran nothing. Silence is the default on every ordinary turn.
 * `delegation-nudge` is the sibling precedent — no structural signal, no
 * output at all.
 *
 * The cost of removing the switch, stated once because it is real: a
 * false-positive detector can no longer be turned off by configuration, only
 * by a revert. That is bounded rather than open-ended — the two re-entrancy
 * layers below cap a misfire at ONE extra turn, never a wedge — and it is the
 * reason a new detector ships only with a measured false-positive corpus.
 *
 * MEASURE IT ON YOUR OWN CORPUS, and the instruction moved here on purpose:
 * it used to live in the settings description that this change deleted, and
 * `src/config/pack-size-budget.json` cites that description as the reason
 * `measure_turn_end_gate.ts` is shipped rather than excluded from the pack. So
 * the pointer is restated rather than dropped —
 * `./scripts-run src/scripts/measure_turn_end_gate --store <transcript dir>`
 * re-derives each detector's fire rate against your own transcripts. No rate is
 * quoted in this file: the round-5 number moved twice while the instrument
 * itself was being corrected, and a fixed figure in a shipped comment would be
 * a moving target presented as a constant.
 *
 * CONTRACT: dispatcher-internal exit is 1 (EXIT_BLOCK) on a fire, 0
 * otherwise. `fail_closed: false` — deliberately. A crash in a turn-end
 * gate must resolve to "let the turn end", never to a wedge; promoting a
 * crash to a block is the outage this whole file is arranged to avoid.
 * Every unreadable input, missing transcript, absent pin, or malformed
 * state resolves to silence.
 *
 * The severity mapping was re-probed when C landed, because
 * `dispatch_hook.ts` defines `EXIT_WARN = 2` beside `EXIT_BLOCK = 1` and an
 * advisory finding delivered on the wrong code becomes a hard deny. Result:
 * this file emits ONLY 0 and 1 internally, `concern_block_exit_parity` pins the
 * 1, and the dispatcher translates a stop-slot block to host exit **2** —
 * which a spawned test in `turn_end_gate_hook.test.ts` asserts, because on the
 * stop slot exit 1 would let the turn end anyway. C is a refusal like A and B,
 * not an advisory, so there is no advisory path here to put on the wrong code.
 * Probed, not assumed.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    classify,
    hasStableSessionId,
    statePathFor as languageStatePathFor,
    type Verdict,
} from '../language_mirror_hook.js';
// Round 7 § Phase 1 — the CI-settle producer. Imported for its path BUILDER, not
// for a path constant: "the consumer cannot read a path the producer does not
// write" is only true while the two agree, and importing a constant made that
// agreement invisible when the producer's layout moved. A builder makes the move
// a type error.
import {
    statePathFor as ciStatePathFor,
    readTurnRunState,
    type TurnRunState,
} from '../before_complete_hook.js';
// Re-exported: two test files address `readTurnRunState` at this path, and a
// reader arriving at detector C should find the reader where the detector uses
// it. The DEFINITION lives with the producer of the shape it reads.
export { readTurnRunState };
// The spec-backed options-block reading, imported rather than re-derived:
// `user-interaction` Iron Law 1's definition of an ask — a block PLUS its
// recommendation line — lives in exactly one place and detector E reads it from
// there.
//
// WHAT KEEPS IT FROM RUNNING ON IMPORT, stated precisely because the obvious
// answer is wrong: that module is `_isCliEntry`-guarded, but WITHOUT the
// `__AGENT_CONFIG_BUNDLE__` early-out this file carries. Inside
// `dist/hooks/dispatch.js` every module shares one `import.meta.url`, so the
// guard alone would not settle it; what does is the `.__direct__` argv rewrite
// in the `build:hooks` banner. Named here so a future change to that banner
// does not silently start running a lint's `main()` on every hook dispatch.
// Detector E, extracted to `_lib` where its prose costs no ratchet debt.
// Re-exported so every existing importer of this module is unchanged.
import { detectDroppedDecision } from '../_lib/dropped_decision.js';
// Step 3.2 of `road-to-a-graph-that-feeds-the-gate` — the shadow feeder. It
// lives in `_lib` for the reason every other extraction here does: this file
// sits against a 1,500-line shrink-only source budget, and the module it would
// otherwise grow into is one a recall reading has to be able to open on its own.
import {
    appendFeederRow,
    buildFeederRow,
    type FeederLayer,
    graphUntestedVerdict,
} from '../_lib/graph_feeder_record.js';
import { type GraphState, graphState } from '../code_graph/detect.js';
import { isVerificationCommand } from '../_lib/verification_command.js';
// Round 8 — the record path detector C prefers over its own regex. The regex
// reads a command's TEXT and `echo test` matches it; these read what the run
// exited with and what it printed.
import {
    NO_RED_EVIDENCE_REASON,
    describeRecordFinding as recordReason,
    hasRedThenGreen,
    readRunEvidence,
} from '../_lib/verification_evidence.js';

export { detectDroppedDecision };
import { unwrap, type JsonObject, type JsonValue } from './envelope.js';
import { readHookStdin } from './hook_stdin.js';
import {
    atomic_write_json,
    is_replay_mode,
    owns_session_state as ownsSessionState,
} from './state_io.js';
import { openRecordStats } from './subagent_ledger_hook.js';
import {
    deriveSessionKey,
    foldRefusal,
    foldShadow,
    parseRecord,
    parseShadowRecord,
    readInstallBoundary,
    sessionRefusalFile,
    sessionShadowFile,
    type RefusalRecord,
    type ShadowLayer,
    type ShadowRecord,
} from '../_lib/turn_end_refusals.js';
import { EXIT_ALLOW, EXIT_BLOCK } from './exit_codes.js';

/** Dispatcher-internal block code. Pinned to 1 by `concern_block_exit_parity`. */

/**
 * Transcript-read ceiling for this hook, passed at its one production call
 * site, `assembleDetectorInputs()`.
 * Deliberately well under `isSafeTranscriptPath`'s own 50 MB refusal: the
 * ordinal is a count over every entry, so the whole file is walked once per
 * turn-end, and a session file grows for the life of the session. Past this the
 * gate lets the turn end rather than pay an unbounded read — fail-open, like
 * every other unreadable-transcript case here.
 */
export const TRANSCRIPT_READ_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/** Detector identity, used in the state marker and the refusal text. */
export type DetectorId =
    | 'promissory'
    | 'language'
    | 'verification'
    | 'completion'
    | 'pending-decision'
    | 'untested';

export interface Finding {
    detector: DetectorId;
    /** The span that triggered it — quoted back so the refusal is actionable. */
    evidence: string;
    reason: string;
    /**
     * Which evidence path produced this finding, where a detector has two.
     *
     * Detectors C and F set it — the sentence here read "Only detector C" while
     * F set it two functions below, which an independent review caught.
     * `record` means a persisted run record was read;
     * `transcript` means the recorder left nothing for this turn and the
     * command-text scan answered instead — the mode a replay through
     * `measure_turn_end_gate` / `check_detector_corpus` always runs in, so a
     * corpus reading stays reproducible after the record path landed.
     */
    mode?: 'record' | 'transcript';
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
/**
 * Remove fenced code blocks, line by line, tracking open/close state.
 *
 * This is deliberately NOT a regex, and the reason is a measured regression.
 * Two regex attempts each dropped a reply's whole tail on a different valid
 * shape: a `\1` backreference misses CommonMark's longer closing fence (R2
 * round 1, finding 5), and the character-matching replacement that fixed THAT
 * stopped at the first closer-shaped line — so on a `~~~` block containing a
 * ``` block, the inner line was taken for the closer, the replacer declined it
 * on the character mismatch, and the greedy tail-drop then deleted everything
 * from the opener onward (R2 round 2, finding 1). That mixed-character nesting
 * is the shape `markdown-safe-codeblocks` prescribes as its DEFAULT, so the
 * second attempt was worse than the first on the more common input.
 *
 * A scanner has the state a regex lacks. CommonMark, applied here:
 *   · an opener may carry an info string; a closer may not;
 *   · only a fence of the SAME character and at least the opener's length
 *     closes the block — anything else inside it is content;
 *   · an unterminated opener runs to end of input, so a truncated reply loses
 *     its tail, which is the correct reading of a truncated reply.
 */
export function stripFencedBlocks(text: string): string {
    const out: string[] = [];
    let open: { ch: string; len: number } | null = null;
    for (const line of text.split('\n')) {
        const m = /^[ \t]{0,3}([`~]{3,})(.*)$/.exec(line);
        if (open === null) {
            if (m) {
                open = { ch: m[1]![0]!, len: m[1]!.length };
                out.push(' ');
                continue;
            }
            out.push(line);
            continue;
        }
        if (
            m &&
            m[1]![0] === open.ch &&
            m[1]!.length >= open.len &&
            (m[2] ?? '').trim() === ''
        ) {
            open = null;
        }
        // Everything between opener and closer is dropped, closer included.
    }
    return out.join('\n');
}

export function visibleProse(reply: string): string {
    let text = stripFencedBlocks(reply);
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
    // `\p{L}` with the `u` flag, NOT `\w`: R2 round 2, finding 15 verified that
    // `\b\w{3,}en\b` cannot reach an infinitive whose post-umlaut fragment is
    // short, because `ü`/`ö`/`ä` are not `\w` and create a word boundary — so
    // "prüfen" and "lösen" were silent while the comment above claimed the
    // verb-final construction was handled.
    //
    // Honest about what this proxy matches: any word of 3+ letters ending in
    // "en" within the clause, which is the infinitive in practice but also hits
    // a plural noun ("die Zeilen zählen" matches on "Zeilen"). That is
    // acceptable here — the clause already requires "ich werde" and excludes
    // negations and passives, so a forward commitment is what remains — but it
    // is a proxy for the infinitive, not a parse of one.
    /\bich werde\b(?![^.!?\n]*\b(?:nicht|nichts|kein(?:e|en|em|er|es)?|niemals|nie)\b)(?![^.!?\n]*\b(?:gefragt|gebeten|informiert|benachrichtigt)\b)[^.!?\n]*(?<!\p{L})\p{L}{3,}en(?!\p{L})/iu,
    /\bI(?:'| wi)ll (report|let you know|update you|follow up)\b/i,
    /\bI(?:'| wi)ll (now |then )?\w+ (it|that|this|next)\b/i,
    /\bnext,? I(?:'| wi)ll\b/i,
    /\bI am going to\b/i,
];

/**
 * A legitimate hand-back is the opposite speech act: it gives the decision
 * to the user and ends the turn on purpose. `scope-control` requires
 * exactly this shape, so refusing it would put two rules in direct conflict.
 *
 * EXPORTED because `interruption_ledger_hook` classifies the same shape as a
 * synchronous contact. Narrowing this list therefore changes a measurement as
 * well as a refusal — check that hook before you touch it.
 */
export const HANDBACK = [
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

    // A blocking question IS the stop condition — never refuse one. But only a
    // question that ENDS the paragraph is that: R2 round 2, finding 16 called
    // `includes('?')` a one-character, trivially learnable bypass, since a
    // rhetorical or quoted question anywhere alongside a promise disabled a
    // blocking guard. The hand-back list below still covers the phrasings that
    // yield without a question mark.
    if (/\?["'’)\]]*\s*$/.test(tail)) return null;
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

/**
 * Round 7 § Phase 1 — where the CI-settle fact comes from, and why not from here.
 *
 * The obvious implementation reads the unsettled state out of the transcript this
 * hook already parses. It cannot: `_toolCalls` keeps only name, command and target
 * path, so a tool RESULT — where the pending count lives — is never read; and
 * `toolCalls` is reset at every genuine user prompt by design, while the measured
 * failure is a completion claim in a LATER turn than the poll. Building it that way
 * meant reversing an invariant this file argues for two functions down.
 *
 * So the producer is `before_complete_hook`, which already sees tool output on
 * `post_tool_use` and already owns the `pendingCount` predicate. It writes
 * `ci_last` into its own per-session state file under
 * `agents/state/verify-before-complete/` and this reads it — via the producer's
 * `statePathFor`, never a path literal, so the next move of that layout is a
 * compile error instead of a detector that silently reads nothing. (That is not
 * hypothetical: the sibling language pin moved exactly this way and its
 * consumer here kept importing the abandoned constant, which turned a blocking
 * detector off without a single failing test.)
 *
 * KEYED ON `session_id`, because the CI witness is a fact about ONE run.
 * A no-id envelope reads as "no CI observed" — the producer persists nothing in
 * that case, and the refusal direction that follows is the safe one.
 *
 * NO network call, deliberately. Asking `gh pr checks` here would put a network
 * round-trip on every turn-end; `road-to-hook-latency-repair` exists because that
 * cost is real. The rejected alternative is named so the next author does not
 * re-derive it.
 *
 * ASYMMETRY that makes the cross-turn read legitimate where the reader refuses it
 * for verification: a stale POSITIVE ("I verified") wrongly vouches for work it
 * never saw. A stale NEGATIVE ("CI was not settled") only ever refuses more often.
 * Same freshness invariant, opposite failure direction.
 */
export function readCiSettled(
    workspaceRoot: string,
    session_id: string,
): { seen: boolean; settled: boolean } {
    if (!hasStableSessionId(session_id)) return { seen: false, settled: false };
    try {
        const raw = fs.readFileSync(path.join(workspaceRoot, ciStatePathFor(session_id)), 'utf-8');
        const decoded: unknown = JSON.parse(raw);
        // Same ownership check as the pin, and here it is the sharper of the two:
        // a FOREIGN `ci_last: {settled: true}` vouches for a CI run this session
        // never made, which is exactly the premature completion claim detector D
        // exists to refuse. Refusing an unowned file returns "no CI observed",
        // which never refuses a session for someone else's run.
        if (!ownsSessionState(decoded, session_id)) return { seen: false, settled: false };
        if (typeof decoded === 'object' && decoded !== null && !Array.isArray(decoded)) {
            const ci = (decoded as Record<string, unknown>)['ci_last'];
            if (typeof ci === 'object' && ci !== null && !Array.isArray(ci)) {
                return { seen: true, settled: (ci as Record<string, unknown>)['settled'] === true };
            }
        }
    } catch {
        // absent, unreadable, or malformed — all mean "no CI was observed", and a
        // session that never polled CI must never be refused for it.
    }
    return { seen: false, settled: false };
}


/**
 * A completion claim in the delivered reply. Deliberately narrow: the German and
 * English closings the corpus actually produced, anchored to a line so a mid-reply
 * "fertig" inside a sentence about something else does not fire.
 *
 * Measured shapes it must catch (round 7, § Phase 1): "Fertig, Matze." ·
 * "Damit ist alles erledigt." · "Aufgabe erledigt." · "der komplette Auftrag ist
 * durch".
 */
const _COMPLETION_RE =
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
const _NEGATED_CLAIM_RE =
    /\b(noch nicht|nicht fertig|nicht durch|wäre verfrüht|ist verfrüht|not yet|not done|isn'?t done|nein)\b/i;

/** The line `at` falls on — the scope a negation has to appear in to count. */
function _lineAround(prose: string, at: number): string {
    const start = prose.lastIndexOf('\n', at) + 1;
    const end = prose.indexOf('\n', at);
    return prose.slice(start, end === -1 ? prose.length : end);
}

export function detectCompletionClaim(
    reply: string,
    ci: { seen: boolean; settled: boolean },
): Finding | null {
    // A session that never read CI has nothing to be premature about.
    if (!ci.seen || ci.settled) return null;
    const prose = visibleProse(reply);
    const m = _COMPLETION_RE.exec(prose);
    if (!m) return null;
    const at = m.index;
    // The trigger fired, but the line it fired on negates it — a status report,
    // not a claim. Refusing these punishes exactly the honesty the gate wants.
    if (_NEGATED_CLAIM_RE.test(_lineAround(prose, at))) return null;
    return {
        detector: 'completion',
        evidence: prose.slice(at, at + 120).trim(),
        reason:
            'a completion claim while the last CI read was not settled — ' +
            'read the verdict, then claim it (verify-before-complete)',
    };
}

/**
 * Read the pin the language-mirror hook wrote. Absent ⇒ no obligation.
 *
 * (R2 finding 8: this line was left 73 lines above, where inserting `readCiSettled`
 * had stranded it — so it documented the wrong function and this one had none.)
 *
 * KEYED ON `session_id`, because the producer is. The import above says
 * "imported for its STATE_FILE only, so the consumer cannot read a path the
 * producer does not write" — and that discipline failed the moment the producer
 * MOVED: `language_mirror_hook` split its state per session
 * (`agents/state/language-mirror/<digest>.json`) and `_pruneLegacyState` now
 * deletes the single file this function used to read. Importing the old symbol
 * still compiled, so nothing broke loudly: `readLanguagePin` returned `und` for
 * every turn, `detectLanguage` returned `null` for every turn, and detector B of
 * a blocking gate stopped checking anything. Importing the path-BUILDER instead
 * of a path constant is what makes the next such move a type error rather than a
 * silent dead detector.
 *
 * NO LEGACY FALLBACK, deliberately. Reading `STATE_FILE` when the per-session
 * file is absent would restore exactly the cross-session read the split closed:
 * that file is shared by every session under one project root, so a neighbouring
 * English session's pin would become this German session's obligation. A missing
 * pin is the safe answer; a foreign pin is the defect.
 *
 * No stable id ⇒ `und`. The producer runs stateless in that case and persists
 * nothing, so there is no pin to read — not "no obligation by accident", but the
 * same degradation the producer documents, in the same direction (under-refuse).
 */
export function readLanguagePin(workspaceRoot: string, session_id: string): Verdict {
    if (!hasStableSessionId(session_id)) return 'und';
    try {
        const raw = fs.readFileSync(
            path.join(workspaceRoot, languageStatePathFor(session_id)),
            'utf-8',
        );
        const decoded: unknown = JSON.parse(raw);
        // The digest path is not the whole guarantee — see `owns_session_state`.
        // A file that reached this pathname by a copy, a restore, or a buggy
        // writer still carries its real owner, and consuming it hands one
        // session's pin to another. Refusing it costs a turn's obligation;
        // accepting it is the cross-session read the split closed.
        if (!ownsSessionState(decoded, session_id)) return 'und';
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
 * applies `stripInjectedRegions` (which removes balanced host wrapper regions
 * such as `<launch-selected-element>`, plus the host's advisory sentence beside
 * them), then `instructionText` (which drops output-shaped lines and their
 * followers) and `humanAuthoredLead`, and RETURNS ON THE LEAD ALONE when the
 * lead is determined. So in the common case the verdict comes from the reply's
 * opening chunk, not from all of it, and indented prose is discarded before
 * scoring.
 *
 * The region strip reaches this path too, and its effect here is small by
 * construction: `visibleProse` has already removed fenced code, so a balanced
 * bare-tag pair surviving into the scorer is prose the reply wrote around a tag
 * rather than markup. Named rather than omitted, because enumerating the
 * scoring surface accurately is this comment's entire job.
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
// Detector 3 — an edit the turn never verified
// ---------------------------------------------------------------------------

/** Tools that CHANGE the tree. The three write tools, nothing inferred. */
const _EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

/**
 * Re-exported, not re-derived: the selector moved to `_lib/verification_command.ts`
 * so the evidence classifier can read it without a hook<->lib import cycle.
 *
 * The name stays exported HERE because two test files pin it at this path and
 * because a reader arriving at detector C should find the selector where the
 * detector uses it, not have to know it was relocated.
 */
export { isVerificationCommand };

/**
 * Fire when the turn changed a file and then ran nothing that could have
 * checked it.
 *
 * The window is "after the LAST edit", not "anywhere in the turn": a test run
 * before the final edit demonstrably did not exercise it, which is the same
 * freshness argument `verify-before-complete` makes about trusting an earlier
 * run ("no verification command run in this message → you cannot claim it
 * passes"). Ordering is the only thing that distinguishes the two, so the
 * detector reads the sequence rather than a pair of counts.
 *
 * Silent when the turn edited nothing — a read-only or conversational turn has
 * no claim to verify, and refusing one would make the gate fire on the majority
 * of turns, which is how a guard gets disabled.
 */
export function detectUnverifiedEdit(
    toolCalls: readonly ToolCall[],
    runState: TurnRunState | null = null,
): Finding | null {
    let lastEdit = -1;
    for (let i = 0; i < toolCalls.length; i += 1) {
        if (_EDIT_TOOLS.has(toolCalls[i]!.name)) lastEdit = i;
    }
    if (lastEdit === -1) return null;
    const edited = toolCalls[lastEdit]!.path ?? toolCalls[lastEdit]!.name;

    // THE RECORD PATH. Preferred whenever the recorder demonstrably witnessed
    // this turn — see `readTurnRunState`, which returns null otherwise. The
    // regex path below stays reachable and is not deprecated: it is the only
    // path a transcript replay has, and it is what a host that binds no
    // `post_tool_use` slot keeps.
    if (runState !== null) {
        const reading = readRunEvidence(runState);
        if (reading.passed) return null;
        // An instrument gap is never refused on (Risk 1 of the plan): the host
        // surfaced no exit code, or wrote a record nothing can place, and
        // neither is a fact about the operator's work. The transcript answer
        // stands in, which is exactly the behavior before this path existed.
        if (!reading.instrumentGap) {
            return {
                detector: 'verification',
                evidence: edited,
                reason: recordReason(reading.failed, reading.reasons),
                mode: 'record',
            };
        }
    }

    for (let i = lastEdit + 1; i < toolCalls.length; i += 1) {
        const c = toolCalls[i]!;
        if (c.name === 'Bash' && c.command !== undefined && isVerificationCommand(c.command)) {
            return null;
        }
    }
    return {
        detector: 'verification',
        // The path, never the diff: the evidence span is quoted into a refusal,
        // and `ToolCall` is shaped so a file body cannot reach it.
        evidence: edited,
        reason:
            'this turn changed a file and then ran no verification command — ' +
            'no test, type-check, lint or build call follows the last edit ' +
            '(verify-before-complete: a claim without a fresh run is unverified)',
        mode: 'transcript',
    };
}

// ---------------------------------------------------------------------------
// Detector F — a completion claim over production code no test accompanies
// ---------------------------------------------------------------------------

/**
 * WHY THIS EXISTS, and why detector C did not already cover it.
 *
 * Detector C asks "did ANY verification command run after the last edit". It is
 * satisfied by `eslint`. That is deliberate — see `isVerificationCommand`, which
 * is narrow about what counts as a command and says nothing about what the
 * command COVERS. So a turn can write four hundred lines of feature code, run
 * the linter, claim done, and pass every guard in this file.
 *
 * Measured consequence, reported by the maintainer 2026-09-11 about a consumer
 * project: a feature shipped whose detail view crashed on open, whose flyouts
 * were broken, and for which the maintainer then had to hand-enumerate what
 * should have been exercised — every view, every CRUD path, drag-and-drop,
 * mobile, filters. Their words: *"Solche Fehler können nur auftreten, weil Du
 * nicht TDD gearbeitet ... hast."* Nothing in the suite refused that turn,
 * because nothing in the suite asks whether the change is TESTED — only whether
 * something ran.
 *
 * THE SIGNAL, and why it is this one. "Is the change covered" is undecidable
 * from a transcript: coverage lives in the consumer's tooling, which this hook
 * cannot run. What IS decidable is the cheapest possible proxy, and it happens
 * to be the exact shape of the reported failure — **production source changed,
 * no test file touched, done claimed**. A proxy is worth shipping here precisely
 * because the population it flags is small and the failure it catches is total:
 * a feature with zero new test lines is not under-tested, it is untested.
 *
 * WHY IT IS GATED ON THE CLAIM rather than on the edit. Firing on every edit
 * would refuse the first turn of every red-green-refactor cycle — the discipline
 * it exists to encourage — and a guard that fires on the majority of turns is a
 * guard that gets switched off. The obligation belongs to the CLAIM, which is
 * also where `verify-before-complete` puts it and where detector D already sits.
 *
 * WHAT IT CANNOT DO. It cannot tell a good test from a token one: a turn that
 * touches any test file clears it. That is a deliberate floor rather than an
 * oversight — `testing-anti-patterns` owns assertion quality, and a guard that
 * tried to judge it from a path would be judging something it cannot see. The
 * honest claim is narrow: this refuses the case where the agent wrote NO test at
 * all and said it was finished.
 */

/** Extensions that carry behaviour a test can be owed for. */
const _SOURCE_RE = /\.(?:ts|tsx|js|jsx|mjs|cjs|vue|svelte|php|py|rb|go|rs|java|kt|swift|cs|scala|ex|exs)$/i;

/**
 * Paths that ARE tests, across the conventions this suite's stacks use.
 *
 * Deliberately generous: a false NEGATIVE here (calling a test file a test) only
 * silences the detector, while a false positive would refuse a turn that did
 * write its tests — the direction that gets a guard disabled.
 */
const _TEST_PATH_RE =
    /(?:^|\/)(?:tests?|specs?|__tests__|__specs__|e2e|cypress|playwright|features)\//i;
const _TEST_FILE_RE =
    /(?:\.(?:test|spec)\.[a-z]+$)|(?:_test\.[a-z]+$)|(?:(?:^|\/)test_[^/]+$)|(?:Test\.php$)|(?:Spec\.php$)|(?:\.feature$)/i;

function _isTestPath(p: string): boolean {
    return _TEST_PATH_RE.test(p) || _TEST_FILE_RE.test(p);
}

function _isProductionSource(p: string): boolean {
    return _SOURCE_RE.test(p) && !_isTestPath(p);
}

/**
 * Fire when the turn changed production code, touched no test, and said done.
 *
 * All three conditions are load-bearing. Drop the first and it fires on a docs
 * turn; drop the second and it fires on a turn that did its job; drop the third
 * and it fires mid-cycle on the red step of red-green-refactor.
 */
export function detectUntestedChange(
    reply: string,
    toolCalls: readonly ToolCall[],
    runState: TurnRunState | null = null,
): Finding | null {
    const edited = toolCalls
        .filter((c) => _EDIT_TOOLS.has(c.name) && c.path !== undefined)
        .map((c) => c.path as string);
    const source = edited.filter(_isProductionSource);
    if (source.length === 0) return null;

    // THE TEST-FILE ESCAPE, and why step 5.1 narrowed it rather than removed it.
    //
    // "A test file was touched somewhere in the turn" is satisfied by a file
    // containing `it('works', () => expect(true).toBe(true))`. A test never seen
    // red has unknown sensitivity — it may assert nothing the change could
    // break — so the escape as written accepted the shape of evidence instead of
    // evidence.
    //
    // With records available, the escape asks for the cheapest observable proof
    // that the assertion discriminates: the same target red, then green after
    // the last edit. Without records it stays exactly as it was, because the
    // transcript cannot see an exit code and a detector that refused on a
    // transcript-only host would refuse every honest turn there.
    // A NEW test file, not any test edit. Step 5.1 says "accepts a NEW test file
    // only with that pair present", and `edited.some(_isTestPath)` is any
    // test-path edit — so adjusting an assertion in an existing test alongside a
    // production change and running it green once was refused. New-vs-existing
    // is not decidable from a transcript; `Write` on a test path is the usable
    // proxy, because `Edit` and `MultiEdit` presuppose a file that already
    // existed. Narrowing here can only ALLOW turns the previous line refused.
    const wroteNewTest = toolCalls.some(
        (c) => c.name === 'Write' && c.path !== undefined && _isTestPath(c.path),
    );
    let noRedEvidence = false;
    if (edited.some(_isTestPath)) {
        // An EXISTING test adjusted alongside a production change keeps the old
        // escape untouched — `Edit` and `MultiEdit` presuppose a file that was
        // already there, so nothing new was claimed and there is no new
        // assertion whose sensitivity is unknown.
        if (!wroteNewTest) return null;
        if (runState === null) return null;
        if (hasRedThenGreen(runState)) return null;
        // An instrument gap is not a missing red. Same rule as detector C: the
        // host surfaced no exit code, so nothing about the operator's work is
        // known, and the pre-record behavior stands in.
        if (readRunEvidence(runState).instrumentGap) return null;
        noRedEvidence = true;
    }

    // The claim gate, reusing detector D's pair rather than a second dialect of
    // "done" — two lists of completion phrasings would drift, and the negation
    // check is what keeps an honest "noch nicht fertig" from being refused.
    const prose = visibleProse(reply);
    const m = _COMPLETION_RE.exec(prose);
    if (!m) return null;
    if (_NEGATED_CLAIM_RE.test(_lineAround(prose, m.index))) return null;

    const shown = source.slice(0, 3).join(', ');
    if (noRedEvidence) {
        return {
            detector: 'untested',
            evidence: shown + (source.length > 3 ? ` (+${String(source.length - 3)} more)` : ''),
            mode: 'record',
            reason: NO_RED_EVIDENCE_REASON,
        };
    }
    // `transcript` unconditionally: no record contributed to THIS verdict — it
    // is reached because the turn touched no test file at all, which is read off
    // the tool calls. Labelling it `record` because a run state happened to be
    // available would misattribute the evidence.
    return {
        detector: 'untested',
        mode: 'transcript',
        evidence: shown + (source.length > 3 ? ` (+${String(source.length - 3)} more)` : ''),
        reason:
            'a completion claim over production code this turn changed, with NO test file ' +
            'touched anywhere in the turn — running a linter is not evidence the change ' +
            'works. Write the test that would have caught the failure, and enumerate the ' +
            'states the change actually has (every view, every CRUD path, the empty and ' +
            'error states) rather than the happy one. If a test genuinely does not belong ' +
            'here, say which file carries the coverage instead',
    };
}

// ---------------------------------------------------------------------------
// Re-entrancy — the guard, keyed on the turn, not on the reply
// ---------------------------------------------------------------------------

/**
 * ONE file per session, not one per refused turn. R2 round 1, finding 17:
 * per-turn files accumulated without bound and without a TTL, because "re-arms
 * itself with no cleanup" described the key rotating, not the files being
 * removed.
 *
 * Both halves are now closed. The per-turn MULTIPLICITY went first; the missing
 * TTL was the other half and `road-to-stop-gate-honesty` step 1.2 shipped it as
 * `pruneAgedRefusalState`, run at `session_start` by the session-register
 * concern — the one slot that already prunes and therefore adds no spawn. The
 * path and the retention constant live with the reader
 * (`_lib/turn_end_refusals.ts`), because a pruner in one module and a writer in
 * another must not each own their own idea of where the files are.
 */
function sessionStateFile(workspaceRoot: string, sessionKey: string): string {
    return sessionRefusalFile(workspaceRoot, sessionKey);
}

/**
 * Re-exported, not re-derived: the session register reads this session's own
 * refusal record back for live per-session visibility, so the stem has two
 * consumers and exactly one definition (`_lib/turn_end_refusals.ts`).
 */
export { deriveSessionKey };

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

/**
 * Write the re-entrancy marker AND count the refusal.
 *
 * The marker half is unchanged: `refused_turn` is what `alreadyRefusedTurn`
 * reads, and nothing about the counting can alter whether a turn is refused
 * twice. The counting half is `road-to-stop-gate-honesty` step 1.1 — the old
 * record overwrote itself, so a session refused nine times looked exactly like a
 * session refused once, and D-2's "refusal frequency is invisible" was true of
 * the state file as much as of the absent reader.
 *
 * EVERY finding's detector is counted, not just the first. The first still lands
 * in `detector` for compatibility with the 36 field records written before this,
 * but a turn that trips B and C at once is two observations, and pooling them
 * into one is what step 1.1 forbids in the reader — doing it in the writer would
 * put the same defect somewhere the reader cannot fix.
 */
function markRefusedTurn(
    workspaceRoot: string,
    sessionKey: string,
    turnOrdinal: number,
    detectors: readonly DetectorId[],
    promptId: string,
): void {
    if (is_replay_mode()) return;
    const file = sessionStateFile(workspaceRoot, sessionKey);
    let prev: RefusalRecord | null = null;
    try {
        prev = parseRecord(fs.readFileSync(file, 'utf-8'));
    } catch {
        // Absent or unreadable prior state starts a fresh count. Never a reason
        // to skip the marker — the marker is the wedge guard.
    }
    let version: string | undefined;
    try {
        version = readInstallBoundary().version ?? undefined;
    } catch {
        version = undefined;
    }
    try {
        atomic_write_json(
            file,
            foldRefusal(prev, {
                detectors,
                turnOrdinal,
                at: new Date().toISOString(),
                version,
                promptId,
            }) as unknown as Record<string, unknown>,
        );
    } catch {
        // A state-write failure must never wedge the turn. Losing the marker
        // costs at most one extra refusal; failing closed here would cost the
        // session.
    }
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

// Extracted to `_lib/turn_end_transcript.ts` — same move, same reason, as
// detector E above: `_lib` is where the prose costs no ratchet debt, and
// this file hit its 1,500-line source budget when the shadow read landed.
// Re-exported so every existing importer of this module is unchanged;
// `tests/scripts/turn_end_gate_hook.test.ts` addresses all three names at
// this path.
import { readTranscriptTail, type ToolCall } from '../_lib/turn_end_transcript.js';

export {
    extractToolCalls,
    readTranscriptTail,
    type ToolCall,
    type TranscriptTail,
} from '../_lib/turn_end_transcript.js';

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function str(v: JsonValue | undefined): string {
    return typeof v === 'string' ? v : '';
}

/**
 * Everything the detectors read, assembled once per stop event.
 *
 * Extracted for step 2.1 of `road-to-a-stop-that-holds`, and the extraction —
 * not the shadow write — is the load-bearing half. The contract's Q1 asks how
 * often a turn the gate ALLOWS on a re-entrancy layer would have been refused
 * again, which needs the detectors to run on the allow path. There were two
 * ways to get them there: call them from a second assembly written beside the
 * first, or assemble once and call from both. `obligation_settle_hook.ts`'s
 * header already rules out the first — "a detector whose shadow measurement
 * and live behaviour come from different code measures nothing" — so this
 * function exists so that there is exactly one assembly and exactly one
 * detector list, read by the live verdict and by the shadow alike.
 *
 * `null` means the turn has no assistant text, which is `main()`'s existing
 * allow and is not a detector input the shadow could have measured either.
 */
interface DetectorInputs {
    workspaceRoot: string;
    rawSessionId: string;
    sessionKey: string;
    turnOrdinal: number;
    promptId: string;
    lastAssistant: string;
    toolCalls: ToolCall[];
    turnTexts: string[];
    closingFromPayload: boolean;
    dispatchOpen: boolean;
    runState: TurnRunState | null;
}

function assembleDetectorInputs(
    envelope: JsonObject,
    payload: JsonObject,
): DetectorInputs | null {
    const workspaceRoot = str(envelope['workspace_root'] as JsonValue | undefined) || process.cwd();

    // Layer 1b — an open subagent dispatch is an EXPLICIT allow
    // (road-to-subagent-lifecycle-integrity Phase 3 Step 2).
    //
    // A turn waiting on an async subagent has, by construction, outstanding
    // work the model cannot finish in this turn. Refusing it is the upstream
    // Stop-hook x async-subagent loop shape (anthropics/claude-code#55754):
    // the gate refuses, the model still cannot proceed because the dispatch
    // has not returned, and the refusal repeats.
    //
    // This is an allow path and can never become a deny path — it only ever
    // lets a turn END that would otherwise have been refused. It reads the
    // Phase-1 ledger; a ledger that is absent, empty or unreadable yields zero
    // open records and changes nothing, so the gate degrades to exactly its
    // previous behaviour rather than failing open in the dangerous direction.
    //
    // R2 round 2, finding 2: it used to be an early `return EXIT_ALLOW`, which
    // suppressed ALL FOUR detectors. A pending dispatch explains a promissory
    // closing (A) and an unsettled completion claim (D); it explains nothing
    // about a language mismatch (B) or an unverified edit (C), and silencing
    // those was scope Step 2 never asked for. Applied per detector in
    // `runDetectors`.
    //
    // R2 round 2, finding 1: the count is TTL-filtered inside
    // `openRecordStats`. A leaked record from a dispatch that never returned
    // would otherwise read as "a dispatch is open" forever and, because this
    // branch is an ALLOW, disable those two detectors indefinitely with no
    // signal — the ledger's own leak inherited with the opposite polarity.
    let dispatchOpen = false;
    try {
        dispatchOpen = openRecordStats(workspaceRoot).open_count > 0;
    } catch {
        // An unreadable ledger is not a reason to change the verdict.
    }

    const transcriptPath = str(
        (payload['transcript_path'] ?? payload['transcriptPath']) as JsonValue | undefined,
    );
    // No override of the home-confinement check on the production path. R2
    // finding 13: the previous `AGENT_CONFIG_TRANSCRIPT_HOME` widened the one
    // security-relevant predicate in this hook, and an env var that relaxes a
    // path-confinement check IS a bypass of it, whatever the comment says. The
    // tests set `HOME` on the spawned process instead — `os.homedir()` honours
    // it — so the branch is still exercised with no product-code seam.
    // The cap is passed HERE, at the only production call site. R2 round 2,
    // finding 7: enforcing it inside the function while `main()` called
    // `readTranscriptTail(transcriptPath)` with no options left the guard dead
    // in production while its comment claimed it was enforced — the same
    // fixed-the-definition-not-the-caller shape as two other findings in that
    // round, which is why this line exists rather than a default parameter.
    const { lastAssistant, turnOrdinal, toolCalls, assistantTurnTexts } = readTranscriptTail(
        transcriptPath,
        { maxBytes: TRANSCRIPT_READ_MAX_BYTES },
    );
    if (!lastAssistant) return null;

    // The closing reply comes from the field the host hands us when it supplies
    // one, not only from a file the host writes asynchronously. The transcript
    // may lag the in-memory conversation, and a tail that is one assistant entry
    // short is silence for `detectDroppedDecision`, whose early return needs two
    // texts — i.e. the detector goes quiet in exactly the shape it exists for.
    // `suggestion_capture_hook.ts` reads the same field for the same reason.
    // Appended, never substituted: `lastAssistant` and the four other detectors
    // are untouched, and a host that supplies no such field is unchanged.
    const payloadClosing = str(
        (payload['last_assistant_message'] ?? payload['lastAssistantMessage']) as
            | JsonValue
            | undefined,
    );
    const closingFromPayload = payloadClosing !== '' && !assistantTurnTexts.includes(payloadClosing);
    const turnTexts = closingFromPayload
        ? [...assistantTurnTexts, payloadClosing]
        : assistantTurnTexts;

    // The host's own id for the prompt being processed. Recorded beside the
    // ordinal in the refusal marker — never used as the guard key. The
    // ordinal's drift is what both re-entrancy layers exist for, so a later
    // reading needs the pair to tell a drifted ordinal from a second prompt.
    const promptId = str((payload['prompt_id'] ?? payload['promptId']) as JsonValue | undefined);
    // RAW id, kept beside the derived key rather than replaced by it:
    // `readLanguagePin` addresses the producer's own per-session file, and the
    // producer keys that on the raw `session_id`. Passing `sessionKey` there
    // would read a path nothing writes — the same shape as the STATE_FILE break
    // this pairing exists to close.
    const rawSessionId = str(envelope['session_id'] as JsonValue | undefined) || '';
    const sessionKey = deriveSessionKey(rawSessionId || 'unknown-session');

    // ONE read of the recorder's state, shared by detectors C and F. Two reads
    // would be two file opens on the stop slot for one answer, and — worse —
    // could disagree if a post-tool event landed between them.
    //
    // It used to sit AFTER the Layer-2 allow, with a comment saying "a retry
    // pays no file read it immediately discards". Step 2.1 makes that false
    // rather than leaving the comment to rot: a retry now RUNS the detectors
    // to record whether it would have been refused again, so the read is
    // consumed on that path too. The cost is one `readFileSync` per retry,
    // which is the budget line 2.1 pre-registers.
    const runState = readTurnRunState(workspaceRoot, rawSessionId);

    return {
        workspaceRoot,
        rawSessionId,
        sessionKey,
        turnOrdinal,
        promptId,
        lastAssistant,
        toolCalls,
        turnTexts,
        closingFromPayload,
        dispatchOpen,
        runState,
    };
}

/**
 * Run every detector over one assembled input set.
 *
 * The one list, called by the live verdict and by the shadow read. Its
 * ordering and its `dispatchOpen` ternaries are the gate's behaviour; nothing
 * about the shadow may change them, which is why the shadow calls this rather
 * than carrying a copy.
 */
function runDetectors(inputs: DetectorInputs): Finding[] {
    const { dispatchOpen, lastAssistant, workspaceRoot, rawSessionId, toolCalls, runState } =
        inputs;
    const findings: Finding[] = [];
    for (const f of [
        // A and D are the completion-adjacent pair a pending dispatch excuses
        // (Phase 3 Step 2, narrowed by R2 round 2 finding 2). B and C are not
        // excused by anything about a dispatch and run unchanged.
        dispatchOpen ? null : detectPromissory(lastAssistant),
        detectLanguage(lastAssistant, readLanguagePin(workspaceRoot, rawSessionId)),
        detectUnverifiedEdit(toolCalls, runState),
        // Round 7 § Phase 1 — detector D. It is NOT unconditional: A and D are
        // both excused by an open dispatch, per the note above. It shipped with
        // its own settings flag one commit earlier and that flag is gone:
        // `hooks.turn_end_gate.*` was deleted on 2026-08-12 because a
        // default-off safety gate is an absent one. Its gating is where the
        // note above says gating belongs — inside the detector: no CI observed,
        // or a settled read, or no completion claim ⇒ no finding.
        dispatchOpen
            ? null
            : detectCompletionClaim(lastAssistant, readCiSettled(workspaceRoot, rawSessionId)),
        // Detector E is UNCONDITIONAL, and that is the opposite choice from A
        // and D one line above rather than an oversight. An open dispatch
        // excuses a promissory closing because the work is genuinely still
        // running; it excuses nothing about a question the user was already
        // asked. Worse: a dispatch — or the `end-review-nudge` stop concern
        // that produced the measured failure — IS the continuation that drops
        // the decision, so narrowing E the same way would silence it in exactly
        // the case it exists for.
        detectDroppedDecision(inputs.turnTexts, inputs.closingFromPayload),
        // Detector F takes the OTHER side of that same question, and the two
        // sitting adjacent is the clearest place to say why. E fires on a
        // question already asked, which an open dispatch cannot excuse. F fires
        // on a completion CLAIM, and a turn waiting on a subagent has not
        // finished — so its closing is not the claim F is about. Same slot,
        // opposite trigger, opposite treatment of `dispatchOpen`.
        dispatchOpen ? null : detectUntestedChange(lastAssistant, toolCalls, runState),
    ]) {
        if (f) findings.push(f);
    }
    return findings;
}

/**
 * Write the graph feeder row for ONE stop (step 3.2).
 *
 * Called from both stop paths with the findings that path already computed, so
 * the F verdict in the row is the SAME verdict the gate acted on — never a
 * second evaluation written beside it, which is the shape
 * `obligation_settle_hook.ts` names as measuring nothing.
 *
 * It changes no exit code, and the whole body is wrapped: a stop that crashed on
 * its own instrument would be a new failure mode on a path that is supposed to
 * cost nothing. The graph half is skipped outright unless the state is `fresh`
 * or `edited` — an answer from an index that predates the change is not evidence
 * about the change.
 */
function recordGraphFeeder(
    inputs: DetectorInputs,
    findings: readonly Finding[],
    layer: FeederLayer,
): void {
    if (is_replay_mode()) return;
    try {
        let state: GraphState;
        try {
            state = graphState(inputs.workspaceRoot);
        } catch {
            return;
        }
        // No graph at all is the silent case, exactly as it is for the context
        // hook: a consumer who never builds one never grows this file.
        if (state === 'absent') return;
        // The SAME path set detector F reads, filtered by the SAME predicate.
        // A completion review found the two arms running over different inputs:
        // the feeder passed every edit path while F filters to production
        // source, so the graph arm would have fired on precisely the turns F is
        // silent for — a recall comparison between two detectors answering
        // different questions, which is worse than no comparison.
        const paths = inputs.toolCalls
            .filter((c) => _EDIT_TOOLS.has(c.name) && c.path !== undefined)
            .map((c) => c.path as string)
            .filter(_isProductionSource);
        const f = findings.find((x) => x.detector === 'untested');
        appendFeederRow(
            inputs.workspaceRoot,
            inputs.sessionKey,
            buildFeederRow({
                turn: inputs.turnOrdinal,
                layer,
                state,
                fFired: f !== undefined,
                fMode: f?.mode ?? null,
                paths,
                graph: graphUntestedVerdict(inputs.workspaceRoot, state, paths),
            }),
        );
    } catch {
        // An instrument is never a reason to change what the gate does.
    }
}

/**
 * Record what this retry WOULD have been refused for, then let it end.
 *
 * Never changes a verdict: every caller returns `EXIT_ALLOW` whatever happens
 * here, and the whole body is wrapped because a retry that crashed on its own
 * instrument would be a new failure mode on a path that previously did no work
 * at all. A retry with no findings still lands, as `retries_observed` without a
 * row — that is the only way Q1 can read below 1.
 */
function recordShadow(inputs: DetectorInputs, layer: ShadowLayer): void {
    if (is_replay_mode()) return;
    try {
        const findings = runDetectors(inputs);
        recordGraphFeeder(inputs, findings, layer);
        const file = sessionShadowFile(inputs.workspaceRoot, inputs.sessionKey);
        let prev: ShadowRecord | null = null;
        try {
            prev = parseShadowRecord(fs.readFileSync(file, 'utf-8'));
        } catch {
            // Absent or unreadable prior state starts a fresh record.
        }
        atomic_write_json(
            file,
            foldShadow(prev, {
                detectors: findings.map((f) => f.detector),
                turnOrdinal: inputs.turnOrdinal,
                at: new Date().toISOString(),
                layer,
            }) as unknown as Record<string, unknown>,
        );
    } catch {
        // An instrument is never a reason to change what the gate does.
    }
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
    //
    // Still an unconditional allow. What changed in step 2.1 is that the turn
    // is MEASURED on the way out: the detectors run once against the same
    // inputs the live path would have built, and a finding becomes a
    // `would_refuse_again` row. The verdict is byte-identical to the version
    // that returned here immediately.
    if (payload['stop_hook_active'] === true) {
        try {
            const retryInputs = assembleDetectorInputs(envelope, payload);
            if (retryInputs !== null) recordShadow(retryInputs, 'stop_hook_active');
        } catch {
            // Assembly is throw-safe by construction today; the guard is here
            // because this path did NO work before 2.1, so a regression in any
            // reader it now calls must not turn a clean retry into a crash.
        }
        return EXIT_ALLOW;
    }

    const inputs = assembleDetectorInputs(envelope, payload);
    if (inputs === null) return EXIT_ALLOW;

    // Layer 2 — keyed on the turn's ORDINAL, never on the prompt's text.
    // A host that sends no `session_id` shares one bucket AND one small-integer
    // ordinal namespace, so an unrelated session whose ordinal matches a stored
    // `refused_turn` reads as already-refused and goes unguarded. R2 round 2,
    // finding 16: the sibling hook documents its own bucket as degrading rather
    // than colliding, and this one collides. It is named here rather than
    // papered over — the degradation is toward UNDER-refusing, which is the safe
    // direction, and layer 1 still covers the host that sends the flag.
    if (alreadyRefusedTurn(inputs.workspaceRoot, inputs.sessionKey, inputs.turnOrdinal)) {
        recordShadow(inputs, 'refused_turn');
        return EXIT_ALLOW;
    }

    // B and C run on every turn-end; A and D run only when no dispatch is open.
    // For the detectors that DO run, the gating is INSIDE each one — no promise,
    // no pin mismatch, no unverified edit, no unsettled completion claim ⇒ no
    // finding ⇒ the turn ends. That is the whole of "fires when it is
    // warranted"; there is no second, configurable notion of warranted layered
    // on top of it.
    const findings = runDetectors(inputs);
    // The live verdict's own row. It is written BEFORE the branch below, so a
    // turn the gate allows and a turn it refuses are both in the record — a
    // recall reading needs the allowed turns as its negative arm.
    recordGraphFeeder(inputs, findings, 'live');
    if (findings.length === 0) return EXIT_ALLOW;

    markRefusedTurn(
        inputs.workspaceRoot,
        inputs.sessionKey,
        inputs.turnOrdinal,
        findings.map((f) => f.detector),
        inputs.promptId,
    );

    const lines = findings.map(
        (f) => `  · ${f.detector}: ${f.reason}\n    evidence: ${JSON.stringify(f.evidence)}`,
    );
    process.stderr.write(
        `turn-end-gate: REFUSED — this turn is not finished.\n${lines.join('\n')}\n` +
            '  Do the promised work now, correct the language, run the ' +
            'verification the edit needs, read the CI verdict before claiming ' +
            'it, or re-present the options block this turn dropped — then end ' +
            'the turn.\n' +
            '  This turn will not be refused a second time.\n',
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
