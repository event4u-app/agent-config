/**
 * Tier vocabulary + cool-down state.
 *
 * REDUCED 2026-08-16 alongside the module. The decision-layer and
 * permit-lifecycle suites (`pickTier — the binding relation`,
 * `acquireBudgetPermit — atomic reserve`, and `reserve lifecycle —
 * pre-registered acceptance criteria`, which exercised AC1–AC5) tested code that
 * a converged AI-council verdict archived; keeping them would have left the
 * repository asserting a contract it no longer implements. Migration record:
 * `docs/contracts/budget-routing.md`.
 *
 * What survives here is what has a live consumer: `routing_doctor.ts` reads the
 * cool-down map as a diagnostic.
 *
 * The round-trip case had to change rather than merely move, and that is the
 * point of the note: it used to write the file with `tripCooldown` and read it
 * back, which no longer exists. There is now NO writer anywhere in the tree, so
 * the test plants the file directly — which is also the honest shape, because it
 * is exactly the situation the reader faces in production.
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { COOLDOWN_FILE, TIER_ORDER, readCooldowns } from "../../src/scripts/_lib/tier_budget_routing.js";

const dirs: string[] = [];

function tmpDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "tbr-"));
    dirs.push(d);
    return d;
}

afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d !== undefined) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

describe("tier vocabulary", () => {
    it("is ordered cheapest-first", () => {
        expect([...TIER_ORDER]).toEqual(["cheap", "medium", "strong"]);
    });
});

describe("cool-down state", () => {
    it("reads a planted map, per tier", () => {
        const dir = tmpDir();
        const until = 1_700_000_000_000;
        fs.writeFileSync(path.join(dir, COOLDOWN_FILE), JSON.stringify({ cheap: until }), "utf-8");
        const map = readCooldowns(dir);
        expect(map.cheap).toBe(until);
        expect(map.medium).toBe(0);
        expect(map.strong).toBe(0);
    });

    it("missing state file → all tiers live", () => {
        expect(readCooldowns(tmpDir())).toEqual({ cheap: 0, medium: 0, strong: 0 });
    });

    it("torn file → all tiers live rather than a throw", () => {
        const dir = tmpDir();
        fs.writeFileSync(path.join(dir, COOLDOWN_FILE), "{ not json", "utf-8");
        expect(readCooldowns(dir)).toEqual({ cheap: 0, medium: 0, strong: 0 });
    });

    it("ignores a non-numeric entry instead of propagating it", () => {
        const dir = tmpDir();
        fs.writeFileSync(
            path.join(dir, COOLDOWN_FILE),
            JSON.stringify({ cheap: "soon", medium: Number.NaN, strong: 42 }),
            "utf-8",
        );
        expect(readCooldowns(dir)).toEqual({ cheap: 0, medium: 0, strong: 42 });
    });
});
