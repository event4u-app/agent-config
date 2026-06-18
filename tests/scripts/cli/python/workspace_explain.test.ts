// Golden-parity tests for src/cli/python/workspace_explain.ts (py2ts ADR-200 —
// the explain-v1 envelope plain/technical renderer + host-decision explainer).
//
// Strategy: run `python3 src/cli/python/workspace_explain.py` vs
// `tsx src/cli/python/workspace_explain.ts` on deterministic surfaces over temp
// JSON fixtures and byte-compare stdout / stderr / exit. The module is a pure
// renderer (reads an envelope / detection / health JSON, writes only stdout/
// stderr). The suite NEVER touches the real repo.
//
// COLUMNS=200 is forced for both languages so argparse emits single-line usage
// (otherwise the usage line in arg-error stderr re-wraps to terminal width).
// The `--help` per-flag BODY is NOT byte-compared (porting contract); only the
// usage line. The file-not-found path prints a Python traceback (TS prints a
// node stack) — only exit code is asserted there.
//
// Float-parity surface: technical mode and the plain-mode `(0.NN)` suffix use
// Python `f"{x:.2f}"` (round-half-to-even on the exact double). The TS twin's
// `_pyFixed2` is exercised here with the JS-divergent values 0.125 (→ 0.12,
// not 0.13) and 0.625 (→ 0.62, not 0.63).
//
// Relative-time nondeterminism: `_human_relative` uses the live clock on the
// render path (main() does not thread `now`). To stay deterministic the
// envelopes use null / invalid / absent `last_reviewed_at` (→ "(unavailable)"
// or the raw string), and `norm()` masks any "N hour(s)/day(s)/month(s) ago"
// phrase as a belt-and-braces fallback.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// tests/scripts/cli/python/workspace_explain.test.ts → repo root is five hops up.
const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
    '..',
);
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_explain.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'cli', 'python', 'workspace_explain.py');
const TSX_BIN = path.resolve(
    REPO_ROOT,
    process.env['TSX_BIN'] ??
        path.join('node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx'),
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runPy(args: string[], cwd: string): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, PYTHONPATH: path.join(REPO_ROOT, 'src'), COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

function runTs(args: string[], cwd: string): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, COLUMNS: '200' },
    });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** Replace temp roots with `<TMP>` + mask the live-clock relative-time phrase. */
function norm(text: string, roots: string[]): string {
    let out = text;
    for (const root of roots) {
        out = out.split(root).join('<TMP>');
        let real = root;
        try {
            real = fs.realpathSync(root);
        } catch {
            /* root may already be removed */
        }
        out = out.split(real).join('<TMP>');
    }
    // Belt-and-braces: `_human_relative` is clock-driven on the render path.
    // Fixtures avoid valid timestamps, but mask the phrase so a clock tick
    // between the two subprocess spawns can never flake the differential.
    out = out.replace(/\d+ (?:hour|day|month)s? ago/g, '<REL>');
    return out;
}

/** Assert py and ts agree byte-for-byte (after normalization) + same exit. */
function expectParity(args: string[], cwd: string, roots: string[]): void {
    const p = runPy(args, cwd);
    const t = runTs(args, cwd);
    expect(t.status).toBe(p.status);
    expect(norm(t.stdout, roots)).toBe(norm(p.stdout, roots));
    expect(norm(t.stderr, roots)).toBe(norm(p.stderr, roots));
}

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wexplain-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeJson(name: string, obj: unknown): string {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, JSON.stringify(obj));
    return p;
}

function writeRaw(name: string, content: string): string {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, content);
    return p;
}

