// Tests for src/skills/corpus-grounding/scripts/ground.ts + decision_engine.ts
// (ADR-094 py2ts). End-to-end golden-parity: build a small corpus + manifest,
// then run ground.py and ground.ts on every documented subcommand/flag and
// assert byte-identical stdout + stderr + exit code. This exercises the whole
// cluster — bm25_search (ranking + filters), schema_validator (validate +
// load + resolve), decision_engine (search_domain/stack, evaluate_rules,
// best-match, ground aggregate, persist, render), and the ground CLI surface
// (JSON ensure_ascii=False, markdown render, error paths).
//
// The dynamic-import escape hatch (reasoning.rules_module) is covered with a
// matched .py (importlib) + .ts (dynamic import()) pair. --persist writes are
// compared in throwaway tmp dirs and asserted byte-identical, never touching
// the live tree. Float parity (BM25 tf-idf → confidence scores, the .0 on
// integral floats) is the load-bearing concern and is checked by the JSON
// byte-comparison.
//
// argparse usage/--help text (exit-2 rejections) is intentionally NOT
// byte-compared per ADR-094 test guidance; the documented success + error
// paths are exact. Determinism: inline fixtures in tmp dirs, no clock, no
// network, no git drift.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as de from '../../src/skills/corpus-grounding/scripts/decision_engine.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPTS = path.join(REPO_ROOT, 'src', 'skills', 'corpus-grounding', 'scripts');
const PY = path.join(SCRIPTS, 'ground.py');
const TS = path.join(SCRIPTS, 'ground.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TSX_BIN = process.env.TSX_BIN ? path.resolve(REPO_ROOT, process.env.TSX_BIN) : TSX;

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-ground-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

/** Build a complete corpus + manifest fixture; return the manifest path. */
function buildFixture(): { dir: string; manifest: string; lookupOnly: string } {
    const dir = mkTmp();
    fs.writeFileSync(
        path.join(dir, 'color.csv'),
        'Name,Keywords,Description,Severity\n' +
            'Muted Palette,muted calm soft,A restrained low-saturation palette,LOW\n' +
            'Vibrant Palette,vibrant bold bright,High-saturation energetic colors,HIGH\n' +
            'Fintech Blue,fintech trust blue,Conservative blue trust palette,MEDIUM\n',
    );
    fs.writeFileSync(
        path.join(dir, 'layout.csv'),
        'Name,Keywords,Description\n' +
            'Dashboard Grid,dashboard grid cards,A card grid layout for dashboards\n' +
            'Hero Layout,hero landing,A hero landing layout\n',
    );
    fs.writeFileSync(
        path.join(dir, 'rules.csv'),
        'Category,Rules,Priority\n' +
            'Dashboard,"{""if_dark_mode"": ""use elevated surfaces"", ""if_data_heavy"": ""prefer tables""}",muted+fintech\n' +
            'General,"{""if_mobile"": ""stack vertically""}",vibrant\n',
    );
    const manifest = {
        manifest_version: 1,
        domain: 'design',
        tier: 'conditional-grounding',
        default_domain: 'color',
        owner: 'test',
        refresh_cadence: 'quarterly',
        upstream: { repo: 'x', sha: 'y', last_checked: '2026-01-01' },
        retriever: 'bm25',
        domains: {
            color: {
                file: 'color.csv',
                search_cols: ['Name', 'Keywords', 'Description'],
                output_cols: ['Name', 'Description'],
                max_results: 3,
            },
            layout: {
                file: 'layout.csv',
                search_cols: ['Name', 'Keywords', 'Description'],
                output_cols: ['Name', 'Description'],
            },
        },
        detect: { color: ['palette', 'color', 'muted'], layout: ['dashboard', 'grid', 'layout'] },
        reasoning: {
            file: 'rules.csv',
            match_column: 'Category',
            rules_column: 'Rules',
            priority_column: 'Priority',
            category_domain: 'layout',
            category_column: 'Name',
            priority_domain: 'color',
            name_columns: { color: 'Name' },
            plan: { color: 2, layout: 1 },
        },
    };
    const manifestPath = path.join(dir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest));

    // A lookup-only manifest whose domain file is missing (file-not-found path).
    const lookup = {
        manifest_version: 1,
        domain: 'd',
        tier: 'lookup-only',
        owner: 'o',
        refresh_cadence: 'q',
        upstream: { repo: 'r', sha: 's', last_checked: 'l' },
        domains: { color: { file: 'missing.csv', search_cols: ['Name'], output_cols: ['Name'] } },
    };
    const lookupPath = path.join(dir, 'lookup.json');
    fs.writeFileSync(lookupPath, JSON.stringify(lookup));
    return { dir, manifest: manifestPath, lookupOnly: lookupPath };
}

