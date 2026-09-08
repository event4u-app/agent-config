/**
 * Two string/path helpers extracted from `tools.ts`.
 *
 * They are generic — a whitespace trim and a tolerant realpath — and `tools.ts`
 * sits ~525 lines past the 1500-line ceiling `check_source_size_budget`
 * enforces as a shrink-only ratchet, so every line there costs one unit of
 * excess and the gate names re-pinning the baseline a defect rather than a fix.
 * Moving them here pays for the graph-tool registration that arrives with
 * `road-to-a-graph-that-is-shipped` 4.1, and puts them in a file where their
 * prose is free.
 *
 * They are imported under their original underscore-prefixed names, so the
 * 28 call sites in `tools.ts` are unchanged — a rename would have made a
 * two-function move read as a sweep.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Mirror Python `str.strip()` (also strips the same Unicode whitespace set we care about here). */
export function strip(s: string): string {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/** Mirror Python `Path(...).resolve()` — absolutize + realpath, tolerating a missing tail. */
export function resolvePath(p: string): string {
    try {
        return fs.realpathSync(p);
    } catch {
        return path.resolve(p);
    }
}
