// Tests for src/scripts/check_memory.ts — the engineering-memory validator.
//
// 1:1 port of tests/test_check_memory.py (pytest → vitest, ADR-088 parity
// contract). Each case spawns the TS script via tsx as a real child process
// and asserts on the observable contract (stdout / exit code). A trailing
// golden-parity block runs python3 + tsx on identical fixtures and asserts
// byte-identical stdout+stderr+exit, skipped when python3 is absent.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'check_memory.ts');

interface RunResult {
    readonly status: number;
    readonly stdout: string;
    readonly stderr: string;
}

function runTs(args: readonly string[], cwd: string = REPO_ROOT): RunResult {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd, encoding: 'utf8' });
    return { status: r.status ?? -1, stdout: r.stdout, stderr: r.stderr };
}

// dedent helper mirroring textwrap.dedent on the leading common indent.
function dedent(s: string): string {
    const lines = s.replace(/^\n/, '').split('\n');
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)?.[0].length ?? 0);
    const min = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(min)).join('\n');
}

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'check-memory-'));
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

/** Mirror the Python _write helper: memory/<type>/entry.yml. */
function write(name: string, body: string): string {
    const root = join(tmp, 'memory', name.replace('.example.yml', ''));
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'entry.yml'), dedent(body), 'utf-8');
    return join(tmp, 'memory');
}

function runMem(path: string, fmt = 'text'): RunResult {
    return runTs(['--path', path, '--format', fmt]);
}

