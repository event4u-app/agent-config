import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { scan } from '../../src/scripts/check_static_layer_stability.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'static-layer-'));
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('check_static_layer_stability (Phase 2.2 hygiene lint)', () => {
    it('is green on the real non-kernel always-loaded layer', () => {
        const r = scan({});
        expect(r.scanned).toBeGreaterThan(50);
        expect(r.findings).toEqual([]);
    });

    it('is RED on a fixture carrying a home path and a uuid; kernel files and allow-marked lines are skipped', () => {
        const rulesDir = path.join(tmp, 'rules');
        fs.mkdirSync(rulesDir, { recursive: true });
        fs.writeFileSync(path.join(rulesDir, 'clean.md'), '# fine\nA date like 2026-08-10 stays allowed.\n');
        fs.writeFileSync(
            path.join(rulesDir, 'poisoned.md'),
            '# bad\nSee /Users/someuser/project/file.ts for detail.\nSession 123e4567-e89b-42d3-a456-426614174000 recorded.\n',
        );
        fs.writeFileSync(
            path.join(rulesDir, 'kernel-poisoned.md'),
            'kernel file with /Users/someuser/thing/ inside — guarded elsewhere\n',
        );
        fs.writeFileSync(
            path.join(rulesDir, 'allowed.md'),
            'example path /Users/example/home/ <!-- static-layer-allow: doc example -->\n',
        );
        const routerPath = path.join(tmp, 'router.json');
        fs.writeFileSync(routerPath, JSON.stringify({ kernel: ['kernel-poisoned'] }));

        const r = scan({ rulesDir, routerPath });
        expect(r.scanned).toBe(3); // kernel file excluded
        expect(r.findings.map((f) => `${f.file}:${f.kind}`).sort()).toEqual([
            'poisoned.md:home-path',
            'poisoned.md:uuid',
        ]);
    });
});
