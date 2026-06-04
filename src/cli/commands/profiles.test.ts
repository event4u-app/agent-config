/**
 * Routing evals for profiles-as-views (6.0.0-D Step 14/15).
 *
 * Proves the roadmap acceptance criterion: `commands ls --profile developer`
 * renders exactly {work, review-changes, fix-ci, git-commit, git-pr-create}
 * in view order, and `--expanded` adds the active packs' full set on top.
 */
import { describe, expect, it } from 'vitest';
import { loadProfile, resolveProfileView } from './profiles.js';
import type { DiscoveryArtefact } from '../discovery/loadManifest.js';

function cmd(slug: string, pack: string, tier = 2): DiscoveryArtefact {
    return {
        path: `src/domains/${pack}/${slug}/command.md`,
        category: 'command',
        name: slug,
        slug,
        pack,
        tier,
        workspaces: [],
        packs: [pack],
        lifecycle: 'stable',
        trust: { level: 'core', human_review_required: false },
        install: {},
    } as DiscoveryArtefact;
}

const MANIFEST: DiscoveryArtefact[] = [
    cmd('work', 'engineering-base', 0),
    cmd('review-changes', 'engineering-base', 1),
    cmd('fix-ci', 'engineering-base'),
    cmd('git-commit', 'git', 0),
    cmd('git-pr-create', 'git', 1),
    cmd('git-sync', 'git'),
    cmd('research', 'product-discovery', 0), // not in developer's packs
];

describe('profiles-as-views', () => {
    it('developer built-in declares the curated five', () => {
        const p = loadProfile('developer');
        expect(p).not.toBeNull();
        expect(p?.immutable).toBe(true);
        expect(p?.view).toEqual(['work', 'review-changes', 'fix-ci', 'git-commit', 'git-pr-create']);
    });

    it('curated view renders exactly the five, in declared order', () => {
        const p = loadProfile('developer');
        const view = resolveProfileView(p!, MANIFEST);
        expect(view.map((c) => c.slug)).toEqual([
            'work',
            'review-changes',
            'fix-ci',
            'git-commit',
            'git-pr-create',
        ]);
    });

    it('--expanded adds the active packs full set after the curated view', () => {
        const p = loadProfile('developer');
        const view = resolveProfileView(p!, MANIFEST, { expanded: true });
        const slugs = view.map((c) => c.slug);
        // curated five first, in order
        expect(slugs.slice(0, 5)).toEqual([
            'work',
            'review-changes',
            'fix-ci',
            'git-commit',
            'git-pr-create',
        ]);
        // git-sync (git pack, not in the curated view) is added by --expanded
        expect(slugs).toContain('git-sync');
        // research (product-discovery, not a developer pack) is NOT surfaced
        expect(slugs).not.toContain('research');
    });

    it('a view entry with no live command is silently dropped', () => {
        const p = loadProfile('developer');
        const partial = MANIFEST.filter((c) => c.slug !== 'fix-ci');
        const view = resolveProfileView(p!, partial);
        expect(view.map((c) => c.slug)).toEqual(['work', 'review-changes', 'git-commit', 'git-pr-create']);
    });

    it('unknown profile id resolves to null', () => {
        expect(loadProfile('nope')).toBeNull();
        expect(loadProfile('../etc/passwd')).toBeNull();
    });

    it('every built-in profile loads and is immutable', () => {
        for (const id of ['developer', 'founder', 'content_creator', 'agency', 'finance', 'ops']) {
            const p = loadProfile(id);
            expect(p, id).not.toBeNull();
            expect(p?.immutable, id).toBe(true);
            expect(p?.view.length, id).toBeGreaterThan(0);
        }
    });
});
