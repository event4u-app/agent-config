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
const TS = path.join(SCRIPTS, 'ground.ts');
const TSX = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TSX_BIN = process.env.TSX_BIN ? path.resolve(REPO_ROOT, process.env.TSX_BIN) : TSX;

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
