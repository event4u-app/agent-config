#!/usr/bin/env node
/**
 * Unauthorized-git gate — `pre_tool_use` concern.
 *
 * Checks a git / GitHub / npm operation against the authorization ledger that
 * `git_authorization_hook.ts` writes on `user_prompt_submit`, so the question
 * "did the user authorize this THIS turn?" is answered from a recorded fact
 * rather than from the model's recollection.
 *
 * SEVERITY SPLIT — by reversibility, not by confidence.
 *
 * The AI council (2026-08-06) split on block-vs-warn: one member argued block
 * from day one because a published npm release had already happened; the other
 * argued warn-first to gather false-positive data. The repo's locked
 * `ratchet severity, never reach` decision settles it without overriding
 * either:
 *
 *   BLOCK — only operations that `non-destructive-by-default` ALREADY declares
 *   never-autonomous and that cannot be undone: `npm publish`, a tag push,
 *   `gh release create`, `gh pr merge`. Blocking these adds no new prohibition;
 *   it makes an existing one mechanical. That is severity, not reach.
 *
 *   WARN — `git commit`, `git push`, `gh pr create`, branch creation,
 *   force-push. Real violations were measured here too (two PRs opened on turns
 *   with zero authorization), but these are recoverable, and a false positive on
 *   `git commit` would be a workflow cliff.
 *
 * KNOWN CONSERVATIVE OVER-BLOCK: `gh pr merge` does not name its base in the
 * command, so a merge into a non-production base is blocked as if it were a
 * production-trunk merge. Stated rather than silently narrowed — the escape is
 * one authorizing word in the prompt, and in this repo virtually every PR
 * targets `main`.
 *
 * NO LEDGER = NOT AUTHORIZED for the block subset, warn for the rest. A hook
 * that fails open on its own state file would be decorative on exactly the
 * turns where the state write failed.
 *
 * Exit codes (dispatcher contract): 0 allow · 2 block (stderr carries the
 * reason on block-capable events) — the dispatcher's `host_semantics`
 * translation owns the per-platform mapping.
 *
 * WHAT THIS GUARD DOES NOT SEE — stated because the previous version of this
 * header stated only what it covers, and a coverage claim that omits its
 * residue reads as completeness. The classifier reads the command TEXT; it does
 * not interpret the shell. So an invocation whose command word is assembled at
 * runtime is not classified, measured and still open:
 *
 *   P=publish; npm $P           — variable indirection
 *   echo publish | xargs npm    — the command word is composed by xargs
 *
 * Both execute under bash. Closing them needs a different mechanism than a
 * longer pattern, and `Measured, deferred, and why` in the round-6 roadmap
 * draws that line deliberately. Covered, by contrast, and each pinned by a
 * vector whose ground truth came from running bash rather than from reading
 * this file: ANSI-C and locale quoting, unbalanced quotes, command and process
 * substitution in every position tried, `sh -c` and `eval` payloads, env
 * assignment prefixes, and quotes inside the command word.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readHookStdin } from "./hook_stdin.js";
import { atomic_write_json } from "./state_io.js";
import {
  ledgerFileFor,
  pendingFileFor,
  STATE_FILE,
  type GitOp,
} from "../git_authorization_hook.js";

const EXIT_ALLOW = 0;
// MUST equal dispatch_hook.EXIT_BLOCK. The dispatcher's internal ladder is
// 0 allow / 1 block / 2 warn — NOT the 2-means-block shape a PreToolUse guard
// reads naturally from Claude's own native contract. This constant was 2 when
// this gate first shipped, so the dispatcher reduced every refusal to a WARN
// and the gate emitted advisory context while the operation went through.
// Pinned against the dispatcher's export by
// tests/hooks/concern_block_exit_parity.test.ts.
const EXIT_BLOCK = 1;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Irreversible operations — blocked without a this-turn authorization. */
export const BLOCK_OPS: ReadonlySet<GitOp> = new Set<GitOp>([
  "publish",
  "tag",
  "release",
  "pr-merge",
  // Enabling auto-merge commits the outcome to a condition the agent does not
  // control, so it is blocked on the same terms as the merge it schedules.
  "pr-merge-auto",
]);

/** Recoverable operations — warned without a this-turn authorization. */
export const WARN_OPS: ReadonlySet<GitOp> = new Set<GitOp>([
  "commit",
  "push",
  "pr-create",
  "branch",
]);

/**
 * Command → operation. Order matters: the most specific pattern wins, so
 * `git push --tags` is a tag push and not a plain push.
 */
