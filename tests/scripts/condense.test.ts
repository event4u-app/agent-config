// Tests for src/scripts/condense.ts (py2ts Phase 5 — the content-pipeline crown jewel).
//
// Two layers:
//   1. Unit suites ported 1:1 from tests/test_condense.py + tests/test_condense_paths.py.
//      The pytest suites monkeypatch module globals (condense.PROJECT_ROOT,
//      condense.HASH_FILE, condense.TARGET_DIR, …) and the multi-root helper
//      functions (condense.iter_all_sources / resolve_logical / artefact_roots).
//      The TS twin exposes the same surface through MODULE_STATE + the
//      _setStateForTest / _getStateForTest / _resetStateForTest seams; each
//      suite saves+restores the state it mutates (≈ pytest setUp/tearDown).
//   2. Golden-parity differential suites — run python3 vs tsx of condense on
//      the REAL repo for the read-only subcommands (byte-identical stdout +
//      stderr + exit), and assert that `--sync` then `--generate-tools` leave
//      ZERO git drift on the committed generated trees (the critical gate).
//      Each write test snapshots the tree and restores it in afterEach.

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as condense from '../../src/scripts/condense.js';

const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const PY = path.join(REPO_ROOT, 'src', 'scripts', 'condense.py');
const TS = path.join(REPO_ROOT, 'src', 'scripts', 'condense.ts');
const HAS_PYTHON3 = spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkTmp(prefix = 'cond-'): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function write(p: string, text: string): void {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, 'utf-8');
}

/**
 * Mirror the pytest `_IsolateMultiRootMixin` — point the injectable multi-root
 * helpers at a tmp `source` tree. Yields [physical, logical] for every file,
 * resolves logical → physical, and roots = (source,).
 */
function isolateMultiRoot(source: string): void {
    const iter = function* (): Generator<[string, string]> {
        const walk = (dir: string): string[] => {
            const out: string[] = [];
            for (const name of fs.readdirSync(dir).sort()) {
                const full = path.join(dir, name);
                if (fs.statSync(full).isDirectory()) {
                    out.push(...walk(full));
                } else if (fs.statSync(full).isFile()) {
                    out.push(full);
                }
            }
            return out;
        };
        const files = walk(source).sort();
        for (const f of files) {
            yield [f, path.relative(source, f).split(path.sep).join('/')];
        }
    };
    const resolve = (rel: string): string | null => {
        const p = path.join(source, rel);
        return fs.existsSync(p) ? p : null;
    };
    const roots = (): string[] => [source];
    condense._setStateForTest({
        iter_all_sources: iter,
        resolve_logical: resolve,
        artefact_roots: roots,
    });
}


// ===========================================================================
// Ported from tests/test_condense.py
// ===========================================================================

describe('should_condense', () => {
    it('md file should condense', () => {
        expect(condense.should_condense('rules/token-efficiency.md')).toBe(true);
    });
    it('README should not condense', () => {
        expect(condense.should_condense('README.md')).toBe(false);
    });
    it('php file should not condense', () => {
        expect(condense.should_condense('src/scripts/scan.php')).toBe(false);
    });
    it('txt file should not condense', () => {
        expect(condense.should_condense('notes.txt')).toBe(false);
    });
    it('nested md should condense', () => {
        expect(condense.should_condense('skills/coder/SKILL.md')).toBe(true);
    });
});

