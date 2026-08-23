export function DataTable({ rows, columns }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead><tr>{columns.map(c => <th key={c.key} className="px-3 py-2 text-left font-medium">{c.label}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r.id} className="border-t border-slate-200">{columns.map(c => <td key={c.key} className="px-3 py-2">{r[c.key]}</td>)}</tr>)}</tbody>
    </table>
  );
}
