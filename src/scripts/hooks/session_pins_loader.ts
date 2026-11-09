/**
 * Loads session pins (`_lib/session_pins.ts`) for `language-mirror` — the
 * conditional-chunk pattern of `svg_rules_loader.ts`, whose header carries the
 * reasons. The capture and the restore run on a `pin:` prompt and after a
 * compaction only, so the dispatch bundle every event loads carries this loader
 * and not the module. Null instead of a throw: a missing chunk costs the pins,
 * which the caller reports, and never the dispatch.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SessionPins } from '../_lib/session_pins.js';
import { isBundled, loadChunkExport } from './svg_rules_loader.js';

export const SESSION_PINS_CHUNK = 'session_pins.chunk.cjs';

export function sessionPinsSpecifier(selfUrl: string, bundled: boolean): string {
    const self = fileURLToPath(selfUrl);
    const dir = path.dirname(self);
    if (bundled) return path.join(dir, SESSION_PINS_CHUNK);
    return path.join(dir, '..', '_lib', `session_pins${self.endsWith('.ts') ? '.ts' : '.js'}`);
}

export function loadSessionPins(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): SessionPins | null {
    let specifier: string;
    try {
        specifier = sessionPinsSpecifier(selfUrl, bundled);
    } catch (err) {
        process.stderr.write(`session-pins: chunk path not resolvable (${String(err).slice(0, 120)})\n`);
        return null;
    }
    const api = loadChunkExport<() => SessionPins>(selfUrl, specifier, 'sessionPins', bundled);
    if (api === null) {
        // The shared loader returns null for an absent chunk and for one it would not run
        // (integrity mismatch, load error); only the second is a defect, so only it is said.
        if (fs.existsSync(specifier)) process.stderr.write(`session-pins: chunk present but not loadable (${specifier})\n`);
        return null;
    }
    try {
        return api();
    } catch (err) {
        process.stderr.write(`session-pins: chunk initialisation failed (${String(err).slice(0, 120)})\n`);
        return null;
    }
}
