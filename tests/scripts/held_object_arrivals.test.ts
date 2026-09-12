import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    ARRIVAL_RE,
    blockerCitations,
    check,
    scan,
} from '../../src/scripts/check_held_object_arrivals.js';
import {
    countRounds,
    findHeldObject,
    mainCheckoutOf,
    report,
    resolveTree,
    slugPattern,
} from '../../src/scripts/report_held_object_arrivals.js';

/**
 * Both polarities on every rule. A check whose firing direction is never
 * exercised has unknown sensitivity — it can be green because the corpus is
 * clean or because it reads nothing, and a passing suite cannot tell those
 * apart.
 */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'held-arrivals-test-'));

afterAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
});

let seq = 0;
function freshDir(): string {
    seq += 1;
    const dir = path.join(TMP, `case-${String(seq)}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function write(root: string, rel: string, body: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
}

const HELD_PLAIN = '# Stub: a held subject\n\nbody\n';
const HELD_COUNTED =
    '# Stub: a held subject\n\n' +
    '> **Arrivals:** 4 — latest `round-d` (2026-01-04); earlier `round-a`, `round-b`.\n\nbody\n';
const CITER_BLOCKED =
    '# Road to live work\n\n## Phase 1\n\n- [ ] 1.1 x\n\n## Blockers\n\n' +
    '### blocker: the held thing\n- **Status:** open\n' +
    '- **What to do:** read `stubs/road-to-held.md`.\n';

function estate(opts: { heldBody?: string; citer?: string | null; later?: string | null }): string {
    const root = freshDir();
    write(root, 'agents/roadmaps/stubs/road-to-held.md', opts.heldBody ?? HELD_PLAIN);
    if (opts.citer !== null && opts.citer !== undefined) {
        write(root, 'agents/roadmaps/road-to-live.md', opts.citer);
    }
    if (opts.later !== null && opts.later !== undefined) {
        write(root, 'agents/roadmaps/later/road-to-parked.md', opts.later);
    }
    fs.mkdirSync(path.join(root, 'agents/roadmaps/later'), { recursive: true });
    return root;
}

// --- the reporter -----------------------------------------------------------

describe('report_held_object_arrivals — the round is the unit', () => {
    function tree(spec: Record<string, string | Record<string, string>>): string {
        const root = path.join(freshDir(), 'tmp.old');
        fs.mkdirSync(root, { recursive: true });
        for (const [name, content] of Object.entries(spec)) {
            if (typeof content === 'string') {
                fs.writeFileSync(path.join(root, name), content);
            } else {
                for (const [inner, body] of Object.entries(content)) {
                    const p = path.join(root, name, inner);
                    fs.mkdirSync(path.dirname(p), { recursive: true });
                    fs.writeFileSync(p, body);
                }
            }
        }
        return root;
    }

    it('counts a round directory once however many of its files match', () => {
        const t = tree({
            'round-a': { 'one.md': 'the subject', 'two.md': 'the subject', 'deep/three.md': 'the subject' },
        });
        const got = countRounds(t, /the subject/);
        expect(got.matches).toEqual([{ name: 'round-a', kind: 'dir' }]);
        expect(got.examined).toBe(1);
    });

    it('counts distinct rounds, so three rounds read as three and not as their file total', () => {
        const t = tree({
            'round-a': { 'x.md': 'the subject', 'y.md': 'the subject' },
            'round-b': { 'x.md': 'the subject' },
            'round-c': { 'x.md': 'something else entirely' },
            'loose.txt': 'the subject',
        });
        const got = countRounds(t, /the subject/);
        expect(got.matches.map((m) => m.name)).toEqual(['loose.txt', 'round-a', 'round-b']);
        expect(got.matches.filter((m) => m.kind === 'dir')).toHaveLength(2);
        expect(got.examined).toBe(4);
    });

    it('a round that does not raise the subject is not counted', () => {
        const t = tree({ 'round-a': { 'x.md': 'unrelated' } });
        expect(countRounds(t, /the subject/).matches).toHaveLength(0);
    });

    it('reports an absent tree as unreadable rather than as zero arrivals', () => {
        const root = estate({ citer: null });
        const res = report(['road-to-held', '--pattern', 'anything'], root);
        expect(res.exit).toBe(0);
        expect(res.text).toContain('no prior rounds readable');
        expect(res.text).not.toMatch(/arrivals: 0\b/);
    });

    it('reports a present tree with a count and the rounds behind it', () => {
        const root = estate({ citer: null });
        write(root, 'agents/tmp.old/round-a/x.md', 'the subject');
        write(root, 'agents/tmp.old/round-b/x.md', 'the subject');
        write(root, 'agents/tmp.old/round-c/x.md', 'unrelated');
        const res = report(['road-to-held', '--pattern', 'the subject'], root);
        expect(res.exit).toBe(0);
        expect(res.text).toContain('arrivals: 2 distinct round(s) of 3 examined');
        expect(res.text).toContain('round-a');
        expect(res.text).not.toContain('no prior rounds readable');
    });

    it('is case-sensitive by default and folds case only on request', () => {
        const root = estate({ citer: null });
        write(root, 'agents/tmp.old/round-a/x.md', 'The Subject');
        expect(report(['road-to-held', '--pattern', 'the subject'], root).text).toContain(
            'arrivals: 0 distinct round(s)',
        );
        expect(
            report(['road-to-held', '--pattern', 'the subject', '--ignore-case'], root).text,
        ).toContain('arrivals: 1 distinct round(s)');
    });

    it('prefers a pattern the object declares over one derived from its slug', () => {
        const root = freshDir();
        write(
            root,
            'agents/roadmaps/stubs/road-to-held.md',
            '# Stub\n\n<!-- arrival-subject: widget|sprocket -->\n\nbody\n',
        );
        const obj = findHeldObject(root, 'road-to-held');
        expect(obj?.declared).toBe('widget|sprocket');
        write(root, 'agents/tmp.old/round-a/x.md', 'a sprocket arrived');
        const res = report(['road-to-held'], root);
        expect(res.text).toContain('declared on the object itself');
        expect(res.text).toContain('arrivals: 1 distinct round(s)');
    });

    it('falls back to a slug pattern and says the figure is slug-derived', () => {
        const root = estate({ citer: null });
        write(root, 'agents/tmp.old/round-a/x.md', 'a held subject appears here');
        const res = report(['road-to-held'], root);
        expect(slugPattern('road-to-held')).toBe('held');
        expect(res.text).toContain('derived from the slug');
    });

    it('resolves the tree from an explicit flag ahead of the repository root', () => {
        const root = estate({ citer: null });
        write(root, 'agents/tmp.old/round-a/x.md', 'the subject');
        const other = path.join(freshDir(), 'elsewhere');
        fs.mkdirSync(path.join(other, 'round-b'), { recursive: true });
        fs.writeFileSync(path.join(other, 'round-b', 'x.md'), 'the subject');
        const resolved = resolveTree({ root, flag: other, env: {} });
        expect(resolved.origin).toBe('flag');
        expect(resolved.dir).toBe(other);
    });

    /**
     * The override, exercised through the entry point rather than through
     * `resolveTree` alone. A `--tree` that merely led a candidate chain would
     * fall through to the readable tree beside it, and then the unreadable
     * branch could not be reached on any machine where a real tree exists —
     * which is every machine this runs on.
     */
    it('an explicitly named unreadable tree does not fall through to a readable one', () => {
        const root = estate({ citer: null });
        write(root, 'agents/tmp.old/round-a91f3c/x.md', 'the subject');
        expect(report(['road-to-held', '--pattern', 'the subject'], root).text).toContain(
            'arrivals: 1 distinct round(s)',
        );
        const res = report(
            ['road-to-held', '--pattern', 'the subject', '--tree', path.join(root, 'no-such-tree')],
            root,
        );
        expect(res.exit).toBe(0);
        expect(res.text).toContain('no prior rounds readable');
        // Anchored: the honesty prose itself contains the phrase "zero
        // arrivals:", so an unanchored match would pass on the wrong line.
        expect(res.text).not.toMatch(/^arrivals:/m);
    });

    it('an explicitly set environment tree overrides on the same terms', () => {
        const root = estate({ citer: null });
        write(root, 'agents/tmp.old/round-a91f3c/x.md', 'the subject');
        const resolved = resolveTree({
            root,
            env: { AGENT_CONFIG_INBOX_TREE: path.join(root, 'no-such-tree') },
        });
        expect(resolved.origin).toBe('unreadable');
        expect(resolved.dir).toBeNull();
        expect(resolved.tried).toHaveLength(1);
    });

    it('the flag wins over the environment when both are given', () => {
        const root = freshDir();
        const named = path.join(root, 'named');
        fs.mkdirSync(named, { recursive: true });
        const resolved = resolveTree({
            root,
            flag: named,
            env: { AGENT_CONFIG_INBOX_TREE: path.join(root, 'other') },
        });
        expect(resolved.origin).toBe('flag');
    });

    it('falls through to the main checkout when this root is a linked worktree', () => {
        const main = freshDir();
        fs.mkdirSync(path.join(main, '.git', 'worktrees', 'wt'), { recursive: true });
        fs.mkdirSync(path.join(main, 'agents', 'tmp.old'), { recursive: true });
        const wt = freshDir();
        fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'wt')}\n`);
        expect(mainCheckoutOf(wt)).toBe(main);
        const resolved = resolveTree({ root: wt, env: {} });
        expect(resolved.origin).toBe('main-checkout');
    });

    it('a plain checkout has no main checkout behind it', () => {
        const root = freshDir();
        fs.mkdirSync(path.join(root, '.git'), { recursive: true });
        expect(mainCheckoutOf(root)).toBeNull();
    });

    it('writes nothing — the source carries no write call', () => {
        const src = fs.readFileSync(
            path.resolve(__dirname, '..', '..', 'src/scripts/report_held_object_arrivals.ts'),
            'utf8',
        );
        expect(src).not.toMatch(/writeFile|mkdir|appendFile/);
    });
});

