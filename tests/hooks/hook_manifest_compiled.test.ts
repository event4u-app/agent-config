/**
 * The precompiled hook manifest (`src/scripts/hook_manifest.json`) and the
 * fast path in `_load_yaml` that reads it.
 *
 * WHY it exists, measured 2026-08-19: the ~61 kB YAML manifest is parsed on
 * EVERY hook dispatch. Loading the `yaml` module costs 8 ms and parsing the
 * manifest another 12 ms, against a ~103 ms dispatch — so a fifth of every
 * dispatch was re-deriving a table that never changes between runs. The
 * compiled sibling is the same data with comments stripped (14.7 kB) and
 * parses in under a millisecond. Measured effect on `pre_tool_use` p50, one
 * machine, n=50: 103 ms → 81 ms.
 *
 * The risk that buys is staleness: a dispatcher reading an out-of-date concern
 * table would silently run the wrong guards, which is worse than being slow.
 * Two things hold it down and both are asserted here — the mtime guard at
 * runtime, and this test, which fails the moment the committed JSON stops
 * matching the YAML it was compiled from.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

import { _load_yaml } from "../../src/scripts/hooks/dispatch_hook.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const YAML_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");
const JSON_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.json");

describe("precompiled hook manifest", () => {
  it("the committed JSON exists — the fast path is not silently dead", () => {
    expect(fs.existsSync(JSON_PATH)).toBe(true);
  });

  it("the committed JSON is exactly what the YAML compiles to", () => {
    // The whole guard. Regenerate with:
    //   npx tsx -e 'import{parse}from"yaml";import*as fs from"node:fs";
    //   fs.writeFileSync("src/scripts/hook_manifest.json",
    //   JSON.stringify(parse(fs.readFileSync("src/scripts/hook_manifest.yaml","utf-8"),{version:"1.1"})))'
    const fromYaml = parseYaml(fs.readFileSync(YAML_PATH, "utf-8"), { version: "1.1" });
    const committed = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    expect(committed).toEqual(fromYaml);
  });

  it("_load_yaml returns the same table whichever path it takes", () => {
    // The fast path must be indistinguishable from the parse it replaces —
    // this is the property the dispatcher depends on, not merely that both
    // files exist.
    const viaLoader = _load_yaml(YAML_PATH);
    const fromYaml = parseYaml(fs.readFileSync(YAML_PATH, "utf-8"), { version: "1.1" });
    expect(viaLoader).toEqual(fromYaml);
  });

  it("ignores a compiled sibling that is OLDER than its source", () => {
    // The failure this prevents: someone edits the YAML, forgets to
    // regenerate, and the dispatcher keeps running the previous concern
    // table. Slow-and-correct beats fast-and-wrong.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ac-manifest-"));
    try {
      const y = path.join(dir, "m.yaml");
      const j = path.join(dir, "m.json");
      fs.writeFileSync(j, JSON.stringify({ schema_version: 1, stale: true }));
      // Source written second, so its mtime is the newer one.
      fs.writeFileSync(y, "schema_version: 1\nfresh: true\n");
      const old = new Date(Date.now() - 60_000);
      fs.utimesSync(j, old, old);

      const loaded = _load_yaml(y);
      expect(loaded["fresh"]).toBe(true);
      expect(loaded["stale"]).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("uses a compiled sibling that is NOT older than its source", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ac-manifest-"));
    try {
      const y = path.join(dir, "m.yaml");
      const j = path.join(dir, "m.json");
      fs.writeFileSync(y, "schema_version: 1\nfrom_yaml: true\n");
      fs.writeFileSync(j, JSON.stringify({ schema_version: 1, from_json: true }));

      const loaded = _load_yaml(y);
      expect(loaded["from_json"]).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to the source when the compiled sibling is malformed", () => {
    // Never fail a dispatch on the optimisation itself.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ac-manifest-"));
    try {
      const y = path.join(dir, "m.yaml");
      const j = path.join(dir, "m.json");
      fs.writeFileSync(y, "schema_version: 1\nfrom_yaml: true\n");
      fs.writeFileSync(j, "{ not valid json");

      const loaded = _load_yaml(y);
      expect(loaded["from_yaml"]).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