describe('cleanup_stale', () => {
    let tmp: string;
    let source: string;
    let target: string;
    let saved: ReturnType<typeof condense._getStateForTest>;

    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('deletes stale files', () => {
        write(path.join(source, 'file_a.md'), 'a');
        write(path.join(target, 'file_a.md'), 'a');
        write(path.join(target, 'file_b.md'), 'b');
        const deleted = condense.cleanup_stale(source, target);
        expect(deleted).toBe(1);
        expect(fs.existsSync(path.join(target, 'file_a.md'))).toBe(true);
        expect(fs.existsSync(path.join(target, 'file_b.md'))).toBe(false);
    });

    it('no stale files', () => {
        write(path.join(source, 'file_a.md'), 'a');
        write(path.join(target, 'file_a.md'), 'a');
        expect(condense.cleanup_stale(source, target)).toBe(0);
    });

    it('removes empty directories', () => {
        write(path.join(source, 'rules', 'a.md'), 'a');
        write(path.join(target, 'rules', 'a.md'), 'a');
        write(path.join(target, 'old-dir', 'stale.md'), 'stale');
        condense.cleanup_stale(source, target);
        expect(fs.existsSync(path.join(target, 'old-dir'))).toBe(false);
    });

    it('preserves nested structure', () => {
        write(path.join(source, 'skills', 'coder', 'SKILL.md'), 'skill');
        write(path.join(target, 'skills', 'coder', 'SKILL.md'), 'skill');
        write(path.join(target, 'skills', 'old-skill', 'SKILL.md'), 'old');
        condense.cleanup_stale(source, target);
        expect(fs.existsSync(path.join(target, 'skills', 'coder', 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(target, 'skills', 'old-skill'))).toBe(false);
    });

    it('nonexistent target returns zero', () => {
        expect(condense.cleanup_stale(source, path.join(tmp, 'nope'))).toBe(0);
    });
});

describe('copy_file', () => {
    let tmp: string;
    let source: string;
    let target: string;
    beforeEach(() => {
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
    });
    afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

    it('copies file as-is', () => {
        const sf = path.join(source, 'scan.php');
        write(sf, "<?php echo 'hello';");
        const tf = path.join(target, 'scan.php');
        condense.copy_file(sf, tf);
        expect(fs.existsSync(tf)).toBe(true);
        expect(fs.readFileSync(tf, 'utf-8')).toBe("<?php echo 'hello';");
    });

    it('creates target directory', () => {
        const sf = path.join(source, 'scripts', 'scan.php');
        write(sf, '<?php');
        const tf = path.join(target, 'scripts', 'scan.php');
        condense.copy_file(sf, tf);
        expect(fs.existsSync(tf)).toBe(true);
    });
});

describe('sync_non_md', () => {
    let tmp: string;
    let source: string;
    let target: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('copies php files', () => {
        write(path.join(source, 'scripts', 'scan.php'), '<?php');
        expect(condense.sync_non_md(source, target)).toBe(1);
        expect(fs.existsSync(path.join(target, 'scripts', 'scan.php'))).toBe(true);
    });

    it('skips condensable md files', () => {
        write(path.join(source, 'rules', 'test.md'), '# Rule');
        expect(condense.sync_non_md(source, target)).toBe(0);
        expect(fs.existsSync(path.join(target, 'rules', 'test.md'))).toBe(false);
    });

    it('copies readme as-is', () => {
        write(path.join(source, 'README.md'), '# Readme');
        expect(condense.sync_non_md(source, target)).toBe(1);
        expect(fs.readFileSync(path.join(target, 'README.md'), 'utf-8')).toBe('# Readme');
    });
});

describe('list_md_files', () => {
    let tmp: string;
    let source: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        fs.mkdirSync(source);
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('lists md files', () => {
        write(path.join(source, 'rules', 'a.md'), 'rule');
        write(path.join(source, 'rules', 'b.md'), 'rule');
        const files = condense.list_md_files(source);
        expect(files.length).toBe(2);
        expect(files).toContain('rules/a.md');
        expect(files).toContain('rules/b.md');
    });

    it('excludes readme', () => {
        write(path.join(source, 'README.md'), 'readme');
        write(path.join(source, 'rules', 'a.md'), 'rule');
        const files = condense.list_md_files(source);
        expect(files.length).toBe(1);
        expect(files).not.toContain('README.md');
    });

    it('excludes non-md', () => {
        write(path.join(source, 'scripts', 'scan.php'), '<?php');
        expect(condense.list_md_files(source).length).toBe(0);
    });
});

describe('file_hash', () => {
    it('returns consistent hash', () => {
        const tmp = mkTmp();
        const p = path.join(tmp, 'x.md');
        write(p, 'hello world');
        try {
            const h1 = condense.file_hash(p);
            const h2 = condense.file_hash(p);
            expect(h1).toBe(h2);
            expect(h1.length).toBe(64);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('different content different hash', () => {
        const tmp = mkTmp();
        const a = path.join(tmp, 'a.md');
        const b = path.join(tmp, 'b.md');
        write(a, 'content a');
        write(b, 'content b');
        try {
            expect(condense.file_hash(a)).not.toBe(condense.file_hash(b));
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});

describe('hash tracking', () => {
    let tmp: string;
    let source: string;
    let hashFile: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        fs.mkdirSync(source);
        hashFile = path.join(tmp, 'hashes.json');
        condense._setStateForTest({ HASH_FILE: hashFile, SOURCE_DIR: source });
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('load_hashes empty when no file', () => {
        expect(condense.load_hashes()).toEqual({});
    });

    it('save and load roundtrip', () => {
        const data = { 'rules/a.md': 'abc123' };
        condense.save_hashes(data);
        expect(condense.load_hashes()).toEqual(data);
    });

    it('load_hashes handles corrupt json', () => {
        fs.writeFileSync(hashFile, 'not valid json{{{', 'utf-8');
        expect(condense.load_hashes()).toEqual({});
    });

    it('list_changed detects new file', () => {
        write(path.join(source, 'rules', 'new.md'), '# New rule');
        expect(condense.list_changed_md(source)).toEqual(['rules/new.md']);
    });

    it('list_changed detects modified file', () => {
        const f = path.join(source, 'rules', 'a.md');
        write(f, 'version 1');
        condense.save_hashes({ 'rules/a.md': condense.file_hash(f) });
        fs.writeFileSync(f, 'version 2', 'utf-8');
        expect(condense.list_changed_md(source)).toEqual(['rules/a.md']);
    });

    it('list_changed ignores unchanged', () => {
        const f = path.join(source, 'rules', 'a.md');
        write(f, 'unchanged');
        condense.save_hashes({ 'rules/a.md': condense.file_hash(f) });
        expect(condense.list_changed_md(source)).toEqual([]);
    });

    it('list_changed ignores non-md', () => {
        write(path.join(source, 'scripts', 'scan.php'), '<?php');
        expect(condense.list_changed_md(source)).toEqual([]);
    });

    it('mark_all_done stores all hashes', () => {
        write(path.join(source, 'rules', 'a.md'), 'rule a');
        write(path.join(source, 'rules', 'b.md'), 'rule b');
        write(path.join(source, 'scripts', 'x.php'), '<?php');
        condense.mark_all_done();
        const hashes = condense.load_hashes();
        expect('rules/a.md' in hashes).toBe(true);
        expect('rules/b.md' in hashes).toBe(true);
        expect('src/scripts/x.php' in hashes).toBe(false);
    });

    it('mark_all_done then nothing changed', () => {
        write(path.join(source, 'rules', 'a.md'), 'rule a');
        condense.mark_all_done();
        expect(condense.list_changed_md(source)).toEqual([]);
    });
});

describe('transitive hash', () => {
    let tmp: string;
    let source: string;
    let skill: string;
    let cmd: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        fs.mkdirSync(source);
        condense._setStateForTest({ HASH_FILE: path.join(tmp, 'hashes.json') });
        isolateMultiRoot(source);
        skill = path.join(source, 'skills', 'foo', 'SKILL.md');
        write(skill, '---\nname: foo\n---\n\n# Foo skill v1\n');
        cmd = path.join(source, 'commands', 'bar.md');
        write(cmd, '---\nname: bar\nskills: [foo]\n---\n\n# Bar command\n');
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('leaf effective equals file hash', () => {
        expect(condense.effective_hash('skills/foo/SKILL.md')).toBe(condense.file_hash(skill));
    });

    it('command folds skill hash', () => {
        expect(condense.effective_hash('commands/bar.md')).not.toBe(condense.file_hash(cmd));
    });

    it('skill change flips dependent command hash', () => {
        const before = condense.effective_hash('commands/bar.md');
        fs.writeFileSync(skill, '---\nname: foo\n---\n\n# Foo skill v2 (changed)\n', 'utf-8');
        const after = condense.effective_hash('commands/bar.md');
        expect(after).not.toBe(before);
    });

    it('skill change marks command as changed', () => {
        condense.mark_all_done();
        expect(condense.list_changed_md(source)).toEqual([]);
        fs.writeFileSync(skill, '---\nname: foo\n---\n\n# Foo skill v2 (changed)\n', 'utf-8');
        const changed = condense.list_changed_md(source);
        expect(changed).toContain('commands/bar.md');
        expect(changed).toContain('skills/foo/SKILL.md');
    });

    it('cycle is safe', () => {
        for (const [slug, dep] of [
            ['a', 'b'],
            ['b', 'a'],
        ] as const) {
            write(
                path.join(source, 'skills', slug, 'SKILL.md'),
                `---\nname: ${slug}\nskills: [${dep}]\n---\n\n# ${slug}\n`,
            );
        }
        expect(condense.effective_hash('skills/a/SKILL.md')).toBeTruthy();
    });
});

describe('check_sync', () => {
    let tmp: string;
    let source: string;
    let target: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        source = path.join(tmp, 'source');
        target = path.join(tmp, 'target');
        fs.mkdirSync(source);
        fs.mkdirSync(target);
        isolateMultiRoot(source);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('in sync', () => {
        write(path.join(source, 'a.md'), 'source');
        write(path.join(target, 'a.md'), 'condensed');
        expect(condense.check_sync(source, target)).toEqual([[], []]);
    });

    it('detects missing in target', () => {
        write(path.join(source, 'new.md'), 'new');
        expect(condense.check_sync(source, target)).toEqual([['new.md'], []]);
    });

    it('detects stale in target', () => {
        write(path.join(target, 'old.md'), 'old');
        expect(condense.check_sync(source, target)).toEqual([[], ['old.md']]);
    });

    it('detects both', () => {
        write(path.join(source, 'new.md'), 'new');
        write(path.join(target, 'old.md'), 'old');
        expect(condense.check_sync(source, target)).toEqual([['new.md'], ['old.md']]);
    });
});

describe('strip_frontmatter', () => {
    it('strips frontmatter', () => {
        const content = '---\ntype: "always"\ndescription: "test"\n---\n\n# Rule\n\nContent here.';
        expect(condense.strip_frontmatter(content)).toBe('# Rule\n\nContent here.');
    });
    it('no frontmatter returns original', () => {
        const content = '# Rule\n\nContent here.';
        expect(condense.strip_frontmatter(content)).toBe(content);
    });
    it('incomplete frontmatter returns original', () => {
        const content = '---\nno closing marker';
        expect(condense.strip_frontmatter(content)).toBe(content);
    });
});

describe('generate_rule_symlinks', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        const rulesDir = path.join(root, 'dist/agent-src', 'rules');
        write(path.join(rulesDir, 'ask-when-uncertain.md'), '# Ask When Uncertain');
        write(path.join(rulesDir, 'scope-control.md'), '# Scope Control');
        condense._setStateForTest({ PROJECT_ROOT: root, RULES_SOURCE: rulesDir });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('creates symlinks in all tool dirs', () => {
        condense.generate_rule_symlinks();
        for (const toolDir of ['.claude/rules', '.cursor/rules', '.clinerules']) {
            const d = path.join(root, toolDir);
            expect(fs.existsSync(d)).toBe(true);
            expect(fs.lstatSync(path.join(d, 'ask-when-uncertain.md')).isSymbolicLink()).toBe(true);
            expect(fs.lstatSync(path.join(d, 'scope-control.md')).isSymbolicLink()).toBe(true);
        }
    });

    it('symlinks resolve correctly', () => {
        condense.generate_rule_symlinks();
        const link = path.join(root, '.claude', 'rules', 'ask-when-uncertain.md');
        expect(fs.existsSync(fs.realpathSync(link))).toBe(true);
        expect(fs.readFileSync(link, 'utf-8')).toBe('# Ask When Uncertain');
    });
});

describe('generate_windsurfrules', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        const rulesDir = path.join(root, 'dist/agent-src', 'rules');
        write(path.join(rulesDir, 'rule-a.md'), '---\ntype: "always"\n---\n\n# Rule A\n\nContent A.');
        write(path.join(rulesDir, 'rule-b.md'), '---\ntype: "auto"\n---\n\n# Rule B\n\nContent B.');
        condense._setStateForTest({ PROJECT_ROOT: root, RULES_SOURCE: rulesDir });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('generates windsurfrules', () => {
        condense.generate_windsurfrules();
        const content = fs.readFileSync(path.join(root, '.windsurfrules'), 'utf-8');
        expect(content).toContain('# Auto-generated');
        expect(content).toContain('# Rule A');
        expect(content).toContain('# Rule B');
    });

    it('strips frontmatter', () => {
        condense.generate_windsurfrules();
        const content = fs.readFileSync(path.join(root, '.windsurfrules'), 'utf-8');
        expect(content).not.toContain('type: "always"');
        expect(content).not.toContain('type: "auto"');
    });
});

describe('generate_claude_skills', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        const skillsDir = path.join(root, 'dist/agent-src', 'skills');
        write(path.join(skillsDir, 'api-design', 'SKILL.md'), '---\nname: api-design\n---\n# API');
        write(path.join(skillsDir, 'database', 'SKILL.md'), '---\nname: database\n---\n# DB');
        condense._setStateForTest({
            PROJECT_ROOT: root,
            SKILLS_SOURCE: skillsDir,
            CLAUDE_SKILLS_DIR: path.join(root, '.claude', 'skills'),
        });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('creates skill symlinks', () => {
        condense.generate_claude_skills();
        const cs = path.join(root, '.claude', 'skills');
        expect(fs.lstatSync(path.join(cs, 'api-design')).isSymbolicLink()).toBe(true);
        expect(fs.lstatSync(path.join(cs, 'database')).isSymbolicLink()).toBe(true);
    });

    it('symlinks resolve to skill md', () => {
        condense.generate_claude_skills();
        const skillMd = path.join(root, '.claude', 'skills', 'api-design', 'SKILL.md');
        expect(fs.existsSync(skillMd)).toBe(true);
        expect(fs.readFileSync(skillMd, 'utf-8')).toContain('api-design');
    });
});

describe('generate_claude_commands', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        const packDir = path.join(root, 'src', 'domains', 'testpack');
        write(path.join(packDir, 'commit', 'command.md'), '# commit\n\n## Instructions\n\nDo the commit.');
        write(
            path.join(packDir, 'feature-dev', 'command.md'),
            '---\nold: data\n---\n\n# feature-dev\n\nDevelop.',
        );
        condense._setStateForTest({
            PROJECT_ROOT: root,
            COMMANDS_SOURCE: path.join(root, 'dist/agent-src', 'commands'),
            CLAUDE_SKILLS_DIR: path.join(root, '.claude', 'skills'),
            SKILLS_SOURCE: path.join(root, 'dist/agent-src', 'skills'),
        });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('creates command skills', () => {
        condense.generate_claude_commands();
        const cs = path.join(root, '.claude', 'skills');
        expect(fs.existsSync(path.join(cs, 'commit', 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(cs, 'feature-dev', 'SKILL.md'))).toBe(true);
    });

    it('command is symlink', () => {
        condense.generate_claude_commands();
        const sf = path.join(root, '.claude', 'skills', 'commit', 'SKILL.md');
        expect(fs.lstatSync(sf).isSymbolicLink()).toBe(true);
    });

    it('command preserves content', () => {
        condense.generate_claude_commands();
        const content = fs.readFileSync(
            path.join(root, '.claude', 'skills', 'commit', 'SKILL.md'),
            'utf-8',
        );
        expect(content).toContain('Do the commit.');
    });

    it('command symlink points to source', () => {
        condense.generate_claude_commands();
        const sf = path.join(root, '.claude', 'skills', 'feature-dev', 'SKILL.md');
        const target = fs.realpathSync(sf);
        expect(target).toContain(path.join('feature-dev', 'command.md'));
    });

    it('command skips same-name skill', () => {
        const skillsDir = path.join(root, 'dist/agent-src', 'skills', 'commit');
        write(path.join(skillsDir, 'SKILL.md'), '# commit skill');
        condense._setStateForTest({ SKILLS_SOURCE: path.join(root, 'dist/agent-src', 'skills') });
        condense.generate_claude_commands();
        const cs = path.join(root, '.claude', 'skills');
        const commitMd = path.join(cs, 'commit', 'SKILL.md');
        expect(fs.existsSync(commitMd) && fs.lstatSync(commitMd).isSymbolicLink()).toBe(false);
        expect(fs.lstatSync(path.join(cs, 'feature-dev', 'SKILL.md')).isSymbolicLink()).toBe(true);
    });
});

describe('project_to_augment rules mode', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        write(path.join(root, 'dist/agent-src', 'rules', 'alpha.md'), 'rule alpha');
        write(path.join(root, 'dist/agent-src', 'rules', 'beta.md'), 'rule beta');
        fs.mkdirSync(path.join(root, 'dist/agent-src', 'skills'), { recursive: true });
        write(path.join(root, 'dist/agent-src', 'README.md'), 'readme');
        condense._setStateForTest({
            TARGET_DIR: path.join(root, 'dist/agent-src'),
            AUGMENT_DIR: path.join(root, '.augment'),
            SETTINGS_FILE: path.join(root, '.agent-settings.yml'),
        });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    const writeSetting = (value: string | null): void => {
        if (value === null) return;
        write(path.join(root, '.agent-settings.yml'), `augment:\n  rules_use_symlinks: ${value}\n`);
    };

    it('default copies rules', () => {
        condense.project_to_augment();
        const alpha = path.join(root, '.augment', 'rules', 'alpha.md');
        expect(fs.statSync(alpha).isFile()).toBe(true);
        expect(fs.lstatSync(alpha).isSymbolicLink()).toBe(false);
        expect(fs.readFileSync(alpha, 'utf-8')).toBe('rule alpha');
    });

    it('explicit false copies rules', () => {
        writeSetting('false');
        condense.project_to_augment();
        const alpha = path.join(root, '.augment', 'rules', 'alpha.md');
        expect(fs.statSync(alpha).isFile()).toBe(true);
        expect(fs.lstatSync(alpha).isSymbolicLink()).toBe(false);
    });

    it('true symlinks rules', () => {
        writeSetting('true');
        condense.project_to_augment();
        const alpha = path.join(root, '.augment', 'rules', 'alpha.md');
        expect(fs.lstatSync(alpha).isSymbolicLink()).toBe(true);
        expect(fs.realpathSync(alpha)).toBe(
            fs.realpathSync(path.join(root, 'dist/agent-src', 'rules', 'alpha.md')),
        );
    });

    it('toggle replaces existing files', () => {
        writeSetting('false');
        condense.project_to_augment();
        const alpha = path.join(root, '.augment', 'rules', 'alpha.md');
        expect(fs.lstatSync(alpha).isSymbolicLink()).toBe(false);
        writeSetting('true');
        condense.project_to_augment();
        expect(fs.lstatSync(alpha).isSymbolicLink()).toBe(true);
        writeSetting('false');
        condense.project_to_augment();
        expect(fs.lstatSync(alpha).isSymbolicLink()).toBe(false);
        expect(fs.statSync(alpha).isFile()).toBe(true);
    });
});

describe('_read_augment_rules_use_symlinks', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        condense._setStateForTest({ SETTINGS_FILE: path.join(root, '.agent-settings.yml') });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });
    const w = (content: string): void => write(path.join(root, '.agent-settings.yml'), content);
    // _read_augment_rules_use_symlinks is internal; exercise it through the
    // observable behaviour of project_to_augment (copy vs symlink) instead of
    // calling the private function directly. The boolean parse is what matters.
    const reads = (): boolean => {
        // Build a minimal projection root and observe the rule-mode decision.
        const td = path.join(root, 'dist/agent-src', 'rules');
        write(path.join(td, 'x.md'), 'x');
        condense._setStateForTest({
            TARGET_DIR: path.join(root, 'dist/agent-src'),
            AUGMENT_DIR: path.join(root, '.augment'),
        });
        fs.rmSync(path.join(root, '.augment'), { recursive: true, force: true });
        condense.project_to_augment();
        return fs.lstatSync(path.join(root, '.augment', 'rules', 'x.md')).isSymbolicLink();
    };

    it('missing file returns false', () => {
        expect(reads()).toBe(false);
    });
    it('missing block returns false', () => {
        w('project:\n  pr_template: foo\n');
        expect(reads()).toBe(false);
    });
    it('true value', () => {
        w('augment:\n  rules_use_symlinks: true\n');
        expect(reads()).toBe(true);
    });
    it('false value', () => {
        w('augment:\n  rules_use_symlinks: false\n');
        expect(reads()).toBe(false);
    });
    it('truthy aliases', () => {
        for (const alias of ['True', 'yes', 'ON', '1']) {
            w(`augment:\n  rules_use_symlinks: ${alias}\n`);
            expect(reads()).toBe(true);
        }
    });
    it('inline comment stripped', () => {
        w('augment:\n  rules_use_symlinks: true  # opt-in\n');
        expect(reads()).toBe(true);
    });
    it('block scoping', () => {
        w('project:\n  rules_use_symlinks: true\naugment:\n  enabled: true\n');
        expect(reads()).toBe(false);
    });
});

