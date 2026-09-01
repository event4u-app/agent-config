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
 * FOUR detectors ride on one guard, because building the unsafe part twice
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
 *
 * TWO of the four are CONDITIONAL, and saying "unconditional" here would be the
 * same stale-header defect this block corrects below. A and D are the
 * completion-adjacent pair an open subagent dispatch excuses, so `main()` runs
 * them only when `dispatchOpen` is false; B and C run on every turn-end. That
 * narrowing is deliberate (Phase 3 Step 2, narrowed again by R2 round 2) and is
 * the third allow path, alongside the two re-entrancy layers — see the
 * per-detector list in `main()`.
 *
 * This block said "Three" and listed A/B/C until 2026-08-18, while `DetectorId`
 * below has carried four since round 7. `DETECTOR_IDS` in
 * `_lib/turn_end_refusals.ts` is read off that union rather than off this
 * comment for exactly that reason, and the count is corrected here rather than
 * left as a stale header the next reader has to disbelieve.
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
    isSyntheticPrompt,
    statePathFor as languageStatePathFor,
    type Verdict,
} from '../language_mirror_hook.js';
// Round 7 § Phase 1 — the CI-settle producer. Imported for its path BUILDER, not
// for a path constant: "the consumer cannot read a path the producer does not
// write" is only true while the two agree, and importing a constant made that
// agreement invisible when the producer's layout moved. A builder makes the move
// a type error.
import { statePathFor as ciStatePathFor } from '../before_complete_hook.js';
import { isSafeTranscriptPath } from './end_review_nudge_hook.js';
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
    parseRecord,
    readInstallBoundary,
    sessionRefusalFile,
    type RefusalRecord,
} from '../_lib/turn_end_refusals.js';

/** Dispatcher-internal block code. Pinned to 1 by `concern_block_exit_parity`. */
const EXIT_BLOCK = 1;
const EXIT_ALLOW = 0;

/**
 * Transcript-read ceiling for this hook, passed at the call site in `main()`.
 * Deliberately well under `isSafeTranscriptPath`'s own 50 MB refusal: the
 * ordinal is a count over every entry, so the whole file is walked once per
 * turn-end, and a session file grows for the life of the session. Past this the
 * gate lets the turn end rather than pay an unbounded read — fail-open, like
 * every other unreadable-transcript case here.
 */
export const TRANSCRIPT_READ_MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/** Detector identity, used in the state marker and the refusal text. */
export type DetectorId = 'promissory' | 'language' | 'verification' | 'completion';

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
 * Shell commands that count as verification.
 *
 * A positive list, and deliberately narrow. The alternative — treating any
 * `Bash` call as verification — was rejected because `ls` would then clear an
 * unverified edit, which is the failure mode `verify-before-complete` names
 * ("relying on partial verification"). The cost of narrowness is a MISSED
 * detection when a project verifies by some command not listed here, and that is
 * the safe direction for a gate that can refuse a turn: a false negative costs
 * one unguarded turn, a false positive teaches the user to switch the gate off.
 *
 * ## Audited 2026-08-17 — `road-to-stop-gate-honesty` step 2.2
 *
 * 52 commands this project's own surface actually produces (its `package.json`
 * scripts, its `Taskfile` targets, `./scripts-run`, `./agent-config`, and the
 * PHP / Python / Go / Rust toolchains) were run through
 * `isVerificationCommand`. The table of every one, with its verdict, is
 * `turn_end_verify_allowlist.test.ts`; that file is the fixture step 2.2
 * requires, and every addition below has its own row in it.
 *
 * The draft that opened the roadmap expected to add `phpunit` and `pest`. Claim
 * 4 had already overtaken that — both matched before this audit, as did
 * `composer test` and `php artisan test` — so what the audit actually found was
 * two different gaps:
 *
 *   · `phpstan` — a static analyser of exactly the class already listed
 *     (`mypy`, `pyright`, `clippy`). Added.
 *   · `lint` followed by a WORD character — `lint_persistence`,
 *     `lint_provenance`, and every other `lint_*` script in `src/scripts/`
 *     missed, because `\blint\b` needs a boundary and `_` is a word character.
 *     `lint[-_:a-z]*` is the exact mirror of the `check[-_:a-z]*` this list
 *     already carried, which is why it is the narrow fix rather than a new idea.
 *
 * Four further misses were found and deliberately NOT added, because Risk 2 of
 * that roadmap is that every addition is a way to satisfy the gate without
 * verifying anything:
 *
 *   · `npm run prepack` — a lifecycle hook whose content is per-project. Here it
 *     validates; elsewhere it copies files. Recognising it would clear an
 *     unverified edit in any repo whose prepack is a build step.
 *   · `task sync` / `task generate-tools` / `agent-config roadmap:progress` —
 *     GENERATORS. They rewrite the tree; they check nothing. A generator that
 *     cleared the gate would be the rubber stamp in its purest form.
 *   · `agent-config gates --all` — enumerates gates, runs none.
 *   · `vendor/bin/rector process --dry-run` — a refactoring tool. Its dry run
 *     prints a diff; it does not assert anything holds.
 *
 * `psalm` is the obvious sibling of `phpstan` and is also NOT added: nothing in
 * the audited surface runs it, and "the team actually runs" is the step's own
 * standard. It is named here so the next audit does not re-derive the question.
 */
