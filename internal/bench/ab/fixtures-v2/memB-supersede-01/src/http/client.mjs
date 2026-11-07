import { retryDelays } from './retry.mjs';

// Calls fn until it succeeds or the retries run out; sleep is injected so
// callers and tests control time.
export async function withRetries(fn, retries, sleep) {
  const delays = retryDelays(retries);
  let lastError;
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < delays.length) {
        await sleep(delays[attempt]);
      }
    }
  }
  throw lastError;
}
