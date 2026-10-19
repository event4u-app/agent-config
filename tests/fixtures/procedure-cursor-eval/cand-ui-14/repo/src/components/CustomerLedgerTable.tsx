export interface LedgerEntry { date: string; description: string; amount: number }

export function CustomerLedgerTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <table className="ledger-table">
      <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>{entries.map((e, i) => <tr key={i}><td>{e.date}</td><td>{e.description}</td><td>{e.amount}</td></tr>)}</tbody>
    </table>
  );
}
