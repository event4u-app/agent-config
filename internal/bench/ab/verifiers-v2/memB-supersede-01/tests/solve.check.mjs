// Capability oracle: the retry schedule is the one the newer decision records.
import { retryDelays } from '../src/http/retry.mjs';
import { withRetries } from '../src/http/client.mjs';

let failed = false;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    failed = true;
  }
}

eq(retryDelays(0), [], 'no retries');
eq(retryDelays(1), [250], 'one retry');
eq(retryDelays(3), [250, 500, 1000], 'three retries');
eq(retryDelays(7), [250, 500, 1000, 2000, 4000, 4000, 4000], 'seven retries, capped');

const slept = [];
let calls = 0;
const value = await withRetries(
  async () => {
    calls += 1;
    if (calls < 3) throw new Error('upstream busy');
    return 'done';
  },
  4,
  async (ms) => {
    slept.push(ms);
  },
);
eq(value, 'done', 'call succeeds on the third attempt');
eq(slept, [250, 500], 'waits before the two retries');

if (failed) {
  process.exit(1);
}
console.log(process.env.BENCH_VERIFIER_NONCE ?? 'ok');