function run(bin: string, args: string[]): SpawnSyncReturns<string> {
    return spawnSync(bin, args, { encoding: 'utf8', cwd: REPO_ROOT });
}

function assertParity(args: string[], normalize?: (s: string) => string): void {
    const py = run('python3', [PY, ...args]);
    const ts = run(TSX_BIN, [TS, ...args]);
    const norm = normalize ?? ((s: string): string => s);
    expect(ts.status).toBe(py.status);
    expect(norm(ts.stdout)).toBe(norm(py.stdout));
    expect(norm(ts.stderr)).toBe(norm(py.stderr));
}

// ── TS unit tests (pure helpers / async ground) ─────────────────────────────

describe('decision_engine — detect_domain', () => {
    const manifest = {
        detect: { color: ['palette', 'muted'], layout: ['dashboard', 'grid'] },
        default_domain: 'color',
        domains: { color: {}, layout: {} },
    };
    it('routes by keyword vote (word-boundary)', () => {
        expect(de.detect_domain(manifest, 'a muted palette please')).toBe('color');
        expect(de.detect_domain(manifest, 'dashboard grid view')).toBe('layout');
    });
    it('falls back to default_domain when no keyword hits', () => {
        expect(de.detect_domain(manifest, 'nothing relevant')).toBe('color');
    });
    it('falls back to the first domain when no default + no hit', () => {
        const m = { detect: {}, domains: { layout: {}, color: {} } };
        expect(de.detect_domain(m, 'x')).toBe('layout');
    });
});

describe('decision_engine — evaluate_rules', () => {
    it('matches on query tokens and truthy context flags; surfaces both sets', () => {
        const out = de.evaluate_rules(
            { if_dark_mode: 'A', if_data_heavy: 'B', if_mobile: 'C' },
            'a data heavy view',
            { dark_mode: true },
        );
        expect(out).toEqual({
            matched: { if_dark_mode: 'A', if_data_heavy: 'B' },
            unmatched: { if_mobile: 'C' },
        });
    });
});

describe('decision_engine — ground (async) on a real fixture', () => {
    it('returns a grounded dict with a weakest-link aggregate confidence', async () => {
        const { manifest } = buildFixture();
        const m = (await import('../../src/skills/corpus-grounding/scripts/schema_validator.js')).load_manifest(manifest);
        const grounded = await de.ground(m, 'dashboard with muted palette');
        expect(grounded.domain).toBe('design');
        expect(grounded.category).toBe('Dashboard Grid');
        expect((grounded.confidence as Record<string, unknown>).label).toBeDefined();
        expect(Array.isArray(grounded.evidence_gap)).toBe(true);
    });
});

// ── Golden parity (python3 vs tsx) ──────────────────────────────────────────

