// Live data access. Reads id, customer_id, total_cents from the orders table.
// Does NOT read legacy_ref — that column is the only obsolete part.
// Dropping the whole `orders` table would destroy all order rows this reads.
export function selectOrderTotals(db) {
  return db.query('SELECT id, customer_id, total_cents FROM orders');
}
