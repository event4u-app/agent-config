
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

// --- reap_tagged_orphans (marker-based, runs every deploy) ---------------

const TAG = "event4u/agent-config";

function tagged_md(p: string, name: string): void {
  write_file(p, `---\nname: ${name}\npackage: ${TAG}\n---\n\nbody\n`);
}

describe("reap_tagged_orphans", () => {
  it("test_reap_tagged_orphans_only", () => {
    const anchor = tp("anchor");
    // Tagged orphan (e.g. retired 2026-05-13 command-as-skill entry).
    tagged_md(path.join(anchor, "skills", "dto-creator", "SKILL.md"), "dto-creator");
    // Tagged file still shipped by the current bundle.
    tagged_md(path.join(anchor, "skills", "kept", "SKILL.md"), "kept");
    // User-authored skill: no package tag — must survive.
    mkdirp(path.join(anchor, "skills", "my-zed-skill"));
    write_file(
      path.join(anchor, "skills", "my-zed-skill", "SKILL.md"),
      "---\nname: my-zed-skill\n---\n\nmine\n",
    );
    // Untagged loose file — must survive.
    write_file(path.join(anchor, "skills", "notes.md"), "plain");

    const deleted = inv.reap_tagged_orphans(
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

  it("test_reap_tagged_orphans_is_idempotent", () => {
    // Second pass over an already-clean tree deletes nothing and raises
    // nothing — the always-run sweep must be safe to repeat every deploy.
    const anchor = tp("anchor");
    tagged_md(path.join(anchor, "skills", "kept", "SKILL.md"), "kept");
    const current = new Set(["skills/kept/SKILL.md"]);
    const first = inv.reap_tagged_orphans(anchor, ["skills"], current, TAG);
    const second = inv.reap_tagged_orphans(anchor, ["skills"], current, TAG);
    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(exists(path.join(anchor, "skills", "kept", "SKILL.md"))).toBe(true);
  });

  it("test_reap_tagged_orphans_ignores_missing_dest_and_other_tags", () => {
    const anchor = tp("anchor");
    tagged_md(path.join(anchor, "skills", "foreign", "SKILL.md"), "foreign");
    write_file(
      path.join(anchor, "skills", "foreign", "SKILL.md"),
      "---\nname: foreign\npackage: someone/else\n---\n\nbody\n",
    );
    const deleted = inv.reap_tagged_orphans(anchor, ["skills", "rules"], new Set(), TAG);
    expect(deleted).toEqual([]);
    expect(exists(path.join(anchor, "skills", "foreign", "SKILL.md"))).toBe(true);
  });
});

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

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