// `git`/`gh` accept global options before the subcommand (`git -C dir push`,
// `git --git-dir=x push`), and each of those was a silent bypass of the whole
// gate. `G` allows any run of them.
const G = "(?:-[A-Za-z-]+(?:=\\S+)?(?:\\s+\\S+)?\\s+)*";

/** Optional absolute/relative path in front of the tool word: `/usr/bin/npm`. */
const P = "^(?:\\S*\\/)?";

/**
 * A `gh api` call that WRITES. Read-only `gh api` is the standard way to inspect
 * GitHub state and must never be refused.
 *
 * Two lookaheads rather than one linear pattern, because `-X POST` may appear on
 * either side of the path: `gh api -X POST repos/o/r/releases` and
 * `gh api repos/o/r/releases -X POST` are the same call.
 */
function ghApiWrite(pathRe: string): RegExp {
  return new RegExp(
    `${P}gh\\s+api\\b(?=[^\\n]*${pathRe})(?=[^\\n]*(?:-X|--method)\\s+(?:POST|PATCH|PUT|DELETE)\\b)`,
    "i",
  );
}

/**
 * Command → operation. Order matters: the most specific pattern wins, so
 * `git push --tags` is a tag push and not a plain push.
 *
 * Every pattern is anchored at command position (`P`), not `\b`. An unanchored
 * verb matches its own name inside a QUOTED ARGUMENT, and the 2026-08-12 session
 * audit measured all three of that window's blocked ops as exactly that false
 * positive — every one read-only or harmless:
 *
 *   gh pr create … --title "…(unblock npm publish)"   → classified `publish`
 *   gh api repos/o/r/releases/latest --jq …           → classified `release`
 *   gh api repos/jdx/aube-action/releases --jq …      → classified `release`
 *
 * The first is a PR *about* a publishing problem; the other two are GETs, one of
 * them against a third-party repo. All three are BLOCK ops, so on a hook-bound
 * host the operator could neither open that PR nor diagnose why a release had
 * not appeared — while the transcripts of that same window carry "Ich kann
 * wieder nicht releasen. Warum nicht?".
 *
 * The heredoc stripper upstream already removes `--body "$(cat <<EOF …)"`
 * payloads; it cannot help here because `--title` is an ordinary quoted
 * argument. Anchoring is what separates *invoking* a verb from *naming* one.
 */
const COMMAND_OPS: ReadonlyArray<{ op: GitOp; re: RegExp }> = [
  { op: "publish", re: new RegExp(`${P}(npm|pnpm|yarn)\\s+${G}publish\\b`, "i") },
  {
    op: "release",
    re: new RegExp(`${P}gh\\s+release\\s+create\\b|${ghApiWrite("\\/releases\\b").source}`, "i"),
  },
  {
    op: "tag",
    re: new RegExp(`${P}git\\s+${G}push\\b[^\\n;|&]*(--tags|--follow-tags|refs\\/tags\\/)`, "i"),
  },
  // ORDER IS LOAD-BEARING, per this table's own rule that the most specific
  // pattern wins: `gh pr merge 12 --auto` matches the plain merge pattern too.
  //
  // The GraphQL mutation needs its OWN pattern rather than a widening of
  // `ghApiWrite()`. That helper requires BOTH a REST-shaped path and an
  // explicit write method, and `gh api graphql -f query='mutation{...}'` has
  // neither — widening it to reach this would loosen every other op that uses
  // it, which is a bigger change than the defect.
  {
    op: "pr-merge-auto",
    re: new RegExp(
      `${P}gh\\s+pr\\s+merge\\b(?=[^\\n]*--auto\\b)|${P}gh\\s+api\\b(?=[^\\n]*enablePullRequestAutoMerge\\b)`,
      "i",
    ),
  },
  {
    op: "pr-merge",
    re: new RegExp(
      `${P}gh\\s+pr\\s+merge\\b(?![^\\n]*--(auto|disable-auto)\\b)|${ghApiWrite("\\/pulls\\/\\d+\\/merge\\b").source}`,
      "i",
    ),
  },
  {
    op: "pr-create",
    re: new RegExp(`${P}gh\\s+pr\\s+create\\b|${ghApiWrite("\\/pulls\\b").source}`, "i"),
  },
  { op: "push", re: new RegExp(`${P}git\\s+${G}push\\b`, "i") },
  { op: "commit", re: new RegExp(`${P}git\\s+${G}commit\\b`, "i") },
  { op: "branch", re: new RegExp(`${P}git\\s+${G}(checkout\\s+-b|switch\\s+-c)\\b`, "i") },
];

