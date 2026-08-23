/**
 * `roadmap_context` — the situational-awareness probe.
 *
 * Every assertion here runs OFFLINE: the git/gh reads go through an injected
 * executor, and the roadmap corpus is a temporary tree. That is deliberate and
 * it is the same property the roadmap's D1b defect argues for — the live
 * population halved inside six days, so an assertion pinned to a real PR number
 * would rot before the next release.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    citedPaths,
    emptyRelatesBlock,
    computeOverlaps,
    enumerateRoadmaps,
    inboxNames,
    keywordHits,
    parsePrList,
    probe,
    registerOwnedPaths,
    relatesRowsFromHits,
    renderText,
    roadmapTailBranches,
    slugKeywords,
    type Exec,
    type OverlapSource,
} from '../../src/scripts/roadmap_context.js';
import { register_dir } from '../../src/scripts/_lib/session_register.js';

let root = '';

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'roadmap-context-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const OFFLINE: Exec = () => ({ code: 1, stdout: '' });

/** A real git repo, so `register_dir` resolves and the register assertion is unconditional. */
function initRepo(): void {
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root, stdio: 'ignore' });
}

describe('parsePrList — PR file-set extraction', () => {
    it('extracts number, title, head branch and the changed-file set', () => {
        const raw = JSON.stringify([
            {
                number: 1547,
                title: 'roadmap: complete road-to-ci-supply-chain-integrity',
                headRefName: 'drain/ci-supply-chain',
                files: [{ path: 'src/b.ts' }, { path: 'src/a.ts' }],
            },
        ]);
        expect(parsePrList(raw)).toEqual([
            {
                number: 1547,
                title: 'roadmap: complete road-to-ci-supply-chain-integrity',
                headRefName: 'drain/ci-supply-chain',
                files: ['src/a.ts', 'src/b.ts'],
            },
        ]);
    });

    it('keeps a PR whose file list is missing rather than dropping it', () => {
        const out = parsePrList(JSON.stringify([{ number: 9, title: 't', headRefName: 'h' }]));
        expect(out).toHaveLength(1);
        expect(out[0]!.files).toEqual([]);
    });

    it('returns an empty list for unparseable output instead of throwing', () => {
        expect(parsePrList('not json')).toEqual([]);
        expect(parsePrList('{"not":"an array"}')).toEqual([]);
    });
});

describe('roadmapTailBranches — the branch axis needs no claim', () => {
    it('matches a remote branch carrying an active roadmap slug', () => {
        const out = roadmapTailBranches(
            ['origin/HEAD', 'origin/main', 'origin/drain/road-to-thing-x', 'origin/feat/unrelated'],
            ['road-to-thing-x', 'road-to-other'],
        );
        expect(out).toEqual([{ branch: 'origin/drain/road-to-thing-x', slug: 'road-to-thing-x' }]);
    });

    it('never matches origin/HEAD', () => {
        expect(roadmapTailBranches(['origin/HEAD'], ['HEAD'])).toEqual([]);
    });
});

describe('keywordHits — the semantic axis the filename check cannot see', () => {
    it('finds siblings in all four roadmap directories', () => {
        write('agents/roadmaps/road-to-widget-cache-warmth.md', '# Road to widget cache warmth\n');
        write('agents/roadmaps/later/road-to-cache-warmth-later.md', '# Deferred cache warmth\n');
        write('agents/roadmaps/stubs/road-to-warm-widget-stub.md', '# Widget warmth stub\n');
        write('agents/roadmaps/archive/road-to-widget-warmth-v1.md', '# Widget warmth v1\n');
        write('agents/roadmaps/template.md', '# template\n');

        const entries = enumerateRoadmaps(root);
        expect(entries.map((e) => e.dir).sort()).toEqual(['active', 'archive', 'later', 'stubs']);

        const hits = keywordHits(entries, slugKeywords('road-to-widget-cache-warmth'), 'nope');
        expect(hits.map((h) => h.dir).sort()).toEqual(['active', 'archive', 'later', 'stubs']);
    });

    it('excludes the subject roadmap from its own hit list', () => {
        write('agents/roadmaps/road-to-widget-cache-warmth.md', '# Road to widget cache warmth\n');
        const entries = enumerateRoadmaps(root);
        const subject = 'road-to-widget-cache-warmth';
        expect(keywordHits(entries, slugKeywords(subject), subject)).toEqual([]);
    });

    it('drops `road`/`to` so every roadmap is not a hit on every other', () => {
        expect(slugKeywords('road-to-alpha-beta')).toEqual(['alpha', 'beta']);
    });
});

