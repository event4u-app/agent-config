// Tests for src/scripts/web_launch_crawlers.ts and src/config/crawler-register.json:
// robots.txt read as groups, crawler names judged by what their operator says
// they are for, and a lapsed register row reading `unknown`, never live.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CRAWLER_REGISTER_REL,
    type CrawlerRow,
    crawlerRowViolations,
    loadCrawlerRegister,
    metaNoindex,
    robotsBlocks,
    robotsGroups,
    snippetBlocks,
} from '../../src/scripts/web_launch_crawlers';

const REPO = path.resolve(__dirname, '..', '..');
const register = loadCrawlerRegister(REPO);
const TODAY = '2026-11-03';
const blocks = (txt: string, asOf = TODAY) => robotsBlocks('robots.txt', txt, register, asOf);

describe('robots.txt is read as groups', () => {
    it('consecutive User-agent lines share one group; a rule closes it', () => {
        const g = robotsGroups('User-agent: GPTBot\nUser-agent: CCBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin/\n');
        expect(g.map((x) => x.agents)).toEqual([['GPTBot', 'CCBot'], ['*']]);
        expect(g[0]?.rules).toEqual([{ kind: 'disallow', path: '/', line: 3 }]);
    });

    it('comments and key case do not change the groups', () => {
        const a = robotsGroups('user-agent: *   # everyone\nDISALLOW: /\n');
        expect(a).toEqual([{ agents: ['*'], rules: [{ kind: 'disallow', path: '/', line: 2 }] }]);
    });
});

describe('a blanket block is critical only when it hides the site from search', () => {
    it('`*` is a staging leftover', () => {
        expect(blocks('User-agent: *\nDisallow: /\n').hits.map((h) => h.line)).toEqual([2]);
    });

    it('a documented search crawler is a staging leftover', () => {
        expect(blocks('User-agent: Googlebot\nDisallow: /\n').hits).toHaveLength(1);
        expect(blocks('User-agent: googlebot\nDisallow: /\n').hits).toHaveLength(1);
    });

    it('training-only tokens are never a finding', () => {
        const r = blocks('User-agent: GPTBot\nDisallow: /\n\nUser-agent: Google-Extended\nDisallow: /\n');
        expect(r).toEqual({ hits: [], undecided: [] });
    });

    it('a token the register does not know is not judged', () => {
        expect(blocks('User-agent: SomeUnknownBot\nDisallow: /\n')).toEqual({ hits: [], undecided: [] });
    });

    it('a path rule and an Allow: / override are not blanket blocks', () => {
        expect(blocks('User-agent: *\nDisallow: /admin/\n').hits).toEqual([]);
        expect(blocks('User-agent: *\nDisallow: /\nAllow: /\n').hits).toEqual([]);
    });

    it('a search crawler whose row has lapsed reads undecided, not clean and not critical', () => {
        const r = blocks('User-agent: Googlebot\nDisallow: /\n', '2099-01-01');
        expect(r.hits).toEqual([]);
        expect(r.undecided).toHaveLength(1);
        expect(r.undecided[0]?.text).toMatch(/lapsed/);
    });

    it('`*` stays critical whatever the register says', () => {
        expect(blocks('User-agent: *\nDisallow: /\n', '2099-01-01').hits).toHaveLength(1);
    });
});

describe('robots meta tags are read by meaning', () => {
    const meta = (html: string, asOf = TODAY) => metaNoindex('index.html', html, register, asOf);

    it('noindex and none in any order, quoting or case', () => {
        for (const html of [
            '<meta name="robots" content="noindex">',
            '<meta content="noindex, nofollow" name="robots">',
            "<META NAME='ROBOTS' CONTENT='NONE'>",
            '<meta name=robots content=noindex/>',
        ]) {
            expect([html, meta(html).hits.length]).toEqual([html, 1]);
        }
    });

    it('a search crawler meta name counts; index, nofollow and other names do not', () => {
        expect(meta('<meta name="googlebot" content="noindex">').hits).toHaveLength(1);
        expect(meta('<meta name="robots" content="index, nofollow">').hits).toEqual([]);
        expect(meta('<meta name="description" content="noindex is a word">').hits).toEqual([]);
        expect(meta('<meta name="robots" content="noindexed">').hits).toEqual([]);
    });

    it('a crawler meta name whose row lapsed reads undecided', () => {
        const r = meta('<meta name="googlebot" content="noindex">', '2099-01-01');
        expect([r.hits.length, r.undecided.length]).toEqual([0, 1]);
    });
});

describe('snippet blocks read a lapsed row the way noindex does', () => {
    const snip = (html: string, asOf = TODAY) => snippetBlocks('index.html', html, register, asOf);

    it('a live search crawler name and robots fire', () => {
        expect(snip('<meta name="googlebot" content="nosnippet">').hits).toHaveLength(1);
        expect(snip('<meta name="robots" content="max-snippet:0">').hits).toHaveLength(1);
    });

    it('a crawler meta name whose row lapsed reads undecided, never a silent pass', () => {
        const r = snip('<meta name="googlebot" content="nosnippet">', '2099-01-01');
        expect([r.hits.length, r.undecided.length]).toEqual([0, 1]);
        expect(r.undecided[0]?.text).toMatch(/lapsed/);
    });

    it('robots stays decided whatever the register says', () => {
        expect(snip('<meta name="robots" content="nosnippet">', '2099-01-01')).toMatchObject({ undecided: [] });
        expect(snip('<meta name="robots" content="nosnippet">', '2099-01-01').hits).toHaveLength(1);
    });

    it('a noindex page is no snippet finding; a lapsed noindex leaves the snippet undecided too', () => {
        expect(snip('<meta name="robots" content="noindex, nosnippet">')).toEqual({ hits: [], undecided: [] });
        const r = snip('<meta name="googlebot" content="noindex">\n<meta name="robots" content="nosnippet">', '2099-01-01');
        expect(r.hits).toEqual([]);
        expect(r.undecided).toHaveLength(1);
    });
});

