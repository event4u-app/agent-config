// Tests for the git-authorization ledger (src/scripts/git_authorization_hook.ts)
// and its blocking half (src/scripts/hooks/git_command_classifier.ts).
//
// Every fixture below is drawn from a real turn in the 30-session conformance
// audit (2026-08-06). The two that matter most:
//
//   - "fixe die ci" must NOT unlock a push. That exact instruction was read as
//     covering commit + push three times in one session.
//   - A pasted `git push … rejected` stack trace must NOT authorize a push. That
//     paste was read as implicit continuation immediately before an unauthorized
//     prod-trunk merge, tag push, GitHub release and npm publish.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import {
  classifyAuthorization,
  isAffirmative,
  splitFences,
  ledgerFileFor,
  pendingFileFor,
  humanTypedThisTurn,
  run as ledgerRun,
  STATE_FILE,
  type GitOp,
} from "../../src/scripts/git_authorization_hook.js";
import {
  BLOCK_OPS,
  WARN_OPS,
  commandOp,
  invokedSegments,
  extractCommand,
} from "../../src/scripts/hooks/git_command_classifier.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "git-auth-"));
});

function submit(prompt: string, session = "s1"): void {
  ledgerRun(
    JSON.stringify({ event: "user_prompt_submit", session_id: session, payload: { prompt } }),
    { consumer_root: tmp },
  );
}

function ledger(session = "s1"): { authorized: GitOp[] } {
  return JSON.parse(fs.readFileSync(path.join(tmp, ledgerFileFor(session)), "utf8")) as {
    authorized: GitOp[];
  };
}

describe("classifyAuthorization — prose", () => {
  it("unlocks the ops the user actually named, in German", () => {
    const { authorized } = classifyAuthorization(
      "Commite das und erstelle einen PR, ready for review.",
    );
    expect(authorized).toContain("commit");
    expect(authorized).toContain("pr-create");
  });

  it("does NOT unlock push on a bare code-fix instruction", () => {
    // The measured violation: "consistency faily. fixe das" → commit + push.
    for (const prompt of ["consistency faily. fixe das", "fixe die ci", "es gibt einen linter fehler"]) {
      const { authorized } = classifyAuthorization(prompt);
      expect(authorized).not.toContain("push");
      expect(authorized).not.toContain("commit");
    }
  });

  it("does NOT unlock publish or merge on a broad release-ish instruction alone", () => {
    // Baseline corrected 2026-09-03, and the fixture is why it needed
    // correcting. It reads "Ich kann immer noch NICHT releasen" — a complaint
    // that releasing is broken, not an instruction to release. The assertion
    // used to require `release` in the output, so the test was pinning the
    // negation leak in place while its own comment described the sentence as an
    // authorization. `negatedBefore` now refuses it, which is the whole point.
    const { authorized } = classifyAuthorization(
      "Ich kann immer noch nicht releasen. Fixe das endlich.",
    );
    expect(authorized).not.toContain("release");
    expect(authorized).not.toContain("publish");
    expect(authorized).not.toContain("pr-merge");
  });

  it("a positive release instruction still unlocks release, and nothing adjacent", () => {
    // The half the fixture above was meant to be testing, restored as its own
    // case so the corrected baseline does not quietly drop the coverage.
    const { authorized } = classifyAuthorization("Release 9.20.0 sauber.");
    expect(authorized).toContain("release");
    expect(authorized).not.toContain("publish");
    expect(authorized).not.toContain("pr-merge");
  });
});

