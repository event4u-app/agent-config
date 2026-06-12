// Tests for src/scripts/build_cloud_bundle.ts (py2ts Phase 8 / Wave 8b).
//
// Ports tests/test_build_cloud_bundle.py 1:1 (parse_skill_md,
// enforce_description_budget, swap_paths / render_skill_md, build_skill_zip
// round-trip, build_all gating, the no-T3-H regression) plus a golden-parity
// layer that builds python3 and tsx --all into tmp out-dirs over the REAL
// skill source and asserts byte-identical manifest + decompressed ZIP CONTENTS
// (the raw archive bytes are an intentional documented divergence — see the
// module header). Skipped without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as bcb from '../../src/scripts/build_cloud_bundle.js';
import { zip_read_sync } from '../../src/scripts/_lib/zip_min.js';
import * as audit from '../../src/scripts/audit_cloud_compatibility.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_cloud_bundle.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_cloud_bundle.py');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud-bundle-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    bcb._setConfigForTest({ SOURCE_SKILLS: bcb.SOURCE_SKILLS, load_tier_map: bcb.load_tier_map_default });
});

function makeSkill(root: string, name: string, opts: { desc: string; body?: string }): string {
    const sd = path.join(root, name);
    fs.mkdirSync(sd, { recursive: true });
    const body = opts.body || `# ${name}\n\nUse this skill.\n`;
    fs.writeFileSync(path.join(sd, 'SKILL.md'), `---\nname: ${name}\ndescription: "${opts.desc}"\n---\n\n${body}`, 'utf-8');
    return sd;
}

function zipEntries(zipPath: string): Record<string, Buffer> {
    const out: Record<string, Buffer> = {};
    for (const e of zip_read_sync(fs.readFileSync(zipPath))) {
        out[e.name] = e.data;
    }
    return out;
}

describe('build_cloud_bundle — parse_skill_md', () => {
    it('happy path', () => {
        const [meta, body] = bcb.parse_skill_md('---\nname: foo\ndescription: "Use when foo."\n---\n\nbody\n');
        expect(meta).toEqual({ name: 'foo', description: 'Use when foo.' });
        expect(body.trim()).toBe('body');
    });
    it('missing frontmatter', () => {
        expect(() => bcb.parse_skill_md('# heading only\n')).toThrow(/frontmatter/);
    });
    it('missing description', () => {
        expect(() => bcb.parse_skill_md('---\nname: foo\n---\n\nbody\n')).toThrow(/description/);
    });
});

describe('build_cloud_bundle — enforce_description_budget', () => {
    it('under limit unchanged', () => {
        const warnings: string[] = [];
        const [out, truncated] = bcb.enforce_description_budget('short desc', false, warnings);
        expect(out).toBe('short desc');
        expect(truncated).toBe(false);
        expect(warnings).toEqual([]);
    });
    it('truncates at word boundary', () => {
        const long = 'Use when ' + 'aaaa bbbb '.repeat(30);
        const warnings: string[] = [];
        const [out, truncated] = bcb.enforce_description_budget(long, false, warnings);
        expect(truncated).toBe(true);
        expect(out.endsWith('…')).toBe(true);
        expect(out.length).toBeLessThan(bcb.DESC_LIMIT_WEB);
        expect(out).toContain(' ');
        expect(warnings[0]).toContain('truncated');
    });
    it('strict mode raises', () => {
        expect(() => bcb.enforce_description_budget('x'.repeat(250), true, [])).toThrow(/strict mode/);
    });
    it('hard spec limit always raises', () => {
        expect(() => bcb.enforce_description_budget('x'.repeat(1100), false, [])).toThrow(/spec limit/);
    });
});

describe('build_cloud_bundle — swap_paths / render_skill_md', () => {
    it('swap_paths replaces package-internal only', () => {
        const body =
            'Edit `.agent-src.uncondensed/skills/foo/SKILL.md` and ' +
            'see (`dist/agent-src/rules/x.md`). The `agents/roadmaps/` dir stays intact.';
        const out = bcb.swap_paths(body);
        expect(out).toContain('<package-source>/skills/foo/SKILL.md');
        expect(out).toContain('<package-source>/rules/x.md');
        expect(out).not.toContain('dist/agent-src');
        expect(out).toContain('`agents/roadmaps/`');
    });
    it('render with swap adds sandbox note', () => {
        const rendered = bcb.render_skill_md('foo', 'Use when foo.', '# foo\nbody\n', { swap: true });
        expect(rendered).toContain('name: foo');
        expect(rendered).toContain('Cloud sandbox.');
        expect(rendered.startsWith('---\n')).toBe(true);
    });
    it('render without swap omits sandbox note', () => {
        const rendered = bcb.render_skill_md('foo', 'Use when foo.', '# foo\nbody\n', { swap: false });
        expect(rendered).not.toContain('Cloud sandbox.');
        expect(rendered).toContain('name: foo');
    });
});