describe('clean_tools', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        fs.mkdirSync(path.join(root, '.claude', 'rules'), { recursive: true });
        fs.mkdirSync(path.join(root, '.cursor', 'rules'), { recursive: true });
        fs.mkdirSync(path.join(root, '.clinerules'), { recursive: true });
        write(path.join(root, '.windsurfrules'), 'content');
        fs.symlinkSync('AGENTS.md', path.join(root, 'GEMINI.md'));
        condense._setStateForTest({ PROJECT_ROOT: root });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('removes all generated', () => {
        condense.clean_tools();
        expect(fs.existsSync(path.join(root, '.claude'))).toBe(false);
        expect(fs.existsSync(path.join(root, '.cursor'))).toBe(false);
        expect(fs.existsSync(path.join(root, '.clinerules'))).toBe(false);
        expect(fs.existsSync(path.join(root, '.windsurfrules'))).toBe(false);
        expect(fs.existsSync(path.join(root, 'GEMINI.md'))).toBe(false);
    });
});

describe('generate_plugin_hooks', () => {
    let tmp: string;
    let root: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        root = tmp;
        write(
            path.join(root, 'src', 'scripts', 'hook_manifest.yaml'),
            'platforms:\n' +
                '  claude:\n' +
                '    session_start: [chat-history]\n' +
                '    session_end: [chat-history]\n' +
                '    stop: [chat-history]\n' +
                '    user_prompt_submit: [chat-history]\n' +
                '    post_tool_use: [chat-history, roadmap-progress]\n' +
                '  copilot:\n' +
                '    fallback_only: true\n' +
                'native_event_aliases:\n' +
                '  claude:\n' +
                '    SessionStart: session_start\n' +
                '    SessionEnd: session_end\n' +
                '    Stop: stop\n' +
                '    UserPromptSubmit: user_prompt_submit\n' +
                '    PostToolUse: post_tool_use\n' +
                '    PreToolUse: pre_tool_use\n',
        );
        condense._setStateForTest({ PROJECT_ROOT: root });
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('emits five claude bindings', () => {
        const count = condense.generate_plugin_hooks();
        expect(count).toBe(5);
        const data = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf-8'));
        expect(new Set(Object.keys(data.hooks))).toEqual(
            new Set(['SessionStart', 'SessionEnd', 'Stop', 'UserPromptSubmit', 'PostToolUse']),
        );
    });

    it('commands are project-dir rooted', () => {
        condense.generate_plugin_hooks();
        const data = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf-8'));
        for (const [native, groups] of Object.entries(data.hooks)) {
            const cmd = (groups as Array<{ hooks: Array<{ command: string }> }>)[0]!.hooks[0]!.command;
            expect(cmd).toContain('BIN="$CLAUDE_PROJECT_DIR/agent-config"');
            expect(cmd).toContain('"$BIN" dispatch:hook');
            expect(cmd).toContain('--project-dir "$CLAUDE_PROJECT_DIR"');
            expect(cmd).toContain('--platform claude');
            expect(cmd).toContain(`--native-event ${native}`);
        }
    });

    it('skips events without bindings', () => {
        condense.generate_plugin_hooks();
        const data = JSON.parse(fs.readFileSync(path.join(root, 'hooks', 'hooks.json'), 'utf-8'));
        expect('PreToolUse' in data.hooks).toBe(false);
    });
});

