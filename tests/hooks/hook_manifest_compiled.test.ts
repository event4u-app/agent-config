/**
 * The precompiled hook manifest (`src/scripts/hook_manifest.json`) and the
 * fast path in `_load_yaml` that reads it.
 *
 * WHY it exists, measured 2026-08-19: the ~61 kB YAML manifest is parsed on
 * EVERY hook dispatch. Loading the `yaml` module costs 8 ms and parsing the
 * manifest another 12 ms, against a ~103 ms dispatch — so a fifth of every
 * dispatch was re-deriving a table that never changes between runs. The
 * compiled sibling is the same data with comments stripped (~15 kB) and parses
 * in under a millisecond. Measured effect on `pre_tool_use` p50, one machine,
 * n=50: 103 ms → 81 ms.
 *
 * THE FIRST VERSION OF THIS FAST PATH SHIPPED BROKEN, and the case that would
 * have caught it is `applies even when the YAML is NEWER` below. Freshness was
 * decided by mtime, so on a fresh `actions/checkout` — where both files carry
 * the checkout timestamp in whatever order git wrote them — whether the
 * optimisation applied at all was a coin flip. It won on the PR run (p95
 * 129 ms) and lost on the trunk (p95 186 ms) for the SAME commit, and the
 * green PR run is exactly why it got merged. Freshness is now decided by a
 * content fingerprint, which is deterministic wherever the tree came from.
 *
 * The other risk is staleness: a dispatcher reading an out-of-date concern
 * table would silently run the wrong guards, which is worse than being slow.
 * Two things hold it down and both are asserted here — the fingerprint check at
 * runtime, and the committed-JSON case, which fails the moment the compiled
 * form stops matching the YAML it was compiled from.
 */
import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

import {
  _load_yaml,
  _manifest_fingerprint,
} from "../../src/scripts/hooks/dispatch_hook.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const YAML_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");
const JSON_PATH = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.json");

/** A throwaway yaml/json pair, written in a controlled mtime order. */
function pair(yamlText: string, json: unknown, opts?: { yamlLast?: boolean }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ac-manifest-"));
  const y = path.join(dir, "m.yaml");
  const j = path.join(dir, "m.json");
  if (opts?.yamlLast === true) {
    fs.writeFileSync(j, JSON.stringify(json));
    fs.writeFileSync(y, yamlText);
    const old = new Date(Date.now() - 120_000);
    fs.utimesSync(j, old, old); // JSON deliberately much older
  } else {
    fs.writeFileSync(y, yamlText);
    fs.writeFileSync(j, JSON.stringify(json));
  }
  return { dir, y };
}

describe("precompiled hook manifest", () => {
  it("the committed JSON exists — the fast path is not silently dead", () => {
    expect(fs.existsSync(JSON_PATH)).toBe(true);
  });

  it("the committed JSON is exactly what the YAML compiles to", () => {
    // The staleness guard. Regenerate with:
    //   ./scripts-run src/scripts/compile_hook_manifest
    const text = fs.readFileSync(YAML_PATH, "utf-8");
    const committed = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
    expect(committed.manifest).toEqual(parseYaml(text, { version: "1.1" }));
    expect(committed.fingerprint).toBe(_manifest_fingerprint(text));
  });

  it("_load_yaml returns the same table whichever path it takes", () => {
    const text = fs.readFileSync(YAML_PATH, "utf-8");
    expect(_load_yaml(YAML_PATH)).toEqual(parseYaml(text, { version: "1.1" }));
  });

  it("applies even when the YAML is NEWER — freshness is content, not mtime", () => {
    // THE REGRESSION THAT SHIPPED. An mtime rule made this the fallback case,
    // so on a fresh checkout the optimisation was a coin flip: same commit,
    // p95 129 ms on the PR and 186 ms on the trunk.
    const yamlText = "schema_version: 1\nvalue: from_yaml\n";
    const { dir, y } = pair(
      yamlText,
      { fingerprint: _manifest_fingerprint(yamlText), manifest: { value: "from_json" } },
      { yamlLast: true },
    );
    try {
      // The compiled sibling is two minutes OLDER and must still be used,
      // because its fingerprint matches the source it was compiled from.
      expect(_load_yaml(y)["value"]).toBe("from_json");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores a compiled sibling whose fingerprint does not match the source", () => {
    // The failure this prevents: someone edits the YAML, forgets to
    // regenerate, and the dispatcher keeps running the previous concern
    // table. Slow-and-correct beats fast-and-wrong.
    const { dir, y } = pair("schema_version: 1\nvalue: edited\n", {
      fingerprint: _manifest_fingerprint("schema_version: 1\nvalue: stale\n"),
      manifest: { value: "stale" },
    });
    try {
      expect(_load_yaml(y)["value"]).toBe("edited");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores a compiled sibling carrying no fingerprint at all", () => {
    // The pre-fingerprint shape must not be trusted by a newer reader.
    const { dir, y } = pair("schema_version: 1\nvalue: edited\n", {
      schema_version: 1,
      value: "legacy_shape",
    });
    try {
      expect(_load_yaml(y)["value"]).toBe("edited");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("falls back to the source when the compiled sibling is malformed", () => {
    // Never fail a dispatch on the optimisation itself.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ac-manifest-"));
    try {
      const y = path.join(dir, "m.yaml");
      fs.writeFileSync(y, "schema_version: 1\nvalue: from_yaml\n");
      fs.writeFileSync(path.join(dir, "m.json"), "{ not valid json");
      expect(_load_yaml(y)["value"]).toBe("from_yaml");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("_manifest_fingerprint", () => {
  it("changes when the source changes, including on a same-length edit", () => {
    // Length alone would not catch this, which is why the fingerprint is a
    // hash AND a length rather than either one.
    expect(_manifest_fingerprint("a: 1\nb: 2\n")).not.toBe(
      _manifest_fingerprint("a: 1\nb: 3\n"),
    );
  });

  it("is stable for identical input", () => {
    expect(_manifest_fingerprint("a: 1\n")).toBe(_manifest_fingerprint("a: 1\n"));
  });
});
