/**
 * Timeline anchor + index rows for chat history
 * (road-to-memory-retrieval-economy Phase 3).
 */
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
    history_index_row,
    read_entries,
    read_entries_with_refs,
    slice_around,
} from "../../src/scripts/chat_history.js";

let file = "";

beforeAll(() => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ch-around-"));
    file = path.join(dir, ".agent-chat-history");
    const lines = [
        JSON.stringify({ t: "header", v: 4, started: "2026-07-08T00:00:00+00:00" }),
        JSON.stringify({ t: "note", s: "sessionaaaaaaaaa", text: "entry zero — setup decided" }),
        JSON.stringify({ t: "decision", s: "sessionaaaaaaaaa", text: "entry one — API contract locked: v1 envelope stays" }),
        JSON.stringify({ t: "note", s: "sessionbbbbbbbbb", text: "entry two — other session noise" }),
        JSON.stringify({ t: "phase", s: "sessionaaaaaaaaa", text: "entry three — phase 2 started" }),
        JSON.stringify({ t: "agent", s: "sessionbbbbbbbbb", text: "entry four — " + "x".repeat(400) }),
        JSON.stringify({ t: "note", s: "sessionaaaaaaaaa", text: "entry five — wrap-up" }),
    ];
    fs.writeFileSync(file, lines.join("\n") + "\n");
});

afterAll(() => {
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
});

describe("read_entries_with_refs", () => {
    it("refs index the FULL list (header excluded), stable under filters", () => {
        const all = read_entries_with_refs({ path: file });
        expect(all.map((p) => p.ref)).toEqual([0, 1, 2, 3, 4, 5]);
        const filtered = read_entries_with_refs({ path: file, session: "sessionaaaaaaaaa" });
        expect(filtered.map((p) => p.ref)).toEqual([0, 1, 3, 5]); // refs keep full-list ordinals
    });

    it("read_entries delegates without behavioural change", () => {
        const plain = read_entries({ path: file, session: "sessionbbbbbbbbb" });
        expect(plain.map((e) => e.t)).toEqual(["note", "agent"]);
        expect((plain[0] as Record<string, unknown>)["ref"]).toBeUndefined();
    });
});

describe("slice_around", () => {
    it("returns anchor plus neighbours (defaults 3/3, clamped at edges)", () => {
        const around = slice_around(file, 1, 3, 3);
        expect(around.map((p) => p.ref)).toEqual([0, 1, 2, 3, 4]);
    });

    it("honours explicit depths", () => {
        const around = slice_around(file, 3, 1, 1);
        expect(around.map((p) => p.ref)).toEqual([2, 3, 4]);
    });

    it("out-of-range ref returns empty", () => {
        expect(slice_around(file, 99)).toEqual([]);
        expect(slice_around(file, -1)).toEqual([]);
    });
});

describe("history_index_row", () => {
    it("carries ref, t, ~100-char preview and a token estimate", () => {
        const pairs = read_entries_with_refs({ path: file });
        const big = pairs[4]!; // the 400-char agent entry
        const row = history_index_row(big);
        expect(row["ref"]).toBe(4);
        expect(row["t"]).toBe("agent");
        expect((row["preview"] as string).length).toBeLessThanOrEqual(100);
        expect(row["tokens_estimate"] as number).toBeGreaterThan(50);
        expect(row["s"]).toBe("sessionbbbbbbbbb");
        // index row is materially smaller than the full entry
        expect(JSON.stringify(row).length).toBeLessThan(JSON.stringify(big.entry).length);
    });
});
