// The obligation-carrier census — `src/scripts/report_obligation_carriers.ts`.
//
// Every expectation below is derived from a fixture tree built in the test, not
// from a number read off a live run: the live corpus moves every week, and a
// census pinned to today's count would go red on somebody else's rule edit while
// proving nothing about the matcher.
//
// Two properties carry the whole report and both are asserted in the failing
// direction as well as the passing one.
//
// First, identity is STRUCTURAL. Six verdicts are pinned — three obligations
// that are duplicated and three that are not — because a matcher that finds
// duplicates everywhere is as useless as one that finds none, and only the pair
// distinguishes them.
//
// Second, the matcher was seen UNDER-COUNTING before it was trusted. The
// fence-identity anchor alone is blind to this tree's dominant duplication shape:
// a migration stub restating a law in prose beside the artifact that now holds
// the body, which has no fence to compare. `underCount` below plants exactly that
// case and pins the count under the blind definition (1) against the count under
// the fixed one (2). A census never seen under-count has unknown sensitivity, so
// deleting this case must break the suite rather than quietly widen it.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    CANONICAL_OF,
    CARRIER_CLASSES,
    census,
    crossRefTokens,
    EXCLUDED_CLASSES,
    extractStatements,
    headerLines,
    main,
    MIGRATED_TO,
    normaliseStatement,
    resolveToken,
} from '../../src/scripts/report_obligation_carriers.js';

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'oblig-carriers-'));
    tmps.push(d);
    return d;
}

function write(root: string, rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body, 'utf-8');
}

