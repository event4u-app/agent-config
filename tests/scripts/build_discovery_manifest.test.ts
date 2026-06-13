// Tests for src/scripts/build_discovery_manifest.ts (py2ts Phase 5).
//
// Two layers:
//   1. A 1:1 port of tests/test_build_discovery_manifest.py — the ADR-015
//      builder contract (checksum, optional requires, stats, determinism,
//      orphan / deprecation / trust reports, workspace / pack sub-views), run
//      against a tmp fixture tree with the module path config injected via
//      `_setConfigForTest` (mirrors the pytest monkeypatch of mod.ROOT / SRC /
//      VOCAB_DIR / artefact_roots / resolve_logical).
//   2. A golden-parity layer on the REAL REPO: python3 build + tsx build are
//      asserted byte-identical (generated_at normalized), and
//      validate_discovery_manifest.py is asserted to PASS on the TS-built
//      manifest. The committed manifest is restored afterwards. Skipped when
//      python3 is unavailable.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as mod from '../../src/scripts/build_discovery_manifest.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

// --- Layer 1: ported builder contract (tmp-fixture) -------------------------

const SKILL_BASE = (name: string, extra: string): string =>
    [
        '---',
        `name: ${name}`,
        'description: "fixture skill"',
        'workspaces:',
        '  - engineering',
        'packs:',
        '  - engineering-base',
        `${extra}lifecycle: active`,
        'trust:',
        '  level: core',
        '  confidence: high',
        '  human_review_required: false',
        'install:',
        '  default: true',
        '  removable: true',
        '---',
        '',
        `# ${name}`,
        '',
    ].join('\n');

function makeRepo(tmp: string): string {
    const vocab = path.join(tmp, 'config', 'discovery');
    fs.mkdirSync(vocab, { recursive: true });
    // Loader treats the file as a list at top-level — match the live shape.
    fs.writeFileSync(
        path.join(vocab, 'workspaces.yml'),
        '- id: engineering\n  label: "Engineering"\n  description: "devs"\n  default_packs: [engineering-base]\n',
        'utf-8',
    );
    fs.writeFileSync(
        path.join(vocab, 'packs.yml'),
        '- id: engineering-base\n  label: "Engineering Base"\n  description: "core eng"\n  workspaces: [engineering]\n  trust_level_default: core\n' +
            '- id: php\n  label: "PHP"\n  description: "php runtime"\n  workspaces: [engineering]\n  trust_level_default: professional\n',
        'utf-8',
    );
    fs.writeFileSync(path.join(vocab, 'unassigned-artefacts.yml'), '[]\n', 'utf-8');
    fs.mkdirSync(path.join(tmp, '.agent-src.uncondensed', 'skills'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.agent-src.uncondensed', 'rules'), { recursive: true });
    fs.mkdirSync(path.join(tmp, '.agent-src.uncondensed', 'commands'), { recursive: true });
    return tmp;
}

function writeSkill(repo: string, name: string, extra = ''): string {
    const p = path.join(repo, '.agent-src.uncondensed', 'skills', name, 'SKILL.md');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, SKILL_BASE(name, extra), 'utf-8');
    return p;
}

// ADR-092 visibility: a command artefact carrying `tier:` and optionally
// `visibility:` frontmatter. `vis === undefined` omits the key (exercises the
// tier→visibility derivation); a string value sets it explicitly.
function writeCommand(
    repo: string,
    name: string,
    { tier, vis }: { tier?: number; vis?: string } = {},
): string {
    const lines = [
        '---',
        `name: ${name}`,
        'description: "fixture command"',
    ];
    if (tier !== undefined) {
        lines.push(`tier: ${tier}`);
    }
    if (vis !== undefined) {
        lines.push(`visibility: ${vis}`);
    }
    lines.push(
        'workspaces:',
        '  - engineering',
        'packs:',
        '  - engineering-base',
        'lifecycle: active',
        'trust:',
        '  level: core',
        '  confidence: high',
        '  human_review_required: false',
        'install:',
        '  default: true',
        '  removable: true',
        '---',
        '',
        `# ${name}`,
        '',
    );
    const p = path.join(repo, '.agent-src.uncondensed', 'commands', `${name}.md`);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, lines.join('\n'), 'utf-8');
    return p;
}

