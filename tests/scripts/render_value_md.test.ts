// Tests for src/scripts/render_value_md.ts (py2ts Phase 8 / Wave 8b).
//
// Ports tests/test_render_value_md.py 1:1 (structural required-section
// assertions over a fixed value-v1 fixture, via the _setPathsForTest seam
// that mirrors the pytest monkeypatch of VALUE_REPORTS_DIR / LATEST /
// OUT_PATH) plus a golden-parity layer that runs python3 vs tsx on a tmp
// fixture, comparing the rendered docs/value.md byte-for-byte (timestamps
// are the only drift, so the parity layer renders against the SAME fixture
// in both runtimes and strips the `_Last rendered:` lines before diff).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import * as rvm from '../../src/scripts/render_value_md.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'render_value_md.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'render_value_md.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function _canonical_report(): Record<string, unknown> {
    return {
        schema_version: 1,
        schema_id: 'value-v1',
        generated_at: '2026-05-28T12:00:00+00:00',
        reference_scale: {
            requests: 1000,
            avg_input_tokens: 8000,
            avg_output_tokens: 600,
            model_tier: 'sonnet',
            pricing_sourced_on: '2026-05-14',
        },
        baseline: { label: 'Ohne Paket / Without package', input_tokens_per_request: 8000 },
        cost_ladder: [
            {
                id: 'baseline',
                label: 'Ohne Paket / Without package',
                what_it_does: 'Baseline — der nackte Request.',
                token_delta: 0,
                eur_delta: 0.0,
                cumulative_pct: 0.0,
                confidence: 'measured',
                source_report: 'n/a',
            },
            {
                id: 'load',
                label: 'Mit Paket (Regeln laden)',
                what_it_does: 'Regeln im Kontext jedes Requests.',
                token_delta: 4800,
                eur_delta: 13.24,
                cumulative_pct: 60.0,
                confidence: 'measured',
                source_report: 'agents/runtime/frugality/baseline.jsonl',
                footnote: 'Kernel + tier_1 + tier_2 + charter footprint.',
            },
            {
                id: 'condense',
                label: '+ condense (Regeln eindampfen)',
                what_it_does: 'Build-Schritt schrumpft Regel-Dateien.',
                token_delta: -200,
                eur_delta: -0.55,
                cumulative_pct: 57.5,
                confidence: 'measured',
                source_report: 'internal/bench/reports/telegraph-v2.json',
                footnote: 'Thin-Root excluded.',
            },
            {
                id: 'rtk',
                label: '+ rtk (CLI-Output filtern)',
                what_it_does: 'rtk filtert verbose CLI-Ausgaben.',
                token_delta: 0,
                eur_delta: 0.0,
                cumulative_pct: 57.5,
                confidence: 'pending',
                source_report: 'internal/bench/reports/rtk/latest.json',
                footnote: 'Install rtk and run scripts/bench_rtk_savings.py.',
            },
            {
                id: 'terse',
                label: '+ terse (Antworten knapper)',
                what_it_does: 'Telegraph-Stil für knappere Antworten.',
                token_delta: 56,
                eur_delta: 0.77,
                cumulative_pct: 58.2,
                confidence: 'measured',
                source_report: 'internal/bench/reports/telegraph-v1.json',
                footnote: 'Honest: gemessener Median = -9.27%.',
            },
        ],
        behaviour: [
            {
                id: 'selection',
                label: 'Right-skill selection',
                what_this_means: 'Top-K Treffer richtigen Skills.',
                with: 0.5,
                without: 0.0,
                delta: 0.5,
                unit: 'pct',
                mode: 'live',
                source_report: 'internal/bench/reports/',
            },
            {
                id: 'destructive-stops',
                label: 'Destructive-op stops',
                what_this_means: 'Stopps bei riskanten Aktionen.',
                with: 4,
                without: 1,
                delta: 3,
                unit: 'count',
                mode: 'live',
                source_report: 'internal/bench/reports/ab/',
            },
            {
                id: 'ask-vs-act',
                label: 'Ask-vs-act ratio',
                what_this_means: 'Fragen vs. Handeln.',
                with: 0.1,
                without: 0.35,
                delta: -0.25,
                unit: 'ratio',
                mode: 'live',
                source_report: 'internal/bench/reports/ab/',
            },
            {
                id: 'completion',
                label: 'Task completion rate',
                what_this_means: 'Anteil abgeschlossener Aufgaben.',
                with: 0.78,
                without: 0.42,
                delta: 0.36,
                unit: 'pct',
                mode: 'live',
                source_report: 'internal/bench/reports/ab/',
            },
        ],
        totals: {
            cumulative_token_delta: 4656,
            cumulative_eur_delta: 12.85,
            cumulative_pct: 58.2,
            net_verdict: 'net-cost',
        },
        notes: [
            'Token→€ priced at sonnet rates from internal/bench/pricing.yaml.',
            'Pending rungs contribute 0 until measured.',
        ],
    };
}

