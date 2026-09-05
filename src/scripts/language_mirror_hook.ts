#!/usr/bin/env node
/**
 * Language-mirror pin — `user_prompt_submit` concern.
 *
 * Deterministic carrier for the `language-and-tone` Iron Law (mirror the
 * language of the user's last CHAT MESSAGE in every user-visible token).
 *
 * WHY THIS EXISTS — the measured defect, not a general reminder.
 *
 * A conformance audit of 30 sessions (2026-08-06) found assistant turns
 * answering a German prompt in English, across 11 sessions, three of them a
 * 100 % English run. The count this comment first carried, ~470, was an early
 * intermediate figure and is superseded: that audit's own final baseline is
 * **626**, and conformance round 5 (2026-08-07) measures **641** over an
 * overlapping-but-not-identical 30-session window. Both are published side by
 * side rather than treated as a trend, because the windows differ. The obvious
 * reading is "the model ignored a rule". The transcripts say otherwise:
 *
 *   **47 skill- and slash-command bodies arrive in the `user` role** across 21
 *   of the 30 sessions. In the worst session the last user-role content before
 *   136 consecutive English assistant turns is a 4,196-character English skill
 *   body (`de=0 / en=59`), while the maintainer's actual prompt — 451
 *   characters, `de=16 / en=0` — sits above it.
 *
 * So the most recent user-role content genuinely WAS English, and mirroring it
 * was locally correct. The rule says the trigger is the user's last *chat
 * message* and explicitly excludes tool output, but the transcript offers no
 * way to tell an injected skill body from a typed prompt.
 *
 * `user_prompt_submit` is the one event a skill body never reaches — it fires
 * on what the human actually submitted. Pinning the language there turns an
 * unobservable distinction into a recorded fact.
 *
 * This is deliberately NOT "more prose into the same context": the AI council
 * (2026-08-06) was right that a reminder cannot buy attention in a context that
 * already carries the Iron Law in full. What it can do is carry a fact the
 * context does not otherwise contain — which language the human wrote in.
 *
 * State: `agents/state/language-mirror.json`
 *   { "language": "de"|"en"|"und", "source": "prompt"|"system-locale",
 *     "detected_at": iso8601, "prompt_chars": int, "de_markers": int,
 *     "en_markers": int, "session_id": str }
 *
 * Undetermined prompts (a bare "1", "ok", a pasted URL) leave a previous pin
 * UNTOUCHED rather than clearing it — a short continuation does not change the
 * conversation's language, and clearing on every terse turn would reproduce the
 * exact drift this hook removes.
 *
 * FIRST TURN OF A SESSION — the system-locale fallback.
 *
 * The keep-previous-pin rule has nothing to keep on the very first prompt. If
 * that prompt is terse ("weiter", "1", a pasted URL) the verdict is `und`, no
 * pin is written, and the turn runs with no pin at all — which is the drift
 * this hook exists to remove, occurring precisely where the conversation has
 * the least other evidence. So when there is no previous pin AND the prompt is
 * undetermined, the environment's locale supplies a starting language, recorded
 * as `source: "system-locale"` so the weaker provenance is legible rather than
 * indistinguishable from a read of the user's own words.
 *
 * A locale pin is a floor, never a ceiling: the FIRST prompt carrying real
 * markers replaces it, because `source: "prompt"` always wins. That is what
 * makes "any later explicit statement by the user overrides it" true without a
 * second mechanism — the ordinary path already outranks the fallback.
 *
 * Locales outside the classifier's two languages stay `und` on purpose. Mapping
 * `fr_FR` to English because the classifier has no French would pin a language
 * the user never wrote, which is worse than carrying no pin.
 *
 * Never blocks (`fail_closed: false`, `severity: advisory`). Exit 0 always.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  atomic_write_json,
  atomic_write_text,
  has_stable_session_id,
  is_replay_mode,
  owns_session_state,
  prune_legacy_state_file,
  prune_stale_session_states,
  session_state_file,
} from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";
import {
  humanAuthoredLead,
  isSyntheticPrompt,
  stripInjectedRegions,
} from "./_lib/prompt_shape.js";

const EXIT_ALLOW = 0;
// Severity is taken from the EXIT CODE, not from the `decision` field in the
// stdout payload. This hook shipped returning EXIT_ALLOW while writing
// {"decision":"warn", …}, so the dispatcher reduced it to `allow`, emitted
// nothing, and the pin reached the model on no path — a state write with no
// delivery, for the audit's largest failure class (626 turns). Round 2, found
// by tracing the delivery rather than re-reading the unit tests.
const EXIT_WARN = 2;

/**
 * The pre-split single-file state. ONE file per project root — and in this
 * repo's worktree workflow `CLAUDE_PROJECT_DIR` resolves to the parent
 * checkout, so every concurrent session shared it. Measured consequence
 * (2026-08-20, session 15b9ac52): a terse German "1" read a neighbouring
 * English session's pin and injected `Reply language for this turn: English.`
 * into a German conversation.
 *
 * Nothing reads it after the per-session split. It is kept exported because
 * `_pruneLegacyState` needs to name the path it deletes, and because a reader
 * that still resolves it should get a compile-visible symbol rather than a
 * silently stale literal.
 *
 * It used to say this "names the path an older bundle may still be writing
 * during an upgrade". That was written without checking and a cross-model review
 * (2026-08-20) built a finding on it: every session under one project root runs
 * ONE dispatcher bundle, resolved through `CLAUDE_PROJECT_DIR` — the parent
 * checkout even in a worktree — so there is no steady mixed-version state. The
 * real, narrow window and its bound are stated once, at
 * `state_io.prune_legacy_state_file`.
 */
export const STATE_FILE = path.join("agents", "state", "language-mirror.json");

