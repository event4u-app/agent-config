/**
 * Fixture tests for `src/scripts/harvest_reference_tokens.ts`.
 *
 * Every block below is one of `road-to-bounded-reference-harvest-loop`'s Phase 3
 * and Phase 4 `verify:` clauses, executed rather than asserted in prose. Two of
 * them exist because a measured run got it wrong:
 *
 *   - the prose-placeholder fixture, because a plain-substring `grep -rl 'ENC1:'`
 *     over the estate reports 77 token-bearing files where 63 carry a token —
 *     the other 14 mention the bare prefix in prose. That is the extraction
 *     defect Risk 7 names. Two distinct bounds close two distinct cases, and
 *     the difference was measured rather than assumed: the character class
 *     rejects the bare prefix (no base64 follows it), and the `{60,}` minimum
 *     rejects a short placeholder such as `ENC1:abcd`. Dropping the minimum
 *     alone reds these fixtures and NOT the census block below, because no
 *     real estate file carries a short placeholder today — so the census is
 *     not a sensitive test of the bound, and only the fixtures are;
 *   - the two-revisions fixture, because deduplicating on identity alone
 *     silently drops one of two historical pins, which reads as convergence.
 *
 * The census block is a regression pin on real repository data, so it states
 * counts and never a resolved name.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import {
    CONTRACT_VERSION,
    ESTATE_LEVELS,
    STATUSES,
    canonicalize,
    census,
    classifyUrl,
    dedupe,
    discover,
    foldCandidates,
    freshnessKey,
    levelOf,
    opaqueId,
    planResume,
    readManifest,
    renderManifest,
    revisionFrom,
    roadmapNameIsSourceFree,
    selfTest,
    type Entry,
    type Resolved,
} from '../../src/scripts/harvest_reference_tokens.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

const tmpDirs: string[] = [];
function mkTmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(d);
    return d;
}
afterAll(() => {
    for (const d of tmpDirs) {
        fs.rmSync(d, { recursive: true, force: true });
    }
});

/** A token-shaped string of `n` base64 characters — never a real ciphertext. */
function fakeToken(seed: string, n = 96): string {
    let s = '';
    while (s.length < n) {
        s += Buffer.from(seed + String(s.length)).toString('base64').replace(/[^A-Za-z0-9+/=]/g, '');
    }
    return `ENC1:${s.slice(0, n)}`;
}

function res(identity: string | null, revision: string | null, citedBy: string[], token: string): Resolved {
    return {
        token,
        url: identity === null ? 'https://example.org/doc' : `https://${identity}`,
        identity,
        revision,
        classification: identity === null ? 'not-a-repository' : 'repository',
        citedBy,
    };
}

describe('4.2 extraction — a prose placeholder is not a token', () => {
    it('matches a real-length token and ignores the bare prefix', () => {
        const root = mkTmp('harvest-extract-');
        const dir = path.join(root, 'agents', 'roadmaps');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'real.md'), `pinned as ${fakeToken('a')} here\n`, 'utf-8');
        fs.writeFileSync(
            path.join(dir, 'prose.md'),
            'Retain real links as `ENC1:` tokens in a Provenance block.\nAlso ENC1:short and ENC1:abcd.\n',
            'utf-8',
        );
        const occ = discover(root);
        expect(occ.map((o) => o.file)).toEqual(['agents/roadmaps/real.md']);
        expect(census(occ).files).toBe(1);
    });

    it('a token split across a line break is not stitched together', () => {
        const root = mkTmp('harvest-extract2-');
        const dir = path.join(root, 'agents', 'roadmaps');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'wrapped.md'), 'ENC1:abcd\nefghijkl\n', 'utf-8');
        expect(discover(root)).toEqual([]);
    });
});

describe('4.2 canonicalization — four spellings, one identity', () => {
    it('collapses HTTPS, .git, SCP and a deep link', () => {
        const spellings = [
            'https://github.com/Owner/Repo',
            'https://github.com/owner/repo.git',
            'git@github.com:Owner/Repo.git',
            'https://github.com/owner/repo/tree/main/docs',
        ];
        const ids = new Set(spellings.map((s) => canonicalize(s)));
        expect(ids).toEqual(new Set(['github.com/owner/repo']));
    });

    it('drops a www prefix and a trailing slash', () => {
        expect(canonicalize('https://www.github.com/owner/repo/')).toBe('github.com/owner/repo');
    });
});

describe('4.2 classification — read the URL, never the prose', () => {
    it('a documentation URL is not a repository', () => {
        expect(classifyUrl('https://docs.example.com/guide/getting-started')).toBe('not-a-repository');
        expect(canonicalize('https://example.org/blog/2026/a-post')).toBeNull();
    });

    it("a repository host's own product surface is not a repository", () => {
        expect(classifyUrl('https://github.com/features/actions')).toBe('not-a-repository');
        expect(classifyUrl('https://github.com/topics/rust')).toBe('not-a-repository');
    });

    it('a .git suffix on an unlisted host is still a repository', () => {
        expect(classifyUrl('https://git.example.com/team/thing.git')).toBe('repository');
    });

    it('a bare host with no owner/repo pair is not a repository', () => {
        expect(classifyUrl('https://github.com/owner')).toBe('not-a-repository');
    });
});

