// Public entry point. Re-exports the current API plus one deprecated alias.
export { parseConfig } from './config.js';
export { formatReport } from './report.js';

// DEPRECATED: legacy re-export kept only for the old `legacy/` consumers.
// Slated for removal once callers migrate to ./config.js#parseConfig.
export { parseConfigLegacy } from './legacy/parser.js';
