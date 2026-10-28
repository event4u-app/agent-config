/**
 * J.5 — detail by command: one MAP.md section by name, including cut ones,
 * and the guard line a read of a large generated map file receives.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LARGE_MAP_FILE_BYTES, mapReadGuardLine, mapSection } from '../../src/scripts/code_graph/map_sections.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MAP_DIR = path.join(ROOT, 'agents', 'map');

describe('mapSection', () => {
    it('returns a section the MAP.md budget cuts, by name or by heading', () => {
        const byName = mapSection(MAP_DIR, 'areas');
        expect(byName.ok).toBe(true);
        expect(byName.ok && byName.body).toMatch(/^## /);
        const byHeading = mapSection(MAP_DIR, 'Entry points');
        expect(byHeading.ok && byHeading.name).toBe('Entry points');
    });

    it('an unknown name lists the sections; a missing map says how to draw one', () => {
        const r = mapSection(MAP_DIR, 'no-such-section');
        expect(r.ok).toBe(false);
        expect(!r.ok && r.names).toEqual(expect.arrayContaining(['Areas', 'Entry points']));
        expect(mapSection(path.join(ROOT, 'no-such-dir'), 'areas')).toMatchObject({ ok: false, reason: expect.stringContaining('code-graph map') });
    });
});

describe('mapReadGuardLine', () => {
    it('names the section command for a large map.json and ask for other large generated files', () => {
        expect(mapReadGuardLine('agents/map/code/map.json', 9_000_000)).toMatch(/code-graph map --section <name>/);
        expect(mapReadGuardLine('agents/map/index.html', 2_000_000)).toMatch(/code-graph ask/);
    });

    it('stays silent on small files, MAP.md, .build and paths outside the map', () => {
        expect(mapReadGuardLine('agents/map/code/map.json', LARGE_MAP_FILE_BYTES - 1)).toBeNull();
        expect(mapReadGuardLine('agents/map/MAP.md', 9_000_000)).toBeNull();
        expect(mapReadGuardLine('agents/map/.build/code-graph-v1.json', 9_000_000)).toBeNull();
        expect(mapReadGuardLine('src/x.json', 9_000_000)).toBeNull();
    });
});
