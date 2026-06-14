export function formatReport(data) {
  return data.map((row) => `${row.name}: ${row.value}`).join('\n');
}
