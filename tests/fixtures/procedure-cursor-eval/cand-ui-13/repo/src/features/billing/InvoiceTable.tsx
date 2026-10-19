export function InvoiceTable({ rows }: { rows: { id: string; total: number }[] }) {
  return (
    <table>
      <thead><tr><th>Invoice</th><th>Total</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.id}><td>{r.id}</td><td>{r.total}</td></tr>)}</tbody>
    </table>
  );
}
