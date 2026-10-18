// road-to-a-canvas-the-code-owns 3.3, 3.4, 4.3, 4.4, 4.5 — `/design-system:sync plan`.
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { importClaudeDesignSnapshot } from '../../src/scripts/_lib/design_system_claude_design.js';
import type { ComponentObservation, DesignSystem } from '../../src/scripts/_lib/design_system_import.js';
import { planCounts, planLedger, readBaseAtCommit } from '../../src/scripts/_lib/design_sync_plan.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const CLI = path.join(REPO_ROOT, 'src', 'scripts', 'design_sync.ts');
const SRC = { kind: 'repo' as const, ref: '.', captured_at: 'unknown' };

const ds = (light: Record<string, string>, extra: Partial<DesignSystem> = {}): DesignSystem => ({ source: SRC, colors: { light }, ...extra });
const tmp = (prefix: string): string => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

function gitRepo(): string {
    const dir = tmp('ds-sync-git-');
    const git = (...args: string[]): string => execFileSync('git', args, { cwd: dir, encoding: 'utf-8' }).trim();
    git('init', '-q');
    git('config', 'user.email', 't@example.com');
    git('config', 'user.name', 't');
    return dir;
}

describe('three-way classification', () => {
    const base = ds({ primary: '#111', accent: '#aaa', old: '#999' }, { radius: { md: '8px' } });
    const code = ds({ primary: '#222', accent: '#aaa', success: '#0f0' }, { radius: { md: '8px' } });
    const remote = ds({ primary: '#111', accent: '#bbb', old: '#999' }, { radius: { md: '8px' } });
    const classes = (b: DesignSystem | null): Record<string, string> =>
        Object.fromEntries(
            planLedger({ scopeRoot: '.', config: 'c', code, remote, base: b, projection: { projectId: 'p', commit: b ? 'abc1234' : null } }).rows.map((r) => [r.key, r.class]),
        );

    it('three-way: a projection commit gives base, code and remote classes', () => {
        expect(classes(base)).toEqual({
            'colors.light.accent': 'conflict',
            'colors.light.old': 'orphan',
            'colors.light.primary': 'remote-generated',
            'colors.light.success': 'code-only',
            'radius.md': 'in-sync',
        });
    });

    it('three-way: without a base a value difference is unknown, never a guessed class', () => {
        const c = classes(null);
        expect(c['colors.light.primary']).toBe('unknown');
        expect(c['colors.light.accent']).toBe('unknown');
        expect(c['radius.md']).toBe('in-sync');
    });

    it('three-way: equal values under different keys stay two rows', () => {
        const rows = planLedger({ scopeRoot: '.', config: 'c', code: ds({ link: '#2563eb' }), remote: ds({ action: '#2563eb' }), base: null, projection: { projectId: 'p', commit: null } }).rows;
        expect(rows.map((r) => [r.key, r.class])).toEqual([
            ['colors.light.action', 'remote-only:twin'],
            ['colors.light.link', 'code-only'],
        ]);
    });

    it('three-way: the base is read with git show at the projection commit', () => {
        const dir = gitRepo();
        fs.writeFileSync(path.join(dir, 'design-system.json'), JSON.stringify(base));
        execFileSync('git', ['add', 'design-system.json'], { cwd: dir });
        execFileSync('git', ['commit', '-q', '-m', 'projection'], { cwd: dir });
        const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf-8' }).trim();
        fs.writeFileSync(path.join(dir, 'design-system.json'), JSON.stringify(code));
        expect(readBaseAtCommit(dir, sha, 'design-system.json')).toEqual(base);
        expect(readBaseAtCommit(dir, 'deadbeef', 'design-system.json')).toBeNull();
        expect(readBaseAtCommit(dir, '--output=x', 'design-system.json')).toBeNull();
    });
});

