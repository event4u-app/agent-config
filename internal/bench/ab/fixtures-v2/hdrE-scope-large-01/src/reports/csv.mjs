import { padRight } from '../util/strings.mjs';

export function toCsv(rows) {
  return rows.map((r) => r.map((c) => padRight(c, 0)).join(',')).join('\n');
}
