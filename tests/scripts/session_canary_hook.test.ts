// Tests for src/scripts/session_canary_hook.ts — the session_start injection
// that keeps the session-canary contract (greet-by-name at task start +
// reply-close markers) present in every new conversation. Feeds stdin
// envelopes to the tsx hook against a temp workspace carrying a fixture
// .agent-settings.yml and asserts exit code + the injected context block.
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const TS_SCRIPT = path.join(REPO_ROOT, "src", "scripts", "session_canary_hook.ts");
const TSX_BIN = path.join(
  REPO_ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tsx.cmd" : "tsx",
);

const tmpDirs: string[] = [];

function makeWorkspace(settingsYaml: string | null): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "session-canary-"));
  tmpDirs.push(dir);
  if (settingsYaml !== null) {
    fs.writeFileSync(path.join(dir, ".agent-settings.yml"), settingsYaml, "utf-8");
  }
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

function run(envelope: unknown): { stdout: string; status: number | null } {
  const r = spawnSync(TSX_BIN, [TS_SCRIPT], {
    encoding: "utf8",
    cwd: REPO_ROOT,
    input: typeof envelope === "string" ? envelope : JSON.stringify(envelope),
  });
  expect(r.status).not.toBeNull();
  return { stdout: r.stdout as string, status: r.status };
}

const SETTINGS_WITH_NAME = [
  "personal:",
  "  ide: \"\"",
  "  canary_name: \"Mathias\"  # liveness signal",
  "quality:",
  "  local_auto_run: false",
  "",
].join("\n");

describe("session_canary_hook", () => {
  it("injects the canary block on session_start when canary_name is set", () => {
    const root = makeWorkspace(SETTINGS_WITH_NAME);
    const { stdout, status } = run({ event: "session_start", workspace_root: root });
    expect(status).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.decision).toBe("allow");
    expect(out.context).toContain("<session-canary");
    expect(out.context).toContain('"Mathias"');
    expect(out.context).toContain("LITERAL LAST LINE");
  });

  it("strips surrounding quotes and never leaks them into the block", () => {
    const root = makeWorkspace("personal:\n  canary_name: 'Mathias'\n");
    const { stdout } = run({ event: "session_start", workspace_root: root });
    const out = JSON.parse(stdout);
    expect(out.context).toContain('addressing the user by name: "Mathias"');
    expect(out.context).not.toContain("'Mathias'");
  });

  it("no-ops (exit 0, no stdout) when canary_name is empty", () => {
    const root = makeWorkspace('personal:\n  canary_name: ""\n');
    const { stdout, status } = run({ event: "session_start", workspace_root: root });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("no-ops when the settings file is missing", () => {
    const root = makeWorkspace(null);
    const { stdout, status } = run({ event: "session_start", workspace_root: root });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("no-ops on a non-session_start event even when configured", () => {
    const root = makeWorkspace(SETTINGS_WITH_NAME);
    const { stdout, status } = run({ event: "post_tool_use", workspace_root: root });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("ignores a canary_name key outside the personal: section", () => {
    const root = makeWorkspace("quality:\n  canary_name: \"Eve\"\npersonal:\n  ide: \"\"\n");
    const { stdout, status } = run({ event: "session_start", workspace_root: root });
    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  it("sanitizes markup characters and caps the length", () => {
    const long = "A".repeat(100);
    const root = makeWorkspace(`personal:\n  canary_name: "<b>${long}</b>"\n`);
    const { stdout } = run({ event: "session_start", workspace_root: root });
    const out = JSON.parse(stdout);
    expect(out.context).not.toContain("<b>");
    // "<b>" loses its brackets → "b", then the name is capped at 64 chars.
    expect(out.context).toContain(`"b${"A".repeat(63)}"`);
  });

  it("survives a malformed envelope without blocking (exit 0)", () => {
    const { status } = run("this is not json");
    expect(status).toBe(0);
  });
});