let _tmpDir: string | null = null;

function _setup(): { latest: string; out: string } {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rvm-'));
    _tmpDir = tmp;
    const reports = path.join(tmp, 'reports');
    fs.mkdirSync(reports);
    const latest = path.join(reports, 'latest.json');
    const out = path.join(tmp, 'value.md');
    rvm._setPathsForTest({ VALUE_REPORTS_DIR: reports, LATEST: latest, OUT_PATH: out });
    return { latest, out };
}

afterEach(() => {
    if (_tmpDir) {
        fs.rmSync(_tmpDir, { recursive: true, force: true });
        _tmpDir = null;
    }
});

describe('render_value_md — required-sections golden (ports test_render_value_md.py)', () => {
    it('writes all required sections', () => {
        const { latest, out } = _setup();
        fs.writeFileSync(latest, JSON.stringify(_canonical_report()));
        expect(rvm.render(true)).toBe(0);
        const text = fs.readFileSync(out, 'utf-8');
        for (const section of rvm.REQUIRED_SECTIONS) {
            expect(text, `missing required section: ${section}`).toContain(section);
        }
    });

    it('panel A has every rung', () => {
        const { latest, out } = _setup();
        fs.writeFileSync(latest, JSON.stringify(_canonical_report()));
        rvm.render(true);
        const text = fs.readFileSync(out, 'utf-8');
        for (const expected of ['Ohne Paket', 'Mit Paket', 'condense', 'rtk', 'terse']) {
            expect(text, `missing rung label: ${expected}`).toContain(expected);
        }
    });

    it('panel B has every metric', () => {
        const { latest, out } = _setup();
        fs.writeFileSync(latest, JSON.stringify(_canonical_report()));
        rvm.render(true);
        const text = fs.readFileSync(out, 'utf-8');
        for (const expected of [
            'Right-skill selection',
            'Destructive-op stops',
            'Ask-vs-act ratio',
            'Task completion rate',
        ]) {
            expect(text, `missing behaviour metric: ${expected}`).toContain(expected);
        }
    });

    it('includes net line with verdict', () => {
        const { latest, out } = _setup();
        fs.writeFileSync(latest, JSON.stringify(_canonical_report()));
        rvm.render(true);
        const text = fs.readFileSync(out, 'utf-8');
        expect(text).toContain('NET');
        expect(text).toContain('extra cost');
        expect(text.includes('+58.20%') || text.includes('+58.2%')).toBe(true);
    });

    it('marks pending rungs inline', () => {
        const { latest, out } = _setup();
        fs.writeFileSync(latest, JSON.stringify(_canonical_report()));
        rvm.render(true);
        expect(fs.readFileSync(out, 'utf-8')).toContain('⏳ pending');
    });

    it('marks dry-run metrics', () => {
        const { latest, out } = _setup();
        const report = _canonical_report();
        (report['behaviour'] as Array<Record<string, unknown>>)[1]!['mode'] = 'dry-run';
        fs.writeFileSync(latest, JSON.stringify(report));
        rvm.render(true);
        expect(fs.readFileSync(out, 'utf-8')).toContain('⚠️ dry-run');
    });

    it('placeholder when no report', () => {
        const { out } = _setup();
        expect(rvm.render(true)).toBe(0);
        const text = fs.readFileSync(out, 'utf-8').toLowerCase();
        expect(text.includes('placeholder') || text.includes('no report')).toBe(true);
        expect(text).toContain('task value');
    });

    it('honest terse caveat reaches output', () => {
        const { latest, out } = _setup();
        fs.writeFileSync(latest, JSON.stringify(_canonical_report()));
        rvm.render(true);
        const text = fs.readFileSync(out, 'utf-8');
        expect(text).toContain('Honest');
        expect(text).toContain('-9.27');
    });

    it('includes reference scale, not pricing date', () => {
        const { latest, out } = _setup();
        fs.writeFileSync(latest, JSON.stringify(_canonical_report()));
        rvm.render(true);
        const text = fs.readFileSync(out, 'utf-8');
        expect(text.includes('1,000') || text.includes('1.000')).toBe(true);
        expect(text).toContain('sonnet');
        expect(text).not.toContain('2026-05-14');
    });
});

// --- Golden parity (python3 vs tsx) on a tmp fixture -------------------------

const py3 = hasPython3();

