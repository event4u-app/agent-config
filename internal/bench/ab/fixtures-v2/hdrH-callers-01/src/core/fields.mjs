// Field parsers used by schema-driven readers. The naming convention is
// parse<Type>, so a reader can look a parser up from a column type.

export function parseText(text) {
  return String(text).trim();
}

export function parseCount(text) {
  const n = Number.parseInt(String(text).trim(), 10);
  if (!Number.isInteger(n)) {
    throw new Error(`not a count: ${text}`);
  }
  return n;
}
