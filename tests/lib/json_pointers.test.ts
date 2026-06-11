/**
 * Tests for `src/scripts/_lib/json_pointers.ts`.
 *
 * 1:1 port of `tests/test_json_pointers.py` (ADR-088 Phase 2 / Wave 1)
 * plus a differential block that drives the Python original via
 * `python3 -c` on shared fixtures and asserts identical output.
 */

import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

import {
  ArrayIndexPointerError,
  build_merge_entries,
  collect_pointers,
  subtract_pointers,
  validate_pointer,
  value_hash,
} from "../../src/scripts/_lib/json_pointers.js";

describe("validate_pointer", () => {
  it("test_empty_pointer_is_valid", () => {
    validate_pointer("");
  });

  it("test_object_key_pointer_is_valid", () => {
    validate_pointer("/hooks/PostToolUse");
  });

  it("test_array_index_pointer_is_rejected", () => {
    let caught: unknown;
    try {
      validate_pointer("/hooks/PostToolUse/0");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(ArrayIndexPointerError);
    const exc = caught as ArrayIndexPointerError;
    expect(exc.segment).toBe("0");
    expect(String(exc)).toContain("/hooks/PostToolUse/0");
  });

  it("test_double_digit_index_is_rejected", () => {
    expect(() => validate_pointer("/items/42")).toThrowError(
      ArrayIndexPointerError,
    );
  });

  it("test_leading_zero_segment_is_not_index", () => {
    // RFC 6901: leading zeros are not array indices.
    validate_pointer("/items/01");
  });

  it("test_must_start_with_slash", () => {
    expect(() => validate_pointer("hooks/PostToolUse")).toThrowError(
      /must start with/,
    );
  });

  it("test_segment_with_escaped_slash_is_valid", () => {
    validate_pointer("/foo~1bar/baz");
  });
});

describe("value_hash", () => {
  it("test_stable_across_key_order", () => {
    const a = value_hash({ a: 1, b: 2 });
    const b = value_hash({ b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("test_distinguishes_distinct_lists", () => {
    expect(value_hash([1, 2, 3])).not.toBe(value_hash([1, 2, 4]));
  });

  it("test_stable_for_equal_lists", () => {
    expect(value_hash([{ x: 1 }])).toBe(value_hash([{ x: 1 }]));
  });
});

describe("collect_pointers", () => {
  it("test_top_level_scalar", () => {
    const entries = collect_pointers({ name: "agent-config" });
    expect(entries).toEqual([{ json_pointer: "/name", value_hash: null }]);
  });

  it("test_nested_object_recurses_to_leaves", () => {
    const entries = collect_pointers({
      mcpServers: { "agent-config": { command: "x" } },
    });
    expect(entries.map((e) => e.json_pointer)).toEqual([
      "/mcpServers/agent-config/command",
    ]);
  });

  it("test_list_value_hashed_at_parent_key", () => {
    const entries = collect_pointers({
      PostToolUse: [{ hook: "a" }, { hook: "b" }],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.json_pointer).toBe("/PostToolUse");
    expect(entries[0]?.value_hash).not.toBeNull();
  });

  it("test_empty_dict_emits_self_pointer", () => {
    const entries = collect_pointers({ flags: {} });
    expect(entries).toEqual([{ json_pointer: "/flags", value_hash: null }]);
  });

  it("test_keys_with_special_chars_are_escaped", () => {
    const entries = collect_pointers({ "a/b": 1, "c~d": 2 });
    const pointers = new Set(entries.map((e) => e.json_pointer));
    expect(pointers.has("/a~1b")).toBe(true);
    expect(pointers.has("/c~0d")).toBe(true);
  });

  it("test_never_emits_array_index_pointers", () => {
    const entries = collect_pointers({ hooks: { PostToolUse: [1, 2, 3] } });
    for (const entry of entries) {
      validate_pointer(entry.json_pointer);
    }
    expect(entries.map((e) => e.json_pointer)).toEqual(["/hooks/PostToolUse"]);
  });
});

describe("build_merge_entries", () => {
  it("test_includes_file_label", () => {
    const entries = build_merge_entries(".cursor/hooks.json", {
      hooks: { x: [1] },
    });
    expect(entries.every((e) => e.file === ".cursor/hooks.json")).toBe(true);
  });

  it("test_array_entry_carries_value_hash", () => {
    const entries = build_merge_entries(".cursor/hooks.json", {
      hooks: { PostToolUse: [{ command: "x" }] },
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]?.json_pointer).toBe("/hooks/PostToolUse");
    expect(entries[0]?.value_hash).not.toBeNull();
  });

  it("test_scalar_entry_has_null_value_hash", () => {
    const entries = build_merge_entries(".augment/settings.json", {
      "agent_config.enabled": true,
    });
    expect(entries).toEqual([
      {
        file: ".augment/settings.json",
        json_pointer: "/agent_config.enabled",
        value_hash: null,
      },
    ]);
  });
});

describe("subtract_pointers", () => {
  it("test_removes_scalar_leaf", () => {
    const doc: Record<string, unknown> = {
      agent_config: { enabled: true },
      other: "keep",
    };
    const entries = [
      { json_pointer: "/agent_config/enabled", value_hash: null },
    ];
    const [new_doc, warnings] = subtract_pointers(doc, entries);
    expect(warnings).toEqual([]);
    // Empty ancestor trimmed.
    expect(new_doc).toEqual({ other: "keep" });
  });

  it("test_preserves_foreign_keys", () => {
    const doc: Record<string, unknown> = {
      mcpServers: {
        "agent-config": { command: "x" },
        "other-package": { command: "y" },
      },
    };
    const entries = [
      { json_pointer: "/mcpServers/agent-config/command", value_hash: null },
    ];
    const [new_doc, warnings] = subtract_pointers(doc, entries);
    expect(warnings).toEqual([]);
    // Sibling tool's key + mcpServers parent both survive.
    expect(new_doc).toEqual({
      mcpServers: { "other-package": { command: "y" } },
    });
  });

  it("test_list_with_matching_hash_removes_whole_key", () => {
    const original_list = [{ hook: "a" }];
    const doc: Record<string, unknown> = {
      hooks: { PostToolUse: original_list },
    };
    const entries = [
      { json_pointer: "/hooks/PostToolUse", value_hash: value_hash(original_list) },
    ];
    const [new_doc, warnings] = subtract_pointers(doc, entries);
    expect(warnings).toEqual([]);
    expect(new_doc).toEqual({});
  });

  it("test_list_with_drifted_hash_skips_with_warning", () => {
    const original_list = [{ hook: "a" }];
    const doc: Record<string, unknown> = {
      hooks: { PostToolUse: [{ hook: "a" }, { hook: "neighbour" }] },
    };
    const entries = [
      { json_pointer: "/hooks/PostToolUse", value_hash: value_hash(original_list) },
    ];
    const [new_doc, warnings] = subtract_pointers(doc, entries);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.reason).toBe("drift");
    expect(warnings[0]?.pointer).toBe("/hooks/PostToolUse");
    // Doc untouched.
    expect(new_doc).toEqual({
      hooks: { PostToolUse: [{ hook: "a" }, { hook: "neighbour" }] },
    });
  });

  it("test_missing_pointer_warns_does_not_raise", () => {
    const doc: Record<string, unknown> = { other: "x" };
    const entries = [
      { json_pointer: "/agent_config/enabled", value_hash: null },
    ];
    const [new_doc, warnings] = subtract_pointers(doc, entries);
    expect(warnings).toEqual([
      {
        pointer: "/agent_config/enabled",
        reason: "missing",
        expected_hash: null,
        actual_hash: null,
      },
    ]);
    expect(new_doc).toEqual({ other: "x" });
  });

  it("test_two_tools_share_parent_uninstalling_one_leaves_other", () => {
    // Acceptance scenario from P2.2: two synthetic packages share `.cursor/hooks.json`.
    const doc: Record<string, unknown> = {
      hooks: {
        PreToolUse: [{ tool: "a" }],
        PostToolUse: [{ tool: "b" }],
      },
    };
    // Tool A owned PreToolUse only.
    const a_entries = [
      { json_pointer: "/hooks/PreToolUse", value_hash: value_hash([{ tool: "a" }]) },
    ];
    const [new_doc, warnings] = subtract_pointers(doc, a_entries);
    expect(warnings).toEqual([]);
    expect(new_doc).toEqual({ hooks: { PostToolUse: [{ tool: "b" }] } });
  });

  it("test_escaped_segments_round_trip", () => {
    const doc: Record<string, unknown> = { "a/b": { "c~d": 1 } };
    const entries = [{ json_pointer: "/a~1b/c~0d", value_hash: null }];
    const [new_doc, warnings] = subtract_pointers(doc, entries);
    expect(warnings).toEqual([]);
    expect(new_doc).toEqual({});
  });

  it("test_deep_chain_trims_all_empty_ancestors", () => {
    const doc: Record<string, unknown> = { a: { b: { c: { d: "leaf" } } } };
    const entries = [{ json_pointer: "/a/b/c/d", value_hash: null }];
    const [new_doc] = subtract_pointers(doc, entries);
    expect(new_doc).toEqual({});
  });

  it("test_ancestor_with_foreign_sibling_stops_trim", () => {
    const doc: Record<string, unknown> = {
      a: { b: { c: "leaf", foreign: "x" } },
    };
    const entries = [{ json_pointer: "/a/b/c", value_hash: null }];
    const [new_doc] = subtract_pointers(doc, entries);
    expect(new_doc).toEqual({ a: { b: { foreign: "x" } } });
  });
});

// ---------------------------------------------------------------------------
// Differential block — Python module is the reference implementation.
// Pattern per tests/spikes/yaml_rt_py_driver.py: drive python3 on shared
// fixture inputs and assert the TS twin produces identical output.
// ---------------------------------------------------------------------------

interface DiffCase {
  op: "value_hash" | "collect" | "build" | "subtract";
  value?: unknown;
  overlay?: Record<string, unknown>;
  file?: string;
  doc?: Record<string, unknown>;
  entries?: Array<{ json_pointer: string; value_hash: string | null }>;
}

const PY_DRIVER = `
import json, os, sys
sys.path.insert(0, os.path.join(os.getcwd(), "src"))
from scripts._lib import json_pointers as jp

cases = json.load(sys.stdin)
out = []
for case in cases:
    op = case["op"]
    if op == "value_hash":
        out.append(jp.value_hash(case["value"]))
    elif op == "collect":
        out.append(jp.collect_pointers(case["overlay"]))
    elif op == "build":
        out.append(jp.build_merge_entries(case["file"], case["overlay"]))
    elif op == "subtract":
        doc, warnings = jp.subtract_pointers(case["doc"], case["entries"])
        out.append({"doc": doc, "warnings": warnings})
    else:
        raise SystemExit(f"unknown op {op!r}")
print(json.dumps(out))
`;

function run_python(cases: DiffCase[]): unknown[] {
  const stdout = execFileSync("python3", ["-c", PY_DRIVER], {
    input: JSON.stringify(cases),
    encoding: "utf-8",
  });
  return JSON.parse(stdout) as unknown[];
}

describe("differential vs Python reference", () => {
  it("value_hash matches Python json.dumps canonical hashing", () => {
    const values: unknown[] = [
      { a: 1, b: [1, 2, { c: true, d: null }] },
      { b: 2, a: 1 }, // insertion order must not matter
      ["Grüße ☃", "naïve"], // non-ASCII → ensure_ascii escapes
      ["🎉 emoji", "line\nbreak\ttab"], // astral + control chars
      ['quote " and backslash \\', ""],
      { "key/with~specials": ["a", "b"], "ümlaut": 1.5 },
      [0.1, 2.5, -3, 100000],
      {},
      [],
    ];
    const cases: DiffCase[] = values.map((value) => ({ op: "value_hash", value }));
    const py = run_python(cases);
    values.forEach((value, i) => {
      expect(value_hash(value), `fixture #${i}`).toBe(py[i]);
    });
  });

  it("collect_pointers / build_merge_entries match Python output", () => {
    const overlays: Array<Record<string, unknown>> = [
      { name: "agent-config" },
      { mcpServers: { "agent-config": { command: "x", args: ["a", "b"] } } },
      { hooks: { PostToolUse: [{ hook: "a" }, { hook: "b" }], flags: {} } },
      { "a/b": 1, "c~d": 2, nested: { deep: { leaf: null } } },
    ];
    const cases: DiffCase[] = [
      ...overlays.map((overlay) => ({ op: "collect", overlay }) as DiffCase),
      ...overlays.map(
        (overlay) => ({ op: "build", file: ".cursor/hooks.json", overlay }) as DiffCase,
      ),
    ];
    const py = run_python(cases);
    overlays.forEach((overlay, i) => {
      expect(collect_pointers(overlay), `collect #${i}`).toEqual(py[i]);
    });
    overlays.forEach((overlay, i) => {
      expect(
        build_merge_entries(".cursor/hooks.json", overlay),
        `build #${i}`,
      ).toEqual(py[overlays.length + i]);
    });
  });

  it("subtract_pointers matches Python output (doc + warnings)", () => {
    const owned_list = [{ hook: "a" }];
    const scenarios: Array<{
      doc: Record<string, unknown>;
      entries: Array<{ json_pointer: string; value_hash: string | null }>;
    }> = [
      {
        doc: { agent_config: { enabled: true }, other: "keep" },
        entries: [{ json_pointer: "/agent_config/enabled", value_hash: null }],
      },
      {
        doc: { hooks: { PostToolUse: [{ hook: "a" }, { hook: "n" }] } },
        entries: [
          { json_pointer: "/hooks/PostToolUse", value_hash: value_hash(owned_list) },
        ],
      },
      {
        doc: { other: "x" },
        entries: [{ json_pointer: "/agent_config/enabled", value_hash: null }],
      },
      {
        doc: { a: { b: { c: { d: "leaf" } } }, keep: 1 },
        entries: [
          { json_pointer: "/a/b/c/d", value_hash: null },
          { json_pointer: "/keep-missing", value_hash: null },
        ],
      },
    ];
    const cases: DiffCase[] = scenarios.map(({ doc, entries }) => ({
      op: "subtract",
      // Deep-copy: subtract_pointers mutates the doc in both runtimes.
      doc: JSON.parse(JSON.stringify(doc)) as Record<string, unknown>,
      entries,
    }));
    const py = run_python(cases);
    scenarios.forEach(({ doc, entries }, i) => {
      const [new_doc, warnings] = subtract_pointers(
        JSON.parse(JSON.stringify(doc)) as Record<string, unknown>,
        entries,
      );
      expect({ doc: new_doc, warnings }, `subtract #${i}`).toEqual(py[i]);
    });
  });
});
