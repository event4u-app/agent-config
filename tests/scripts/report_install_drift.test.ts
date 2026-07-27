// Tests for src/scripts/_lib/install_drift.ts + src/scripts/report_install_drift.ts.
//
// The installer drift report is a MEASUREMENT, never a gate: it compares the
// sha256 hashes recorded in `agents/installed-tools.lock` (`kind: 'deployed'`
// entries) against the current on-disk content of those files. This suite
// covers the library (collect_drift / format_drift_report) directly with a
// real v2 manifest built via `installed_tools.write_manifest` (so the fixture
// matches the byte-exact wire format the real installer writes), plus the CLI
// wrapper via the in-process runner — asserting the report ALWAYS exits 0
// (clean, modified, missing, or no-manifest-at-all), and that only a genuine
// usage error (bad --format value) exits non-zero.
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as installed_tools from "../../src/scripts/_lib/installed_tools.js";
import { collect_drift, format_drift_report, type DriftEntry } from "../../src/scripts/_lib/install_drift.js";
import { main } from "../../src/scripts/report_install_drift.js";
import { runInProc } from "../_lib/run_in_process.js";

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "install-drift-"));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/**
 * Write a deployed file + a matching v2 manifest recording its sha256, using
 * the real `installed_tools.write_manifest` writer (byte-exact wire format).
 * Returns the deployed file's absolute path and its recorded content.
 */
function seedDeployedFile(projectRoot: string, content: string): { filePath: string; manifestPath: string } {
  const deployedDir = path.join(projectRoot, ".claude", "skills", "foo");
  fs.mkdirSync(deployedDir, { recursive: true });
  const filePath = path.join(deployedDir, "SKILL.md");
  fs.writeFileSync(filePath, content, "utf-8");

  const manifestPath = path.join(projectRoot, "agents", "installed-tools.lock");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  installed_tools.write_manifest(manifestPath, "1.0.0", [
    {
      name: "claude-code",
      scope: "global",
      bridge_marker: "~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG",
      installed_at: "2026-05-12",
      files: [{ path: filePath, kind: "deployed", sha256: sha256(content) }],
    },
  ]);
  return { filePath, manifestPath };
}

describe("collect_drift", () => {
  it("no manifest at all → null (distinct from a clean report)", () => {
    expect(collect_drift(tmp)).toBeNull();
  });

  it("clean: recorded sha256 matches on-disk content → []", () => {
    seedDeployedFile(tmp, "# Skill\n\nbody\n");
    expect(collect_drift(tmp)).toEqual([]);
  });

  it("modified: on-disk content changed since install → one 'modified' entry", () => {
    const { filePath } = seedDeployedFile(tmp, "# Skill\n\nbody\n");
    const recorded = sha256("# Skill\n\nbody\n");
    fs.writeFileSync(filePath, "# Skill\n\nEDITED body\n", "utf-8");

    const drift = collect_drift(tmp) as DriftEntry[];
    expect(drift).toHaveLength(1);
    expect(drift[0]!.tool_id).toBe("claude-code");
    expect(drift[0]!.path).toBe(filePath);
    expect(drift[0]!.status).toBe("modified");
    expect(drift[0]!.recorded_sha256).toBe(recorded);
    expect(drift[0]!.current_sha256).toBe(sha256("# Skill\n\nEDITED body\n"));
    expect(drift[0]!.current_sha256).not.toBe(drift[0]!.recorded_sha256);
  });

  it("missing: deployed file deleted since install → one 'missing' entry", () => {
    const { filePath } = seedDeployedFile(tmp, "# Skill\n\nbody\n");
    fs.rmSync(filePath);

    const drift = collect_drift(tmp) as DriftEntry[];
    expect(drift).toHaveLength(1);
    expect(drift[0]!.status).toBe("missing");
    expect(drift[0]!.current_sha256).toBeNull();
    expect(drift[0]!.path).toBe(filePath);
  });

  it("non-deployed kinds (bridge/marker) never appear even when they drift", () => {
    const manifestPath = path.join(tmp, "agents", "installed-tools.lock");
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const markerPath = path.join(tmp, ".windsurf", "PROJECT_MANAGED_BY_AGENT_CONFIG");
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(markerPath, "marker\n", "utf-8");
    installed_tools.write_manifest(manifestPath, "1.0.0", [
      {
        name: "windsurf",
        scope: "project",
        bridge_marker: markerPath,
        installed_at: "2026-05-12",
        files: [{ path: markerPath, kind: "bridge", sha256: null }],
      },
    ]);
    fs.rmSync(markerPath); // would be "missing" if bridge kind were considered
    expect(collect_drift(tmp)).toEqual([]);
  });
});

describe("format_drift_report", () => {
  it("null → explicit no-manifest line", () => {
    expect(format_drift_report(null)).toBe(
      "Installer drift: no installed-tools manifest found — nothing to report.\n",
    );
  });

  it("[] → explicit clean line", () => {
    expect(format_drift_report([])).toBe(
      "Installer drift: no local modifications detected in framework-authoritative files.\n",
    );
  });

  it("drift entries → one line per file + a summary count", () => {
    const entries: DriftEntry[] = [
      { tool_id: "claude-code", path: "/p/a", status: "modified", recorded_sha256: "aaa", current_sha256: "bbb" },
      { tool_id: "claude-code", path: "/p/b", status: "missing", recorded_sha256: "ccc", current_sha256: null },
    ];
    const report = format_drift_report(entries);
    expect(report).toContain("modified  [claude-code]  /p/a");
    expect(report).toContain("missing   [claude-code]  /p/b");
    expect(report).toContain("2 framework-authoritative file(s)");
    expect(report).toContain("1 modified, 1 missing");
  });
});

describe("report_install_drift CLI — always exits 0 on a report", () => {
  it("no manifest: exit 0, no-manifest message, cwd default", () => {
    const r = runInProc(main, [], { cwd: tmp });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no installed-tools manifest found");
  });

  it("clean project via --project: exit 0, clean message", () => {
    seedDeployedFile(tmp, "clean content\n");
    const r = runInProc(main, ["--project", tmp]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no local modifications detected");
  });

  it("modified file: exit 0 (never a gate), reports the drift", () => {
    const { filePath } = seedDeployedFile(tmp, "original\n");
    fs.writeFileSync(filePath, "edited\n", "utf-8");
    const r = runInProc(main, ["--project", tmp]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("modified");
    expect(r.stdout).toContain("1 framework-authoritative file(s)");
  });

  it("--format json emits parseable JSON with manifest_found + drift", () => {
    const { filePath } = seedDeployedFile(tmp, "original\n");
    fs.writeFileSync(filePath, "edited\n", "utf-8");
    const r = runInProc(main, ["--project", tmp, "--format", "json"]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { project_root: string; manifest_found: boolean; drift: DriftEntry[] };
    expect(parsed.manifest_found).toBe(true);
    expect(parsed.drift).toHaveLength(1);
    expect(parsed.drift[0]!.status).toBe("modified");
  });

  it("--format json on a no-manifest project reports manifest_found: false, drift: []", () => {
    const r = runInProc(main, ["--project", tmp, "--format", "json"]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { manifest_found: boolean; drift: DriftEntry[] };
    expect(parsed.manifest_found).toBe(false);
    expect(parsed.drift).toEqual([]);
  });

  it("bad --format value is a usage error: exit 2, never 0", () => {
    const r = runInProc(main, ["--project", tmp, "--format", "bogus"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("--format must be");
  });

  it("unknown flag is a usage error: exit 2", () => {
    const r = runInProc(main, ["--nope"]);
    expect(r.status).toBe(2);
  });
});
