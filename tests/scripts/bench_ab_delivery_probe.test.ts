// Step 2.1 — the delivery pre-flight, driven by a FAKE host binary.
//
// The fake emits a `system/init` event, then (if it is still alive 600 ms later)
// writes a marker file and a `result` event carrying a `usage` block — the
// stand-in for a model call. The probe must read init and kill the child before
// that, so the marker never appears. The fake also dumps its environment, which
// is how the no-key / unreachable-base-URL half is asserted.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
    UNREACHABLE_BASE_URL,
    delivery_verdict,
    parse_init_event,
    probe_env,
    run_delivery_probe,
} from '../../src/scripts/_lib/bench_ab_delivery_probe.js';
import { delivery_preflight } from '../../src/scripts/_lib/bench_ab_delivery_preflight.js';

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const PKG = new Set(['code-review', 'learning-to-rule-or-skill']);

/**
 * A fake `claude`: skills come from FAKE_SKILLS_<scope> where scope is "global"
 * when `--setting-sources` is absent and "scoped" when it is present — the same
 * switch the real arms use to keep or drop the package.
 */
function fakeHost(dir: string, skills: { global: string[]; scoped: string[] }): string {
    const bin = path.join(dir, 'fake-claude.cjs');
    fs.writeFileSync(
        bin,
        `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const dir = ${JSON.stringify(dir)};
fs.writeFileSync(path.join(dir, 'env.json'), JSON.stringify(process.env));
fs.writeFileSync(path.join(dir, 'argv.json'), JSON.stringify(process.argv.slice(2)));
const scoped = process.argv.includes('--setting-sources');
const skills = ${JSON.stringify(skills)}[scoped ? 'scoped' : 'global'];
process.stdout.write(JSON.stringify({ type: 'system', subtype: 'init', skills, plugins: [{ name: 'p', path: '/x' }], apiKeySource: 'none' }) + '\\n');
setTimeout(() => {
    fs.writeFileSync(path.join(dir, 'reached-model'), 'yes');
    process.stdout.write(JSON.stringify({ type: 'result', usage: { input_tokens: 100, output_tokens: 10 } }) + '\\n');
}, 600);
setTimeout(() => {}, 5000);
`,
    );
    fs.chmodSync(bin, 0o755);
    return bin;
}

function mkdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-test-'));
    tmp.push(d);
    return d;
}

describe('parse_init_event / delivery_verdict', () => {
    it('reads skills, plugins and apiKeySource from the init line', () => {
        const init = parse_init_event(
            'noise\n{"type":"system","subtype":"init","skills":["agent-config:code-review","x"],"plugins":[{"name":"p"}],"apiKeySource":"none"}\n',
        );
        expect(init).toEqual({ skills: ['agent-config:code-review', 'x'], plugins: ['p'], apiKeySource: 'none' });
    });

    it('package needs a package skill; a scoped arm must have none', () => {
        const with_pkg = { skills: ['code-review'], plugins: [], apiKeySource: 'none' };
        const without = { skills: ['other'], plugins: [], apiKeySource: 'none' };
        expect(delivery_verdict('package', null, with_pkg, PKG).ok).toBe(true);
        expect(delivery_verdict('package', null, without, PKG).ok).toBe(false);
        expect(delivery_verdict('vanilla', 'project,local', without, PKG).ok).toBe(true);
        expect(delivery_verdict('vanilla', 'project,local', with_pkg, PKG).ok).toBe(false);
        expect(delivery_verdict('vanilla', 'project,local', null, PKG).ok).toBe(false);
    });
});

describe('probe_env', () => {
    it('drops every credential and forces the base URL unreachable', () => {
        const env = probe_env(
            { HOME: '/h', PATH: '/p', ANTHROPIC_API_KEY: 'k', ANTHROPIC_AUTH_TOKEN: 't', OPENAI_API_KEY: 'o', ANTHROPIC_BASE_URL: 'https://api.anthropic.com' },
            { CLAUDE_CONFIG_DIR: '/c', SOME_API_KEY: 'x', ANTHROPIC_BASE_URL: 'https://evil' },
        );
        expect(env).toEqual({ HOME: '/h', PATH: '/p', CLAUDE_CONFIG_DIR: '/c', ANTHROPIC_BASE_URL: UNREACHABLE_BASE_URL });
    });
});

describe('run_delivery_probe with a fake host', () => {
    it('reads init, kills the child before the model call, passes no key', () => {
        const dir = mkdir();
        const bin = fakeHost(dir, { global: ['code-review'], scoped: [] });
        const env = probe_env({ ...process.env, ANTHROPIC_API_KEY: 'sk-should-not-leak' });
        const res = run_delivery_probe(bin, ['--output-format', 'stream-json', '--verbose'], { cwd: dir, env, timeout_ms: 5000 });
        expect(res.ok).toBe(true);
        expect(res.init?.skills).toEqual(['code-review']);
        // Wait past the fake's 600 ms "model call" — a surviving child would write the marker.
        const until = Date.now() + 1000;
        while (Date.now() < until) {
            /* spin */
        }
        expect(fs.existsSync(path.join(dir, 'reached-model'))).toBe(false);
        const childEnv = JSON.parse(fs.readFileSync(path.join(dir, 'env.json'), 'utf8')) as Record<string, string>;
        expect(childEnv['ANTHROPIC_API_KEY']).toBeUndefined();
        expect(childEnv['ANTHROPIC_BASE_URL']).toBe(UNREACHABLE_BASE_URL);
    });

    it('reports a host that never emits init', () => {
        const dir = mkdir();
        const bin = path.join(dir, 'silent.cjs');
        fs.writeFileSync(bin, `#!${process.execPath}\nprocess.exit(0);\n`);
        fs.chmodSync(bin, 0o755);
        const res = run_delivery_probe(bin, [], { cwd: dir, env: probe_env(process.env), timeout_ms: 3000 });
        expect(res.ok).toBe(false);
        expect(res.init).toBeNull();
    });
});

describe('delivery_preflight over the real arm command lines', () => {
    const quiet = { log: () => undefined, model: 'claude-haiku-4-5', max_budget: null, package_skills: PKG, timeout_ms: 5000 };

    it('correct wiring passes and the probe asks for stream-json', () => {
        const dir = mkdir();
        const bin = fakeHost(dir, { global: ['code-review', 'other'], scoped: ['other'] });
        expect(delivery_preflight(['vanilla', 'package'], { ...quiet, binary: bin })).toBeNull();
        const argv = JSON.parse(fs.readFileSync(path.join(dir, 'argv.json'), 'utf8')) as string[];
        expect(argv).toEqual(expect.arrayContaining(['--output-format', 'stream-json', '--verbose']));
        expect(fs.existsSync(path.join(dir, 'reached-model'))).toBe(false);
    });

    it('aborts when the package arm loads no package skill', () => {
        const dir = mkdir();
        const bin = fakeHost(dir, { global: ['other'], scoped: ['other'] });
        expect(delivery_preflight(['vanilla', 'package'], { ...quiet, binary: bin })).toMatch(/^package: expected the package/);
    });

    it('aborts when vanilla loads a package skill', () => {
        const dir = mkdir();
        const bin = fakeHost(dir, { global: ['code-review'], scoped: ['code-review'] });
        expect(delivery_preflight(['vanilla', 'package'], { ...quiet, binary: bin })).toMatch(/^vanilla: settings scoped/);
    });
});
