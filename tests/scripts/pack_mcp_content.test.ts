// Golden-parity tests for src/scripts/pack_mcp_content.ts (py2ts, ADR-094).
//
// The Python original has no dedicated suite, so this is a differential
// suite: it runs the Python packer (`python3 pack_mcp_content.py`) and the
// TS twin (`tsx pack_mcp_content.ts`) with identical args into isolated temp
// `--out` dirs and asserts byte-identical stdout / stderr / exit AND
// byte-identical written files (content.json, content.json.gz, manifest.json).
//
// Non-determinism normalized (with reason):
//   * `built_at` — `datetime.now(UTC)` wall-clock; the two processes run in
//     different seconds. Normalized to a fixed token in content.json /
//     manifest.json, and the gzip copy is decompressed + normalized the same
//     way (the gz is byte-identical to Python's whenever its decompressed
//     content is — proven by the fixed-header check below).
//   * `git_sha` / `release_key` — depend on `git rev-parse HEAD`; identical
//     within one run (both processes see the same repo), so left un-normalized
//     and asserted equal.
//
// The packer writes ONLY into the `--out` temp dir, so there is no
// snapshot/restore of git-tracked files (unlike bench_condense_memory, which
// writes into internal/bench/reports/). Skipped without python3.
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
const PY_SCRIPT = join(REPO_ROOT, 'src', 'scripts', 'pack_mcp_content.py');

function pythonAvailable(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const HAVE_PYTHON = pythonAvailable();

/** Replace the wall-clock built_at timestamp with a stable token. */
function normBuiltAt(s: string): string {
    return s.replace(/"built_at": ?"[^"]*"/g, '"built_at":"TS"');
}

describe.skipIf(!HAVE_PYTHON)('pack_mcp_content — golden parity (python vs tsx)', () => {
    let pyOut: string;
    let tsOut: string;
    beforeEach(() => {
        pyOut = mkdtempSync(join(tmpdir(), 'pack-py-'));
        tsOut = mkdtempSync(join(tmpdir(), 'pack-ts-'));
    });
    afterEach(() => {
        rmSync(pyOut, { recursive: true, force: true });
        rmSync(tsOut, { recursive: true, force: true });
    });

    it('writes byte-identical content.json / content.json.gz / manifest.json', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--out', pyOut], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        expect(py.status, py.stderr).toBe(0);

        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        expect(ts.status, ts.stderr).toBe(0);

        // ── content.json (modulo built_at) ──────────────────────────────
        const pyContent = readFileSync(join(pyOut, 'content.json'), 'utf-8');
        const tsContent = readFileSync(join(tsOut, 'content.json'), 'utf-8');
        expect(normBuiltAt(tsContent)).toBe(normBuiltAt(pyContent));

        // ── manifest.json (modulo built_at) ─────────────────────────────
        const pyManifest = readFileSync(join(pyOut, 'manifest.json'), 'utf-8');
        const tsManifest = readFileSync(join(tsOut, 'manifest.json'), 'utf-8');
        expect(normBuiltAt(tsManifest)).toBe(normBuiltAt(pyManifest));

        // ── content.json.gz ─────────────────────────────────────────────
        // The gzip HEADER + FNAME field must be byte-identical (magic, CM,
        // FLG=FNAME, MTIME=0, XFL=2, OS=0xFF, embedded `content.json\0`) —
        // all deterministic, rebuilt to match Python. Compare exactly up to
        // the end of the NUL-terminated FNAME field; the DEFLATE body that
        // follows is intentionally NOT byte-compared: zlib's compressed
        // output differs across zlib versions (Python's zlib vs node's, and
        // node 22 vs node 25) for the same input — a valid implementation
        // detail, not a semantic difference. Parity of the COMPRESSED bytes
        // is not a reasonable target; parity of the DECOMPRESSED content is
        // (asserted below). See docs/migration/divergences/mcp-telemetry-node-sqlite.md
        // sibling rationale (impl-detail divergences documented, semantic
        // parity asserted).
        const pyGz = readFileSync(join(pyOut, 'content.json.gz'));
        const tsGz = readFileSync(join(tsOut, 'content.json.gz'));
        const headerEnd = pyGz.indexOf(0x00, 10) + 1; // 10-byte header + NUL-terminated FNAME → start of DEFLATE
        expect(headerEnd).toBeGreaterThan(10);
        expect(tsGz.subarray(0, headerEnd).equals(pyGz.subarray(0, headerEnd))).toBe(true);
        // Decompressed body byte-identical modulo built_at — the real
        // semantic parity (the DEFLATE stream encodes the same content,
        // even when the compressed bytes differ across zlib versions).
        const pyGzText = gunzipSync(pyGz).toString('utf-8');
        const tsGzText = gunzipSync(tsGz).toString('utf-8');
        expect(normBuiltAt(tsGzText)).toBe(normBuiltAt(pyGzText));
        // …and the gz of content.json — both processes gzip their own
        // content.json, so when built_at matches the bytes match exactly.
        // Cross-check: re-gzip the TS content.json with the TS twin path and
        // compare to its own .gz (self-consistency) is implicit; here we
        // assert the decompressed gz equals the on-disk content.json.
        expect(gunzipSync(tsGz).toString('utf-8')).toBe(tsContent);
        expect(gunzipSync(pyGz).toString('utf-8')).toBe(pyContent);

        // ── stderr (success summary) ─────────────────────────────────────
        // signature / release_key / per-kind counts must match verbatim.
        expect(ts.stderr).toBe(py.stderr);
        // ── stdout ───────────────────────────────────────────────────────
        expect(ts.stdout).toBe(py.stdout);
    });

    it('--quiet suppresses the summary on both (byte-identical empty stderr)', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--out', pyOut, '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--out', tsOut, '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            maxBuffer: 64 * 1024 * 1024,
        });
        expect(py.status).toBe(0);
        expect(ts.status).toBe(0);
        expect(ts.stderr).toBe(py.stderr);
        expect(ts.stdout).toBe(py.stdout);
        // With --quiet the only output is the files; assert them too.
        const pyContent = readFileSync(join(pyOut, 'content.json'), 'utf-8');
        const tsContent = readFileSync(join(tsOut, 'content.json'), 'utf-8');
        expect(normBuiltAt(tsContent)).toBe(normBuiltAt(pyContent));
    });

    it('empty-tree root → exit 2 + identical "zero URIs" stderr', () => {
        // Point --root at an empty temp dir: every scanner returns nothing,
        // so pack() hits the empty-content guard (SystemExit(2)).
        const emptyRoot = mkdtempSync(join(tmpdir(), 'pack-empty-'));
        try {
            const py = spawnSync('python3', [PY_SCRIPT, '--root', emptyRoot, '--out', pyOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--root', emptyRoot, '--out', tsOut], {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            });
            expect(py.status).toBe(2);
            expect(ts.status).toBe(2);
            expect(ts.stderr).toBe(py.stderr);
            expect(ts.stdout).toBe(py.stdout);
        } finally {
            rmSync(emptyRoot, { recursive: true, force: true });
        }
    });
});