describe('inboxNames — names only, never contents', () => {
    it('reports the file names and never reads the bodies', () => {
        write('agents/tmp/idea-one.md', 'PRIVATE-SCRATCH-BODY');
        write('agents/tmp/.hidden', 'x');
        expect(inboxNames(root)).toEqual(['idea-one.md']);

        const ctx = probe({ repoRoot: root, exec: OFFLINE });
        expect(JSON.stringify(ctx)).not.toContain('PRIVATE-SCRATCH-BODY');
        expect(ctx.inbox_files).toEqual(['idea-one.md']);
    });

    it('reports an empty list when agents/tmp does not exist', () => {
        expect(inboxNames(root)).toEqual([]);
    });
});

describe('offline path — degrade, never refuse', () => {
    it('reports network unavailable, an empty PR set, and still renders', () => {
        const ctx = probe({ repoRoot: root, exec: OFFLINE });
        expect(ctx.network).toBe('unavailable');
        expect(ctx.open_prs).toEqual([]);
        expect(renderText(ctx)).toContain('scanned: 0 PRs (network unavailable)');
    });

    it('reports network live only when both the fetch and the PR read succeed', () => {
        const halfUp: Exec = (cmd) => (cmd === 'gh' ? { code: 0, stdout: '[]' } : { code: 1, stdout: '' });
        expect(probe({ repoRoot: root, exec: halfUp }).network).toBe('unavailable');
    });
});

describe('computeOverlaps — pinned to a fixture, never to a live PR number', () => {
    const prs = [
        { number: 1546, title: 'a', headRefName: 'x', files: ['src/config/budget.json', 'README.md'] },
        { number: 1547, title: 'b', headRefName: 'y', files: ['src/scripts/other.ts'] },
    ];

    it('pairs a roadmap with each PR it shares a path with, and labels the source', () => {
        const owned = new Map<string, { paths: string[]; source: OverlapSource }>([
            ['road-to-org-pack-fitness', { paths: ['src/config/budget.json'], source: 'cited-path' }],
        ]);
        expect(computeOverlaps(owned, prs)).toEqual([
            {
                roadmap: 'road-to-org-pack-fitness',
                pr: 1546,
                paths: ['src/config/budget.json'],
                source: 'cited-path',
            },
        ]);
    });

    it('labels a pre-scan set as authoritative rather than heuristic', () => {
        const owned = new Map<string, { paths: string[]; source: OverlapSource }>([
            ['road-to-x', { paths: ['src/scripts/other.ts'], source: 'pre-scan' }],
        ]);
        expect(computeOverlaps(owned, prs).map((o) => o.source)).toEqual(['pre-scan']);
    });

    it('reports nothing when the sets are disjoint', () => {
        const owned = new Map<string, { paths: string[]; source: OverlapSource }>([
            ['road-to-x', { paths: ['src/nowhere.ts'], source: 'pre-scan' }],
        ]);
        expect(computeOverlaps(owned, prs)).toEqual([]);
    });
});

describe('citedPaths — the labelled fallback', () => {
    it('extracts backticked repo paths and skips traversal', () => {
        const text = 'edit `src/scripts/a.ts` and `docs/b.md`, not `../escape/c.ts` nor `plainword`';
        expect(citedPaths(text)).toEqual(['docs/b.md', 'src/scripts/a.ts']);
    });
});

describe('probe wiring — the fallback source is used and labelled', () => {
    it('derives owned paths from the roadmap body when no pre-scan set exists', () => {
        write('agents/roadmaps/road-to-thing.md', '# Road to thing\n\nTouch `src/scripts/thing.ts`.\n');
        const exec: Exec = (cmd, args) =>
            cmd === 'gh'
                ? {
                      code: 0,
                      stdout: JSON.stringify([
                          { number: 42, title: 't', headRefName: 'h', files: ['src/scripts/thing.ts'] },
                      ]),
                  }
                : { code: 0, stdout: args.includes('for-each-ref') ? 'origin/main\n' : '' };
        const ctx = probe({ repoRoot: root, roadmap: 'road-to-thing', exec });
        expect(ctx.overlaps).toEqual([
            { roadmap: 'road-to-thing', pr: 42, paths: ['src/scripts/thing.ts'], source: 'cited-path' },
        ]);
    });

    it('prefers an injected pre-scan set over the heuristic', () => {
        write('agents/roadmaps/road-to-thing.md', '# Road to thing\n\nTouch `src/scripts/thing.ts`.\n');
        const exec: Exec = (cmd) =>
            cmd === 'gh'
                ? {
                      code: 0,
                      stdout: JSON.stringify([
                          { number: 42, title: 't', headRefName: 'h', files: ['src/scripts/owned.ts'] },
                      ]),
                  }
                : { code: 0, stdout: '' };
        const ctx = probe({
            repoRoot: root,
            roadmap: 'road-to-thing',
            exec,
            ownedPaths: new Map([['road-to-thing', ['src/scripts/owned.ts']]]),
        });
        expect(ctx.overlaps).toEqual([
            { roadmap: 'road-to-thing', pr: 42, paths: ['src/scripts/owned.ts'], source: 'pre-scan' },
        ]);
    });
});

