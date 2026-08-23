/**
 * `smoke-trace.sh index` — the tracked, reviewer-reachable trace index.
 *
 * Why it exists: the adapter `# Lifecycle: stable` headers rest on smoke
 * traces under `agents/reference/ai-video/smoke-traces/`, which
 * `git ls-files` reports as 0 — the evidence was captured and then
 * deliberately withheld (commit `d7f5d5d3c`, 2026-06-10). A reviewer with a
 * clone could not check the claim at all. The index is the five-field
 * projection that makes the claim checkable WITHOUT publishing a single
 * request body, response body, or signed URL.
 *
 * The allowlist is the security property, so it is asserted directly rather
 * than inferred from a spot check: a sixth key appearing in a row is the
 * failure this file exists to catch.
 */
import { spawnSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SMOKE = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'smoke-trace.sh');

const ALLOWLIST = ['captured_at', 'model', 'provider', 'sha256', 'trace_id'];

/**
 * A trace directory shaped exactly like the real one: a `dry-run` trace with
 * no model segment, a `live` trace whose model slug carries the `/`→`_`
 * substitution, an `artifacts/` subdirectory that must NOT be indexed, and a
 * non-JSON file that must not be indexed either.
 *
 * The bodies carry a fake bearer token and a signed URL on purpose. If the
 * index ever grows a sixth field that copies trace content through, this
 * fixture is what makes the leak visible instead of theoretical.
 */
function fixtureTraces(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-index-'));
    fs.mkdirSync(path.join(dir, 'artifacts'));
    fs.writeFileSync(path.join(dir, 'artifacts', 'fal-x.mp4'), 'binary');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'not a trace');
    fs.writeFileSync(
        path.join(dir, 'fal-dry-run-2026-06-10T07-15-44Z.json'),
        JSON.stringify({
            provider: 'fal',
            captured_utc: '2026-06-10T07-15-44Z',
            mode: 'dry-run',
            phases: [{ name: 'submit', stdout: 'Authorization: Bearer sk-secret-DO-NOT-LEAK' }],
        }),
    );
    fs.writeFileSync(
        path.join(dir, 'fal-fal-ai_ltx-2_text-to-video-live-2026-06-10T12-36-49Z.json'),
        JSON.stringify({
            provider: 'fal',
            captured_utc: '2026-06-10T12-36-49Z',
            mode: 'live',
            phases: [{ name: 'fetch', stdout: 'https://cdn.example/x?sig=SIGNED-URL-DO-NOT-LEAK' }],
        }),
    );
    return dir;
}

function runIndex(tracesDir: string, outFile: string) {
    return spawnSync('bash', [SMOKE, 'index', '--traces', tracesDir, '--out', outFile], {
        encoding: 'utf8',
    });
}

describe('smoke-trace.sh index', () => {
    it('emits one five-field row per trace, sorted, with no sixth key', () => {
        const traces = fixtureTraces();
        const out = path.join(traces, 'trace-index.json');
        const res = runIndex(traces, out);
        expect(res.status, res.stderr).toBe(0);

        const rows = JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, unknown>[];
        expect(rows).toHaveLength(2);
        const [first, second] = rows as [Record<string, unknown>, Record<string, unknown>];

        // The allowlist IS the security property — assert it over every row.
        for (const row of rows) {
            expect(Object.keys(row).sort()).toEqual(ALLOWLIST);
        }

        expect(rows.map((r) => r.trace_id)).toEqual([
            'fal-dry-run-2026-06-10T07-15-44Z',
            'fal-fal-ai_ltx-2_text-to-video-live-2026-06-10T12-36-49Z',
        ]);
        expect(first.model).toBeNull();
        expect(second.model).toBe('fal-ai_ltx-2_text-to-video');
        expect(first.provider).toBe('fal');
        expect(first.captured_at).toBe('2026-06-10T07-15-44Z');
    });

    it('carries a real SHA-256 of the raw trace file, not a placeholder', () => {
        const traces = fixtureTraces();
        const out = path.join(traces, 'trace-index.json');
        expect(runIndex(traces, out).status).toBe(0);
        const rows = JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, string>[];
        const raw = fs.readFileSync(
            path.join(traces, 'fal-dry-run-2026-06-10T07-15-44Z.json'),
        );
        const [first] = rows as [Record<string, string>];
        expect(first.sha256).toBe(crypto.createHash('sha256').update(raw).digest('hex'));
    });

    it('never copies trace content into the index', () => {
        const traces = fixtureTraces();
        const out = path.join(traces, 'trace-index.json');
        expect(runIndex(traces, out).status).toBe(0);
        const text = fs.readFileSync(out, 'utf8');
        expect(text).not.toContain('DO-NOT-LEAK');
        expect(text).not.toContain('Bearer');
        expect(text).not.toContain('https://');
    });

    it('refuses an absent trace directory instead of writing an empty index', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trace-index-none-'));
        const out = path.join(dir, 'trace-index.json');
        const res = runIndex(path.join(dir, 'nope'), out);
        expect(res.status).not.toBe(0);
        expect(res.stderr).toMatch(/nope/);
        expect(fs.existsSync(out)).toBe(false);
    });

    it('is deterministic — a second run over the same input is byte-identical', () => {
        const traces = fixtureTraces();
        const a = path.join(traces, 'a.json');
        const b = path.join(traces, 'b.json');
        expect(runIndex(traces, a).status).toBe(0);
        expect(runIndex(traces, b).status).toBe(0);
        expect(fs.readFileSync(a, 'utf8')).toBe(fs.readFileSync(b, 'utf8'));
    });
});