/**
 * Per-SESSION state, one file each — the same layout R2 finding 10 gave the
 * pin-lost markers, and for the same reason.
 *
 * A map-in-one-file was the smaller diff and was rejected: two sessions writing
 * concurrently through `atomic_write_json` (write + rename) drop one another's
 * entry, so the cross-talk would return as a lost update instead of a wrong
 * read.
 *
 * This comment used to end "separate files cannot collide by construction", and
 * both council seats named that sentence as false: the first cut derived the
 * filename with a character sanitiser, so `a/b` and `a_b` addressed one file and
 * a substantive prompt from either destroyed the other's state. It is true now
 * only because `statePathFor` keys on a digest of the full id — the property
 * comes from the digest, not from the directory layout, and stating it the other
 * way is how the defect survived a round of review.
 */
export const STATE_DIR = path.join("agents", "state", "language-mirror");

/**
 * Days after which an untouched session's state is pruned.
 *
 * One file per session grows without bound otherwise. 7 matches the retention
 * window this repo already uses for council session artefacts — a convention
 * match, not a measurement, and stated as such.
 */
export const STATE_RETENTION_DAYS = 7;

/**
 * Is there a stable identity to key state on at all?
 *
 * BLOCKER 2, council round 2 (both seats): a sanitised empty id bucketed every
 * id-less invocation into `unknown-session.json`, and `_ownsPin` at the time
 * ACCEPTED an empty stored owner as its own — so id-less sessions shared one
 * file with NO secondary defense. That is the original defect restored, in the
 * one case that had no guard left. (Round 3 closed the second half too:
 * `_ownsPin` now requires exact ownership, so an empty owner is foreign. Stated
 * in the past tense on purpose — describing a fixed defect in the present is
 * how a comment ends up contradicting its own code, which is a round-2 finding
 * against an earlier version of this very file.) There is no sound local way to tell two id-less sessions apart
 * (a fresh UUID per invocation would give one session a new file per hook call,
 * which destroys continuity rather than providing it), so the honest answer is
 * to run stateless: classify the prompt, pin from it, persist nothing.
 */
export function hasStableSessionId(session_id: string): boolean {
  return has_stable_session_id(session_id);
}

/**
 * Path for one session's pin, keyed by a digest of the FULL id.
 *
 * BLOCKER 1, council round 2: the previous sanitiser mapped `a/b` and `a_b` onto
 * one filename, and `_ownsPin` catches that only AFTER the collision — it
 * refuses to inherit, but it cannot stop a substantive prompt from replacing the
 * other session's file, which loses that session's pin and counter permanently.
 * The seat had already asked for a hashed identifier in round 1 and this code
 * answered with the guard instead; the guard was the wrong answer.
 *
 * A digest also removes the filename-length failure mode for unusually long ids.
 * `_ownsPin` stays as an in-file integrity check — cheap, and it guards against
 * a stale or hand-copied file rather than against a hash collision. Round 3
 * tightened it to exact equality for that role: an ownerless file at a hashed
 * path can only be corruption, since every writer here stamps the owner.
 */
export function statePathFor(session_id: string): string {
  return session_state_file(STATE_DIR, session_id);
}

/**
 * Marker written at `pre_compact` and cleared by the single `post_tool_use`
 * re-emit that follows it (round-5 § 6.1). Its existence — not a counter — is
 * what bounds the re-injection to ONE per compaction event.
 */
export const PIN_LOST_DIR = path.join("agents", "state", "language-mirror.pin-lost");

/**
 * Per-SESSION marker path. R2 finding 10: a single shared marker made the
 * mechanism cross-talk between concurrent sessions — the normal shape for this
 * repo's worktree workflow. Session B's next `post_tool_use` consumed the marker
 * session A's compaction had set, so A never got the one re-emit that is the
 * whole point of the mechanism, and B got a pin notice derived from whichever
 * session last wrote the shared state. An empty id degrades to a literal
 * bucket rather than colliding silently.
 */
