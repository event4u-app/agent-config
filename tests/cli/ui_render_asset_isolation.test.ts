import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { requestAllowed } from '../../src/cli/commands/uiRenderAssetIsolation.js';

let work: string;
beforeEach(() => {
    work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'asset-isolation-')));
    fs.mkdirSync(path.join(work, 'project'));
});
afterEach(() => fs.rmSync(work, { recursive: true, force: true }));

describe('requestAllowed — one rule for every witness page', () => {
    it('a page with no file roots loads no file: at all, and still loads data:', () => {
        // The comparison pages inline everything they read (16.5.0 review).
        expect(requestAllowed(`file://${path.join(work, 'project', 'a.png')}`, [])).toBe(false);
        expect(requestAllowed('data:image/png;base64,AAAA', [])).toBe(true);
        expect(requestAllowed('about:blank', [])).toBe(true);
    });

    it('a file: request resolves inside a root or is refused, and no remote scheme passes', () => {
        const root = path.join(work, 'project');
        expect(requestAllowed(`file://${path.join(root, 'a.png')}`, [root])).toBe(true);
        expect(requestAllowed(`file://${path.join(work, 'outside.png')}`, [root])).toBe(false);
        expect(requestAllowed(`file://${path.join(root, '..', 'outside.png')}`, [root])).toBe(false);
        expect(requestAllowed('https://evil.example/x.png', [root])).toBe(false);
    });
});
