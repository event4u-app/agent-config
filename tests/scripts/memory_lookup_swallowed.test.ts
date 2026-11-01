// Input memory_lookup cannot read is counted, never silently dropped: a torn
// intake append or an unreadable chunk shows up as an additive envelope counter,
// and a half-written ingest (`<id>.partial/`) is never retrievable.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'memory_lookup.ts');
const TODAY = new Date().toISOString().slice(0, 10);

let tmp: string;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ml-swallowed-'));
    mkdirSync(join(tmp, 'agents', 'memory', 'intake'), { recursive: true });
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

function lookup(args: string[]): Record<string, unknown> {
    const r = spawnSync(TSX_BIN, [SCRIPT, ...args, '--format', 'json'], { cwd: tmp, encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(r.stdout) as Record<string, unknown>;
}

function signal(id: string): string {
    return JSON.stringify({ id, entry_type: 'ownership', path: 'app/Billing', body: 'x', ts: `${TODAY}T00:00:00Z` });
}

function ingest(dir: string, chunks: Record<string, string>): void {
    const base = join(tmp, 'agents', 'memory', 'knowledge', dir);
    mkdirSync(join(base, 'chunks'), { recursive: true });
    writeFileSync(join(base, 'manifest.json'), JSON.stringify({ ingest_id: dir.replace(/\.partial$/, ''), source: 'docs' }));
    for (const [name, body] of Object.entries(chunks)) {
        writeFileSync(join(base, 'chunks', name), body);
    }
}

describe('memory_lookup — swallowed input is counted', () => {
    it('clean input: no counters, envelope unchanged', () => {
        writeFileSync(join(tmp, 'agents', 'memory', 'intake', 'a.jsonl'), `${signal('s1')}\n`);
        const out = lookup(['--types', 'ownership', '--key', 'app/Billing']);
        expect(out).not.toHaveProperty('skipped_malformed');
        expect(out).not.toHaveProperty('skipped_unreadable');
    });

    it('a torn last line and a non-object line are counted once each, across types', () => {
        writeFileSync(
            join(tmp, 'agents', 'memory', 'intake', 'a.jsonl'),
            `${signal('s1')}\n42\n{"id":"s2","entry_ty`,
        );
        const out = lookup(['--types', 'ownership,domain-invariants', '--key', 'app/Billing']);
        expect(out['skipped_malformed']).toBe(2);
        expect(JSON.stringify(out['hits'])).toContain('s1');
    });

    it('an unreadable chunk is counted', () => {
        ingest('ing-1', { '0001.md': 'billing notes', '0002.md': 'more billing' });
        chmodSync(join(tmp, 'agents', 'memory', 'knowledge', 'ing-1', 'chunks', '0002.md'), 0o000);
        const out = lookup(['--types', 'knowledge', '--key', 'billing']);
        expect(out['skipped_unreadable']).toBe(1);
    });

    it('a half-written ingest is never retrievable', () => {
        ingest('ing-2.partial', { '0001.md': 'partialsecretword' });
        const out = lookup(['--types', 'knowledge', '--key', 'partialsecretword']);
        expect(JSON.stringify(out)).not.toContain('partialsecretword');
    });
});