describe("classifyAuthorization — pasted fences", () => {
  it("treats a pasted executable command as authorization for that command", () => {
    const { authorized, evidence } = classifyAuthorization(
      "das hier:\n```\ngit push origin main\n```",
    );
    expect(authorized).toContain("push");
    expect(evidence["push"]).toMatch(/pasted command/);
  });

  it("does NOT treat a pasted error trace containing `git push` as authorization", () => {
    // Round-2 fix: the first fixture built the trace with
    // `"$ git push\n".replace("$ git push", "To github.com…")`, which DELETED the
    // token under test — the string `git push` never appeared. These two carry
    // it verbatim, in both shapes the maintainer actually pastes.
    const fenced =
      "das kommt raus:\n```\n" +
      "$ git push origin main\n" +
      "To github.com:event4u-app/agent-config.git\n" +
      " ! [rejected]        main -> main (fetch first)\n" +
      "error: failed to push some refs\n" +
      "hint: Updates were rejected because the remote contains work\n```";
    expect(classifyAuthorization(fenced).authorized).not.toContain("push");

    const unfenced =
      "hier der fehler:\n" +
      "To github.com:event4u-app/agent-config.git\n" +
      " ! [rejected] main -> main\n" +
      "error: failed to push some refs\n" +
      "hint: git push --force?";
    expect(classifyAuthorization(unfenced).authorized).toEqual([]);
  });


  it("splitFences separates prose from fenced bodies", () => {
    const { prose, fences } = splitFences("vorher\n```\ngit push\n```\nnachher");
    expect(prose).toContain("vorher");
    expect(prose).toContain("nachher");
    expect(prose).not.toContain("git push");
    expect(fences).toHaveLength(1);
  });
});

describe("commandOp", () => {
  it("prefers the most specific match — a tag push is a tag, not a push", () => {
    expect(commandOp("git push origin --tags")).toBe("tag");
    expect(commandOp("git push origin main")).toBe("push");
  });

  it("classifies the irreversible set", () => {
    expect(commandOp("npm publish --access public")).toBe("publish");
    expect(commandOp("gh release create 9.20.0 --notes x")).toBe("release");
    expect(commandOp("gh pr merge 1188 --squash")).toBe("pr-merge");
  });

  // Round-2 self-scan: the gate fired on two commands of the auditor's own
  // session whose only sin was carrying the operation name inside a `printf`
  // argument as test data. Blocking a command because it MENTIONS an operation
  // is the worst false positive a refusing gate can have.
  it("does not fire on an operation merely mentioned inside an argument", () => {
    for (const cmd of [
      `printf '{"tool_input":{"command":"npm publish"}}'`,
      `echo "npm publish" > /tmp/fixture.txt`,
      `grep -rn "gh pr merge" src/`,
      `cat <<'EOF'\nnpm publish\nEOF`,
    ]) {
      expect(commandOp(cmd), cmd).toBeNull();
    }
  });

  it("still fires when the operation is genuinely invoked, including via sh -c", () => {
    expect(commandOp("npm publish --access public")).toBe("publish");
    expect(commandOp(`sh -c "npm publish"`)).toBe("publish");
    expect(commandOp(`bash -c 'gh pr merge 1 --squash'`)).toBe("pr-merge");
    expect(commandOp("NPM_TOKEN=x npm publish")).toBe("publish");
    expect(commandOp("git status && npm publish")).toBe("publish");
  });

  it("invokedSegments keeps only the invoked head of each segment", () => {
    expect(invokedSegments("git status && npm publish")).toEqual(["git status", "npm publish"]);
    expect(invokedSegments(`printf 'npm publish'`)).toEqual([`printf 'npm publish'`]);
  });

  it("returns null for an unrelated command", () => {
    expect(commandOp("git status --porcelain")).toBeNull();
    expect(commandOp("npm run test")).toBeNull();
  });

  // Round-5 audit (2026-08-07): the separator split was not quote-aware, so a
  // quoted alternation was cut into a segment beginning with the op literal.
  // Measured live three times, once blocking the probe that proved the fix.
  it("does not treat a separator inside quotes as a shell separator", () => {
    expect(commandOp(`grep -n -E "foo|npm publish|bar" docs/`)).toBeNull();
    expect(commandOp(`rg "npm publish" --glob '*.md'`)).toBeNull();
    expect(commandOp(`grep -rn "gh pr merge|gh release create" src/`)).toBeNull();
    expect(invokedSegments(`grep -E "a|npm publish|b" x`)).toEqual([
      `grep -E "a|npm publish|b" x`,
    ]);
  });

  // Cross-project session audit (2026-08-12): all three BLOCK ops in the window
  // were false positives of one shape — the verb was NAMED in a quoted argument
  // or an API path, not INVOKED. Every one was read-only or harmless, and the
  // same window's transcripts carry "Ich kann wieder nicht releasen. Warum
  // nicht?" while a blocking guard sat on the diagnosis.
  it("does not classify a verb named inside a quoted argument", () => {
    expect(
      commandOp(
        `gh pr create --base main --head fix/x --title "fix(release): align version (unblock npm publish)"`,
      ),
    ).toBe("pr-create");
    expect(commandOp(`git commit -m "mention npm publish in the message"`)).toBe("commit");
  });

  it("treats read-only `gh api` as read-only, whatever the path says", () => {
    expect(commandOp(`gh api repos/o/r/releases/latest --jq '{tag:.tag_name}'`)).toBeNull();
    expect(commandOp(`gh api repos/jdx/aube-action/releases --jq '.[0:3][] | .tag_name'`)).toBeNull();
    expect(commandOp(`gh api repos/o/r/pulls/5/merge`)).toBeNull();
  });

  it("still catches a writing `gh api`, with the method on either side", () => {
    expect(commandOp(`gh api -X POST repos/o/r/releases -f tag_name=v1`)).toBe("release");
    expect(commandOp(`gh api repos/o/r/releases -X POST -f tag_name=v1`)).toBe("release");
    expect(commandOp(`gh api --method DELETE repos/o/r/releases/9`)).toBe("release");
    expect(commandOp(`gh api -X PUT repos/o/r/pulls/5/merge`)).toBe("pr-merge");
  });

  it("still splits on unquoted separators after the quote fix", () => {
    expect(commandOp("ls | npm publish")).toBe("publish");
    expect(commandOp("echo hi & npm publish")).toBe("publish");
    expect(commandOp("false || npm publish")).toBe("publish");
    expect(invokedSegments("ls | npm publish")).toEqual(["ls", "npm publish"]);
  });
});