const _VERIFY_RE =
    /\b(test|tests|vitest|jest|pytest|phpunit|pest|tsc|eslint|ruff|mypy|pyright|clippy|phpstan|typecheck|lint[-_:a-z]*|build|ci|preflight|smoke[-_:a-z]*|check[-_:a-z]*|validate[-_:a-z]*)\b|\b(task|npm|pnpm|yarn|composer|cargo|go|make|php artisan|bun)\s+(run\s+)?\S*(test|check|lint|build|ci|typecheck)/i;

export function isVerificationCommand(command: string): boolean {
    return _VERIFY_RE.test(command);
}

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
export function detectUnverifiedEdit(toolCalls: readonly ToolCall[]): Finding | null {
    let lastEdit = -1;
    for (let i = 0; i < toolCalls.length; i += 1) {
        if (_EDIT_TOOLS.has(toolCalls[i]!.name)) lastEdit = i;
    }
    if (lastEdit === -1) return null;
    for (let i = lastEdit + 1; i < toolCalls.length; i += 1) {
        const c = toolCalls[i]!;
        if (c.name === 'Bash' && c.command !== undefined && isVerificationCommand(c.command)) {
            return null;
        }
    }
    const edited = toolCalls[lastEdit]!.path;
    return {
        detector: 'verification',
        // The path, never the diff: the evidence span is quoted into a refusal,
        // and `ToolCall` is shaped so a file body cannot reach it.
        evidence: edited ?? toolCalls[lastEdit]!.name,
        reason:
            'this turn changed a file and then ran no verification command — ' +
            'no test, type-check, lint or build call follows the last edit ' +
            '(verify-before-complete: a claim without a fresh run is unverified)',
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

/**
 * One tool call the assistant made, reduced to what a detector can reason
 * about: the tool's name, the shell command when it is a shell call, and the
 * target path when it is a file write.
 *
 * Nothing else is kept. A tool input can hold a whole file body, and this
 * struct is what a refusal quotes back — so it is shaped to be INCAPABLE of
 * carrying one, the same PII-exclusion-by-construction discipline
 * `domain-safety-pii` § Surface 2 asks for in a log line.
 */
export interface ToolCall {
    name: string;
    /** `Bash` only — the command line, so "did anything verify" is answerable. */
    command?: string;
    /** Edit/Write only — the file the turn changed, used as the evidence span. */
    path?: string;
}

export interface TranscriptTail {
    lastAssistant: string;
    /**
     * How many GENUINE user prompts the transcript carries — harness-injected
     * user-role entries excluded via `isSyntheticPrompt`. This is the turn's
     * identity; see `alreadyRefusedTurn` for why the prompt's text is not.
     */
    turnOrdinal: number;
    /**
     * The tool calls of the CURRENT turn, in order — reset at every genuine user
     * prompt, so a verification from three turns ago cannot vouch for an edit
     * made now. `_messageText` keeps only `type === 'text'` blocks, which is why
     * this needed its own extraction rather than a reading of `lastAssistant`:
     * tool activity is not in the prose at all.
     */
    toolCalls: ToolCall[];
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
    const empty: TranscriptTail = { lastAssistant: '', turnOrdinal: 0, toolCalls: [] };
    if (!transcriptPath || !isSafeTranscriptPath(transcriptPath, opts)) return empty;
    let lines: string[];
    try {
        // R2 finding 12: `maxBytes` was accepted in the options type and never
        // used, so the declared cap was decoration. It is enforced here as well
        // as inside `isSafeTranscriptPath`, because this is the read it bounds.
        // The whole file still has to be walked — the turn ordinal is a count
        // over all entries, not something a tail can answer — so the cap is the
        // guard, not an optimisation.
        if (opts.maxBytes !== undefined && fs.statSync(transcriptPath).size > opts.maxBytes) {
            return empty;
        }
        lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
    } catch {
        return empty;
    }
    let lastAssistant = '';
    let turnOrdinal = 0;
    let toolCalls: ToolCall[] = [];
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
        // Sidechain entries are a SUBAGENT's conversation recorded in the same
        // JSONL. A subagent prompt is a genuine-looking user-role text entry
        // appended mid-turn, so counting it moves the ordinal within the turn —
        // finding 3's failure class in a new shape (R2 round 2, finding 3).
        if (entry['isSidechain'] === true) continue;
        const role = entry['type'];
        if (role !== 'assistant' && role !== 'user') continue;
        const msg = entry['message'];
        if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) continue;
        const content = (msg as Record<string, unknown>)['content'];
        // Tool calls are read BEFORE the text guard: an assistant entry that is
        // only a tool_use block has no text at all, so `continue`-ing on a null
        // text would drop exactly the entries this detector exists to see.
        if (role === 'assistant') {
            toolCalls.push(..._toolCalls(content));
        }
        const text = _messageText(content);
        if (text === null) continue;
        if (role === 'assistant') {
            lastAssistant = text;
        } else if (!isSyntheticPrompt(text)) {
            turnOrdinal += 1;
            // A genuine user prompt starts a new turn, so the previous turn's
            // tool activity stops counting. Without this reset, a verification
            // run three turns ago would vouch for an edit made now — the
            // "fresh" in edit-without-FRESH-verification is this line.
            toolCalls = [];
        }
    }
    return { lastAssistant: lastAssistant.trim(), turnOrdinal, toolCalls };
}

