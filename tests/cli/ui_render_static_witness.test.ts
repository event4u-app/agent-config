import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { staticWitness } from '../../src/cli/commands/uiRender.js';

/**
 * Finding 4 of the third completion review of `feat/svg-roadmaps-all-20261011`.
 *
 * The static-only discharge is the path that keeps a consumer WITHOUT
 * Playwright from being refused forever by a blocking turn-end gate. It admits
 * a `renderer-absent` manifest only when its static witness reports 0 errors —
 * and an ordinary stroke icon with no `<title>` reports exactly one,
 * `svg-a11y-no-accessible-name` at severity `error`. So the number was never 0
 * and the path never fired: the escape hatch was shut on every file it existed
 * for.
 */
let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'static-witness-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const write = (name: string, body: string): string => {
    const abs = path.join(root, name);
    fs.writeFileSync(abs, body);
    return abs;
};

describe('the static witness counts brokenness, not improvability', () => {
    it('an ordinary unnamed icon is not broken', () => {
        const plain =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
            '<path d="M4 4h16v16H4z" fill="none" stroke="#000" stroke-width="2"/></svg>\n';
        const r = staticWitness(write('plain.svg', plain));
        // The a11y finding is still PRODUCED — `scanSvg` reports it and the
        // design pass surfaces it. It just does not shut the renderer-absent
        // door, which is a different question.
        expect(r?.errors).toBe(0);
    });

    it('a file that does not parse, and one that executes, still are', () => {
        // structure: the document is not a tree.
        const mis =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">' +
            '<title>t</title><g><rect width="24" height="24"/></g2></svg>\n';
        expect(staticWitness(write('mis.svg', mis))?.errors).toBeGreaterThan(0);

        // safety: active content, graded by the delivery mode.
        const script =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">' +
            '<title>t</title><script/><rect width="24" height="24"/></svg>\n';
        expect(staticWitness(write('script.svg', script))?.errors).toBeGreaterThan(0);

        // structure: a reference that resolves to nothing.
        const dangling =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">' +
            '<title>t</title><rect width="24" height="24" fill="url(#nowhere)"/></svg>\n';
        expect(staticWitness(write('dangling.svg', dangling))?.errors).toBeGreaterThan(0);
    });

    it('the delivery mode reaches the scan', () => {
        // Finding 6 of the SECOND round, pinned here beside its neighbour: the
        // mode was stated on the command line and defaulted to the strictest
        // anyway. An `img`-delivered file cannot execute, so the safety family
        // grades below `error` there.
        const script =
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img">' +
            '<title>t</title><script/><rect width="24" height="24"/></svg>\n';
        const abs = write('img.svg', script);
        expect(staticWitness(abs, 'inline')?.errors).toBeGreaterThan(0);
        expect(staticWitness(abs, 'img')?.errors).toBe(0);
    });

    it('a host document is scanned as a host, not as a graphic', () => {
        // Finding 1 of the fourth completion review, reproduced on this repo's
        // own host fixture: `scanSvg` over an HTML document reports
        // `svg-structure-not-well-formed` for every void element — `<meta>`
        // and `<img>` never close, which is correct HTML and malformed XML —
        // so the witness read errors where `scanHostHtml` over the same bytes
        // reports none, and a correct host could not discharge its obligation.
        const host =
            '<!doctype html>\n<html><head><meta charset="utf-8">\n' +
            '<title>t</title></head><body>\n' +
            '<img src="logo.svg" alt="A logo" width="48" height="48">\n' +
            '</body></html>\n';
        expect(staticWitness(write('host.html', host))?.errors).toBe(0);

        // The same bytes under a `.svg` name are a malformed graphic, which is
        // the control: the fix is the EXTENSION branch, not a quieter scan.
        expect(staticWitness(write('host.svg', host))?.errors).toBeGreaterThan(0);
    });

    it('an unreadable file is null, never 0', () => {
        // 0 errors and "I could not read it" must not be the same answer: the
        // discharge path tests `errors === 0`.
        expect(staticWitness(path.join(root, 'absent.svg'))).toBeNull();
    });
});
