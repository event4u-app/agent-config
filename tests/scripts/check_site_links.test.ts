/**
 * Tests for src/scripts/check_site_links.ts — the B4 built-site link gate.
 *
 * resolveTarget() unit cases (base strip, trailing-slash dir, fragment/query,
 * external skip) + findBrokenLinks() over a synthetic tmp dist (a real target
 * resolves, a dangling one is reported).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findBrokenLinks, resolveTarget } from '../../src/scripts/check_site_links.js';

const BASE = '/agent-config';

describe('check_site_links — resolveTarget()', () => {
    it('strips the base prefix and maps a trailing-slash dir to index.html', () => {
        expect(resolveTarget('/agent-config/proof/', BASE)).toBe('proof/index.html');
        expect(resolveTarget('/agent-config/', BASE)).toBe('index.html');
        expect(resolveTarget('/agent-config/favicon.svg', BASE)).toBe('favicon.svg');
    });
    it('strips fragment and query', () => {
        expect(resolveTarget('/agent-config/proof/#section?x=1', BASE)).toBe('proof/index.html');
    });
    it('skips external / anchor / mailto / protocol-relative links', () => {
        for (const l of ['https://x.dev/a', 'http://x', '//cdn/x', '#top', 'mailto:a@b.c', 'data:x', '']) {
            expect(resolveTarget(l, BASE)).toBeNull();
        }
    });
});

describe('check_site_links — findBrokenLinks()', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sitelinks-'));
    });
    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('passes when every internal link resolves', () => {
        fs.mkdirSync(path.join(tmp, 'proof'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'proof', 'index.html'), '<a href="/agent-config/">home</a>');
        fs.writeFileSync(path.join(tmp, 'favicon.svg'), '<svg/>');
        fs.writeFileSync(
            path.join(tmp, 'index.html'),
            '<link href="/agent-config/favicon.svg"><a href="/agent-config/proof/">p</a><a href="https://x.dev">ext</a>',
        );
        expect(findBrokenLinks(tmp, BASE)).toEqual([]);
    });

    it('reports a dangling internal link', () => {
        fs.writeFileSync(
            path.join(tmp, 'index.html'),
            '<a href="/agent-config/gone/">missing</a><a href="/agent-config/favicon.svg">icon</a>',
        );
        const broken = findBrokenLinks(tmp, BASE);
        expect(broken.length).toBe(2); // both the dir link and the missing favicon
        expect(broken.map((b) => b.link).sort()).toEqual(['/agent-config/favicon.svg', '/agent-config/gone/']);
    });
});