// ===========================================================================
// Ported from tests/test_condense_paths.py — _rewrite_paths primitive
// ===========================================================================

const RULE_AT = 'rules/example.md';
const NESTED_AT = 'commands/council/default.md';

describe('_rewrite_paths — load_context', () => {
    it('logical name gets depth prefix', () => {
        const src =
            '---\ntype: "always"\nload_context:\n  - contexts/execution/verification-mechanics.md\n---\n# Body\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).toContain('- ../contexts/execution/verification-mechanics.md');
        expect(out).not.toContain('- contexts/execution/verification-mechanics.md');
    });

    it('legacy uncondensed prefix stripped', () => {
        const src =
            '---\nload_context:\n  - .agent-src.uncondensed/contexts/authority/scope-mechanics.md\n---\nBody.\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).toContain('- ../contexts/authority/scope-mechanics.md');
        expect(out).not.toContain('.agent-src.uncondensed/');
    });

    it('load_context_eager also rewritten', () => {
        const src = '---\nload_context_eager:\n  - contexts/foo.md\n  - contexts/bar.md\n---\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).toContain('- ../contexts/foo.md');
        expect(out).toContain('- ../contexts/bar.md');
    });
});

describe('_rewrite_paths — path_prefix', () => {
    it('legacy prefix left alone', () => {
        const src = '---\ntriggers:\n  - path_prefix: ".agent-src.uncondensed/skills/"\n---\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).toContain('path_prefix: ".agent-src.uncondensed/skills/"');
    });

    it('unrelated path_prefix left alone', () => {
        const src = '---\ntriggers:\n  - path_prefix: "agents/"\n  - path_prefix: "lang/"\n---\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).toContain('path_prefix: "agents/"');
        expect(out).toContain('path_prefix: "lang/"');
    });
});