describe('3.1 opaque id — stable at a revision, different across revisions', () => {
    it('is stable across two derivations at the same revision', () => {
        expect(opaqueId('github.com/o/r', 'aaaaaaa')).toBe(opaqueId('github.com/o/r', 'aaaaaaa'));
    });

    it('differs across revisions of one repository', () => {
        expect(opaqueId('github.com/o/r', 'aaaaaaa')).not.toBe(opaqueId('github.com/o/r', 'bbbbbbb'));
    });

    it('is 16 hex characters and carries no plaintext', () => {
        const id = opaqueId('github.com/owner/repo', 'abc1234');
        expect(id).toMatch(/^[0-9a-f]{16}$/u);
        expect(id).not.toContain('owner');
        expect(id).not.toContain('repo');
    });
});

describe('4.3 dedupe — on identity plus revision, never on the token', () => {
    it('two distinct tokens for one repository yield one entry with two citing files', () => {
        const entries = dedupe([
            res('github.com/o/r', 'aaaaaaa', ['agents/roadmaps/archive/one.md'], fakeToken('t1')),
            res('github.com/o/r', 'aaaaaaa', ['agents/roadmaps/later/two.md'], fakeToken('t2')),
        ]);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.cited_by).toEqual(['agents/roadmaps/archive/one.md', 'agents/roadmaps/later/two.md']);
        expect(entries[0]?.tokens).toBe(2);
    });

    it('two revisions of one repository yield two entries', () => {
        const entries = dedupe([
            res('github.com/o/r', 'aaaaaaa', ['a.md'], fakeToken('t1')),
            res('github.com/o/r', 'bbbbbbb', ['b.md'], fakeToken('t2')),
        ]);
        expect(entries).toHaveLength(2);
        expect(new Set(entries.map((e) => e.opaque_id)).size).toBe(2);
    });

    it('a not-a-repository resolution is recorded, never dropped', () => {
        const entries = dedupe([res(null, null, ['a.md'], fakeToken('t3'))]);
        expect(entries).toHaveLength(1);
        expect(entries[0]?.status).toBe('skipped-as-not-a-repository');
    });

    it('extracts a pinned revision from both spellings', () => {
        expect(revisionFrom('https://github.com/o/r@abc1234')).toBe('abc1234');
        expect(revisionFrom('https://github.com/o/r/tree/DEADBEE/x')).toBe('deadbee');
        expect(revisionFrom('https://github.com/o/r')).toBeNull();
    });
});

describe('4.4 manifest — status vocabulary, resume, and the freshness key', () => {
    it('carries every status the contract names', () => {
        expect(STATUSES).toEqual([
            'pending', 'running', 'done',
            'skipped-as-not-a-repository', 'skipped-as-duplicate', 'skipped-as-fresh',
            'blocked-on-missing-key', 'blocked-as-unresolvable', 'failed',
        ]);
    });

    it("the freshness key excludes this package's own revision", () => {
        const e: Entry = {
            opaque_id: 'x', identity: 'github.com/o/r', revision: 'aaaaaaa', status: 'done',
            cited_by: [], tokens: 1, contract_version: CONTRACT_VERSION, loops: 3, focus: null,
            observed_at: '2026-09-07',
        };
        const key = freshnessKey(e);
        expect(key).toContain('github.com/o/r');
        expect(key).toContain('aaaaaaa');
        // Same entry observed on a different day, in a different tree state,
        // keys identically — which is what makes `skipped-as-fresh` reachable.
        expect(freshnessKey({ ...e, observed_at: '2027-01-01' })).toBe(key);
    });

    it('a resumed run does not re-run the repositories already done, and says why', () => {
        const fresh = dedupe([
            res('github.com/o/one', 'r1', ['a.md'], fakeToken('1')),
            res('github.com/o/two', 'r2', ['b.md'], fakeToken('2')),
            res('github.com/o/three', 'r3', ['c.md'], fakeToken('3')),
        ]);
        // The batch was interrupted after the second repository.
        const prior = fresh.slice(0, 2).map((e) => ({ ...e, status: 'done' as const }));
        const plan = planResume(fresh, prior);
        expect(plan.filter((d) => d.run).map((d) => d.entry.identity)).toEqual(['github.com/o/three']);
        const skipped = plan.filter((d) => !d.run);
        expect(skipped.map((d) => d.entry.status)).toEqual(['skipped-as-fresh', 'skipped-as-fresh']);
        for (const d of skipped) {
            expect(d.reason).toMatch(/freshness key unchanged/u);
        }
    });

    it('--refresh overrides the freshness skip and nothing else', () => {
        const fresh = dedupe([res('github.com/o/one', 'r1', ['a.md'], fakeToken('1'))]);
        const prior = fresh.map((e) => ({ ...e, status: 'done' as const }));
        expect(planResume(fresh, prior, false)[0]?.run).toBe(false);
        const forced = planResume(fresh, prior, true)[0];
        expect(forced?.run).toBe(true);
        expect(forced?.reason).toMatch(/--refresh/u);
    });

    it('round-trips through the manifest file', () => {
        const dir = mkTmp('harvest-manifest-');
        const file = path.join(dir, 'manifest.jsonl');
        const entries = dedupe([res('github.com/o/r', 'aaaaaaa', ['a.md'], fakeToken('t'))]);
        fs.writeFileSync(file, renderManifest(entries), 'utf-8');
        expect(readManifest(file)).toEqual(entries);
        expect(readManifest(path.join(dir, 'absent.jsonl'))).toEqual([]);
    });

    it('renders deterministically — two runs, identical bytes', () => {
        const entries = dedupe([
            res('github.com/o/b', 'r', ['b.md'], fakeToken('2')),
            res('github.com/o/a', 'r', ['a.md'], fakeToken('1')),
        ]);
        expect(renderManifest(entries)).toBe(renderManifest(entries.slice().reverse()));
    });
});

