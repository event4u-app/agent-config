/**
 * Release-truth Phase 1 — one final source for release material.
 *
 * Pins the single-source derivation (`_lib/release_material.ts`) and the
 * equality gate (`check_release_surface_equality.ts`):
 *
 *   - fixture release with a late-added commit → all four surfaces carry the
 *     same content and the same test count (P1.1 verify)
 *   - seeded one-line divergence → red (P1.2 verify)
 *   - the test count appears in exactly one generated fragment that every
 *     surface includes (P1.3 verify)
 */
import { describe, expect, it } from 'vitest';

import {
    extract_changelog_section,
    normalize_release_text,
    pr_body_from_section,
    release_notes_from_section,
    strip_pr_wrapper,
    surface_divergence,
    tag_message_from_section,
    TRUNCATION_MARKER,
} from '../../src/scripts/_lib/release_material.js';
import { check_surface_equality } from '../../src/scripts/check_release_surface_equality.js';

const V = '9.99.0';

function changelog(body: string, opts: { linkHeading?: boolean } = {}): string {
    const heading = opts.linkHeading
        ? `## [${V}](https://github.com/event4u-app/agent-config/compare/9.98.0...${V}) (2026-08-03)`
        : `## ${V} (2026-08-03)`;
    return [
        '# Changelog',
        '',
        heading,
        '',
        body,
        '',
        '## [9.98.0](https://github.com/event4u-app/agent-config/compare/9.97.0...9.98.0) (2026-07-20)',
        '',
        '* older content',
        '',
    ].join('\n');
}

const BODY = [
    '### Release highlights',
    '',
    '- **Behaviour changes:** _none_',
    '',
    '### Features',
    '',
    '* **release:** single-source surfaces ([abc1234](https://example))',
    '',
    'Tests: 10056 (+14 since 9.98.0)',
].join('\n');

describe('extract_changelog_section', () => {
    it('extracts plain and compare-link headings, bounded by the next version', () => {
        for (const linkHeading of [false, true]) {
            const section = extract_changelog_section(changelog(BODY, { linkHeading }), V);
            expect(section).not.toBeNull();
            expect(section!.body).toBe(BODY);
            expect(section!.body).not.toContain('older content');
        }
    });

    it('returns null for a version with no heading', () => {
        expect(extract_changelog_section(changelog(BODY), '1.2.3')).toBeNull();
    });

    it('does not match 9.99.10 when asked for 9.99.1 (word boundary)', () => {
        const text = changelog(BODY).replace(`## ${V} `, '## 9.99.10 ');
        expect(extract_changelog_section(text, '9.99.1')).toBeNull();
    });
});

describe('single source — all four surfaces from one section (P1.1 + P1.3)', () => {
    it('late-added commit reaches every surface with the same test count', () => {
        // Plan-time render happened earlier; the maintainer then lands a late
        // commit and refreshes the entry — the derivations run on the FINAL
        // section, so all four surfaces agree by construction.
        const lateBody = BODY.replace(
            '* **release:** single-source surfaces ([abc1234](https://example))',
            '* **release:** single-source surfaces ([abc1234](https://example))\n' +
                '* **late:** commit added after plan time ([def5678](https://example))',
        ).replace('Tests: 10056 (+14 since 9.98.0)', 'Tests: 10058 (+16 since 9.98.0)');
        const section = extract_changelog_section(changelog(lateBody), V)!;

        const surfaces = [
            section.body, // CHANGELOG entry body
            strip_pr_wrapper(pr_body_from_section(section.body, V), V)!, // PR body middle
            release_notes_from_section(section.body, V), // GitHub release notes
            tag_message_from_section(section.body, V).replace(`release: ${V}\n\n`, '').trimEnd(), // tag message
        ];
        const counts = surfaces.map((s) => /^Tests:\s+(\d+)/mu.exec(s)?.[1]);
        expect(new Set(counts)).toEqual(new Set(['10058']));
        for (const s of surfaces) {
            // The count line appears exactly once per surface — one generated
            // fragment, included everywhere (P1.3).
            expect(s.match(/^Tests:\s+\d+/gmu)).toHaveLength(1);
            expect(surface_divergence(s, section.body)).toBeNull();
        }
        expect(surfaces[3]).toContain('* **late:** commit added after plan time');
    });
});

describe('equality gate (P1.2)', () => {
    it('is green when the PR body was derived from the changelog section', () => {
        const prBody = pr_body_from_section(BODY, V);
        const result = check_surface_equality({
            prBody,
            changelogText: changelog(BODY),
            version: V,
        });
        expect(result).toEqual({ ok: true, reason: null });
    });

    it('accepts the legacy release.py footer on old PR bodies', () => {
        const prBody = `Release ${V}.\n\n${BODY}\n\nCreated by \`scripts/release.py\`.`;
        expect(check_surface_equality({ prBody, changelogText: changelog(BODY), version: V }).ok).toBe(
            true,
        );
    });

    it('goes red on a seeded one-line divergence', () => {
        const seeded = BODY.replace('Tests: 10056', 'Tests: 10054');
        const result = check_surface_equality({
            prBody: pr_body_from_section(seeded, V),
            changelogText: changelog(BODY),
            version: V,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toMatch(/first divergence at line \d+/u);
        expect(result.reason).toContain('10054');
    });

    it('goes red when the changelog section is missing', () => {
        const result = check_surface_equality({
            prBody: pr_body_from_section(BODY, V),
            changelogText: '# Changelog\n\n## 1.0.0 (2020-01-01)\n\n* x\n',
            version: V,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('no section');
    });

    it('goes red on a hand-written PR body (no canonical prefix)', () => {
        const result = check_surface_equality({
            prBody: 'Some hand-written release description.',
            changelogText: changelog(BODY),
            version: V,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('canonical');
    });
});

describe('normalization + truncation tolerance', () => {
    it('normalizes only whitespace — content differences survive', () => {
        expect(normalize_release_text('a  \r\nb\n\n\n\nc\n')).toBe('a\nb\n\nc');
        expect(surface_divergence('a\nb', 'a\nc')).not.toBeNull();
        expect(surface_divergence('a \n\n\nb', 'a\n\nb')).toBeNull();
    });

    it('treats a capped surface as a prefix, not a divergence', () => {
        const truncated =
            BODY.split('\n').slice(0, 5).join('\n') +
            `\n\n> ${TRUNCATION_MARKER}'s 65,536-character body limit — full entry in \`CHANGELOG.md\`._`;
        expect(surface_divergence(truncated, BODY)).toBeNull();
        const wrong = truncated.replace('_none_', '_all_');
        expect(surface_divergence(wrong, BODY)).not.toBeNull();
    });
});
