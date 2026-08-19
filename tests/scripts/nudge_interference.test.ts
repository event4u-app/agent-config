// Nudge-interference matrix runner (road-to-standing-context-40k Phase 4 step
// 4.2). Executes tests/eval/nudge-interference/prompts.yaml against the REAL
// nudge predicates and the REAL shaping policy, with the `nudge_rank` values
// read live from the manifest so the corpus and the manifest cannot drift.
//
// The invariant: for every prompt class, AT MOST ONE nudge-class advisory
// leaves. The corpus additionally pins the pre-policy fire set, so a trigger
// change shows up as a corpus failure rather than being absorbed by the fix.
import * as fs from "node:fs";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import { classifyPrompt } from "../../src/scripts/hooks/delegation_nudge_hook.js";
import {
  RC_ALLOW,
  shapeEmissions,
  type EmissionCandidate,
} from "../../src/scripts/hooks/injection_budget.js";
import { routePointers } from "../../src/scripts/hooks/skill_route_hook.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const FIXTURE = path.join(REPO_ROOT, "tests", "eval", "nudge-interference", "prompts.yaml");
const MANIFEST = path.join(REPO_ROOT, "src", "scripts", "hook_manifest.yaml");
const SKILLS_DIR = path.join(REPO_ROOT, "src", "skills");

interface Row {
  name: string;
  prompt: string;
  overlap: boolean;
  fires: string[];
  emitted: string[];
}

/** `nudge_rank` per concern, read from the manifest — never hardcoded here. */
function manifestRanks(): Record<string, number> {
  const parsed = parseYaml(fs.readFileSync(MANIFEST, "utf-8"), { version: "1.1" }) as {
    concerns?: Record<string, { nudge_rank?: unknown }>;
  };
  const out: Record<string, number> = {};
  for (const [name, body] of Object.entries(parsed.concerns ?? {})) {
    if (typeof body?.nudge_rank === "number") out[name] = body.nudge_rank;
  }
  return out;
}

/** Which nudges would fire on this prompt, before any policy. */
function firingNudges(prompt: string): string[] {
  const out: string[] = [];
  if (classifyPrompt(prompt, REPO_ROOT, "claude") !== null) out.push("delegation-nudge");
  if (routePointers(prompt, SKILLS_DIR).length > 0) out.push("skill-route");
  return out;
}

function asCandidates(
  names: readonly string[],
  ranks: Record<string, number>,
): EmissionCandidate[] {
  return names.map((concern) => ({
    concern,
    severity: "advisory",
    failClosed: false,
    rc: RC_ALLOW,
    // A representative advisory line; the policy under test here is
    // exclusivity, and the byte cap is switched off below so size is inert.
    bytes: 400,
    nudgeRank: ranks[concern] ?? null,
  }));
}

const rows = (parseYaml(fs.readFileSync(FIXTURE, "utf-8")) as { rows: Row[] }).rows;
const ranks = manifestRanks();

let savedRole: string | undefined;
beforeAll(() => {
  // `delegation_nudge_hook` silences itself inside a worker/reviewer session.
  // A suite inheriting that marker would measure silence and call it a
  // near-miss, so the variable is cleared for the duration of this file.
  savedRole = process.env["AGENT_CONFIG_SESSION_ROLE"];
  delete process.env["AGENT_CONFIG_SESSION_ROLE"];
});
afterAll(() => {
  if (savedRole === undefined) delete process.env["AGENT_CONFIG_SESSION_ROLE"];
  else process.env["AGENT_CONFIG_SESSION_ROLE"] = savedRole;
});

describe("nudge-interference corpus", () => {
  it("is non-empty and carries at least one measured overlap", () => {
    // Dead-scope guard: a corpus that asserts exclusivity over zero overlapping
    // rows exits green over nothing at all, which is the recorded false-green
    // class this repo gates against.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.overlap)).toBe(true);
  });

  it("reads both nudge ranks from the manifest", () => {
    expect(ranks["delegation-nudge"]).toBeTypeOf("number");
    expect(ranks["skill-route"]).toBeTypeOf("number");
  });

  for (const row of rows) {
    it(`${row.name} — fire set is as measured`, () => {
      expect(firingNudges(row.prompt)).toEqual(row.fires);
    });

    it(`${row.name} — at most one nudge leaves`, () => {
      const shaped = shapeEmissions(asCandidates(firingNudges(row.prompt), ranks), {
        capBytes: null,
      });
      expect(shaped.kept).toEqual(row.emitted);
      expect(shaped.kept.length).toBeLessThanOrEqual(1);
    });
  }

  it("fails when a second nudge is forced — the policy is what makes the rest green", () => {
    const overlapping = rows.find((r) => r.overlap) as Row;
    const firing = firingNudges(overlapping.prompt);
    // Without the policy this prompt emits two nudges. That is the state the
    // corpus above would fail in, and it is asserted here rather than described.
    expect(firing.length).toBe(2);
    const unshaped = shapeEmissions(
      asCandidates(firing, ranks).map((c) => ({ ...c, nudgeRank: null })),
      { capBytes: null },
    );
    expect(unshaped.kept.length).toBe(2);
  });
});
