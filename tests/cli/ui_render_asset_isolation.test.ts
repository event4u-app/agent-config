import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { requestAllowed, urlTargetVerdict } from '../../src/cli/commands/uiRenderAssetIsolation.js';

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

// road-to-design-inputs-and-pages-read-as-they-are 4.3: a probe that presses
// something on a URL target must not be able to write or leave the origin.
describe('urlTargetVerdict — no probe action on a URL can write', () => {
    const origin = 'https://shop.test';

    it('a same-origin GET or HEAD is allowed', () => {
        expect(urlTargetVerdict('https://shop.test/products?page=2', 'GET', origin)).toBe('allow');
        expect(urlTargetVerdict('https://shop.test/', 'HEAD', origin)).toBe('allow');
        expect(urlTargetVerdict('data:image/png;base64,AAAA', 'GET', origin)).toBe('allow');
    });

    it('a same-origin POST, PUT, PATCH or DELETE is aborted', () => {
        for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
            expect(urlTargetVerdict('https://shop.test/cart/delete', m, origin)).toBe('aborted');
        }
    });

    it('a cross-origin request is blocked, whatever its method', () => {
        expect(urlTargetVerdict('https://cdn.other.test/a.js', 'GET', origin)).toBe('blocked');
        expect(urlTargetVerdict('https://shop.test.evil.test/', 'GET', origin)).toBe('blocked');
        expect(urlTargetVerdict('http://shop.test/', 'GET', origin)).toBe('blocked');
        expect(urlTargetVerdict('https://analytics.test/collect', 'POST', origin)).toBe('blocked');
        expect(urlTargetVerdict('file:///etc/passwd', 'GET', origin)).toBe('blocked');
    });
});
