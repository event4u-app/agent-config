// Pure-TS coverage for what became of the `explain.enable_last: false`
// short-circuit of `agent-config explain last` (ADR-200 py2ts). The key was
// retired with its default (on) as the fixed behavior, so the inverted
// invariant is pinned here: a leftover `false` no longer suppresses the trace.
//
// Drives the exported `main(argv)` directly and captures `process.stdout`
// (the command's `print` helper writes there) — no python, no subprocess.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../../src/scripts/_cli/cmd_explain.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

let tmp: string;

// Minimal seeded project root (router + preset + profile) — same shape the
// explain_last conftest builds, so the resolvers don't fall over.
const ROUTER = JSON.stringify({
    schema_version: 1,
    kernel: ['direct-answers', 'no-cheap-questions'],
    tier_1: [{ id: 'architecture', triggers: [{ keyword: 'controller' }] }],
    tier_2: [],
});

function seedProject(root: string): void {
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'router.json'), ROUTER, 'utf-8');
    const presets = path.join(root, '.agent-src.uncondensed', 'presets');
    fs.mkdirSync(presets, { recursive: true });
    fs.writeFileSync(
        path.join(presets, 'balanced.yml'),
        'preset:\n  id: balanced\n  cost: {daily_max_usd: 10, weekly_max_usd: 50, monthly_max_usd: 150}\n  autonomy: {default: auto}\n',
        'utf-8',
    );
    const profiles = path.join(root, '.agent-src.uncondensed', 'profiles');
    fs.mkdirSync(profiles, { recursive: true });
    fs.writeFileSync(
        path.join(profiles, 'developer.yml'),
        'profile:\n  id: developer\n  preset: balanced\n',
        'utf-8',
    );
}

/** Copy a canonical `.work-state.json` fixture into the project root by name. */
function copyState(root: string, name: string): void {
    const src = path.resolve(HERE, '..', '..', 'fixtures', 'explain_last', name);
    fs.copyFileSync(src, path.join(root, '.work-state.json'));
}

let stdoutSpy: { mockRestore: () => void };
let captured: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'explain-disabled-'));
    seedProject(tmp);
    captured = '';
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        captured += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
        return true;
    });
});

afterEach(() => {
    stdoutSpy.mockRestore();
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('cmd_explain — a leftover explain.enable_last: false is ignored', () => {
    it('renders the trace anyway — the switch was retired with its default (on)', () => {
        copyState(tmp, 'work-state.success.json');
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'explain:\n  enable_last: false\n',
            'utf-8',
        );

        const rc = main(['last', '--project', tmp]);
        expect(rc).toBe(0);
        expect(captured).not.toContain('disabled by settings');
        expect(captured).toContain('# explain last — run run-success-001');
    });
});
