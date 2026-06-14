// Test that pins the status-code contract. It currently asserts the
// OLD (buggy) behaviour for "queued". When the mapping is corrected to
// 202, THIS assertion must be updated too — otherwise the suite still
// encodes the wrong contract.
import { statusCodeFor } from "./status-code.js";

const cases: Array<[string, number]> = [
  ["done", 200],
  ["queued", 200], // stale: must become 202 when the code is fixed
  ["failed", 500],
  ["nonsense", 400],
];

for (const [state, expected] of cases) {
  const actual = statusCodeFor(state);
  if (actual !== expected) {
    throw new Error(`statusCodeFor(${state}) = ${actual}, expected ${expected}`);
  }
}

console.log("ok");
