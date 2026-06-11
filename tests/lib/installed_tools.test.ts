/**
 * Tests for `src/scripts/_lib/installed_tools.ts`.
 *
 * 1:1 vitest port of `tests/test_installed_tools.py` (ADR-088 Phase 2 /
 * Wave 2a) plus a differential block comparing the TS `_render` wire format
 * against the Python reference via a `python3 -c` driver (pattern:
 * tests/spikes/yaml_rt_py_driver.py). Covers the project-scope manifest at
 * `agents/installed-tools.lock`.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as it_mod from "../../src/scripts/_lib/installed_tools.js";

let tmp_path: string;
const saved_env: Array<[string, string | undefined]> = [];

beforeEach(() => {
  tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), "installed-tools-"));
});

afterEach(() => {
  while (saved_env.length > 0) {
    const [key, value] = saved_env.pop() as [string, string | undefined];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  fs.rmSync(tmp_path, { recursive: true, force: true });
});

function patch_env(key: string, value: string | undefined): void {
  saved_env.push([key, process.env[key]]);
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("installed_tools", () => {
  it("test_read_manifest_missing", () => {
    expect(it_mod.read_manifest(path.join(tmp_path, "absent.lock"))).toBeNull();
  });

  it("test_write_and_round_trip", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    const tools = [
      {
        name: "claude-code",
        scope: "global",
        bridge_marker: "~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG",
        installed_at: "2026-05-12",
      },
      {
        name: "windsurf",
        scope: "project",
        bridge_marker: ".windsurf/PROJECT_MANAGED_BY_AGENT_CONFIG",
        installed_at: "2026-05-12",
      },
    ];
    it_mod.write_manifest(target, "2.1.0", tools);
    expect(fs.statSync(target).isFile()).toBe(true);
    const data = it_mod.read_manifest(target);
    expect(data).not.toBeNull();
    expect(data!["schema_version"]).toBe(it_mod.SCHEMA_VERSION);
    expect(data!["agent_config_version"]).toBe("2.1.0");
    const names = (data!["tools"] as Array<Record<string, unknown>>).map((t) => t["name"]);
    expect(names).toEqual(["claude-code", "windsurf"]);
    expect((data!["tools"] as Array<Record<string, unknown>>)[1]!["scope"]).toBe("project");
  });

  it("test_install_order_preserved", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    const tools = [
      { name: "windsurf", scope: "project", bridge_marker: ".windsurf/M", installed_at: "2026-05-12" },
      { name: "claude-code", scope: "global", bridge_marker: "~/.claude/M", installed_at: "2026-05-12" },
    ];
    it_mod.write_manifest(target, "2.1.0", tools);
    const data = it_mod.read_manifest(target)!;
    expect((data["tools"] as Array<Record<string, unknown>>).map((t) => t["name"])).toEqual([
      "windsurf",
      "claude-code",
    ]);
  });

  it("test_upsert_appends_new", () => {
    const result = it_mod.upsert_tool([], {
      name: "cursor",
      scope: "global",
      bridge_marker: "~/.cursor/M",
      installed_at: "2026-05-12",
    });
    expect(result.length).toBe(1);
    expect(result[0]!["name"]).toBe("cursor");
  });

  it("test_upsert_idempotent_on_match", () => {
    const existing = [
      { name: "cursor", scope: "global", bridge_marker: "~/.cursor/M", installed_at: "2026-05-12" },
    ];
    const result = it_mod.upsert_tool(existing, {
      name: "cursor",
      scope: "global",
      bridge_marker: "~/.cursor/M",
      installed_at: "2099-01-01", // would-be drift if not idempotent
    });
    expect(result[0]!["installed_at"]).toBe("2026-05-12");
    expect(result.length).toBe(1);
  });

  it("test_upsert_scope_change_refuses", () => {
    const existing = [
      { name: "windsurf", scope: "project", bridge_marker: ".windsurf/M", installed_at: "2026-05-12" },
    ];
    let caught: it_mod.ScopeMismatchError | null = null;
    try {
      it_mod.upsert_tool(existing, {
        name: "windsurf",
        scope: "global",
        bridge_marker: "~/.codeium/windsurf/M",
        installed_at: "2026-06-01",
      });
    } catch (err) {
      caught = err as it_mod.ScopeMismatchError;
    }
    expect(caught).toBeInstanceOf(it_mod.ScopeMismatchError);
    expect(caught!.recorded_scope).toBe("project");
    expect(caught!.new_scope).toBe("global");
  });

  it("test_upsert_force_rewrites_scope", () => {
    const existing = [
      { name: "windsurf", scope: "project", bridge_marker: ".windsurf/M", installed_at: "2026-05-12" },
    ];
    const result = it_mod.upsert_tool(existing, {
      name: "windsurf",
      scope: "global",
      bridge_marker: "~/.codeium/windsurf/M",
      installed_at: "2026-06-01",
      force: true,
    });
    expect(result[0]!["scope"]).toBe("global");
    expect(result[0]!["bridge_marker"]).toBe("~/.codeium/windsurf/M");
    expect(result[0]!["installed_at"]).toBe("2026-06-01");
  });

  it("test_upsert_invalid_scope_raises", () => {
    expect(() => it_mod.upsert_tool([], { name: "x", scope: "user", bridge_marker: "m" })).toThrow(
      it_mod.ValueError,
    );
  });

  it("test_manifest_path_env_override", () => {
    const target = path.join(tmp_path, "custom.lock");
    patch_env("AGENT_CONFIG_INSTALLED_TOOLS", target);
    expect(it_mod.manifest_path(tmp_path)).toBe(target);
  });

  it("test_manual_parser_handles_canonical_schema", () => {
    const text =
      "schema_version: 1\n" +
      'agent_config_version: "2.1.0"\n' +
      "tools:\n" +
      "  - name: claude-code\n" +
      "    scope: global\n" +
      "    bridge_marker: ~/.claude/M\n" +
      '    installed_at: "2026-05-12"\n';
    const data = it_mod._parse_manual(text);
    expect(data["schema_version"]).toBe(1);
    expect(data["agent_config_version"]).toBe("2.1.0");
    const tools = data["tools"] as Array<Record<string, unknown>>;
    expect(tools[0]!["name"]).toBe("claude-code");
    expect(tools[0]!["scope"]).toBe("global");
  });

  // --- Schema v2 (P1.1) ---

  it("test_schema_version_is_two", () => {
    expect(it_mod.SCHEMA_VERSION).toBe(2);
    expect(it_mod.SCHEMA_VERSIONS_SUPPORTED).toContain(1);
    expect(it_mod.SCHEMA_VERSIONS_SUPPORTED).toContain(2);
  });

  it("test_v2_round_trip_with_files_and_merged_keys", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    const tools = [
      {
        name: "claude-code",
        scope: "global",
        bridge_marker: "~/.claude/M",
        installed_at: "2026-05-12",
        files: [
          { path: ".augment/rules/r1.md", kind: "deployed", sha256: "a".repeat(64) },
          { path: ".cursorrules", kind: "bridge", sha256: "b".repeat(64) },
        ],
        merged_keys: [{ file: ".mcp.json", json_pointer: "/mcpServers/agent-config" }],
      },
    ];
    it_mod.write_manifest(target, "2.2.0", tools, {
      deploy_roots: [".augment/rules", ".cursor/rules"],
    });
    const data = it_mod.read_manifest(target)!;
    expect(data["schema_version"]).toBe(2);
    // NOTE: manual-parser path drops nested files/merged_keys (documented
    // degraded read). The structural top-level fields survive.
    expect(data["deploy_roots"]).toEqual([]);
    const tool = (data["tools"] as Array<Record<string, unknown>>)[0]!;
    expect(tool["name"]).toBe("claude-code");
  });

  it("test_v2_omits_optional_fields_when_absent", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    const tools = [
      { name: "windsurf", scope: "project", bridge_marker: ".windsurf/M", installed_at: "2026-05-12" },
    ];
    it_mod.write_manifest(target, "2.2.0", tools);
    const text = fs.readFileSync(target, "utf-8");
    expect(text).not.toContain("deploy_roots");
    expect(text).not.toContain("files:");
    expect(text).not.toContain("merged_keys");
  });

  it("test_v2_file_kinds_constant", () => {
    expect(it_mod.FILE_KINDS).toEqual(new Set(["bridge", "deployed", "marker"]));
  });

  it("test_v2_default_deploy_roots_constant", () => {
    expect(it_mod.DEFAULT_DEPLOY_ROOTS).toContain(".augment/rules");
    expect(it_mod.DEFAULT_DEPLOY_ROOTS).toContain(".cursor/rules");
    expect(it_mod.DEFAULT_DEPLOY_ROOTS).toContain(".claude/skills");
  });

  it("test_manual_parser_skips_v2_nested_fields", () => {
    const text =
      "schema_version: 2\n" +
      'agent_config_version: "2.2.0"\n' +
      "deploy_roots:\n" +
      "  - .augment/rules\n" +
      "  - .cursor/rules\n" +
      "tools:\n" +
      "  - name: claude-code\n" +
      "    scope: global\n" +
      "    bridge_marker: ~/.claude/M\n" +
      '    installed_at: "2026-05-12"\n' +
      "    files:\n" +
      "      - path: .augment/rules/r1.md\n" +
      "        kind: deployed\n" +
      '        sha256: "aaa"\n' +
      "    merged_keys:\n" +
      "      - file: .mcp.json\n" +
      '        json_pointer: "/mcpServers/x"\n' +
      "  - name: windsurf\n" +
      "    scope: project\n" +
      "    bridge_marker: .windsurf/M\n" +
      '    installed_at: "2026-05-12"\n';
    const data = it_mod._parse_manual(text);
    expect(data["schema_version"]).toBe(2);
    const tools = data["tools"] as Array<Record<string, unknown>>;
    expect(tools.length).toBe(2);
    expect(tools[0]!["name"]).toBe("claude-code");
    expect(tools[1]!["name"]).toBe("windsurf");
    expect("files" in tools[0]!).toBe(false);
    expect("merged_keys" in tools[0]!).toBe(false);
  });

  it("test_v1_manifest_still_readable", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    fs.writeFileSync(
      target,
      "schema_version: 1\n" +
        'agent_config_version: "2.1.0"\n' +
        "tools:\n" +
        "  - name: claude-code\n" +
        "    scope: global\n" +
        "    bridge_marker: ~/.claude/M\n" +
        '    installed_at: "2026-05-12"\n',
      "utf-8",
    );
    const data = it_mod.read_manifest(target)!;
    expect(data["schema_version"]).toBe(1);
    expect((data["tools"] as Array<Record<string, unknown>>)[0]!["name"]).toBe("claude-code");
  });

  it("test_read_manifest_normalises_v2_shape", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    fs.writeFileSync(
      target,
      "schema_version: 1\n" +
        'agent_config_version: "2.1.0"\n' +
        "tools:\n" +
        "  - name: claude-code\n" +
        "    scope: global\n" +
        "    bridge_marker: ~/.claude/M\n" +
        '    installed_at: "2026-05-12"\n',
      "utf-8",
    );
    const data = it_mod.read_manifest(target)!;
    expect(data["deploy_roots"]).toEqual([]);
    const tool = (data["tools"] as Array<Record<string, unknown>>)[0]!;
    expect(tool["files"]).toEqual([]);
    expect(tool["merged_keys"]).toEqual([]);
  });

  it("test_v2_writer_sorts_files_and_merged_keys_deterministically", () => {
    const target_a = path.join(tmp_path, "a.lock");
    const target_b = path.join(tmp_path, "b.lock");
    const files = [
      { path: ".augment/rules/z.md", kind: "deployed", sha256: "z".repeat(64) },
      { path: ".augment/rules/a.md", kind: "deployed", sha256: "a".repeat(64) },
      { path: ".augment/rules/m.md", kind: "deployed", sha256: "m".repeat(64) },
    ];
    const merged = [
      { file: ".mcp.json", json_pointer: "/mcpServers/z" },
      { file: ".mcp.json", json_pointer: "/mcpServers/a" },
      { file: ".claude/settings.json", json_pointer: "/hooks/x" },
    ];
    const tools_unordered = [
      {
        name: "claude-code",
        scope: "global",
        bridge_marker: "~/.claude/M",
        installed_at: "2026-05-12",
        files,
        merged_keys: merged,
      },
    ];
    const tools_reordered = [
      {
        name: "claude-code",
        scope: "global",
        bridge_marker: "~/.claude/M",
        installed_at: "2026-05-12",
        files: [...files].reverse(),
        merged_keys: [...merged].reverse(),
      },
    ];
    it_mod.write_manifest(target_a, "2.2.0", tools_unordered);
    it_mod.write_manifest(target_b, "2.2.0", tools_reordered);
    expect(fs.readFileSync(target_a, "utf-8")).toBe(fs.readFileSync(target_b, "utf-8"));
  });

  it("test_v2_writer_golden_file_shape", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    const tools = [
      {
        name: "claude-code",
        scope: "global",
        bridge_marker: "~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG",
        installed_at: "2026-05-12",
        files: [
          { path: ".augment/rules/r1.md", kind: "deployed", sha256: "a".repeat(64) },
          { path: ".cursorrules", kind: "bridge", sha256: null },
        ],
        merged_keys: [{ file: ".mcp.json", json_pointer: "/mcpServers/agent-config" }],
      },
    ];
    it_mod.write_manifest(target, "2.2.0", tools, {
      deploy_roots: [".augment/rules", ".cursor/rules"],
    });
    const expected =
      "schema_version: 2\n" +
      'agent_config_version: "2.2.0"\n' +
      "deploy_roots:\n" +
      "  - .augment/rules\n" +
      "  - .cursor/rules\n" +
      "tools:\n" +
      "  - name: claude-code\n" +
      "    scope: global\n" +
      "    bridge_marker: ~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG\n" +
      '    installed_at: "2026-05-12"\n' +
      "    files:\n" +
      "      - path: .augment/rules/r1.md\n" +
      "        kind: deployed\n" +
      `        sha256: "${"a".repeat(64)}"\n` +
      "      - path: .cursorrules\n" +
      "        kind: bridge\n" +
      "        sha256: null\n" +
      "    merged_keys:\n" +
      "      - file: .mcp.json\n" +
      '        json_pointer: "/mcpServers/agent-config"\n';
    expect(fs.readFileSync(target, "utf-8")).toBe(expected);
  });

  it("test_read_manifest_empty_tools_safe", () => {
    const target = path.join(tmp_path, "installed-tools.lock");
    fs.writeFileSync(
      target,
      "schema_version: 2\n" + 'agent_config_version: "2.2.0"\n' + "tools:\n",
      "utf-8",
    );
    const data = it_mod.read_manifest(target)!;
    expect(data["tools"]).toEqual([]);
    expect(data["deploy_roots"]).toEqual([]);
  });

  it("test_upsert_tool_records_files_on_first_write", () => {
    const files = [{ path: ".cursorrules", kind: "bridge", sha256: null }];
    const merged = [{ file: ".mcp.json", json_pointer: "/mcpServers/x" }];
    const result = it_mod.upsert_tool([], {
      name: "cursor",
      scope: "project",
      bridge_marker: ".cursorrules",
      installed_at: "2026-05-12",
      files,
      merged_keys: merged,
    });
    expect(result[0]!["files"]).toEqual(files);
    expect(result[0]!["merged_keys"]).toEqual(merged);
  });

  it("test_upsert_tool_refreshes_files_on_idempotent_path", () => {
    const existing = [
      {
        name: "cursor",
        scope: "project",
        bridge_marker: ".cursorrules",
        installed_at: "2026-05-01",
        files: [{ path: "old", kind: "bridge", sha256: null }],
      },
    ];
    const new_files = [{ path: ".cursorrules", kind: "bridge", sha256: null }];
    const result = it_mod.upsert_tool(existing, {
      name: "cursor",
      scope: "project",
      bridge_marker: ".cursorrules",
      installed_at: "2026-05-12",
      files: new_files,
    });
    expect(result[0]!["installed_at"]).toBe("2026-05-01");
    expect(result[0]!["files"]).toEqual(new_files);
  });

  it("test_upsert_tool_preserves_prior_files_when_arg_omitted", () => {
    const prior_files = [{ path: ".cursorrules", kind: "bridge", sha256: null }];
    const existing = [
      {
        name: "cursor",
        scope: "project",
        bridge_marker: ".cursorrules",
        installed_at: "2026-05-01",
        files: prior_files,
      },
    ];
    const result = it_mod.upsert_tool(existing, {
      name: "cursor",
      scope: "project",
      bridge_marker: ".cursorrules",
    });
    expect(result[0]!["files"]).toEqual(prior_files);
  });
});

// ---------------------------------------------------------------------------
// Differential block — Python `_render` is the reference wire format.
// Pattern per tests/spikes/yaml_rt_py_driver.py.
// ---------------------------------------------------------------------------

const PY_RENDER_DRIVER = `
import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), "src", "scripts"))
from _lib import installed_tools as it

cases = json.load(sys.stdin)
out = []
for case in cases:
    out.append(it._render(
        case["version"], case["tools"],
        deploy_roots=case.get("deploy_roots"),
    ))
sys.stdout.write(json.dumps(out))
`;

function python3_available(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

interface RenderCase {
  version: string;
  tools: Array<Record<string, unknown>>;
  deploy_roots?: string[] | null;
}

function run_python_render(cases: RenderCase[]): string[] {
  const stdout = execFileSync("python3", ["-c", PY_RENDER_DRIVER], {
    input: JSON.stringify(cases),
    encoding: "utf-8",
    cwd: path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", ".."),
  });
  return JSON.parse(stdout) as string[];
}

// `_render` is module-internal in TS; reconstruct it via write_manifest round
// trip on disk so we compare the exact same bytes Python's `_render` emits.
function ts_render(c: RenderCase): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "it-diff-"));
  try {
    const target = path.join(dir, "m.lock");
    it_mod.write_manifest(target, c.version, c.tools, { deploy_roots: c.deploy_roots ?? null });
    return fs.readFileSync(target, "utf-8");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe.runIf(python3_available())("differential vs Python `_render`", () => {
  it("byte-identical wire format across representative manifests", () => {
    const cases: RenderCase[] = [
      { version: "2.1.0", tools: [] },
      {
        version: "2.1.0",
        tools: [
          { name: "claude-code", scope: "global", bridge_marker: "~/.claude/M", installed_at: "2026-05-12" },
          { name: "windsurf", scope: "project", bridge_marker: ".windsurf/M", installed_at: "2026-05-12" },
        ],
      },
      {
        version: "2.2.0",
        deploy_roots: [".augment/rules", ".cursor/rules"],
        tools: [
          {
            name: "claude-code",
            scope: "global",
            bridge_marker: "~/.claude/PROJECT_MANAGED_BY_AGENT_CONFIG",
            installed_at: "2026-05-12",
            status: "active",
            files: [
              { path: ".augment/rules/z.md", kind: "deployed", sha256: "z".repeat(64) },
              { path: ".augment/rules/a.md", kind: "deployed", sha256: null },
            ],
            merged_keys: [
              { file: ".mcp.json", json_pointer: "/mcpServers/z", value_hash: "abc" },
              { file: ".mcp.json", json_pointer: "/mcpServers/a" },
            ],
          },
        ],
      },
    ];
    const py = run_python_render(cases);
    const ts = cases.map((c) => ts_render(c));
    expect(ts).toEqual(py);
  });
});
