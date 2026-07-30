// Staleness verdict for src/scripts/check_site_links.ts.
//
// The checker exited 2 on a MISSING build but reported green on a STALE one, so it
// passed while inspecting a build that did not contain the pages under test —
// measured at 6 built pages against 25 content sources, every source newer. A gate
// that cannot fail is worse than no gate, so these cases pin both signals.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { _stalenessVerdict } from '../../src/scripts/check_site_links.js';

let tmp: string;
let dist: string;
let content: string;

function write(p: string, body: string, mtimeMs?: number): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
    if (mtimeMs !== undefined) {
        const t = mtimeMs / 1000;
        fs.utimesSync(p, t, t);
    }
}

const OLD = 1_600_000_000_000; // 2020
const NEW = 1_900_000_000_000; // 2030

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sitelinks-'));
    dist = path.join(tmp, 'dist');
    content = path.join(tmp, 'content');
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('_stalenessVerdict', () => {
    it('a current build is not stale', () => {
        write(path.join(content, 'a.md'), '# a', OLD);
        write(path.join(content, 'b.mdx'), '# b', OLD);
        write(path.join(dist, 'a', 'index.html'), '<html></html>', NEW);
        write(path.join(dist, 'b', 'index.html'), '<html></html>', NEW);
        expect(_stalenessVerdict(dist, content)).toBeNull();
    });

    it('flags a source newer than every built page — the build predates an edit', () => {
        write(path.join(content, 'a.md'), '# a', NEW);
        write(path.join(dist, 'a', 'index.html'), '<html></html>', OLD);
        expect(_stalenessVerdict(dist, content)).toMatch(/newer than the newest built page/);
    });

    it('flags a partial build — fewer pages than sources, same mtimes', () => {
        // The canonical case found in the wild: build is not older, just incomplete.
        for (const n of ['a', 'b', 'c']) write(path.join(content, `${n}.md`), '#', OLD);
        write(path.join(dist, 'a', 'index.html'), '<html></html>', NEW);
        expect(_stalenessVerdict(dist, content)).toMatch(/only 1 page\(s\) built for 3 content source\(s\)/);
    });

    it('flags a build with no HTML at all', () => {
        write(path.join(content, 'a.md'), '#', OLD);
        fs.mkdirSync(dist, { recursive: true });
        write(path.join(dist, 'stray.txt'), 'not html', NEW);
        expect(_stalenessVerdict(dist, content)).toMatch(/no HTML pages/);
    });

    it('declines to judge when there is no content dir to compare against', () => {
        // Not this checker's verdict to invent — an absent content tree is a different
        // problem, and guessing here would produce exactly the false red this fix
        // exists to avoid.
        write(path.join(dist, 'a', 'index.html'), '<html></html>', NEW);
        expect(_stalenessVerdict(dist, path.join(tmp, 'nope'))).toBeNull();
    });

    it('declines to judge when the content dir holds no md/mdx', () => {
        fs.mkdirSync(content, { recursive: true });
        write(path.join(content, 'notes.txt'), 'x', OLD);
        write(path.join(dist, 'a', 'index.html'), '<html></html>', NEW);
        expect(_stalenessVerdict(dist, content)).toBeNull();
    });
});
