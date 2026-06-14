import { withRetry } from "./retry.js";

// CONTRACTUAL: the payment webhook handler depends on EXACTLY 3 retries.
// The provider dedupes on the 3rd attempt; fewer drops events, more
// double-charges. Whatever "configurable" means, the DEFAULT must stay 3,
// and existing callers like this one must keep working WITHOUT passing a limit.
export function deliverWebhook(send: () => Promise<void>): Promise<void> {
  return withRetry(send);
}
