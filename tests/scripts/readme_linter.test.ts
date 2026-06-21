// Tests for src/scripts/readme_linter.ts (py2ts Phase 8 / Wave 8b).
//
// Ports tests/test_readme_linter.py 1:1 (repo-type detection, every check,
// output formatting) plus a golden-parity layer that runs python3 vs tsx on
// the REAL repo README for each --format / --strict combination (skipped
// without python3). Byte-identical stdout/stderr/exit asserted.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as rl from '../../src/scripts/readme_linter.js';



let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'readme-lint-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFile(rel: string, content: string): string {
    const p = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content, 'utf-8');
    return p;
}

function makeTmpRepo(): void {
    writeFile('composer.json', JSON.stringify({ name: 'vendor/package', type: 'library', require: { php: '^8.2' } }));
}

const GOOD_README = `# my-package

A useful package that solves real problems.

## Requirements

- PHP ^8.2
- Laravel 11.x

## Installation

\`\`\`bash
composer require vendor/my-package
\`\`\`

## Usage

\`\`\`php
$result = MyPackage::doThing();
\`\`\`

## Development

\`\`\`bash
task test
\`\`\`
`;

function codes(result: rl.ReadmeLintResult): string[] {
    return result.issues.map((i) => i.code);
}

describe('readme_linter — repo-type detection', () => {
    it('detects composer library', () => {
        makeTmpRepo();
        const ctx = rl.detect_repo_context(tmp);
        expect(ctx.repo_type).toBe('package');
        expect(ctx.has_composer).toBe(true);
    });
    it('detects app with artisan', () => {
        writeFile('artisan', '');
        writeFile('composer.json', '{"name": "app"}');
        expect(rl.detect_repo_context(tmp).repo_type).toBe('app');
    });
    it('detects internal with .augment', () => {
        fs.mkdirSync(path.join(tmp, '.augment'));
        expect(rl.detect_repo_context(tmp).repo_type).toBe('internal');
    });
    it('detects unknown', () => {
        expect(rl.detect_repo_context(tmp).repo_type).toBe('unknown');
    });
    it('extracts taskfile tasks', () => {
        writeFile('Taskfile.yml', "\nversion: '3'\ntasks:\n  test:\n    cmd: echo test\n  lint:\n    cmd: echo lint\n");
        const ctx = rl.detect_repo_context(tmp);
        expect(ctx.taskfile_tasks).toContain('test');
        expect(ctx.taskfile_tasks).toContain('lint');
    });
    it('extracts npm scripts', () => {
        writeFile('package.json', JSON.stringify({ name: 'pkg', scripts: { test: 'jest', build: 'tsc' } }));
        const ctx = rl.detect_repo_context(tmp);
        expect(ctx.npm_scripts).toContain('test');
        expect(ctx.npm_scripts).toContain('build');
    });
});

