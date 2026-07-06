// Golden-parity tests for src/scripts/pack_mcp_content.ts (py2ts, ADR-094).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). CLI contract: the packer writes content.json / content.json.gz /
// manifest.json into an isolated --out temp dir; we assert exit codes, valid
// JSON, and that the gz decompresses to the written content.json. The packer
// writes ONLY into the --out temp dir, so there is no git-tracked drift.
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
const TS_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'pack_mcp_content.ts');



describe('pack_mcp_content — CLI contract', () => {
    let tsOut: string;
    beforeEach(() => {
        tsOut = mkdtempSync(join(tmpdir(), 'pack-ts-'));
    });
    afterEach(() => {
        rmSync(tsOut, { recursive: true, force: true });
    });

    it('writes content.json / content.json.gz / manifest.json (valid, gz round-trips)', () => {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        expect(ts.status, ts.stderr).toBe(0);

        const tsContent = readFileSync(join(tsOut, 'content.json'), 'utf-8');
        expect(() => JSON.parse(tsContent)).not.toThrow();
        const tsManifest = readFileSync(join(tsOut, 'manifest.json'), 'utf-8');
        expect(() => JSON.parse(tsManifest)).not.toThrow();

        // The gz decompresses byte-for-byte to the on-disk content.json.
        const tsGz = readFileSync(join(tsOut, 'content.json.gz'));
        expect(gunzipSync(tsGz).toString('utf-8')).toBe(tsContent);
    });

    it('--quiet suppresses the summary (empty stderr), still writes content', () => {
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut, '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        expect(ts.status).toBe(0);
        expect(ts.stderr).toBe('');
        expect(() => JSON.parse(readFileSync(join(tsOut, 'content.json'), 'utf-8'))).not.toThrow();
    });

    it('empty-tree root → exit 2 + identical "zero URIs" stderr', () => {
        // Point --root at an empty temp dir: every scanner returns nothing,
        // so pack() hits the empty-content guard (SystemExit(2)).
        const emptyRoot = mkdtempSync(join(tmpdir(), 'pack-empty-'));
        try {
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--root', emptyRoot, '--out', tsOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            expect(ts.status).toBe(2);
        } finally {
            rmSync(emptyRoot, { recursive: true, force: true });
        }
    });
});
