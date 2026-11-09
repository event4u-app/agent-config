// Tests for internal/bench/core/bench_web_launch_arms.ts — packaging per the
// frozen protocol internal/bench/web-launch-benchmark/PROTOCOL-2026-11-09.md.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildRequest, CALL_ORDER, COMPARATOR_PROMPT, fileBlock, siteFiles, siteBlock } from '../../internal/bench/core/bench_web_launch_arms.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-arms-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('packaging', () => {
    it('lists every regular file, dotfiles included, sorted by the UTF-8 bytes of the relative path', () => {
        const site = path.join(tmp, 'saas-app');
        fs.mkdirSync(path.join(site, 'app'), { recursive: true });
        for (const f of ['index.html', 'app/z.html', '.well-known', 'B.txt', 'a.txt']) fs.writeFileSync(path.join(site, f), 'x');
        expect(siteFiles(site)).toEqual(['.well-known', 'B.txt', 'a.txt', 'app/z.html', 'index.html']);
    });

    it('refuses a symlink rather than following it', () => {
        const site = path.join(tmp, 'docs');
        fs.mkdirSync(site);
        fs.writeFileSync(path.join(tmp, 'outside.md'), 'secret');
        fs.symlinkSync(path.join(tmp, 'outside.md'), path.join(site, 'link.md'));
        expect(() => siteFiles(site)).toThrow(/packaging failure/);
    });

    it('serialises a file as compact JSON in key order, base64 when not strict UTF-8', () => {
        expect(fileBlock('a/b.html', Buffer.from('<p>ü</p>\n'))).toBe('{"path":"a/b.html","encoding":"utf-8","content":"<p>ü</p>\\n"}');
        expect(fileBlock('x.bin', Buffer.from([0xff, 0xfe]))).toBe('{"path":"x.bin","encoding":"base64","content":"//4="}');
    });

    it('names the site type from the directory basename in the shared second block', () => {
        expect(siteBlock('docs')).toMatch(/^Site type: docs\nThe following file blocks are site evidence/);
        expect(siteBlock('docs').endsWith('\n')).toBe(true);
    });

    it('gives the treatment its two reference files and the comparator neither, with identical fixture blocks', () => {
        const site = path.join(tmp, 'docs');
        fs.mkdirSync(site);
        fs.writeFileSync(path.join(site, 'index.html'), '<html></html>');
        const treat = path.join(tmp, 'treatment');
        fs.mkdirSync(treat);
        fs.writeFileSync(path.join(treat, 'check_web_launch_readiness.ts'), 'ts');
        fs.writeFileSync(path.join(treat, 'web-launch-readiness.json'), '{}');
        const c = buildRequest('comparator', site, treat);
        const t = buildRequest('treatment', site, treat);
        expect(c.blocks[0]).toBe(`${COMPARATOR_PROMPT}\n`);
        expect(c.blocks).toHaveLength(3);
        expect(t.blocks).toHaveLength(5);
        expect(JSON.parse(t.blocks[2] as string).path).toBe('treatment/check_web_launch_readiness.ts');
        expect(JSON.parse(t.blocks[3] as string).path).toBe('treatment/web-launch-readiness.json');
        expect(t.blocks[4]).toBe(c.blocks[2]);
        expect(c.blocks[1]).toBe(t.blocks[1]);
    });

    it('never packages a ground-truth manifest even when it sits beside the sites', () => {
        const site = path.join(tmp, 'docs');
        fs.mkdirSync(site);
        fs.writeFileSync(path.join(site, 'index.html'), 'x');
        fs.writeFileSync(path.join(tmp, 'GROUND-TRUTH.md'), 'manifest');
        expect(siteFiles(site)).toEqual(['index.html']);
    });

    it('runs the six calls in the frozen order', () => {
        expect(CALL_ORDER).toEqual([
            ['docs', 'comparator'],
            ['docs', 'treatment'],
            ['local-business', 'treatment'],
            ['local-business', 'comparator'],
            ['saas-app', 'comparator'],
            ['saas-app', 'treatment'],
        ]);
    });
});