describe('registerOwnedPaths — the pre-scan set becomes readable, never re-derived', () => {
    it('maps a slug to the paths a live session published, deduped and sorted', () => {
        const out = registerOwnedPaths([
            { roadmap_slug: 'road-to-a', owned_paths: ['src/b.ts', 'src/a.ts'] },
            { roadmap_slug: 'road-to-a', owned_paths: ['src/a.ts', 'src/c.ts'] },
            { roadmap_slug: null, owned_paths: ['src/x.ts'] },
            { roadmap_slug: 'road-to-b' },
            'not a record',
        ]);
        expect([...out.entries()]).toEqual([['road-to-a', ['src/a.ts', 'src/b.ts', 'src/c.ts']]]);
    });

    it('labels a register-sourced set as pre-scan, outranking the cited-path heuristic', () => {
        initRepo();
        write('agents/roadmaps/road-to-thing.md', '# Road to thing\n\nTouch `src/scripts/cited.ts`.\n');
        const exec: Exec = (cmd) =>
            cmd === 'gh'
                ? {
                      code: 0,
                      stdout: JSON.stringify([
                          {
                              number: 7,
                              title: 't',
                              headRefName: 'h',
                              files: ['src/scripts/cited.ts', 'src/scripts/declared.ts'],
                          },
                      ]),
                  }
                : { code: 0, stdout: '' };
        const reg = register_dir(root);
        expect(reg).not.toBeNull();
        fs.mkdirSync(reg as string, { recursive: true });
        fs.writeFileSync(
            path.join(reg as string, 'peer.json'),
            JSON.stringify({
                session_id: 'peer',
                platform: 'claude',
                worktree: root,
                branch: 'main',
                roadmap_slug: 'road-to-thing',
                started_at: new Date().toISOString(),
                last_seen: new Date().toISOString(),
                owned_paths: ['src/scripts/declared.ts'],
            }),
        );
        const ctx = probe({ repoRoot: root, roadmap: 'road-to-thing', exec });
        // The register set wins: the cited-path file is NOT in the pair, and the
        // label says which source answered.
        expect(ctx.overlaps).toEqual([
            {
                roadmap: 'road-to-thing',
                pr: 7,
                paths: ['src/scripts/declared.ts'],
                source: 'pre-scan',
            },
        ]);
    });
});

describe('relates: emission — road-to-roadmap-situational-awareness § 4.4', () => {
    it('zero hits produces relates: [] carrying the scanned: line', () => {
        expect(emptyRelatesBlock(716)).toBe(
            'relates: []   # scanned: 716 roadmap file(s), 0 sibling hits',
        );
        expect(relatesRowsFromHits([], new Map())).toBe('relates: []');
    });

    it('one sibling hit produces a row naming that sibling', () => {
        const hits = [
            { slug: 'road-to-sibling', path: 'agents/roadmaps/later/road-to-sibling.md', dir: 'later' as const, matched: ['cache', 'warmth'] },
        ];
        const block = relatesRowsFromHits(hits, new Map([['road-to-sibling', 'extends' as const]]));
        expect(block).toBe(
            [
                'relates:',
                '  - slug: road-to-sibling',
                '    relation: extends',
                '    note: "probe hit in later/ on [cache warmth]"',
            ].join('\n'),
        );
    });

    it('an unanswered hit is emitted and LABELLED, never silently dropped', () => {
        const hits = [
            { slug: 'road-to-sibling', path: 'p', dir: 'active' as const, matched: ['x'] },
        ];
        const block = relatesRowsFromHits(hits, new Map());
        expect(block).toContain('road-to-sibling');
        expect(block).toContain('UNANSWERED');
    });

    it('the emitted block is accepted by the relates: linter', async () => {
        const lint = await import('../../src/scripts/lint_roadmap_complexity.js');
        const problems: string[] = [];
        lint._check_relates(
            `complexity: lightweight\n${relatesRowsFromHits(
                [{ slug: 'road-to-s', path: 'p', dir: 'active' as const, matched: ['x'] }],
                new Map([['road-to-s', 'supersedes' as const]]),
            )}`,
            problems,
        );
        expect(problems).toEqual([]);

        const empty: string[] = [];
        lint._check_relates(`complexity: lightweight\n${emptyRelatesBlock(9)}`, empty);
        expect(empty).toEqual([]);
    });
});