describe('the crawler register schema', () => {
    const good: CrawlerRow = {
        token: 'ExampleBot',
        operator: 'Example',
        purpose: 'search',
        affects_search_inclusion: true,
        source: 'https://example.com/docs/bot',
        checked_at: '2026-11-03',
        review_by: '2027-05-03',
    };

    it('the shipped register is valid, dated, and has at least one search and one training row', () => {
        const doc = JSON.parse(fs.readFileSync(path.join(REPO, CRAWLER_REGISTER_REL), 'utf8')) as { rows: CrawlerRow[] };
        expect(crawlerRowViolations(doc.rows)).toEqual([]);
        expect(doc.rows.some((r) => r.purpose === 'search' && r.affects_search_inclusion)).toBe(true);
        expect(doc.rows.some((r) => r.purpose === 'training' && !r.affects_search_inclusion)).toBe(true);
    });

    it('accepts a complete row', () => {
        expect(crawlerRowViolations([good])).toEqual([]);
    });

    it('rejects a row without a source', () => {
        const { source: _s, ...noSource } = good;
        expect(crawlerRowViolations([noSource]).join('\n')).toMatch(/source/);
        expect(crawlerRowViolations([{ ...good, source: 'see the docs' }]).join('\n')).toMatch(/source/);
    });

    it('rejects a row without a date', () => {
        const { checked_at: _c, ...noChecked } = good;
        const { review_by: _r, ...noReview } = good;
        expect(crawlerRowViolations([noChecked]).join('\n')).toMatch(/checked_at/);
        expect(crawlerRowViolations([noReview]).join('\n')).toMatch(/review_by/);
        expect(crawlerRowViolations([{ ...good, review_by: 'soon' }]).join('\n')).toMatch(/review_by/);
    });

    it('rejects an unknown purpose, and a non-search row claiming search inclusion', () => {
        expect(crawlerRowViolations([{ ...good, purpose: 'scraping' as never }]).join('\n')).toMatch(/purpose/);
        expect(crawlerRowViolations([{ ...good, purpose: 'training' }]).join('\n')).toMatch(/search inclusion/);
    });

    it('the loader refuses a schema violation rather than reading it as an empty register', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crawler-reg-'));
        try {
            fs.mkdirSync(path.join(tmp, 'src/config'), { recursive: true });
            fs.writeFileSync(path.join(tmp, CRAWLER_REGISTER_REL), JSON.stringify({ rows: [{ ...good, source: '' }] }));
            expect(() => loadCrawlerRegister(tmp)).toThrow(/source/);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe('--as-of past review_by yields `unknown` end to end', () => {
    // asOf() is memoised per process from its argv, so the pin needs its own process.
    let root: string;
    let build: string;
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'crawler-asof-'));
        fs.mkdirSync(path.join(root, 'src/config'), { recursive: true });
        for (const f of ['web-launch-readiness.json', 'third-party-origins.json']) {
            fs.copyFileSync(path.join(REPO, 'src/config', f), path.join(root, 'src/config', f));
        }
        const doc = JSON.parse(fs.readFileSync(path.join(REPO, CRAWLER_REGISTER_REL), 'utf8')) as { rows: CrawlerRow[] };
        for (const r of doc.rows) {
            r.checked_at = '2026-01-01';
            r.review_by = '2026-06-01';
        }
        fs.writeFileSync(path.join(root, CRAWLER_REGISTER_REL), JSON.stringify(doc));
        build = path.join(root, 'build');
        fs.cpSync(path.join(REPO, 'tests/fixtures/web-launch/clean-marketing'), build, { recursive: true });
        fs.writeFileSync(path.join(build, 'robots.txt'), 'User-agent: Googlebot\nDisallow: /\n');
    });
    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    const run = (asOf: string) => {
        const script = path.join(root, 'run.ts');
        const mod = path.join(REPO, 'src/scripts/check_web_launch_readiness.ts');
        fs.writeFileSync(
            script,
            `import { audit } from ${JSON.stringify(mod)};\n` +
                `const r = audit(${JSON.stringify(build)}, 'marketing-site', ${JSON.stringify(root)});\n` +
                `console.log(JSON.stringify({ findings: r.findings.map((f) => f.check), unknown: r.unknown.map((u) => u.check) }));\n`,
        );
        const tsx = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
        const out = spawnSync(tsx, [script, '--as-of', asOf], { cwd: REPO, encoding: 'utf8' });
        expect(out.status, out.stderr).toBe(0);
        return JSON.parse(out.stdout.trim().split('\n').pop() ?? '{}') as { findings: string[]; unknown: string[] };
    };

    it('before review_by the search-crawler block is critical; after it, unknown', () => {
        expect(run('2026-05-01').findings).toContain('staging-noindex-leftover');
        const after = run('2026-11-03');
        expect(after.findings).not.toContain('staging-noindex-leftover');
        expect(after.unknown).toContain('staging-noindex-leftover');
    });
});
