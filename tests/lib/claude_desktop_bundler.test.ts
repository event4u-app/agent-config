/**
 * Vitest twin of `tests/test_claude_desktop_bundler.py` (17 tests, 1:1)
 * plus a differential suite comparing the TS port against the Python
 * original (`src/scripts/_lib/claude_desktop_bundler.py`) on a synthetic
 * fixture tree: generated bundle file LIST + per-file ZIP contents must
 * be identical, and Python's `zipfile` must be able to read the
 * TS-generated archives (cross-validates `zip_min.ts` against the
 * reference implementation). ADR-088 parity gates 1 + 2.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    build_command_bundles,
    build_skill_bundles,
} from '../../src/scripts/_lib/claude_desktop_bundler.js';
import { zip_read_sync } from '../../src/scripts/_lib/zip_min.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

let tmp_path: string;

beforeEach(() => {
    tmp_path = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-bundler-'));
});

afterEach(() => {
    fs.rmSync(tmp_path, { recursive: true, force: true });
});

function _zip_namelist(zip_path: string): string[] {
    return zip_read_sync(fs.readFileSync(zip_path)).map((e) => e.name);
}

function _zip_entry_text(zip_path: string, name: string): string {
    const entry = zip_read_sync(fs.readFileSync(zip_path)).find((e) => e.name === name);
    if (!entry) {
        throw new Error(`entry '${name}' not found in ${zip_path}`);
    }
    return entry.data.toString('utf-8');
}

/** Create a fake skill folder under `<package_root>/dist/agent-src/skills/`. */
function _make_skill(
    package_root: string,
    name: string,
    opts: { skill_md?: string; extras?: Record<string, string>; junk?: Record<string, string> } = {},
): string {
    const skill_dir = path.join(package_root, 'dist/agent-src', 'skills', name);
    fs.mkdirSync(skill_dir, { recursive: true });
    fs.writeFileSync(path.join(skill_dir, 'SKILL.md'), opts.skill_md ?? '# skill\n', 'utf-8');
    for (const [rel, content] of Object.entries({ ...(opts.extras ?? {}), ...(opts.junk ?? {}) })) {
        const target = path.join(skill_dir, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf-8');
    }
    return skill_dir;
}

/** Create a fake command file under `<package_root>/dist/agent-src/commands/`. */
function _make_command(package_root: string, rel_path: string, body = '# command\n'): string {
    const target = path.join(package_root, 'dist/agent-src', 'commands', rel_path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf-8');
    return target;
}

describe('build_skill_bundles', () => {
    it('test_bundle_generated_for_single_skill', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_skill(pkg, 'demo-skill', { skill_md: '# demo\n', extras: { 'helper.py': 'x = 1\n' } });
        const dest = path.join(tmp_path, 'bundles');

        const written = build_skill_bundles(pkg, dest);

        const zip_path = path.join(dest, 'demo-skill.zip');
        const sha_path = path.join(dest, 'demo-skill.sha256');
        expect(written).toEqual([zip_path]);
        expect(fs.existsSync(zip_path)).toBe(true);
        expect(fs.existsSync(sha_path)).toBe(true);
        expect(_zip_namelist(zip_path).sort()).toEqual(['SKILL.md', 'helper.py']);
    });

    it('test_excludes_pycache_and_dotgit', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_skill(pkg, 'noisy-skill', {
            extras: { 'keep.md': 'ok\n' },
            junk: {
                '__pycache__/cache.pyc': 'binary',
                '__pycache__/nested.txt': 'trash',
                '.gitignore': '*.log\n',
                'stale.pyc': 'compiled',
            },
        });
        const dest = path.join(tmp_path, 'bundles');

        build_skill_bundles(pkg, dest);

        expect(_zip_namelist(path.join(dest, 'noisy-skill.zip')).sort()).toEqual(['SKILL.md', 'keep.md']);
    });

    it('test_idempotent_second_call_writes_nothing', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_skill(pkg, 'stable-skill');
        const dest = path.join(tmp_path, 'bundles');

        const first = build_skill_bundles(pkg, dest);
        const zip_mtime_first = fs.statSync(path.join(dest, 'stable-skill.zip'), { bigint: true }).mtimeNs;

        const second = build_skill_bundles(pkg, dest);
        const zip_mtime_second = fs.statSync(path.join(dest, 'stable-skill.zip'), { bigint: true }).mtimeNs;

        expect(first.length).toBe(1);
        expect(second).toEqual([]);
        expect(zip_mtime_first).toBe(zip_mtime_second);
    });

    it('test_content_change_rewrites_bundle', () => {
        const pkg = path.join(tmp_path, 'pkg');
        const skill_dir = _make_skill(pkg, 'evolving');
        const dest = path.join(tmp_path, 'bundles');
        build_skill_bundles(pkg, dest);

        fs.writeFileSync(path.join(skill_dir, 'SKILL.md'), '# v2\n', 'utf-8');
        const written = build_skill_bundles(pkg, dest);

        expect(written).toEqual([path.join(dest, 'evolving.zip')]);
        expect(_zip_entry_text(path.join(dest, 'evolving.zip'), 'SKILL.md')).toBe('# v2\n');
    });

    it('test_force_rewrites_unchanged_bundle', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_skill(pkg, 'force-me');
        const dest = path.join(tmp_path, 'bundles');
        build_skill_bundles(pkg, dest);

        const written = build_skill_bundles(pkg, dest, true);
        expect(written).toEqual([path.join(dest, 'force-me.zip')]);
    });

    it('test_skill_without_skill_md_is_skipped', () => {
        const pkg = path.join(tmp_path, 'pkg');
        const not_a_skill = path.join(pkg, 'dist/agent-src', 'skills', 'orphan');
        fs.mkdirSync(not_a_skill, { recursive: true });
        fs.writeFileSync(path.join(not_a_skill, 'notes.md'), 'no SKILL.md here\n', 'utf-8');
        const dest = path.join(tmp_path, 'bundles');

        const written = build_skill_bundles(pkg, dest);

        expect(written).toEqual([]);
        expect(fs.existsSync(path.join(dest, 'orphan.zip'))).toBe(false);
    });

    it('test_missing_skills_dir_returns_empty', () => {
        const pkg = path.join(tmp_path, 'empty-pkg');
        fs.mkdirSync(pkg);
        const dest = path.join(tmp_path, 'bundles');

        const written = build_skill_bundles(pkg, dest);
        expect(written).toEqual([]);
        expect(!fs.existsSync(dest) || fs.readdirSync(dest).length === 0).toBe(true);
    });

    it('test_curation_restricts_to_named_skills', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_skill(pkg, 'alpha');
        _make_skill(pkg, 'beta');
        _make_skill(pkg, 'gamma');
        const dest = path.join(tmp_path, 'bundles');

        const written = build_skill_bundles(pkg, dest, false, ['alpha', 'gamma']);

        const bundle_names = written.map((p) => path.basename(p)).sort();
        expect(bundle_names).toEqual(['alpha.zip', 'gamma.zip']);
        expect(fs.existsSync(path.join(dest, 'beta.zip'))).toBe(false);
    });
});

