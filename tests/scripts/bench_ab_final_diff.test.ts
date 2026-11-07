/**
 * A run record keeps the post-state of every file the trial changed, so a later
 * scorer can rebuild the clone from the pristine fixture and re-score it
 * (road-to-benchmark-claims-that-name-their-scorer 3.1).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { changed_files, final_files } from '../../internal/bench/core/_lib/bench_ab_scoring_v2.js';

const dirs: string[] = [];
function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'final-files-'));
    dirs.push(root);
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return root;
}
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function rebuild(fixture: string, files: Record<string, string | null>): string {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'final-files-rebuilt-'));
    dirs.push(out);
    fs.cpSync(fixture, out, { recursive: true });
    for (const [rel, body] of Object.entries(files)) {
        const p = path.join(out, rel);
        if (body === null) fs.rmSync(p, { force: true });
        else {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, body);
        }
    }
    return out;
}

describe('final_files', () => {
    it('round-trips: fixture + recorded files rebuilds the same change set', () => {
        const fixture = tree({ 'src/a.ts': 'a\n', 'src/b.ts': 'b\n', 'src/gone.ts': 'x\n' });
        const clone = tree({ 'src/a.ts': 'a2\n', 'src/b.ts': 'b\n', 'src/new.ts': 'n\n' });
        const rec = final_files(fixture, clone);
        expect(rec.truncated).toBe(false);
        expect(rec.files).toEqual({ 'src/a.ts': 'a2\n', 'src/gone.ts': null, 'src/new.ts': 'n\n' });
        const rebuilt = rebuild(fixture, rec.files);
        expect([...changed_files(fixture, rebuilt)].sort()).toEqual([...changed_files(fixture, clone)].sort());
        expect(changed_files(clone, rebuilt).size).toBe(0);
    });

    it('records nothing for an untouched clone', () => {
        const fixture = tree({ 'a.ts': 'a\n' });
        expect(final_files(fixture, tree({ 'a.ts': 'a\n' }))).toEqual({ files: {}, truncated: false });
    });

    it('stops at the byte cap and says so', () => {
        const fixture = tree({ 'a.ts': '', 'b.ts': '' });
        const clone = tree({ 'a.ts': 'x'.repeat(40), 'b.ts': 'y'.repeat(40) });
        const rec = final_files(fixture, clone, 50);
        expect(rec.truncated).toBe(true);
        expect(Object.keys(rec.files)).toEqual(['a.ts']);
    });
});