// --- the check --------------------------------------------------------------

describe('check_held_object_arrivals — citation is the discriminator', () => {
    it('fires on a held object cited inside a blocker with no arrival line', () => {
        const root = estate({ citer: CITER_BLOCKED });
        const res = scan(root);
        expect(res.cited).toBe(1);
        expect(res.findings.map((f) => f.held)).toEqual(['agents/roadmaps/stubs/road-to-held.md']);
    });

    it('stays silent on a first-arrival held object nobody has cited', () => {
        const root = estate({ citer: '# Road to live work\n\n## Phase 1\n\n- [ ] 1.1 x\n' });
        const res = scan(root);
        expect(res.cited).toBe(0);
        expect(res.findings).toHaveLength(0);
        expect(res.held).toBeGreaterThan(0);
    });

    it('stays silent on a mention outside blocker scope', () => {
        const root = estate({
            citer: '# Road to live work\n\n## Phase 1\n\n- [ ] 1.1 see `stubs/road-to-held.md`\n',
        });
        expect(scan(root).findings).toHaveLength(0);
    });

    it('stays silent once the cited object carries its arrival line', () => {
        const root = estate({ heldBody: HELD_COUNTED, citer: CITER_BLOCKED });
        const res = scan(root);
        expect(res.cited).toBe(1);
        expect(res.findings).toHaveLength(0);
    });

    it('closes blocker scope at the next top-level heading', () => {
        const cites = blockerCitations(
            '## Blockers\n\n### blocker: a\n- see `stubs/inside.md`\n\n' +
                '## Acceptance Criteria\n\n- see `stubs/outside.md`\n',
        );
        expect([...cites]).toEqual(['inside.md']);
    });

    it('opens blocker scope on a bare blocker heading with no Blockers section above it', () => {
        expect([...blockerCitations('### blocker: a\n- see `later/x.md`\n')]).toEqual(['x.md']);
    });

    it('does not count a parked roadmap citing itself', () => {
        const root = freshDir();
        write(
            root,
            'agents/roadmaps/later/road-to-parked.md',
            '# Parked\n\n## Blockers\n\n### blocker: a\n- see `later/road-to-parked.md`\n',
        );
        fs.mkdirSync(path.join(root, 'agents/roadmaps/stubs'), { recursive: true });
        expect(scan(root).cited).toBe(0);
    });

    it('treats a parked roadmap as a live citer', () => {
        const root = estate({
            citer: null,
            later: '# Parked\n\n## Blockers\n\n### blocker: a\n- see `stubs/road-to-held.md`\n',
        });
        expect(scan(root).findings.map((f) => f.held)).toEqual([
            'agents/roadmaps/stubs/road-to-held.md',
        ]);
    });

    it('is advisory by default and fails only under --enforce', () => {
        const root = estate({ citer: CITER_BLOCKED });
        const seen: string[] = [];
        const sink = (c: string): boolean => {
            seen.push(c);
            return true;
        };
        expect(check(root, false, sink)).toBe(0);
        expect(seen.join('')).toContain('Advisory: exiting 0');
        expect(check(root, true, sink)).toBe(1);
    });

    it('refuses a dead scope rather than reporting it clean', () => {
        const root = freshDir();
        fs.mkdirSync(path.join(root, 'agents/roadmaps'), { recursive: true });
        const seen: string[] = [];
        expect(
            check(root, false, (c: string) => {
                seen.push(c);
                return true;
            }),
        ).toBe(2);
        expect(seen.join('')).toContain('no held objects found');
    });

    // The defect this pins: `listMarkdown` used to swallow a failed readdir
    // into `[]`, so a citer root that had moved produced zero citations, zero
    // findings, and an affirmative green — exit 0 even under --enforce, with a
    // real uncounted citation one directory away. The held corpus stays
    // readable when only a citer root moves, so the `res.held === 0` guard
    // never reached it.
    it('refuses an unreadable citer root instead of reporting nothing cited', () => {
        const root = estate({ citer: CITER_BLOCKED });
        // Remove the active-roadmaps citer root while the held corpus and the
        // parked citer root stay intact — the asymmetry the old guard missed.
        fs.rmSync(path.join(root, 'agents/roadmaps/road-to-live.md'));
        const marker = path.join(root, 'agents/roadmaps');
        const moved = path.join(root, 'agents/roadmaps-moved');
        fs.renameSync(path.join(root, 'agents/roadmaps/stubs'), path.join(root, 'agents/stubs-keep'));
        fs.renameSync(path.join(root, 'agents/roadmaps/later'), path.join(root, 'agents/later-keep'));
        fs.rmSync(marker, { recursive: true });
        fs.mkdirSync(moved, { recursive: true });
        fs.renameSync(path.join(root, 'agents/stubs-keep'), path.join(moved, 'stubs'));
        fs.renameSync(path.join(root, 'agents/later-keep'), path.join(moved, 'later'));

        const seen: string[] = [];
        const sink = (c: string): boolean => {
            seen.push(c);
            return true;
        };
        // Both roots are gone here, so the held guard speaks first — which is
        // correct, and is why the next case isolates the citer-only shape.
        expect(check(root, true, sink)).toBe(2);
    });

    it('separates an empty citer root from an unreadable one', () => {
        // An empty `later/` is a real estate state — nothing is parked — and
        // must stay green. Only an unreadable root is a failed measurement.
        const readable = estate({ citer: CITER_BLOCKED, later: null });
        expect(scan(readable).deadCiterRoots).toEqual([]);

        const broken = estate({ citer: CITER_BLOCKED });
        fs.rmSync(path.join(broken, 'agents/roadmaps/later'), { recursive: true });
        expect(scan(broken).deadCiterRoots).toEqual(['agents/roadmaps/later']);

        const seen: string[] = [];
        expect(
            check(broken, false, (c: string) => {
                seen.push(c);
                return true;
            }),
        ).toBe(2);
        expect(seen.join('')).toContain('citer root(s) unreadable');
        // Advisory does not soften it: an unmeasured scope is never a pass.
        expect(seen.join('')).not.toContain('Advisory: exiting 0');
    });

    it('does not open blocker scope from inside a code fence', () => {
        // A roadmap that documents the blocker shape by quoting it used to put
        // the whole rest of its section into blocker scope, so an illustrative
        // mention counted as a live citation.
        const fenced = [
            '# Roadmap',
            '',
            '## Phase 1',
            '',
            'Blockers look like this:',
            '',
            '```markdown',
            '### blocker: template',
            '- **Status:** open',
            '```',
            '',
            '- a step naming `stubs/road-to-held.md` in passing',
            '',
        ].join('\n');
        expect(blockerCitations(fenced).size).toBe(0);

        // The real shape still opens scope — the fix must not close the door.
        const real = '# R\n\n## Blockers\n\n### blocker: a\n- see `stubs/road-to-held.md`\n';
        expect([...blockerCitations(real)]).toEqual(['road-to-held.md']);
    });

    it('recognises the arrival line only in its published shape', () => {
        expect(ARRIVAL_RE.test('> **Arrivals:** 4 — latest `round-d`.')).toBe(true);
        expect(ARRIVAL_RE.test('Arrivals: 4')).toBe(false);
        expect(ARRIVAL_RE.test('> **Arrivals:**')).toBe(false);
    });
});
