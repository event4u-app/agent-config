// Tests for src/scripts/check_memory_contradiction.ts (road-to-second-brain
// Phase 2). Fixtures per the roadmap step: one same-key contradictory pair
// (fires), one same-key rewording (must NOT fire at >= 0.3), one
// different-key pair (must not fire), plus the durable-type scoping no-op.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_memory_contradiction.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

let memoryRoot = '';

const EXISTING_RULE =
    'Tenant exports must always be scoped by tenant_id at the query layer; ' +
    'row-level security alone is not sufficient for CSV export paths.';

beforeEach(() => {
    memoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-contradiction-'));
    const dir = path.join(memoryRoot, 'product-rules');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, 'abc123def456.yml'),
        ['id: tenant-export-scoping', 'status: active', `rule: ${JSON.stringify(EXISTING_RULE)}`].join(
            '\n',
        ) + '\n',
        'utf-8',
    );
});

afterEach(() => {
    fs.rmSync(memoryRoot, { recursive: true, force: true });
});

function run(args: string[]): { stdout: string; status: number | null } {
    const proc = spawnSync(TSX_BIN, [TS_SCRIPT, '--memory-root', memoryRoot, ...args], {
        encoding: 'utf8',
        cwd: REPO_ROOT,
    });
    return { stdout: proc.stdout as string, status: proc.status };
}

describe('check_memory_contradiction', () => {
    it('fires on a same-key contradictory claim (exit 1, pair surfaced)', () => {
        const { stdout, status } = run([
            '--type',
            'product-rules',
            '--key',
            'tenant-export-scoping',
            '--body',
            'Do not add extra filters when exporting; the database view handles everything and no additional checks are needed.',
        ]);
        expect(status).toBe(1);
        expect(stdout).toContain('potential contradiction');
        expect(stdout).toContain("key 'tenant-export-scoping'");
        expect(stdout).toContain('contested');
        expect(stdout).toContain('NEVER auto-resolve');
    });

    it('does NOT fire on a same-key rewording (similarity >= 0.3)', () => {
        const { stdout, status } = run([
            '--type',
            'product-rules',
            '--key',
            'tenant-export-scoping',
            '--body',
            'Tenant exports must be scoped by tenant_id at the query layer; row-level security alone is not sufficient for export paths.',
        ]);
        expect(status).toBe(0);
        expect(stdout).not.toContain('potential contradiction');
    });

    it('does NOT fire on a different key', () => {
        const { status } = run([
            '--type',
            'product-rules',
            '--key',
            'webhook-retry-policy',
            '--body',
            'Do not add extra filters when exporting; the view handles everything.',
        ]);
        expect(status).toBe(0);
    });

    it('is a silent no-op for non-durable types', () => {
        const { stdout, status } = run([
            '--type',
            'recurring-patterns',
            '--key',
            'tenant-export-scoping',
            '--body',
            'Completely different claim about the same key.',
            '--format',
            'json',
        ]);
        expect(status).toBe(0);
        expect(JSON.parse(stdout)).toEqual({ checked: false, reason: 'type-not-durable' });
    });

    it('reads legacy single-file layout too', () => {
        fs.writeFileSync(
            path.join(memoryRoot, 'domain-invariants.yml'),
            [
                'entries:',
                '  - id: invoice-immutability',
                '    rule: Posted invoices are immutable; corrections go through credit notes only.',
            ].join('\n') + '\n',
            'utf-8',
        );
        const { status, stdout } = run([
            '--type',
            'domain-invariants',
            '--key',
            'invoice-immutability',
            '--body',
            'Feel free to edit posted invoices directly when the amount is small.',
        ]);
        expect(status).toBe(1);
        expect(stdout).toContain('invoice-immutability');
    });
});