/** Strip the volatile `_Last rendered:` timestamp lines before diff. */
function stripTimestamps(text: string): string {
    return text
        .split('\n')
        .filter((l) => !l.startsWith('_Last rendered:'))
        .join('\n');
}

describe.skipIf(!py3)('render_value_md — golden parity (python3 vs tsx)', () => {
    function renderWith(bin: string, scriptArgs: string[], reportJson: string | null) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rvm-par-'));
        try {
            const reports = path.join(tmp, 'internal', 'bench', 'reports', 'value');
            fs.mkdirSync(reports, { recursive: true });
            const docs = path.join(tmp, 'docs');
            fs.mkdirSync(docs, { recursive: true });
            if (reportJson !== null) {
                fs.writeFileSync(path.join(reports, 'latest.json'), reportJson);
            }
            // Both runtimes resolve REPO_ROOT from the script's own location,
            // so we cannot relocate it; instead run a tiny driver that imports
            // the module, overrides paths, and renders into the tmp tree.
            return { tmp, reports, docs };
        } finally {
            // caller cleans up
        }
    }

    it('renders byte-identical docs/value.md from the same fixture (timestamps stripped)', () => {
        const fixture = JSON.stringify(_canonical_report());
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rvm-par-'));
        const reports = path.join(tmp, 'reports');
        fs.mkdirSync(reports, { recursive: true });
        const latest = path.join(reports, 'latest.json');
        fs.writeFileSync(latest, fixture);
        const pyOut = path.join(tmp, 'py-value.md');
        const tsOut = path.join(tmp, 'ts-value.md');

        const pyDriver = [
            'import importlib.util, sys',
            `spec = importlib.util.spec_from_file_location('rvm', ${JSON.stringify(PY_SCRIPT)})`,
            'mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)',
            `mod.LATEST = __import__('pathlib').Path(${JSON.stringify(latest)})`,
            `mod.OUT_PATH = __import__('pathlib').Path(${JSON.stringify(pyOut)})`,
            'mod.render(quiet=True)',
        ].join('\n');
        const py = spawnSync('python3', ['-c', pyDriver], { encoding: 'utf8' });
        expect(py.status, py.stderr).toBe(0);

        const tsDriver =
            `import * as rvm from ${JSON.stringify(TS_SCRIPT)};` +
            `rvm._setPathsForTest({ LATEST: ${JSON.stringify(latest)}, OUT_PATH: ${JSON.stringify(tsOut)} });` +
            `rvm.render(true);`;
        const ts = spawnSync(TSX_BIN, ['-e', tsDriver], { encoding: 'utf8' });
        expect(ts.status, ts.stderr).toBe(0);

        const pyText = stripTimestamps(fs.readFileSync(pyOut, 'utf-8'));
        const tsText = stripTimestamps(fs.readFileSync(tsOut, 'utf-8'));
        expect(tsText).toBe(pyText);
        fs.rmSync(tmp, { recursive: true, force: true });
        // touch helper to satisfy lint (kept for parity-structure clarity)
        void renderWith;
    });

    it('renders byte-identical placeholder (timestamps stripped)', () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rvm-ph-'));
        const latest = path.join(tmp, 'absent.json'); // does not exist
        const pyOut = path.join(tmp, 'py-value.md');
        const tsOut = path.join(tmp, 'ts-value.md');

        const pyDriver = [
            'import importlib.util',
            `spec = importlib.util.spec_from_file_location('rvm', ${JSON.stringify(PY_SCRIPT)})`,
            'mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)',
            `mod.LATEST = __import__('pathlib').Path(${JSON.stringify(latest)})`,
            `mod.OUT_PATH = __import__('pathlib').Path(${JSON.stringify(pyOut)})`,
            'mod.render(quiet=True)',
        ].join('\n');
        const py = spawnSync('python3', ['-c', pyDriver], { encoding: 'utf8' });
        expect(py.status, py.stderr).toBe(0);

        const tsDriver =
            `import * as rvm from ${JSON.stringify(TS_SCRIPT)};` +
            `rvm._setPathsForTest({ LATEST: ${JSON.stringify(latest)}, OUT_PATH: ${JSON.stringify(tsOut)} });` +
            `rvm.render(true);`;
        const ts = spawnSync(TSX_BIN, ['-e', tsDriver], { encoding: 'utf8' });
        expect(ts.status, ts.stderr).toBe(0);

        expect(stripTimestamps(fs.readFileSync(tsOut, 'utf-8'))).toBe(
            stripTimestamps(fs.readFileSync(pyOut, 'utf-8')),
        );
        fs.rmSync(tmp, { recursive: true, force: true });
    });
});