/**
 * Round-6 adversarial vector table.
 *
 * `bashRuns` is MEASURED, not reasoned: each vector was run with a harmless
 * stand-in for the blocked op and a file side effect as the detector. Stdout was
 * the first detector tried and it was wrong — a substitution's stdout is
 * consumed by the substitution, so `sh -c "$(…)"` and `FOO=1 $(…)` reported
 * "not run" for operations that do run. The round-5 regress is exactly what
 * happens when a posture is argued rather than executed, so the ground truth
 * here comes from bash.
 *
 * The `bashRuns: false` rows with a non-null `op` are ACCEPTED FALSE POSITIVES:
 * their quotes do not balance, so bash refuses the whole command with a syntax
 * error and nothing executes. Blocking them costs a malformed command a retry;
 * allowing the class costs an executable bypass.
 */
const ROUND6_VECTORS: ReadonlyArray<{ cmd: string; op: GitOp | null; bashRuns: boolean }> = [
  // — the regress #1208 introduced, both halves —
  { cmd: String.raw`echo $'don\'t' && npm publish`, op: "publish", bashRuns: true },
  { cmd: `echo $"hi" && gh pr merge 12`, op: "pr-merge", bashRuns: true },
  { cmd: `echo 'oops && npm publish`, op: "publish", bashRuns: false },
  { cmd: `echo "oops && gh pr merge 3`, op: "pr-merge", bashRuns: false },
  // — command substitution, the standing hole #1208 did not open and did not close —
  { cmd: `echo "$(npm publish)"`, op: "publish", bashRuns: true },
  { cmd: `echo $(npm publish)`, op: "publish", bashRuns: true },
  { cmd: "echo `npm publish`", op: "publish", bashRuns: true },
  { cmd: `sh -c "$(npm publish)"`, op: "publish", bashRuns: true },
  { cmd: `sh -c '$(npm publish)'`, op: "publish", bashRuns: true },
  { cmd: `FOO=1 $(gh release create v1)`, op: "release", bashRuns: true },
  { cmd: `cat <(npm publish)`, op: "publish", bashRuns: true },
  { cmd: `eval "npm publish"`, op: "publish", bashRuns: true },
  { cmd: `np''m publish`, op: "publish", bashRuns: true },
  // — classification INSIDE the substitution is by command position: a mention
  //   in an argument is not an invocation, one level down as one level up —
  { cmd: `echo "$(grep -c 'npm publish' package.json)"`, op: null, bashRuns: false },
  { cmd: `grep -n -E "foo|npm publish|bar" file.txt`, op: null, bashRuns: false },
  { cmd: `printf '{"cmd":"npm publish"}'`, op: null, bashRuns: false },
];