describe('snapshot is data', () => {
    it('snapshot-inert: nothing in the snapshot is executed, imported or followed', () => {
        const dir = tmp('ds-snap-inert-');
        const marker = path.join(tmp('ds-marker-'), 'ran');
        fs.writeFileSync(path.join(dir, 'source.json'), JSON.stringify({ source: SRC }));
        fs.writeFileSync(path.join(dir, 'evil.js'), `require('fs').writeFileSync(${JSON.stringify(marker)}, 'x');`);
        fs.writeFileSync(path.join(dir, 'Card.d.ts'), "import './evil.js';\nexport declare const Card: () => null;\n");
        fs.writeFileSync(path.join(dir, 'theme.css'), '@import url("https://example.invalid/x.css");\n:root { --color-a: #fff; }\n');
        const outside = path.join(tmp('ds-outside-'), 'secret.css');
        fs.writeFileSync(outside, ':root { --color-secret: #000; }');
        fs.symlinkSync(outside, path.join(dir, 'linked.css'));
        const r = importClaudeDesignSnapshot(dir);
        if (!r.ok) throw new Error(r.reason);
        expect(fs.existsSync(marker)).toBe(false);
        expect(r.design_system._meta?.['unmapped']).toEqual(['evil.js', 'linked.css (symlink, not followed)']);
        expect(r.design_system.colors?.light).toEqual({ a: '#fff' });
    });

    it('snapshot-inert: the lane module has no evaluation, import or network primitive', () => {
        const text = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/_lib/design_system_claude_design.ts'), 'utf-8');
        for (const banned of [/\bimport\s*\(/, /\brequire\s*\(/, /\beval\s*\(/, /new Function\b/, /node:vm/, /child_process/, /\bfetch\s*\(/, /node:https?/]) {
            expect(text).not.toMatch(banned);
        }
    });
});

describe('counts', () => {
    const comp = (name: string): ComponentObservation => ({ name, observed: { props: ['a'] } });
    it('counts: two remote-only components (one colliding) and one conflicting token → overwrite 2, twin 1', () => {
        const base = ds({ primary: '#111' });
        const code: DesignSystem = { ...ds({ primary: '#222' }), components: [comp('Button')], _meta: { component_paths: { Button: 'components/Button.tsx' } } };
        const remote: DesignSystem = {
            ...ds({ primary: '#333' }),
            components: [comp('Button'), comp('ButtonV2'), comp('Hero')],
            _meta: { component_paths: { Button: 'components/Button.tsx', ButtonV2: 'components/Button.tsx', Hero: 'components/Hero.tsx' } },
        };
        const l = planLedger({ scopeRoot: '.', config: 'c', code, remote, base: { ...base, components: [comp('Button')] }, projection: { projectId: 'p', commit: 'abc1234' } });
        expect(planCounts(l)).toMatchObject({ overwrite: 2, twin: 1 });
        expect(l.handover.recommended).toBe(false);
    });

    it('counts: an unreachable remote yields unknown rows and no recommendation', () => {
        const l = planLedger({ scopeRoot: '.', config: 'c', code: ds({ primary: '#222' }), remote: null, base: null, projection: { projectId: 'p', commit: null } });
        expect(l.rows.map((r) => r.class)).toEqual(['unknown']);
        expect(planCounts(l)).toMatchObject({ overwrite: 0, twin: 0, unknown: 1 });
        expect(l.handover.recommended).toBeNull();
    });

    it('counts: a missing projectId pin blocks the handover', () => {
        const l = planLedger({ scopeRoot: '.', config: 'c', code: ds({ p: '#1' }), remote: ds({ p: '#1' }), base: null, projection: { projectId: null, commit: null } });
        expect(l.handover).toEqual({ recommended: false, reason: expect.stringMatching(/blocked.*projectId/) });
    });
});

describe('no upload route', () => {
    const files = [
        'src/scripts/design_sync.ts',
        'src/scripts/_lib/design_sync_ledger.ts',
        'src/scripts/_lib/design_sync_plan.ts',
        'src/scripts/_lib/design_sync_reconcile.ts',
        'src/scripts/_lib/design_sync_verify.ts',
        'src/scripts/_lib/design_system_claude_design.ts',
    ];
    it('no-upload-route: the scripts name no canvas write method and spawn nothing but git', () => {
        for (const f of files) {
            const text = fs.readFileSync(path.join(REPO_ROOT, f), 'utf-8');
            expect(text, f).not.toMatch(/DesignSync|\bfetch\s*\(|node:https?|node:net|claude\.ai\/design/);
            for (const m of text.matchAll(/(?<![.\w])(execFileSync|execSync|spawnSync|spawn|exec|execFile)\s*\(\s*([^,)]+)/g)) {
                expect(m[2]?.trim(), `${f}: ${m[0]}`).toBe("'git'");
            }
        }
    });

    it('no-upload-route: the command is user-invoked only and never runs the host sync', () => {
        const cmd = fs.readFileSync(path.join(REPO_ROOT, 'src/domains/engineering-base/design-system/sync/command.md'), 'utf-8');
        expect(cmd).toMatch(/^disable-model-invocation: true$/m);
        expect(cmd).not.toMatch(/DesignSync/);
        const fenced = [...cmd.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1] as string).join('\n');
        expect(fenced).not.toMatch(/^\s*\/design-sync\b/m);
    });
});

describe('idempotent', () => {
    function listing(dir: string): string[] {
        const out: string[] = [];
        const walk = (d: string): void => {
            for (const n of fs.readdirSync(d).sort()) {
                const p = path.join(d, n);
                if (fs.statSync(p).isDirectory()) walk(p);
                else out.push(`${path.relative(dir, p)} ${fs.statSync(p).mtimeMs}`);
            }
        };
        walk(dir);
        return out;
    }
    it('idempotent: a second plan over unchanged inputs writes a byte-identical ledger and no other file', () => {
        const scope = tmp('ds-idem-');
        fs.mkdirSync(path.join(scope, '.design-sync'));
        fs.writeFileSync(path.join(scope, '.design-sync', 'config.json'), JSON.stringify({ projectId: 'p1' }));
        fs.writeFileSync(path.join(scope, 'design-system.json'), JSON.stringify(ds({ primary: '#111' })));
        const snap = path.join(scope, 'snap');
        fs.mkdirSync(snap);
        fs.writeFileSync(path.join(snap, 'source.json'), JSON.stringify({ source: SRC }));
        fs.writeFileSync(path.join(snap, 'theme.css'), ':root { --color-primary: #222; }');
        const run = () =>
            spawnSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx'), [CLI, 'plan', '--scope-root', scope, '--code', path.join(scope, 'design-system.json'), '--remote', snap], {
                encoding: 'utf-8',
                timeout: 60_000,
            });
        const first = run();
        expect(first.stdout).toContain('overwrite: 0');
        expect(first.stdout).toContain('twin: 0');
        const ledgerFile = path.join(scope, '.claude', 'design-system', 'sync-ledger.json');
        const bytes = fs.readFileSync(ledgerFile, 'utf-8');
        const before = listing(scope);
        const second = run();
        expect(second.status).toBe(first.status);
        expect(fs.readFileSync(ledgerFile, 'utf-8')).toBe(bytes);
        expect(listing(scope)).toEqual(before);
    });
});
