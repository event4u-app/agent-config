export function OrderRow({ order }) {
  return (
    <tr className="border-b border-slate-200">
      <td className="px-3 py-2 font-mono text-sm">{order.id}</td>
      <td className="px-3 py-2">{order.customer}</td>
      <td className="px-3 py-2 text-right tabular-nums">{order.total}</td>
    </tr>
  );
}