describe.runIf(hasPython3())('ground — golden parity (python3 vs tsx)', () => {
    it('validate (valid) — OK + exit 0', () => {
        const { manifest } = buildFixture();
        assertParity(['validate', '--manifest', manifest]);
    });

    it('validate (invalid) — INVALID list + exit 1', () => {
        const dir = mkTmp();
        const bad = path.join(dir, 'bad.json');
        fs.writeFileSync(bad, '{"manifest_version": 2}');
        assertParity(['validate', '--manifest', bad]);
    });

    it('search auto-detect domain (--json)', () => {
        const { manifest } = buildFixture();
        assertParity(['search', '--manifest', manifest, 'muted calm palette', '--json']);
    });

    it('search explicit domain (text render)', () => {
        const { manifest } = buildFixture();
        assertParity(['search', '--manifest', manifest, '--domain', 'color', 'vibrant bold']);
    });

    it('search structured retriever + filter (--json)', () => {
        const { manifest } = buildFixture();
        assertParity([
            'search', '--manifest', manifest, '--domain', 'color',
            '--filter', 'Severity=HIGH', '--retriever', 'structured', 'x', '--json',
        ]);
    });

    it('search hybrid retriever + empty query falls back to stable order', () => {
        const { manifest } = buildFixture();
        assertParity(['search', '--manifest', manifest, '--domain', 'color', '--retriever', 'hybrid', '', '--json']);
    });

    it('search repeated --filter (list value)', () => {
        const { manifest } = buildFixture();
        assertParity([
            'search', '--manifest', manifest, '--domain', 'color',
            '--filter', 'Severity=HIGH', '--filter', 'Severity=LOW', 'palette', '--json',
        ]);
    });

    it('search no match → confidence 0.0 + evidence gap', () => {
        const { manifest } = buildFixture();
        assertParity(['search', '--manifest', manifest, '--domain', 'color', 'zzz nonexistent qqq', '--json']);
    });

    it('search file-not-found → error dict + exit 1 (path normalised)', () => {
        const { dir, lookupOnly } = buildFixture();
        const norm = (s: string): string => s.split(dir).join('DIR').split(fs.realpathSync.native(dir)).join('DIR');
        assertParity(['search', '--manifest', lookupOnly, '--domain', 'color', 'x', '--json'], norm);
    });

    it('search unknown domain → error dict + exit 1', () => {
        const { manifest } = buildFixture();
        assertParity(['search', '--manifest', manifest, '--domain', 'bogus', 'x', '--json']);
    });

    it('search unknown stack → error dict + exit 1', () => {
        const { manifest } = buildFixture();
        assertParity(['search', '--manifest', manifest, '--stack', 'react', 'x', '--json']);
    });

    it('ground (--json) — full reasoning plan + aggregate confidence', () => {
        const { manifest } = buildFixture();
        assertParity(['ground', '--manifest', manifest, 'dashboard with muted palette', '--json']);
    });

    it('ground (markdown render)', () => {
        const { manifest } = buildFixture();
        assertParity(['ground', '--manifest', manifest, 'dashboard with muted palette']);
    });

    it('ground with --context flags', () => {
        const { manifest } = buildFixture();
        assertParity([
            'ground', '--manifest', manifest, 'dashboard data heavy',
            '--context', '{"dark_mode": true}', '--json',
        ]);
    });

    it('ground manifest-not-found → Error on stderr + exit 1', () => {
        const dir = mkTmp();
        const missing = path.join(dir, 'nope.json');
        const norm = (s: string): string => s.split(dir).join('DIR').split(fs.realpathSync.native(dir)).join('DIR');
        assertParity(['ground', '--manifest', missing, 'x'], norm);
    });

    it('ground on a lookup-only manifest → ManifestError on stderr + exit 1', () => {
        const { lookupOnly } = buildFixture();
        assertParity(['ground', '--manifest', lookupOnly, 'x']);
    });

    it('ground --persist writes a byte-identical MASTER.md + page override', () => {
        const { manifest } = buildFixture();
        const pyDir = mkTmp();
        const tsDir = mkTmp();
        const py = run('python3', [PY, 'ground', '--manifest', manifest, 'Lux Store', '--persist', pyDir, '--page', 'Home', '--json']);
        const ts = run(TSX_BIN, [TS, 'ground', '--manifest', manifest, 'Lux Store', '--persist', tsDir, '--page', 'Home', '--json']);
        expect(ts.status).toBe(py.status);
        // stdout embeds the persist dir path; normalise it.
        expect(ts.stdout.split(tsDir).join('DIR')).toBe(py.stdout.split(pyDir).join('DIR'));
        expect(ts.stderr).toBe(py.stderr);
        const rel = path.join('design-system', 'lux-store');
        expect(fs.readFileSync(path.join(tsDir, rel, 'MASTER.md'), 'utf8')).toBe(
            fs.readFileSync(path.join(pyDir, rel, 'MASTER.md'), 'utf8'),
        );
        expect(fs.readFileSync(path.join(tsDir, rel, 'pages', 'home.md'), 'utf8')).toBe(
            fs.readFileSync(path.join(pyDir, rel, 'pages', 'home.md'), 'utf8'),
        );
    });

    it('reasoning.rules_module escape hatch — importlib (.py) vs dynamic import (.ts)', () => {
        const { dir, manifest } = buildFixture();
        // Matched module pair beside the manifest: .py for python, .ts for the twin.
        fs.writeFileSync(
            path.join(dir, 'custom_rules.py'),
            'def evaluate(rules, query, context):\n' +
                '    return {"matched": {"CUSTOM": "fired:" + query}, "unmatched": dict(rules)}\n',
        );
        fs.writeFileSync(
            path.join(dir, 'custom_rules.ts'),
            'export function evaluate(rules: Record<string, unknown>, query: string, _context: Record<string, unknown>) {\n' +
                '    return { matched: { CUSTOM: "fired:" + query }, unmatched: { ...rules } };\n' +
                '}\n',
        );
        const m = JSON.parse(fs.readFileSync(manifest, 'utf8')) as Record<string, unknown>;
        (m.reasoning as Record<string, unknown>).rules_module = 'custom_rules.py';
        const custom = path.join(dir, 'm_custom.json');
        fs.writeFileSync(custom, JSON.stringify(m));
        assertParity(['ground', '--manifest', custom, 'dashboard with muted palette', '--json']);
    });
});