export function pinLostMarker(session_id: string): string {
  const safe = (session_id || "unknown-session").replace(/[^A-Za-z0-9._-]/g, "_");
  return path.join(PIN_LOST_DIR, `${safe}.marker`);
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * German function words + umlauts. Function words are used rather than a
 * dictionary because the prompts that matter are short imperatives
 * ("fixe die ci", "mach weiter") where content words carry no signal.
 */
const DE_MARKERS =
  /\b(der|die|das|den|dem|und|ist|sind|nicht|kein|keine|mach|mache|bitte|warum|wieso|weshalb|weiter|kannst|sollst|soll|musst|muss|hast|habe|haben|wir|ich|du|dann|noch|auch|schon|wenn|aber|alle|mit|ohne|damit|dass|wurde|werden|gibt|nochmal|erstell|erstelle|erstelle|fehler|regeln|arbeite|analysiere|fixe|nimm|lege|prüfe|pruefe|schau|zeig|mir|dir|sich|eine|einen|einem|einer|vom|zum|zur|beim|im)\b|[äöüÄÖÜß]/gi;

/**
 * English function words that a German sentence would not contain. Chosen to
 * be disjoint from German homographs (`in`, `so`, `war`, `also`, `hat`, `man`,
 * `bei`, `die` … are deliberately absent — they are German words too).
 */
const EN_MARKERS =
  /\b(the|and|is|are|was|were|not|please|why|because|should|would|could|there|these|those|with|from|about|which|that|this|will|have|has|been|they|them|their|your|our|what|when|where|make|need|want|does|doesn't|don't|it's|let's)\b/gi;

/** Minimum marker count before a verdict is trustworthy. */
export const MIN_MARKERS = 2;

export type Verdict = "de" | "en" | "und";

export interface Classification {
  language: Verdict;
  de_markers: number;
  en_markers: number;
}

/**
 * Classify a prompt.
 *
 * Ties resolve to German, per the rule's own "mixed → dominant; tie → German".
 * Below `MIN_MARKERS` on both sides the verdict is `und` (undetermined) and the
 * caller keeps any previous pin.
 */
/**
 * Strip the parts of a prompt that are PASTED rather than written.
 *
 * Without this the classifier reproduced the very defect it exists to fix: one
 * German instruction plus a pasted English stack trace scored `en=18 / de=2`
 * and pinned English — then asserted emphatically that English was the mirror
 * target. The maintainer's most common prompt shape is exactly that.
 */
export function instructionText(prompt: string): string {
  const OUTPUT_HEAD =
    /^\s*(To\s+\S+|remote:|error:|fatal:|hint:|warning:|npm ERR!|Error:|Traceback|Exception|[A-Za-z]*Error\b|at\s+\S+:\d+|\s{4,}\S|[-+]{3}\s|@@\s|\$\s|>\s|\||\d+\s*\|)/i;
  const kept: string[] = [];
  let inPaste = false;
  for (const line of prompt.replace(/```[\s\S]*?```/g, "\n\n").split("\n")) {
    if (!line.trim()) {
      // A blank line ends a pasted block — this is how pastes actually look,
      // and it is what makes the filter work on a MULTI-LINE trace whose
      // continuation lines carry no marker of their own.
      inPaste = false;
      kept.push(line);
      continue;
    }
    if (OUTPUT_HEAD.test(line)) {
      inPaste = true;
      continue;
    }
    if (inPaste) {
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n");
}


/**
 * Classify a prompt, reading the TYPED LEAD before the whole body.
 *
 * `instructionText` removes output-shaped pastes — traces, diffs, `remote:`
 * lines. It does not remove the other paste shape, which looks like prose: a
 * document pasted whole under its own headings below one typed sentence. That
 * gap is not hypothetical; it fired on the session that received the round-6
 * review, pinning English because an English draft sat under German prose.
 *
 * So the lead is classified first, and only if it is undetermined does the full
 * text decide. This is bidirectional by construction — it names no language, and
 * an English instruction over a German paste resolves to English by the same
 * step. The fallback is what keeps it conservative: a prompt with no document
 * marker classifies exactly as it did before.
 *
 * `stripInjectedRegions` runs FIRST, and the order is load-bearing rather than
 * tidy. A host wrapper the user never typed — `<launch-selected-element>` — is
 * a bare tag line, which `humanAuthoredLead` read as the END of the human lead;
 * prepended, as the host prepends it, that returned an empty lead and handed the
 * verdict to ~4 KB of injected markup. Stripping before `instructionText` also
 * keeps the block's indented lines from arming that filter's paste state, which
 * was deleting the user's own sentence outright.
 */
export function classify(prompt: string): Classification {
  const text = instructionText(stripInjectedRegions(prompt));
  const lead = humanAuthoredLead(text);
  const leadVerdict = _score(lead);
  if (leadVerdict.language !== "und") {
    return leadVerdict;
  }
  return _score(text);
}

function _score(text: string): Classification {
  const de = (text.match(DE_MARKERS) ?? []).length;
  const en = (text.match(EN_MARKERS) ?? []).length;
  if (de < MIN_MARKERS && en < MIN_MARKERS) {
    return { language: "und", de_markers: de, en_markers: en };
  }
  return { language: de >= en ? "de" : "en", de_markers: de, en_markers: en };
}

const LANGUAGE_NAME: Record<Exclude<Verdict, "und">, string> = {
  de: "German (Deutsch)",
  en: "English",
};

/**
 * How a pin came to be — the provenance the roadmap's Phase 4 asks for.
 *
 * `prompt` means the user's own words carried the markers. `system-locale`
 * means they did not and the environment answered instead. The distinction is
 * load-bearing rather than decorative: a locale pin is the one a user may
 * legitimately want to contradict, and the notice says which it is so that
 * contradicting it does not require guessing where it came from.
 */
export type PinSource = "prompt" | "system-locale";

/**
 * The env vars that carry a POSIX locale, most specific first.
 *
 * `LC_ALL` overrides everything by definition; `LC_MESSAGES` governs the
 * language of messages specifically, which is exactly this question; `LANG` is
 * the fallback for both. `LANGUAGE` is deliberately last — it is a GNU
 * extension holding a colon-separated PREFERENCE LIST, so it answers a
 * different question and only its first entry is comparable.
 */
const LOCALE_ENV_KEYS = ["LC_ALL", "LC_MESSAGES", "LANG", "LANGUAGE"] as const;

/**
 * Map an environment locale onto the classifier's verdict space.
 *
 * Returns `und` for a locale the classifier cannot mirror, for `C`/`POSIX`
 * (which name no human language), and for an unset environment. Only the
 * primary subtag is read: `de_AT.UTF-8`, `de-CH`, and `de` are one answer.
 */
export function systemLocaleVerdict(env: NodeJS.ProcessEnv = process.env): Verdict {
  for (const key of LOCALE_ENV_KEYS) {
    const raw = (env[key] ?? "").trim();
    if (!raw) {
      continue;
    }
    // `LANGUAGE` may hold `de:en:fr`; the leading entry is the preference.
    const first = raw.split(":")[0] ?? "";
    // Strip the territory and codeset: `de_AT.UTF-8@euro` → `de`.
    const primary = (first.split(/[._@-]/)[0] ?? "").toLowerCase();
    if (primary === "c" || primary === "posix" || !primary) {
      continue;
    }
    if (primary === "de") {
      return "de";
    }
    if (primary === "en") {
      return "en";
    }
    // A locale the classifier has no markers for. Stop rather than fall
    // through to a less specific variable: the user HAS stated a language and
    // it is neither of the two, so the honest answer is "no pin".
    return "und";
  }
  return "und";
}

/**
 * The one-line notice the dispatcher surfaces for this turn.
 *
 * A locale-sourced pin says so and says how to override it. A prompt-sourced
 * pin keeps its original wording, because that line is what the conformance
 * audit measured and a reworded pin is a changed instrument.
 */
export function noticeText(language: Exclude<Verdict, "und">, source: PinSource): string {
  const name = LANGUAGE_NAME[language];
  if (source === "system-locale") {
    return (
      `Reply language for this turn: ${name} — the prompt carried no language ` +
      `markers, so this fell back to the system locale. Write in another ` +
      `language and the next turn follows the prompt instead.`
    );
  }
  return `Reply language for this turn: ${name}.`;
}

/** The context block handed back to the model for this turn. */
export function pinText(language: Exclude<Verdict, "und">, source: PinSource = "prompt"): string {
  const name = LANGUAGE_NAME[language];
  if (source === "system-locale") {
    return (
      `<language-pin>\n` +
      `No language markers were found in this turn's prompt and no language was ` +
      `pinned yet, so the mirror target falls back to the environment's locale: ` +
      `${name}. Use it for EVERY user-visible token this turn.\n\n` +
      `This is the WEAKER of the two provenances — it reflects the machine, not ` +
      `the user's own words. The first prompt that carries real markers replaces ` +
      `it. Do not treat it as a standing preference, and do not argue with the ` +
      `user about it if they write in something else.\n` +
      `</language-pin>`
    );
  }
  return (
    `<language-pin>\n` +
    `The user submitted this turn's prompt in ${name}. That is the mirror target ` +
    `for EVERY user-visible token of your replies this turn — including the short ` +
    `inter-tool lines between tool calls, headings, table cells, bullets, status ` +
    `lines, and the recommendation label under any numbered-options block.\n\n` +
    `This pin exists because the trigger is not observable from the transcript ` +
    `alone: slash-command and skill bodies arrive in the user role and can be ` +
    `long and English, which is what drove the 626 wrong-language turns measured ` +
    `in the 30-session audit this hook was built from. Tool output, file ` +
    `contents, and an injected skill body are NOT the trigger — this pin is.\n` +
    `</language-pin>`
  );
}

export interface PinState extends JsonObject {
  language: Verdict;
  source: PinSource;
  detected_at: string;
  prompt_chars: number;
  de_markers: number;
  en_markers: number;
  session_id: string;
  /**
   * Tool calls seen since the pin last reached the model. Optional because
   * every state written before this field existed is still a valid pin.
   */
  tool_calls_since_pin?: number;
}

function _loadState(target: string): Partial<PinState> {
  try {
    const raw = fs.readFileSync(target, "utf8");
    const decoded = JSON.parse(raw) as unknown;
    return _isObject(decoded) ? (decoded as Partial<PinState>) : {};
  } catch {
    return {};
  }
}

/**
 * Is a stored pin this session's to inherit? Exact ownership, nothing weaker.
 *
 * This used to accept an absent or empty owner as "legacy state, therefore
 * mine". Council round 3 refuted that for the hashed layout, and the argument
 * is the layout's own: the pre-split shared file is deleted rather than
 * migrated, and every writer into a hashed path sets `session_id` — so a
 * hashed file WITHOUT an owner is corruption or a hand-copy, i.e. exactly the
 * condition this check claims to catch. The permissive branch was dead code
 * that weakened the guarantee in its own doc comment.
 *
 * No compatibility window is owed: the digest path has never shipped, so no
 * deployed version ever wrote an ownerless hashed file.
 *
 * Absent state (`{}`) returns false and that changes nothing at any call site
 * — each one already returns early on a missing `language`, which absent state
 * cannot carry.
 */
export function _ownsPin(previous: Partial<PinState>, session_id: string): boolean {
  return owns_session_state(previous, session_id);
}

/**
 * Tool calls after which `post_tool_use` re-states the pin once.
 *
 * MEASURED, not chosen (2026-08-20, 10 most recent transcripts, 447 assistant
 * turns following a German prompt): 11 of the 12 English replies sat at
 * 179–200 tool calls since the pin, while compliant turns had p90 = 122 and
 * p99 = 184.
 *
 * 150 lies between compliant p90 (122) and the EARLIEST observed violation
 * (179) — deliberately NOT between the two distributions, because they overlap:
 * compliant p99 = 184 is past the violation floor, so some compliant traffic
 * does cross 150 and will be reminded. That is the accepted cost of margin, and
 * saying otherwise was an overclaim both council seats caught (2026-08-20): the
 * earlier wording here read "never inside the band where compliance is already
 * 100 %", which the p99 refutes. A block of 200 tool calls costs ONE re-emit.
 *
 * HONEST BASIS: n = 11, and they cluster in a single long autonomous session.
 * The distance signal is sharp (0 violations below 179) but the corpus is one
 * session wide, so this is "the number the observed failure sits behind", not
 * a fitted optimum.
 *
 * Revisit-if: a violation is recorded BELOW this distance (the threshold is
 * too high), or a session shows the re-emit firing without any violation
 * having been plausible at that distance across ≥ 5 sessions (too low).
 */
export const REEMIT_AFTER_TOOL_CALLS = 150;

/**
 * Decide the next state from the previous one and this turn's classification.
 * Exported so the tests can assert the keep-previous-pin rule directly.
 */
export function nextState(
  previous: Partial<PinState>,
  classification: Classification,
  prompt_chars: number,
  session_id: string,
  now: string,
  locale: Verdict = "und",
): PinState | null {
  if (classification.language === "und") {
    // Terse continuation ("1", "ok", "weiter") — keep whatever was pinned,
    // but ONLY when the pin is this session's own.
    //
    // The state file is ONE file per project root, and in this repo's worktree
    // workflow `CLAUDE_PROJECT_DIR` resolves to the parent checkout — so every
    // concurrent session shares it. Without this check a terse German "3" read
    // a neighbouring English session's pin and injected
    // `Reply language for this turn: English.` into a German conversation
    // (observed 2026-08-20, session 15b9ac52 line 2155). That is the rule
    // inverted, not merely absent, and it is the same cross-session cross-talk
    // R2 finding 10 closed for the pin-lost markers while leaving the language
    // state itself open.
    //
    // An ABSENT `session_id` is FOREIGN, not owned. This comment said the
    // opposite — "treated as owned … only a DIFFERENT id is" — describing the
    // permissive `_ownsPin` that round 3 replaced, and a concurrent session
    // caught it still standing after `owns_session_state` made exact ownership
    // shared. The reasoning it gave (a pre-field state cannot be evidence of
    // another session) no longer applies: every writer into a digest path stamps
    // the owner and that layout never shipped without one, so an unowned file is
    // corruption or a hand-copy, which is precisely what the check is for.
    //
    // Unreachable in practice, and that is why it survived: nothing in the
    // digest layout produces an ownerless file. A comment asserting the inverse
    // of its own code is still a defect — the next reader trusts the prose.
    if (_ownsPin(previous, session_id) && (previous.language === "de" || previous.language === "en")) {
      return null;
    }
    // FIRST turn and nothing to keep: the locale is better than no pin at all.
    if (locale === "und") {
      return null;
    }
    return {
      language: locale,
      source: "system-locale",
      detected_at: now,
      prompt_chars,
      de_markers: classification.de_markers,
      en_markers: classification.en_markers,
      session_id,
      tool_calls_since_pin: 0,
    };
  }
  return {
    language: classification.language,
    source: "prompt",
    detected_at: now,
    prompt_chars,
    de_markers: classification.de_markers,
    en_markers: classification.en_markers,
    session_id,
    tool_calls_since_pin: 0,
  };
}

function _extractPrompt(payload: JsonObject): string {
  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) {
      return v;
    }
  }
  return "";
}

/** The envelope's session id, or a literal bucket when the host sends none. */
function _sessionId(envelope: JsonObject): string {
  const v = envelope["session_id"];
  return typeof v === "string" && v.trim() !== "" ? v : "unknown-session";
}

/**
 * Record that compaction is about to drop the context copy of the pin.
 *
 * R2 finding 14: this used to write with a raw `mkdirSync` + `writeFileSync`,
 * bypassing both conventions the surrounding code follows — the module's own
 * atomic writer, and the `is_replay_mode()` guard that keeps a replayed event
 * from mutating live state. A replayed compaction wrote the marker for real.
 */
/**
 * The pre-R2 layout wrote a single FILE at the path that is now a DIRECTORY.
 * A consumer upgrading with a leftover legacy marker — compaction happened, no
 * `post_tool_use` followed — hits `EEXIST` on the mkdir and `ENOTDIR` on the
 * write (reproduced against Node), which the catch below swallows as
 * "observability only". The failure would then be silent AND permanent for that
 * root: `existsSync` always false, so the mechanism is dead with no diagnostic.
 * One unlink at the moment of collision, and only when the path is a file.
 */
function _migrateLegacyMarker(consumer_root: string): void {
  const legacy = path.join(consumer_root, PIN_LOST_DIR);
  try {
    if (fs.statSync(legacy).isFile()) {
      fs.rmSync(legacy, { force: true });
    }
  } catch {
    // Absent, already a directory, or unreadable — nothing to migrate.
  }
}

export function _setPinLost(consumer_root: string, session_id: string): void {
  if (is_replay_mode()) return;
  _migrateLegacyMarker(consumer_root);
  try {
    atomic_write_text(path.join(consumer_root, pinLostMarker(session_id)), new Date().toISOString());
  } catch (err) {
    // The COST is unchanged and still bounded — one un-restored pin, never a
    // broken turn. What changed on 2026-09-04 is that it stops being silent.
    // The legacy-marker migration above documents exactly how this catch can
    // become PERMANENT for a root (`EEXIST` then `ENOTDIR`, reproduced against
    // Node), and a permanently dead mechanism that never says so is the failure
    // the sibling swallows in `git_authorization_hook` were repaired for.
    process.stderr.write(
      `language-mirror: pin-lost marker write failed (${_errText(err)}) — ` +
        "the pin will NOT be re-emitted after this compaction. Turn outcome unchanged.\n",
    );
  }
}

export function _pinLost(consumer_root: string, session_id: string): boolean {
  try {
    return fs.existsSync(path.join(consumer_root, pinLostMarker(session_id)));
  } catch {
    return false;
  }
}

function _clearPinLost(consumer_root: string, session_id: string): void {
  // R2 round 2, finding 8: the replay guard covered only the WRITE. A replayed
  // `post_tool_use` therefore deleted a live marker it was forbidden to create,
  // and the real session lost the single re-emit this whole mechanism exists to
  // deliver — replay destroying live state while blocked from writing it, which
  // is worse than either direction alone.
  if (is_replay_mode()) return;
  try {
    fs.rmSync(path.join(consumer_root, pinLostMarker(session_id)), { force: true });
  } catch {
    // If it cannot be cleared the next tool call re-emits once more. One
    // duplicate line is the failure mode; a loop is not, because the marker
    // is only ever SET by a compaction event.
  }
}

/**
 * The `post_tool_use` half. Emits the pin exactly once per compaction event
 * and only when a pin actually exists — an absent or undetermined pin is not
 * an obligation, and inventing one here would be worse than the gap.
 */
export function _reEmitAfterCompaction(
  consumer_root: string,
  session_id: string,
  write_json: StateWriter = atomic_write_json,
): number {
  if (!hasStableSessionId(session_id)) {
    return EXIT_ALLOW; // BLOCKER 2 — nothing was persisted, so nothing to restore.
  }
  if (!_pinLost(consumer_root, session_id)) {
    return EXIT_ALLOW;
  }

  // Serialised against any peer tool write for this session, and silent when
  // one holds the lock. Everything below reads,
  // decides and writes inside the lock, so two overlapping post_tool_use calls
  // cannot both advance past the same counter value nor both emit at the
  // threshold.
  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
    const language = previous.language as Verdict | undefined;
    const source: PinSource = previous.source === "system-locale" ? "system-locale" : "prompt";
    // Clear FIRST: if the write below throws, the marker must not survive to
    // re-fire on every subsequent tool call — that is the shape § 6.2 refuses.
    _clearPinLost(consumer_root, session_id);
    if (language !== "de" && language !== "en") {
      return EXIT_ALLOW;
    }
    // A foreign session's pin is not this session's to restore — same reading as
    // `nextState`, for the same shared-state reason.
    if (!_ownsPin(previous, session_id)) {
      return EXIT_ALLOW;
    }
    // The pin is about to be fresh in context again, so the distance counter
    // starts over. Without this the two re-emit triggers would drift apart and
    // a post-compaction session could re-state the pin twice in a row.
    //
    // BLOCKER 4, council round 2: this used to ignore the result and emit anyway.
    // A reset that does not land leaves the counter at 149, so the next successful
    // tool-hook write reaches 150 and emits a SECOND reminder — which contradicts
    // the "compaction wins" invariant this file documents. Same fail-closed policy
    // as the distance path: no durable reset, no emit.
    if (!_resetDistance(consumer_root, previous, session_id, write_json)) {
      return EXIT_ALLOW;
    }
    process.stdout.write(
      `${JSON.stringify({
        decision: "warn",
        reason: noticeText(language, source),
        additional_context: pinText(language, source),
      })}\n`,
    );
    return EXIT_WARN;
  });
}

