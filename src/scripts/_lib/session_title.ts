/**
 * Refined session titles — the shared half of the `session-title` concern and
 * the `session:title` CLI.
 *
 * Claude Code writes its `ai-title` once, early, and then repeats the same value
 * for the rest of the session, so a title chosen from the first prompt is the
 * title forever. This module lets the agent replace it as the session's goal
 * becomes clear, under one invariant: a title the USER set (`/rename`, recorded
 * as a `custom-title` line) is final, and nothing here ever overrides it.
 *
 * Two files, deliberately separate:
 *
 * - the SIDECAR beside the transcript (`<session>.agent-title.json`) is the
 *   published title. It sits next to the `.jsonl` so any reader that already
 *   resolved a transcript (the session catalog, Agent Switch) finds it without
 *   knowing this package's paths. The transcript itself is never written to:
 *   Claude Code keeps re-appending its cached `ai-title`, which would bury an
 *   appended line within a turn.
 * - the STATE file under the user-global root counts prompts and maps the
 *   session id to its transcript, so the CLI needs nothing but the id.
 *
 * Privacy: neither file holds prompt or reply text — a title, a counter, a path.
 */
import fs from "node:fs";
import path from "node:path";
import { write_atomic } from "./fs_atomic.js";
import { event4u_root } from "./user_global_paths.js";

export const SETTING_KEY = "sessions.auto_title";
export const SIDECAR_SUFFIX = ".agent-title.json";
export const TITLE_MAX = 80;

/**
 * Prompt counts at which the agent is asked to reconsider the title. Spaced
 * out because a title should change when the session learned something, not on
 * a clock: early milestones catch the goal settling, later ones the scope
 * moving. Past the last entry the cadence repeats every `REPEAT_EVERY` prompts.
 */
export const MILESTONES: readonly number[] = [3, 8, 20, 45, 100];
export const REPEAT_EVERY = 100;

export function isMilestone(prompt: number): boolean {
  if (MILESTONES.includes(prompt)) return true;
  const last = MILESTONES[MILESTONES.length - 1] as number;
  return prompt > last && (prompt - last) % REPEAT_EVERY === 0;
}

/** A session id as a filename stem; anything else collapses to `_`. */
export function safeId(sessionId: string): string {
  return sessionId.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_").slice(0, 128) || "_";
}

export function sidecarPath(transcriptPath: string): string {
  return transcriptPath.replace(/\.jsonl$/, "") + SIDECAR_SUFFIX;
}

/** Control characters and runaway length stripped; empty → null. */
export function sanitizeTitle(raw: string): string | null {
  const t = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  if (t === "") return null;
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t;
}

export interface SessionTitleState {
  session_id: string;
  transcript_path: string | null;
  prompts: number;
  last_nudge_prompt: number;
}

export function stateDir(root: string = event4u_root()): string {
  return path.join(root, "state", "session-titles");
}

export function readState(sessionId: string, root?: string): SessionTitleState | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(stateDir(root), `${safeId(sessionId)}.json`), "utf8"));
    if (typeof raw !== "object" || raw === null || raw.session_id !== sessionId) return null;
    return {
      session_id: sessionId,
      transcript_path: typeof raw.transcript_path === "string" ? raw.transcript_path : null,
      prompts: Number.isInteger(raw.prompts) && raw.prompts >= 0 ? raw.prompts : 0,
      last_nudge_prompt: Number.isInteger(raw.last_nudge_prompt) ? raw.last_nudge_prompt : 0,
    };
  } catch {
    return null;
  }
}

export function writeState(state: SessionTitleState, root?: string): void {
  write_atomic(path.join(stateDir(root), `${safeId(state.session_id)}.json`), `${JSON.stringify(state)}\n`);
}

export interface RefinedTitle {
  title: string;
  updated_at: string;
  revision: number;
}

export function readRefinedTitle(transcriptPath: string): RefinedTitle | null {
  try {
    const raw = JSON.parse(fs.readFileSync(sidecarPath(transcriptPath), "utf8"));
    const title = typeof raw?.title === "string" ? sanitizeTitle(raw.title) : null;
    if (title === null) return null;
    return {
      title,
      updated_at: typeof raw.updated_at === "string" ? raw.updated_at : "",
      revision: Number.isInteger(raw.revision) ? raw.revision : 1,
    };
  } catch {
    return null;
  }
}

export function writeRefinedTitle(transcriptPath: string, sessionId: string, title: string, now: Date = new Date()): RefinedTitle {
  const prev = readRefinedTitle(transcriptPath);
  const next: RefinedTitle = { title, updated_at: now.toISOString(), revision: (prev?.revision ?? 0) + 1 };
  write_atomic(sidecarPath(transcriptPath), `${JSON.stringify({ schema: 1, session_id: sessionId, ...next })}\n`);
  return next;
}

export interface HostTitles {
  /** The user's own title (`/rename`); when set, the session title is frozen. */
  custom: string | null;
  /** The host's latest generated title. */
  ai: string | null;
}

const CHUNK = 1 << 20;
const CUSTOM_MARK = '"type":"custom-title"';
const AI_MARK = '"type":"ai-title"';

function titleFrom(line: string, key: string): string | null {
  try {
    const v = JSON.parse(line)?.[key];
    return typeof v === "string" ? sanitizeTitle(v) : null;
  } catch {
    return null;
  }
}

/**
 * The host-side titles in one streaming pass. Only lines carrying a marker are
 * parsed, so a 20 MB transcript costs a byte scan, not 20 MB of JSON. The last
 * occurrence of each wins, as it does for the host.
 */
export function readHostTitles(transcriptPath: string): HostTitles {
  const out: HostTitles = { custom: null, ai: null };
  let fd: number;
  try {
    fd = fs.openSync(transcriptPath, "r");
  } catch {
    return out;
  }
  try {
    const buf = Buffer.alloc(CHUNK);
    let carry = "";
    for (;;) {
      const n = fs.readSync(fd, buf, 0, CHUNK, null);
      if (n === 0) break;
      const text = carry + buf.subarray(0, n).toString("utf8");
      const lines = text.split("\n");
      carry = lines.pop() ?? "";
      for (const line of lines) scanLine(line, out);
    }
    if (carry !== "") scanLine(carry, out);
  } catch {
    // A transcript that cannot be read leaves whatever was found so far.
  } finally {
    fs.closeSync(fd);
  }
  return out;
}

function scanLine(line: string, out: HostTitles): void {
  if (line.includes(CUSTOM_MARK)) out.custom = titleFrom(line, "customTitle") ?? out.custom;
  else if (line.includes(AI_MARK)) out.ai = titleFrom(line, "aiTitle") ?? out.ai;
}

/** The title a reader should show: user's own > refined > host-generated. */
export function effectiveTitle(transcriptPath: string): { title: string | null; source: "custom" | "refined" | "ai" | null } {
  const host = readHostTitles(transcriptPath);
  if (host.custom !== null) return { title: host.custom, source: "custom" };
  const refined = readRefinedTitle(transcriptPath);
  if (refined !== null) return { title: refined.title, source: "refined" };
  return host.ai !== null ? { title: host.ai, source: "ai" } : { title: null, source: null };
}

/** `false` only when the setting is explicitly off; absent means on. */
export function autoTitleEnabled(settings: Record<string, unknown>): boolean {
  const sessions = settings["sessions"];
  if (typeof sessions !== "object" || sessions === null) return true;
  const v = (sessions as Record<string, unknown>)["auto_title"];
  return !(v === false || v === "false" || v === "off");
}
