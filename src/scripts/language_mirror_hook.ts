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

import { atomic_write_json } from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";
import { humanAuthoredLead, isSyntheticPrompt } from "./_lib/prompt_shape.js";

const EXIT_ALLOW = 0;
// Severity is taken from the EXIT CODE, not from the `decision` field in the
// stdout payload. This hook shipped returning EXIT_ALLOW while writing
// {"decision":"warn", …}, so the dispatcher reduced it to `allow`, emitted
// nothing, and the pin reached the model on no path — a state write with no
// delivery, for the audit's largest failure class (626 turns). Round 2, found
// by tracing the delivery rather than re-reading the unit tests.
const EXIT_WARN = 2;

export const STATE_FILE = path.join("agents", "state", "language-mirror.json");

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
 */
export function classify(prompt: string): Classification {
  const text = instructionText(prompt);
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
    // Terse continuation ("1", "ok", "weiter") — keep whatever was pinned.
    if (previous.language === "de" || previous.language === "en") {
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

export function run(
  stdin_text: string,
  options: { consumer_root: string; env?: NodeJS.ProcessEnv },
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
  const target = path.join(options.consumer_root, STATE_FILE);
  const previous = _loadState(target);
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

  const effective = next?.language ?? (previous.language as Verdict | undefined);
  // A state file written before `source` existed carries only what the old
  // version could produce — a prompt reading. Absent is therefore `prompt`,
  // never "unknown": treating it as unknown would reword the audited notice
  // for every pre-existing session.
  const effectiveSource: PinSource =
    next?.source ?? (previous.source === "system-locale" ? "system-locale" : "prompt");
  if (next) {
    try {
      atomic_write_json(target, next);
    } catch {
      // Observability only — a failed state write never blocks the turn.
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