/**
 * Remove the pre-split single file once this version owns the tree.
 *
 * Not a migration: a new session has no pin to inherit anyway, so there is
 * nothing in the old file worth carrying across. Leaving it would leave dead
 * state that looks live to anyone reading the directory.
 */
export function _pruneLegacyState(consumer_root: string): void {
  prune_legacy_state_file(path.join(consumer_root, STATE_FILE));
}

/**
 * Drop session states untouched for longer than the retention window.
 *
 * One file per session is unbounded growth otherwise. Called on the prompt
 * path only — once per turn, never per tool call.
 */
export function _pruneStaleSessions(
  consumer_root: string,
  now_ms: number,
  /**
   * How a file's age is read. Injectable so the claim-then-revalidate race in
   * the shared pruner is reachable from a test — the branch only runs when the
   * candidate check and the post-claim check DISAGREE, which no cutoff-only
   * test can stage.
   */
  mtimeOf: (target: string) => number = (target) => fs.statSync(target).mtimeMs,
): number {
  return prune_stale_session_states(
    path.join(consumer_root, STATE_DIR),
    now_ms,
    STATE_RETENTION_DAYS,
    mtimeOf,
  );
}

/**
 * Persist a counter value. Returns whether it landed; never raises into the turn.
 *
 * The boolean is load-bearing, and the comment it replaces was a false
 * guarantee (council review 2026-08-20, both seats): "a failed write costs at
 * most one late re-emit" is true for a failed INCREMENT and false for a failed
 * RESET. A reset that does not land leaves the counter at the threshold, so
 * every subsequent tool call re-fires — unbounded repeated reminders, which is
 * exactly the shape § 6.2 refuses. The caller must therefore know.
 */
