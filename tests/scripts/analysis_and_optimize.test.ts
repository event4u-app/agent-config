import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { readSet } from '../../src/scripts/analysis_and_optimize.js';
import { isInside, resolveAnalysisTarget } from '../../src/scripts/analysis_target.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let base: string;
let savedHome: string | undefined;

function write(rel: string, body: string): string {
    const p = path.join(base, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    return p;
}

beforeEach(() => {
    base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'and-optimize-')));
    savedHome = process.env['HOME'];
    process.env['HOME'] = path.join(base, 'home');
    fs.mkdirSync(process.env['HOME'], { recursive: true });
});

afterEach(() => {
    if (savedHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = savedHome;
    fs.rmSync(base, { recursive: true, force: true });
});

describe('analyze:and-optimize read set (step 4.5)', () => {
    it('in a module fixture every reader path lies under the module root, code included', () => {
        write('proj/.git/HEAD', 'ref: refs/heads/main\n');
        write('proj/.git/refs/heads/main', `${'a'.repeat(40)}\n`);
        write('proj/src/outside.ts', '// FIXME the outer project leaks\nexport const a = 1;\n');
        write('proj/app/Modules/Foo/agents/.keep', '');
        write('proj/app/Modules/Foo/src/pay.ts', '// FIXME negative totals pass\nexport const b = 2;\n');
        const cwd = path.join(base, 'proj/app/Modules/Foo/src');
        const target = resolveAnalysisTarget({ cwd });
        const set = readSet(target);
        const moduleRoot = path.join(base, 'proj/app/Modules/Foo');
        expect(target.scope_kind).toBe('module');
        expect(set.readers.length).toBeGreaterThan(0);
        expect(set.readers.every((p) => isInside(p, moduleRoot))).toBe(true);
        expect(set.code).toContain(path.join(moduleRoot, 'src/pay.ts'));
        expect(set.anchors.rows.map((r) => r.anchor)).toEqual(['src/pay.ts:1']);
    });

    it('at the repository root the read set is the whole project', () => {
        write('proj/.git/HEAD', 'ref: refs/heads/main\n');
        write('proj/.git/refs/heads/main', `${'a'.repeat(40)}\n`);
        write('proj/src/outside.ts', '// FIXME the outer project leaks\n');
        const set = readSet(resolveAnalysisTarget({ cwd: path.join(base, 'proj') }));
        expect(set.code).toEqual([path.join(base, 'proj/src/outside.ts')]);
    });
});

describe('optimize:deep still resolves in the projected tree (step 4.5, AC-10)', () => {
    const dist = (rel: string): string => fs.readFileSync(path.join(ROOT, 'dist/agent-src/commands', rel), 'utf-8');

    it('the projected and-optimize door declares both old names as replaces aliases', () => {
        const projected = parse(/^---\n([\s\S]*?)\n---\n/u.exec(dist('analyze/and-optimize.md'))![1]!) as { name: string; replaces: string[] };
        expect(projected.name).toBe('analyze-and-optimize');
        expect(projected.replaces).toEqual(expect.arrayContaining(['optimize-deep', 'optimize:deep']));
        expect(fs.existsSync(path.join(ROOT, 'dist/agent-src/commands/optimize/deep.md'))).toBe(false);
    });

    it('the projected /optimize head routes `deep` to the moved door', () => {
        const head = dist('optimize.md');
        expect(head).toContain('| `/optimize deep` | `commands/analyze/and-optimize.md` |');
        expect(head).toContain('analyze-and-optimize]');
    });
});
