/**
 * Placeholders 6.3: the generated coverage table, and the shipped probe
 * attestations a consumer install resolves a capability from.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { coverageRows } from "../../../src/scripts/_lib/egress_coverage.js";
import type { SenderRow } from "../../../src/scripts/_lib/egress_sender_scan.js";
import { PROBE_ATTESTATIONS_REL, resolveRewriteCapability } from "../../../src/scripts/_lib/rewrite_capability.js";
import { main as census } from "../../../src/scripts/egress_sender_census.js";
import { parseHostLowering, surfaceRow } from "../../../src/scripts/hooks/host_lowering.js";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const LOWERING = path.join(REPO_ROOT, "src", "scripts", "hooks", "host_lowering.yaml");
const TODAY = "2026-10-20";
const tmp: string[] = [];
afterEach(() => {
  for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const table = () => parseHostLowering(fs.readFileSync(LOWERING, "utf-8"));
const sender = (status: SenderRow["status"], engine: boolean): SenderRow => ({
  module: `src/scripts/x_${status}.ts`,
  endpoints: ["api.example.org"],
  content: "undeclared",
  engine,
  status,
  evidence: "fixture",
});

describe("6.3 — the coverage table", () => {
  it("the committed contract carries the table the tree generates", () => {
    expect(census([], REPO_ROOT)).toBe(0);
  });

  it("one working auth mode never greens another mode's row", () => {
    const rows = coverageRows(table(), [], REPO_ROOT, TODAY).filter((r) => r.host === "claude" && r.channel === "tool result");
    expect(rows.find((r) => r.auth === "subscription")?.state).toBe("replaced");
    expect(rows.filter((r) => r.auth !== "subscription").every((r) => r.state === "uncovered")).toBe(true);
  });

  it("a channel absent from the generator's input appears as an unclassified row", () => {
    const rows = coverageRows(table(), [sender("unclassified", false)], REPO_ROOT, TODAY);
    expect(rows.some((r) => r.channel === "slot pre_compact" && r.host === "claude" && r.state === "unclassified")).toBe(true);
    expect(rows.some((r) => r.channel.includes("x_unclassified") && r.state === "unclassified")).toBe(true);
  });

  it("asserted only where the package owns the bytes; no hook channel is asserted; every K6 channel and the telemetry export are rows", () => {
    const rows = coverageRows(table(), [sender("sender", true), sender("sender", false)], REPO_ROOT, TODAY);
    expect(rows.filter((r) => r.state === "asserted").every((r) => r.host === "this package")).toBe(true);
    expect(rows.some((r) => r.state === "asserted")).toBe(true);
    for (const ch of ["@file mention", "instruction files", "compaction request", "images and other non-text parts", "host telemetry export"]) {
      expect(rows.some((r) => r.channel === ch && r.host === "claude"), ch).toBe(true);
    }
  });
});

describe("a consumer install resolves a capability from the shipped attestations", () => {
  it("with no evidence directory, the attestation file stands in for the probe record", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "egress-consumer-"));
    tmp.push(root);
    fs.mkdirSync(path.join(root, "src", "config"), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, PROBE_ATTESTATIONS_REL), path.join(root, PROBE_ATTESTATIONS_REL));
    const cap = resolveRewriteCapability("claude", surfaceRow("claude"), "output", { today: TODAY, root });
    expect(cap.ok).toBe(true);
    const bare = fs.mkdtempSync(path.join(os.tmpdir(), "egress-bare-"));
    tmp.push(bare);
    expect(resolveRewriteCapability("claude", surfaceRow("claude"), "output", { today: TODAY, root: bare }).ok).toBe(false);
  });
});
