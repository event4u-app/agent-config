/**
 * Anchor-keyed suppression for the framework-leakage allowlist.
 *
 * Two properties, both of which the position-keyed form failed:
 *
 * 1. the suppression key printed WITH a finding is directly usable — a key the
 *    maintainer has to hand-translate is friction, and friction in the narrow
 *    path is what drives someone to the blunt off-switch instead;
 * 2. an anchored entry survives an insertion that moves the line, which is the
 *    recorded drift failure (`lines: [100]` re-firing on an edit nobody made to
 *    the exempted content).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { suppressionKey, validate_allowlist } from '../../src/scripts/lint_framework_leakage.js';

const hit = {
    line: 42,
    category: 'Laravel',
    pattern: '\\bphp artisan\\b',
    snippet: 'Always use `php artisan migrate` before deploying.',
    cross_stack: false,
};

describe('suppressionKey', () => {
    it('emits a parseable allowlist entry', () => {
        const parsed: unknown = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit));
        expect(parsed).toMatchObject({ file: 'src/skills/demo/SKILL.md' });
    });

    it('keys on content, never on the line number', () => {
        const parsed = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit)) as Record<
            string,
            unknown
        >;
        expect(parsed['anchor']).toContain('php artisan migrate');
        expect(parsed).not.toHaveProperty('lines');
        expect(JSON.stringify(parsed)).not.toContain('42');
    });

    it('carries a falsifier that names a runnable command for this file', () => {
        const parsed = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit)) as Record<
            string,
            unknown
        >;
        expect(String(parsed['falsifier'])).toContain('--paths src/skills/demo/SKILL.md');
    });

    it('carries a reason placeholder rather than a plausible-looking default', () => {
        // A pre-filled reason would be pasted unchanged, which is exactly the
        // pro-forma-field failure the falsifier requirement exists against.
        const parsed = JSON.parse(suppressionKey('src/skills/demo/SKILL.md', hit)) as Record<
            string,
            unknown
        >;
        expect(String(parsed['reason'])).toMatch(/^<.*>$/);
    });

    it('bounds the anchor so a long line does not become the key', () => {
        const long = { ...hit, snippet: `php artisan ${'x'.repeat(400)}` };
        const parsed = JSON.parse(suppressionKey('a.md', long)) as Record<string, unknown>;
        expect(String(parsed['anchor']).length).toBeLessThanOrEqual(60);
    });
});

/**
 * The allowlist judges itself before it judges any file.
 *
 * The migration that produced this check found three entries in this repository
 * that had stopped exempting anything — one naming line 100 of a 68-line file,
 * two naming blank lines — and nothing reported it, because a position key that
 * drifts still parses. Every case below asserts on the returned problems, so
 * deleting the check turns each of them red rather than leaving them green for
 * another reason.
 */
describe('validate_allowlist', () => {
    let root: string;

    beforeEach(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'allowlist-')));
        fs.writeFileSync(
            path.join(root, 'doc.md'),
            ['alpha php artisan migrate', 'beta', 'alpha php artisan migrate'].join('\n'),
            'utf-8',
        );
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('accepts an anchor that matches exactly one line', () => {
        expect(validate_allowlist({ entries: [{ file: 'doc.md', anchor: 'beta' }] }, root)).toEqual(
            [],
        );
    });

    it('rejects a position key — the drift-fragile form this migration retired', () => {
        const problems = validate_allowlist({ entries: [{ file: 'doc.md', lines: [2] }] }, root);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('position-keyed');
    });

    it('rejects an anchor that matches nothing — the silent rot', () => {
        const problems = validate_allowlist(
            { entries: [{ file: 'doc.md', anchor: 'content that is gone' }] },
            root,
        );
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('matches no line');
    });

    it('rejects an anchor that matches twice — it would exempt an unreviewed line', () => {
        // `includes` is file-scoped, so an over-broad anchor is a silent second
        // exemption. This is the failure an anchor can have and a line number cannot.
        const problems = validate_allowlist(
            { entries: [{ file: 'doc.md', anchor: 'php artisan migrate' }] },
            root,
        );
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('matches 2 lines');
    });

    it('rejects an entry naming a file that does not exist', () => {
        const problems = validate_allowlist(
            { entries: [{ file: 'gone.md', anchor: 'anything' }] },
            root,
        );
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('does not exist');
    });

    it('leaves a deliberate whole-file exemption alone', () => {
        // `lines: '*'` is a different decision from a position key and cannot
        // drift — retiring it here would be scope the migration did not earn.
        expect(validate_allowlist({ entries: [{ file: 'doc.md', lines: '*' }] }, root)).toEqual([]);
    });

    it('holds for the allowlist this repository actually ships', () => {
        // The end-to-end assertion. Without it the cases above would pass over a
        // tree whose own allowlist is broken — which is the state that shipped.
        const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
        const shipped = JSON.parse(
            fs.readFileSync(path.join(repo, 'src/scripts/lint_framework_leakage_allowlist.json'), 'utf-8'),
        ) as Parameters<typeof validate_allowlist>[0];
        expect(validate_allowlist(shipped, repo)).toEqual([]);
    });
});
