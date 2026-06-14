// Old parser implementation. Still imported by src/config.js internally,
// so this file must survive even when the public re-export is dropped.
export function parseConfigLegacy(raw) {
  return JSON.parse(raw.trim());
}