describe('5.1 ownership fold — one gap, one roadmap, N registered sources', () => {
    it('two repositories surfacing the same gap produce ONE roadmap with two sources', () => {
        const folds = foldCandidates([
            { opaque_id: 'aaaa000000000000', gap: 'bounded-retry-budgets' },
            { opaque_id: 'bbbb000000000000', gap: 'bounded-retry-budgets' },
        ]);
        expect(folds).toHaveLength(1);
        expect(folds[0]?.roadmap).toBe('agents/roadmaps/road-to-bounded-retry-budgets.md');
        expect(folds[0]?.sources).toEqual(['aaaa000000000000', 'bbbb000000000000']);
        expect(folds[0]?.disposition).toBe('create-new');
    });

    it('three repositories on one gap still produce one roadmap', () => {
        const folds = foldCandidates([
            { opaque_id: 'a1', gap: 'g' }, { opaque_id: 'b2', gap: 'g' }, { opaque_id: 'c3', gap: 'g' },
        ]);
        expect(folds).toHaveLength(1);
        expect(folds[0]?.sources).toHaveLength(3);
    });

    it('two different gaps stay two roadmaps', () => {
        expect(foldCandidates([
            { opaque_id: 'a1', gap: 'one' }, { opaque_id: 'b2', gap: 'two' },
        ])).toHaveLength(2);
    });

    it('a gap an active roadmap already owns folds onto that owner', () => {
        const folds = foldCandidates(
            [{ opaque_id: 'a1', gap: 'already-owned' }],
            new Map([['already-owned', 'agents/roadmaps/road-to-existing.md']]),
        );
        expect(folds[0]?.disposition).toBe('already-planned');
        expect(folds[0]?.roadmap).toBe('agents/roadmaps/road-to-existing.md');
    });
});

describe('3.3 the landed filename names the defect, never the source', () => {
    it('rejects a name carrying the owner or the repository segment', () => {
        const ids = ['github.com/acmecorp/widgetkit'];
        expect(roadmapNameIsSourceFree('agents/roadmaps/adopt-acmecorp-widgetkit.md', ids)).toBe(false);
        expect(roadmapNameIsSourceFree('agents/roadmaps/road-to-widgetkit-parity.md', ids)).toBe(false);
        expect(roadmapNameIsSourceFree('agents/roadmaps/road-to-bounded-retry-budgets.md', ids)).toBe(true);
    });

    it('a fold whose proposed name carries a source identity is contested, never silently renamed', () => {
        const folds = foldCandidates(
            [{ opaque_id: 'a1', gap: 'widgetkit-parity' }],
            new Map(),
            new Map([['a1', 'github.com/acmecorp/widgetkit']]),
        );
        expect(folds[0]?.disposition).toBe('contested');
        expect(folds[0]?.roadmap).toBeNull();
    });

    it('short segments do not cause false positives', () => {
        // `o` and `r` are below the 4-character floor, so a normal English
        // roadmap name is not rejected for containing them.
        expect(roadmapNameIsSourceFree('agents/roadmaps/road-to-observed-order.md', ['github.com/o/r'])).toBe(true);
    });
});

describe('4.1 census — the estate figures the roadmap pinned', () => {
    it('enumerates the five estate levels', () => {
        expect([...ESTATE_LEVELS]).toEqual(['active', 'archive', 'later', 'stubs', 'skipped']);
        expect(levelOf('agents/roadmaps/road-to-x.md')).toBe('active');
        expect(levelOf('agents/roadmaps/archive/road-to-y.md')).toBe('archive');
        expect(levelOf('agents/roadmaps/later/road-to-z.md')).toBe('later');
    });

    it('reproduces the hand-derived census over the real estate', () => {
        const c = census(discover(REPO));
        expect(c.occurrences).toBe(149);
        expect(c.uniqueTokens).toBe(117);
        expect(c.files).toBe(63);
        expect(c.byLevel.archive).toBe(57);
        expect(c.byLevel.later).toBe(6);
        expect(c.byLevel.active).toBe(0);
    });
});

describe('self-test', () => {
    it('passes', () => {
        expect(selfTest()).toBe(0);
    });
});