function writeSkillWith(
    repo: string,
    name: string,
    {
        pack = 'engineering-base',
        lifecycle = 'active',
        trustLevel = 'core',
    }: { pack?: string; lifecycle?: string; trustLevel?: string } = {},
): string {
    const body = [
        '---',
        `name: ${name}`,
        'description: "fixture skill"',
        'workspaces:',
        '  - engineering',
        'packs:',
        `  - ${pack}`,
        `lifecycle: ${lifecycle}`,
        'trust:',
        `  level: ${trustLevel}`,
        '  confidence: high',
        '  human_review_required: false',
        'install:',
        '  default: true',
        '  removable: true',
        '---',
        '',
        `# ${name}`,
        '',
    ].join('\n');
    const p = path.join(repo, '.agent-src.uncondensed', 'skills', name, 'SKILL.md');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

interface Manifest {
    [k: string]: unknown;
    artefacts: Array<Record<string, unknown>>;
    unassigned: Array<Record<string, unknown>>;
    stats: Record<string, Record<string, number> | number>;
    workspaces: Array<Record<string, unknown>>;
    packs: Array<Record<string, unknown>>;
}

describe('build_discovery_manifest — builder contract (ported from pytest)', () => {
    let tmp: string;
    let saved: ReturnType<typeof mod._getConfigForTest>;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bdm-'));
        const root = makeRepo(tmp);
        const src = path.join(root, '.agent-src.uncondensed');
        saved = mod._getConfigForTest();
        mod._setConfigForTest({
            ROOT: root,
            SRC: src,
            VOCAB_DIR: path.join(root, 'config', 'discovery'),
            // Post-ADR-017 the builder discovers sources via multi-root helpers.
            // Scope them to the fixture tree so the test doesn't walk real roots.
            artefact_roots: () => [src],
            resolve_logical: (rel: string) => {
                const p = path.join(src, rel.replace(/\\/g, '/').replace(/^\/+/, ''));
                return fs.existsSync(p) ? p : null;
            },
        });
    });

    afterEach(() => {
        mod._setConfigForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    const build = (): Manifest => mod._build(false)[0] as unknown as Manifest;

    it('empty tree yields zero stats', () => {
        const manifest = build();
        const stats = manifest.stats as Record<string, Record<string, number> | number>;
        expect((stats.total_artefacts as number)).toBe(0);
        expect((stats.by_category as Record<string, number>).skill).toBe(0);
        expect((stats.unassigned_count as number)).toBe(0);
        expect(manifest.artefacts).toEqual([]);
    });

    it('single skill carries checksum', () => {
        writeSkill(tmp, 'sample-a');
        const manifest = build();
        expect(manifest.artefacts).toHaveLength(1);
        const entry = manifest.artefacts[0]!;
        expect(entry.checksum).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect('requires' in entry).toBe(false); // absent when not declared
        const stats = manifest.stats as Record<string, Record<string, number>>;
        expect(stats.by_category!.skill).toBe(1);
        expect(stats.by_trust_level!.core).toBe(1);
    });

    it('optional requires is emitted', () => {
        writeSkill(tmp, 'sample-b', 'requires:\n  - php\n');
        const manifest = build();
        expect(manifest.artefacts[0]!.requires).toEqual(['php']);
    });

    it('unknown requires marks unassigned', () => {
        writeSkill(tmp, 'sample-c', 'requires:\n  - mars-colony\n');
        const manifest = build();
        expect(manifest.artefacts).toEqual([]);
        expect(manifest.unassigned).toHaveLength(1);
        expect(String(manifest.unassigned[0]!.reason)).toContain('requires');
    });

    it('determinism byte-identical', () => {
        writeSkill(tmp, 'sample-d');
        writeSkill(tmp, 'sample-e', 'requires:\n  - php\n');
        const a = mod._build(false)[0];
        const b = mod._build(false)[0];
        mod._finalise_checksum(a);
        mod._finalise_checksum(b);
        const norm = (m: Record<string, unknown>): Record<string, unknown> => ({
            ...m,
            generated_at: 'X',
        });
        expect(mod._serialize(norm(a))).toBe(mod._serialize(norm(b)));
    });

    it('checksum changes when body changes', () => {
        const p = writeSkill(tmp, 'sample-f');
        const c1 = build().artefacts[0]!.checksum;
        fs.writeFileSync(p, fs.readFileSync(p, 'utf-8') + '\nextra content\n', 'utf-8');
        const c2 = build().artefacts[0]!.checksum;
        expect(c1).not.toBe(c2);
    });

    it('stats total matches artefact list', () => {
        writeSkill(tmp, 's1');
        writeSkill(tmp, 's2');
        writeSkill(tmp, 's3', 'requires:\n  - php\n');
        const manifest = build();
        const total = (manifest.stats as Record<string, number>).total_artefacts;
        expect(total).toBe(manifest.artefacts.length);
        expect(total).toBe(3);
    });

    it('orphan artefact detected for sparse pack', () => {
        writeSkillWith(tmp, 'sample-eng', { pack: 'engineering-base' });
        writeSkillWith(tmp, 'sample-eng-2', { pack: 'engineering-base' });
        writeSkillWith(tmp, 'sample-php-solo', { pack: 'php' });
        const manifest = build();
        const orphans = mod._orphan_artefacts(manifest);
        expect(orphans).toHaveLength(1);
        expect(orphans[0]!.pack).toBe('php');
    });

    it('experimental lifecycle exempts from orphan', () => {
        writeSkillWith(tmp, 'sample-eng', { pack: 'engineering-base' });
        writeSkillWith(tmp, 'sample-eng-2', { pack: 'engineering-base' });
        writeSkillWith(tmp, 'sample-php-solo', { pack: 'php', lifecycle: 'experimental' });
        const manifest = build();
        expect(mod._orphan_artefacts(manifest)).toEqual([]);
    });

    it('deprecation report lists deprecated', () => {
        writeSkillWith(tmp, 'active-one', { pack: 'engineering-base' });
        writeSkillWith(tmp, 'old-one', { pack: 'engineering-base', lifecycle: 'deprecated' });
        const report = mod._deprecation_report(build());
        expect(report).toContain('Deprecated artefacts: **1**');
        expect(report).toContain('old-one');
    });

    it('trust report aggregates by workspace', () => {
        writeSkillWith(tmp, 'a', { pack: 'engineering-base', trustLevel: 'core' });
        writeSkillWith(tmp, 'b', { pack: 'engineering-base', trustLevel: 'professional' });
        const report = mod._trust_report(build());
        expect(report).toContain('`engineering`');
        expect(report).toContain('Workspaces tracked: **1**');
    });

    it('orphan report is deterministic', () => {
        writeSkillWith(tmp, 'eng-1', { pack: 'engineering-base' });
        writeSkillWith(tmp, 'eng-2', { pack: 'engineering-base' });
        writeSkillWith(tmp, 'php-solo', { pack: 'php' });
        const m1 = build();
        const m2 = build();
        // `generated_at` is wall-clock; normalize before comparing the report.
        const tsRe = /^- Generated: `[^`]+`$/m;
        const r1 = mod._orphan_report(m1).replace(tsRe, '- Generated: `<normalised>`');
        const r2 = mod._orphan_report(m2).replace(tsRe, '- Generated: `<normalised>`');
        expect(r1).toBe(r2);
    });

    it('workspaces view lists each workspace', () => {
        writeSkillWith(tmp, 's1', { pack: 'engineering-base' });
        writeSkillWith(tmp, 's2', { pack: 'engineering-base' });
        const manifest = build();
        mod._finalise_checksum(manifest);
        const view = mod._workspaces_view(manifest) as Record<string, unknown>;
        expect(view.checksum).toBe(manifest.checksum);
        const workspaces = view.workspaces as Array<Record<string, unknown>>;
        expect(workspaces).toHaveLength(1);
        expect(workspaces[0]!.id).toBe('engineering');
        expect(workspaces[0]!.artefact_count).toBe(2);
    });

    it('packs view carries lifecycle and trust counts', () => {
        writeSkillWith(tmp, 'a', { pack: 'engineering-base', trustLevel: 'core' });
        writeSkillWith(tmp, 'b', { pack: 'engineering-base', trustLevel: 'core' });
        writeSkillWith(tmp, 'c', {
            pack: 'engineering-base',
            lifecycle: 'deprecated',
            trustLevel: 'core',
        });
        const manifest = build();
        mod._finalise_checksum(manifest);
        const view = mod._packs_view(manifest) as Record<string, unknown>;
        const packs = view.packs as Array<Record<string, unknown>>;
        const pack = packs.find((p) => p.id === 'engineering-base')!;
        expect(pack.artefact_count).toBe(3);
        expect((pack.by_lifecycle as Record<string, number>).active).toBe(2);
        expect((pack.by_lifecycle as Record<string, number>).deprecated).toBe(1);
        expect((pack.by_trust_level as Record<string, number>).core).toBe(3);
    });

    // ADR-092: explicit `visibility:` is the source of truth; the integer
    // `tier:` derives one when visibility is absent ({0:visible, 1:advanced,
    // 2:internal}); neither present → no key.
    it('command emits explicit visibility verbatim', () => {
        writeCommand(tmp, 'cmd-explicit', { tier: 2, vis: 'internal' });
        const entry = build().artefacts.find((e) => e.path?.toString().endsWith('cmd-explicit.md'))!;
        expect(entry.category).toBe('command');
        expect(entry.tier).toBe(2);
        expect(entry.visibility).toBe('internal');
    });

    it('command derives visibility from tier when visibility absent', () => {
        writeCommand(tmp, 'cmd-derive-0', { tier: 0 });
        writeCommand(tmp, 'cmd-derive-1', { tier: 1 });
        writeCommand(tmp, 'cmd-derive-2', { tier: 2 });
        const arts = build().artefacts;
        const vis = (suffix: string): unknown =>
            arts.find((e) => e.path?.toString().endsWith(suffix))!.visibility;
        expect(vis('cmd-derive-0.md')).toBe('visible');
        expect(vis('cmd-derive-1.md')).toBe('advanced');
        expect(vis('cmd-derive-2.md')).toBe('internal');
    });

    it('command without tier or visibility omits the key', () => {
        writeCommand(tmp, 'cmd-none');
        const entry = build().artefacts.find((e) => e.path?.toString().endsWith('cmd-none.md'))!;
        expect('tier' in entry).toBe(false);
        expect('visibility' in entry).toBe(false);
    });

    it('out-of-range tier yields no derived visibility', () => {
        // {0,1,2} only — tier 3 → Python dict .get returns None → key omitted.
        writeCommand(tmp, 'cmd-tier3', { tier: 3 });
        const entry = build().artefacts.find((e) => e.path?.toString().endsWith('cmd-tier3.md'))!;
        expect(entry.tier).toBe(3);
        expect('visibility' in entry).toBe(false);
    });

    it('subviews are deterministic', () => {
        writeSkillWith(tmp, 's1', { pack: 'engineering-base' });
        writeSkillWith(tmp, 's2', { pack: 'engineering-base' });
        const m1 = build();
        const m2 = build();
        mod._finalise_checksum(m1);
        mod._finalise_checksum(m2);
        const sortKeys = (o: unknown): string =>
            JSON.stringify(o, (_k, v) =>
                v !== null && typeof v === 'object' && !Array.isArray(v)
                    ? Object.fromEntries(Object.entries(v as object).sort())
                    : v,
            );
        expect(sortKeys(mod._workspaces_view(m1))).toBe(sortKeys(mod._workspaces_view(m2)));
        expect(sortKeys(mod._packs_view(m1))).toBe(sortKeys(mod._packs_view(m2)));
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_discovery_manifest.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'build_discovery_manifest.ts');
const VALIDATE_PY = path.join(REPO_ROOT, 'src', 'scripts', 'validate_discovery_manifest.py');
const COMMITTED = path.join(REPO_ROOT, 'dist', 'discovery', 'discovery-manifest.json');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const big = { maxBuffer: 256 * 1024 * 1024, cwd: REPO_ROOT, encoding: 'utf8' as const };

function normalizeGeneratedAt(jsonText: string): string {
    const obj = JSON.parse(jsonText) as Record<string, unknown>;
    obj.generated_at = '<normalised>';
    return JSON.stringify(obj, Object.keys(obj).sort(), 2);
}

const py3 = hasPython3();
const runnable = py3 && fs.existsSync(COMMITTED);

// --- Layer 3: visibility golden parity on a synthetic command fixture ------
//
// Self-contained: builds a tmp repo carrying command artefacts with explicit
// `visibility:` AND tier-only (derive-path) frontmatter, then asserts the
// python3 build and the tsx build emit a byte-identical manifest
// (generated_at + scanner_version normalized — the latter hashes a different
// file per runtime). This guarantees the ADR-092 visibility emission can never
// silently regress in the TS twin, independent of whatever the real repo's
// commands happen to carry. Skipped when python3 is unavailable.

function makeVisFixture(tmp: string): { root: string; src: string } {
    const vocab = path.join(tmp, 'config', 'discovery');
    fs.mkdirSync(vocab, { recursive: true });
    fs.writeFileSync(
        path.join(vocab, 'workspaces.yml'),
        '- id: engineering\n  label: "Engineering"\n  description: "devs"\n  default_packs: [engineering-base]\n',
        'utf-8',
    );
    fs.writeFileSync(
        path.join(vocab, 'packs.yml'),
        '- id: engineering-base\n  label: "Engineering Base"\n  description: "core eng"\n  workspaces: [engineering]\n  trust_level_default: core\n',
        'utf-8',
    );
    fs.writeFileSync(path.join(vocab, 'unassigned-artefacts.yml'), '[]\n', 'utf-8');
    const src = path.join(tmp, '.agent-src.uncondensed');
    fs.mkdirSync(path.join(src, 'commands'), { recursive: true });
    const cmd = (name: string, tierLine: string, visLine: string): void => {
        const body = [
            '---',
            `name: ${name}`,
            'description: "fixture command"',
            ...(tierLine ? [tierLine] : []),
            ...(visLine ? [visLine] : []),
            'workspaces:',
            '  - engineering',
            'packs:',
            '  - engineering-base',
            'lifecycle: active',
            'trust:',
            '  level: core',
            '  confidence: high',
            '  human_review_required: false',
            'install:',
            '  default: true',
            '  removable: true',
            '---',
            '',
            `# ${name}`,
            '',
        ].join('\n');
        fs.writeFileSync(path.join(src, 'commands', `${name}.md`), body, 'utf-8');
    };
    cmd('cmd-explicit', 'tier: 2', 'visibility: internal'); // explicit wins
    cmd('cmd-derive', 'tier: 1', ''); // derived → advanced
    cmd('cmd-tier3', 'tier: 3', ''); // out of {0,1,2} → key omitted
    cmd('cmd-none', '', ''); // neither → key omitted
    return { root: tmp, src };
}

// Python driver: monkeypatch the module roots at the tmp fixture, build,
// finalise, normalize the wall-clock + self-hash fields, print serialized JSON.
const PY_VIS_DRIVER = [
    'import sys, pathlib',
    'sys.path.insert(0, sys.argv[3])',
    'import build_discovery_manifest as m',
    'root, src = sys.argv[1], sys.argv[2]',
    'm.ROOT = pathlib.Path(root)',
    'm.SRC = pathlib.Path(src)',
    'm.VOCAB_DIR = pathlib.Path(root)/"config"/"discovery"',
    'm.artefact_roots = lambda: [pathlib.Path(src)]',
    'def _rl(rel):',
    '    p = pathlib.Path(src)/rel.lstrip("/")',
    '    return p if p.exists() else None',
    'm.resolve_logical = _rl',
    'mani, _ = m._build(False)',
    'm._finalise_checksum(mani)',
    'mani["generated_at"] = "<X>"',
    'mani["scanner_version"] = "<X>"',
    'sys.stdout.write(m._serialize(mani))',
].join('\n');

describe.skipIf(!py3)('build_discovery_manifest — visibility golden parity (synthetic)', () => {
    let tmp: string;
    let saved: ReturnType<typeof mod._getConfigForTest>;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bdm-vis-'));
        saved = mod._getConfigForTest();
    });
    afterEach(() => {
        mod._setConfigForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('command visibility emission is byte-identical python3 vs tsx', () => {
        const { root, src } = makeVisFixture(tmp);
        // tsx side: build in-process against the fixture, normalize the two
        // non-deterministic / per-runtime fields, serialize identically.
        mod._setConfigForTest({
            ROOT: root,
            SRC: src,
            VOCAB_DIR: path.join(root, 'config', 'discovery'),
            artefact_roots: () => [src],
            resolve_logical: (rel: string) => {
                const p = path.join(src, rel.replace(/\\/g, '/').replace(/^\/+/, ''));
                return fs.existsSync(p) ? p : null;
            },
        });
        const tsManifest = mod._build(false)[0];
        mod._finalise_checksum(tsManifest);
        tsManifest['generated_at'] = '<X>';
        tsManifest['scanner_version'] = '<X>';
        const tsOut = mod._serialize(tsManifest);

        // python3 side: drive the real .py over the same fixture.
        const scriptsDir = path.join(REPO_ROOT, 'src', 'scripts');
        const py = spawnSync('python3', ['-c', PY_VIS_DRIVER, root, src, scriptsDir], big);
        expect(py.stderr).toBe('');
        expect(py.status).toBe(0);

        // Byte-identical full manifest (incl. tier + visibility emission).
        expect(tsOut).toBe(py.stdout);

        // Belt-and-braces: assert the visibility values actually emitted.
        const parsed = JSON.parse(tsOut) as { artefacts: Array<Record<string, unknown>> };
        const byName = new Map(parsed.artefacts.map((a) => [a.name, a]));
        expect(byName.get('cmd-explicit')!.visibility).toBe('internal');
        expect(byName.get('cmd-derive')!.visibility).toBe('advanced');
        expect('visibility' in byName.get('cmd-tier3')!).toBe(false);
        expect('visibility' in byName.get('cmd-none')!).toBe(false);
    });
});

describe.skipIf(!runnable)('build_discovery_manifest — golden parity (python3 vs tsx)', () => {
    it('manifest stdout is byte-identical (generated_at normalized)', () => {
        const py = spawnSync('python3', [PY_SCRIPT], big);
        const ts = spawnSync(TSX_BIN, [TS_SCRIPT], big);
        expect(ts.status).toBe(0);
        expect(py.status).toBe(0);
        // Strip only the generated_at line; everything else (incl. checksum,
        // scanner_version) must match byte-for-byte.
        const strip = (s: string): string =>
            s.replace(/"generated_at": "[^"]*"/g, '"generated_at": "<X>"');
        expect(strip(ts.stdout)).toBe(strip(py.stdout));
        // Belt-and-braces: structural deep-equal too.
        expect(normalizeGeneratedAt(ts.stdout)).toBe(normalizeGeneratedAt(py.stdout));
    });

    it('TS-built manifest passes validate_discovery_manifest.py', () => {
        // The committed manifest is gitignored/generated. Snapshot it, overwrite
        // with the TS build, assert the Python validator (which re-builds with
        // the Python scanner and diffs) passes, then restore.
        const original = fs.readFileSync(COMMITTED, 'utf-8');
        try {
            const ts = spawnSync(TSX_BIN, [TS_SCRIPT], big);
            expect(ts.status).toBe(0);
            fs.writeFileSync(COMMITTED, ts.stdout, 'utf-8');
            const validated = spawnSync('python3', [VALIDATE_PY, '--quiet'], big);
            expect(validated.stderr).toBe('');
            expect(validated.status).toBe(0);
        } finally {
            fs.writeFileSync(COMMITTED, original, 'utf-8');
        }
    });
});
