/**
 * intake-pass — one line on a task prompt reminding the agent to sort the
 * prompt's gaps before the first write, and to ask the owner only the one that
 * is theirs. Owner decision OQ-25 (2026-10-28): shipped in the package's own
 * hooks, on by default, no settings key, and the agent decides whether a gap
 * is owner-owned — the hook never appends "interview me" to the prompt.
 *
 * Silent on questions, continuations, slash commands, harness turns and
 * prompts that already ask for an interview (those route to /challenge-me).
 * Kill switch: `AGENT_CONFIG_NO_INTAKE_PASS=1`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readHookStdin } from "./hook_stdin.js";
import { isSyntheticPrompt } from "../_lib/prompt_shape.js";
import { EXIT_ALLOW, EXIT_WARN } from "./exit_codes.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

// Below this many words a prompt is a reply to the agent, not a task.
export const MIN_TASK_WORDS = 6;

// A resume order is a continuation at any length. A short acknowledgement ("ok",
// "go ahead", "2") falls under MIN_TASK_WORDS; a longer one carries a task.
const RESUME = /^(?:mach(?:e)?\s+weiter|weiter\b|continue\b|go\s+on\b)/i;
const INTERROGATIVE = /^(?:why|what|how|which|who|where|when|is|are|does|do|can|could|should|would|warum|wieso|weshalb|was|wie|welche[rsmn]?|wer|wo|wann|ist|sind|gibt|kann|kannst|könntest|sollte|soll|geht)\b/i;
const INTERVIEW = /\b(?:interview\s+(?:me|mich)|r[üu]ckfragen|frag\s+mich|ask\s+me\s+follow-up|challenge\s+me|grill\s+me)\b/i;
const RELEASE = /\b(?:just\s+do\s+it|mach\s+einfach|einfach\s+machen|no\s+questions|don'?t\s+ask|do\s+not\s+ask|without\s+asking|proceed\s+autonomously|keine\s+(?:r[üu]ck)?fragen|ohne\s+(?:r[üu]ck)?(?:fragen|nachfragen)|frag\s+nicht)\b/i;

export const INTAKE_LINE =
  "<intake-pass>Before the first write, sort this prompt's gaps: a fact → look it up; " +
  "a technical choice → decide it and name it as your call in the hand-back; " +
  "an owner-owned gap (product meaning, a business constraint, taste) → ask ONE question first, " +
  "native picker, one recommendation. No owner gap → proceed and list your assumptions.</intake-pass>";

function lastSentence(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim() !== "");
  return (parts[parts.length - 1] ?? text).trim();
}

/**
 * A question is answered, never worked on (rule `question-not-instruction`), so
 * the pass stays silent on one — including a polite request phrased as a
 * question, which the agent answers or clarifies first. A prompt counts as a
 * question when its last sentence ends in `?` or its first word is interrogative.
 */
export function isQuestion(text: string): boolean {
  return /\?\s*$/.test(lastSentence(text)) || INTERROGATIVE.test(text);
}

export function isTaskPrompt(prompt: string): boolean {
  const text = prompt.trim();
  if (!text || text.startsWith("/")) return false;
  if (isSyntheticPrompt(text)) return false;
  const words = text.split(/\s+/).length;
  if (RESUME.test(text)) return false;
  if (words < MIN_TASK_WORDS) return false;
  if (isQuestion(text)) return false;
  if (INTERVIEW.test(text) || RELEASE.test(text)) return false;
  return true;
}

function _isObject(v: JsonValue | undefined): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function _extractPrompt(payload: JsonObject): string {
  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

export function main(): number {
  if (process.env["AGENT_CONFIG_NO_INTAKE_PASS"] === "1") return EXIT_ALLOW;
  let envelope: JsonValue = {};
  try {
    const raw = readHookStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    return EXIT_ALLOW;
  }
  const env: JsonObject = _isObject(envelope) ? envelope : {};
  const event = env["event"];
  if (typeof event === "string" && event !== "" && event !== "user_prompt_submit") return EXIT_ALLOW;
  const payload = _isObject(env["payload"]) ? (env["payload"] as JsonObject) : env;
  if (!isTaskPrompt(_extractPrompt(payload))) return EXIT_ALLOW;
  process.stdout.write(
    `${JSON.stringify({ decision: "warn", reason: "intake-pass: task prompt", additional_context: INTAKE_LINE })}\n`,
  );
  return EXIT_WARN;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle.
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
  if (typeof __AGENT_CONFIG_BUNDLE__ !== "undefined" && __AGENT_CONFIG_BUNDLE__) return false;
  if (process.argv[1] === undefined) return false;
  if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
  } catch {
    return false;
  }
}

if (_isCliEntry()) {
  process.exit(main());
}
