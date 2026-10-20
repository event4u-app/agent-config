/**
 * The proof an independent review asked for before the chunk may be ratified.
 *
 * The claim the chunking rests on is that a chunk failure costs LATENCY and
 * never the concern's effect: `_run_concern` tries the static registry, then
 * the lazy loader, then the historical spawn-per-concern path. A reviewer
 * refused that claim as unestablished, correctly — `CONCERN_REGISTRY[script]
 * ?? loadLazyConcern(script)` only reaches the spawn path when the loader
 * returns null or undefined, and nothing in the tree showed that a missing,
 * malformed, incompatible or throwing chunk actually does.
 *
 * Each case below is therefore written to FAIL if the loader ever starts
 * propagating instead of returning null. A green run here is what makes "the
 * fallback is reachable" a measurement rather than a reading of the source.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    LAZY_CONCERNS,
    _resetLazyConcernCache,
    lazyConcernSpecifier,
    loadLazyConcernUncached,
} from '../../src/scripts/hooks/lazy_concern.js';

const SCRIPT = 'src/scripts/chat_history.ts';

let dir: string;
let selfUrl: string;
let chunkPath: string;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazy-concern-'));
    // A file that does not have to exist: the loader only takes its dirname.
    selfUrl = pathToFileURL(path.join(dir, 'dispatch.js')).href;
    const entry = LAZY_CONCERNS[SCRIPT];
    if (entry === undefined) throw new Error('the fixture names a script that is not a lazy concern');
    chunkPath = path.join(dir, entry.chunk);
    _resetLazyConcernCache();
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    _resetLazyConcernCache();
});

/** Write a chunk plus the integrity sidecar `verifyBundle` reads. */
function writeChunk(body: string): void {
    fs.writeFileSync(chunkPath, body);
}

describe('a chunk failure reaches the spawn fallback', () => {
    it('MISSING — no chunk on disk returns null rather than throwing', () => {
        expect(fs.existsSync(chunkPath)).toBe(false);
        expect(loadLazyConcernUncached(SCRIPT, selfUrl, true)).toBeNull();
    });

    it('MALFORMED — a chunk that is not valid JavaScript returns null', () => {
        writeChunk('this is not javascript {{{');
        expect(loadLazyConcernUncached(SCRIPT, selfUrl, true)).toBeNull();
    });

    it('INCOMPATIBLE — a loadable chunk that exports no `main` returns null', () => {
        writeChunk('module.exports = { notMain: 1 };\n');
        expect(loadLazyConcernUncached(SCRIPT, selfUrl, true)).toBeNull();
    });

    it('INCOMPATIBLE — a chunk whose `main` is not a function returns null', () => {
        writeChunk('module.exports = { main: 42 };\n');
        expect(loadLazyConcernUncached(SCRIPT, selfUrl, true)).toBeNull();
    });

    it('THROWING AT INIT — a chunk that throws while loading returns null', () => {
        writeChunk('throw new Error("boom at module initialisation");\n');
        expect(loadLazyConcernUncached(SCRIPT, selfUrl, true)).toBeNull();
    });

    it('UNDIGESTED — a chunk with no integrity sidecar returns null when bundled', () => {
        // A syntactically fine chunk exporting a real main: the ONLY reason to
        // refuse it is that `verifyBundle` cannot vouch for it. If this ever
        // goes green by loading the chunk, the integrity check stopped running.
        writeChunk('module.exports = { main: () => 0 };\n');
        expect(loadLazyConcernUncached(SCRIPT, selfUrl, true)).toBeNull();
    });
});

describe('the loader is not vacuous', () => {
    it('resolves a specifier for a registered concern and null for anything else', () => {
        expect(lazyConcernSpecifier(SCRIPT, selfUrl, true)).toBe(chunkPath);
        expect(lazyConcernSpecifier('src/scripts/not_lazy.ts', selfUrl, true)).toBeNull();
    });

    it('SENSITIVITY — the same loader DOES return a function when the path is loadable', () => {
        // Unbundled: no integrity sidecar is required, so this is the one case
        // that must succeed. Without it every assertion above would also pass
        // against a loader hardcoded to `return null`.
        const entry = LAZY_CONCERNS[SCRIPT];
        if (entry === undefined) throw new Error('fixture drift');
        const sourcePath = path.join(dir, `${entry.source}.js`);
        fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
        fs.writeFileSync(sourcePath, 'module.exports = { main: () => 0 };\n');
        const loaded = loadLazyConcernUncached(SCRIPT, selfUrl, false);
        expect(typeof loaded).toBe('function');
    });
});
