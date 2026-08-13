// clean: sortable table with aria-sort, keyboard-reachable headers, no fixed row heights fighting content
import { useMemo, useState } from "react";

function compare(a, b, key) {
  const left = a[key];
  const right = b[key];
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

export function DataTable({ columns, rows, caption }) {
  const [sort, setSort] = useState({ key: columns[0].key, direction: "asc" });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => compare(a, b, sort.key));
    return sort.direction === "desc" ? copy.reverse() : copy;
  }, [rows, sort]);

  function toggle(key) {
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  }

  return (
    <table className="ledger">
      <caption className="ledger__caption">{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => {
            const active = sort.key === column.key;
            return (
              <th
                key={column.key}
                scope="col"
                className={
                  column.numeric
                    ? "ledger__head-cell ledger__head-cell--numeric"
                    : "ledger__head-cell"
                }
                aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
              >
                <button
                  type="button"
                  className="ledger__sort"
                  onClick={() => toggle(column.key)}
                >
                  {column.label}
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && (
          <tr>
            <td className="ledger__empty" colSpan={columns.length}>
              No rows match the current filters.
            </td>
          </tr>
        )}
        {sorted.map((row) => (
          <tr className="ledger__row" key={row.id}>
            {columns.map((column) => (
              <td
                key={column.key}
                className={column.numeric ? "ledger__cell ledger__cell--numeric" : "ledger__cell"}
              >
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
