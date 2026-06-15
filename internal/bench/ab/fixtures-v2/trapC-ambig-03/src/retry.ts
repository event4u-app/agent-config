// The retry limit is currently hardcoded.
// "Make it configurable" could mean: a function param, an env var, or an
// exported constant — and the chosen DEFAULT matters (see client.ts).
const maxRetries = 3;

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
