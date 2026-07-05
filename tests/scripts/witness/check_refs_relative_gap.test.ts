/**
 * WITNESS (B6) for the `check-refs` skill gap:
 *   "Only validates references to known-root paths (docs/, skills/, rules/, …);
 *    a relative-path reference like `./sibling.md` is not matched, so a broken
 *    relative link is never reported."
 *
 * This test PASSES while the gap is real: it shows a broken *relative* link is
 * NOT reported, and (control) a broken *known-root* path IS reported (so the
 * checker is alive and the gap is specifically relative-refs). If check-refs is
 * ever extended to validate relative links, the gap assertion flips → this test
 * fails → the `gaps:` entry is stale and must be removed. That is the
 * stale-gap audit, enforced by the ordinary test suite.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import * as cr from '../../../src/scripts/check_references.js';

const ARTIFACTS: cr.Artifacts = {
    skills: new Set<string>(),
    rules: new Set<string>(),
    commands: new Set<string>(),
    guidelines: new Set<string>(),
    personas: new Set<string>(),
};

const _tmp: string[] = [];
afterEach(() => {
    for (const d of _tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function checkBody(body: string): cr.BrokenRef[] {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crw-'));
    _tmp.push(tmp);
    const md = path.join(tmp, 'doc.md');
    fs.writeFileSync(md, body, 'utf-8');
    return cr.check_file(md, ARTIFACTS, tmp);
}

describe('check-refs gap — relative-path references are not validated', () => {
    it('CONTROL: a broken known-root path ref IS reported (checker is alive)', () => {
        const broken = checkBody('# T\n\nBroken: `docs/contracts/zzz-does-not-exist.md`\n');
        expect(broken.some((b) => b.ref_type === 'path')).toBe(true);
    });

    it('GAP: a broken relative link is NOT reported (the documented limitation)', () => {
        const broken = checkBody('# T\n\nBroken relative: `./sibling-does-not-exist.md`\n');
        // Reproduces the gap: the relative ref never enters the checker's matcher.
        expect(broken.some((b) => b.ref_type === 'path')).toBe(false);
    });
});
