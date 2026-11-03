// Metamorphic invariance for check_web_launch_readiness: a change in how the
// markup is WRITTEN (attribute order, quote style, case, whitespace) must never
// change a verdict, and every check id must have a fixture where it fires and
// one where it stays silent — a check proven only one way is half-tested.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { type Report, audit, loadConfig } from '../../src/scripts/check_web_launch_readiness';

const REPO = path.resolve(__dirname, '..', '..');
const WL = path.join(REPO, 'tests/fixtures/web-launch');
const TPL = path.join(REPO, 'tests/fixtures/third-party-load');

const subdirs = (dir: string): string[] =>
    fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => path.join(dir, e.name));

/** Every build tree the unit corpus holds. The benchmark corpus is deliberately absent: its protocol is frozen. */
const CORPUS: string[] = [
    ...subdirs(WL).filter((d) => path.basename(d) !== 'form-variants'),
    ...subdirs(path.join(WL, 'form-variants')),
    ...['planted', 'safe', 'decoys'].map((d) => path.join(TPL, d)),
];

const TAGS = 'html|head|body|meta|link|title|script|style|img|iframe|video|audio|source|embed|a';
const START_TAG = new RegExp(`<(${TAGS})((?:\\s+[^\\s"'=<>/]+(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s"'=<>\`]+))?)*)\\s*(/?)>`, 'gi');
const ATTR = /\s+([^\s"'=<>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g;

interface Attr {
    name: string;
    value: string | undefined;
}
type Rewrite = (name: string, attrs: Attr[], selfClose: string) => string;

const quoteOf = (v: string): string => v.slice(1, -1);
const render = (a: Attr, q: 'double' | 'single' | 'keep'): string => {
    if (a.value === undefined) return a.name;
    if (q === 'keep') return `${a.name}=${a.value}`;
    const raw = /^["']/.test(a.value) ? quoteOf(a.value) : a.value;
    if (q === 'single' && !raw.includes("'")) return `${a.name}='${raw}'`;
    if (!raw.includes('"')) return `${a.name}="${raw}"`;
    return `${a.name}=${a.value}`;
};

const VARIANTS: Record<string, Rewrite> = {
    'attribute order reversed': (n, as, sc) => `<${n}${[...as].reverse().map((a) => ` ${render(a, 'keep')}`).join('')}${sc === '/' ? ' /' : ''}>`,
    'single quotes': (n, as, sc) => `<${n}${as.map((a) => ` ${render(a, 'single')}`).join('')}${sc === '/' ? ' /' : ''}>`,
    'upper-case names': (n, as, sc) =>
        `<${n.toUpperCase()}${as.map((a) => ` ${render({ ...a, name: a.name.toUpperCase() }, 'keep')}`).join('')}${sc === '/' ? ' /' : ''}>`,
    'extra whitespace': (n, as, sc) =>
        `<${n}${as.map((a) => ` \t ${a.value === undefined ? a.name : `${a.name} = ${a.value}`}`).join('')}${sc === '/' ? '  /' : '  '}>`,
};

function rewriteHtml(text: string, rw: Rewrite): string {
    return text.replace(START_TAG, (_m, name: string, body: string, sc: string) => {
        const attrs = [...body.matchAll(ATTR)].map((m) => ({ name: m[1] ?? '', value: m[2] }));
        return rw(name, attrs, sc);
    });
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wlr-meta-'));
afterAll(() => fs.rmSync(TMP, { recursive: true, force: true }));

function variantOf(dir: string, label: string, rw: Rewrite): string {
    const out = path.join(TMP, label.replace(/\W+/g, '-'), path.relative(REPO, dir));
    fs.cpSync(dir, out, { recursive: true });
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else if (/\.html?$/i.test(e.name)) fs.writeFileSync(p, rewriteHtml(fs.readFileSync(p, 'utf8'), rw));
        }
    };
    walk(out);
    return out;
}

/** What a verdict IS: which checks fired where, which passed, which were undecided where. Evidence text is not. */
const verdict = (r: Report) => ({
    findings: r.findings.map((f) => `${f.check} @ ${f.location}`).sort(),
    passed: [...r.passed].sort(),
    unknown: r.unknown.map((u) => `${u.check} @ ${u.location}`).sort(),
});
const run = (dir: string) => audit(dir, 'marketing-site', REPO, 'de');

describe('the rewriter changes form, not content', () => {
    it('every variant actually rewrites the clean fixture', () => {
        const html = fs.readFileSync(path.join(WL, 'clean-marketing/index.html'), 'utf8');
        for (const [label, rw] of Object.entries(VARIANTS)) expect([label, rewriteHtml(html, rw) !== html]).toEqual([label, true]);
    });

    it('reversing attribute order really reverses it', () => {
        expect(rewriteHtml('<meta name="robots" content="noindex" />', VARIANTS['attribute order reversed']!)).toBe(
            '<meta content="noindex" name="robots" />',
        );
    });
});

describe('metamorphic invariance — a form change never flips a verdict', () => {
    const cases = CORPUS.flatMap((dir) => Object.keys(VARIANTS).map((label) => [path.relative(REPO, dir), label] as const));
    it.each(cases)('%s under %s', (rel, label) => {
        const dir = path.join(REPO, rel);
        expect(verdict(run(variantOf(dir, label, VARIANTS[label]!)))).toEqual(verdict(run(dir)));
    });
});

describe('coverage pairs — every check fires somewhere and stays silent somewhere', () => {
    it('no configured check lacks a firing or a silent fixture', () => {
        const fires = new Set<string>();
        const silent = new Set<string>();
        for (const dir of CORPUS) {
            const r = run(dir);
            for (const f of r.findings) fires.add(f.check);
            for (const p of r.passed) silent.add(p);
        }
        const missing = loadConfig(REPO)
            .checks.map((c) => c.id)
            .flatMap((id) => [...(fires.has(id) ? [] : [`${id}: no firing fixture`]), ...(silent.has(id) ? [] : [`${id}: no silent fixture`])]);
        expect(missing).toEqual([]);
    });
});