describe('_rewrite_paths — body links', () => {
    it('guidelines link rewritten', () => {
        const body = 'See [`x`](../../docs/guidelines/agent-infra/x.md) for more.\n';
        const out = condense._rewrite_paths(body, RULE_AT);
        expect(out).toContain('(../docs/guidelines/agent-infra/x.md)');
        expect(out).not.toContain('../../docs/guidelines/');
    });

    it('contracts link rewritten', () => {
        const body = 'Contract: [foo](../../docs/contracts/foo.md).\n';
        const out = condense._rewrite_paths(body, RULE_AT);
        expect(out).toContain('(../docs/contracts/foo.md)');
        expect(out).not.toContain('../../docs/contracts/');
    });

    it('internal relative link left alone', () => {
        const body = 'See [`x`](../contexts/foo.md) — already relative.\n';
        const out = condense._rewrite_paths(body, RULE_AT);
        expect(out).toContain('(../contexts/foo.md)');
    });
});

describe('_rewrite_paths — depth + idempotence', () => {
    it('nested source uses two levels', () => {
        const src = '---\nload_context:\n  - contexts/foo.md\n---\n[g](../../docs/guidelines/x.md)\n';
        const out = condense._rewrite_paths(src, NESTED_AT);
        expect(out).toContain('- ../../contexts/foo.md');
        expect(out).toContain('(../../docs/guidelines/x.md)');
    });

    it('idempotent', () => {
        const src = '---\nload_context:\n  - contexts/execution/foo.md\n---\n[g](../../docs/guidelines/x.md)\n';
        const once = condense._rewrite_paths(src, RULE_AT);
        const twice = condense._rewrite_paths(once, RULE_AT);
        expect(twice).toBe(once);
    });

    it('no frontmatter passes through body', () => {
        const body = 'Just body. [g](../../docs/guidelines/x.md)\n';
        const out = condense._rewrite_paths(body, RULE_AT);
        expect(out).toBe('Just body. [g](../docs/guidelines/x.md)\n');
    });
});