/**
 * Vectors bash RUNS and this guard does NOT classify — recorded because a table
 * holding only the rows that were fixed is the same false completeness this
 * round is about.
 *
 * Both need the shell's own runtime to resolve what the command word will be,
 * which is the line `Measured, deferred, and why` draws at "full shell parsing
 * in the guards": the guards classify, they do not interpret. Closing these
 * needs a different mechanism, not a longer regex.
 */
const ROUND6_OPEN_VECTORS: ReadonlyArray<{ cmd: string; why: string }> = [
  { cmd: `P=publish; npm $P`, why: "variable indirection — the op is not literal in the text" },
  { cmd: `echo publish | xargs npm`, why: "xargs composes the command word at runtime" },
];

describe("commandOp — round-6 adversarial vectors", () => {
  it.each(ROUND6_VECTORS)("classifies $cmd as $op", ({ cmd, op }) => {
    expect(commandOp(cmd)).toBe(op);
  });

  it("blocks every vector bash actually executes", () => {
    const escaped = ROUND6_VECTORS.filter((v) => v.bashRuns && commandOp(v.cmd) === null);
    expect(escaped.map((v) => v.cmd)).toEqual([]);
  });

  it("keeps the round-5 false positive allowed while the regress is blocked", () => {
    // Both pull on the same splitter; last round the trade went the wrong way
    // silently. Pinned together so neither can move alone.
    expect(commandOp(`grep -n -E "foo|npm publish|bar" docs/`)).toBeNull();
    expect(commandOp(String.raw`echo $'don\'t' && npm publish`)).toBe("publish");
  });

  it("records the vectors that remain open rather than implying coverage", () => {
    for (const { cmd, why } of ROUND6_OPEN_VECTORS) {
      expect(commandOp(cmd), `${cmd} — ${why}`).toBeNull();
    }
  });
});

describe("extractCommand", () => {
  it("reads the command out of a Claude-shaped envelope", () => {
    expect(
      extractCommand({ payload: { tool_name: "Bash", tool_input: { command: "git push" } } }),
    ).toBe("git push");
  });

  it("ignores non-command tools", () => {
    expect(extractCommand({ payload: { tool_name: "Read", tool_input: { file_path: "x" } } })).toBeNull();
  });
});

describe("isAffirmative", () => {
  it("accepts the shapes a numbered-options block produces", () => {
    for (const t of ["1", "2.", "1)", "Option 3", "ja", "ok", "mach das", "go ahead", "do it"]) {
      expect(isAffirmative(t), t).toBe(true);
    }
  });

  it("rejects anything that carries content of its own", () => {
    for (const t of [
      "release und fixe auch den schess bug",
      "ja, aber vorher noch die tests fixen",
      "ok?",
      "1 oder 2?",
      "",
      "mach den npm publish",
    ]) {
      expect(isAffirmative(t), t).toBe(false);
    }
  });
});

// The defect that blocked the 14.0.0 release three times over (2026-08-18).
//
// The ledger was ONE file per project root. This repo runs dozens of worktrees
// against a single root, so a second conversation's prompt overwrote the file
// between the user's authorization and the guard's read. The guard then saw a
// foreign session id, discarded the record as another conversation's consent,
// and refused with "no authorization in this turn's prompt" — a message that is
// false and that nothing in it lets you falsify.
describe("concurrent sessions", () => {
  it("another session's prompt does not destroy this session's authorization", () => {
    submit("ja, mach und merge den pr", "mine");
    expect(ledger("mine").authorized).toContain("pr-merge");

    // A different conversation in the same repo types something unrelated.
    submit("lies den code", "other");

    expect(ledger("mine").authorized).toContain("pr-merge");
  });

  it("and it does not lend its own authorization to anyone else", () => {
    submit("mach den npm publish", "mine");
    expect(ledger("mine").authorized).toContain("publish");
    expect(fs.existsSync(path.join(tmp, ledgerFileFor("other")))).toBe(false);
  });

  // The session id arrives from the host envelope, so it is untrusted input on
  // a path. What matters is not that `.` disappears — it is legal in a filename
  // — but that the id can never become more than ONE path component.
  it("a session id cannot escape the state directory", () => {
    const stateDir = path.resolve(tmp, "agents", "state");
    for (const hostile of ["../../../etc/passwd", "a/b", "..", "x y", "/abs/path"]) {
      for (const rel of [ledgerFileFor(hostile), pendingFileFor(hostile)]) {
        const resolved = path.resolve(tmp, rel);
        expect(resolved.startsWith(`${stateDir}${path.sep}`), `${hostile} → ${rel}`).toBe(true);
        expect(path.relative(stateDir, resolved).split(path.sep)).toHaveLength(2);
      }
    }
  });
});


