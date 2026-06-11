/**
 * Contract tests for `src/scripts/_lib/module_detection.ts`.
 *
 * 1:1 vitest port of `tests/test_module_detection.py` (ADR-088 parity
 * gate 1 — the pytest suite is the behavioral specification). Every
 * stack shape from `commands/module/explore.md` Step 1 must surface as
 * a candidate, and confidence must downgrade correctly when the root
 * is empty or its contents do not match the stack signal.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
    detect_module_roots,
    is_module_like_path,
    type ModuleCandidate,
} from '../../src/scripts/_lib/module_detection.js';

// --- helpers ---------------------------------------------------------------

let tmpPath: string;

beforeEach(() => {
    tmpPath = mkdtempSync(path.join(tmpdir(), 'module-detection-'));
});

afterEach(() => {
    rmSync(tmpPath, { recursive: true, force: true });
});

function mkmodule(
    root: string,
    name: string,
    opts: { packageJson?: boolean; initPy?: boolean } = {},
): string {
    const mod = path.join(root, name);
    mkdirSync(mod, { recursive: true });
    if (opts.packageJson) {
        writeFileSync(path.join(mod, 'package.json'), '{}', 'utf-8');
    }
    if (opts.initPy) {
        writeFileSync(path.join(mod, '__init__.py'), '', 'utf-8');
    }
    return mod;
}

function byStack(candidates: ModuleCandidate[]): Map<string, ModuleCandidate> {
    return new Map(candidates.map((c) => [c.stack, c]));
}

// --- stack-shape coverage --------------------------------------------------

describe('detect_module_roots', () => {
    test('empty project yields no candidates', () => {
        expect(detect_module_roots(tmpPath)).toEqual([]);
    });

    test('laravel hmvc detected with capitalized modules', () => {
        mkmodule(path.join(tmpPath, 'app/Modules'), 'ApiClient');
        mkmodule(path.join(tmpPath, 'app/Modules'), 'ClientSoftware');
        const result = detect_module_roots(tmpPath);
        const stacks = byStack(result);
        expect(stacks.has('laravel-hmvc')).toBe(true);
        const cand = stacks.get('laravel-hmvc') as ModuleCandidate;
        expect(cand.path).toBe('app/Modules');
        expect(cand.namespace_template_guess).toBe('App\\Modules\\{ModuleName}');
        expect(cand.confidence).toBe('high');
    });

    test('laravel hmvc empty dir downgrades to medium', () => {
        mkdirSync(path.join(tmpPath, 'app', 'Modules'), { recursive: true });
        const matches = detect_module_roots(tmpPath).filter((c) => c.stack === 'laravel-hmvc');
        expect(matches).toHaveLength(1);
        expect((matches[0] as ModuleCandidate).confidence).toBe('medium');
    });

    test('symfony ddd detected at src/Module', () => {
        mkmodule(path.join(tmpPath, 'src/Module'), 'Billing');
        mkmodule(path.join(tmpPath, 'src/Module'), 'Catalog');
        const stacks = byStack(detect_module_roots(tmpPath));
        expect(stacks.has('symfony-ddd')).toBe(true);
        const cand = stacks.get('symfony-ddd') as ModuleCandidate;
        expect(cand.path).toBe('src/Module');
        expect(cand.namespace_template_guess).toBe('App\\Module\\{ModuleName}');
        expect(cand.confidence).toBe('high');
    });

    test('node monorepo detected via packages with package.json', () => {
        mkmodule(path.join(tmpPath, 'packages'), 'core', { packageJson: true });
        mkmodule(path.join(tmpPath, 'packages'), 'ui', { packageJson: true });
        const stacks = byStack(detect_module_roots(tmpPath));
        expect(stacks.has('node-monorepo')).toBe(true);
        const cand = stacks.get('node-monorepo') as ModuleCandidate;
        expect(cand.path).toBe('packages');
        expect(cand.namespace_template_guess).toBe('');
        expect(cand.confidence).toBe('high');
    });

    test('node monorepo packages without package.json is medium', () => {
        mkmodule(path.join(tmpPath, 'packages'), 'core');
        const matches = detect_module_roots(tmpPath).filter(
            (c) => c.path === 'packages' && c.stack === 'node-monorepo',
        );
        expect(matches).toHaveLength(1);
        expect((matches[0] as ModuleCandidate).confidence).toBe('medium');
    });

    test('python src layout detected via __init__.py', () => {
        mkmodule(path.join(tmpPath, 'src'), 'mypkg', { initPy: true });
        const stacks = byStack(detect_module_roots(tmpPath));
        // `src` rule fires for python-src; capitalized subdir would also hit
        // symfony-ddd but here `mypkg` is lowercase so only python-src is high.
        expect(stacks.has('python-src')).toBe(true);
        expect((stacks.get('python-src') as ModuleCandidate).confidence).toBe('high');
    });

    test('go internal detected with any subdirs', () => {
        mkmodule(path.join(tmpPath, 'internal'), 'auth');
        mkmodule(path.join(tmpPath, 'internal'), 'billing');
        const stacks = byStack(detect_module_roots(tmpPath));
        expect(stacks.has('go-internal')).toBe(true);
        const cand = stacks.get('go-internal') as ModuleCandidate;
        expect(cand.path).toBe('internal');
        expect(cand.namespace_template_guess).toBe('');
        expect(cand.confidence).toBe('high');
    });

    test('composer library src layout surfaces as python-src rule', () => {
        // `src/` with capitalized PHP-style subdir (no __init__.py) →
        // python-src rule fires at medium, symfony-ddd only fires when
        // `src/Module/` exists (this is the explicit Symfony shape).
        mkmodule(path.join(tmpPath, 'src'), 'MyLib');
        const candidates = detect_module_roots(tmpPath);
        const paths = new Set(candidates.map((c) => `${c.path}|${c.stack}`));
        expect(paths.has('src|python-src')).toBe(true);
    });

    // --- ordering + skip-dirs ----------------------------------------------

    test('high confidence candidates listed before medium', () => {
        // Empty laravel root (medium) + populated node monorepo (high)
        mkdirSync(path.join(tmpPath, 'app', 'Modules'), { recursive: true });
        mkmodule(path.join(tmpPath, 'packages'), 'core', { packageJson: true });
        const result = detect_module_roots(tmpPath);
        const confidences = result.map((c) => c.confidence);
        // Every high precedes every medium.
        const sorted = [...confidences].sort(
            (a, b) => (a === 'high' ? 0 : 1) - (b === 'high' ? 0 : 1),
        );
        expect(confidences).toEqual(sorted);
    });

    test('skip dirs are excluded from subdir scoring', () => {
        mkmodule(path.join(tmpPath, 'app/Modules'), '.module-template');
        mkmodule(path.join(tmpPath, 'app/Modules'), '.example');
        const matches = detect_module_roots(tmpPath).filter((c) => c.stack === 'laravel-hmvc');
        expect(matches).toHaveLength(1);
        // Only skip-dir entries present → no capitalized modules → medium.
        expect((matches[0] as ModuleCandidate).confidence).toBe('medium');
    });

    test('absent directories never appear', () => {
        // Only laravel exists; node/python/go rules must all skip silently.
        mkmodule(path.join(tmpPath, 'app/Modules'), 'Billing');
        const result = detect_module_roots(tmpPath);
        const stacks = new Set(result.map((c) => c.stack));
        expect(stacks).toEqual(new Set(['laravel-hmvc']));
    });
});

// --- is_module_like_path() ------------------------------------------------

describe('is_module_like_path', () => {
    test('accepts laravel hmvc shape', () => {
        expect(is_module_like_path('app/Modules/User/Models/User.php')).toBe(true);
        expect(is_module_like_path('Modules/Billing/Service.php')).toBe(true);
    });

    test('accepts node monorepo shape', () => {
        expect(is_module_like_path('packages/ui/src/index.ts')).toBe(true);
        expect(is_module_like_path('apps/web/pages/index.tsx')).toBe(true);
    });

    test('accepts go internal shape', () => {
        expect(is_module_like_path('internal/auth/handler.go')).toBe(true);
    });

    test('rejects vendor and build paths', () => {
        // Even with module-shaped parent, noise segments hard-disqualify.
        expect(is_module_like_path('vendor/foo/Modules/Bar/file.php')).toBe(false);
        expect(is_module_like_path('node_modules/pkg/packages/x.js')).toBe(false);
        expect(is_module_like_path('dist/Modules/User.js')).toBe(false);
        expect(is_module_like_path('storage/Modules/x.log')).toBe(false);
    });

    test('rejects flat paths', () => {
        expect(is_module_like_path('src/App.php')).toBe(false);
        expect(is_module_like_path('README.md')).toBe(false);
        expect(is_module_like_path('config/app.php')).toBe(false);
    });

    test('rejects bare parent without child', () => {
        // "Modules" alone (last segment) is not module-like.
        expect(is_module_like_path('app/Modules')).toBe(false);
        expect(is_module_like_path('packages')).toBe(false);
    });

    test('rejects skip-dir children', () => {
        expect(is_module_like_path('Modules/.module-template/stub.php')).toBe(false);
        expect(is_module_like_path('packages/.example/file.ts')).toBe(false);
    });

    test('handles empty and windows input', () => {
        expect(is_module_like_path('')).toBe(false);
        expect(is_module_like_path('/')).toBe(false);
        // Backslashes normalised; trailing/leading slashes stripped.
        expect(is_module_like_path('app\\Modules\\User\\file.php')).toBe(true);
    });
});
