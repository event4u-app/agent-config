
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../../../src/scripts/wrapper_freshness_hook.js';
import { install_cli_wrapper } from '../../../src/scripts/_lib/cli_wrapper.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'wrapper_freshness_hook.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const STALE = '#!/usr/bin/env bash\n# old fallback-less wrapper\nexit 127\n';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wrapper-fresh-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('wrapper_freshness — self-heal', () => {
    it('refreshes a stale wrapper', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "some-app"}');
        const wrapper = path.join(tmp, 'agent-config');
        fs.writeFileSync(wrapper, STALE);
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        const body = fs.readFileSync(wrapper, 'utf8');
        expect(body).toContain('globally-installed');
        expect(body).not.toContain('old fallback-less wrapper');
    });

    it('does not create a wrapper', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "some-app"}');
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.existsSync(path.join(tmp, 'agent-config'))).toBe(false);
    });

    it('no-op in source repo', () => {
        fs.mkdirSync(path.join(tmp, 'dist', 'agent-src'), { recursive: true });
        const wrapper = path.join(tmp, 'agent-config');
        fs.writeFileSync(wrapper, STALE);
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.readFileSync(wrapper, 'utf8')).toBe(STALE);
    });

    it('no-op when already fresh', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "some-app"}');
        install_cli_wrapper(tmp); // identical to template
        const before = fs.readFileSync(path.join(tmp, 'agent-config'), 'utf8');
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.readFileSync(path.join(tmp, 'agent-config'), 'utf8')).toBe(before);
    });

    it('source-repo guard fires on package.json name', () => {
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "@event4u/agent-config"}');
        const wrapper = path.join(tmp, 'agent-config');
        fs.writeFileSync(wrapper, STALE);
        expect(main(['--root', tmp, '--platform', 'claude'])).toBe(0);
        expect(fs.readFileSync(wrapper, 'utf8')).toBe(STALE);
    });
});

interface RunResult {
    status: number | null;
    stdout: string;
    wrapper: string | null;
}
