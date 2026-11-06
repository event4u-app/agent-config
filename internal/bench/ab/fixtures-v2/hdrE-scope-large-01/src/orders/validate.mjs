export function validateOrder(order) {
  if (!order || !Array.isArray(order.lines) || order.lines.length === 0) {
    throw new Error('order must have at least one line');
  }
  for (const l of order.lines) {
    if (!Number.isInteger(l.unitCents) || l.unitCents < 0) throw new Error('bad unitCents');
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new Error('bad qty');
  }
  return true;
}