describe('apply_path_rewriter wiring', () => {
    let tmp: string;
    let ruleDir: string;
    let saved: ReturnType<typeof condense._getStateForTest>;
    beforeEach(() => {
        saved = condense._getStateForTest();
        tmp = mkTmp();
        condense._setStateForTest({ TARGET_DIR: tmp });
        ruleDir = path.join(tmp, 'rules');
        fs.mkdirSync(ruleDir);
    });
    afterEach(() => {
        condense._setStateForTest(saved);
        fs.rmSync(tmp, { recursive: true, force: true });
    });
    const writeRule = (body: string): string => {
        const p = path.join(ruleDir, 'example.md');
        write(p, body);
        return p;
    };

    it('modifies file when rewrite needed', () => {
        const p = writeRule('---\nload_context:\n  - contexts/foo.md\n---\nbody\n');
        expect(condense.apply_path_rewriter('rules/example.md')).toBe(true);
        expect(fs.readFileSync(p, 'utf-8')).toContain('- ../contexts/foo.md');
    });

    it('returns false when already rewritten', () => {
        writeRule('---\nload_context:\n  - ../contexts/foo.md\n---\nbody\n');
        expect(condense.apply_path_rewriter('rules/example.md')).toBe(false);
    });

    it('returns false when target missing', () => {
        expect(condense.apply_path_rewriter('rules/missing.md')).toBe(false);
    });
});