describe('check_memory.ts', () => {
    it('example templates are valid', () => {
        // The Python test points at .agent-src.uncondensed/templates/agents/memory
        // (legacy layout). Use the resolved example dir in this repo's src tree.
        const dir = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'agents', 'memory');
        const result = runMem(dir);
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });

    it('missing required field fails', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: bad
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
        `,
        );
        const result = runMem(root);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('missing required field: last_validated');
        expect(result.stdout).toContain('missing required field: review_after_days');
    });

    it('invalid enum fails', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: bad
            status: wrong
            confidence: super
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        `,
        );
        const result = runMem(root);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("invalid status 'wrong'");
        expect(result.stdout).toContain("invalid confidence 'super'");
    });

    it('duplicate id fails', () => {
        const root = join(tmp, 'memory', 'domain-invariants');
        mkdirSync(root, { recursive: true });
        writeFileSync(
            join(root, 'a.yml'),
            dedent(`
        version: 1
        entries:
          - id: dup
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
          - id: dup
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
    `),
            'utf-8',
        );
        const result = runMem(join(tmp, 'memory'));
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("duplicate id 'dup'");
    });

    it('credential redaction fails', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: ok
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
            rule: "api_key=sk-1234567890abcdef"
        `,
        );
        const result = runMem(root);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('inline credential');
    });

    it('stale entry is info not error', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: stale
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2020-01-01
            review_after_days: 90
        `,
        );
        const result = runMem(root);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain('stale:');
    });

    it('missing path is not error', () => {
        const result = runMem(join(tmp, 'does-not-exist'));
        expect(result.status).toBe(0);
    });

    it('yaml parse error is reported', () => {
        const root = join(tmp, 'memory', 'domain-invariants');
        mkdirSync(root, { recursive: true });
        writeFileSync(join(root, 'broken.yml'), 'entries: [\nnot valid yaml: `bad\n', 'utf-8');
        const result = runMem(join(tmp, 'memory'));
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('YAML parse error');
    });

    it('relative date without anchor fails', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: drift
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
            rule: "We fixed this yesterday after the outage hit prod."
        `,
        );
        const result = runMem(root);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("relative date 'yesterday'");
        expect(result.stdout).toContain('ISO YYYY-MM-DD anchor');
    });

    it('relative date with iso anchor passes', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: anchored
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
            rule: "Fixed yesterday (2026-01-15) after the outage hit prod."
        `,
        );
        const result = runMem(root);
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });

    it('relative date in last_validated line skipped', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: ok
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        `,
        );
        const result = runMem(root);
        expect(result.status).toBe(0);
    });

    it('priority optional default passes', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: ok
            status: active
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        `,
        );
        const result = runMem(root);
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });

    it('priority valid enum passes', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: c
            status: active
            confidence: high
            priority: critical
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        `,
        );
        const result = runMem(root);
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });

    it('priority invalid enum fails', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: bad
            status: active
            confidence: high
            priority: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        `,
        );
        const result = runMem(root);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("invalid priority 'high'");
    });

    it('critical stale warns', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: stale-crit
            status: active
            confidence: high
            priority: critical
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2020-01-01
            review_after_days: 3650
        `,
        );
        const result = runMem(root);
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('critical-stale:');
    });

    it('tier zero inflation warns', () => {
        const root = join(tmp, 'memory', 'domain-invariants');
        mkdirSync(root, { recursive: true });
        const entries = Array.from({ length: 11 }, (_, i) =>
            [
                `  - id: crit-${i}`,
                '    status: active',
                '    confidence: high',
                '    priority: critical',
                '    source: ["https://example.com"]',
                '    owner: team-x',
                '    last_validated: 2026-01-01',
                '    review_after_days: 90',
            ].join('\n'),
        ).join('\n');
        writeFileSync(join(root, 'entries.yml'), `version: 1\nentries:\n${entries}\n`, 'utf-8');
        const result = runMem(join(tmp, 'memory'));
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toContain('tier-0 inflation:');
        expect(result.stdout).toContain('11 active');
    });

    it('json format output', () => {
        const root = write(
            'domain-invariants',
            `
        version: 1
        entries:
          - id: bad
            status: wrong
            confidence: high
            source: ["https://example.com"]
            owner: team-x
            last_validated: 2026-01-01
            review_after_days: 90
        `,
        );
        const result = runMem(root, 'json');
        expect(result.status).toBe(1);
        const payload = JSON.parse(result.stdout) as { findings: Array<{ message: string }> };
        expect(payload.findings.some((f) => f.message.includes('invalid status'))).toBe(true);
    });

    // --- append-only mode ----------------------------------------------------

    function gitInit(dir: string): void {
        spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
        spawnSync('git', ['config', 'user.email', 't@e.x'], { cwd: dir });
        spawnSync('git', ['config', 'user.name', 't'], { cwd: dir });
        spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir });
    }
    function gitCommitAll(dir: string, msg: string): void {
        spawnSync('git', ['add', '-A'], { cwd: dir });
        spawnSync('git', ['commit', '-q', '-m', msg], { cwd: dir });
    }
    function runAppendOnly(dir: string, base: string): RunResult {
        return runTs(['--append-only', '--base', base], dir);
    }

    it('append-only appending is clean', () => {
        gitInit(tmp);
        const intake = join(tmp, 'agents', 'memory', 'intake');
        mkdirSync(intake, { recursive: true });
        const jsonl = join(intake, 'learnings.jsonl');
        writeFileSync(jsonl, '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n');
        gitCommitAll(tmp, 'base');
        writeFileSync(jsonl, '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n');
        gitCommitAll(tmp, 'append');
        const result = runAppendOnly(tmp, 'HEAD~1');
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).not.toContain('append-only violation');
    });

    it('append-only in-place edit fails', () => {
        gitInit(tmp);
        const intake = join(tmp, 'agents', 'memory', 'intake');
        mkdirSync(intake, { recursive: true });
        const jsonl = join(intake, 'learnings.jsonl');
        writeFileSync(
            jsonl,
            '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n',
        );
        gitCommitAll(tmp, 'base');
        writeFileSync(
            jsonl,
            '{"id":"a","ts":"2026-01-01T00:00Z","type":"MODIFIED"}\n{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n',
        );
        gitCommitAll(tmp, 'mutate');
        const result = runAppendOnly(tmp, 'HEAD~1');
        expect(result.status, result.stdout + result.stderr).toBe(1);
        expect(result.stdout).toContain('append-only violation');
    });

    it('append-only deletion fails', () => {
        gitInit(tmp);
        const intake = join(tmp, 'agents', 'memory', 'intake');
        mkdirSync(intake, { recursive: true });
        const jsonl = join(intake, 'learnings.jsonl');
        writeFileSync(
            jsonl,
            '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n',
        );
        gitCommitAll(tmp, 'base');
        writeFileSync(jsonl, '{"id":"b","ts":"2026-01-02T00:00Z","type":"learning"}\n');
        gitCommitAll(tmp, 'shrink');
        const result = runAppendOnly(tmp, 'HEAD~1');
        expect(result.status).toBe(1);
        expect(result.stdout).toContain('append-only violation');
    });

    it('append-only new file is clean', () => {
        gitInit(tmp);
        writeFileSync(join(tmp, 'README.md'), 'init\n');
        gitCommitAll(tmp, 'init');
        const intake = join(tmp, 'agents', 'memory', 'intake');
        mkdirSync(intake, { recursive: true });
        writeFileSync(join(intake, 'learnings.jsonl'), '{"id":"a","ts":"2026-01-01T00:00Z","type":"learning"}\n');
        gitCommitAll(tmp, 'new-intake');
        const result = runAppendOnly(tmp, 'HEAD~1');
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).not.toContain('append-only violation');
    });
});