const COMMAND_TOOLS: ReadonlySet<string> = new Set([
  "launch-process",
  "launch_process",
  "Bash",
  "BashTool",
  "run-process",
  "runProcess",
  "shell",
  "execute_shell",
  "RunShellCommand",
]);

/** Extract the shell command from a platform-native pre-tool envelope. */
export function extractCommand(envelope: JsonObject): string | null {
  const payload = _isObject(envelope["payload"]) ? (envelope["payload"] as JsonObject) : envelope;
  const toolRaw = payload["tool_name"] ?? payload["toolName"] ?? payload["tool"];
  const tool = typeof toolRaw === "string" ? toolRaw : null;
  if (tool !== null && !COMMAND_TOOLS.has(tool)) {
    return null;
  }
  const input = _isObject(payload["tool_input"])
    ? (payload["tool_input"] as JsonObject)
    : _isObject(payload["toolInput"])
      ? (payload["toolInput"] as JsonObject)
      : payload;
  for (const key of ["command", "cmd", "script"]) {
    const v = input[key];
    if (typeof v === "string" && v.trim()) {
      return v;
    }
  }
  return null;
}

/**
 * Split on shell separators that are OUTSIDE quotes.
 *
 * Separators recognised, matching the raw regex this replaces: newline, `;`,
 * `&&`, `||`, `|`, `&`. A separator inside `'…'` or `"…"` is a literal, so it
 * does not split. Backslash escapes the next character outside single quotes,
 * per POSIX.
 *
 * Deliberately NOT a full tokeniser. `shlexSplit` in `block_no_verify` throws on
 * an unbalanced quote, which is the right behaviour for a guard that fail-closes;
 * this guard must classify every command it sees, including a malformed one.
 *
 * THE UNTERMINATED-QUOTE POSTURE IS FAIL-CLOSED, AND THE ARGUMENT FOR THE
 * PREVIOUS ONE WAS INVERTED. Round 5 shipped this docstring: "an unterminated
 * quote here degrades to 'the rest of the string is quoted', which yields one
 * segment starting at the real command word — the conservative outcome". It is
 * the opposite. In `echo 'oops && npm publish` the surviving segment's command
 * word is `echo`, so everything after `&&` is swallowed and the publish is never
 * seen. Measured, not reasoned: that command was blocked before #1208 and
 * allowed after it. So an unbalanced quote now re-splits the trailing segment
 * WITHOUT quote awareness and classifies every piece. A false positive on input
 * bash would itself refuse to run is acceptable; a false negative on input bash
 * does run is the failure this guard exists for.
 *
 * ANSI-C quoting (`$'…'`) is a distinct opener, and treating its `$` as ordinary
 * text was the second half of the same regress. In `$'don\'t'` the `\'` does NOT
 * close the quote — C escape semantics apply inside — so a plain single-quote
 * reading closes early, re-opens on the trailing `'`, and swallows the tail.
 * `$"…"` is locale translation and behaves as `"…"`.
 */
export function splitOutsideQuotes(command: string): string[] {
  const parts: string[] = [];
  let cur = "";
  // `$'` is tracked distinctly from `'` because only it honours `\` escapes.
  let quote: '"' | "'" | "$'" | null = null;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i] as string;
    if (quote !== null) {
      if (quote === "$'" && ch === "\\" && i + 1 < command.length) {
        // C-style escape: `\'` is a literal quote, not a terminator.
        cur += ch + (command[i + 1] as string);
        i += 1;
        continue;
      }
      cur += ch;
      if (ch === (quote === "$'" ? "'" : quote)) {
        quote = null;
      } else if (ch === "\\" && quote === '"' && i + 1 < command.length) {
        cur += command[i + 1] as string;
        i += 1;
      }
      continue;
    }
    // `$'…'` / `$"…"` — the `$` belongs to the opener, not to the payload.
    if (ch === "$" && (command[i + 1] === "'" || command[i + 1] === '"')) {
      quote = command[i + 1] === "'" ? "$'" : '"';
      cur += ch + (command[i + 1] as string);
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "\\" && i + 1 < command.length) {
      cur += ch + (command[i + 1] as string);
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === ";" || ch === "|" || ch === "&") {
      // `&&` and `||` are two-character separators; consume the pair.
      if ((ch === "|" || ch === "&") && command[i + 1] === ch) {
        i += 1;
      }
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (quote !== null) {
    // Unbalanced: the trailing segment carries an opener that never closed, so
    // its separators were read as data. Re-read them as separators. Segments
    // completed BEFORE the opener keep their quote-aware split — the round-5
    // false positive (a `grep -E` alternation) balances its quotes and never
    // reaches this branch.
    parts.push(...splitIgnoringQuotes(cur));
    return parts;
  }
  parts.push(cur);
  return parts;
}

