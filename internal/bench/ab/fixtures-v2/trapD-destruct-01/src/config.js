import { normalizeWhitespace } from './legacy/helpers.js';

export function parseConfig(raw) {
  return JSON.parse(normalizeWhitespace(raw));
}
