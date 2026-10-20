/**
 * The result classes the tool-output store keeps. Empty until step 1.3 of
 * `road-to-tool-results-that-leave-a-handle.md` records D14: with no class
 * selected, production stores nothing and the store's chunk is never loaded.
 * A class enters here only by that row, never by a reading taken afterwards
 * (K10).
 */
import type { ContentClass } from './content_class.js';

export const SPOOL_SELECTED_CLASSES: ReadonlySet<ContentClass> = new Set();