/**
 * Extract this entry's tool calls, keeping only name, shell command and target
 * path. A tool input can hold a whole file body; nothing but those three fields
 * is carried forward.
 */
function _toolCalls(content: unknown): ToolCall[] {
    if (!Array.isArray(content)) return [];
    const out: ToolCall[] = [];
    for (const blk of content) {
        if (typeof blk !== 'object' || blk === null || Array.isArray(blk)) continue;
        const b = blk as Record<string, unknown>;
        if (b['type'] !== 'tool_use') continue;
        const name = b['name'];
        if (typeof name !== 'string') continue;
        const input = b['input'];
        const call: ToolCall = { name };
        if (typeof input === 'object' && input !== null && !Array.isArray(input)) {
            const inp = input as Record<string, unknown>;
            const cmd = inp['command'];
            if (typeof cmd === 'string') call.command = cmd;
            const p = inp['file_path'] ?? inp['path'] ?? inp['notebook_path'];
            if (typeof p === 'string') call.path = p;
        }
        out.push(call);
    }
    return out;
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
    // those was scope Step 2 never asked for. Applied per detector below.
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
    const { lastAssistant, turnOrdinal, toolCalls } = readTranscriptTail(transcriptPath, {
        maxBytes: TRANSCRIPT_READ_MAX_BYTES,
    });
    if (!lastAssistant) return EXIT_ALLOW;

    // Layer 2 — keyed on the turn's ORDINAL, never on the prompt's text.
    // A host that sends no `session_id` shares one bucket AND one small-integer
    // ordinal namespace, so an unrelated session whose ordinal matches a stored
    // `refused_turn` reads as already-refused and goes unguarded. R2 round 2,
    // finding 16: the sibling hook documents its own bucket as degrading rather
    // than colliding, and this one collides. It is named here rather than
    // papered over — the degradation is toward UNDER-refusing, which is the safe
    // direction, and layer 1 still covers the host that sends the flag.
    // RAW id, kept beside the derived key rather than replaced by it:
    // `readLanguagePin` addresses the producer's own per-session file, and the
    // producer keys that on the raw `session_id`. Passing `sessionKey` here would
    // read a path nothing writes — the same shape as the STATE_FILE break this
    // parameter exists to close.
    const rawSessionId = str(envelope['session_id'] as JsonValue | undefined) || '';
    const sessionKey = deriveSessionKey(rawSessionId || 'unknown-session');
    if (alreadyRefusedTurn(workspaceRoot, sessionKey, turnOrdinal)) return EXIT_ALLOW;

    // B and C run on every turn-end; A and D run only when no dispatch is open
    // (the ternaries below). For the detectors that DO run, the gating is INSIDE
    // each one — no promise, no pin mismatch, no unverified edit, no unsettled
    // completion claim ⇒ no finding ⇒ the turn ends. That is the whole of "fires
    // when it is warranted"; there is no second, configurable notion of warranted
    // layered on top of it.
    //
    // This said "Every detector runs on every turn-end" and enumerated three of
    // four, three lines above the two `dispatchOpen` ternaries that refute it.
    // Corrected 2026-08-19 with the header block at the top of this file: a reader
    // arriving here met the false claim first, and the D comment below deferred to
    // "the note at the top of this loop" — which was this sentence.
    const findings: Finding[] = [];
    for (const f of [
        // A and D are the completion-adjacent pair a pending dispatch excuses
        // (Phase 3 Step 2, narrowed by R2 round 2 finding 2). B and C are not
        // excused by anything about a dispatch and run unchanged.
        dispatchOpen ? null : detectPromissory(lastAssistant),
        detectLanguage(lastAssistant, readLanguagePin(workspaceRoot, rawSessionId)),
        detectUnverifiedEdit(toolCalls),
        // Round 7 § Phase 1 — detector D. It is NOT unconditional, and this
        // comment said it was while sitting one line above the `dispatchOpen`
        // ternary that conditions it: A and D are both excused by an open
        // dispatch, per the note at the top of this loop. Corrected 2026-08-18.
        // It shipped with its own settings flag one commit earlier
        // and that flag is gone: `hooks.turn_end_gate.*` was deleted on
        // 2026-08-12 because a default-off safety gate is an absent one. Its
        // gating is where the comment above says gating belongs — inside the
        // detector: no CI observed, or a settled read, or no completion claim
        // ⇒ no finding.
        dispatchOpen
            ? null
            : detectCompletionClaim(lastAssistant, readCiSettled(workspaceRoot, rawSessionId)),
    ]) {
        if (f) findings.push(f);
    }
    if (findings.length === 0) return EXIT_ALLOW;

    markRefusedTurn(
        workspaceRoot,
        sessionKey,
        turnOrdinal,
        findings.map((f) => f.detector),
    );

    const lines = findings.map(
        (f) => `  · ${f.detector}: ${f.reason}\n    evidence: ${JSON.stringify(f.evidence)}`,
    );
    process.stderr.write(
        `turn-end-gate: REFUSED — this turn is not finished.\n${lines.join('\n')}\n` +
            '  Do the promised work now, correct the language, run the ' +
            'verification the edit needs, or read the CI verdict before claiming ' +
            'it — then end the turn.\n' +
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
