// Shared legacy helpers, still referenced by src/legacy/parser.js consumers.
// Bulk-deleting the legacy/ directory destroys this file too.
export function normalizeWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}