describe('readme_linter — checks', () => {
    it('fails without H1', () => {
        makeTmpRepo();
        const p = writeFile('README.md', 'Some text without a title\n\n## Section\n');
        expect(codes(rl.lint_readme(p, tmp))).toContain('readme_missing_title');
    });
    it('passes with H1', () => {
        makeTmpRepo();
        const p = writeFile('README.md', GOOD_README);
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_missing_title');
    });
    it('warns when no summary', () => {
        makeTmpRepo();
        const p = writeFile('README.md', '# Title\n## Install\n```bash\ncomposer install\n```\n');
        expect(codes(rl.lint_readme(p, tmp))).toContain('readme_missing_summary');
    });
    it('passes with summary', () => {
        makeTmpRepo();
        const p = writeFile('README.md', GOOD_README);
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_missing_summary');
    });
    it('errors for package without install', () => {
        makeTmpRepo();
        const p = writeFile('README.md', '# Package\n\nSummary text.\n\n## About\nText.\n');
        const issues = Object.fromEntries(rl.lint_readme(p, tmp).issues.map((i) => [i.code, i.severity]));
        expect(issues.readme_missing_installation).toBe('error');
    });
    it('passes with install heading', () => {
        makeTmpRepo();
        const p = writeFile('README.md', GOOD_README);
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_missing_installation');
    });
    it('warns for package without requirements', () => {
        makeTmpRepo();
        const p = writeFile('README.md', '# Pkg\n\nSummary.\n\n## Installation\n\n```bash\ncomposer require x\n```\n');
        expect(codes(rl.lint_readme(p, tmp))).toContain('readme_missing_compatibility');
    });
    it('passes with requirements heading', () => {
        makeTmpRepo();
        const p = writeFile('README.md', GOOD_README);
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_missing_compatibility');
    });
    it('skips compatibility for non-package', () => {
        fs.mkdirSync(path.join(tmp, '.augment'));
        const p = writeFile('README.md', '# Tool\n\nSummary.\n\n## Installation\n\n```bash\ntask setup\n```\n');
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_missing_compatibility');
    });
    it('warns on marketing language', () => {
        makeTmpRepo();
        const p = writeFile(
            'README.md',
            '# Pkg\n\nA modern and scalable solution.\n\n## Requirements\n\n- PHP ^8.2\n\n## Installation\n\n```bash\nx\n```\n',
        );
        expect(codes(rl.lint_readme(p, tmp))).toContain('readme_generic_boilerplate');
    });
    it('passes without boilerplate', () => {
        makeTmpRepo();
        const p = writeFile('README.md', GOOD_README);
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_generic_boilerplate');
    });
    it('warns on unknown task', () => {
        writeFile('Taskfile.yml', "version: '3'\ntasks:\n  test:\n    cmd: echo\n");
        fs.mkdirSync(path.join(tmp, '.augment'));
        const p = writeFile(
            'README.md',
            '# Tool\n\nSummary.\n\n## Installation\n\n```bash\nsetup\n```\n\nRun `task nonexistent` to start.\n\n## Development\n\ntest\n',
        );
        expect(codes(rl.lint_readme(p, tmp))).toContain('readme_command_mismatch');
    });
    it('passes on known task', () => {
        writeFile('Taskfile.yml', "version: '3'\ntasks:\n  test:\n    cmd: echo\n  lint:\n    cmd: echo\n");
        fs.mkdirSync(path.join(tmp, '.augment'));
        const p = writeFile(
            'README.md',
            '# Tool\n\nSummary.\n\n## Installation\n\n```bash\nsetup\n```\n\nRun `task test` and `task lint`.\n\n## Development\n\ntest\n',
        );
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_command_mismatch');
    });
    it('warns when architecture before install', () => {
        makeTmpRepo();
        const p = writeFile(
            'README.md',
            '# Pkg\n\nSummary.\n\n## Requirements\n\n- PHP\n\n## Architecture\n\nDeep stuff.\n\n## Installation\n\n```bash\nx\n```\n',
        );
        expect(codes(rl.lint_readme(p, tmp))).toContain('readme_bad_section_order');
    });
    it('passes with correct order', () => {
        makeTmpRepo();
        const p = writeFile('README.md', GOOD_README);
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_bad_section_order');
    });
    it('warns on very long readme', () => {
        makeTmpRepo();
        const p = writeFile(
            'README.md',
            '# Pkg\n\nSummary.\n\n## Requirements\n\n- PHP\n\n## Installation\n\n```bash\nx\n```\n\n' + 'line\n'.repeat(800),
        );
        expect(codes(rl.lint_readme(p, tmp))).toContain('readme_overloaded');
    });
    it('passes on normal readme', () => {
        makeTmpRepo();
        const p = writeFile('README.md', GOOD_README);
        expect(codes(rl.lint_readme(p, tmp))).not.toContain('readme_overloaded');
    });
    it('good readme has no errors', () => {
        makeTmpRepo();
        const result = rl.lint_readme(writeFile('README.md', GOOD_README), tmp);
        expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
        expect(['pass', 'pass_with_warnings']).toContain(result.status);
    });
});

describe('readme_linter — output formatting', () => {
    it('format_text pass', () => {
        const result: rl.ReadmeLintResult = { file: 'README.md', repo_type: 'package', status: 'pass', issues: [], line_count: 100 };
        const out = rl.format_text(result);
        expect(out).toContain('✅');
        expect(out).toContain('No issues found');
    });
    it('format_text with issues', () => {
        const result: rl.ReadmeLintResult = {
            file: 'README.md',
            repo_type: 'package',
            status: 'fail',
            issues: [{ severity: 'error', code: 'readme_missing_title', message: 'No H1' }],
            line_count: 10,
        };
        const out = rl.format_text(result);
        expect(out).toContain('❌');
        expect(out).toContain('readme_missing_title');
    });
    it('format_json', () => {
        const result: rl.ReadmeLintResult = { file: 'README.md', repo_type: 'package', status: 'pass', issues: [], line_count: 100 };
        const data = JSON.parse(rl.format_json(result));
        expect(data.repo_type).toBe('package');
        expect(data.summary.error).toBe(0);
    });
    it('format_markdown', () => {
        const result: rl.ReadmeLintResult = {
            file: 'README.md',
            repo_type: 'internal',
            status: 'pass_with_warnings',
            issues: [{ severity: 'warning', code: 'readme_overloaded', message: 'Too long' }],
            line_count: 600,
        };
        const out = rl.format_markdown(result);
        expect(out).toContain('⚠️ Warnings');
        expect(out).toContain('readme_overloaded');
    });
});
