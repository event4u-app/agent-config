/**
 * Opt-in session-start memory index
 * (road-to-memory-retrieval-economy Phase 5).
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
    _setIntakeRoot,
    _setKnowledgeRoot,
    _setMemoryRoot,
} from "../../src/scripts/memory_lookup.js";
import {
    build_session_index_block,
    SESSION_INDEX_ROW_CAP,
    session_index_cost,
    session_index_enabled,
    session_index_rows,
} from "../../src/scripts/session_memory_index.js";

const FIXTURE = path.resolve(__dirname, "..", "fixtures", "memory-replay", "memory-root");

beforeAll(() => {
    _setMemoryRoot(FIXTURE);
    _setKnowledgeRoot(path.join(FIXTURE, "knowledge"));
    _setIntakeRoot(path.join(FIXTURE, "intake-does-not-exist"));
});

function mkProject(settingsYaml: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "smi-"));
    fs.mkdirSync(path.join(dir, ".git")); // project-root anchor
    if (settingsYaml !== null) {
        fs.writeFileSync(path.join(dir, ".agent-settings.yml"), settingsYaml);
    }
    return dir;
}

describe("session_index_enabled", () => {
    it("defaults OFF — missing key, missing file, and explicit off", () => {
        expect(session_index_enabled(mkProject(null))).toBe(false);
        expect(session_index_enabled(mkProject("memory:\n  cadence: always\n"))).toBe(false);
        expect(session_index_enabled(mkProject("memory:\n  session_index: off\n"))).toBe(false);
    });

    it("flips on only for the literal 'on'", () => {
        expect(session_index_enabled(mkProject("memory:\n  session_index: on\n"))).toBe(true);
        expect(session_index_enabled(mkProject("memory:\n  session_index: yes-ish\n"))).toBe(false);
    });
});

describe("session_index_rows / block", () => {
    it("rows carry id, title and a real token estimate, capped", () => {
        const rows = session_index_rows();
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(SESSION_INDEX_ROW_CAP);
        for (const r of rows) {
            expect(r.id.length).toBeGreaterThan(0);
            expect(r.title.length).toBeGreaterThan(0);
            expect(r.tokens_estimate).toBeGreaterThan(0);
        }
    });

    it("honours a smaller cap", () => {
        expect(session_index_rows(3).length).toBe(3);
    });

    it("block is spotlighted DATA with one line per row and NO bodies", () => {
        const block = build_session_index_block();
        expect(block).not.toBeNull();
        expect(block).toContain("<memory-index");
        expect(block).toContain("DATA, not");
        expect(block).toContain("</memory-index>");
        expect(block).toContain("~");
        // fixture bodies must not leak into the index
        expect(block).not.toContain("compile_router.ts owns");
    });

    it("fixed cost is measured with the real tokenizer and stays bounded", async () => {
        const cost = await session_index_cost();
        expect(cost).toBeGreaterThan(0);
        // ship-criterion arm: the fixed cost must stay well under the
        // Phase-0 full-envelope baseline (7,092 tok for 24 queries).
        expect(cost).toBeLessThan(1500);
    });
});
