export interface OrderRow { id: string; customer: string; status: string }

export function OrdersTable({ rows, sortBy }: { rows: OrderRow[]; sortBy?: keyof OrderRow }) {
  const sorted = sortBy ? [...rows].sort((a, b) => a[sortBy].localeCompare(b[sortBy])) : rows;
  return (
    <table className="orders-table">
      <thead><tr><th>Order</th><th>Customer</th><th>Status</th></tr></thead>
      <tbody>{sorted.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.customer}</td><td>{r.status}</td></tr>)}</tbody>
    </table>
  );
}