// ---------------------------------------------------------------------------
// A notification is not a user turn.
//
// The payload fixture below is quoted from a REAL capture, not from
// documentation: `agents/runtime/.agent-chat-history` records prompts tagged
// `"source": "hook:claude:UserPromptSubmit"` — what the hook received, not what
// the host stored in its transcript. 9 of the 16 hook-sourced user records in
// this project's capture begin with `<task-notification>`.
// ---------------------------------------------------------------------------

const MACHINE_WAKE = `<task-notification>
<task-id>a768c2951088a0b2c</task-id>
<tool-use-id>toolu_01V1b9MmjHycdGkp7tRidadq</tool-use-id>
<status>completed</status>
<summary>Agent "Screen roadmap group A" finished</summary>
</task-notification>`;

describe("humanTypedThisTurn — the wake predicate", () => {
  it("a captured task notification is not a human turn", () => {
    expect(humanTypedThisTurn(MACHINE_WAKE)).toBe(false);
  });

  it("leading whitespace does not smuggle a wake past the prefix match", () => {
    expect(humanTypedThisTurn(`\n\n  ${MACHINE_WAKE}`)).toBe(false);
  });

  it("a typed turn is a human turn", () => {
    expect(humanTypedThisTurn("push it")).toBe(true);
    expect(humanTypedThisTurn("/roadmap:next und erstelle am ende einen PR")).toBe(true);
  });

  it("UNKNOWN ANSWERS YES — an unrecognised payload clears, never retains", () => {
    // The safe direction, asserted rather than intended. A predicate that
    // answered "machine" here would retain authorization across turns: a
    // strictly worse failure than the one being repaired, and a silent one.
    expect(humanTypedThisTurn("<some-future-host-envelope>whatever</some-future-host-envelope>")).toBe(true);
    expect(humanTypedThisTurn("{\"role\":\"user\"}")).toBe(true);
  });

  it("a human QUOTING a notification keeps their turn", () => {
    // Prefix-matched on purpose. Matching anywhere would make the question
    // "why did this <task-notification> clear my authorization?" clear it again.
    expect(
      humanTypedThisTurn(`why did this ${MACHINE_WAKE} clear my authorization?`),
    ).toBe(true);
  });
});

describe("a machine wake leaves per-turn state standing", () => {
  it("the ledger file is untouched — same content, same mtime", async () => {
    submit("push it");
    const file = path.join(tmp, ledgerFileFor("s1"));
    expect(ledger().authorized).toContain("push");
    const before = fs.readFileSync(file, "utf8");
    const beforeStat = fs.statSync(file).mtimeMs;

    // mtime has 1 ms resolution on some filesystems; make a rewrite visible.
    await new Promise((r) => setTimeout(r, 15));
    submit(MACHINE_WAKE);

    expect(fs.readFileSync(file, "utf8")).toBe(before);
    expect(fs.statSync(file).mtimeMs).toBe(beforeStat);
    expect(ledger().authorized).toContain("push");
  });

  it("the pending refusal survives, so the user's later `ja` still confirms", () => {
    // takePending() rmSync's the record BEFORE any affirmative or origin check,
    // so a notification arriving between a refusal and the confirmation used to
    // delete the record and make the `ja` confirm nothing.
    const pendingPath = path.join(tmp, pendingFileFor("s1"));
    fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
    fs.writeFileSync(
      pendingPath,
      JSON.stringify({ op: "push", session_id: "s1", refused_at: new Date().toISOString() }),
    );

    submit(MACHINE_WAKE);
    expect(fs.existsSync(pendingPath), "the wake consumed the pending refusal").toBe(true);

    submit("ja");
    expect(ledger().authorized).toContain("push");
  });

  it("a human turn still replaces the ledger — the fix does not become retention", () => {
    submit("push it");
    expect(ledger().authorized).toContain("push");
    submit("what does this function do?");
    expect(ledger().authorized).not.toContain("push");
  });
});
