// The pre-push hook's base-freshness gate (src/scripts/install-hooks.sh).
//
// WHY THIS FILE EXISTS. The hook's header has promised "when this hook refuses
// for staleness" since the hook was written, and until this change nothing in
// the body ever asked. The cost is measurable: over the 50 PRs preceding
// 2026-09-04, 25 carried at least one `Merge branch 'main' into <branch>`
// commit (52 in total), and the three workflows that failed most — Tests,
// Consistency, Rule Backstops — are exactly the base-relative ones. A branch
// pushed behind its base was green against a base it no longer merges into.
//
// The hook body is generated text inside a heredoc, so the tests extract it the
// way the installer writes it and run the real script. Asserting on the source
// string would pass while the shipped hook does nothing.
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const INSTALLER = path.resolve(__dirname, "../../src/scripts/install-hooks.sh");
const ZERO = "0".repeat(40);
const REAL = "9f1b2c3d4e5f60718293a4b5c6d7e8f901234567";
const PUSH = `refs/heads/topic ${REAL} refs/heads/topic ${ZERO}\n`;

const FRESHNESS = "Base freshness";
const BLOCKED = "Push blocked — the branch is behind its base";
const CONSISTENCY = "Consistency —";

let hook: string;

/** The pre-push body exactly as install-hooks.sh writes it. */
function extractPrePush(installer: string): string {
  const lines = fs.readFileSync(installer, "utf8").split("\n");
  const start = lines.findIndex((l) => l.includes(`cat > "$HOOKS_DIR/pre-push" <<`));
  if (start === -1) throw new Error("pre-push heredoc not found — did install-hooks.sh change shape?");
  const end = lines.findIndex((l, i) => i > start && l.trimEnd() === "EOF");
  if (end === -1) throw new Error("pre-push heredoc has no terminator");
  return `${lines.slice(start + 1, end).join("\n")}\n`;
}

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prepush-fresh-"));
  hook = path.join(dir, "pre-push");
  fs.writeFileSync(hook, extractPrePush(INSTALLER), { mode: 0o755 });
});

/**
 * Run the hook from a scratch cwd carrying a stub `./scripts-run` whose exit
 * code IS the freshness verdict — 1 = behind, 0 = current. The real gate makes
 * a network round trip; what is under test here is the hook's reaction to its
 * verdict, so the verdict is supplied rather than provoked.
 */
function run(verdict: 0 | 1 | "absent", env: Record<string, string> = {}): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "prepush-fresh-cwd-"));
  if (verdict !== "absent") {
    fs.writeFileSync(
      path.join(cwd, "scripts-run"),
      `#!/bin/sh\necho "stub scripts-run $*"\nexit ${verdict}\n`,
      { mode: 0o755 },
    );
  }
  // A `task` that succeeds, so the consistency block takes its REAL branch
  // rather than its "go-task not found" warning — the ordering assertion below
  // is about the gate that runs, not about the message that replaces it.
  const bin = path.join(cwd, "bin");
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, "task"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  try {
    return execFileSync("bash", [hook], {
      input: PUSH,
      cwd,
      encoding: "utf8",
      env: {
        PATH: `${bin}:/usr/bin:/bin`,
        HOME: cwd,
        AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT: "1",
        AGENT_CONFIG_SKIP_PREPUSH_STATIC: "1",
        ...env,
      },
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
}

describe("pre-push — base freshness", () => {
  it("asks at all — the gate is in the shipped body, not only in its header", () => {
    const body = extractPrePush(INSTALLER);
    expect(body).toContain("check_branch_freshness");
    // The header talked about staleness long before anything checked it, so pin
    // the INVOCATION rather than the word: a comment must not satisfy this test.
    expect(body).toMatch(/^[^#\n]*check_branch_freshness/m);
  });

  it("refuses the push when the branch is verified behind its base", () => {
    const out = run(1);
    expect(out).toContain(FRESHNESS);
    expect(out).toContain(BLOCKED);
    expect(out).toContain("task push-ready");
  });

  it("names the fix and never performs it — this hook refuses, it never merges", () => {
    const out = run(1);
    expect(out).toContain("it never merges");
    expect(out).not.toMatch(/git merge|git rebase/);
  });

  it("stops the run instead of collecting a second finding from a tree about to move", () => {
    // Everything after the freshness gate is answered against the stale base and
    // has to be redone after the merge, so a refusal EXITS rather than setting
    // `fail=1` and carrying on through ~10s of regeneration.
    const out = run(1);
    expect(out).not.toContain(CONSISTENCY);
  });

  it("runs BEFORE consistency, so the regeneration is not paid against a stale base", () => {
    const out = run(0);
    expect(out).toContain(FRESHNESS);
    expect(out).toContain(CONSISTENCY);
    expect(out.indexOf(FRESHNESS)).toBeLessThan(out.indexOf(CONSISTENCY));
  });

  it("lets a current branch straight through", () => {
    const out = run(0);
    expect(out).not.toContain(BLOCKED);
  });

  it("honours the documented WIP escape", () => {
    const out = run(1, { AGENT_CONFIG_SKIP_PREPUSH_FRESHNESS: "1" });
    expect(out).toContain("skipped via AGENT_CONFIG_SKIP_PREPUSH_FRESHNESS=1");
    expect(out).not.toContain(BLOCKED);
  });

  it("degrades to a warning, never a block, where scripts-run is not present", () => {
    // A consumer checkout or a partial worktree has no `./scripts-run`. A gate
    // that blocked there would refuse pushes for a reason the contributor did
    // not cause — the exact anti-pattern the preflight block already avoids.
    const out = run("absent");
    expect(out).toContain("./scripts-run not found");
    expect(out).not.toContain(BLOCKED);
  });

  it("never asks on a delete-only push — that short-circuit stays above it", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "prepush-fresh-del-"));
    fs.writeFileSync(path.join(cwd, "scripts-run"), "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    let out: string;
    try {
      out = execFileSync("bash", [hook], {
        input: `(delete) ${ZERO} refs/heads/release/14.0.0 ${REAL}\n`,
        cwd,
        encoding: "utf8",
        env: { PATH: "/usr/bin:/bin", HOME: cwd },
      });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    expect(out).toContain("Delete-only push");
    expect(out).not.toContain(FRESHNESS);
  });
});
