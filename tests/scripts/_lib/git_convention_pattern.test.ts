import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    fileSource,
    invalidReason,
    readGitConventionKey,
    renderBranchSample,
} from '../../../src/scripts/_lib/git_convention.js';

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('git.branch_pattern', () => {
    it.each(['{type}/{slug}', '{ticket}-{slug}', '{type}/{ticket}-{slug}', 'team/{slug}', 'feat_{slug}.v2'])(
        'accepts %s',
        (pattern) => {
            expect(invalidReason('branch_pattern', pattern)).toBeNull();
        },
    );

    it('renders a sample from every placeholder', () => {
        expect(renderBranchSample('{type}/{ticket}-{slug}')).toBe('feat/DEV-1234-sample-change');
    });

    it.each([
        ['an unknown placeholder', '{type}/{name}', 'placeholder'],
        ['a pattern without {slug}', '{type}/{ticket}', '{slug}'],
        ['command substitution', 'a$(id)/{slug}', 'character'],
        ['a command separator', 'a;b/{slug}', 'character'],
        ['a pipe', 'a|b/{slug}', 'character'],
        ['a space', 'my branch/{slug}', 'character'],
        ['a backtick', '`id`/{slug}', 'character'],
        ['an unbalanced brace', '{type/{slug}', 'brace'],
        ['an empty pattern', '', 'empty'],
    ])('rejects %s', (_label, pattern, fragment) => {
        const why = invalidReason('branch_pattern', pattern);
        expect(why).not.toBeNull();
        expect(why).toContain(fragment);
    });

    it.each(['{type}..{slug}', '/{slug}', '{slug}.lock', '{type}//{slug}', '-{slug}'])(
        'rejects %s, whose rendered sample git refuses',
        (pattern) => {
            expect(invalidReason('branch_pattern', pattern)).toContain('git check-ref-format');
        },
    );

    it('a bad pattern read from a file is `invalid` with the reason', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-pattern-'));
        made.push(dir);
        const p = path.join(dir, 's.yml');
        fs.writeFileSync(p, 'git:\n  branch_pattern: "a$(id)/{slug}"\n');
        const r = readGitConventionKey('branch_pattern', fileSource({ developer: [p] }), {});
        expect(r).toMatchObject({ state: 'invalid', source: p, reason: 'git-convention-invalid' });
        expect(r.detail).toContain('character');
    });
});