/**
 * How long a lock file may sit before it is treated as abandoned.
 *
 * A whole hook run is milliseconds, so anything this old belongs to a process
 * that died holding it. Deliberately NOT retried after a break: a retry loop
 * re-opens exactly the window the lock exists to close.
 */
export const LOCK_STALE_MS = 30_000;

/**
 * Serialise the TOOL-side state update for one session.
 *
 * OWN FINDING, not a council one — stated that way on purpose. Round 3 asked
 * both seats about this file and NEITHER named it: the artefact covers the
 * pruner TOCTOU, the crash-stranded tombstones, `_ownsPin`, the foreign-owner
 * test gap and the `chmod` portability, and nothing else. It was first written
 * here as "council round 3 (OpenAI seat)", a peer checked the artefact and
 * refuted that, and the attribution is corrected rather than quietly dropped —
 * a comment claiming a reviewer found something is exactly the kind of false
 * line that let a real blocker survive round 2 of this same file.
 *
 * The defect is real regardless of who found it, and the counter-probe is the
 * evidence: the counter path was a read-decide-write over a snapshot taken at
 * the start of the hook run, with nothing serialising two of them. Two overlapping `post_tool_use` calls both
 * read the same counter and both wrote the same increment (one tool call lost),
 * and at the threshold both read 149, both reset to zero and both emitted —
 * which breaks the one-re-emit-per-block invariant this mechanism is bounded to.
 *
 * The protocol is deliberately ASYMMETRIC, and that is the whole reason it can
 * be this small:
 *
 *   - the PROMPT write is authoritative. A new prompt pin is meant to replace
 *     the state, counter included, so it takes no lock and always wins.
 *   - the TOOL write is defensive. It never replaces a pin, only advances a
 *     counter, so it serialises against other tool writes here and re-reads
 *     the pin inside `_writeDistance` before touching anything.
 *
 * A lock that cannot be taken means a peer is mid-update: return the caller's
 * silent value. A lost reminder is recoverable, a double reminder is the shape
 * § 6.2 refuses.
 */