afterEach(() => {
    while (tmps.length > 0) {
        const d = tmps.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

/** A fenced Iron Law, wrapped however the caller wants it wrapped. */
function fenced(heading: string, body: string): string {
    return `# ${heading}\n\n## The Iron Law\n\n\`\`\`\n${body}\n\`\`\`\n`;
}

/**
 * The six-verdict fixture: three obligations duplicated, three not, one per anchor.
 *
 * DUPLICATED
 *   alpha   fence-identity           — the same fence text in a rule and a contract,
 *                                      wrapped differently, so the match cannot be
 *                                      a byte comparison of the raw block.
 *   beta    explicit-cross-reference — a migration stub plus the skill it named.
 *   gamma   named-slug               — a second rule naming gamma as canonical.
 *
 * NOT DUPLICATED
 *   delta   a lone fenced law nothing points at.
 *   epsilon a law whose text merely RESEMBLES alpha's — same subject, different
 *           words. A similarity matcher would fuse it with alpha; a structural one
 *           must not, and this is the case that says so.
 *   zeta    a rule that LINKS gamma in ordinary prose without a canonicality
 *           claim. Rules link each other constantly; a link is not a carrier claim.
 */
function sixVerdictRoot(): string {
    const root = tmpdir();
    write(root, 'src/rules/alpha.md', fenced('Alpha', 'NEVER SHIP A CHANGE\nWITHOUT ITS TEST.'));
    write(
        root,
        'docs/contracts/alpha-pilot.md',
        fenced('Alpha pilot', 'NEVER SHIP A CHANGE WITHOUT ITS TEST.'),
    );
    write(
        root,
        'src/rules/beta.md',
        '# Beta\n\n**Iron Law.** Run the suite in the container, never on the host.\n\n' +
            'Body migrated to `skill:beta-runner` (per the P4 pattern).\n',
    );
    write(root, 'src/skills/beta-runner/SKILL.md', '# beta-runner\n\nThe procedure.\n');
    write(root, 'src/rules/gamma.md', fenced('Gamma', 'THE FLOOR OVERRIDES EVERYTHING.'));
    write(
        root,
        'src/rules/gamma-echo.md',
        '# Gamma echo\n\n## Hard floor\n\nA subset is never autonomous. Canonical: [`gamma`](gamma.md).\n',
    );
    write(root, 'src/rules/delta.md', fenced('Delta', 'ONE QUESTION PER TURN.'));
    write(
        root,
        'src/rules/epsilon.md',
        fenced('Epsilon', 'A CHANGE WITHOUT A TEST MUST NEVER BE SHIPPED.'),
    );
    write(
        root,
        'src/rules/zeta.md',
        fenced('Zeta', 'ALWAYS READ THE DIFF.') + '\nSee [`gamma`](gamma.md) for the floor.\n',
    );
    return root;
}

function countFor(root: string, slug: string, anchors?: readonly string[]): number {
    const opts = anchors === undefined ? {} : { anchors: anchors as never };
    const rows = census(root, opts).rows.filter((r) => r.slug === slug);
    return rows.reduce((max, r) => Math.max(max, r.count), 0);
}

describe('normaliseStatement — line wrapping is not an identity difference', () => {
    it('collapses newlines, so the same law wrapped differently still matches', () => {
        expect(normaliseStatement('NEVER SHIP A CHANGE\nWITHOUT ITS TEST.')).toBe(
            normaliseStatement('NEVER SHIP A CHANGE WITHOUT ITS TEST.'),
        );
    });

    it('does NOT collapse two different laws into one', () => {
        expect(normaliseStatement('ALWAYS ASK FIRST.')).not.toBe(
            normaliseStatement('ALWAYS ASK SECOND.'),
        );
    });
});

describe('crossRefTokens — directional, and slug-shaped', () => {
    it('reads a migration pointer in both link and bare-backtick form', () => {
        expect(
            crossRefTokens('Body migrated to [`skill:docker`](../skills/docker/SKILL.md).', MIGRATED_TO),
        ).toEqual(['skill:docker']);
        expect(crossRefTokens('Body merged into `brand-source-of-truth`.', MIGRATED_TO)).toEqual([
            'brand-source-of-truth',
        ]);
    });

    it('strips a trailing section marker so the token still resolves', () => {
        expect(
            crossRefTokens('Body migrated to [`skill:authz-review` § Depth](x.md).', MIGRATED_TO),
        ).toEqual(['skill:authz-review']);
    });

    it('rejects a non-slug token — the live false positive that forced the shape check', () => {
        // `roadmap-progress-mechanics` says "canonical `Phase <id>` form parsed by
        // the dashboard": a claim about a heading format, not about a carrier. The
        // first version of this matcher read it as one and reported that obligation
        // as carried by three artifacts, two of them `unknown`.
        expect(crossRefTokens('canonical `Phase <id>` form parsed by the dashboard', CANONICAL_OF)).toEqual([]);
        expect(crossRefTokens('zero canonical `Phase` headings', CANONICAL_OF)).toEqual([]);
    });

    it('does not read a migration pointer as a canonicality claim, or the reverse', () => {
        expect(crossRefTokens('Body migrated to `skill:docker`.', CANONICAL_OF)).toEqual([]);
        expect(crossRefTokens('Canonical: [`commit-policy`](x.md).', MIGRATED_TO)).toEqual([]);
    });
});

describe('resolveToken — the four prefixes, and an honest null', () => {
    it('resolves each prefix to a real file and nothing else', () => {
        const root = tmpdir();
        write(root, 'src/skills/alpha/SKILL.md', 'x');
        write(root, 'docs/guidelines/agent-infra/beta.md', 'x');
        write(root, 'src/agent-src/contexts/execution/gamma.md', 'x');
        write(root, 'docs/contracts/delta.md', 'x');
        write(root, 'src/rules/epsilon.md', 'x');
        expect(resolveToken(root, 'skill:alpha')).toBe(path.join('src', 'skills', 'alpha', 'SKILL.md'));
        expect(resolveToken(root, 'guideline:agent-infra/beta')).toBe(
            path.join('docs', 'guidelines', 'agent-infra', 'beta.md'),
        );
        expect(resolveToken(root, 'contexts/execution/gamma')).toBe(
            path.join('src', 'agent-src', 'contexts', 'execution', 'gamma.md'),
        );
        expect(resolveToken(root, 'docs/contracts/delta')).toBe(path.join('docs', 'contracts', 'delta.md'));
        expect(resolveToken(root, 'epsilon')).toBe(path.join('src', 'rules', 'epsilon.md'));
    });

    it('returns null rather than inventing a path — the `unknown` carrier', () => {
        expect(resolveToken(tmpdir(), 'skill:nothing-here')).toBeNull();
    });
});

describe('extractStatements — the two structural forms', () => {
    it('reads a fenced law under an Iron Law heading', () => {
        const st = extractStatements('rule', 'src/rules/a.md', fenced('A', 'NEVER DO X.'));
        expect(st).toHaveLength(1);
        expect(st[0]?.form).toBe('fence');
    });

    it('reads an inline restatement as a pointer, not a fence', () => {
        const st = extractStatements('rule', 'src/rules/a.md', '# A\n\n**Iron Law.** Never do X.\n');
        expect(st[0]?.form).toBe('pointer');
    });

    it('ignores an Iron Law heading whose section carries no fence', () => {
        // `scope-control` has prose sections referring to Iron Laws elsewhere. A
        // heading alone states nothing, so it must not create a phantom obligation.
        expect(extractStatements('rule', 'src/rules/a.md', '# A\n\n## Iron Law\n\nSee elsewhere.\n')).toEqual([]);
    });
});

describe('the six verdicts — three duplicated, three not', () => {
    it('finds alpha duplicated by fence identity across different wrapping', () => {
        const root = sixVerdictRoot();
        const row = census(root).rows.find((r) => r.slug === 'alpha');
        expect(row?.count).toBe(2);
        expect(row?.carriers.map((c) => c.anchor)).toEqual(['statement', 'fence-identity']);
    });

    it('finds beta duplicated by its own migration pointer', () => {
        const row = census(sixVerdictRoot()).rows.find((r) => r.slug === 'beta');
        expect(row?.count).toBe(2);
        expect(row?.carriers.map((c) => c.path)).toContain(
            path.join('src', 'skills', 'beta-runner', 'SKILL.md'),
        );
    });

    it('finds gamma duplicated by the rule that names it canonical', () => {
        const row = census(sixVerdictRoot()).rows.find((r) => r.slug === 'gamma');
        expect(row?.count).toBe(2);
        expect(row?.carriers.at(1)).toMatchObject({
            path: path.join('src', 'rules', 'gamma-echo.md'),
            anchor: 'named-slug',
        });
    });

    it('leaves delta alone — nothing points at it', () => {
        expect(countFor(sixVerdictRoot(), 'delta')).toBe(1);
    });

    it('leaves epsilon alone although it resembles alpha — no similarity score decides a match', () => {
        expect(countFor(sixVerdictRoot(), 'epsilon')).toBe(1);
    });

    it('leaves zeta alone — a bare link is not a carrier claim', () => {
        expect(countFor(sixVerdictRoot(), 'zeta')).toBe(1);
    });
});

describe('unknown — an unresolvable pointer is recorded, never dropped', () => {
    it('counts the pointer as a carrier of unknown location and flags the row', () => {
        const root = tmpdir();
        write(
            root,
            'src/rules/orphan.md',
            '# Orphan\n\n**Iron Law.** Do the thing.\n\nBody migrated to `skill:never-built`.\n',
        );
        const row = census(root).rows.find((r) => r.slug === 'orphan');
        expect(row?.unresolved).toBe(true);
        expect(row?.carriers.map((c) => c.path)).toContain('unknown:skill:never-built');
    });

    it('does not flag a row whose pointer resolves', () => {
        const row = census(sixVerdictRoot()).rows.find((r) => r.slug === 'beta');
        expect(row?.unresolved).toBe(false);
    });
});

describe('the under-count — the matcher seen red before it was trusted', () => {
    it('the blind definition misses a planted migration-stub duplicate', () => {
        // COUNT BEFORE. fence-identity alone cannot see the stub at all: the stub's
        // law is prose, so there is no fence to compare, and the obligation does
        // not appear in the table. This is the definition the census would have
        // shipped with, and on the live tree it reports 3 multi-carrier rows where
        // the fixed definition reports 46.
        const root = sixVerdictRoot();
        expect(countFor(root, 'beta', ['fence-identity'])).toBe(0);
        expect(countFor(root, 'gamma', ['fence-identity'])).toBe(1);
    });

    it('the fixed definition finds it', () => {
        // COUNT AFTER.
        const root = sixVerdictRoot();
        expect(countFor(root, 'beta')).toBe(2);
        expect(countFor(root, 'gamma')).toBe(2);
    });

    it('each anchor is load-bearing on its own — removing one loses exactly its case', () => {
        const root = sixVerdictRoot();
        expect(countFor(root, 'gamma', ['fence-identity', 'explicit-cross-reference'])).toBe(1);
        expect(countFor(root, 'beta', ['fence-identity', 'named-slug'])).toBe(1);
        expect(countFor(root, 'alpha', ['explicit-cross-reference', 'named-slug'])).toBe(1);
    });
});

describe('the instrument refuses a dead scope', () => {
    it('throws rather than reporting zero obligations from an empty walk', () => {
        // Reporting `0 obligations` from a walk that read nothing is the single
        // most comforting wrong answer this script could give, and it is exactly
        // how the 2026-07 dead-root sweep found fourteen gates printing green.
        expect(() => census(tmpdir())).toThrow(/report_obligation_carriers/);
    });

    it('main() maps that to a non-zero exit', () => {
        expect(main(['--root', tmpdir(), '--no-write'])).not.toBe(0);
    });
});

describe('the reporter names what it reads and what it does not', () => {
    it('prints every read class with its root', () => {
        const header = headerLines().join('\n');
        for (const c of CARRIER_CLASSES) expect(header).toContain(c.root);
    });

    it('prints every exclusion with a reason — a class left out is never silent', () => {
        const header = headerLines().join('\n');
        expect(EXCLUDED_CLASSES.length).toBeGreaterThanOrEqual(6);
        for (const e of EXCLUDED_CLASSES) {
            expect(header).toContain(e.name);
            expect(e.reason.length).toBeGreaterThan(40);
        }
    });
});

describe('main — read-only by contract', () => {
    it('exits 0 on a real corpus and writes nothing under --no-write', () => {
        const root = sixVerdictRoot();
        const before = fs.readdirSync(root).sort();
        expect(main(['--root', root, '--no-write'])).toBe(0);
        expect(fs.readdirSync(root).sort()).toEqual(before);
    });

    it('writes only under the gitignored agents/runtime/ path', () => {
        const root = sixVerdictRoot();
        expect(main(['--root', root])).toBe(0);
        expect(fs.existsSync(path.join(root, 'agents', 'runtime', 'reports', 'obligation-carriers.json'))).toBe(true);
        // Nothing landed in a tracked root.
        expect(fs.existsSync(path.join(root, 'src', 'obligation-carriers.json'))).toBe(false);
    });

    it('rejects an unknown argument rather than ignoring a typo', () => {
        expect(main(['--tpo', '5'])).toBe(1);
    });
});