describe('build_command_bundles', () => {
    it('test_command_bundle_generated_for_top_level_command', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_command(pkg, 'commit.md', '# /commit\n\nDo the commit thing.\n');
        const dest = path.join(tmp_path, 'bundles');

        const written = build_command_bundles(pkg, dest);

        const zip_path = path.join(dest, 'commit.zip');
        expect(written).toEqual([zip_path]);
        expect(fs.existsSync(zip_path)).toBe(true);
        expect(fs.existsSync(path.join(dest, 'commit.sha256'))).toBe(true);
        expect(_zip_namelist(zip_path).sort()).toEqual(['SKILL.md']);
        expect(_zip_entry_text(zip_path, 'SKILL.md')).toBe('# /commit\n\nDo the commit thing.\n');
    });

    it('test_nested_command_flattens_slug', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_command(pkg, 'council/default.md', '# council default\n');
        _make_command(pkg, 'council/pr.md', '# council pr\n');
        const dest = path.join(tmp_path, 'bundles');

        const written = build_command_bundles(pkg, dest);

        const names = written.map((p) => path.basename(p)).sort();
        expect(names).toEqual(['council-default.zip', 'council-pr.zip']);
    });

    it('test_command_skips_cluster_agents_md', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_command(pkg, 'council/AGENTS.md', '# cluster doc\n');
        _make_command(pkg, 'council/default.md', '# default\n');
        const dest = path.join(tmp_path, 'bundles');

        const written = build_command_bundles(pkg, dest);

        expect(written.map((p) => path.basename(p))).toEqual(['council-default.zip']);
        expect(fs.existsSync(path.join(dest, 'council-AGENTS.zip'))).toBe(false);
    });

    it('test_command_skipped_when_skill_with_same_name_exists', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_skill(pkg, 'condense', { skill_md: '# real skill\n' });
        _make_command(pkg, 'condense.md', '# command shadow\n');
        _make_command(pkg, 'research.md', '# research\n');
        const dest = path.join(tmp_path, 'bundles');

        const written = build_command_bundles(pkg, dest);

        const names = written.map((p) => path.basename(p)).sort();
        expect(names).toEqual(['research.zip']);
        expect(fs.existsSync(path.join(dest, 'condense.zip'))).toBe(false);
    });

    it('test_command_bundle_idempotent_second_call', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_command(pkg, 'stable.md');
        const dest = path.join(tmp_path, 'bundles');

        const first = build_command_bundles(pkg, dest);
        const mtime_first = fs.statSync(path.join(dest, 'stable.zip'), { bigint: true }).mtimeNs;
        const second = build_command_bundles(pkg, dest);
        const mtime_second = fs.statSync(path.join(dest, 'stable.zip'), { bigint: true }).mtimeNs;

        expect(first.length).toBe(1);
        expect(second).toEqual([]);
        expect(mtime_first).toBe(mtime_second);
    });

    it('test_command_force_rewrites_unchanged_bundle', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_command(pkg, 'force-me.md');
        const dest = path.join(tmp_path, 'bundles');
        build_command_bundles(pkg, dest);

        const written = build_command_bundles(pkg, dest, true);
        expect(written).toEqual([path.join(dest, 'force-me.zip')]);
    });

    it('test_command_content_change_rewrites_bundle', () => {
        const pkg = path.join(tmp_path, 'pkg');
        const source = _make_command(pkg, 'evolving.md', '# v1\n');
        const dest = path.join(tmp_path, 'bundles');
        build_command_bundles(pkg, dest);

        fs.writeFileSync(source, '# v2\n', 'utf-8');
        const written = build_command_bundles(pkg, dest);

        expect(written).toEqual([path.join(dest, 'evolving.zip')]);
        expect(_zip_entry_text(path.join(dest, 'evolving.zip'), 'SKILL.md')).toBe('# v2\n');
    });

    it('test_command_missing_dir_returns_empty', () => {
        const pkg = path.join(tmp_path, 'empty-pkg');
        fs.mkdirSync(pkg);
        const dest = path.join(tmp_path, 'bundles');

        const written = build_command_bundles(pkg, dest);
        expect(written).toEqual([]);
        expect(!fs.existsSync(dest) || fs.readdirSync(dest).length === 0).toBe(true);
    });

    it('test_command_curation_restricts_to_named_slugs', () => {
        const pkg = path.join(tmp_path, 'pkg');
        _make_command(pkg, 'alpha.md');
        _make_command(pkg, 'beta.md');
        _make_command(pkg, 'gamma.md');
        const dest = path.join(tmp_path, 'bundles');

        const written = build_command_bundles(pkg, dest, false, ['alpha', 'gamma']);

        const names = written.map((p) => path.basename(p)).sort();
        expect(names).toEqual(['alpha.zip', 'gamma.zip']);
        expect(fs.existsSync(path.join(dest, 'beta.zip'))).toBe(false);
    });
});

