// Tests for src/scripts/check_knowledge_cards.ts — the knowledge-card gate.
//
// 1:1 port of the Python behavioral contract (ADR-200 parity). Each case spawns
// the TS script via tsx as a real child process and asserts on the observable
// contract (stdout / stderr / exit). A trailing golden-parity block runs
// python3 + tsx on identical fixtures and asserts byte-identical
// stdout+stderr+exit, skipped when python3 is absent.
//
// The script computes finding paths relative to the repo ROOT via
// `Path.relative_to(ROOT)`. To keep those paths byte-identical (and to avoid
// the documented latent crash on an absolute `--dir` outside ROOT — see the
// freshness test), the golden-parity fixtures live under a temp directory
// INSIDE the repo (the real-usage shape) and are passed as a relative `--dir`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = (() => {
    const env = process.env['TSX_BIN'];
    if (env) {
        return resolve(REPO_ROOT, env);
    }
    return join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
})();
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'check_knowledge_cards.ts');
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'check_knowledge_cards.py');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function runTs(args: readonly string[], cwd: string = REPO_ROOT): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function runPy(args: readonly string[], cwd: string = REPO_ROOT): RunResult {
    const r = spawnSync('python3', [PY_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

function pythonAvailable(): boolean {
    const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
}
const HAVE_PYTHON = pythonAvailable();

// A card directory that lives INSIDE the repo, so finding paths relativize to
// ROOT identically across python3 and tsx. Created fresh per test, removed after.
let cardDirAbs: string;
let cardDirRel: string;
beforeEach(() => {
    cardDirAbs = mkdtempSync(join(REPO_ROOT, 'agents', 'knowledge', '.ckc-test-'));
    cardDirRel = relative(REPO_ROOT, cardDirAbs);
});
afterEach(() => {
    rmSync(cardDirAbs, { recursive: true, force: true });
});

function writeCard(name: string, body: string): void {
    writeFileSync(join(cardDirAbs, name), body, 'utf-8');
}

const VALID = `---
trust: anti-hallucination
type: anti-hallucination
links:
  authoritative: ${'package.json'}
---
Body.
`;

describe('check_knowledge_cards.ts', () => {
    it('missing directory is not an error', () => {
        const r = runTs(['--dir', join(cardDirRel, 'does-not-exist')]);
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('No cards directory found');
    });

    it('empty directory reports nothing to check', () => {
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('No knowledge cards found — nothing to check.\n');
    });

    it('README.md is skipped', () => {
        writeCard('README.md', 'index\n');
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('No knowledge cards found — nothing to check.\n');
    });

    it('a valid card passes', () => {
        writeCard('good.md', VALID);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('passed all checks');
    });

    it('C1 — card over 150 lines fails', () => {
        const big = `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: package.json\n---\n${'l\n'.repeat(200)}`;
        writeCard('big.md', big);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C1: card exceeds 150 lines');
    });

    it('C4 — missing trust/type fails', () => {
        writeCard('bad.md', `---\nfoo: bar\nlinks:\n  authoritative: package.json\n---\nBody.\n`);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("C4: missing 'trust' field");
        expect(r.stdout).toContain("C4: missing 'type' field");
    });

    it('C4 — wrong type fails', () => {
        writeCard(
            'bad.md',
            `---\ntrust: t\ntype: lead\nlinks:\n  authoritative: package.json\n---\nBody.\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain("C4: type must be 'anti-hallucination', got 'lead'");
    });

    it('C2 — missing pointer fails', () => {
        writeCard('bad.md', `---\ntrust: t\ntype: anti-hallucination\n---\nBody.\n`);
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C2: missing links.authoritative pointer');
    });

    it('C3 — local pointer not found fails', () => {
        writeCard(
            'bad.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: nope/does-not-exist.md\n---\nBody.\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C3: local pointer not found: nope/does-not-exist.md');
    });

    it('C5 — observed_at span over 7 days fails', () => {
        writeCard(
            'span.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2026-01-01\nobserved_at: 2026-02-01\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C5: observed_at timestamps span');
    });

    it('C5 — non-ancestor SHAs flagged as Frankenstein', () => {
        writeCard(
            'sha.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nsource_version: abcdef1\nsource_version: 1234567\n`,
        );
        const r = runTs(['--dir', cardDirRel]);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('are not in a linear ancestry chain (Frankenstein card)');
    });

    it('C6 — strict mode flags missing source path', () => {
        writeCard(
            'strict.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nfact source=src/scripts/no_such_file.zzz:5\n`,
        );
        const r = runTs(['--dir', cardDirRel, '--strict']);
        expect(r.status).toBe(1);
        expect(r.stdout).toContain('C6: source path not found or empty: src/scripts/no_such_file.zzz');
    });

    it('freshness-days warns on an old card (relative dir, exit 0)', () => {
        writeCard(
            'fresh.md',
            `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2020-01-01\n`,
        );
        const r = runTs(['--dir', cardDirRel, '--freshness-days', '30']);
        expect(r.status, r.stdout + r.stderr).toBe(0);
        expect(r.stdout).toContain('lead-only');
        expect(r.stdout).toContain('passed all checks');
    });

    it('freshness-days with an absolute outside-ROOT dir replicates the Python crash (exit 1)', () => {
        // Faithful replication of the Python latent bug (ADR-200): relative_to
        // raises for an absolute --dir outside ROOT → uncaught → exit 1.
        const out = mkdtempSync(join(tmpdir(), 'ckc-out-'));
        try {
            writeFileSync(
                join(out, 'fresh.md'),
                `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2020-01-01\n`,
            );
            const r = runTs(['--dir', out, '--freshness-days', '30']);
            expect(r.status).toBe(1);
        } finally {
            rmSync(out, { recursive: true, force: true });
        }
    });

    it('invalid --freshness-days int exits 2', () => {
        const r = runTs(['--freshness-days', 'abc']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain("invalid int value: 'abc'");
    });

    it('unrecognized argument exits 2', () => {
        const r = runTs(['--bogus']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('unrecognized arguments: --bogus');
    });

    // --- golden parity vs python3 -------------------------------------------
    describe.skipIf(!HAVE_PYTHON || !existsSync(PY_SCRIPT))('golden parity', () => {
        function parity(args: string[]): void {
            const py = runPy(args);
            const ts = runTs(args);
            expect(ts.stdout, JSON.stringify(args)).toBe(py.stdout);
            expect(ts.stderr, JSON.stringify(args)).toBe(py.stderr);
            expect(ts.status, JSON.stringify(args)).toBe(py.status);
        }

        it('mixed-failure tree byte-identical (text)', () => {
            writeCard('big.md', `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: nope/missing.md\n---\n${'l\n'.repeat(200)}`);
            writeCard(
                'span.md',
                `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2026-01-01\nobserved_at: 2026-03-01\n`,
            );
            writeCard(
                'sha.md',
                `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nsource_version: abcdef1\nsource_version: 1234567\n`,
            );
            writeCard('bad.md', `---\nfoo: bar\n---\nBody.\n`);
            parity(['--dir', cardDirRel]);
        });

        it('valid card byte-identical', () => {
            writeCard('good.md', VALID);
            parity(['--dir', cardDirRel]);
        });

        it('missing + empty dir byte-identical', () => {
            parity(['--dir', join(cardDirRel, 'nope')]);
            parity(['--dir', cardDirRel]);
        });

        it('strict mode byte-identical', () => {
            writeCard(
                's.md',
                `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nfact source=src/scripts/no_such.zzz:9\n`,
            );
            parity(['--dir', cardDirRel, '--strict']);
        });

        it('freshness warning byte-identical (relative dir)', () => {
            writeCard(
                'fresh.md',
                `---\ntrust: t\ntype: anti-hallucination\nlinks:\n  authoritative: https://example.com\n---\nobserved_at: 2020-01-01\n`,
            );
            parity(['--dir', cardDirRel, '--freshness-days', '30']);
        });

        it('arg-error paths byte-identical', () => {
            parity(['--freshness-days', 'abc']);
            parity(['--bogus']);
        });
    });
});
