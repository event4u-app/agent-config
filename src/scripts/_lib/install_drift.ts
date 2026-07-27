/**
 * Installer drift report (measurement only, never a gate).
 *
 * Compares the sha256 hashes recorded in a project's
 * `agents/installed-tools.lock` manifest (`kind: 'deployed'` file entries —
 * written by the installer at deploy time, see `install.ts`'s `_file_entry`)
 * against the current on-disk content of those same files. A mismatch means
 * a framework-authoritative file was locally modified since the last
 * install/upgrade; a missing file means it was deleted. This measures the
 * "consumers edit framework-authoritative files" premise — it never repairs,
 * never blocks, and has no opinion on whether drift is good or bad. See
 * `report_install_drift.ts` (the standalone CLI, always exits 0) and
 * `install.ts`'s global-install upgrade path (prints the report and
 * proceeds with the redeploy regardless of what it finds).
 *
 * Deliberately does NOT reuse `installed_tools.read_manifest()`: that
 * module's manual v1/v2 parser silently drops nested `tools[].files[]`
 * entries on read (documented divergence in that module's header) — exactly
 * the data this report needs. This module parses the manifest YAML directly
 * with the `yaml` package (a real dependency of this package, already used
 * by dozens of sibling scripts) so `sha256` values are read faithfully. It
 * still reuses `installed_tools.manifest_path()` for path resolution + the
 * `AGENT_CONFIG_INSTALLED_TOOLS` env override, so there is exactly one place
 * that decides "where is the manifest".
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

import { manifest_path, type EnvMap } from "./installed_tools.js";

export type DriftStatus = "modified" | "missing";

export interface DriftEntry {
  /** Tool id the entry is recorded under (`tools[].name` in the manifest). */
  tool_id: string;
  /** Resolved on-disk path (absolute when the recorded path was absolute). */
  path: string;
  status: DriftStatus;
  recorded_sha256: string;
  /** `null` when the file is missing entirely (status === 'missing'). */
  current_sha256: string | null;
}

/** Expand a leading `~`, mirroring the sibling helper in `installed_tools.ts`. */
function expanduser(p: string): string {
  if (p === "~") {
    return os.homedir();
  }
  if (p.startsWith("~/") || (process.platform === "win32" && p.startsWith("~\\"))) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/** Resolve a manifest-recorded path against the project root (mirrors `cmd_doctor.ts`'s `_resolve_path`). */
function resolve_entry_path(project_root: string, raw: string): string {
  const p = expanduser(raw);
  return path.isAbsolute(p) ? p : path.join(project_root, p);
}

function sha256_of_file(p: string): string | null {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
  } catch {
    return null;
  }
}

/**
 * Read the project manifest and return one entry per `kind: 'deployed'` file
 * whose current on-disk sha256 differs from the recorded value, or which no
 * longer exists.
 *
 * Returns `null` when there is no manifest at all (or it fails to parse) —
 * distinct from `[]`, which means the manifest was read fine and nothing has
 * drifted. Never throws.
 */
export function collect_drift(project_root: string, env?: EnvMap | null): DriftEntry[] | null {
  const target = manifest_path(project_root, env);

  let text: string;
  try {
    text = fs.readFileSync(target, "utf-8");
  } catch {
    return null;
  }

  let data: unknown;
  try {
    data = parseYaml(text, { version: "1.1" });
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) {
    return null;
  }
  const tools = (data as Record<string, unknown>)["tools"];
  if (!Array.isArray(tools)) {
    // Manifest parsed fine, just carries no tools — that is "clean", not
    // "no manifest".
    return [];
  }

  const out: DriftEntry[] = [];
  for (const tool of tools) {
    if (typeof tool !== "object" || tool === null) {
      continue;
    }
    const t = tool as Record<string, unknown>;
    const tool_id = t["name"] === undefined ? "" : String(t["name"]);
    const files = t["files"];
    if (!Array.isArray(files)) {
      continue;
    }
    for (const entry of files) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const e = entry as Record<string, unknown>;
      if (e["kind"] !== "deployed") {
        continue;
      }
      const recorded_sha256 = e["sha256"];
      if (typeof recorded_sha256 !== "string" || recorded_sha256 === "") {
        continue;
      }
      const raw_path = e["path"];
      if (typeof raw_path !== "string" || raw_path === "") {
        continue;
      }

      const resolved = resolve_entry_path(project_root, raw_path);
      if (!fs.existsSync(resolved)) {
        out.push({
          tool_id,
          path: resolved,
          status: "missing",
          recorded_sha256,
          current_sha256: null,
        });
        continue;
      }
      const current = sha256_of_file(resolved);
      if (current === recorded_sha256) {
        continue;
      }
      out.push({
        tool_id,
        path: resolved,
        status: "modified",
        recorded_sha256,
        current_sha256: current,
      });
    }
  }

  out.sort((a, b) => {
    if (a.tool_id !== b.tool_id) {
      return a.tool_id < b.tool_id ? -1 : 1;
    }
    return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
  });
  return out;
}

/**
 * Human-readable report body — one line per drifted file plus a summary
 * line, or an explicit "clean"/"no manifest" line. Never throws.
 */
export function format_drift_report(entries: DriftEntry[] | null): string {
  if (entries === null) {
    return "Installer drift: no installed-tools manifest found — nothing to report.\n";
  }
  if (entries.length === 0) {
    return "Installer drift: no local modifications detected in framework-authoritative files.\n";
  }

  const lines: string[] = [];
  for (const e of entries) {
    const label = e.status === "missing" ? "missing " : "modified";
    lines.push(`  ${label}  [${e.tool_id}]  ${e.path}`);
  }
  const modified = entries.filter((e) => e.status === "modified").length;
  const missing = entries.filter((e) => e.status === "missing").length;
  lines.push("");
  lines.push(
    `Installer drift: ${entries.length} framework-authoritative file(s) locally modified ` +
      `since the last install (${modified} modified, ${missing} missing).`,
  );
  return lines.join("\n") + "\n";
}
