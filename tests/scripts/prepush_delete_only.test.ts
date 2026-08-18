// The pre-push hook's delete-only short-circuit (src/scripts/install-hooks.sh).
//
// Measured 2026-08-18 during the 14.0.0 release: `git push origin --delete
// release/14.0.0` was refused by the branch-freshness gate because the
// CHECKED-OUT branch was behind main — a fact with no bearing on removing a
// remote ref. The deletion then had to go through the GitHub API, which routes
// around the entire hook rather than around the one gate that misfired.
//
// The hook body is generated text inside a heredoc, so the test extracts it the
// way the installer writes it and runs the real script against synthetic stdin.
// Asserting on the source string instead would pass while the shipped hook is
// broken.
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const INSTALLER = path.resolve(__dirname, "../../src/scripts/install-hooks.sh");
const ZERO = "0".repeat(40);
const REAL = "9f1b2c3d4e5f60718293a4b5c6d7e8f901234567";
const MARKER = "Delete-only push";

let hook: string;

/** The pre-push body exactly as install-hooks.sh writes it. */
function extractPrePush(installer: string): string {
  const lines = fs.readFileSync(installer, "utf8").split("\n");
  const start = lines.findIndex((l) => l.includes(`cat > "$HOOKS_DIR/pre-push" <<`));
  if (start === -1) {
    throw new Error("pre-push heredoc not found — did install-hooks.sh change shape?");
  }
  const end = lines.findIndex((l, i) => i > start && l.trimEnd() === "EOF");
  if (end === -1) {
    throw new Error("pre-push heredoc has no terminator");
  }
  return `${lines.slice(start + 1, end).join("\n")}\n`;
}

beforeAll(() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prepush-"));
  hook = path.join(dir, "pre-push");
  fs.writeFileSync(hook, extractPrePush(INSTALLER), { mode: 0o755 });
});

/**
 * Run the hook with `refs` on stdin, from a scratch cwd and a PATH without
 * `task`, so the negative cases stop at the first content gate instead of
 * regenerating the tree. Only the marker is asserted, never the exit code of
 * that later failure.
 */
function run(refs: string): string {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "prepush-cwd-"));
  try {
    return execFileSync("bash", [hook], {
      input: refs,
      cwd,
      encoding: "utf8",
      env: {
        PATH: "/usr/bin:/bin",
        HOME: cwd,
        AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT: "1",
        AGENT_CONFIG_SKIP_PREPUSH_STATIC: "1",
      },
    });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return `${err.stdout ?? ""}${err.stderr ?? ""}`;
  }
}

describe("pre-push — delete-only push", () => {
  it("extracts a hook body that actually looks like the hook", () => {
    const body = extractPrePush(INSTALLER);
    expect(body).toContain("#!/usr/bin/env bash");
    expect(body).toContain("Preflight");
    // Guard against the extractor silently grabbing a one-line slice.
    expect(body.split("\n").length).toBeGreaterThan(40);
  });

  it("skips every content gate when the only ref is a deletion", () => {
    const out = run(`(delete) ${ZERO} refs/heads/release/14.0.0 ${REAL}\n`);
    expect(out).toContain(MARKER);
    // Proof it short-circuited rather than merely printing on the way through.
    expect(out).not.toContain("Preflight");
  });

  it("skips when several refs are all deletions", () => {
    const out = run(
      `(delete) ${ZERO} refs/heads/a ${REAL}\n(delete) ${ZERO} refs/heads/b ${REAL}\n`,
    );
    expect(out).toContain(MARKER);
  });

  it("does NOT skip an ordinary push", () => {
    const out = run(`refs/heads/topic ${REAL} refs/heads/topic ${ZERO}\n`);
    expect(out).not.toContain(MARKER);
  });

  it("does NOT skip when a deletion rides along with a real ref", () => {
    const out = run(
      `(delete) ${ZERO} refs/heads/old ${REAL}\nrefs/heads/topic ${REAL} refs/heads/topic ${ZERO}\n`,
    );
    expect(out).not.toContain(MARKER);
  });

  it("does NOT skip when git passes no refs at all", () => {
    const out = run("");
    expect(out).not.toContain(MARKER);
  });
});
