/**
 * Git / GitHub / npm command classifier — a pure library, not a gate.
 *
 * WHAT THIS IS NOT, AND WHY. Until 2026-09-04 this file was the
 * `block-unauthorized-git` `pre_tool_use` concern: it read the authorization
 * ledger and REFUSED an operation the turn had not authorized. The owner
 * removed that enforcement (ADR-254) after it was measured to refuse
 * authorizations the owner had in fact given — a guardrail sentence inside an
 * authorization ("never merge empty PRs") read as a withdrawal and erased the
 * whole ledger, and an answer given as an option number ("1") matched no
 * authorizing pattern at all.
 *
 * What survives is the half that never decided anything: the command parser and
 * the operation vocabulary. Two callers depend on it and neither gates git —
 * `block_no_verify.ts` needs `substitutionPayloads` so `git $(echo --no-verify)`
 * cannot slip past the hook-bypass guard, and `conformance_scan.ts` needs
 * `commandOp` / `BLOCK_OPS` to MEASURE how often an irreversible operation ran
 * on an unauthorized turn. Measurement is all that is left here.
 *
 * `BLOCK_OPS` and `WARN_OPS` keep their names because they name the
 * reversibility split `non-destructive-by-default` draws, and that split is
 * still true. They no longer name an action this file takes.
 *
 * SEVERITY SPLIT — by reversibility, not by confidence. Retained below because
 * it is what the two sets still mean.
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
import { PR_NUMBER_MAX, type GitOp } from "../git_authorization_hook.js";

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

  // ── Added 2026-09-03. Every one is already never-autonomous in the
  // `non-destructive-by-default` prose; the measurement that drove it is in the
  // `GitOp` union's own note — 17 of 25 borderline operations classified as
  // NOTHING, including three worse than anything the guard already caught.
  /** The undo that is more destructive than the act: lockfiles break. */
  "unpublish",
  /** Metadata only, and every install on earth starts warning. */
  "deprecate",
  /** Replaces bytes consumers already hold a checksum for. */
  "release-asset",
  /** Deletes the guard rather than the data — everything after is unguarded. */
  "protection",
  /** No data lost; the gate that protects everything downstream is off. */
  "workflow-toggle",
  /** Reach outside the repository, and mostly one-way. */
  "repo-lifecycle",
  /** No code moves, and an armed auto-merge is released. */
  "review-approve",
  /** Discards commits that landed after the last fetch, on a shared ref. */
  "force-push",
  /** Destroys uncommitted work belonging to a session this one cannot see. */
  "worktree-remove",
  /** `-x` is the flag that takes `.env` and local certificates. */
  "clean-ignored",
]);

