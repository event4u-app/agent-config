// Tests for src/scripts/check_council_references.ts (py2ts Phase 4 / Wave 4a).
//
// Two layers:
//   1. 1:1 port of tests/test_check_council_references.py — the behavioural
//      spec (forbidden hits, allowed forms, structural carve-outs, scope).
//   2. Golden parity on the REAL REPO — python3 vs tsx, byte-identical
//      stdout/stderr/exit (skipped when python3 is absent).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ccr from '../../src/scripts/check_council_references.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_council_references.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_council_references.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
}

function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

// --- 1:1 port: drive main() against a clean tmp tree, cwd-isolated ----------

describe('check_council_references — behavioural spec (port of pytest suite)', () => {
    let tmp: string;
    let prevCwd: string;

    beforeEach(() => {
        prevCwd = process.cwd();
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccr-'));
        process.chdir(tmp);
        // Mirror `monkeypatch.setattr(ccr, "ROOT", Path("."))`.
        ccr._setRootForTest('.');
    });

    afterEach(() => {
        process.chdir(prevCwd);
        ccr._setRootForTest('.');
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // --- Forbidden hits — the linter must catch these. ---
    it('forbidden session reference in context', () => {
        write(
            path.join(tmp, 'agents/settings/contexts/foo.md'),
            'See `agents/runtime/council/sessions/2026-05-06.json` for the trace.',
        );
        expect(ccr.main()).toBe(1);
    });

    it('forbidden question reference in roadmap', () => {
        write(
            path.join(tmp, 'agents/roadmaps/road-to-x.md'),
            'Question: agents/runtime/council/questions/topic.md',
        );
        expect(ccr.main()).toBe(1);
    });

    it('forbidden response reference in contract', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            'Source: agents/runtime/council/responses/topic.json',
        );
        expect(ccr.main()).toBe(1);
    });

    it('forbidden response reference in adr', () => {
        write(
            path.join(tmp, 'docs/decisions/ADR-x.md'),
            'See agents/runtime/council/responses/x.json',
        );
        expect(ccr.main()).toBe(1);
    });

    // --- Allowed forms — the linter must let these pass. ---
    it('allowed directory mention', () => {
        write(
            path.join(tmp, 'agents/settings/contexts/foo.md'),
            'Sessions live under agents/runtime/council/sessions/ and rotate after 7 days.',
        );
        expect(ccr.main()).toBe(0);
    });

    it('allowed placeholder path', () => {
        write(
            path.join(tmp, 'agents/settings/contexts/foo.md'),
            'Schema: `agents/runtime/council/sessions/<UTC-timestamp>/raw-text.md`',
        );
        expect(ccr.main()).toBe(0);
    });

    it('allowed in archive', () => {
        write(
            path.join(tmp, 'agents/roadmaps/archive/old.md'),
            'Round 1 — `agents/runtime/council/sessions/2026-05-03.json` — historical.',
        );
        expect(ccr.main()).toBe(0);
    });

    it('allowed in analysis', () => {
        write(
            path.join(tmp, 'agents/evidence/analysis/compare-foo.md'),
            'Source: `agents/runtime/council/responses/foo.json`',
        );
        expect(ccr.main()).toBe(0);
    });

    it('allowed in rule itself', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/no-roadmap-references.md'),
            'Forbidden: `agents/runtime/council/sessions/<file>.json`',
        );
        expect(ccr.main()).toBe(0);
    });

    it('allowed in ai-council skill', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/skills/ai-council/SKILL.md'),
            'Output: agents/runtime/council/sessions/2026-05-06.json',
        );
        expect(ccr.main()).toBe(0);
    });

    it('inline pragma suppresses', () => {
        write(
            path.join(tmp, 'docs/decisions/ADR-x.md'),
            'Trace: agents/runtime/council/sessions/x.json ' +
                '<!-- council-ref-allowed: ADR decision trace -->',
        );
        expect(ccr.main()).toBe(0);
    });

    // --- Structural carve-outs (P3.5) — immutable inputs / decision provenance. ---
    it('carveout evaluation-context to council-question', () => {
        write(
            path.join(tmp, 'agents/settings/contexts/evaluation-2-2-2-followups.md'),
            'Question file at ' +
                '`agents/runtime/council/questions/composer-fallback-feasibility.md`.',
        );
        expect(ccr.main()).toBe(0);
    });

    it('carveout contract to session synthesis', () => {
        write(
            path.join(tmp, 'docs/contracts/tier-3-contrib-plugin.md'),
            'Surfaced during the ' +
                '[`2026-05-12-installer-expansion`]' +
                '(../../agents/runtime/council/sessions/2026-05-12-installer-expansion/synthesis.md)' +
                ' council round.',
        );
        expect(ccr.main()).toBe(0);
    });

    it('carveout does not widen evaluation to session', () => {
        write(
            path.join(tmp, 'agents/settings/contexts/evaluation-foo.md'),
            'See `agents/runtime/council/sessions/2026-05-06/raw.json` for the trace.',
        );
        expect(ccr.main()).toBe(1);
    });

    it('carveout does not widen contract to question', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            'See `agents/runtime/council/questions/topic.md`.',
        );
        expect(ccr.main()).toBe(1);
    });

    it('carveout does not widen non-evaluation context', () => {
        write(
            path.join(tmp, 'agents/settings/contexts/auth-model.md'),
            'Reference: `agents/runtime/council/questions/topic.md`.',
        );
        expect(ccr.main()).toBe(1);
    });

    it('carveout does not widen contract to non-synthesis', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            'See `agents/runtime/council/sessions/2026-05-06/responses.json`.',
        );
        expect(ccr.main()).toBe(1);
    });

    // --- Scope — files outside SCAN_ROOTS must not be scanned. ---
    it('unscanned directory ignored', () => {
        write(
            path.join(tmp, 'src/scripts/something.py'),
            '_PATH = "agents/runtime/council/sessions/x.json"',
        );
        expect(ccr.main()).toBe(0);
    });

    it('clean repo passes', () => {
        write(path.join(tmp, 'agents/settings/contexts/foo.md'), 'All good.');
        expect(ccr.main()).toBe(0);
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('check_council_references — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        });
    }

    it('matches default invocation byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches --quiet invocation byte-for-byte', () => {
        const py = runPy(['--quiet']);
        const ts = runTs(['--quiet']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