// ---------------------------------------------------------------------------
// Usage / argument errors.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('explain — argument errors', () => {
    it('top -h: exit 0, usage line on stdout', () => {
        const p = runPy(['-h'], tmp);
        const t = runTs(['-h'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        const usage = 'usage: workspace_explain [-h] {render,explain-host} ...';
        expect(p.stdout.startsWith(usage)).toBe(true);
        expect(t.stdout.startsWith(usage)).toBe(true);
    });

    it('render -h: exit 0, usage line on stdout', () => {
        const p = runPy(['render', '-h'], tmp);
        const t = runTs(['render', '-h'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(p.stdout.split('\n')[0]).toBe(t.stdout.split('\n')[0]);
    });

    it('explain-host -h: exit 0, usage line on stdout', () => {
        const p = runPy(['explain-host', '-h'], tmp);
        const t = runTs(['explain-host', '-h'], tmp);
        expect(t.status).toBe(p.status);
        expect(p.status).toBe(0);
        expect(p.stdout.split('\n')[0]).toBe(t.stdout.split('\n')[0]);
    });

    it('no args: exit 2 + byte-identical usage+error stderr', () => {
        expectParity([], tmp, [tmp]);
    });

    it('bad subcommand: exit 2 + byte-identical stderr', () => {
        expectParity(['frob'], tmp, [tmp]);
    });

    it('render missing --envelope-file: exit 2 + byte-identical stderr', () => {
        expectParity(['render'], tmp, [tmp]);
    });

    it('explain-host missing --detection-file: exit 2 + byte-identical stderr', () => {
        expectParity(['explain-host'], tmp, [tmp]);
    });

    it('render bad --mode choice: exit 2 + byte-identical stderr', () => {
        const env = writeJson('e.json', { trust_score: 0.5 });
        expectParity(['render', '--mode', 'bogus', '--envelope-file', env], tmp, [tmp]);
    });

    it('render stray positional: exit 2 unrecognized', () => {
        const env = writeJson('e.json', { trust_score: 0.5 });
        expectParity(['render', '--envelope-file', env, 'stray'], tmp, [tmp]);
    });

    it('render unknown flag: exit 2 unrecognized', () => {
        const env = writeJson('e.json', { trust_score: 0.5 });
        expectParity(['render', '--envelope-file', env, '--bogus'], tmp, [tmp]);
    });

    it('render required-missing wins over stray positional', () => {
        expectParity(['render', 'stray'], tmp, [tmp]);
    });

    it('render --mode missing value: exit 2 expected-one-argument', () => {
        expectParity(['render', '--mode'], tmp, [tmp]);
    });

    it('explain-host stray positional: exit 2 unrecognized', () => {
        const det = writeJson('d.json', { host: 'h' });
        expectParity(['explain-host', '--detection-file', det, 'stray'], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// render — plain mode across trust / freshness bands, sources, contradictions.
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — plain mode', () => {
    it('very_high trust, fresh, sources present, no contradictions, id present', () => {
        const env = writeJson('e.json', {
            trust_score: 0.9,
            decay: { applied_factor: 0.95 },
            evidence: { sources: ['alpha', 'beta'] },
            contradictions: [],
            last_reviewed_at: null,
            id: 'env-1',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('high trust, aging, contradictions present, falsy id (empty string → ids:[])', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.6 },
            evidence: { sources: ['s1'] },
            contradictions: ['c1', 'c2', 'c3'],
            last_reviewed_at: null,
            id: '',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('medium trust, stale, empty sources, no contradictions', () => {
        const env = writeJson('e.json', {
            trust_score: 0.5,
            decay: { applied_factor: 0.2 },
            evidence: { sources: [] },
            contradictions: [],
            last_reviewed_at: null,
            id: 'm',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('low trust (below medium), missing decay/evidence/contradictions/id entirely', () => {
        const env = writeJson('e.json', { trust_score: 0.1 });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('exact band boundary very_high=0.85 (>= is Very High)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.85,
            decay: { applied_factor: 0.8 },
            evidence: { sources: ['x'] },
            id: 'b',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('more than 5 sources → only first 5 joined', () => {
        const env = writeJson('e.json', {
            trust_score: 0.65,
            decay: { applied_factor: 0.5 },
            evidence: { sources: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
            id: 'six',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('null trust/decay (or-fallback to 0.0) → Low + Stale + (0.00)', () => {
        const env = writeJson('e.json', {
            trust_score: null,
            decay: { applied_factor: null },
            evidence: { sources: [] },
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('JS-divergent float 0.125 → (0.12) not (0.13)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.125,
            decay: { applied_factor: 0.625 },
            evidence: { sources: [] },
            id: 'half',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('falsy id 0 (number zero → ids:[])', () => {
        const env = writeJson('e.json', { trust_score: 0.7, id: 0 });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('non-string source element → TypeError on str.join → exit 1, no stdout', () => {
        // Python `", ".join([...])` raises TypeError on a non-str element
        // (int / bool), aborting with a traceback (exit 1). The twin throws too;
        // tracebacks differ from node stacks, so only exit + empty stdout assert.
        const env = writeJson('e.json', {
            trust_score: 0.7,
            evidence: { sources: ['a', 1, true] },
            id: 'mix',
        });
        const p = runPy(['render', '--mode', 'plain', '--envelope-file', env], tmp);
        const t = runTs(['render', '--mode', 'plain', '--envelope-file', env], tmp);
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
        expect(p.stdout).toBe('');
        expect(t.stdout).toBe('');
    });
});

// ---------------------------------------------------------------------------
// render — technical mode (raw fields, :.2f decay, last_reviewed passthrough).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — technical mode', () => {
    it('technical fields + decay=:.2f + 0 contradictions → "0"', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['a', 'b'] },
            contradictions: [],
            last_reviewed_at: '2020-01-02T03:04:05Z',
            id: 'tech',
        });
        expectParity(['render', '--mode', 'technical', '--envelope-file', env], tmp, [tmp]);
    });

    it('technical, JS-divergent decay 0.625 → decay=0.62', () => {
        const env = writeJson('e.json', {
            trust_score: 0.125,
            decay: { applied_factor: 0.625 },
            evidence: { sources: [] },
            contradictions: ['c1'],
            last_reviewed_at: null,
            id: 'tech2',
        });
        expectParity(['render', '--mode', 'technical', '--envelope-file', env], tmp, [tmp]);
    });

    it('technical, last_reviewed_at absent → (unavailable)', () => {
        const env = writeJson('e.json', { trust_score: 1.0, decay: { applied_factor: 1.0 } });
        expectParity(['render', '--mode', 'technical', '--envelope-file', env], tmp, [tmp]);
    });

    it('technical default mode is plain (no --mode → plain)', () => {
        const env = writeJson('e.json', { trust_score: 0.66, evidence: { sources: ['z'] }, id: 'd' });
        expectParity(['render', '--envelope-file', env], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// render — last_reviewed_at variants (deterministic "(unavailable)" / raw).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — last_reviewed deterministic paths', () => {
    it('null last_reviewed (plain) → (unavailable)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.7,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['x'] },
            last_reviewed_at: null,
            id: 'n',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('invalid timestamp (plain) → raw string passthrough', () => {
        const env = writeJson('e.json', {
            trust_score: 0.7,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['x'] },
            last_reviewed_at: 'not-a-real-date',
            id: 'inv',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });

    it('absent last_reviewed (plain) → (unavailable)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.7,
            decay: { applied_factor: 0.9 },
            evidence: { sources: ['x'] },
            id: 'abs',
        });
        expectParity(['render', '--mode', 'plain', '--envelope-file', env], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// render — custom glossary (override labels + bands).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('render — custom glossary', () => {
    const GLOSS = `# a comment
labels:
  confidence: Vertrauen
  sources: Quellen
  last_reviewed: Geprueft
  contradictions: Strittig
bands:
  confidence:
    very_high: 0.95
    high: 0.70
    medium: 0.30
  freshness:
    fresh: 0.90
    aging: 0.40
`;

    it('glossary overrides plain labels + confidence bands', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.5 },
            evidence: { sources: ['a'] },
            last_reviewed_at: null,
            id: 'g',
        });
        const g = writeRaw('gloss.yml', GLOSS);
        expectParity(['render', '--mode', 'plain', '--envelope-file', env, '--glossary', g], tmp, [
            tmp,
        ]);
    });

    it('glossary with quoted label value (strip quotes)', () => {
        const env = writeJson('e.json', { trust_score: 0.5, evidence: { sources: [] }, id: 'q' });
        const g = writeRaw(
            'gloss.yml',
            `labels:
  confidence: "Quoted Conf"
  sources: 'Single Quoted'
`,
        );
        expectParity(['render', '--mode', 'plain', '--envelope-file', env, '--glossary', g], tmp, [
            tmp,
        ]);
    });

    it('glossary with non-float band value (ValueError → skipped)', () => {
        const env = writeJson('e.json', { trust_score: 0.6, evidence: { sources: [] }, id: 's' });
        const g = writeRaw(
            'gloss.yml',
            `bands:
  confidence:
    very_high: notanumber
    high: 0.55
`,
        );
        expectParity(['render', '--mode', 'plain', '--envelope-file', env, '--glossary', g], tmp, [
            tmp,
        ]);
    });

    it('missing glossary file → defaults used', () => {
        const env = writeJson('e.json', { trust_score: 0.66, evidence: { sources: ['z'] }, id: 'd' });
        const ghost = path.join(tmp, 'no-such.yml');
        expectParity(
            ['render', '--mode', 'plain', '--envelope-file', env, '--glossary', ghost],
            tmp,
            [tmp],
        );
    });

    it('glossary does NOT override technical labels (LABELS_TECHNICAL fixed)', () => {
        const env = writeJson('e.json', {
            trust_score: 0.72,
            decay: { applied_factor: 0.5 },
            evidence: { sources: ['a'] },
            last_reviewed_at: null,
            id: 'gt',
        });
        const g = writeRaw('gloss.yml', GLOSS);
        expectParity(
            ['render', '--mode', 'technical', '--envelope-file', env, '--glossary', g],
            tmp,
            [tmp],
        );
    });
});

// ---------------------------------------------------------------------------
// explain-host — plain mode (known/unknown, tier1/tier3, demotion, killed, resume).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('explain-host — plain mode', () => {
    it('known tier-1 driving host', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
            mode: 'tier1-drive-pending',
        });
        expectParity(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp]);
    });

    it('known tier-3 handoff host', () => {
        const det = writeJson('d.json', {
            host: 'augment',
            known: true,
            inventory_tier: 3,
            cli: null,
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        expectParity(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp]);
    });

    it('unknown host (known:false) → hand-off sentence', () => {
        const det = writeJson('d.json', {
            host: 'mystery',
            known: false,
            inventory_tier: null,
            cli: null,
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        expectParity(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp]);
    });

    it('tier-1 demotion fallback (known + inv_tier 1 + no cli) fires "Why a fallback fired"', () => {
        const det = writeJson('d.json', {
            host: 'codex',
            known: true,
            inventory_tier: 1,
            cli: 'codex',
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        expectParity(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp]);
    });

    it('killed kill-switch fallback (with health)', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
        });
        const health = writeJson('h.json', { killed: true, consecutive_failures: 4 });
        expectParity(
            ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
            tmp,
            [tmp],
        );
    });

    it('demotion + killed both fire (two fallback paragraphs)', () => {
        const det = writeJson('d.json', {
            host: 'codex',
            known: true,
            inventory_tier: 1,
            cli: 'codex',
            cli_present: false,
            effective_tier: 3,
        });
        const health = writeJson('h.json', { killed: true, consecutive_failures: 7 });
        expectParity(
            ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
            tmp,
            [tmp],
        );
    });

    it('resume-session-id → "Why continue" block', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
        });
        expectParity(
            [
                'explain-host',
                '--mode',
                'plain',
                '--detection-file',
                det,
                '--resume-session-id',
                'sess-abc',
            ],
            tmp,
            [tmp],
        );
    });

    it('killed false, no fallback, no resume (minimal plain)', () => {
        const det = writeJson('d.json', {
            host: 'gemini',
            known: true,
            inventory_tier: 1,
            cli: 'gemini',
            cli_present: true,
            effective_tier: 1,
        });
        const health = writeJson('h.json', { killed: false, consecutive_failures: 0 });
        expectParity(
            ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
            tmp,
            [tmp],
        );
    });

    it('detection missing host → "(unknown)" default', () => {
        const det = writeJson('d.json', { known: false });
        expectParity(['explain-host', '--mode', 'plain', '--detection-file', det], tmp, [tmp]);
    });

    it('health consecutive_failures absent → int(... or 0) → 0', () => {
        const det = writeJson('d.json', {
            host: 'codex',
            known: true,
            inventory_tier: 1,
            cli: 'codex',
            cli_present: false,
            effective_tier: 3,
        });
        const health = writeJson('h.json', { killed: true });
        expectParity(
            ['explain-host', '--mode', 'plain', '--detection-file', det, '--health-file', health],
            tmp,
            [tmp],
        );
    });
});

// ---------------------------------------------------------------------------
// explain-host — technical mode (raw 2-line block).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('explain-host — technical mode', () => {
    it('technical block, all fields + health + resume', () => {
        const det = writeJson('d.json', {
            host: 'augment',
            known: true,
            inventory_tier: 1,
            cli: 'aug',
            cli_present: false,
            effective_tier: 3,
            mode: 'handoff',
        });
        const health = writeJson('h.json', { killed: true, consecutive_failures: 4 });
        expectParity(
            [
                'explain-host',
                '--mode',
                'technical',
                '--detection-file',
                det,
                '--health-file',
                health,
                '--resume-session-id',
                'sess-9',
            ],
            tmp,
            [tmp],
        );
    });

    it('technical block, no health no resume → killed=False, failures=0, resume=-', () => {
        const det = writeJson('d.json', {
            host: 'claude-code',
            known: true,
            inventory_tier: 1,
            cli: 'claude',
            cli_present: true,
            effective_tier: 1,
        });
        expectParity(['explain-host', '--mode', 'technical', '--detection-file', det], tmp, [tmp]);
    });

    it('technical block, unknown host (null inv_tier, null cli)', () => {
        const det = writeJson('d.json', {
            host: 'mystery',
            known: false,
            inventory_tier: null,
            cli: null,
            cli_present: false,
            effective_tier: 3,
        });
        expectParity(['explain-host', '--mode', 'technical', '--detection-file', det], tmp, [tmp]);
    });
});

// ---------------------------------------------------------------------------
// File-not-found (Python traceback vs node stack — only exit code asserted).
// ---------------------------------------------------------------------------

describe.skipIf(!py3)('explain — file errors', () => {
    it('render envelope-file not found → exit 1, no stdout', () => {
        const ghost = path.join(tmp, 'nope.json');
        const p = runPy(['render', '--envelope-file', ghost], tmp);
        const t = runTs(['render', '--envelope-file', ghost], tmp);
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
        expect(p.stdout).toBe('');
        expect(t.stdout).toBe('');
        expect(p.stderr.length).toBeGreaterThan(0);
        expect(t.stderr.length).toBeGreaterThan(0);
    });

    it('explain-host detection-file not found → exit 1, no stdout', () => {
        const ghost = path.join(tmp, 'nope.json');
        const p = runPy(['explain-host', '--detection-file', ghost], tmp);
        const t = runTs(['explain-host', '--detection-file', ghost], tmp);
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
        expect(p.stdout).toBe('');
        expect(t.stdout).toBe('');
    });

    it('render malformed JSON → exit 1, no stdout', () => {
        const bad = writeRaw('bad.json', '{not json');
        const p = runPy(['render', '--envelope-file', bad], tmp);
        const t = runTs(['render', '--envelope-file', bad], tmp);
        expect(p.status).toBe(1);
        expect(t.status).toBe(1);
        expect(p.stdout).toBe('');
        expect(t.stdout).toBe('');
    });
});