describe('build_cloud_bundle — build_skill_zip round-trip', () => {
    it('round trip T1 (no swap)', () => {
        const src = makeSkill(path.join(tmp, 'src'), 'demo', { desc: 'Use when demo.' });
        fs.mkdirSync(path.join(src, 'references'));
        fs.writeFileSync(path.join(src, 'references', 'extra.md'), 'ref body\n', 'utf-8');
        const out = path.join(tmp, 'out');
        const result = bcb.build_skill_zip(src, out, 'T1', { strict: false, dry_run: false });
        expect(result.status).toBe('ok');
        const zipPath = path.join(out, 'demo.zip');
        expect(fs.statSync(zipPath).isFile()).toBe(true);
        const entries = zipEntries(zipPath);
        expect(Object.keys(entries)).toContain('demo/SKILL.md');
        expect(Object.keys(entries)).toContain('demo/references/extra.md');
        const skillMd = (entries['demo/SKILL.md'] as Buffer).toString('utf-8');
        expect(skillMd).not.toContain('Cloud sandbox.');
        expect(skillMd).toContain('name: demo');
    });
    it('T2 adds sandbox note + path-swap', () => {
        const src = makeSkill(path.join(tmp, 'src'), 'auth', {
            desc: 'Use when auth.',
            body: 'See `dist/agent-src/skills/x/SKILL.md` for context.\n',
        });
        const out = path.join(tmp, 'out');
        bcb.build_skill_zip(src, out, 'T2', { strict: false, dry_run: false });
        const skillMd = (zipEntries(path.join(out, 'auth.zip'))['auth/SKILL.md'] as Buffer).toString('utf-8');
        expect(skillMd).toContain('Cloud sandbox.');
        expect(skillMd).toContain('<package-source>/skills/x/SKILL.md');
        expect(skillMd).not.toContain('`dist/agent-src/skills/x/');
    });
});

describe('build_cloud_bundle — build_all gating', () => {
    it('skips T3-H and an explicit single-skill T3-H request raises', () => {
        const srcRoot = path.join(tmp, 'skills');
        makeSkill(srcRoot, 'safe', { desc: 'Use when safe.' });
        makeSkill(srcRoot, 'blocked', { desc: 'Use when blocked.' });
        bcb._setConfigForTest({
            SOURCE_SKILLS: srcRoot,
            load_tier_map: () => ({
                safe: { tier: 'T1', cloud_marker: null, raw_tier: 'T1' },
                blocked: { tier: 'T3-H', cloud_marker: null, raw_tier: 'T3-H' },
            }),
        });

        const [built, skipped] = bcb.build_all(path.join(tmp, 'out'), { only: null, strict: false, dry_run: false });
        expect(built.map((r) => r.skill)).toEqual(['safe']);
        expect(skipped.map((r) => r.skill)).toEqual(['blocked']);
        expect(skipped[0]!.tier).toBe('T3-H');

        expect(() => bcb.build_all(path.join(tmp, 'out'), { only: 'blocked', strict: false, dry_run: false })).toThrow(/T3-H/);
    });
});

describe('build_cloud_bundle — regression: no T3-H in shipped source', () => {
    it('summary by_tier has zero T3-H', () => {
        const summary = audit.summarize(audit.scan()) as { by_tier: Record<string, number> };
        expect(summary.by_tier['T3-H'] ?? 0).toBe(0);
    });
});

describe.runIf(hasPython3())('build_cloud_bundle — golden parity (python3 vs tsx)', () => {
    it('--check is byte-identical', () => {
        const py = spawnSync('python3', [PY_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
        expect(ts.status).toBe(py.status);
        expect(ts.stdout).toBe(py.stdout);
        expect(ts.stderr).toBe(py.stderr);
    });
    it('--all: identical console + manifest + decompressed ZIP contents, zero drift', () => {
        const pyd = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-py-'));
        const tsd = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-ts-'));
        try {
            const py = spawnSync('python3', [PY_SCRIPT, '--all', '--out', pyd], { encoding: 'utf8', cwd: REPO_ROOT });
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT, '--all', '--out', tsd], { encoding: 'utf8', cwd: REPO_ROOT });
            expect(ts.status).toBe(py.status);
            expect(ts.stdout).toBe(py.stdout);
            expect(ts.stderr).toBe(py.stderr);
            // manifest byte-identical after normalising the tmp out-dir path.
            const pyMan = fs.readFileSync(path.join(pyd, 'manifest.json'), 'utf-8').replaceAll(pyd, 'OUT');
            const tsMan = fs.readFileSync(path.join(tsd, 'manifest.json'), 'utf-8').replaceAll(tsd, 'OUT');
            expect(tsMan).toBe(pyMan);
            // every ZIP's decompressed entry map is byte-identical.
            const pyZips = fs.readdirSync(pyd).filter((f) => f.endsWith('.zip')).sort();
            const tsZips = fs.readdirSync(tsd).filter((f) => f.endsWith('.zip')).sort();
            expect(tsZips).toEqual(pyZips);
            for (const z of pyZips) {
                const a = zipEntries(path.join(pyd, z));
                const b = zipEntries(path.join(tsd, z));
                expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
                for (const name of Object.keys(a)) {
                    expect(Buffer.compare(b[name] as Buffer, a[name] as Buffer)).toBe(0);
                }
            }
        } finally {
            fs.rmSync(pyd, { recursive: true, force: true });
            fs.rmSync(tsd, { recursive: true, force: true });
        }
    });
});
