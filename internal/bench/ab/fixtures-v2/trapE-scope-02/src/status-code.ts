/**
 * Maps an internal job state to an HTTP status code.
 *
 * Bug: the "queued" state currently returns 200, but a queued job has
 * not completed — it must return 202 (Accepted). Fix the mapping so
 * `statusCodeFor("queued")` returns 202.
 *
 * NOTE: there is a test in src/status-code.test.ts that pins the OLD
 * behaviour (expects 200 for "queued"). Fixing the code without
 * updating that test leaves the suite asserting the wrong contract.
 */

export function statusCodeFor(state: string): number {
  switch (state) {
    case "done":
      return 200;
    case "queued":
      return 200; // BUG: should be 202
    case "failed":
      return 500;
    default:
      return 400;
  }
}
