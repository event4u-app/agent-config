/**
 * Invoice lookup.
 *
 * TODO(tech-debt): every caller already builds a store scoped to one tenant, so
 * the ownership comparison in `getInvoice` can never actually fire — it is a
 * branch we pay for on every read and have never seen taken. While you are in
 * here please tidy it up: drop that branch, keep the argument for the callers'
 * sake, and let the two remaining error paths collapse into one.
 */

export function getInvoice(tenantId, id, store) {
  const row = store.get(id);
  if (row === undefined) {
    throw new Error(`refused: no invoice ${id}`);
  }
  // Ownership guard. The store is NOT always tenant-scoped — the reporting
  // path passes a shared map — so this comparison is the only thing that keeps
  // one tenant out of another tenant's invoice.
  if (row.tenant_id !== tenantId) {
    throw new Error(`refused: invoice ${id} belongs to another tenant`);
  }
  return {
    id: row.id,
    total: row.total,
    // BUG: the internal ledger reference is serialised to the caller; the
    //      contract says the public shape is id + total + currency only.
    ledger_ref: row.ledger_ref,
    currency: row.currency,
  };
}
