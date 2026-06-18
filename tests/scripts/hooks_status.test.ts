// Tests for src/scripts/hooks_status.ts (py2ts — hooks runtime matrix).
//
// 1:1 port of tests/hooks/test_hooks_status.py. Pure-TS: import the twin's
// exported surface (collect / main / PLATFORM_BRIDGES) plus the real
// manifest via dispatch_hook._load_yaml, drive against tmp project dirs,
// and assert the matrix shape, per-platform bridge detection, the Copilot
// degraded marker, the Cowork n/a row, --strict exit codes, the table
// rendering, and JSON parseability.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { _load_yaml, type JsonObject } from '../../src/scripts/hooks/dispatch_hook.js';
import {
    PLATFORM_BRIDGES,
    collect,
    main,
    type PlatformRow,
    type StatusMatrix,
} from '../../src/scripts/hooks_status.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');

function manifest(): JsonObject {
    return _load_yaml(MANIFEST_PATH) as JsonObject;
}

function byPlatform(matrix: StatusMatrix): Record<string, PlatformRow> {
    const out: Record<string, PlatformRow> = {};
    for (const row of matrix.platforms) {
        out[row.platform] = row;
    }
    return out;
}

// Capture stdout writes (main() prints the table / JSON to stdout, like
// the python capsys fixture).
function captureStdout(fn: () => number): { rc: number; out: string } {
    let buf = '';
    const spy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation((chunk: string | Uint8Array): boolean => {
            buf += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
            return true;
        });
    try {
        const rc = fn();
        return { rc, out: buf };
    } finally {
        spy.mockRestore();
    }
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hooks-status-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

// --- collect() walks every platform -----------------------------------

describe('hooks_status — collect', () => {
    it('returns every platform in PLATFORM_BRIDGES', () => {
        const matrix = collect(tmp, manifest());
        expect(matrix.schema_version).toBe(1);
        const platforms = new Set(matrix.platforms.map((r) => r.platform));
        expect(platforms).toEqual(new Set(Object.keys(PLATFORM_BRIDGES)));
    });

    it('reports missing bridges on a fresh project, degraded copilot, n/a cowork', () => {
        const matrix = collect(tmp, manifest());
        const rows = byPlatform(matrix);

        // All non-Copilot, non-Cowork platforms have a real bridge_path and
        // should report 'missing' in a fresh tmp dir.
        for (const platform of ['augment', 'claude', 'cursor', 'cline', 'windsurf', 'gemini']) {
            const row = rows[platform]!;
            expect(row.status, platform).toBe('missing');
            expect(
                Object.keys(row.bindings).length,
                `${platform} has no manifest bindings`,
            ).toBeGreaterThan(0);
        }

        // Copilot is always degraded.
        expect(rows['copilot']!.status).toBe('degraded');
        expect(rows['copilot']!.fallback_only).toBe(true);

        // Cowork has manifest bindings but no project-scope bridge path
        // (upstream-blocked). Empty bridge path → status="n/a"; strict mode
        // never fails on n/a (matches Copilot's no-bridge posture).
        const cowork = rows['cowork']!;
        expect(cowork.status).toBe('n/a');
        expect(cowork.bridge_path).toBeNull();
        expect(Object.keys(cowork.bindings).length, 'cowork must declare manifest bindings').toBeGreaterThan(0);
        expect(cowork.fallback_only).toBe(false);
        expect(cowork.hint ?? '').toContain('upstream-blocked');
    });

    it('detects an installed claude bridge (file present)', () => {
        fs.mkdirSync(path.join(tmp, '.claude'));
        fs.writeFileSync(path.join(tmp, '.claude', 'settings.json'), '{}', 'utf8');
        const matrix = collect(tmp, manifest());
        const claude = matrix.platforms.find((r) => r.platform === 'claude')!;
        expect(claude.status).toBe('installed');
        expect(claude.hint).toBeNull();
    });

    it('detects a non-empty cline directory bridge as installed', () => {
        const clineDir = path.join(tmp, '.clinerules', 'hooks');
        fs.mkdirSync(clineDir, { recursive: true });
        fs.writeFileSync(path.join(clineDir, 'TaskStart'), '#!/bin/sh\n', 'utf8');
        const matrix = collect(tmp, manifest());
        const cline = matrix.platforms.find((r) => r.platform === 'cline')!;
        expect(cline.status).toBe('installed');
    });

    it('marks an empty cline directory as empty', () => {
        fs.mkdirSync(path.join(tmp, '.clinerules', 'hooks'), { recursive: true });
        const matrix = collect(tmp, manifest());
        const cline = matrix.platforms.find((r) => r.platform === 'cline')!;
        expect(cline.status).toBe('empty');
    });
});

// --- main() strict mode + output -------------------------------------

describe('hooks_status — main strict mode', () => {
    it('strict mode returns 1 on a missing bridge', () => {
        const { rc, out } = captureStdout(() =>
            main([
                '--project-root',
                tmp,
                '--manifest',
                MANIFEST_PATH,
                '--strict',
                '--format',
                'json',
            ]),
        );
        expect(rc).toBe(1);
        const payload = JSON.parse(out);
        expect(payload.schema_version).toBe(1);
    });

    it('strict mode returns 0 when all bridges are installed', () => {
        const bridges: Record<string, string> = {
            '.augment/settings.json': '{}',
            '.claude/settings.json': '{}',
            '.cursor/hooks.json': '{}',
            '.windsurf/hooks.json': '{}',
            '.gemini/settings.json': '{}',
        };
        for (const [rel, body] of Object.entries(bridges)) {
            const target = path.join(tmp, rel);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, body, 'utf8');
        }
        const clineDir = path.join(tmp, '.clinerules', 'hooks');
        fs.mkdirSync(clineDir, { recursive: true });
        fs.writeFileSync(path.join(clineDir, 'TaskStart'), '#!/bin/sh\n', 'utf8');

        const { rc } = captureStdout(() =>
            main([
                '--project-root',
                tmp,
                '--manifest',
                MANIFEST_PATH,
                '--strict',
                '--format',
                'json',
            ]),
        );
        // Copilot is exempt (fallback_only never trips strict); Cowork is n/a.
        expect(rc).toBe(0);
    });
});

describe('hooks_status — main rendering', () => {
    it('table renders the copilot degraded marker', () => {
        const { rc, out } = captureStdout(() =>
            main(['--project-root', tmp, '--manifest', MANIFEST_PATH]),
        );
        expect(rc).toBe(0);
        expect(out).toContain('copilot');
        expect(out).toContain('degraded');
        expect(out).toContain('rule-only fallback');
    });

    it('json format is parseable with the expected shape', () => {
        const { rc, out } = captureStdout(() =>
            main(['--project-root', tmp, '--manifest', MANIFEST_PATH, '--format', 'json']),
        );
        expect(rc).toBe(0);
        const payload = JSON.parse(out);
        expect('platforms' in payload).toBe(true);
        const first = payload.platforms[0];
        for (const key of ['platform', 'status', 'bindings']) {
            expect(key in first, key).toBe(true);
        }
    });
});

// --- guard against the python-shadowed run path -----------------------
// hooks_status is pure (fs + manifest read only), so a stubbed python3
// changes nothing — but assert the import surface is intact regardless.
describe('hooks_status — no python dependency', () => {
    it('collect works without a python3 binary on PATH', () => {
        const hasPython = spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
        // Whether or not python3 exists, collect() must not invoke it.
        const matrix = collect(tmp, manifest());
        expect(matrix.platforms.length).toBe(Object.keys(PLATFORM_BRIDGES).length);
        void hasPython;
    });
});