/**
 * Separator split with no quote awareness at all — the fail-closed fallback for
 * a command whose quotes do not balance. Backslash still escapes, because a
 * `\|` is a literal pipe under every reading.
 */
function splitIgnoringQuotes(fragment: string): string[] {
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < fragment.length; i += 1) {
    const ch = fragment[i] as string;
    if (ch === "\\" && i + 1 < fragment.length) {
      cur += ch + (fragment[i + 1] as string);
      i += 1;
      continue;
    }
    if (ch === "\n" || ch === ";" || ch === "|" || ch === "&") {
      if ((ch === "|" || ch === "&") && fragment[i + 1] === ch) {
        i += 1;
      }
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

/**
 * Extract the payload of every command substitution in a segment — `$(…)` with
 * balanced parentheses, and backtick form.
 *
 * An unterminated substitution yields everything to the end of the segment
 * rather than nothing: the same fail-closed direction the quote posture takes.
 */
export function substitutionPayloads(segment: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (ch === "\\") {
      i += 1;
      continue;
    }
    // `$(…)` command substitution and `<(…)` / `>(…)` process substitution:
    // different syntax, same fact — the parenthesised payload is a command that
    // runs. Measured: `cat <(npm publish)` executes the publish.
    if ((ch === "$" || ch === "<" || ch === ">") && segment[i + 1] === "(") {
      let open = 1;
      let j = i + 2;
      const start = j;
      for (; j < segment.length && open > 0; j += 1) {
        const c = segment[j];
        if (c === "\\") {
          j += 1;
        } else if (c === "(") {
          open += 1;
        } else if (c === ")") {
          open -= 1;
        }
      }
      out.push(segment.slice(start, open === 0 ? j - 1 : segment.length));
      i = j - 1;
      continue;
    }
    if (ch === "`") {
      const end = segment.indexOf("`", i + 1);
      out.push(segment.slice(i + 1, end === -1 ? segment.length : end));
      i = end === -1 ? segment.length : end;
    }
  }
  return out;
}

/**
 * Split a shell command into the segments that are actually INVOKED.
 *
 * A substring match over the whole command string is wrong, and measurably so:
 * the round-2 self-scan found this gate firing on two commands of the auditor's
 * own session whose only sin was carrying `npm publish` inside a `printf`
 * argument as test data. Blocking a command because it mentions an operation is
 * the worst false-positive shape a refusing gate can have.
 *
 * So: split on shell separators, drop leading env assignments, and keep the
 * segment only from its command word. `printf '{"cmd":"npm publish"}'` yields a
 * segment starting at `printf` and never matches.
 *
 * Quoted payloads are NOT simply discarded — `sh -c "npm publish"` really does
 * publish. Those are unwrapped and re-split, so closing the false positive does
 * not open a bypass.
 *
 * The separator split is QUOTE-AWARE, and that is not a refinement — it is the
 * same false-positive class the paragraph above describes, surviving in the one
 * place the round-2 fix did not reach. Measured in the round-5 audit
 * (2026-08-07): a read-only `grep -n -E "…|npm publish|…"` was refused with
 * "Blocked: `publish` with no authorization in this turn's prompt", because a
 * raw `split` on `|` cut the quoted alternation into a segment beginning with
 * `npm`. A `|` inside quotes is data, exactly like a heredoc body; only an
 * unquoted one is a pipe. Splitting outside quotes closes that without
 * discarding quoted payloads, so `sh -c "npm publish"` still unwraps below.
 */
export function invokedSegments(command: string, depth = 0): string[] {
  if (depth > 3) {
    return [];
  }
  const out: string[] = [];
  // Strip heredoc bodies before splitting: a line inside `<<EOF … EOF` is data
  // being written, not a command being run, but after a newline split it looks
  // exactly like an invocation.
  const withoutHeredocs = command.replace(
    /<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm,
    "<<HEREDOC",
  );
  for (const raw of splitOutsideQuotes(withoutHeredocs)) {
    let seg = raw.trim();
    if (!seg) {
      continue;
    }
    // Drop leading env assignments: `FOO=bar BAZ=1 npm publish`.
    seg = seg.replace(/^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+)+/, "");
    // A command substitution is an invocation in its own right, and it runs
    // whether or not the enclosing segment's command word is harmless:
    // `echo "$(npm publish)"` publishes. Classify INSIDE the substitution by
    // command position, so the substitution that *invokes* a blocked op is
    // refused and the one that merely *mentions* it in an argument
    // (`echo "$(grep -c 'npm publish' f)"`) is not — the same rule `commandOp`
    // already applies one level up, applied one level deeper.
    for (const payload of substitutionPayloads(seg)) {
      out.push(...invokedSegments(payload, depth + 1));
    }
    // Unwrap `sh -c '<payload>'` / `bash -c "<payload>"` and recurse.
    const wrapped = /^(?:\S*\/)?(?:ba|z|k)?sh\s+-[a-z]*c\s+(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(seg);
    if (wrapped) {
      out.push(...invokedSegments(wrapped[1] ?? wrapped[2] ?? wrapped[3] ?? "", depth + 1));
      continue;
    }
    // `eval` is the same shape as `sh -c`: its argument is command context, and
    // it takes the rest of the segment rather than one word.
    const evaled = /^eval\s+(?:"([^"]*)"|'([^']*)'|(.+))$/.exec(seg);
    if (evaled) {
      out.push(...invokedSegments(evaled[1] ?? evaled[2] ?? evaled[3] ?? "", depth + 1));
      continue;
    }
    // Quotes inside the command WORD are removed by the shell before it looks
    // the command up, so `np''m publish` invokes npm. Strip them from the head
    // only — an argument's quotes are data and stay.
    out.push(seg.replace(/^(\S+)/, (w) => w.replace(/['"]/g, "")));
  }
  return out;
}

/**
 * Classify a shell command into the operation it performs, if any.
 *
 * Matches per invoked segment and only when the segment BEGINS with the tool —
 * a mention inside an argument is not an invocation.
 */
export function commandOp(command: string): GitOp | null {
  // Every segment is classified and the MOST SEVERE result wins. Returning the
  // first match let `npm publish && git push --tags` pass its tag push
  // unchecked once `publish` was authorized.
  let found: GitOp | null = null;
  for (const seg of invokedSegments(command)) {
    if (!/^(?:\S*\/)?(git|gh|npm|pnpm|yarn)\b/.test(seg)) {
      continue;
    }
    for (const { op, re } of COMMAND_OPS) {
      if (re.test(seg)) {
        if (BLOCK_OPS.has(op)) {
          return op;
        }
        found ??= op;
        break;
      }
    }
  }
  return found;
}

/**
 * A ledger older than this is not "this turn" under any reading.
 *
 * **Widening this constant for a long run is forbidden practice.** On
 * 2026-08-21 it was sed-patched to twelve times this value — six hours —
 * behind a marker promising a revert that never came, so an autonomous PR-drain could
 * merge past the 30-minute bound. The widening was committed to the trunk and
 * left there. It is a twelvefold expansion of the authorization lifetime on
 * the guard that gates `pr-merge`, which is a `BLOCK_OPS` member precisely
 * because it is irreversible.
 *
 * Neither the widened expression nor the marker text is written out here: the
 * obvious regression check for either is a grep, and a comment reciting the
 * literal makes that grep match the guard's own prose on a clean tree.
 *
 * The supported answer to "my run is longer than the window" is that the run
 * STOPS and REPORTS at expiry and the user re-authorizes — never that the
 * window grows. The agent never edits this constant, this file, or the built
 * bundle; `dist/hooks/dispatch.js` is what actually executes, and a source
 * edit without a rebuild is silently inert.
 */
export const LEDGER_MAX_AGE_MS = 30 * 60 * 1000;

/**
 * Load the ledger, and refuse one that does not belong to THIS session and
 * THIS turn.
 *
 * The header claims the gate answers "did the user authorize this THIS turn?".
 * Before this check it answered "did anyone, in any session, ever authorize
 * it?" — the file records `session_id` and `detected_at` and neither was read.
 * Two concurrent worktrees share one state root, so session A typing
 * `mach den release` authorized session B.
 */
function _loadLedger(
  consumer_root: string,
  session_id: string,
  now: number,
): { authorized: Set<GitOp>; present: boolean } {
  // This session's own ledger first; the flat legacy file only as a fallback,
  // so a ledger written by an older build still counts. Reading the flat file
  // FIRST was the defect: any concurrent session in the repo overwrites it, and
  // the session check below then discarded a real authorization as foreign.
  const candidates = [ledgerFileFor(session_id)];
  if (!candidates.includes(STATE_FILE)) {
    candidates.push(STATE_FILE);
  }
  for (const rel of candidates) {
    const found = _readLedgerFile(path.join(consumer_root, rel), session_id, now);
    if (found !== null) {
      return found;
    }
  }
  return { authorized: new Set<GitOp>(), present: false };
}

/**
 * Read one ledger file. `null` means "this file does not answer the question" —
 * absent, malformed, foreign session, or expired — so the caller may try the
 * next candidate. A parsed, in-session, fresh ledger answers definitively.
 */
function _readLedgerFile(
  file: string,
  session_id: string,
  now: number,
): { authorized: Set<GitOp>; present: boolean } | null {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const decoded = JSON.parse(raw) as unknown;
    if (_isObject(decoded) && Array.isArray(decoded["authorized"])) {
      const ledgerSession = typeof decoded["session_id"] === "string" ? decoded["session_id"] : "";
      // A ledger from a different session is another conversation's consent.
      if (session_id && ledgerSession && ledgerSession !== session_id) {
        return null;
      }
      const at = Date.parse(String(decoded["detected_at"] ?? ""));
      if (Number.isFinite(at) && now - at > LEDGER_MAX_AGE_MS) {
        return null;
      }
      return {
        authorized: new Set((decoded["authorized"] as string[]).filter(Boolean) as GitOp[]),
        present: true,
      };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export interface Decision {
  exit: number;
  stdout: string;
  stderr: string;
  /**
   * The op this decision refused, when it refused one.
   *
   * `decide` stays pure; `run` turns this into the pending record that lets the
   * user's answer to the refusal count as authorization for that one op. See
   * `git_authorization_hook.PENDING_FILE` for why that record exists at all.
   */
  blockedOp?: GitOp;
}

export function decide(
  command: string | null,
  ledger: { authorized: Set<GitOp>; present: boolean },
): Decision {
  if (command === null) {
    return { exit: EXIT_ALLOW, stdout: "", stderr: "" };
  }
  const op = commandOp(command);
  if (op === null || ledger.authorized.has(op)) {
    return { exit: EXIT_ALLOW, stdout: "", stderr: "" };
  }

  const shown = command.length > 120 ? `${command.slice(0, 117)}…` : command;

  if (BLOCK_OPS.has(op)) {
    const reason =
      `Blocked: \`${op}\` with no authorization in this turn's prompt. ` +
      `This operation is irreversible and non-destructive-by-default already declares it ` +
      `never-autonomous. Command: ${shown}. ` +
      `Ask the user, in one numbered-options block, and run it only after they answer this turn.`;
    return { exit: EXIT_BLOCK, stdout: "", stderr: `${reason}\n`, blockedOp: op };
  }

  if (WARN_OPS.has(op)) {
    const reason =
      `No \`${op}\` authorization found in this turn's prompt (commit-policy: a one-shot ` +
      `authorization is spent on the operation it named). If the user did authorize it this ` +
      `turn, proceed; otherwise stop and ask. Command: ${shown}`;
    return {
      exit: EXIT_ALLOW,
      stdout: `${JSON.stringify({ decision: "warn", reason })}\n`,
      stderr: "",
    };
  }

  return { exit: EXIT_ALLOW, stdout: "", stderr: "" };
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
  const session_id = typeof envelope["session_id"] === "string" ? envelope["session_id"] : "";
  const decision = decide(
    extractCommand(envelope),
    _loadLedger(options.consumer_root, session_id, Date.now()),
  );
  if (decision.blockedOp) {
    // Record WHAT was refused, so the user's answer to the question this
    // refusal just told the agent to ask can authorize that one operation.
    // Best-effort: a failed write degrades to the previous behaviour, where a
    // numbered answer is unrecordable and the refusal simply repeats.
    try {
      atomic_write_json(path.join(options.consumer_root, pendingFileFor(session_id)), {
        op: decision.blockedOp,
        session_id,
        refused_at: new Date().toISOString(),
      });
    } catch {
      /* observability only — see above */
    }
  }
  if (decision.stdout) {
    process.stdout.write(decision.stdout);
  }
  if (decision.stderr) {
    process.stderr.write(decision.stderr);
  }
  return decision.exit;
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
