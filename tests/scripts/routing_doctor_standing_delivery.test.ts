// Tests for the standing-delivery savings line on the routing:doctor surface
// (road-to-feedback-9-29 Phase 4.3).
//
// The measurement itself is `check_standing_rule_delivery`'s and is tested
// there; what these tests pin is the user-visible half — that a consumer sees
// the scoped-delivery win on first run, and that the both-layers state reads as
// a red pointing at the REMEDY THAT EXISTS rather than as a saving.
//
// Updated 2026-08-21: the remedy this file used to pin was
// `install --layer=<global|project>` — layer suppression, which ADR-226 declined
// for this repository and ADR-236 superseded with the partition. A test that
// pins superseded advice as the desired output is how the advice survives the
// decision that replaced it, so the assertions moved to the partition.
//
// Fixture layers only: both real layers are machine-local (`~/.claude/rules` is
// per-machine, `.claude/rules` is gitignored), so asserting live numbers would
// pin a per-machine reading. Nothing is written inside the repo.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  collect_standing_delivery,
  render_standing_delivery,
} from "../../src/scripts/routing_doctor.js";

const tmpDirs: string[] = [];

function tmpDir(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

/** A rules layer holding `names`, each with enough prose to carry real tokens. */
function ruleLayer(root: string, names: readonly string[]): string {
  const dir = path.join(root, ".claude", "rules");
  fs.mkdirSync(dir, { recursive: true });
  for (const name of names) {
    fs.writeFileSync(
      path.join(dir, name),
      `# ${name}\n\nThe obligation this rule carries, stated at enough length that the\n` +
        "token count is not rounding noise, repeated so the layer is measurable.\n".repeat(4),
      "utf-8",
    );
  }
  return dir;
}

afterEach(() => {
  while (tmpDirs.length > 0) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

describe("standing-delivery savings line", () => {
  it("scoped-clean: reports the measured received total and zero duplicated tokens", () => {
    const ws = tmpDir("sd-scoped-ws-");
    ruleLayer(ws, ["commit-policy.md", "scope-control.md"]);
    const emptyGlobalHome = tmpDir("sd-scoped-global-");

    const m = collect_standing_delivery(ws, path.join(emptyGlobalHome, ".claude", "rules"));
    expect(m).not.toBeNull();
    expect(m?.layers.map((l) => l.label)).toEqual(["project"]);
    expect(m?.overlap_rules).toBe(0);
    expect(m!.received_tokens).toBeGreaterThan(0);

    const text = render_standing_delivery(m).join("\n");
    expect(text).toContain(`receives ${m!.received_tokens} rule tokens`);
    expect(text).toContain("project layer only");
    // The measured fact: with one layer installed nothing is delivered twice,
    // which is what `overlap_rules === 0` above actually establishes.
    expect(text).toContain("0 tokens delivered twice");
    expect(text).toContain("no second layer to measure a saving against");
    expect(text).not.toContain("install --layer");
  });

  it("scoped-clean: prints NO saving figure — the invented ×2 baseline must not come back", () => {
    // The line this pins used to compute `baseline = received × 2` and report
    // `saved / baseline`, which is exactly 50% for every non-zero input — a
    // tautology, not a measurement, and measured against a second layer that
    // is not installed and whose corpus need not have matched anyway (see the
    // disjoint-layers case below). Two layers of very different size are
    // rendered here precisely because the old code returned the same
    // percentage for both.
    const small = tmpDir("sd-taut-small-");
    ruleLayer(small, ["commit-policy.md"]);
    const big = tmpDir("sd-taut-big-");
    ruleLayer(big, ["a.md", "b.md", "c.md", "d.md", "e.md", "f.md", "g.md"]);
    const noGlobal = path.join(tmpDir("sd-taut-global-"), ".claude", "rules");

    const ms = collect_standing_delivery(small, noGlobal)!;
    const mb = collect_standing_delivery(big, noGlobal)!;
    expect(mb.received_tokens).toBeGreaterThan(ms.received_tokens * 2);

    for (const m of [ms, mb]) {
      const text = render_standing_delivery(m).join("\n");
      expect(text).not.toMatch(/\(\d+%\)/);
      expect(text).not.toContain("saved");
      expect(text).not.toContain("baseline");
      // The doubled figure itself must appear nowhere in the line.
      expect(text).not.toContain(String(m.received_tokens * 2));
    }
  });

  it("both-layers-red: names the doubled delivery and points at the partition", () => {
    const ws = tmpDir("sd-both-ws-");
    ruleLayer(ws, ["commit-policy.md", "scope-control.md"]);
    const globalHome = tmpDir("sd-both-global-");
    const globalRules = ruleLayer(globalHome, ["commit-policy.md", "scope-control.md"]);

    const m = collect_standing_delivery(ws, globalRules);
    expect(m?.layers.map((l) => l.label)).toEqual(["global", "project"]);
    expect(m?.overlap_rules).toBe(2);
    expect(m?.duplicate_rules).toBe(2);
    expect(m!.overlap_tokens).toBeGreaterThan(0);

    const text = render_standing_delivery(m).join("\n");
    expect(text).toContain("⚠️");
    expect(text).toContain("both rule layers active");
    expect(text).toContain("2 rule(s) delivered twice");
    expect(text).toContain(`single-layer delivery would be ~${m!.received_tokens - m!.overlap_tokens}`);
    // The remedy must be the one that can actually fix the condition: the
    // partition is armed by `agent-config install` writing a host-layer
    // fingerprint, and nothing about `--layer` does that.
    expect(text).toContain("ADR-236");
    expect(text).toContain("agent-config install");
    expect(text).not.toMatch(/run `agent-config install --layer=/);
    // Pure duplicates — suppression alone is enough, so no refresh caveat.
    expect(text).not.toContain("refresh before suppressing");
  });

  it("both-layers with DIVERGENT copies carries the refresh caveat — suppression alone loses obligations", () => {
    const ws = tmpDir("sd-skew-ws-");
    ruleLayer(ws, ["commit-policy.md"]);
    const globalHome = tmpDir("sd-skew-global-");
    const globalRules = ruleLayer(globalHome, ["commit-policy.md"]);
    fs.appendFileSync(
      path.join(globalRules, "commit-policy.md"),
      "\nAn obligation only the global copy carries.\n",
      "utf-8",
    );

    const m = collect_standing_delivery(ws, globalRules);
    expect(m?.divergent_rules).toBe(1);
    const text = render_standing_delivery(m).join("\n");
    expect(text).toContain("1 of the shared rule(s) differ in body");
    expect(text).toContain("refresh before suppressing");
  });

  it("carries the filesystem-not-host-confirmed caveat while no InstructionsLoaded record exists", () => {
    const ws = tmpDir("sd-caveat-ws-");
    ruleLayer(ws, ["direct-answers.md"]);
    const m = collect_standing_delivery(ws, path.join(tmpDir("sd-caveat-global-"), "rules"));
    expect(m?.input).toBe("filesystem");
    expect(render_standing_delivery(m).join("\n")).toContain("not host-confirmed");
  });

  it("no layer installed is a real answer, not a saving", () => {
    const ws = tmpDir("sd-none-ws-");
    const m = collect_standing_delivery(ws, path.join(tmpDir("sd-none-global-"), "rules"));
    expect(m).toBeNull();
    expect(render_standing_delivery(m).join("\n")).toContain("no rule layer installed");
  });
});