function _withToolWriteLock<T>(
  consumer_root: string,
  session_id: string,
  when_busy: T,
  body: () => T,
  now_ms: number = Date.now(),
): T {
  const lock = `${path.join(consumer_root, statePathFor(session_id))}.lock`;
  let fd: number;
  const acquire = (): number | null => {
    try {
      fs.mkdirSync(path.dirname(lock), { recursive: true });
      return fs.openSync(lock, "wx");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") return null;
      let age: number;
      try {
        age = now_ms - fs.statSync(lock).mtimeMs;
      } catch {
        return null; // vanished under us — a peer is actively working
      }
      if (age < LOCK_STALE_MS) return null;
      try {
        fs.rmSync(lock, { force: true });
        return fs.openSync(lock, "wx");
      } catch {
        return null; // a peer broke it first and now holds it
      }
    }
  };
  const held = acquire();
  if (held === null) return when_busy;
  fd = held;
  try {
    return body();
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      /* already closed */
    }
    try {
      fs.rmSync(lock, { force: true });
    } catch {
      /* a peer broke a stale lock and owns the path now */
    }
  }
}

export function _writeDistance(
  consumer_root: string,
  /**
   * The pin the CALLER decided against. Used only to detect that the decision
   * has since been overtaken — never as the object that gets written. Passing a
   * snapshot here and writing it back is the defect itself.
   */
  expected: Partial<PinState>,
  session_id: string,
  value: number,
  /**
   * How the counter is persisted. Injectable for the same reason the pruner
   * injects its age reader, and council round 3 asked for exactly this parity:
   * the fail-closed policy is only observable when the write FAILS, and the
   * `chmod 0o500` that used to stage that is silently ineffective for an
   * elevated user — a root CI ran those tests green against any
   * implementation. A thrown error from here reaches the same catch a real
   * ENOSPC or EACCES would.
   */
  write_json: StateWriter = atomic_write_json,
): boolean {
  if (is_replay_mode()) return false;
  // No stable identity → nothing may be persisted (BLOCKER 2). Reported as a
  // failed write so every fail-closed caller stays silent rather than emitting
  // against a counter that cannot be reset.
  if (!hasStableSessionId(session_id)) return false;
  const target = path.join(consumer_root, statePathFor(session_id));
  // Re-read HERE, and build the write from the fresh object — never from the
  // caller's snapshot.
  //
  // This used to spread `previous`, loaded at the top of the hook run. A substantive prompt landing in between
  // writes a NEW pin, and the tool hook then replaced that whole object with
  // the stale one — language, source, timestamp and all. The wrong language
  // came back with no hash collision and no lost update involved, which is the
  // very defect this file exists to close. `atomic_write_json` prevents a torn
  // file; it cannot prevent a stale whole-object replacement.
  const current = _loadState(target);
  // Nothing to advance: no pin, or a pin this session does not own.
  if (!_ownsPin(current, session_id)) return false;
  // The decision was made against a pin that is no longer the live one, so the
  // counter it computed does not describe this state. Report a failed write so
  // every fail-closed caller stays silent; the next tool call re-decides
  // against the new pin. `detected_at` alone would catch a replacement, and
  // language/source are compared as well so a same-millisecond re-pin in a
  // different language cannot slip through.
  if (
    current.detected_at !== expected.detected_at ||
    current.language !== expected.language ||
    current.source !== expected.source
  ) {
    return false;
  }
  try {
    write_json(target, {
      ...current,
      session_id: typeof current.session_id === "string" && current.session_id !== ""
        ? current.session_id
        : session_id,
      tool_calls_since_pin: value,
    } as PinState);
    return true;
  } catch {
    return false;
  }
}

