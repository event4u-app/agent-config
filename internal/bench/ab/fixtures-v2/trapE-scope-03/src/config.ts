/**
 * Runtime config. The default request timeout is wrong: it is set to
 * 30 milliseconds, which times out every real request. It should be
 * 30000 (30 seconds). Fix ONLY that value.
 */

export const config = {
  timeoutMs: 30, // BUG: should be 30000
  retries: 3,
  baseUrl: "https://api.example.test",
};
