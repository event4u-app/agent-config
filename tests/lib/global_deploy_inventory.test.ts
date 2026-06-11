/**
 * Tests for `src/scripts/_lib/global_deploy_inventory.ts` (stale reaping).
 *
 * 1:1 vitest port of `tests/test_global_deploy_inventory.py` (ADR-088 Phase 2 /
 * Wave 2a). The Python suite's final two tests
 * (`test_deploy_global_content_*`) exercise `install._deploy_global_content`,
 * which depends on `scripts/install.py` (NOT in this batch) and stays Python
 * until that module is ported — intentionally out of scope here.
 *
 * Two differential blocks compare the TS twin against the Python reference via
 * a `python3 -c` driver (pattern: tests/spikes/yaml_rt_py_driver.py):
 *   - `save_inventory` byte-identical JSON serialization.
 *   - `reap_stale` + `record_deploy` on a synthetic deploy tree.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import * as inv from "../../src/scripts/_lib/global_deploy_inventory.js";

let tmp_path: string;
const saved_env: Array<[string, string | undefined]> = [];

beforeEach(() => {
  tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), "gdi-"));
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

function tp(...parts: string[]): string {
  return path.join(tmp_path, ...parts);
}

function write_file(p: string, content: string): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf-8");
}

function mkdirp(p: string): void {
  fs.mkdirSync(p, { recursive: true });
}

function exists(p: string): boolean {
  return fs.existsSync(p);
}

function is_dir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// --- inventory_path / load / save ---------------------------------------

describe("inventory_path / load / save", () => {
  it("test_inventory_path_honors_env_override", () => {
    const override = tp("custom", "inv.json");
    const p = inv.inventory_path({ [inv.INVENTORY_ENV]: override });
    expect(p).toBe(override);
  });

  it("test_load_inventory_tolerates_missing_and_corrupt", () => {
    const missing = tp("nope.json");
    expect(inv.load_inventory(missing)).toEqual({
      schema_version: inv.SCHEMA_VERSION,
      tools: {},
    });
    const corrupt = tp("bad.json");
    write_file(corrupt, "{not json");
    expect((inv.load_inventory(corrupt) as { tools: unknown }).tools).toEqual({});
    const wrong_shape = tp("shape.json");
    write_file(wrong_shape, JSON.stringify({ tools: [1, 2] }));
    expect((inv.load_inventory(wrong_shape) as { tools: unknown }).tools).toEqual({});
  });

  it("test_save_then_load_roundtrip", () => {
    const target = tp("deployed-files.json");
    const data = {
      schema_version: 1,
      tools: { zedish: { anchor: "/tmp/a", files: ["skills/x/SKILL.md"] } },
    };
    inv.save_inventory(data, target);
    expect(inv.load_inventory(target)).toEqual(data);
  });
});

// --- expected_deploy_files ----------------------------------------------

describe("expected_deploy_files", () => {
  it("test_expected_deploy_files_walks_tree_and_resolves_symlinks", () => {
    const src = tp("src", "skills");
    mkdirp(path.join(src, "alpha"));
    write_file(path.join(src, "alpha", "SKILL.md"), "a");
    mkdirp(path.join(src, "beta"));
    write_file(path.join(src, "beta", "SKILL.md"), "b");
    const real = tp("real.md");
    write_file(real, "r");
    fs.symlinkSync(real, path.join(src, "alpha", "extra.md"));

    const files = inv.expected_deploy_files(src, "skills");
    expect(files).toEqual(
      new Set(["skills/alpha/SKILL.md", "skills/alpha/extra.md", "skills/beta/SKILL.md"]),
    );
  });

  it("test_expected_deploy_files_single_file_source", () => {
    const src = tp("rules.md");
    write_file(src, "x");
    expect(inv.expected_deploy_files(src, ".windsurfrules")).toEqual(new Set([".windsurfrules"]));
  });

  it("test_expected_deploy_files_missing_source_is_empty", () => {
    expect(inv.expected_deploy_files(tp("ghost"), "skills")).toEqual(new Set());
  });
});

// --- reap_stale ----------------------------------------------------------

function record(tool: string, anchor: string, files: string[]): inv.Inventory {
  const data: inv.Inventory = { schema_version: 1, tools: {} };
  inv.record_deploy(tool, anchor, new Set(files), data);
  return data;
}

describe("reap_stale", () => {
  it("test_reap_deletes_only_recorded_orphans", () => {
    const anchor = tp("anchor");
    mkdirp(path.join(anchor, "skills", "kept"));
    write_file(path.join(anchor, "skills", "kept", "SKILL.md"), "k");
    mkdirp(path.join(anchor, "skills", "agents-audit"));
    write_file(path.join(anchor, "skills", "agents-audit", "SKILL.md"), "stale colon-named entry");
    mkdirp(path.join(anchor, "skills", "my-own-zed-skill"));
    write_file(path.join(anchor, "skills", "my-own-zed-skill", "SKILL.md"), "mine");

    const data = record("zedish", anchor, [
      "skills/kept/SKILL.md",
      "skills/agents-audit/SKILL.md",
    ]);
    const deleted = inv.reap_stale("zedish", anchor, new Set(["skills/kept/SKILL.md"]), data);

    expect(deleted.map((p) => path.basename(p))).toEqual(["SKILL.md"]);
    expect(exists(path.join(anchor, "skills", "agents-audit"))).toBe(false);
    expect(exists(path.join(anchor, "skills", "kept", "SKILL.md"))).toBe(true);
    expect(exists(path.join(anchor, "skills", "my-own-zed-skill", "SKILL.md"))).toBe(true);
  });

  it("test_reap_skips_when_no_prior_record", () => {
    const anchor = tp("anchor");
    mkdirp(path.join(anchor, "skills"));
    write_file(path.join(anchor, "skills", "orphan.md"), "o");
    const data: inv.Inventory = { schema_version: 1, tools: {} };
    expect(inv.reap_stale("zedish", anchor, new Set(), data)).toEqual([]);
    expect(exists(path.join(anchor, "skills", "orphan.md"))).toBe(true);
  });

  it("test_reap_skips_when_anchor_moved", () => {
    const old_anchor = tp("old");
    const new_anchor = tp("new");
    mkdirp(path.join(old_anchor, "skills"));
    write_file(path.join(old_anchor, "skills", "gone.md"), "g");
    const data = record("zedish", old_anchor, ["skills/gone.md"]);
    const deleted = inv.reap_stale("zedish", new_anchor, new Set(), data);
    expect(deleted).toEqual([]);
    expect(exists(path.join(old_anchor, "skills", "gone.md"))).toBe(true);
  });

  it("test_reap_refuses_traversal_and_absolute_entries", () => {
    const anchor = tp("anchor");
    mkdirp(anchor);
    const outside = tp("outside.md");
    write_file(outside, "precious");
    const data: inv.Inventory = {
      schema_version: 1,
      tools: { zedish: { anchor, files: ["../outside.md", "/etc/hosts", ""] } },
    };
    expect(inv.reap_stale("zedish", anchor, new Set(), data)).toEqual([]);
    expect(exists(outside)).toBe(true);
  });

  it("test_reap_never_deletes_directories", () => {
    const anchor = tp("anchor");
    mkdirp(path.join(anchor, "skills", "weird"));
    const data: inv.Inventory = {
      schema_version: 1,
      tools: { zedish: { anchor, files: ["skills/weird"] } },
    };
    expect(inv.reap_stale("zedish", anchor, new Set(), data)).toEqual([]);
    expect(is_dir(path.join(anchor, "skills", "weird"))).toBe(true);
  });

  it("test_record_deploy_upserts_sorted_relative_paths", () => {
    const anchor = tp("anchor");
    mkdirp(anchor);
    const data: inv.Inventory = { schema_version: 1, tools: {} };
    inv.record_deploy("zedish", anchor, new Set(["b.md", "a.md"]), data);
    const entry = (data["tools"] as Record<string, { files: string[]; anchor: string }>)["zedish"]!;
    expect(entry.files).toEqual(["a.md", "b.md"]);
    expect(fs.realpathSync(entry.anchor)).toBe(fs.realpathSync(anchor));
  });

  it("test_record_deploy_keeps_anchor_unexpanded", () => {
    const data: inv.Inventory = { schema_version: 1, tools: {} };
    inv.record_deploy("zedish", "~/.agents/", new Set(["skills/a.md"]), data);
    expect((data["tools"] as Record<string, { anchor: string }>)["zedish"]!.anchor).toBe(
      "~/.agents/",
    );
  });
});

// --- end-to-end: two deploys, second reaps the renamed entry -------------

describe("two-deploy cycle", () => {
  it("test_two_deploy_cycle_reaps_renamed_skill", () => {
    const src = tp("pkg", "skills");
    mkdirp(path.join(src, "agents-audit"));
    write_file(path.join(src, "agents-audit", "SKILL.md"), "v1");
    const anchor = tp("anchor");
    const inv_path = tp("deployed-files.json");

    // Deploy 1: copy + record.
    const current1 = inv.expected_deploy_files(src, "skills");
    for (const rel of current1) {
      const target = path.join(anchor, rel);
      mkdirp(path.dirname(target));
      fs.writeFileSync(target, "v1", "utf-8");
    }
    let data = inv.load_inventory(inv_path);
    inv.reap_stale("zedish", anchor, current1, data);
    inv.record_deploy("zedish", anchor, current1, data);
    inv.save_inventory(data, inv_path);

    // Package renames the skill.
    fs.unlinkSync(path.join(src, "agents-audit", "SKILL.md"));
    fs.rmdirSync(path.join(src, "agents-audit"));
    mkdirp(path.join(src, "agents-review"));
    write_file(path.join(src, "agents-review", "SKILL.md"), "v2");

    // Deploy 2: copy + reap + record.
    const current2 = inv.expected_deploy_files(src, "skills");
    for (const rel of current2) {
      const target = path.join(anchor, rel);
      mkdirp(path.dirname(target));
      fs.writeFileSync(target, "v2", "utf-8");
    }
    data = inv.load_inventory(inv_path);
    const deleted = inv.reap_stale("zedish", anchor, current2, data);
    inv.record_deploy("zedish", anchor, current2, data);
    inv.save_inventory(data, inv_path);

    expect(deleted.length).toBe(1);
    expect(exists(path.join(anchor, "skills", "agents-audit"))).toBe(false);
    expect(exists(path.join(anchor, "skills", "agents-review", "SKILL.md"))).toBe(true);
  });
});

// --- bootstrap_reap_tagged (pre-inventory installs) ----------------------

const TAG = "event4u/agent-config";

function tagged_md(p: string, name: string): void {
  write_file(p, `---\nname: ${name}\npackage: ${TAG}\n---\n\nbody\n`);
}

describe("bootstrap_reap_tagged", () => {
  it("test_bootstrap_reaps_tagged_orphans_only", () => {
    const anchor = tp("anchor");
    tagged_md(path.join(anchor, "skills", "dto-creator", "SKILL.md"), "dto-creator");
    tagged_md(path.join(anchor, "skills", "kept", "SKILL.md"), "kept");
    mkdirp(path.join(anchor, "skills", "my-zed-skill"));
    write_file(
      path.join(anchor, "skills", "my-zed-skill", "SKILL.md"),
      "---\nname: my-zed-skill\n---\n\nmine\n",
    );
    write_file(path.join(anchor, "skills", "notes.md"), "plain");

    const deleted = inv.bootstrap_reap_tagged(
      anchor,
      ["skills"],
      new Set(["skills/kept/SKILL.md"]),
      TAG,
    );

    expect(deleted.map((p) => path.basename(path.dirname(p)))).toEqual(["dto-creator"]);
    expect(exists(path.join(anchor, "skills", "dto-creator"))).toBe(false);
    expect(exists(path.join(anchor, "skills", "kept", "SKILL.md"))).toBe(true);
    expect(exists(path.join(anchor, "skills", "my-zed-skill", "SKILL.md"))).toBe(true);
    expect(exists(path.join(anchor, "skills", "notes.md"))).toBe(true);
  });

  it("test_bootstrap_ignores_missing_dest_and_other_tags", () => {
    const anchor = tp("anchor");
    tagged_md(path.join(anchor, "skills", "foreign", "SKILL.md"), "foreign");
    write_file(
      path.join(anchor, "skills", "foreign", "SKILL.md"),
      "---\nname: foreign\npackage: someone/else\n---\n\nbody\n",
    );
    const deleted = inv.bootstrap_reap_tagged(anchor, ["skills", "rules"], new Set(), TAG);
    expect(deleted).toEqual([]);
    expect(exists(path.join(anchor, "skills", "foreign", "SKILL.md"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Differential blocks — Python module is the reference implementation.
// Pattern per tests/spikes/yaml_rt_py_driver.py.
// ---------------------------------------------------------------------------

function python3_available(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

const PY_SAVE_DRIVER = `
import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), "src", "scripts"))
from _lib import global_deploy_inventory as inv

data = json.load(sys.stdin)
target = os.path.join(os.environ["GDI_DIFF_DIR"], "py.json")
inv.save_inventory(data, __import__("pathlib").Path(target))
with open(target, "r", encoding="utf-8") as fh:
    sys.stdout.write(fh.read())
`;

describe.runIf(python3_available())("differential: save_inventory JSON", () => {
  it("byte-identical JSON across representative inventories", () => {
    const cases: inv.Inventory[] = [
      { schema_version: 1, tools: {} },
      {
        schema_version: 1,
        tools: {
          zedish: { anchor: "~/.agents/", files: ["skills/b/SKILL.md", "skills/a/SKILL.md"] },
          claude: { anchor: "/abs/anchor", files: [] },
        },
      },
      {
        schema_version: 1,
        tools: {
          // Unicode + special chars exercise JSON escaping parity.
          "tool-ü": { anchor: "/a", files: ["skills/Grüße/SKILL.md", 'q"x'] },
        },
      },
    ];
    for (const data of cases) {
      const diff_dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdi-diff-"));
      try {
        const py = execFileSync("python3", ["-c", PY_SAVE_DRIVER], {
          input: JSON.stringify(data),
          encoding: "utf-8",
          cwd: REPO_ROOT,
          env: { ...process.env, GDI_DIFF_DIR: diff_dir },
        });
        const ts_target = path.join(diff_dir, "ts.json");
        inv.save_inventory(JSON.parse(JSON.stringify(data)), ts_target);
        const ts = fs.readFileSync(ts_target, "utf-8");
        expect(ts).toBe(py);
      } finally {
        fs.rmSync(diff_dir, { recursive: true, force: true });
      }
    }
  });
});

const PY_REAP_DRIVER = `
import json, os, sys
from pathlib import Path
sys.path.insert(0, os.path.join(os.getcwd(), "src", "scripts"))
from _lib import global_deploy_inventory as inv

payload = json.load(sys.stdin)
anchor = Path(payload["anchor"])
inventory = payload["inventory"]
current = set(payload["current"])
deleted = inv.reap_stale(payload["tool_id"], anchor, current, inventory)
# Report deleted (anchor-relative, posix) + surviving tree for comparison.
rel_deleted = sorted(str(Path(p).relative_to(anchor.resolve())) for p in deleted)
survivors = sorted(
    str(p.relative_to(anchor)) for p in anchor.rglob("*") if p.is_file()
)
sys.stdout.write(json.dumps({"deleted": rel_deleted, "survivors": survivors}))
`;

describe.runIf(python3_available())("differential: reap_stale on synthetic tree", () => {
  it("TS reap matches Python reap (deleted set + survivors)", () => {
    // Build identical synthetic deploy trees for Python and TS, run each
    // reap on its own copy, and compare the resulting (deleted, survivors).
    const build_tree = (root: string): void => {
      write_file(path.join(root, "skills", "kept", "SKILL.md"), "k");
      write_file(path.join(root, "skills", "stale-a", "SKILL.md"), "s");
      write_file(path.join(root, "skills", "stale-b", "nested", "doc.md"), "n");
      write_file(path.join(root, "skills", "user-own", "SKILL.md"), "mine");
    };
    const recorded_files = [
      "skills/kept/SKILL.md",
      "skills/stale-a/SKILL.md",
      "skills/stale-b/nested/doc.md",
    ];
    const current = ["skills/kept/SKILL.md"];

    // Python side.
    const py_anchor = tp("py-anchor");
    build_tree(py_anchor);
    const py_inventory: inv.Inventory = {
      schema_version: 1,
      tools: { zedish: { anchor: py_anchor, files: recorded_files } },
    };
    const py_out = JSON.parse(
      execFileSync("python3", ["-c", PY_REAP_DRIVER], {
        input: JSON.stringify({
          tool_id: "zedish",
          anchor: py_anchor,
          inventory: py_inventory,
          current,
        }),
        encoding: "utf-8",
        cwd: REPO_ROOT,
      }),
    ) as { deleted: string[]; survivors: string[] };

    // TS side — fresh identical tree.
    const ts_anchor = tp("ts-anchor");
    build_tree(ts_anchor);
    const ts_inventory: inv.Inventory = {
      schema_version: 1,
      tools: { zedish: { anchor: ts_anchor, files: recorded_files } },
    };
    const ts_deleted = inv.reap_stale("zedish", ts_anchor, new Set(current), ts_inventory);
    const ts_anchor_real = fs.realpathSync(ts_anchor);
    const ts_rel_deleted = ts_deleted
      .map((p) => path.relative(ts_anchor_real, p).split(path.sep).join("/"))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const ts_survivors = list_files_rel(ts_anchor).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    expect(ts_rel_deleted).toEqual(py_out.deleted);
    expect(ts_survivors).toEqual(py_out.survivors);
  });
});

/** Anchor-relative POSIX paths of every regular file under `root`. */
function list_files_rel(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const lst = fs.lstatSync(full);
      if (lst.isDirectory()) {
        walk(full);
      } else if (lst.isFile()) {
        out.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  };
  walk(root);
  return out;
}
