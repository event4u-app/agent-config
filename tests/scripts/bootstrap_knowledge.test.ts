// Tests for src/scripts/bootstrap_knowledge.ts (road-to-knowledge-system,
// Phase 6 — project familiarization bootstrap). Verifies deterministic
// detection, template discipline ([HUMAN: verify] markers, no invented
// claims), the exclusion-by-construction property (file CONTENTS are never
// read beyond manifest existence checks), and a full fixture-project run.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { detect, main, stagePages } from '../../src/scripts/bootstrap_knowledge.ts';

function mkFixture(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'bootstrap-fixture-'));
}

function touch(root: string, relPath: string, content = ''): void {
    const abs = path.join(root, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
}

describe('detect', () => {
    it('detects a Node/TS project by package.json + tsconfig.json + vitest.config.ts', () => {
        const root = mkFixture();
        touch(root, 'package.json', '{"name":"x"}');
        touch(root, 'tsconfig.json', '{}');
        touch(root, 'vitest.config.ts', '');
        touch(root, 'src/index.ts', '');
        touch(root, 'tests/index.test.ts', '');

        const result = detect(root);
        expect(result.manifests).toEqual([{ label: 'Node/JS/TS', evidence: 'package.json' }]);
        expect(result.standardsConfigs.map((c) => c.evidence)).toContain('tsconfig.json');
        expect(result.testConfigs.map((c) => c.evidence)).toContain('vitest.config.ts');
        expect(result.topLevelDirs.map((d) => d.label).sort()).toEqual(['src', 'tests']);
    });

    it('excludes noise directories (node_modules, .git, dist, vendor)', () => {
        const root = mkFixture();
        for (const dir of ['node_modules', '.git', 'dist', 'vendor', 'src']) {
            touch(root, `${dir}/placeholder.txt`, '');
        }
        const result = detect(root);
        expect(result.topLevelDirs.map((d) => d.label)).toEqual(['src']);
    });

    it('excludes dot-directories generally, not just .git', () => {
        const root = mkFixture();
        touch(root, '.github/workflows/ci.yml', '');
        touch(root, 'src/index.ts', '');
        const result = detect(root);
        expect(result.topLevelDirs.map((d) => d.label)).toEqual(['src']);
    });

    it('an empty project detects nothing (no fabrication)', () => {
        const root = mkFixture();
        const result = detect(root);
        expect(result.manifests).toEqual([]);
        expect(result.standardsConfigs).toEqual([]);
        expect(result.testConfigs).toEqual([]);
        expect(result.topLevelDirs).toEqual([]);
    });

    it('detects a PHP/Composer project independently of a Node project in the same fixture set', () => {
        const root = mkFixture();
        touch(root, 'composer.json', '{}');
        touch(root, 'pint.json', '{}');
        touch(root, 'phpunit.xml', '<phpunit/>');
        const result = detect(root);
        expect(result.manifests).toEqual([{ label: 'PHP/Composer', evidence: 'composer.json' }]);
        expect(result.standardsConfigs.map((c) => c.evidence)).toEqual(['pint.json']);
        expect(result.testConfigs.map((c) => c.evidence)).toEqual(['phpunit.xml']);
    });

    it('never reads the CONTENTS of any file — a manifest with secret-looking content is still just a boolean signal', () => {
        const root = mkFixture();
        touch(root, 'package.json', '{"apiKey":"sk-should-never-be-read-or-echoed-anywhere"}');
        const result = detect(root);
        expect(result.manifests).toEqual([{ label: 'Node/JS/TS', evidence: 'package.json' }]);
        // The detector's own output never contains the file body.
        expect(JSON.stringify(result)).not.toContain('sk-should-never-be-read');
    });
});

describe('stagePages — template discipline', () => {
    it('writes 5 pages under concepts/procedures/sessions, all under a staging dir', () => {
        const root = mkFixture();
        touch(root, 'package.json', '{}');
        const staging = path.join(root, '.staging');
        stagePages(root, staging);

        expect(fs.existsSync(path.join(staging, 'concepts', 'structure.md'))).toBe(true);
        expect(fs.existsSync(path.join(staging, 'concepts', 'standards.md'))).toBe(true);
        expect(fs.existsSync(path.join(staging, 'concepts', 'modules.md'))).toBe(true);
        expect(fs.existsSync(path.join(staging, 'procedures', 'api-conventions.md'))).toBe(true);
        expect(fs.existsSync(path.join(staging, 'sessions', 'common-mistakes.md'))).toBe(true);
    });

    it('inferential pages carry [HUMAN: verify] markers', () => {
        const root = mkFixture();
        touch(root, 'package.json', '{}');
        touch(root, 'src/index.ts', '');
        const staging = path.join(root, '.staging');
        stagePages(root, staging);

        const structure = fs.readFileSync(path.join(staging, 'concepts', 'structure.md'), 'utf8');
        expect(structure).toContain('[HUMAN: verify]');

        const modules = fs.readFileSync(path.join(staging, 'concepts', 'modules.md'), 'utf8');
        expect(modules).toContain('[HUMAN: verify]');
    });

    it('detected facts carry an evidence pointer (the config filename)', () => {
        const root = mkFixture();
        touch(root, 'composer.json', '{}');
        touch(root, 'pint.json', '{}');
        const staging = path.join(root, '.staging');
        stagePages(root, staging);

        const standards = fs.readFileSync(path.join(staging, 'concepts', 'standards.md'), 'utf8');
        expect(standards).toContain('`pint.json`');
    });

    it('empty seeds (modules, api-conventions, common-mistakes) never claim detected facts', () => {
        const root = mkFixture();
        const staging = path.join(root, '.staging');
        stagePages(root, staging);

        const apiConventions = fs.readFileSync(path.join(staging, 'procedures', 'api-conventions.md'), 'utf8');
        expect(apiConventions).toContain('[HUMAN: verify]');
        expect(apiConventions).not.toMatch(/GET|POST|PUT|DELETE/); // no fabricated endpoint claims
    });
});

describe('bootstrap_knowledge CLI — full fixture project run', () => {
    it('a realistic mixed fixture stages a deterministic, reproducible batch', () => {
        const root = mkFixture();
        touch(root, 'package.json', '{"name":"demo"}');
        touch(root, '.eslintrc.json', '{}');
        touch(root, 'vitest.config.ts', '');
        touch(root, 'src/index.ts', '');
        touch(root, 'tests/index.test.ts', '');
        touch(root, 'docs/README.md', '# Demo');
        touch(root, 'node_modules/dep/index.js', '');

        const staging = path.join(root, '.bootstrap-staging');
        const rc = main(['--dir', root, '--staging-dir', staging]);
        expect(rc).toBe(0);

        const structure = fs.readFileSync(path.join(staging, 'concepts', 'structure.md'), 'utf8');
        expect(structure).toContain('Node/JS/TS');
        expect(structure).toContain('`docs/`');
        expect(structure).toContain('`src/`');
        expect(structure).toContain('`tests/`');
        expect(structure).not.toContain('node_modules');

        // Re-running produces byte-identical output — deterministic.
        const staging2 = path.join(root, '.bootstrap-staging-2');
        main(['--dir', root, '--staging-dir', staging2]);
        expect(fs.readFileSync(path.join(staging2, 'concepts', 'structure.md'), 'utf8')).toBe(structure);
    });

    it('usage errors exit 1', () => {
        expect(main(['--bogus'])).toBe(1);
    });

    it('--help exits 0', () => {
        expect(main(['--help'])).toBe(0);
    });
});
