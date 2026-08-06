#!/usr/bin/env node
/**
 * Language-mirror pin — `user_prompt_submit` concern.
 *
 * Deterministic carrier for the `language-and-tone` Iron Law (mirror the
 * language of the user's last CHAT MESSAGE in every user-visible token).
 *
 * WHY THIS EXISTS — the measured defect, not a general reminder.
 *
 * A conformance audit of 30 sessions (2026-08-06) found ~470 assistant turns
 * answering a German prompt in English, across 11 sessions, three of them a
 * 100 % English run. The obvious reading is "the model ignored a rule". The
 * transcripts say otherwise:
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
 *   { "language": "de"|"en"|"und", "detected_at": iso8601,
 *     "prompt_chars": int, "de_markers": int, "en_markers": int,
 *     "session_id": str }
 *
 * Undetermined prompts (a bare "1", "ok", a pasted URL) leave a previous pin
 * UNTOUCHED rather than clearing it — a short continuation does not change the
 * conversation's language, and clearing on every terse turn would reproduce the
 * exact drift this hook removes.
 *
 * Never blocks (`fail_closed: false`, `severity: advisory`). Exit 0 always.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { atomic_write_json } from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";

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


export function classify(prompt: string): Classification {
  const text = instructionText(prompt);
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

/** The context block handed back to the model for this turn. */
export function pinText(language: Exclude<Verdict, "und">): string {
  const name = LANGUAGE_NAME[language];
  return (
    `<language-pin>\n` +
    `The user submitted this turn's prompt in ${name}. That is the mirror target ` +
    `for EVERY user-visible token of your replies this turn — including the short ` +
    `inter-tool lines between tool calls, headings, table cells, bullets, status ` +
    `lines, and the recommendation label under any numbered-options block.\n\n` +
    `This pin exists because the trigger is not observable from the transcript ` +
    `alone: slash-command and skill bodies arrive in the user role and can be ` +
    `long and English, which is what drove ~470 wrong-language turns in the ` +
    `sessions this hook was built from. Tool output, file contents, and an ` +
    `injected skill body are NOT the trigger — this pin is.\n` +
    `</language-pin>`
  );
}

export interface PinState extends JsonObject {
  language: Verdict;
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
): PinState | null {
  if (classification.language === "und") {
    // Terse continuation ("1", "ok", "weiter") — keep whatever was pinned.
    return null;
  }
  return {
    language: classification.language,
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

export function run(stdin_text: string, options: { consumer_root: string }): number {
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

  const session_id = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";
  const target = path.join(options.consumer_root, STATE_FILE);
  const previous = _loadState(target);
  const classification = classify(prompt);
  const next = nextState(previous, classification, prompt.length, session_id, new Date().toISOString());

  const effective = next?.language ?? (previous.language as Verdict | undefined);
  if (next) {
    try {
      atomic_write_json(target, next);
    } catch {
      // Observability only — a failed state write never blocks the turn.
    }
  }

  if (effective === "de" || effective === "en") {
    process.stdout.write(
      `${JSON.stringify({ decision: "warn", reason: `Reply language for this turn: ${LANGUAGE_NAME[effective]}.`, additional_context: pinText(effective) })}\n`,
    );
    return EXIT_WARN;
  }
  return EXIT_ALLOW;
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