export type StateWriter = (target: string, state: PinState) => void;

function _resetDistance(
  consumer_root: string,
  expected: Partial<PinState>,
  session_id: string,
  write_json: StateWriter = atomic_write_json,
): boolean {
  return _writeDistance(consumer_root, expected, session_id, 0, write_json);
}

/**
 * The distance trigger — the second of the two re-emit paths.
 *
 * WHY THIS IS NOT "the same failed mechanism running more often" (§ 6.2, and
 * the 2026-07-06 reminder-injection null this repo settled at Δ=0): that pilot
 * could not produce a red baseline — kernel-only complied 12/12 — and its own
 * revisit clause reopens the question the moment one is found: *"a real red
 * baseline — e.g. genuine >3K-token distance in a live multi-turn session, or
 * telemetry showing tier-2 obligations missed in production"*. Production
 * transcripts now supply exactly that: 11 English replies to a German user,
 * every one of them 179+ tool calls past the pin, none below it. So this is a
 * measured-gap fix in the regime the null explicitly excluded, not a re-run of
 * the refused shape — which was a re-pin on EVERY tool call, unbounded. This
 * one fires once per `REEMIT_AFTER_TOOL_CALLS` — once per ~200-call block. It
 * does reach some compliant traffic (compliant p99 = 184 > 150); the claim is
 * bounded frequency against a measured red baseline, never zero false fires.
 */
export function _reEmitAfterDistance(
  consumer_root: string,
  session_id: string,
  write_json: StateWriter = atomic_write_json,
): number {
  if (is_replay_mode()) {
    return EXIT_ALLOW;
  }
  // Stateless without an id: no counter to advance, so no distance to measure
  // (BLOCKER 2). The prompt path still pins from a marked prompt.
  if (!hasStableSessionId(session_id)) {
    return EXIT_ALLOW;
  }

  // Serialised against any peer tool write for this session, and silent when
  // one holds the lock. Everything below reads,
  // decides and writes inside the lock, so two overlapping post_tool_use calls
  // cannot both advance past the same counter value nor both emit at the
  // threshold.
  return _withToolWriteLock(consumer_root, session_id, EXIT_ALLOW, () => {    const previous = _loadState(path.join(consumer_root, statePathFor(session_id)));
    const language = previous.language as Verdict | undefined;
    if (language !== "de" && language !== "en") {
      return EXIT_ALLOW;
    }
    if (!_ownsPin(previous, session_id)) {
      return EXIT_ALLOW;
    }
    const seen =
      typeof previous.tool_calls_since_pin === "number" && previous.tool_calls_since_pin >= 0
        ? previous.tool_calls_since_pin
        : 0;
    const advanced = seen + 1;
    const due = advanced >= REEMIT_AFTER_TOOL_CALLS;
    // Write BEFORE emitting, and reset on the same call that emits: if the
    // stdout write throws, the counter must not stay at the threshold and fire
    // on every subsequent tool call.
    const written = _writeDistance(
      consumer_root,
      previous,
      session_id,
      due ? 0 : advanced,
      write_json,
    );
    if (!due) {
      return EXIT_ALLOW;
    }
    // FAIL-CLOSED, stated as a policy rather than left to the catch: if the reset
    // did not land, staying silent loses at most one reminder, while emitting
    // anyway re-fires on every later tool call because the counter is still at
    // the threshold. A lost reminder is recoverable; an unbounded loop is the
    // failure this whole mechanism is bounded to avoid.
    if (!written) {
      return EXIT_ALLOW;
    }
    const source: PinSource = previous.source === "system-locale" ? "system-locale" : "prompt";
    process.stdout.write(
      `${JSON.stringify({
        decision: "warn",
        reason: noticeText(language, source),
        additional_context: pinText(language, source),
      })}\n`,
    );
    return EXIT_WARN;
  });
}

/**
 * `post_tool_use` carries both re-emit triggers. Compaction wins when both are
 * live: it already re-states the pin and resets the distance counter, so
 * running the distance path after it would emit twice for one event.
 */
