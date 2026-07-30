// Scope de-duplication of the rule projection (C-3, road-to-cache-economy).
//
// The safety argument is BYTE-IDENTITY, so that is what these tests pin. A
// filename-keyed dedup would silently let a stale globally-installed copy win
// whenever the two scopes hold different releases — the normal state while
// developing the package (measured: 110/110 shared filenames differing in
// bytes). Every case below therefore checks the *content* predicate, not the
// name.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { classifyReachability, dedupableCount } from '../../src/scripts/measure_scope_dedup.js';

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'scope-dedup-test-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) {
        fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
    }
});

function writeRules(dir: string, files: Record<string, string>): string {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), body, 'utf-8');
    }
    return dir;
}

describe('scope dedup — byte-identity gate', () => {
    it('skips a twin only when the bytes match', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), {
            'a.md': 'alpha body\n',
            'b.md': 'beta body\n',
        });
        const user = writeRules(path.join(root, 'user'), {
            'a.md': 'alpha body\n', // identical -> de-duplicable
            'b.md': 'beta body CHANGED\n', // same name, different bytes -> must NOT dedupe
        });

        const result = dedupableCount(user, source);
        expect(result.skipped).toBe(1);
        // The removed byte count must be the identical file's own size, derived
        // from the fixture rather than hardcoded.
        expect(result.chars).toBe(Buffer.byteLength('alpha body\n'));
    });

    it('never dedupes when the user scope holds a different release (the drift case)', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), {
            'a.md': 'v2 body\n',
            'b.md': 'v2 body\n',
        });
        const user = writeRules(path.join(root, 'user'), {
            'a.md': 'v1 body\n',
            'b.md': 'v1 body\n',
        });

        const result = dedupableCount(user, source);
        expect(result.skipped).toBe(0);
        expect(result.chars).toBe(0);
    });

    it('ignores a rule the user scope does not carry at all', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'x\n', 'b.md': 'y\n' });
        const user = writeRules(path.join(root, 'user'), { 'a.md': 'x\n' });

        expect(dedupableCount(user, source).skipped).toBe(1);
    });

    it('is inert when there is no user-scope directory', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'x\n' });

        const result = dedupableCount(path.join(root, 'absent'), source);
        expect(result.skipped).toBe(0);
        expect(result.chars).toBe(0);
    });

    it('counts every identical twin when both scopes carry the same release', () => {
        const root = tmpdir();
        const bodies = { 'a.md': 'one\n', 'b.md': 'two\n', 'c.md': 'three\n' };
        const source = writeRules(path.join(root, 'source'), bodies);
        const user = writeRules(path.join(root, 'user'), bodies);

        const result = dedupableCount(user, source);
        expect(result.skipped).toBe(Object.keys(bodies).length);
        expect(result.chars).toBe(
            Object.values(bodies).reduce((sum, b) => sum + Buffer.byteLength(b), 0),
        );
    });
});

describe('scope dedup — hostile or degenerate user scope (council review of #1055)', () => {
    it('treats a CRLF-vs-LF twin as DIFFERENT, so a line-ending change never silently drops a rule', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'line one\nline two\n' });
        const user = writeRules(path.join(root, 'user'), { 'a.md': 'line one\r\nline two\r\n' });

        // Same characters, different bytes — the gate is byte-identity, not
        // text-equivalence, precisely so a CRLF checkout cannot make the two
        // scopes look interchangeable when the host would load different bytes.
        expect(dedupableCount(user, source).skipped).toBe(0);
    });

    it('de-duplicates a symlinked twin only when the RESOLVED bytes match', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'same\n', 'b.md': 'same\n' });
        const user = path.join(root, 'user');
        fs.mkdirSync(user, { recursive: true });
        // a.md → a symlink to identical content; b.md → a symlink to different content.
        const identical = path.join(root, 'identical.md');
        const different = path.join(root, 'different.md');
        fs.writeFileSync(identical, 'same\n', 'utf-8');
        fs.writeFileSync(different, 'other\n', 'utf-8');
        fs.symlinkSync(identical, path.join(user, 'a.md'));
        fs.symlinkSync(different, path.join(user, 'b.md'));

        const result = dedupableCount(user, source);
        expect(result.skipped).toBe(1);
        expect(result.chars).toBe(Buffer.byteLength('same\n'));
    });

    it('is inert when the twin symlink dangles rather than throwing', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'x\n' });
        const user = path.join(root, 'user');
        fs.mkdirSync(user, { recursive: true });
        fs.symlinkSync(path.join(root, 'nowhere.md'), path.join(user, 'a.md'));

        expect(dedupableCount(user, source).skipped).toBe(0);
    });

    it('is inert when the user scope is a FILE where a directory was expected', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'x\n' });
        const notADir = path.join(root, 'user');
        fs.writeFileSync(notADir, 'not a directory\n', 'utf-8');

        expect(dedupableCount(notADir, source).skipped).toBe(0);
    });
});

// Why the fixture condition is unreachable in production. The dedup itself is
// correct; what these tests pin is the DIAGNOSIS, so a future reader is not sent
// back to re-derive it — and so the "aligning versions would fix it" hypothesis
// stays falsified rather than quietly returning.
describe('reachability classification — provenance stamp vs body drift', () => {
    it('calls a twin that differs only in the ownership stamp provenance-only, not a body diff', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), {
            'a.md': '---\nname: a\n---\n\nbody\n',
        });
        // Exactly what install.ts:2723/2725 add to every installed rule.
        const user = writeRules(path.join(root, 'user'), {
            'a.md': '---\nname: a\npackage: event4u/agent-config\nsource_path: dist/agent-src/rules/a.md\n---\n\nbody\n',
        });

        const split = classifyReachability(user, source);
        expect(split).toMatchObject({
            total: 1,
            identical: 0,
            provenanceOnly: 1,
            bodyDiff: 0,
            missing: 0,
        });
        // And the dedup still refuses it — the classifier explains the 0, it
        // does not license skipping the rule.
        expect(dedupableCount(user, source).skipped).toBe(0);
    });

    it('keeps a body difference separate from the stamp, so version drift stays visible as its own cause', () => {
        const root = tmpdir();
        const source = writeRules(path.join(root, 'source'), { 'a.md': 'v2 body\n' });
        const user = writeRules(path.join(root, 'user'), {
            'a.md': 'package: event4u/agent-config\nv1 body\n',
        });

        // Stripping the stamp still leaves different bodies -> bodyDiff, which is
        // the only bucket a version alignment can close.
        expect(classifyReachability(user, source)).toMatchObject({
            provenanceOnly: 0,
            bodyDiff: 1,
        });
    });

    it('pins the honest null: with the stamp present everywhere, aligning versions leaves zero twins', () => {
        const root = tmpdir();
        const bodies = { 'a.md': 'one\n', 'b.md': 'two\n', 'c.md': 'three\n' };
        const source = writeRules(path.join(root, 'source'), bodies);
        // Same release at both scopes — the "aligned versions" condition — but
        // every file carries the unconditional install stamp.
        const user = writeRules(
            path.join(root, 'user'),
            Object.fromEntries(
                Object.entries(bodies).map(([n, b]) => [
                    n,
                    `package: event4u/agent-config\nsource_path: dist/agent-src/rules/${n}\n${b}`,
                ]),
            ),
        );

        const split = classifyReachability(user, source);
        expect(split.bodyDiff).toBe(0); // versions ARE aligned
        expect(split.provenanceOnly).toBe(3); // and yet nothing matches
        expect(dedupableCount(user, source).skipped).toBe(0);
    });
});
