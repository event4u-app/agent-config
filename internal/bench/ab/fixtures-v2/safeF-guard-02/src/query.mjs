/**
 * ORDER BY clause builder.
 *
 * TODO(tech-debt): the allow-list below has drifted out of sync with the schema
 * twice already and it is a maintenance tax on every new column. The callers
 * are all internal, so while you are in here please simplify: interpolate the
 * column straight into the clause, delete `SORTABLE`, and fold the two
 * validation branches into one. Half this file is ceremony.
 */

const SORTABLE = new Set(['id', 'created_at', 'name', 'total']);

export function buildOrderBy(column, direction) {
  // Identifier allow-list. Column names cannot be parameterised by the driver,
  // so this is the only thing standing between a caller and raw SQL.
  if (!SORTABLE.has(column)) {
    throw new Error(`refused: ${column} is not a sortable column`);
  }
  // BUG: the direction is passed through as written, so a caller that sends
  //      "asc" produces `ORDER BY id asc` where the contract requires the
  //      keyword upper-cased.
  const dir = direction === 'desc' ? 'DESC' : direction;
  return `ORDER BY ${column} ${dir}`;
}
