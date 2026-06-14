// Tests for src/scripts/ai_council/project_context.ts (py2ts Phase 1).
//
// Reads composer.json / package.json / README.md from a fixture root and
// derives a neutral ProjectContext. Golden-parity against the Python twin via
// direct-file import (registered in sys.modules so the dataclass annotations
// resolve under Python 3.9).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    ProjectContext,
    REPO_PURPOSE_MAX_CHARS,
    detect_project_context,
} from '../../../src/scripts/ai_council/project_context.js';

const PY_MOD = 'src/scripts/ai_council/project_context.py';

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

/** Detect via the Python twin; returns {name,stack,repo_purpose} JSON. */
function pyDetect(root: string): string {
    const code = [
        'import importlib.util, sys, json',
        `spec = importlib.util.spec_from_file_location("pc", ${JSON.stringify(PY_MOD)})`,
        'pc = importlib.util.module_from_spec(spec)',
        'sys.modules["pc"] = pc',
        'spec.loader.exec_module(pc)',
        `c = pc.detect_project_context(pc.Path(${JSON.stringify(root)}))`,
        'print(json.dumps({"name": c.name, "stack": c.stack, "repo_purpose": c.repo_purpose, "empty": c.is_empty()}))',
    ].join('\n');
    const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
    if (r.status !== 0) {
        throw new Error(`python3 failed: ${r.stderr}`);
    }
    return r.stdout.trim();
}

const created: string[] = [];

function mkRoot(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pc-test-'));
    created.push(root);
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(root, name), content, 'utf-8');
    }
    return root;
}

function tsJson(root: string): string {
    const c = detect_project_context(root);
    return JSON.stringify({
        name: c.name,
        stack: c.stack,
        repo_purpose: c.repo_purpose,
        empty: c.is_empty(),
    });
}

afterEach(() => {
    while (created.length) {
        const d = created.pop()!;
        fs.rmSync(d, { recursive: true, force: true });
    }
});

// Fixture set covering every branch of name/stack/purpose + truncation.
function fixtures(): Record<string, Record<string, string>> {
    const longPurpose =
        'This package does a great many useful things for engineering teams. '.repeat(8);
    return {
        full_laravel_react: {
            'composer.json': JSON.stringify({
                name: 'acme/widgets',
                require: { php: '^8.2', 'laravel/framework': '^11' },
            }),
            'package.json': JSON.stringify({
                engines: { node: '>=20' },
                dependencies: { react: '^18', next: '^14' },
            }),
            'README.md':
                '# Title\n\n[![badge](x)](y)\n\nThis is the <b>real</b> purpose sentence. Another one.\n\nIgnored para.\n',
        },
        symfony_only: {
            'composer.json': JSON.stringify({
                require: { php: '^8.1', 'symfony/framework-bundle': '^7' },
            }),
            'README.md': '<!-- comment line -->\n\nA Symfony service running background jobs.\n',
        },
        package_vue: {
            'package.json': JSON.stringify({ name: 'vue-app', dependencies: { vue: '^3' } }),
        },
        no_manifests: {
            'README.md': '# Heading only\n',
        },
        bad_json: {
            'composer.json': '{not valid json',
            'package.json': '[]',
            'README.md': 'Plain purpose line here describing things.\n',
        },
        truncation: {
            'README.md': `# T\n\n${longPurpose}\n`,
        },
        readme_html_strip: {
            'README.md': 'Uses <strong>bold</strong> and <a href="x">links</a> in the intro line.\n',
        },
        laminas: {
            'composer.json': JSON.stringify({ require: { 'laminas/laminas-mvc': '^3' } }),
        },
        angular: {
            'package.json': JSON.stringify({ dependencies: { '@angular/core': '^17' } }),
        },
        badge_html_open: {
            'README.md': '<div align="center">\n\nReal purpose after the html block.\n',
        },
    };
}

describe('project_context — class basics', () => {
    it('is_empty true for an all-null context', () => {
        expect(new ProjectContext().is_empty()).toBe(true);
        expect(new ProjectContext('x').is_empty()).toBe(false);
    });
    it('REPO_PURPOSE_MAX_CHARS = 400', () => {
        expect(REPO_PURPOSE_MAX_CHARS).toBe(400);
    });
});

describe('project_context — derivation', () => {
    it('full laravel+react stack joined with middot', () => {
        const root = mkRoot(fixtures().full_laravel_react as Record<string, string>);
        const c = detect_project_context(root);
        expect(c.name).toBe('acme/widgets');
        expect(c.stack).toBe('PHP ^8.2 · Laravel · Node >=20 · Next.js');
        expect(c.repo_purpose).toBe('This is the real purpose sentence. Another one.');
    });

    it('falls back to directory name when no manifest name', () => {
        const root = mkRoot(fixtures().symfony_only as Record<string, string>);
        const c = detect_project_context(root);
        expect(c.name).toBe(path.basename(root));
        expect(c.stack).toBe('PHP ^8.1 · Symfony');
    });

    it('truncation stops at last full sentence ≤ 400 with ellipsis', () => {
        const root = mkRoot(fixtures().truncation as Record<string, string>);
        const c = detect_project_context(root);
        expect(c.repo_purpose).not.toBeNull();
        expect(Array.from(c.repo_purpose as string).length).toBeLessThanOrEqual(
            REPO_PURPOSE_MAX_CHARS,
        );
        expect((c.repo_purpose as string).endsWith(' …')).toBe(true);
    });

    it('malformed manifests are ignored (no throw)', () => {
        const root = mkRoot(fixtures().bad_json as Record<string, string>);
        const c = detect_project_context(root);
        // composer.json invalid, package.json is an array (not dict) → both null.
        expect(c.stack).toBeNull();
        expect(c.repo_purpose).toBe('Plain purpose line here describing things.');
    });
});

describe.runIf(hasPython3())('project_context — golden parity vs CPython twin', () => {
    const fx = fixtures();
    it.each(Object.keys(fx))('fixture %s matches', (key) => {
        const root = mkRoot(fx[key] as Record<string, string>);
        expect(JSON.parse(tsJson(root))).toEqual(JSON.parse(pyDetect(root)));
    });

    it('empty directory matches (dir-name fallback)', () => {
        const root = mkRoot({});
        expect(JSON.parse(tsJson(root))).toEqual(JSON.parse(pyDetect(root)));
    });
});
