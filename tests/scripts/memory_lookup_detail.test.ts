/**
 * Index/detail split + batch fetch (road-to-memory-retrieval-economy
 * Phase 1). Runs against the replay fixture tree so shapes are exercised on
 * realistic entries.
 *
 * The compatibility proof: `detail` defaults to 'full' and the default
 * envelope must be BYTE-IDENTICAL to a call without the option — the v1
 * envelope is a published contract (roadmap D1).
 */
import * as path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
    _setIntakeRoot,
    _setKnowledgeRoot,
    _setMemoryRoot,
    memory_get_v1,
    retrieve_v1,
} from "../../src/scripts/memory_lookup.js";

const FIXTURE = path.resolve(__dirname, "..", "fixtures", "memory-replay", "memory-root");

beforeAll(() => {
    _setMemoryRoot(FIXTURE);
    _setKnowledgeRoot(path.join(FIXTURE, "knowledge"));
    _setIntakeRoot(path.join(FIXTURE, "intake-does-not-exist"));
});

describe("retrieve_v1 detail parameter", () => {
    it("default stays byte-identical with and without the options argument", () => {
        const bare = retrieve_v1(["ownership"], ["compile_router"], 5);
        const explicit = retrieve_v1(["ownership"], ["compile_router"], 5, { detail: "full" });
        expect(JSON.stringify(explicit)).toBe(JSON.stringify(bare));
    });

    it("index rows carry id/type/source/confidence/title/tokens_estimate and NO body", () => {
        const env = retrieve_v1(["ownership"], ["compile_router"], 5, { detail: "index" });
        const entries = env["entries"] as Array<Record<string, unknown>>;
        expect(entries.length).toBeGreaterThan(0);
        for (const e of entries) {
            const expected =
                e["type"] === "knowledge"
                    ? ["confidence", "id", "pinned", "source", "title", "tokens_estimate", "type"]
                    : ["confidence", "id", "source", "title", "tokens_estimate", "type"];
            expect(Object.keys(e).sort()).toEqual(expected);
            expect(e["body"]).toBeUndefined();
            expect(typeof e["title"]).toBe("string");
            expect((e["title"] as string).length).toBeGreaterThan(0);
            expect(typeof e["tokens_estimate"]).toBe("number");
            expect(e["tokens_estimate"] as number).toBeGreaterThan(0);
        }
    });

    it("index mode is materially smaller than full mode", () => {
        const full = JSON.stringify(retrieve_v1(["incident-learnings"], ["vitest"], 5));
        const index = JSON.stringify(
            retrieve_v1(["incident-learnings"], ["vitest"], 5, { detail: "index" }),
        );
        expect(index.length).toBeLessThan(full.length / 2);
    });

    it("envelope status/slices shape is unchanged in index mode", () => {
        const env = retrieve_v1(["ownership", "bogus-type"], ["x"], 5, { detail: "index" });
        expect(env["contract_version"]).toBe(1);
        expect(env["status"]).toBe("partial");
        const slices = env["slices"] as Record<string, Record<string, unknown>>;
        expect(slices["bogus-type"]?.["status"]).toBe("unknown_type");
    });
});

describe("knowledge index rows (Phase 4)", () => {
    it("carry the pinned flag", () => {
        const env = retrieve_v1(["knowledge"], ["schema v2"], 5, { detail: "index" });
        const entries = env["entries"] as Array<Record<string, unknown>>;
        expect(entries.length).toBeGreaterThan(0);
        const pinnedRow = entries.find((e) => String(e["id"]).startsWith("router-contract"));
        expect(pinnedRow?.["pinned"]).toBe(true);
    });
});

describe("memory_get_v1 — batch fetch", () => {
    it("fetches full bodies for known ids across types", () => {
        const env = memory_get_v1(["own-router-compiler", "il-vitest-recursion-143"]);
        expect(env["status"]).toBe("ok");
        const entries = env["entries"] as Array<Record<string, unknown>>;
        expect(entries.map((e) => e["id"])).toEqual([
            "own-router-compiler",
            "il-vitest-recursion-143",
        ]);
        for (const e of entries) {
            const body = e["body"] as Record<string, unknown>;
            expect(typeof body["body"]).toBe("string"); // the entry's prose field
        }
    });

    it("reports unknown ids per-id without failing the batch", () => {
        const env = memory_get_v1(["own-router-compiler", "no-such-id"]);
        expect(env["status"]).toBe("partial");
        const ids = env["ids"] as Record<string, string>;
        expect(ids["own-router-compiler"]).toBe("ok");
        expect(ids["no-such-id"]).toBe("unknown");
    });

    it("all-unknown batch yields status error", () => {
        const env = memory_get_v1(["nope-1", "nope-2"]);
        expect(env["status"]).toBe("error");
        expect((env["entries"] as unknown[]).length).toBe(0);
    });

    it("resolves knowledge-chunk ids (ingest-id:chunk-stem)", () => {
        const env = memory_get_v1(["install-contract:chunk-000"]);
        expect(env["status"]).toBe("ok");
        const e = (env["entries"] as Array<Record<string, unknown>>)[0]!;
        expect(e["type"]).toBe("knowledge");
        expect(String((e["body"] as Record<string, unknown>)["body"])).toContain("JSON pointer");
    });
});

describe("id stability", () => {
    it("index ids resolve through memory_get (lookup and fetch can never disagree)", () => {
        const index = retrieve_v1(
            ["historical-patterns", "knowledge"],
            ["TMPDIR", "workspaces"],
            10,
            { detail: "index" },
        );
        const ids = (index["entries"] as Array<Record<string, unknown>>).map((e) =>
            String(e["id"]),
        );
        expect(ids.length).toBeGreaterThan(0);
        const fetched = memory_get_v1(ids);
        expect(fetched["status"]).toBe("ok");
    });

    it("ids are stable across repeated runs on an unchanged tree", () => {
        const run = () =>
            (retrieve_v1(["ownership"], [], 20, { detail: "index" })["entries"] as Array<
                Record<string, unknown>
            >)
                .map((e) => e["id"])
                .sort();
        expect(run()).toEqual(run());
    });
});
