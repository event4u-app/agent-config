// The projected SKILL.md frontmatter, per host, for the six skills that once
// carried the host's reserved `context` key.
//
// road-to-skills-that-arrive-when-called 1.3. Step 1.1 renamed the package key
// `context: large` to `context_window: large`; step 1.2 lints the SCHEMA
// against the host's documented keys. Neither sees the install: a deploy-time
// rewrite could still put a host key back, or drop the package one, and both
// checks would stay green. This test copies the shipped projection through the
// installer's own copy path into a scratch home, once per host, and pins the
// frontmatter that lands.
//
// Hosts: the first host (claude-code, which also gets the `model_tier` →
// `model` rewrite when `model.auto_switch: auto`), the second host (codex,
// which receives the Claude skill bundle under `~/.codex/skills`), and one host
// the roadmap does not touch (augment).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { GLOBAL_DEPLOY_SOURCES } from '../../src/install/wizard-plan.js';
import { _copy_dir_dereferencing_symlinks, USER_SCOPE_PATHS } from '../../src/scripts/install.js';
import { render_native_model_md, read_model_tier } from '../../src/scripts/_lib/model_tier.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const PROJECTION = path.join(REPO_ROOT, 'dist', 'agent-src', 'skills');
const HOST_KEYS_FILE = path.join(REPO_ROOT, 'src', 'config', 'host-skill-frontmatter-keys.json');

const SIX = [
    'deep-reading-analyst',
    'project-analysis-core',
    'project-analysis-hypothesis-driven',
    'project-analyzer',
    'repomix-packer',
    'universal-project-analysis',
] as const;

const HOSTS = ['claude-code', 'codex', 'augment'] as const;
type Host = (typeof HOSTS)[number];

/** Keys the installer adds to every deployed markdown file. */
const INJECTED = ['package', 'source_path'];

const tmpDirs: string[] = [];
afterAll(() => {
    for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

/** Top-level frontmatter keys in order, with their raw single-line values. */
function frontmatter(text: string): Array<[string, string]> {
    expect(text.startsWith('---\n')).toBe(true);
    const end = text.indexOf('\n---\n', 4);
    expect(end).toBeGreaterThan(0);
    const out: Array<[string, string]> = [];
    for (const line of text.slice(4, end).split('\n')) {
        const m = /^([A-Za-z_][A-Za-z0-9_-]*):\s?(.*)$/.exec(line);
        if (m) out.push([m[1] as string, m[2] as string]);
    }
    return out;
}

function hostKeys(): Set<string> {
    const doc = JSON.parse(fs.readFileSync(HOST_KEYS_FILE, 'utf8')) as {
        hosts: Array<{ keys: string[] }>;
    };
    return new Set(doc.hosts.flatMap((h) => h.keys));
}

/** Deploy the six skills for one host through the installer's copy path. */
function deploy(host: Host): string {
    const sources = GLOBAL_DEPLOY_SOURCES[host] ?? [];
    const row = sources.find(([src]) => src === 'dist/agent-src/skills');
    expect(row, `${host} has no skills deploy row`).toBeDefined();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `host-skill-proj-${host}-`));
    tmpDirs.push(home);
    const anchor = (USER_SCOPE_PATHS[host] as string).replace(/^~\//, '');
    const root = path.join(home, anchor, (row as readonly [string, string])[1]);
    for (const skill of SIX) {
        _copy_dir_dereferencing_symlinks(
            path.join(PROJECTION, skill),
            path.join(root, skill),
            true,
            REPO_ROOT,
        );
        if (host === 'claude-code') {
            // finalize_claude_model_tiers under `model.auto_switch: auto`.
            const md = path.join(root, skill, 'SKILL.md');
            const tier = read_model_tier(md);
            if (tier !== null) fs.writeFileSync(md, render_native_model_md(fs.readFileSync(md, 'utf8'), tier));
        }
    }
    return root;
}

describe('projected SKILL.md frontmatter per host (1.3)', () => {
    const roots = new Map<Host, string>();
    for (const host of HOSTS) roots.set(host, deploy(host));
    const documented = hostKeys();

    it.each(HOSTS.flatMap((h) => SIX.map((s) => [h, s] as const)))(
        '%s / %s carries context_window and no host context key',
        (host, skill) => {
            const fm = frontmatter(fs.readFileSync(path.join(roots.get(host) as string, skill, 'SKILL.md'), 'utf8'));
            const keys = fm.map(([k]) => k);
            expect(fm).toContainEqual(['context_window', 'large']);
            expect(keys).not.toContain('context');
        },
    );

    it.each(HOSTS.flatMap((h) => SIX.map((s) => [h, s] as const)))(
        '%s / %s: no host-documented key is added, dropped or rewritten in deploy',
        (host, skill) => {
            const src = frontmatter(fs.readFileSync(path.join(PROJECTION, skill, 'SKILL.md'), 'utf8'));
            const out = frontmatter(fs.readFileSync(path.join(roots.get(host) as string, skill, 'SKILL.md'), 'utf8'));
            const srcHost = src.filter(([k]) => documented.has(k));
            let outHost = out.filter(([k]) => documented.has(k));
            if (host === 'claude-code') {
                // The one deliberate host-key write: model_tier → model, with the
                // host's meaning (ADR-034). Everything else must pass through.
                const tier = src.find(([k]) => k === 'model_tier');
                if (tier !== undefined) {
                    expect(outHost.filter(([k]) => k === 'model')).toHaveLength(1);
                    outHost = outHost.filter(([k]) => k !== 'model');
                }
            }
            expect(outHost).toEqual(srcHost);
            for (const k of INJECTED) expect(documented.has(k), `${k} is a host key`).toBe(false);
        },
    );

    it('pins the projected key order per host', () => {
        const snapshot: Record<string, Record<string, string[]>> = {};
        for (const host of HOSTS) {
            snapshot[host] = {};
            for (const skill of SIX) {
                const fm = frontmatter(fs.readFileSync(path.join(roots.get(host) as string, skill, 'SKILL.md'), 'utf8'));
                (snapshot[host] as Record<string, string[]>)[skill] = fm.map(([k]) => k);
            }
        }
        const base = ['context_window', 'name', 'description'];
        const tail = ['domain', 'workspaces', 'packs', ...INJECTED];
        const expected = (first: string, status: boolean): string[] => [
            first,
            ...base,
            ...(status ? ['status'] : []),
            ...tail,
        ];
        for (const host of HOSTS) {
            const first = host === 'claude-code' ? 'model' : 'model_tier';
            expect(snapshot[host]).toEqual({
                'deep-reading-analyst': expected(first, true),
                'project-analysis-core': expected(first, false),
                'project-analysis-hypothesis-driven': expected(first, false),
                'project-analyzer': expected(first, false),
                'repomix-packer': expected(first, false),
                'universal-project-analysis': expected(first, false),
            });
        }
    });
});
