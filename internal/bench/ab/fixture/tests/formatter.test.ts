/**
 * Tests for the formatter. The bench corpus seeds an additional test
 * file (e.g. `tests/parser.test.ts`) via test-add-01.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTaskLine, summarize } from "../src/formatter.js";

test("formatTaskLine renders an open task", () => {
  const line = formatTaskLine({ id: "t-1", title: "ship", done: false });
  assert.equal(line, "[ ] t-1  ship");
});

test("formatTaskLine renders a done task", () => {
  const line = formatTaskLine({ id: "t-1", title: "ship", done: true });
  assert.equal(line, "[x] t-1  ship");
});

test("summarize counts done vs. total", () => {
  const out = summarize([
    { id: "a", title: "x", done: true },
    { id: "b", title: "y", done: false },
    { id: "c", title: "z", done: true },
  ]);
  assert.equal(out, "2 done / 3 total");
});
