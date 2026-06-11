// Tests for src/scripts/check_no_roadmap_refs.ts (py2ts Phase 4 / Wave 4a).
//
// No pytest suite exists for this module, so this is a focused differential
// suite over the public behaviour (scan, format_text, ROADMAP_FILE_RE,
// self-documenting allowlist, fenced-code skipping) plus a golden-parity
// layer that runs python3 vs tsx on the REAL REPO (skipped without python3).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as nrr from '../../src/scripts/check_no_roadmap_refs.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_roadmap_refs.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_no_roadmap_refs.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function write(p: string, content: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
}

describe('check_no_roadmap_refs — behavioural spec', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nrr-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    // --- Forbidden: specific roadmap-file citations in stable artifacts. ---
    it('flags a roadmap-file citation in a stable rule', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/some-rule.md'),
            'See agents/roadmaps/road-to-x.md for the plan.',
        );
        const v = nrr.scan(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]!.match).toBe('agents/roadmaps/road-to-x.md');
        expect(v[0]!.file).toBe('.agent-src.uncondensed/rules/some-rule.md');
        expect(v[0]!.line).toBe(1);
    });

    it('flags a citation nested under archive/ and skipped/', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            'old: agents/roadmaps/archive/done.md\nskipped: agents/roadmaps/skipped/dead.md\n',
        );
        const matches = nrr.scan(tmp).map((x) => x.match);
        expect(matches).toEqual([
            'agents/roadmaps/archive/done.md',
            'agents/roadmaps/skipped/dead.md',
        ]);
    });

    it('flags a citation in a stable single-file artefact (AGENTS.md)', () => {
        write(path.join(tmp, 'AGENTS.md'), 'plan: agents/roadmaps/road-to-y.md');
        const v = nrr.scan(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]!.file).toBe('AGENTS.md');
    });

    // --- Allowed: directory mentions + angle-bracket placeholders. ---
    it('allows a bare directory mention', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/some-rule.md'),
            'Roadmaps live under agents/roadmaps/ and rotate.',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    it('allows angle-bracket placeholder mentions', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            'Forbidden: agents/roadmaps/<file>.md — do not cite.',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    // --- Fenced code blocks are skipped. ---
    it('skips matches inside fenced code blocks', () => {
        write(
            path.join(tmp, 'docs/contracts/foo.md'),
            '```\nagents/roadmaps/road-to-x.md\n```\nfree text agents/roadmaps/road-to-z.md\n',
        );
        const v = nrr.scan(tmp);
        expect(v).toHaveLength(1);
        expect(v[0]!.match).toBe('agents/roadmaps/road-to-z.md');
        expect(v[0]!.line).toBe(4);
    });

    // --- Self-documenting allowlist files are exempt. ---
    it('exempts the self-documenting rule file', () => {
        write(
            path.join(tmp, '.agent-src.uncondensed/rules/no-roadmap-references.md'),
            'Forbidden: agents/roadmaps/road-to-x.md',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    it('exempts the guideline twin of the rule', () => {
        write(
            path.join(tmp, 'docs/guidelines/agent-infra/no-roadmap-references.md'),
            'Forbidden: agents/roadmaps/road-to-x.md',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    // --- Scope: unstable trees (e.g. agents/roadmaps itself) not scanned. ---
    it('does not scan non-stable trees', () => {
        write(
            path.join(tmp, 'agents/roadmaps/road-to-x.md'),
            'sibling: agents/roadmaps/road-to-y.md',
        );
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    it('clean repo passes', () => {
        write(path.join(tmp, '.agent-src.uncondensed/rules/ok.md'), 'All good.');
        expect(nrr.scan(tmp)).toHaveLength(0);
    });

    // --- format_text output. ---
    it('format_text reports the clean message', () => {
        expect(nrr.format_text([])).toBe('✅  No roadmap-file references in stable artifacts.');
    });

    it('format_text lists each violation with the suffix note', () => {
        const out = nrr.format_text([
            { file: 'AGENTS.md', line: 3, match: 'agents/roadmaps/road-to-x.md' },
        ]);
        expect(out).toContain('❌  Found 1 roadmap reference(s) in stable artifacts:');
        expect(out).toContain('🔴 AGENTS.md:3  →  agents/roadmaps/road-to-x.md');
        expect(out).toContain('Promote the durable conclusion to agents/settings/contexts/');
    });
});

// --- Golden parity on the REAL REPO -----------------------------------------

const py3 = hasPython3();

describe.skipIf(!py3)('check_no_roadmap_refs — golden parity (python3 vs tsx)', () => {
    function runPy(args: readonly string[]) {
        return spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }
    function runTs(args: readonly string[]) {
        return spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    }

    it('matches text format byte-for-byte', () => {
        const py = runPy([]);
        const ts = runTs([]);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });

    it('matches json format byte-for-byte', () => {
        const py = runPy(['--format', 'json']);
        const ts = runTs(['--format', 'json']);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.status).toBe(py.status);
    });
});
