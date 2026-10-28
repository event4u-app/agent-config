/**
 * Showcase bundles and their renderer (road-to-a-baseline-that-has-to-catch-up
 * steps 0.2, 1.1 and 1.2).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import Ajv from 'ajv';
import { afterEach, describe, expect, it } from 'vitest';

import { loadBundle, medianRun, validateBundleSummary } from '../../src/scripts/_lib/showcase_bundle.js';
import { main, parseTaskRows, renderAll, type RenderOptions } from '../../src/scripts/render_showcase.js';

const REPO = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'showcase', '20261028T000000Z-art-svg-prompt-01');
const LIFT = path.join(REPO, 'internal', 'bench', 'showcase', 'PREDICTED-LIFT.md');
const SCHEMA = JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'scripts', 'schemas', 'showcase-bundle.schema.json'), 'utf-8'));
const NINE = [
    'art-svg-prompt-01',
    'art-svg-raster-01',
    'art-landing-01',
    'art-form-01',
    'art-login-framework-01',
    'art-login-plain-01',
    'art-php-endpoint-01',
    'art-page-copy-01',
    'art-app-copy-01',
];

const summary = (): Record<string, unknown> => JSON.parse(fs.readFileSync(path.join(FIXTURE, 'summary.json'), 'utf-8'));
const tmpDirs: string[] = [];
function workspace(): { root: string; opts: RenderOptions } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-'));
    tmpDirs.push(root);
    fs.cpSync(FIXTURE, path.join(root, 'bundles', path.basename(FIXTURE)), { recursive: true });
    const opts: RenderOptions = {
        bundles: path.join(root, 'bundles'),
        out: path.join(root, 'out'),
        claims: path.join(REPO, 'docs', 'CLAIMS.md'),
        tasks: LIFT,
        allowFixture: true,
    };
    return { root, opts };
}
const argv = (o: RenderOptions, ...extra: string[]): string[] => [
    '--bundles', o.bundles, '--out', o.out, '--claims', o.claims, '--tasks', o.tasks, '--allow-fixture', ...extra,
];

afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('showcase-bundle.schema.json', () => {
    const validate = new Ajv({ allErrors: true }).compile(SCHEMA);

    it('accepts the fixture bundle', () => {
        expect(validate(summary()), JSON.stringify(validate.errors)).toBe(true);
        expect(validateBundleSummary(summary())).toEqual([]);
    });

    it('rejects a bundle missing pricing_sourced_on', () => {
        const s = summary();
        delete s['pricing_sourced_on'];
        expect(validate(s)).toBe(false);
        expect(validateBundleSummary(s).join('\n')).toMatch(/pricing_sourced_on is required/);
    });

    it('rejects a verdict outside the paired_verdict vocabulary', () => {
        const s = summary();
        s['verdict'] = { kind: 'better', reason: 'x' };
        expect(validate(s)).toBe(false);
        expect(validateBundleSummary(s).join('\n')).toMatch(/verdict needs kind/);
    });
});

describe('validateBundleSummary cross-field rules', () => {
    const arms = (s: Record<string, unknown>): Array<Record<string, unknown>> => s['arms'] as Array<Record<string, unknown>>;

    it('refuses a dropped run (k runs are always reported)', () => {
        const s = summary();
        (arms(s)[1]?.['runs'] as unknown[]).pop();
        expect(validateBundleSummary(s).join('\n')).toMatch(/2 runs, k is 3/);
    });

    it('refuses an infra-error count that disagrees with the runs', () => {
        const s = summary();
        (arms(s)[1] as Record<string, unknown>)['infra_errors'] = 0;
        expect(validateBundleSummary(s).join('\n')).toMatch(/infra_errors is 0, runs carry 1/);
    });

    it('refuses complete token coverage with a missing bucket', () => {
        const s = summary();
        const run = (arms(s)[0]?.['runs'] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
        (run['tokens'] as Record<string, unknown>)['cache_read'] = null;
        expect(validateBundleSummary(s).join('\n')).toMatch(/coverage complete needs all four buckets/);
    });

    it('refuses a with-arm median that is not the package arm median', () => {
        const s = summary();
        (s['parity'] as Record<string, unknown>)['with_arm_first_shot_median'] = 0;
        expect(validateBundleSummary(s).join('\n')).toMatch(/first-shot median is 1/);
    });

    it('marks the lower median as an observed run', () => {
        const runs = (arms(summary())[1]?.['runs'] ?? []) as Parameters<typeof medianRun>[0];
        expect(medianRun(runs)).toEqual({ score: 0.75, run: 1 });
    });
});

describe('loadBundle', () => {
    it('loads the fixture and hashes it', () => {
        const { bundle, problems } = loadBundle(FIXTURE);
        expect(problems).toEqual([]);
        expect(bundle?.hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('refuses a thumbnail whose bytes no longer match artifacts.sha256', () => {
        const { root } = workspace();
        const dir = path.join(root, 'bundles', path.basename(FIXTURE));
        fs.appendFileSync(path.join(dir, 'thumbs', 'package-1.svg'), '<!-- edited -->\n');
        expect(loadBundle(dir).problems.join('\n')).toMatch(/package-1\.svg does not match/);
    });
});

describe('PREDICTED-LIFT.md', () => {
    const text = fs.readFileSync(LIFT, 'utf-8');

    it('names all nine tasks, each with a claim in the ledger', () => {
        expect(parseTaskRows(text).map((r) => r.id)).toEqual(NINE);
    });

    it('gives every task at least one asset row whose file:line resolves', () => {
        const sections = text.split(/^## /m).filter((s) => s.startsWith('art-'));
        expect(sections).toHaveLength(NINE.length);
        for (const sec of sections) {
            const rows = [...sec.matchAll(/^\| `([^`]+)` \| (\d+) \|/gm)];
            expect(rows.length, sec.slice(0, 40)).toBeGreaterThan(0);
            for (const [, file, line] of rows) {
                const lines = fs.readFileSync(path.join(REPO, file as string), 'utf-8').split('\n');
                expect(Number(line), `${file}:${line}`).toBeLessThanOrEqual(lines.length);
                expect(lines[Number(line) - 1]?.trim(), `${file}:${line}`).not.toBe('');
            }
        }
    });
});

describe('render_showcase', () => {
    it('renders byte-stably and lists every task on the index', () => {
        const { opts } = workspace();
        const a = renderAll(opts);
        const b = renderAll(opts);
        expect([...a.keys()].sort()).toEqual(['art-svg-prompt-01.md', 'index.md']);
        expect([...a]).toEqual([...b]);
        const index = a.get('index.md') as string;
        for (const id of NINE) expect(index).toContain(id);
        expect(index).toContain('No showcase run has been recorded yet.');
        const page = a.get('art-svg-prompt-01.md') as string;
        expect(page).toContain('FIXTURE — not evidence');
        expect(page).toContain('`showcase-svg-render-gate` — status `unbacked`');
        expect(page.match(/\*\*median\*\*/g)).toHaveLength(3);
    });

    it('--check is green after a render and red on an edited page', () => {
        const { opts } = workspace();
        expect(main(argv(opts))).toBe(0);
        expect(main(argv(opts, '--check'))).toBe(0);
        fs.appendFileSync(path.join(opts.out, 'art-svg-prompt-01.md'), 'hand edit\n');
        expect(main(argv(opts, '--check'))).toBe(1);
    });

    it('--check is red on a page whose bundle is gone', () => {
        const { opts } = workspace();
        expect(main(argv(opts))).toBe(0);
        fs.rmSync(path.join(opts.bundles, path.basename(FIXTURE)), { recursive: true });
        expect(main(argv(opts, '--check'))).toBe(1);
    });

    it('refuses a fixture bundle without --allow-fixture', () => {
        const { opts } = workspace();
        expect(() => renderAll({ ...opts, allowFixture: false })).toThrow(/fixture bundle in the evidence tree/);
    });

    it('refuses a bundle whose claim is not in the ledger (K1)', () => {
        const { root, opts } = workspace();
        const p = path.join(root, 'bundles', path.basename(FIXTURE), 'summary.json');
        fs.writeFileSync(p, fs.readFileSync(p, 'utf-8').replace('"showcase-svg-render-gate"', '"no-such-claim"'));
        expect(() => renderAll(opts)).toThrow(/claim no-such-claim is not in the ledger/);
    });

    it('the committed index matches the committed bundles', () => {
        expect(main(['--check'])).toBe(0);
    });
});
