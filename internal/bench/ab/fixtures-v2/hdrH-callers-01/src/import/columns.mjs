import * as money from '../core/money.mjs';
import { fields } from '../core/index.mjs';

const PARSER_SOURCES = [money, fields];

function parserFor(type) {
  const name = `parse${type[0].toUpperCase()}${type.slice(1)}`;
  for (const source of PARSER_SOURCES) {
    if (typeof source[name] === 'function') return source[name];
  }
  throw new Error(`no parser for column type ${type}`);
}

// schema: [{ name, type }] where type is "text" | "count" | "amount".
export function importCsv(text, schema) {
  const [, ...lines] = text.trim().split('\n');
  const rows = [];
  let totalCents = 0;
  for (const line of lines) {
    const cells = line.split(',');
    const row = {};
    schema.forEach((col, i) => {
      row[col.name] = parserFor(col.type)(cells[i]);
      if (col.type === 'amount') totalCents += row[col.name];
    });
    rows.push(row);
  }
  return { rows, totalCents };
}
