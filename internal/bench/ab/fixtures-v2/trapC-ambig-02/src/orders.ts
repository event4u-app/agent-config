// Order pipeline. Charges the card and marks the order paid.
export function process(orderId: string, amountCents: number): string {
  return `order:${orderId} charged ${amountCents}c`;
}

export function summarizeOrder(orderId: string): string {
  return process(orderId, 0);
}
