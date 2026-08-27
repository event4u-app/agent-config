// Tests for src/install/detect_php_shape.ts —
// road-to-consumer-repo-reality Phase 3 (3.1).
//
// The canonical fixture is 3.1's verify line, built literally: a tree carrying
// the framework's ORM and container but a custom entry point and no framework
// CLI must resolve to the third verdict.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    detectPhpShape,
    frameworkRoutingIsWrong,
    PROBE_COUNT,
    PROBE_PATHS,
    SKELETON_MARKERS,
} from '../../src/install/detect_php_shape.js';

const tmps: string[] = [];

function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'php-'));
    tmps.push(root);
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf8');
    }
    return root;
}

const composer = (req: Record<string, string>): string => `${JSON.stringify({ require: req }, null, 2)}\n`;

afterEach(() => {
    while (tmps.length > 0) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

describe('3.1 — the third state: components without the framework', () => {
    it('resolves the ORM + container + custom entry point tree to the third verdict', () => {
        const root = tree({
            'composer.json': composer({ 'illuminate/database': '^11.0', 'illuminate/container': '^11.0' }),
            'public/index.php': "<?php\nrequire __DIR__ . '/../src/bootstrap.php';\n",
            'src/Router.php': "<?php\nfinal class Router {}\n",
        });
        const v = detectPhpShape(root);
        expect(v.shape).toBe('components-without-framework');
        expect(v.componentsOf).toBe('laravel');
        expect(v.markersFound).toEqual([]);
        expect(frameworkRoutingIsWrong(v)).toBe(true);
    });

    it('says WHY, naming what the framework skill would wrongly offer', () => {
        const root = tree({ 'composer.json': composer({ 'illuminate/database': '^11.0' }) });
        const v = detectPhpShape(root);
        expect(v.reason).toMatch(/CLI/);
        expect(v.reason).toMatch(/routes file/);
        expect(v.reason).toContain('artisan');
    });

    it('does the same for the other family', () => {
        const root = tree({
            'composer.json': composer({ 'symfony/http-foundation': '^7.0', 'symfony/routing': '^7.0' }),
            'public/index.php': "<?php\n// hand-wired front controller\n",
        });
        const v = detectPhpShape(root);
        expect(v.shape).toBe('components-without-framework');
        expect(v.componentsOf).toBe('symfony');
    });

    // The discriminator is the marker, not the dependency. Each of these trees
    // has the SAME dependency set as a third-state tree and a different verdict.
    it.each(SKELETON_MARKERS.laravel)('a laravel skeleton marker (%s) flips the verdict to laravel', (marker) => {
        const root = tree({
            'composer.json': composer({ 'illuminate/database': '^11.0' }),
            [marker]: "<?php\n",
        });
        const v = detectPhpShape(root);
        expect(v.shape).toBe('laravel');
        expect(v.markersFound).toContain(marker);
        expect(frameworkRoutingIsWrong(v)).toBe(false);
    });

    it.each(SKELETON_MARKERS.symfony)('a symfony skeleton marker (%s) flips the verdict to symfony', (marker) => {
        const root = tree({
            'composer.json': composer({ 'symfony/http-foundation': '^7.0' }),
            [marker]: "<?php\n",
        });
        expect(detectPhpShape(root).shape).toBe('symfony');
    });

    // A REAL DEFECT this suite did not catch until a review pointed at it. A
    // single pass returning on the first family with any component reported a
    // genuine Symfony application as components-without-framework the moment its
    // manifest also required `illuminate/collections` — `laravel` is examined
    // first, has a component, has no Laravel skeleton, and returned before
    // Symfony's markers were looked at. Both `illuminate/collections` and
    // `illuminate/support` are widely used standalone, so this is ordinary.
    it('a real skeleton wins even when the OTHER family also has components', () => {
        const root = tree({
            'composer.json': composer({ 'symfony/framework-bundle': '^7.0', 'illuminate/collections': '^11.0' }),
            'bin/console': "<?php\n",
            'config/bundles.php': "<?php\n",
        });
        const v = detectPhpShape(root);
        expect(v.shape).toBe('symfony');
        expect(frameworkRoutingIsWrong(v)).toBe(false);
    });

    it('holds in the mirror direction — family order must not decide the verdict', () => {
        const root = tree({
            'composer.json': composer({ 'laravel/framework': '^11.0', 'symfony/console': '^7.0' }),
            artisan: "#!/usr/bin/env php\n",
        });
        expect(detectPhpShape(root).shape).toBe('laravel');
    });

    it('names EVERY family whose components are present when no skeleton exists', () => {
        const root = tree({
            'composer.json': composer({ 'illuminate/database': '^11.0', 'symfony/http-foundation': '^7.0' }),
        });
        const v = detectPhpShape(root);
        expect(v.shape).toBe('components-without-framework');
        expect(v.reason).toContain('laravel');
        expect(v.reason).toContain('symfony');
    });

    it('does NOT call the whole framework a component install', () => {
        const root = tree({
            'composer.json': composer({ 'laravel/framework': '^11.0' }),
            artisan: "#!/usr/bin/env php\n",
        });
        expect(detectPhpShape(root).shape).toBe('laravel');
    });

    it('reports plain-php when neither family is required', () => {
        const root = tree({ 'composer.json': composer({ 'guzzlehttp/guzzle': '^7.0' }) });
        expect(detectPhpShape(root).shape).toBe('plain-php');
    });

    it('reports unknown rather than guessing when there is no manifest', () => {
        const v = detectPhpShape(tree({ 'public/index.php': "<?php\n" }));
        expect(v.shape).toBe('unknown');
        expect(v.reason).toContain('no composer.json');
    });

    it('reads require-dev too, so a dev-only component still counts as available', () => {
        const root = tree({
            'composer.json': `${JSON.stringify({ 'require-dev': { 'illuminate/testing': '^11.0' } }, null, 2)}\n`,
        });
        expect(detectPhpShape(root).shape).toBe('components-without-framework');
    });

    it('survives a malformed composer.json without throwing', () => {
        const root = tree({ 'composer.json': '{ not json\n' });
        expect(() => detectPhpShape(root)).not.toThrow();
        expect(detectPhpShape(root).shape).toBe('plain-php');
    });
});

// Risk-register rank 7: a discriminator too expensive to evaluate is a check
// that gets skipped, which is not a check.
describe('3.2 — the probe set is small, fixed, and stated', () => {
    it('is a fixed set of at most 8 filesystem probes', () => {
        expect(PROBE_COUNT).toBe(PROBE_PATHS.length);
        expect(PROBE_COUNT).toBeLessThanOrEqual(8);
    });

    it('names composer.json plus both families’ skeleton markers, and nothing else', () => {
        expect(PROBE_PATHS).toContain('composer.json');
        for (const m of [...SKELETON_MARKERS.laravel, ...SKELETON_MARKERS.symfony]) {
            expect(PROBE_PATHS).toContain(m);
        }
        expect(PROBE_PATHS).toHaveLength(1 + SKELETON_MARKERS.laravel.length + SKELETON_MARKERS.symfony.length);
    });

    it('reports the probes an individual verdict actually cost', () => {
        const root = tree({ 'composer.json': composer({ 'illuminate/database': '^11.0' }) });
        const v = detectPhpShape(root);
        expect(v.probes).toBeGreaterThan(0);
        expect(v.probes).toBeLessThanOrEqual(PROBE_COUNT);
    });
});