// ─── differential parity vs the Python original ────────────────────────────────

function python_available(): boolean {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Runs the Python bundler into `dest_py`, then reads BOTH bundle dirs
 * (Python's via zipfile, TS's via zipfile too — cross-validating the
 * `zip_min.ts` container format against the reference implementation)
 * and prints a JSON manifest of {zip name -> {entry -> b64 content}}.
 */
const PY_BUNDLER_DRIVER = `
import base64, json, pathlib, sys, zipfile
sys.path.insert(0, "src")
from scripts._lib import claude_desktop_bundler as bundler

pkg = pathlib.Path(sys.argv[1])
dest_py = pathlib.Path(sys.argv[2])
dest_ts = pathlib.Path(sys.argv[3])

written_skills = bundler.build_skill_bundles(pkg, dest_py)
written_commands = bundler.build_command_bundles(pkg, dest_py)

def manifest(dest: pathlib.Path) -> dict:
    out = {}
    for zip_path in sorted(dest.glob("*.zip")):
        with zipfile.ZipFile(zip_path) as zf:
            out[zip_path.name] = {
                name: base64.b64encode(zf.read(name)).decode("ascii")
                for name in sorted(zf.namelist())
            }
    return out

print(json.dumps({
    "written": sorted(p.name for p in written_skills + written_commands),
    "py_manifest": manifest(dest_py),
    "ts_manifest_read_by_python": manifest(dest_ts),
}))
`;

describe.skipIf(!python_available())('differential: TS twin vs Python original', () => {
    it('bundle list + per-file ZIP contents are identical on a synthetic tree', () => {
        const pkg = path.join(tmp_path, 'pkg');
        // Skills: nested dirs, junk to exclude, a SKILL.md-less folder, unicode content.
        _make_skill(pkg, 'alpha-skill', {
            skill_md: '# alpha\n',
            extras: {
                'helper.py': 'x = 1\n',
                'nested/deep/data.json': '{"k": "v"}\n',
                'notes/unicode.md': 'ümläut — em-dash\n',
            },
            junk: {
                '__pycache__/cache.pyc': 'junk',
                '.gitignore': '*.log\n',
                'stale.pyo': 'junk',
                '.DS_Store': 'junk',
            },
        });
        _make_skill(pkg, 'beta-skill', { skill_md: '# beta\n' });
        const orphan = path.join(pkg, 'dist/agent-src', 'skills', 'orphan');
        fs.mkdirSync(orphan, { recursive: true });
        fs.writeFileSync(path.join(orphan, 'notes.md'), 'no SKILL.md\n', 'utf-8');
        // Commands: top-level, nested cluster, AGENTS.md doc, skill-colliding slug.
        _make_command(pkg, 'commit.md', '# /commit\n');
        _make_command(pkg, 'council/default.md', '# council default\n');
        _make_command(pkg, 'council/AGENTS.md', '# cluster doc\n');
        _make_command(pkg, 'beta-skill.md', '# shadowed by the real skill\n');

        const dest_ts = path.join(tmp_path, 'bundles-ts');
        const written_ts = [
            ...build_skill_bundles(pkg, dest_ts),
            ...build_command_bundles(pkg, dest_ts),
        ]
            .map((p) => path.basename(p))
            .sort();

        const dest_py = path.join(tmp_path, 'bundles-py');
        const py = JSON.parse(
            execFileSync('python3', ['-c', PY_BUNDLER_DRIVER, pkg, dest_py, dest_ts], {
                cwd: ROOT,
                maxBuffer: 64 * 1024 * 1024,
                encoding: 'utf-8',
            }),
        ) as {
            written: string[];
            py_manifest: Record<string, Record<string, string>>;
            ts_manifest_read_by_python: Record<string, Record<string, string>>;
        };

        // 1. Same set of written bundles.
        expect(written_ts).toEqual(py.written);

        // 2. Same zip file list on disk (zips + sha256 sidecars).
        const ls = (d: string): string[] => fs.readdirSync(d).sort();
        expect(ls(dest_ts)).toEqual(ls(dest_py));

        // 3. TS zips, read by the TS reader, match the Python manifest
        //    entry-for-entry and byte-for-byte.
        const ts_manifest: Record<string, Record<string, string>> = {};
        for (const name of ls(dest_ts).filter((n) => n.endsWith('.zip'))) {
            const entries = zip_read_sync(fs.readFileSync(path.join(dest_ts, name)));
            ts_manifest[name] = Object.fromEntries(
                entries
                    .map((e) => [e.name, e.data.toString('base64')] as const)
                    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
            );
        }
        expect(ts_manifest).toEqual(py.py_manifest);

        // 4. Python's zipfile can read the TS-generated archives and sees
        //    the same contents (validates the zip_min container format).
        expect(py.ts_manifest_read_by_python).toEqual(py.py_manifest);

        // 5. The sha256 sidecars are identical (manifest digest parity).
        for (const name of ls(dest_ts).filter((n) => n.endsWith('.sha256'))) {
            expect(fs.readFileSync(path.join(dest_ts, name), 'utf-8')).toBe(
                fs.readFileSync(path.join(dest_py, name), 'utf-8'),
            );
        }
    });
});