/** Recoverable operations — warned without a this-turn authorization. */
export const WARN_OPS: ReadonlySet<GitOp> = new Set<GitOp>([
  "commit",
  "push",
  "pr-create",
  "branch",

  // ── Added 2026-09-03, deliberately at warn rather than block.
  //
  // Each is destructive in some reading, and each is also routine enough that
  // blocking it would be the friction that gets the whole guard routed around —
  // the failure mode this estate has already recorded twice. `reset-hard` is the
  // sharpest case and stays here for a decidable reason: the Hard Floor's
  // qualifier is "past unpushed work", and the command text cannot say whether
  // the work was pushed.
  "tag-force",
  "rebase",
  "reset-hard",
  "clean",
  "stash-drop",
  "branch-delete",
  "close",
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
  // ── Added 2026-09-03. Placement inside this table is as load-bearing as the
  // patterns: the loop takes the MOST SEVERE match per segment, but within one
  // op the first pattern wins, so anything more specific than a plain `git push`
  // has to sit above it.

  // `npm unpublish` is NOT reached by the publish pattern — `\bpublish\b` needs
  // a word boundary that `unpublish` does not provide between `n` and `p`. That
  // is why it classified as nothing for as long as it did.
  { op: "unpublish", re: new RegExp(`${P}(npm|pnpm|yarn)\\s+${G}unpublish\\b`, "i") },
  { op: "deprecate", re: new RegExp(`${P}(npm|pnpm|yarn)\\s+${G}deprecate\\b`, "i") },
  {
    op: "release-asset",
    re: new RegExp(`${P}gh\\s+release\\s+(upload|edit|delete)\\b`, "i"),
  },
  {
    op: "protection",
    re: new RegExp(
      `${P}gh\\s+api\\b(?=[^\\n]*(?:protection|rulesets?)\\b)(?=[^\\n]*(?:-X|--method)\\s+(?:DELETE|PUT|PATCH|POST)\\b)|${P}gh\\s+ruleset\\s+delete\\b`,
      "i",
    ),
  },
  {
    op: "workflow-toggle",
    re: new RegExp(`${P}gh\\s+workflow\\s+(disable|enable)\\b`, "i"),
  },
  {
    op: "repo-lifecycle",
    re: new RegExp(
      `${P}gh\\s+repo\\s+(archive|delete|unarchive)\\b|${P}gh\\s+repo\\s+edit\\b(?=[^\\n]*--visibility\\b)`,
      "i",
    ),
  },
  {
    op: "review-approve",
    re: new RegExp(`${P}gh\\s+pr\\s+review\\b(?=[^\\n]*--approve\\b)`, "i"),
  },
  // Above `push`, and both spellings: `--force` and `--force-with-lease`. The
  // "safe force" is in the same class here because what it is safe against is a
  // stale local view, not a collaborator who pushed after your fetch.
  {
    op: "force-push",
    re: new RegExp(`${P}git\\s+${G}push\\b[^\\n;|&]*(--force\\b|--force-with-lease\\b|\\s-f\\b)`, "i"),
  },
  {
    op: "worktree-remove",
    re: new RegExp(`${P}git\\s+worktree\\s+remove\\b[^\\n;|&]*(--force\\b|\\s-f\\b)`, "i"),
  },
  // `-x` (or `-X`) anywhere in the flag cluster is what reaches ignored files.
  {
    op: "clean-ignored",
    re: new RegExp(`${P}git\\s+clean\\b[^\\n;|&]*-[A-Za-z]*x`, "i"),
  },
  { op: "tag-force", re: new RegExp(`${P}git\\s+tag\\b[^\\n;|&]*(-f\\b|--force\\b)`, "i") },
  { op: "rebase", re: new RegExp(`${P}git\\s+${G}rebase\\b`, "i") },
  { op: "reset-hard", re: new RegExp(`${P}git\\s+${G}reset\\b[^\\n;|&]*--hard\\b`, "i") },
  { op: "clean", re: new RegExp(`${P}git\\s+clean\\b`, "i") },
  { op: "stash-drop", re: new RegExp(`${P}git\\s+stash\\s+(drop|clear)\\b`, "i") },
  // Remote deletion and the local `-D` are one op: both remove a ref, and the
  // remote form additionally closes any open PR pointing at it.
  {
    op: "branch-delete",
    re: new RegExp(
      `${P}git\\s+branch\\b[^\\n;|&]*(-D\\b|--delete\\b)|${P}git\\s+${G}push\\b[^\\n;|&]*(--delete\\b|\\s:\\S)`,
      "i",
    ),
  },
  { op: "close", re: new RegExp(`${P}gh\\s+(pr|issue)\\s+close\\b`, "i") },

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
 * The pull request a merge command acts on, or `null` when the command does not
 * say.
 *
 * `gh pr merge` with no number merges whatever the current branch's PR is — the
 * command text identifies no object, so no grant can match it and the
 * clock-bound path applies unchanged. That is the fail-closed direction: an
 * unnamed target never consumes a grant minted for a named one.
 */
export function mergeTargetOf(command: string): number | null {
  // Ten digits lexically, `PR_NUMBER_MAX` numerically — the API contract's own
  // bound, imported from the mint site so the two cannot drift. The old
  // `\d{1,7}` put the `\b` after digit seven, so an eight-digit target did not
  // resolve to an out-of-range value: it resolved to NOTHING, and the gate fell
  // back to the clock-bound path with no diagnostic.
  const gh = /\bgh\s+pr\s+merge\s+(?:-{1,2}\S+\s+)*?(\d{1,10})\b/i.exec(command);
  if (gh) {
    return _boundedTarget(gh[1] as string);
  }
  // The same operation by its REST spelling. `commandOp` already classifies
  // `gh api -X PUT repos/o/r/pulls/1499/merge` as `pr-merge`, so a reader that
  // missed it here would silently fall back to the clock.
  const api = /\/pulls\/(\d{1,10})\/merge\b/i.exec(command);
  return api ? _boundedTarget(api[1] as string) : null;
}

/** A target only counts inside the API's own range; anything else is no target. */
function _boundedTarget(digits: string): number | null {
  const n = Number.parseInt(digits, 10);
  return Number.isSafeInteger(n) && n > 0 && n <= PR_NUMBER_MAX ? n : null;
}
