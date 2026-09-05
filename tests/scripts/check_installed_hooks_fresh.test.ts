// The installed-hook staleness gate and its two carriers.
//
// Measured 2026-09-05, before any of this existed: the installed `pre-push` in
// this repository was 146 lines against a 189-line source body, missing the
// entire base-freshness gate merged five days earlier. Nothing anywhere said
// so. These tests pin both directions of the detector and both directions of
// the post-merge carrier, because a staleness check that has only been seen
// green has unknown sensitivity.
//
// Everything runs against hooks RENDERED BY THE REAL INSTALLER into a scratch
// directory (`AGENT_CONFIG_HOOKS_DIR`), never against a slice of the source
// file: `post-merge` and `post-checkout` are a heredoc plus an appended block,
// so no slice of install-hooks.sh equals what is installed.
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { inspect, renderExpected } from "../../src/scripts/check_installed_hooks_fresh.js";

const REPO = path.resolve(__dirname, "../..");
const GATE = path.join(REPO, "src/scripts/check_installed_hooks_fresh.ts");
const INSTALLER = path.join(REPO, "src/scripts/install-hooks.sh");
const TSX = path.join(REPO, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");

const MANAGED = [
  "pre-push",
  "pre-commit",
  "post-commit",
  "post-merge",
  "post-checkout",
  "post-rewrite",
];

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Install the real hook set into `dir` the way `task install-hooks` would. */
function installInto(dir: string): void {
  execFileSync("bash", [INSTALLER], {
    cwd: REPO,
    env: { ...process.env, AGENT_CONFIG_HOOKS_DIR: dir },
    encoding: "utf8",
    stdio: "pipe",
  });
}

/** Run the gate's real CLI with arbitrary argv. */
function runGateArgv(args: string[]): { code: number; out: string } {
  const res = spawnSync(TSX, [GATE, ...args], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return { code: res.status ?? 1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

/** Run the gate's real CLI against an arbitrary installed-hooks directory. */
function runGate(hooksDir: string): { code: number; out: string } {
  const res = spawnSync(TSX, [GATE, "--hooks-dir", hooksDir], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return { code: res.status ?? 1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

describe("check_installed_hooks_fresh — the detector, both directions", () => {
  let fresh: string;

  beforeAll(() => {
    fresh = tmp("hookfresh-clean-");
    installInto(fresh);
  });

  it("renders every managed hook, so the comparison has a corpus", () => {
    const rendered = renderExpected(REPO);
    for (const name of MANAGED) {
      expect(rendered.has(name), `installer did not write ${name}`).toBe(true);
    }
    // Guard against a renderer that silently produced stubs.
    expect(rendered.get("pre-push")!.toString("utf8").split("\n").length).toBeGreaterThan(100);
  });

  it("reports CLEAN on a freshly-installed hook set", () => {
    const { code, out } = runGate(fresh);
    expect(out).toContain("scanned: 6");
    expect(out).toContain("installed hook(s) match");
    expect(code).toBe(0);
  });

  it("reports STALE on a truncated hook, and names it and the fix", () => {
    const stale = tmp("hookfresh-truncated-");
    installInto(stale);
    const target = path.join(stale, "pre-push");
    const body = fs.readFileSync(target, "utf8").split("\n");
    // The measured real-world shape: a hook that is an older, shorter prefix
    // of what the installer now writes.
    fs.writeFileSync(target, `${body.slice(0, 60).join("\n")}\n`, { mode: 0o755 });

    const { code, out } = runGate(stale);
    expect(code).toBe(1);
    expect(out).toContain("does not match this checkout");
    expect(out).toContain("pre-push");
    expect(out).toContain("task install-hooks");
    // A mismatch proves difference, never which side is newer, so the notice
    // must not prescribe the re-install unconditionally: from a behind-base
    // checkout it writes the OLDER hook set over the shared directory.
    expect(out).toContain("does not by itself say which side is newer");
    expect(out).toContain("behind the base");
    expect(out).toContain("sibling worktree");
    // The other five must NOT be named — a detector that flags everything is
    // as useless as one that flags nothing.
    for (const name of MANAGED.filter((n) => n !== "pre-push")) {
      expect(out, `${name} should not be reported stale`).not.toMatch(
        new RegExp(`^\\s+${name}\\s`, "m"),
      );
    }
  });

  it("reports STALE when a managed hook was deleted", () => {
    const missing = tmp("hookfresh-missing-");
    installInto(missing);
    fs.rmSync(path.join(missing, "pre-commit"));
    const { code, out } = runGate(missing);
    expect(code).toBe(1);
    expect(out).toContain("MISSING");
    expect(out).toContain("pre-commit");
  });

  it("is not fooled by a one-byte edit", () => {
    const nudged = tmp("hookfresh-nudged-");
    installInto(nudged);
    const target = path.join(nudged, "post-merge");
    fs.appendFileSync(target, "\n");
    expect(runGate(nudged).code).toBe(1);
  });

  it("reports a hook that lost its executable bit, byte-identical or not", () => {
    // Git SKIPS a non-executable hook, so this is the installed-but-inert case
    // the gate exists to find. Content-only comparison called it `match`.
    const inert = tmp("hookfresh-noexec-");
    installInto(inert);
    fs.chmodSync(path.join(inert, "pre-push"), 0o644);
    const { code, out } = runGate(inert);
    expect(code).toBe(1);
    expect(out).toContain("NOT EXECUTABLE");
    expect(out).toContain("pre-push");
  });

  it("distinguishes an unreadable hook from a missing one", () => {
    const unread = tmp("hookfresh-unreadable-");
    installInto(unread);
    // A directory where a file is expected: EISDIR on read, and a re-install
    // will not fix it, so it must not be reported as MISSING.
    fs.rmSync(path.join(unread, "post-commit"));
    fs.mkdirSync(path.join(unread, "post-commit"));
    const { code, out } = runGate(unread);
    expect(code).toBe(1);
    expect(out).toContain("UNREADABLE");
    expect(out).not.toMatch(/post-commit\s+MISSING/);
  });

  it("exits 0 and says so when nothing is installed at all", () => {
    const empty = tmp("hookfresh-empty-");
    const { code, out } = runGate(empty);
    expect(code).toBe(0);
    expect(out).toContain("no managed hook is installed");
    expect(out).toContain("scanned: 6");
  });

  it("ignores unmanaged files in the hooks directory", () => {
    const extras = tmp("hookfresh-extras-");
    installInto(extras);
    fs.writeFileSync(path.join(extras, "pre-commit.bak-20260729"), "stale backup\n");
    fs.writeFileSync(path.join(extras, "commit-msg.sample"), "sample\n");
    expect(runGate(extras).code).toBe(0);
  });

  it("treats `--hooks-dir --quiet` as a usage error, not as staleness", () => {
    // Swallowing the flag as a path reports every hook missing and exits 1 —
    // a staleness verdict for a typo. Exit 2 is what the contract reserves.
    const { code, out } = runGateArgv(["--hooks-dir", "--quiet"]);
    expect(code).toBe(2);
    expect(out).toContain("needs a path");
    expect(out).not.toContain("does not match this checkout");
  });

  it("refuses to run the installer without a real redirect", () => {
    // The seam fails open: install-hooks.sh treats an EMPTY value as "install
    // normally", which would overwrite the real .git/hooks — including the
    // pre-push running the inspection.
    const res = spawnSync("bash", [INSTALLER], {
      cwd: REPO,
      encoding: "utf8",
      env: { ...process.env, AGENT_CONFIG_HOOKS_DIR: "" },
    });
    expect(res.status).toBe(2);
    expect(`${res.stdout ?? ""}${res.stderr ?? ""}`).toContain("set but empty");
  });

  it("exposes the same verdict through the library entry point", () => {
    const report = inspect(REPO, fresh);
    expect(report.neverInstalled).toBe(false);
    expect(report.verdicts.every((v) => v.state === "match")).toBe(true);
  });
});

describe("carrier — the pre-push hook body", () => {
  const rendered = () => renderExpected(REPO).get("pre-push")!.toString("utf8");

  it("calls the gate, guarded, and offers a way to silence it", () => {
    const body = rendered();
    expect(body).toContain("src/scripts/check_installed_hooks_fresh");
    expect(body).toContain("AGENT_CONFIG_SKIP_PREPUSH_HOOKFRESH");
    // All three guards, and -d node_modules is the one the blocking version
    // omitted while its sibling carrier had it.
    expect(body).toMatch(/-x \.\/scripts-run/);
    expect(body).toMatch(/-d node_modules/);
    expect(body).toMatch(/-f src\/scripts\/check_installed_hooks_fresh\.ts/);
  });

  it("runs AFTER base freshness and before preflight", () => {
    // Being behind a base that moved the installer is the commonest cause of a
    // mismatch, and its repair is to MERGE. Base freshness exits first, so that
    // contributor is never handed a re-install that would write the OLDER hook
    // set over the shared directory.
    const body = rendered();
    const hookFresh = body.indexOf("Installed-hook freshness");
    const baseFresh = body.indexOf("Base freshness");
    const preflight = body.indexOf("Preflight — the CI-only");
    expect(baseFresh).toBeGreaterThan(-1);
    expect(hookFresh).toBeGreaterThan(baseFresh);
    expect(hookFresh).toBeLessThan(preflight);
  });

  it("is ADVISORY — it never sets fail or exits on a mismatch", () => {
    // The predicate has no unique referent across linked worktrees sharing one
    // .git/hooks, so a refusal fires on ordinary parallel work. Pinned so a
    // future edit cannot quietly promote it back to a blocker.
    const body = rendered();
    const start = body.indexOf("# INSTALLED-HOOK FRESHNESS");
    const end = body.indexOf("if ! command -v task", start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const block = body.slice(start, end);
    expect(block).not.toMatch(/^\s*exit 1\s*$/m);
    expect(block).not.toMatch(/^\s*fail=1\s*$/m);
    // …and it distinguishes "could not render" from "mismatch".
    expect(block).toContain("not a staleness verdict");
  });
});

/**
 * Build a scratch git repo whose ORIG_HEAD..HEAD diff touches `touched`, drop
 * the rendered `post-merge` into it, and run it.
 *
 * `./scripts-run` is a recording shim: the assertion is about WHICH command the
 * hook decided to run, not about what the real gate would answer.
 */
function runPostMerge(touched: string, gatePresent = true): {
  invoked: string;
  hookBefore: string;
  hookAfter: string;
  out: string;
} {
  const dir = tmp("postmerge-");
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  // Nothing may fire on the first commit; the diff is prev..new.
  fs.writeFileSync(path.join(dir, "seed.txt"), "seed\n");
  git("add", "seed.txt");
  git("commit", "-qm", "seed");
  const prev = git("rev-parse", "HEAD").trim();

  fs.mkdirSync(path.join(dir, path.dirname(touched)), { recursive: true });
  fs.writeFileSync(path.join(dir, touched), "changed\n");
  git("add", touched);
  git("commit", "-qm", "second");

  // The hook refuses to call a gate that is not on this checkout — .git/hooks
  // is shared across linked worktrees, so it runs on branches that predate it.
  if (gatePresent) {
    fs.mkdirSync(path.join(dir, "src", "scripts"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src/scripts/check_installed_hooks_fresh.ts"), "");
  }

  // post-merge reads ORIG_HEAD for the previous side of the range.
  fs.writeFileSync(path.join(dir, ".git", "ORIG_HEAD"), `${prev}\n`);

  // The two guards the hook checks before it runs anything.
  fs.mkdirSync(path.join(dir, "node_modules"), { recursive: true });
  const log = path.join(dir, "invoked.log");
  fs.writeFileSync(
    path.join(dir, "scripts-run"),
    `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> ${JSON.stringify(log)}\nexit 0\n`,
    { mode: 0o755 },
  );

  const hookPath = path.join(dir, "post-merge");
  fs.writeFileSync(hookPath, renderExpected(REPO).get("post-merge")!, { mode: 0o755 });
  const hookBefore = fs.readFileSync(hookPath, "utf8");

  const res = spawnSync("bash", [hookPath], {
    cwd: dir,
    encoding: "utf8",
    // No `task`, no `npm`: this test is about the decision, not the rebuild.
    env: { PATH: "/usr/bin:/bin", HOME: dir },
  });

  return {
    invoked: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "",
    hookBefore,
    hookAfter: fs.readFileSync(hookPath, "utf8"),
    out: `${res.stdout ?? ""}${res.stderr ?? ""}`,
  };
}

describe("carrier — post-merge, both directions", () => {
  it("reports staleness when the range moves the installer", () => {
    const r = runPostMerge("src/scripts/install-hooks.sh");
    expect(r.invoked).toContain("src/scripts/check_installed_hooks_fresh");
  });

  it("stays silent on a checkout that predates the gate", () => {
    // The shared-worktree case: same triggering diff, gate absent from the
    // tree. The hook must not call it and must not fail.
    const r = runPostMerge("src/scripts/install-hooks.sh", false);
    expect(r.invoked).not.toContain("check_installed_hooks_fresh");
  });

  it("stays silent when the range touches nothing relevant", () => {
    const r = runPostMerge("docs/unrelated.md");
    expect(r.invoked).not.toContain("check_installed_hooks_fresh");
  });

  it("never rewrites the hook it is running from", () => {
    // The refused mutation, pinned. A bash script that overwrites its own path
    // mid-run stops executing there and exits 0 — measured 2026-09-05 — so a
    // repair placed here would silently truncate the rest of this very block.
    // An AI council (2 of 2 seats, 2026-09-05) refused it for the separate
    // reason that .git/hooks is shared across linked worktrees.
    const r = runPostMerge("src/scripts/install-hooks.sh");
    expect(r.hookAfter).toBe(r.hookBefore);
    expect(r.hookAfter).not.toContain("AGENT_CONFIG_HOOKS_DIR");
  });
});