export function _onToolUse(
  consumer_root: string,
  session_id: string,
  write_json: StateWriter = atomic_write_json,
): number {
  if (_pinLost(consumer_root, session_id)) {
    return _reEmitAfterCompaction(consumer_root, session_id, write_json);
  }
  return _reEmitAfterDistance(consumer_root, session_id, write_json);
}

export function run(
  stdin_text: string,
  options: { consumer_root: string; env?: NodeJS.ProcessEnv; write_json?: StateWriter },
): number {
  let envelope: JsonObject = {};
  if (stdin_text.trim()) {
    try {
      const decoded = JSON.parse(stdin_text) as unknown;
      if (_isObject(decoded)) {
        envelope = decoded;
      }
    } catch {
      return EXIT_ALLOW; // never act on a malformed envelope
    }
  }

  const payload = _isObject(envelope["payload"]) ? (envelope["payload"] as JsonObject) : envelope;

  // round-5 § 6.1 — the compaction boundary.
  //
  // 4 of the 23 post-merge violations happened with NO pin in context: a
  // `compact_boundary` fired and the first violation followed 26 seconds
  // later. Compaction removes the context copy of the pin, not this hook's
  // state file — so this is a state defect with a deterministic fix, aimed
  // only at the subset where the pin was measurably MISSING, never at the 19
  // where it was measurably ignored.
  //
  // The guard IS the design, and is not optional: `pre_compact` sets a
  // marker, `post_tool_use` re-emits once while it is set and clears it. That
  // is one extra injection per compaction EVENT. A re-pin on every tool call
  // is what § 6.2 refuses — "the same failed mechanism running more often" —
  // and this marker is the entire difference between the two.
  const event = typeof envelope["event"] === "string" ? envelope["event"] : "";
  if (event === "pre_compact") {
    _setPinLost(options.consumer_root, _sessionId(envelope));
    return EXIT_ALLOW;
  }
  if (event === "post_tool_use") {
    return _onToolUse(options.consumer_root, _sessionId(envelope), options.write_json);
  }

  const prompt = _extractPrompt(payload);
  if (!prompt) {
    return EXIT_ALLOW;
  }
  // A harness-generated turn is not a chat message. Leave the pin untouched —
  // the same reasoning as an undetermined prompt below, and for the same reason
  // this hook exists at all.
  if (isSyntheticPrompt(prompt)) {
    return EXIT_ALLOW;
  }

  const session_id = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";
  const stateful = hasStableSessionId(session_id);
  // BLOCKER 2: with no stable id there is no file to read or write. The pin for
  // THIS turn still comes from this turn's prompt — that needs no state — but
  // terse-continuation inheritance and the distance counter are both off, since
  // both would have to share one bucket with every other id-less invocation.
  const target = stateful ? path.join(options.consumer_root, statePathFor(session_id)) : "";
  const previous = stateful ? _loadState(target) : {};
  const classification = classify(prompt);
  const next = nextState(
    previous,
    classification,
    prompt.length,
    session_id,
    new Date().toISOString(),
    // Injectable so the suite can pin a locale instead of inheriting the
    // machine's — a test whose verdict depends on the developer's `LANG` is a
    // test that passes here and fails in CI for reasons unrelated to the diff.
    systemLocaleVerdict(options.env ?? process.env),
  );

  // A foreign session's pin is never inherited — see `nextState`. Without this,
  // the `null` "keep" return and a cross-session read are indistinguishable
  // here, which is the path by which an English pin reached a German turn.
  const inherited = _ownsPin(previous, session_id)
    ? (previous.language as Verdict | undefined)
    : undefined;
  const effective = next?.language ?? inherited;
  // A state file written before `source` existed carries only what the old
  // version could produce — a prompt reading. Absent is therefore `prompt`,
  // never "unknown": treating it as unknown would reword the audited notice
  // for every pre-existing session.
  const effectiveSource: PinSource =
    next?.source ?? (previous.source === "system-locale" ? "system-locale" : "prompt");
  if (next && stateful) {
    try {
      atomic_write_json(target, next);
      // Housekeeping runs on the prompt path only — once per turn, not once
      // per tool call — and never before the write it is cleaning up after.
      _pruneLegacyState(options.consumer_root);
      _pruneStaleSessions(options.consumer_root, Date.now());
    } catch (err) {
      // Direction unchanged: the turn is never blocked. But the pin lives ONLY
      // in this file, so a failed write silently reverts the next turn to
      // re-derivation — the user re-states a language they already pinned and
      // has no way to know why. Named rather than swallowed.
      process.stderr.write(
        `language-mirror: pin-state write failed (${_errText(err)}) — ` +
          "the language pin did NOT persist and the next turn re-derives it. " +
          "This turn's notice is unchanged.\n",
      );
    }
  }

  if (effective === "de" || effective === "en") {
    process.stdout.write(
      `${JSON.stringify({ decision: "warn", reason: noticeText(effective, effectiveSource), additional_context: pinText(effective, effectiveSource) })}\n`,
    );
    return EXIT_WARN;
  }
  return EXIT_ALLOW;
}

/**
 * Re-exported from the shared module so this hook and `conformance_scan` cannot
 * classify the same entry differently. It lived here, and the scanner never
 * imported it — that divergence is what Phase 2.1 of round 6 closes. Kept as a
 * named export because it is part of this module's tested surface.
 */
export { isSyntheticPrompt };

/** One-line, bounded rendering of a caught value for a stderr diagnostic. */
function _errText(err: unknown): string {
  const t = err instanceof Error ? err.message : String(err);
  return t.replace(/\s+/g, " ").trim().slice(0, 200);
}

export function main(argv?: string[]): number {
  const args = argv ?? process.argv.slice(2);
  let consumer_root = process.cwd();
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--project-dir" && args[i + 1] !== undefined) {
      consumer_root = args[i + 1] as string;
      i += 1;
    } else if (a !== undefined && a.startsWith("--project-dir=")) {
      consumer_root = a.slice("--project-dir=".length);
    }
  }
  return run(readHookStdin(), { consumer_root });
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) {
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
