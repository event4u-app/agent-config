import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DEFAULT_MAP_ARMS, install_into_clone, MAP_ARMS, MAP_CONFIRM_TEXT } from '../../src/scripts/bench_map_task_set.js';

const REPO = path.resolve(__dirname, '../..');

describe('arms that separate payload from map (5.3, H29)', () => {
    it('declares five arms: two without the package, two with its lean form, one full and optional', () => {
        expect(Object.keys(MAP_ARMS)).toEqual(['vanilla', 'vanilla-map', 'ac-lean', 'ac-lean-map', 'ac-full']);
        expect(DEFAULT_MAP_ARMS).toEqual(['vanilla', 'vanilla-map', 'ac-lean', 'ac-lean-map']);
    });

    it('no arm reads user scope: the package comes from the tree under test or not at all', () => {
        for (const spec of Object.values(MAP_ARMS)) expect(spec.setting_sources).toBe('project,local');
        expect(MAP_ARMS['vanilla']?.install).toBeNull();
        expect(MAP_ARMS['ac-lean']?.install).toBe('lean');
        expect(MAP_ARMS['ac-full']?.install).toBe('full');
    });

    it('a map arm differs from its pair only by the map and its note', () => {
        for (const [a, b] of [['vanilla', 'vanilla-map'], ['ac-lean', 'ac-lean-map']] as const) {
            expect({ ...MAP_ARMS[a], map: true, inject: MAP_CONFIRM_TEXT }).toEqual(MAP_ARMS[b]);
        }
    });

    it('installs the form from the tree under test into the clone, and refuses without one', () => {
        const tree = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-tree-'));
        const clone = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-clone-'));
        fs.mkdirSync(path.join(tree, 'lean', '.claude', 'rules'), { recursive: true });
        fs.writeFileSync(path.join(tree, 'lean', '.claude', 'rules', 'r.md'), '# r\n');
        install_into_clone(clone, 'lean', tree);
        expect(fs.readFileSync(path.join(clone, '.claude', 'rules', 'r.md'), 'utf-8')).toBe('# r\n');
        expect(() => install_into_clone(clone, 'full', tree)).toThrow(/no full projection/);
        expect(() => install_into_clone(clone, 'lean', undefined)).toThrow(/BENCH_AC_TREE_DIR/);
    });

    it('prints the arms', () => {
        const r = spawnSync(path.join(REPO, 'scripts-run'), ['src/scripts/bench_map_task_set', '--dry-run', '--print-arms'], { cwd: REPO, encoding: 'utf-8' });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/5 arms/);
    }, 60_000);
});