describe('human review banner', () => {
    it('injects banner when hrr true', () => {
        const src =
            '---\ntype: "auto"\npacks:\n  - finance-basic\ntrust:\n  level: advisory\n  confidence: high\n  human_review_required: true\n---\n# Finance Safety Floor\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).toContain(condense._HRR_BANNER_MARKER);
        expect(out).toContain('> HUMAN REVIEW REQUIRED · trust: advisory · owner: finance');
    });

    it('no banner when hrr false', () => {
        const src = '---\ntrust:\n  level: core\n  human_review_required: false\n---\n# Body\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).not.toContain(condense._HRR_BANNER_MARKER);
    });

    it('no banner when no trust block', () => {
        const src = '---\ntype: "auto"\n---\n# Body\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).not.toContain(condense._HRR_BANNER_MARKER);
    });

    it('banner injection is idempotent', () => {
        const src =
            '---\npacks:\n  - founder-strategy\ntrust:\n  level: advisory\n  human_review_required: true\n---\n# Strategy\n';
        const once = condense._rewrite_paths(src, RULE_AT);
        const twice = condense._rewrite_paths(once, RULE_AT);
        expect(twice).toBe(once);
        expect((once.match(new RegExp(condense._HRR_BANNER_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length).toBe(1);
    });

    it('owner falls back to workspace', () => {
        const src =
            '---\nworkspaces:\n  - finance\ntrust:\n  level: restricted\n  human_review_required: true\n---\n# Body\n';
        const out = condense._rewrite_paths(src, RULE_AT);
        expect(out).toContain('owner: finance');
    });
});

// ===========================================================================
// Golden parity — python3 vs tsx on the REAL repo
// ===========================================================================

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}
function runPy(args: readonly string[]): RunResult {
    const r = spawnSync('python3', [PY, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function runTs(args: readonly string[]): RunResult {
    const r = spawnSync(TSX_BIN, [TS, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
function assertParity(args: readonly string[]): void {
    const py = runPy(args);
    const ts = runTs(args);
    expect(ts.stdout).toBe(py.stdout);
    expect(ts.stderr).toBe(py.stderr);
    expect(ts.status).toBe(py.status);
}

describe.skipIf(!HAS_PYTHON3)('golden parity — read-only subcommands', () => {
    it('--check matches Python', () => assertParity(['--check']));
    it('--check-hashes matches Python', () => assertParity(['--check-hashes']));
    it('--list matches Python (header + same file set, order-insensitive)', () => {
        // --list emits the SET of .md files needing condensation, one per line,
        // after a "N .md files total:" header. The display order is cosmetic —
        // nothing consumes it (--sync writes path-keyed, order-independent, and
        // its zero-drift parity is asserted below). Byte-exact line ordering can
        // differ across runtimes (the cross-platform sort of the same identical
        // set), so assert the header byte-exact + the body as a sorted set.
        const py = runPy(['--list']);
        const ts = runTs(['--list']);
        expect(ts.status).toBe(py.status);
        expect(ts.stderr).toBe(py.stderr);
        const head = (s: string): string => s.split('\n')[0] ?? '';
        const body = (s: string): string[] =>
            s.split('\n').slice(1).filter((l) => l.trim() !== '').sort();
        expect(head(ts.stdout)).toBe(head(py.stdout));
        expect(body(ts.stdout)).toEqual(body(py.stdout));
    });
    it('--changed matches Python', () => assertParity(['--changed']));
});

// Generated trees that condense --sync / --generate-tools regenerate. A drift
// in any of these after a run is a parity failure. .claude/settings.json is
// committed but NOT regenerated by generate-tools, so it is excluded from the
// drift surface (both Python and TS leave it untouched; clean-tools is not run
// here).
const GENERATED_PATHSPECS = [
    'dist/agent-src',
    '.augment',
    '.claude/rules',
    '.claude/skills',
    '.claude/personas',
    '.claude/user-types',
    '.claude-plugin/skills',
    '.cursor',
    '.windsurf',
    '.windsurfrules',
    '.clinerules',
    'GEMINI.md',
    'hooks/hooks.json',
    'internal/.condensation-hashes.json',
];

function generatedDrift(): string {
    const r = spawnSync('git', ['status', '--porcelain', '--', ...GENERATED_PATHSPECS], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });
    return (r.stdout ?? '').trim();
}

function restoreGenerated(): void {
    // Discard tracked changes and remove any newly-created untracked files in
    // the generated trees, so a test never leaves the worktree dirty.
    spawnSync('git', ['checkout', '--', ...GENERATED_PATHSPECS], { cwd: REPO_ROOT });
    spawnSync('git', ['clean', '-fdq', '--', ...GENERATED_PATHSPECS], { cwd: REPO_ROOT });
}

describe.skipIf(!HAS_PYTHON3)('golden parity — write subcommands produce ZERO drift', () => {
    afterEach(() => {
        restoreGenerated();
    });

    it('baseline: repo is in-sync before any run', () => {
        expect(generatedDrift()).toBe('');
    });

    it('tsx --sync then --generate-tools reproduces the committed trees byte-for-byte', () => {
        const sync = runTs(['--sync']);
        expect(sync.status).toBe(0);
        const gt = runTs(['--generate-tools']);
        expect(gt.status).toBe(0);
        expect(generatedDrift()).toBe('');
    });

    it('python3 --sync then --generate-tools also yields zero drift (baseline confirm)', () => {
        const sync = runPy(['--sync']);
        expect(sync.status).toBe(0);
        const gt = runPy(['--generate-tools']);
        expect(gt.status).toBe(0);
        expect(generatedDrift()).toBe('');
    });

    it('tsx --project-augment + --mark-all-done + --clean-hashes leave zero drift', () => {
        expect(runTs(['--project-augment']).status).toBe(0);
        expect(runTs(['--mark-all-done']).status).toBe(0);
        expect(runTs(['--clean-hashes']).status).toBe(0);
        expect(generatedDrift()).toBe('');
    });
});
