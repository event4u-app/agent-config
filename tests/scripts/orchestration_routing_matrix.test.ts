// Orchestration dispatch-decision matrix runner (road-to-tested-routing
// Phase 6). Executes tests/eval/orchestration-matrix/decisions.yaml against
// the REAL deterministic routing functions — classifyTask, inferSliceTier,
// resolveSubagentRouting, classifyLookup — so every dispatch decision
// (delegable?, which mode, which tier, which primitive) is pinned by data
// the same way rule routing is pinned by tests/eval/routing-matrix/.
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

import {
  classifyLookup,
  classifyTask,
  inferSliceTier,
  type ActivationInputs,
  type TaskSignals,
} from "../../src/scripts/_lib/auto_dispatch.js";
import { resolveSubagentRouting } from "../../src/scripts/_lib/subagent_routing.js";

const FIXTURE = path.resolve(
  __dirname,
  "..",
  "eval",
  "orchestration-matrix",
  "decisions.yaml",
);

interface ClassifyRow {
  name: string;
  signals: TaskSignals;
  activation: ActivationInputs;
  expect: { delegable: boolean; action: string; mode: string | null };
}
interface TierRow {
  name: string;
  signals: { slice_type?: string; exceeds_mechanical_envelope?: boolean };
  expect: { tier: string; tier_source: string };
}
interface RoutingRow {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs: any;
  expect: { tier: string; model: string; quota_pool: string; tier_source: string };
}
interface LookupRow {
  name: string;
  task: string;
  expect: { route: string; primitive: string | null };
}

const matrix = parseYaml(fs.readFileSync(FIXTURE, "utf-8")) as {
  classify: ClassifyRow[];
  tier: TierRow[];
  routing: RoutingRow[];
  lookup: LookupRow[];
};

describe("orchestration matrix — classifyTask", () => {
  it("fixture carries positives AND near-misses", () => {
    expect(matrix.classify.length).toBeGreaterThanOrEqual(8);
    expect(matrix.classify.some((r) => r.name.startsWith("near-miss"))).toBe(true);
  });

  for (const row of matrix.classify) {
    it(row.name, () => {
      const got = classifyTask(row.signals, row.activation);
      expect(got.delegable).toBe(row.expect.delegable);
      expect(got.action).toBe(row.expect.action);
      expect(got.mode).toBe(row.expect.mode);
    });
  }
});

describe("orchestration matrix — inferSliceTier", () => {
  for (const row of matrix.tier) {
    it(row.name, () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const got = inferSliceTier(row.signals as any);
      expect(got.tier).toBe(row.expect.tier);
      expect(got.tier_source).toBe(row.expect.tier_source);
    });
  }
});

describe("orchestration matrix — resolveSubagentRouting", () => {
  for (const row of matrix.routing) {
    it(row.name, () => {
      const got = resolveSubagentRouting(row.inputs);
      expect(got.tier).toBe(row.expect.tier);
      expect(got.model).toBe(row.expect.model);
      expect(got.quota_pool).toBe(row.expect.quota_pool);
      expect(got.tier_source).toBe(row.expect.tier_source);
    });
  }
});

describe("orchestration matrix — lookup-class layer", () => {
  for (const row of matrix.lookup) {
    it(row.name, () => {
      const got = classifyLookup(row.task);
      expect(got.route).toBe(row.expect.route);
      expect(got.primitive).toBe(row.expect.primitive);
    });
  }
});
