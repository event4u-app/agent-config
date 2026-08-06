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
  { op: "commit", re: /\b(commit(e|et|te|ten)?|committe|einchecken)\b/i },
  { op: "push", re: /\b(push(e|en|t)?|hochladen|hochschieben|raufschieben)\b/i },
  { op: "branch", re: /\b(branch|feature-branch|zweig)\b/i },
  // A creation verb is required — "schau dir den PR an" is not "open a PR".
  {
    op: "pr-create",
    re: /\b(erstell(e|en)?|mach(e|en)?|leg(e|en)?\s+an|(er)?(ö|oe)ffne|open|create|raise|aufmachen)\b[^.\n]{0,30}\b(pr|pull[- ]request)\b|\b(pr|pull[- ]request)\b[^.\n]{0,20}\b(erstellen|aufmachen|anlegen|(er)?(ö|oe)ffnen)\b/i,
  },
  // `merge` as an ACTION, never as the noun in "merge conflict" / "merge commit".
  { op: "pr-merge", re: /\b(merge|merg(e|en|st|t)|zusammenf(ü|ue)hren|reinmergen)\b(?!\s*[- ]?(conflict|konflikt|commit|base|queue|state|status))/i },
  // A tag is an ACTION here — bare "Tag" is the German word for day, and
  // "Version" is an ordinary noun. Both authorized a BLOCK op before this.
  { op: "tag", re: /\b(tagge(n|st)?|tag\s+(setzen|anlegen|erstellen)|git\s+tag|--tags|--follow-tags)\b/i },
  // "die release notes sind falsch" is a noun phrase, not an authorization.
  {
    op: "release",
    re: /\b(releasen?|ver(ö|oe)ffentlich(e|en))\b(?!\s*[- ]?(notes?|branch|candidate|pr\b|datum|date|zweig))/i,
  },
  { op: "publish", re: /\b(publish(e|en)?|publiziere[n]?)\b/i },
];

/**
 * Lines that are pasted TOOL OUTPUT rather than the user instructing.
 *
 * Round-2 adversarial review: an UNFENCED paste of a `git push … rejected`
 * trace authorized `push` through the prose matcher — i.e. the gate
 * pre-authorized the exact scenario it was built to stop. Fenced pastes were
 * already handled; prose was not.
 */
const OUTPUT_LINE =
  /^\s*(To\s+\S+|remote:|error:|fatal:|hint:|warning:|!\s|\?\?\s|\s*\^|[-+]{3}\s|@@\s|\$\s|>\s|\d+\s+(pass|fail)|npm ERR!|Error:|Traceback|at\s+\S+:\d+)/i;

/**
 * A prompt that ASKS about an operation does not authorize it.
 *
 * `question-not-instruction` states this for the agent; the ledger needs it
 * too. "was macht npm publish eigentlich genau?" authorized a real publish
 * before this check.
 */
export function isInterrogative(prose: string): boolean {
  const t = prose.trim();
  if (!t) {
    return false;
  }
  const hasImperative =
    /\b(mach|mache|bitte|leg|lege|erstell|erstelle|f(ü|ue)hr|f(ü|ue)hre|setz|setze|starte|los|jetzt|go ahead|do it|ja[,.]?\s|ok[,.]?\s)\b/i.test(
      t,
    );
  if (hasImperative) {
    return false;
  }
  return (
    /\?\s*$/.test(t) ||
    /^(was|wie|warum|wieso|weshalb|wann|wer|welche[rs]?|wo|ist|sind|kann|kannst|k(ö|oe)nnen|soll|sollen|darf|d(ü|ue)rfen|why|what|how|when|which|who|is|are|can|could|should|does|do)\b/i.test(
      t,
    )
  );
}

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

  // Drop pasted tool output from the prose before matching (C4), then refuse
  // to read a question as an instruction (C3).
  const instruction = prose
    .split("\n")
    .filter((l) => !OUTPUT_LINE.test(l))
    .join("\n");

  for (const { op, re } of isInterrogative(instruction) ? [] : PHRASES) {
    const m = re.exec(instruction);
    if (m) {
      authorized.add(op);
      evidence[op] = `prose: "${m[0]}"`;
    }
  }

  for (const fence of fences) {
    // A fence that also carries tool OUTPUT is a transcript of something that
    // already happened, not a command the user is handing over. Pasting
    //   $ git push origin main
    //   ! [rejected] …
    // is showing a failure, and reading it as "authorized push" is exactly the
    // implicit-continuation misread this gate exists to stop.
    if (fence.split("\n").some((l) => OUTPUT_LINE.test(l))) {
      continue;
    }
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
