/**
 * Tests for `src/scripts/_lib/model_tier.ts`.
 *
 * The Python module has no dedicated pytest suite (the existing
 * `tests/test_model_tier_schema.py` covers the frontmatter schema, not
 * this module), so this is a focused suite (ADR-088 Phase 2 / Wave 1)
 * covering the tier→model mapping, frontmatter read, and the
 * first-match-only rewrite.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  MODEL_TIER_RE,
  TIER_TO_CLAUDE_MODEL,
  read_model_tier,
  render_native_model_md,
} from "../../src/scripts/_lib/model_tier.js";

let tmp_path: string;

beforeEach(() => {
  tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), "model-tier-"));
});

afterEach(() => {
  fs.rmSync(tmp_path, { recursive: true, force: true });
});

function write_skill(body: string): string {
  const p = path.join(tmp_path, "SKILL.md");
  fs.writeFileSync(p, body);
  return p;
}

describe("TIER_TO_CLAUDE_MODEL", () => {
  it("maps the three rewriteable tiers (ADR-035 § 3)", () => {
    expect(TIER_TO_CLAUDE_MODEL).toEqual({
      high: "opus",
      medium: "sonnet",
      lite: "haiku",
    });
  });
});

describe("read_model_tier", () => {
  it("returns null for a missing file", () => {
    expect(read_model_tier(path.join(tmp_path, "absent.md"))).toBeNull();
  });

  it("returns null when the file has no frontmatter", () => {
    const p = write_skill("# Just a heading\nmodel_tier: high\n");
    expect(read_model_tier(p)).toBeNull();
  });

  it("returns null when the frontmatter is unterminated", () => {
    const p = write_skill("---\nname: x\nmodel_tier: high\n");
    expect(read_model_tier(p)).toBeNull();
  });

  it("reads a bare model_tier value", () => {
    const p = write_skill("---\nname: x\nmodel_tier: medium\n---\nBody.\n");
    expect(read_model_tier(p)).toBe("medium");
  });

  it("reads a quoted model_tier value", () => {
    const p = write_skill('---\nname: x\nmodel_tier: "high"\n---\nBody.\n');
    expect(read_model_tier(p)).toBe("high");
  });

  it("returns null when model_tier only appears after the frontmatter", () => {
    const p = write_skill("---\nname: x\n---\nmodel_tier: high\n");
    expect(read_model_tier(p)).toBeNull();
  });

  it("returns inherit verbatim (callers gate on the mapping)", () => {
    const p = write_skill("---\nmodel_tier: inherit\n---\n");
    expect(read_model_tier(p)).toBe("inherit");
  });
});

describe("render_native_model_md", () => {
  it("rewrites the first model_tier line to the native model", () => {
    const text = "---\nname: x\nmodel_tier: medium\n---\nBody.\n";
    expect(render_native_model_md(text, "medium")).toBe(
      "---\nname: x\nmodel: sonnet\n---\nBody.\n",
    );
  });

  it("rewrites only the FIRST match (re.sub count=1 parity)", () => {
    const text = "---\nmodel_tier: high\n---\nmodel_tier: high\n";
    expect(render_native_model_md(text, "high")).toBe(
      "---\nmodel: opus\n---\nmodel_tier: high\n",
    );
  });

  it("leaves the rest of the document byte-identical", () => {
    const text = '---\nname: x\nmodel_tier: "lite"\ndescription: d\n---\n## H\n';
    expect(render_native_model_md(text, "lite")).toBe(
      "---\nname: x\nmodel: haiku\ndescription: d\n---\n## H\n",
    );
  });

  it("throws for a tier outside the mapping (KeyError parity)", () => {
    expect(() => render_native_model_md("model_tier: inherit\n", "inherit")).toThrow(
      "'inherit'",
    );
  });
});

describe("MODEL_TIER_RE", () => {
  it("matches bare and quoted values, multiline", () => {
    expect(MODEL_TIER_RE.test("name: x\nmodel_tier: high\n")).toBe(true);
    expect(MODEL_TIER_RE.test('model_tier: "lite"')).toBe(true);
    expect(MODEL_TIER_RE.test("a_model_tier: high")).toBe(false);
    expect(MODEL_TIER_RE.test("model_tier: high stuff")).toBe(false);
  });
});
