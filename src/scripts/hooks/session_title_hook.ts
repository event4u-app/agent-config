/**
 * session-title — asks the agent, at a few prompt milestones, whether the
 * session title can now be named more precisely, and how to set it.
 *
 * The agent writes the title (`agent-config session:title`); this concern only
 * counts prompts and decides when to ask. It stays silent once the user renamed
 * the session — a user-set title is final — and when `sessions.auto_title` is
 * `false` (a global setting, on by default). Never blocks: every failure path
 * returns allow.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { readHookStdin } from "./hook_stdin.js";
import { isSyntheticPrompt } from "../_lib/prompt_shape.js";
import { load_agent_settings } from "../_lib/agent_settings.js";
import {
  autoTitleEnabled,
  isMilestone,
  pruneState,
  readHostTitles,
  readRefinedTitle,
  readState,
  tailHasCustomTitle,
  writeState,
  type SessionTitleState,
} from "../_lib/session_title.js";
import { EXIT_ALLOW, EXIT_WARN } from "./exit_codes.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: JsonValue | undefined): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function _str(v: JsonValue | undefined): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function _extractPrompt(payload: JsonObject): string {
  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

export function nudgeLine(sessionId: string, prompt: number, current: string | null): string {
  const now = current === null ? "none yet" : `«${current}»`;
  return (
    `<session-title>Prompt ${prompt}: the session title is ${now}. If what you now know names this ` +
    `session's goal more precisely, run \`agent-config session:title --session ${sessionId} "<title>"\` once ` +
    `alongside your work — at most 60 characters, in the user's language, naming the deliverable rather than ` +
    `the activity. Still accurate → do nothing. Do not mention this to the user.</session-title>`
  );
}

export interface TickInput {
  sessionId: string;
  transcriptPath: string;
  prompt: string;
  root?: string;
}

/** One prompt counted; returns the nudge to inject, or null. */
export function tick(input: TickInput): string | null {
  const text = input.prompt.trim();
  if (text === "" || isSyntheticPrompt(text)) return null;
  const prev = readState(input.sessionId, input.root);
  if (prev?.frozen === true) return null;
  if (tailHasCustomTitle(input.transcriptPath)) {
    if (prev !== null) writeState({ ...prev, transcript_path: input.transcriptPath, frozen: true }, input.root);
    else writeState({ session_id: input.sessionId, transcript_path: input.transcriptPath, prompts: 0, last_nudge_prompt: 0, frozen: true }, input.root);
    return null;
  }
  const state: SessionTitleState = {
    session_id: input.sessionId,
    transcript_path: input.transcriptPath,
    prompts: (prev?.prompts ?? 0) + 1,
    last_nudge_prompt: prev?.last_nudge_prompt ?? 0,
    frozen: false,
  };
  let nudge: string | null = null;
  if (isMilestone(state.prompts)) {
    const host = readHostTitles(input.transcriptPath);
    if (host.custom === null) {
      nudge = nudgeLine(input.sessionId, state.prompts, readRefinedTitle(input.transcriptPath)?.title ?? host.ai);
      state.last_nudge_prompt = state.prompts;
      pruneState(input.root);
    } else {
      state.frozen = true;
    }
  }
  writeState(state, input.root);
  return nudge;
}

export function main(): number {
  let envelope: JsonValue = {};
  try {
    const raw = readHookStdin();
    envelope = raw.trim() ? (JSON.parse(raw) as JsonValue) : {};
  } catch {
    return EXIT_ALLOW;
  }
  try {
    const env: JsonObject = _isObject(envelope) ? envelope : {};
    const event = env["event"];
    if (typeof event === "string" && event !== "" && event !== "user_prompt_submit") return EXIT_ALLOW;
    const payload = _isObject(env["payload"]) ? (env["payload"] as JsonObject) : env;
    const sessionId = _str(env["session_id"]) ?? _str(payload["session_id"]);
    const transcriptPath = _str(payload["transcript_path"]);
    if (sessionId === null || transcriptPath === null) return EXIT_ALLOW;
    const root = _str(env["workspace_root"]) ?? process.cwd();
    if (!autoTitleEnabled(load_agent_settings({ cwd: root }) as Record<string, unknown>)) return EXIT_ALLOW;
    const nudge = tick({ sessionId, transcriptPath, prompt: _extractPrompt(payload) });
    if (nudge === null) return EXIT_ALLOW;
    process.stdout.write(
      `${JSON.stringify({ decision: "warn", reason: "session-title: milestone", additional_context: nudge })}\n`,
    );
    return EXIT_WARN;
  } catch {
    return EXIT_ALLOW;
  }
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
