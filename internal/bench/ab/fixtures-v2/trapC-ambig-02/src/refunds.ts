// Refund pipeline. Reverses a charge and credits the customer.
// NOTE: this function is ALSO named `process` — a second, unrelated `process`.
export function process(refundId: string, amountCents: number): string {
  return `refund:${refundId} credited ${amountCents}c`;
}

export function summarizeRefund(refundId: string): string {
  return process(refundId, 0);
}
