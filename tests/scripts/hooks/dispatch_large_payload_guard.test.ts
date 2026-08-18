/**
 * Large-payload guard integrity — the negative test for a MEASURED bypass.
 *
 * ## What went wrong
 *
 * `dispatch_hook` read `process.stdin.isTTY` before reading fd 0. Touching
 * `process.stdin` lazily constructs the stream and puts fd 0 into non-blocking
 * mode; `fs.readFileSync(0)` then throws `EAGAIN` as soon as the payload exceeds
 * the pipe buffer, and the reader's `catch { return "" }` turned that into "no
 * input". Every `PreToolUse` guard therefore saw an EMPTY envelope — no tool
 * name, no command — and the dispatcher exited 0.
 *
 * Reproduced on the shipped bundle on 2026-08-18: `git commit --no-verify` was
 * DENIED at a small payload size and ALLOWED once the same payload was padded to
 * 300 KB. Not an exotic input either — a `PostToolUse` `tool_response` carrying
 * a large file read or verbose command output reaches these sizes routinely.
 *
 * ## Why the test is shaped like this
 *
 * It drives the real bundle over a real pipe, because the defect lives in the
 * interaction between the pipe's blocking mode and the read — a unit test
 * against a string input cannot express it. `block-no-verify` is the probe
 * because it is `severity: blocking` and `fail_closed: true`: it is the concern
 * whose silence is least acceptable, so it is the one worth pinning.
 *
 * A regression here reads as "the guard stopped seeing large payloads", which is
 * exactly the sentence the old code made unobservable.
 */
import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as os from "node:os";

import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const BUNDLE = path.join(REPO_ROOT, "dist", "hooks", "dispatch.js");

/** Pad sizes: below the pipe buffer, and two sizes measured to break it. */
const PAD_SIZES = [0, 300_000, 2_000_000];

/**
 * A throwaway project dir, NOT the working repo.
 *
 * `--project-dir` is where the concern chain writes its state and where
 * `ship-diff-volume` runs its git scans; pointing it at `REPO_ROOT` meant three
 * real twelve-concern chains executed against the live checkout every time the
 * suite ran. The property under test needs only the payload — the dispatcher
 * resolves its manifest from the BUNDLE's own tree, not from here. Found by the
 * R2 review.
 */
function makeProjectDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dispatch-large-payload-"));
  projectDirs.push(dir);
  return dir;
}

const projectDirs: string[] = [];
afterAll(() => {
  for (const d of projectDirs) fs.rmSync(d, { recursive: true, force: true });
});

function dispatchPreToolUse(padBytes: number): { status: number | null; stderr: string } {
  const projectDir = makeProjectDir();
  const toolInput: Record<string, unknown> = {
    command: 'git commit --no-verify -m "bypass"',
  };
  if (padBytes > 0) toolInput["description"] = "x".repeat(padBytes);
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: projectDir };
  // NOT replay mode: replay short-circuits concerns, which would make this
  // assert nothing at all.
  delete env["AGENT_CONFIG_REPLAY"];
  const proc = spawnSync(
    process.execPath,
    [BUNDLE, "--platform", "claude", "--event", "pre_tool_use", "--project-dir", projectDir],
    {
      input: JSON.stringify({
        session_id: "dispatch-large-payload-guard-test",
        cwd: projectDir,
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: toolInput,
      }),
      encoding: "utf-8",
      env,
      // Under the vitest testTimeout (10 s) and just over readStdinText's
      // ~10 s EAGAIN budget, so a regression of the class this test exists to
      // catch fails the assertion rather than timing the suite out. Found by
      // the R2 review.
      timeout: 8_000,
    },
  );
  return { status: proc.status, stderr: proc.stderr ?? "" };
}

describe.skipIf(!fs.existsSync(BUNDLE))("dispatch — guards see the payload at any size", () => {
  for (const pad of PAD_SIZES) {
    it(`blocks --no-verify with ${pad} bytes of payload padding`, () => {
      const { status, stderr } = dispatchPreToolUse(pad);
      // Exit 2 + stderr is the documented way to make Claude Code refuse the
      // action; a 0 here is the bypass.
      expect(status).toBe(2);
      expect(stderr).toContain("block-no-verify");
    });
  }

  it("the padded payload really is over the pipe buffer", () => {
    // Guards the guard: if a future edit shrinks PAD_SIZES below the threshold
    // the cases above would pass while testing nothing.
    expect(Math.max(...PAD_SIZES)).toBeGreaterThan(64 * 1024);
  });
});

// ── the other direction: an fd 0 nobody writes to ────────────────────
//
// The retry loop that fixed the large-payload read made the OPPOSITE case
// expensive, and it cost a CI hang to notice. A child that inherits an open but
// unwritten stdin — what a caller gets when it spawns without piping stdin —
// used to return immediately (`readFileSync(0)` threw EAGAIN, the catch returned
// ""). With an uncapped retry budget it instead spent ~10 s spinning and returned
// "" anyway: measured 12.4 s per invocation, and hundreds of them left three
// Node-Tests shards in_progress for over an hour.
//
// `HOOK_FIRST_BYTE_TIMEOUT_MS` caps the wait for the FIRST byte only, so this
// case is fast again while the large-payload cases above still get the full
// budget once bytes are flowing. Both directions are asserted, because fixing
// either one alone is what produced each of these two defects in turn.

describe.skipIf(!fs.existsSync(BUNDLE))("dispatch — an idle stdin does not stall the hook", () => {
  it("returns promptly when fd 0 is an open pipe nobody writes to", async () => {
    const projectDir = makeProjectDir();
    const started = Date.now();
    const code = await new Promise<number | null>((resolve) => {
      const child = spawn(
        process.execPath,
        [BUNDLE, "--platform", "claude", "--event", "stop", "--project-dir", projectDir],
        {
          // 'pipe' and then never write, never end() — the inherited-idle shape.
          stdio: ["pipe", "ignore", "ignore"],
          env: { ...process.env, AGENT_CONFIG_REPLAY: "1", CLAUDE_PROJECT_DIR: projectDir },
        },
      );
      const killer = setTimeout(() => child.kill("SIGKILL"), 8_000);
      child.on("exit", (c) => {
        clearTimeout(killer);
        resolve(c);
      });
    });
    const elapsed = Date.now() - started;
    expect(code).toBe(0);
    // Generous against runner noise and still an order of magnitude under the
    // ~10 s an uncapped read spent here, and two orders under the unbounded
    // block a blocking fd produced. Measured 239 ms locally.
    expect(elapsed).toBeLessThan(4_000);
  });
});
