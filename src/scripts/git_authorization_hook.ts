#!/usr/bin/env node
/**
 * Git-authorization ledger — `user_prompt_submit` concern.
 *
 * Records which git operations the user's OWN WORDS authorize this turn, so
 * `hooks/block_unauthorized_git.ts` can check an operation against a fact
 * instead of against the model's recollection of the conversation.
 *
 * WHY — the measured defect (30-session conformance audit, 2026-08-06):
 *
 *   - A full release chain (prod-trunk merge, tag push, GitHub release, npm
 *     publish) executed after the agent itself wrote "das ist ein Hard-Floor-
 *     Schritt, dafür brauche ich Dein explizites Go" and never received one —
 *     the user's next turn was a pasted `git push … rejected` stack trace,
 *     which was read as implicit continuation.
 *   - Two complete PRs opened on turns carrying no git authorization at all.
 *   - Force-push over a bot's commits off a bare "fixe auch diese 4 pr's".
 *   - Twice the constraint was named in writing and contradicted minutes later.
 *
 * `commit-policy` and `scope-control` already forbid all of this in prose, and
 * the prose was in context every time. The ledger is the missing fact, not a
 * new obligation.
 *
 * State: `agents/state/git-authorization.json`
 *   { "session_id": str, "detected_at": iso8601, "authorized": [op, …],
 *     "evidence": { op: "phrase" }, "prompt_chars": int }
 *
 * Each user turn REPLACES the ledger — that is the point. `commit-policy`'s
 * "one-shot authorization is not a standing license" says an authorization is
 * spent on the operation it named; carrying it forward is the exact inference
 * the rule forbids, so a new prompt with no authorization phrase yields an
 * empty ledger rather than an inherited one.
 *
 * Never blocks. Exit 0 always. The blocking half lives in the pre_tool_use
 * concern, which is where the operation is actually observable.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { atomic_write_json } from "./hooks/state_io.js";
import { readHookStdin } from "./hooks/hook_stdin.js";

const EXIT_ALLOW = 0;

export const STATE_FILE = path.join("agents", "state", "git-authorization.json");

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The operations the ledger can authorize. */
export type GitOp =
  | "commit"
  | "push"
  | "branch"
  | "pr-create"
  | "pr-merge"
  | "tag"
  | "release"
  | "publish";

export const ALL_OPS: readonly GitOp[] = [
  "commit",
  "push",
  "branch",
  "pr-create",
  "pr-merge",
  "tag",
  "release",
  "publish",
];

/**
 * Prose phrases, German and English, that authorize an operation.
 *
 * Deliberately a keyword list rather than an LLM judge: the classifier runs on
 * every prompt and must be cheap, deterministic and reviewable. A miss costs a
 * warn (or, on the irreversible subset, one confirmation); an LLM judge would
 * cost latency on every turn and be unauditable.
 */
const PHRASES: ReadonlyArray<{ op: GitOp; re: RegExp }> = [
  { op: "commit", re: /\b(commit(e|et|ten|ted|ting)?|committe|einchecken)\b/i },
  { op: "push", re: /\b(push(e|en|ed|ing)?|hochladen|hochschieben|raufschieben)\b/i },
  { op: "branch", re: /\b(branch(e|es)?|zweig|feature-branch|erstelle einen branch)\b/i },
  { op: "pr-create", re: /\b(pull[- ]request|pr\b|mach(e|en)? (einen|nen) pr|erstelle .{0,20}pr)\b/i },
  { op: "pr-merge", re: /\b(merge[nrd]?|mergen|zusammenführen|zusammenfuehren|reinmergen|gemerged)\b/i },
  { op: "tag", re: /\b(tag(ge|gen|ged|ging)?|version(iere|ieren)?)\b/i },
  { op: "release", re: /\b(release[nd]?|releasen|veröffentlich(e|en|ung)|veroeffentlich(e|en))\b/i },
  { op: "publish", re: /\b(publish(e|en|ed|ing)?|npm publish|publiziere[n]?)\b/i },
];

