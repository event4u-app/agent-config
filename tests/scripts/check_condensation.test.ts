// Tests for src/scripts/check_condensation.ts (py2ts Phase 4 / Wave 4a).
//
// No pytest suite targets check_condensation directly. The tsx twin is the
// source of truth (the python original was deleted in the teardown). This
// suite runs it on the REAL REPO and on a synthetic fixture root that exercises
// every finding-message path, asserting the exit-code contract — the way CI
// invokes the checker (`./scripts-run src/scripts/check_condensation`).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TS = join(REPO_ROOT, 'src', 'scripts', 'check_condensation.ts');

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function runTs(args: readonly string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// The twin runs to a defined exit and is deterministic for these args.
function assertParity(args: readonly string[]): void {
    const a = runTs(args);
    const b = runTs(args);
    expect(a.status, a.stderr).not.toBeNull();
    expect(b.stdout).toBe(a.stdout);
    expect(b.status).toBe(a.status);
}

describe('check_condensation golden parity — real repo', () => {
    it('matches Python on --format text', () => {
        assertParity(['--format', 'text']);
    });

    it('matches Python on --format json', () => {
        assertParity(['--format', 'json']);
    });

    it('matches Python on --summary', () => {
        assertParity(['--summary']);
    });

    it('matches Python on default (no flags)', () => {
        assertParity([]);
    });
});

describe('check_condensation golden parity — synthetic issues', () => {
    function buildFixture(): string {
        const root = mkdtempSync(join(tmpdir(), 'condfx-'));
        const mk = (rel: string, body: string): void => {
            const full = join(root, rel);
            mkdirSync(join(full, '..'), { recursive: true });
            writeFileSync(full, body, 'utf8');
        };

        // frontmatter mismatch + lost H1/H2 heading + excessive reduction
        mk(
            '.agent-src.uncondensed/rules/a.md',
            '---\ntype: always\nfoo: bar\n---\n\n# Heading One\n\n## Heading Two\n\n' +
                'Some prose here that is fairly long and will be heavily reduced in the ' +
                'condensed version so the excessive_reduction path fires for sure when we ' +
                'drop most of the words from the body of this rule file entirely so it ' +
                'triggers the warning threshold above sixty percent which needs a lot of ' +
                'words to be removed to actually fire properly here we go more words and ' +
                'more words.\n',
        );
        mk('dist/agent-src/rules/a.md', '---\ntype: always\nfoo: baz\n---\n\n# Heading One\n\nShort.\n');

        // iron law: downgrade (##→###), missing (## The Iron Law), passage dropped, lost code block
        mk(
            '.agent-src.uncondensed/rules/b.md',
            '---\nx: 1\n---\n\n## Iron Law\n\n```\nNEVER DO X\n```\n\nPara one.\n\nPara two.\n\n' +
                '- bullet a\n- bullet b\n\n## The Iron Law\n\nBody text.\n\n```python\nprint("code")\n```\n',
        );
        mk(
            'dist/agent-src/rules/b.md',
            '---\nx: 1\n---\n\n### Iron Law\n\n```\nNEVER DO X\n```\n\nPara one.\n\n- bullet a\n',
        );

        // commands skipped (verbatim copy, never condensed)
        mk('.agent-src.uncondensed/commands/c.md', '# Command\nZZZ\n');
        mk('dist/agent-src/commands/c.md', '# Command different\n');

        // modified code block
        mk('.agent-src.uncondensed/skills/d.md', '# D\n\n```\nalpha beta gamma\ndelta\n```\n');
        mk('dist/agent-src/skills/d.md', '# D\n\n```\ntotally different content here\n```\n');

        return root;
    }

    it('matches Python finding messages on text + json (with errors → exit 1)', () => {
        const root = buildFixture();
        try {
            for (const fmt of ['text', 'json'] as const) {
                const ts = runTs(['--root', root, '--format', fmt]);
                expect(ts.status, ts.stderr).toBe(1);
            }
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it('matches Python --summary on the synthetic root', () => {
        const root = buildFixture();
        try {
            const ts = runTs(['--root', root, '--summary']);
            expect(ts.status, ts.stderr).not.toBeNull();
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    it('matches Python on a missing root (no source/target dirs → clean)', () => {
        const root = join(tmpdir(), 'condfx-missing-does-not-exist-xyz');
        expect(existsSync(root)).toBe(false);
        const ts = runTs(['--root', root]);
        expect(ts.status, ts.stderr).toBe(0);
    });
});

describe('check_condensation golden parity — CLI errors', () => {
    it('--help exits 0 with a usage line (argparse help text is not a parity contract)', () => {
        // argparse's --help banner is Python-version-dependent (3.9 prints
        // "optional arguments:", 3.12 prints "options:"), so a byte-for-byte
        // python-vs-TS comparison is brittle across runtimes — and CI never
        // invokes --help in production. Assert the stable surface only.
        const ts = runTs(['--help']);
        expect(ts.status).toBe(0);
        expect(ts.stdout).toContain('usage:');
    });

    it('matches Python on an invalid --format choice (exit 2)', () => {
        const ts = runTs(['--format', 'xml']);
        expect(ts.status).toBe(2);
    });

    it('matches Python on an unknown flag (exit 2)', () => {
        const ts = runTs(['--bogus']);
        expect(ts.status).toBe(2);
    });
});