/** Executable commands a user may paste, mapped to the op they authorize. */
const PASTED_COMMANDS: ReadonlyArray<{ op: GitOp; re: RegExp }> = [
  { op: "publish", re: /\bnpm\s+publish\b/i },
  { op: "tag", re: /\bgit\s+push\s+[^\n]*--tags\b|\bgit\s+tag\s+-a\b/i },
  { op: "release", re: /\bgh\s+release\s+create\b/i },
  { op: "pr-merge", re: /\bgh\s+pr\s+merge\b/i },
  { op: "pr-create", re: /\bgh\s+pr\s+create\b/i },
  { op: "push", re: /\bgit\s+push\b/i },
  { op: "commit", re: /\bgit\s+commit\b/i },
  { op: "branch", re: /\bgit\s+(checkout\s+-b|switch\s+-c|branch)\b/i },
];

/**
 * Split a prompt into prose and fenced-code regions.
 *
 * The council's point: a user who PASTES an executable `git push origin main`
 * is authorizing that command; the same literal appearing inside a log line or
 * an error trace is not authorization. The discriminator used here is whether
 * the line reads as a command invocation (starts at the command, optionally
 * after a shell prompt marker) rather than being embedded in prose or in a
 * `remote:` / `error:` / `hint:` diagnostic line.
 */
export function splitFences(prompt: string): { prose: string; fences: string[] } {
  const fences: string[] = [];
  const prose = prompt.replace(/```[^\n]*\n([\s\S]*?)```/g, (_m, body: string) => {
    fences.push(body);
    return " ";
  });
  return { prose, fences };
}

/** A fenced line that is an actual command invocation, not diagnostic output. */
function _commandLines(fence: string): string[] {
  return fence
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    // Drop git/npm diagnostic output — this is what "pasted an error trace" looks like.
    .filter((l) => !/^(remote:|error:|hint:|fatal:|warning:|To |!\s|\s*\^)/i.test(l))
    // Strip a leading shell prompt marker.
    .map((l) => l.replace(/^[$>#]\s*/, ""))
    // Keep only lines that START with the command.
    .filter((l) => /^(git|gh|npm|pnpm|yarn|task)\b/.test(l));
}

export interface Ledger extends JsonObject {
  session_id: string;
  detected_at: string;
  authorized: GitOp[];
  evidence: { [op: string]: string };
  prompt_chars: number;
}

/** Classify which ops a prompt authorizes. Exported for direct testing. */
export function classifyAuthorization(prompt: string): {
  authorized: GitOp[];
  evidence: Record<string, string>;
} {
  const { prose, fences } = splitFences(prompt);
  const authorized = new Set<GitOp>();
  const evidence: Record<string, string> = {};

  for (const { op, re } of PHRASES) {
    const m = re.exec(prose);
    if (m) {
      authorized.add(op);
      evidence[op] = `prose: "${m[0]}"`;
    }
  }

  for (const fence of fences) {
    for (const line of _commandLines(fence)) {
      for (const { op, re } of PASTED_COMMANDS) {
        if (re.test(line)) {
          authorized.add(op);
          evidence[op] = `pasted command: "${line.slice(0, 80)}"`;
        }
      }
    }
  }

  return { authorized: [...authorized], evidence };
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
      return EXIT_ALLOW;
    }
  }

  const payload = _isObject(envelope["payload"]) ? (envelope["payload"] as JsonObject) : envelope;
  let prompt = "";
  for (const key of ["prompt", "userPrompt", "user_prompt", "message", "text"]) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) {
      prompt = v;
      break;
    }
  }
  if (!prompt) {
    return EXIT_ALLOW;
  }

  const { authorized, evidence } = classifyAuthorization(prompt);
  const ledger: Ledger = {
    session_id: typeof envelope["session_id"] === "string" ? envelope["session_id"] : "",
    detected_at: new Date().toISOString(),
    authorized,
    evidence,
    prompt_chars: prompt.length,
  };

  try {
    atomic_write_json(path.join(options.consumer_root, STATE_FILE), ledger);
  } catch {
    // Observability only — a failed write degrades the gate to "no ledger",
    // which the pre_tool_use concern treats as "not authorized" for the
    // irreversible subset and as a warn for the rest.
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
