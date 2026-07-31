// Regression cover for the 9.11.0 release failure.
//
// `src/scripts/_cli/*.ts` sits 3 levels below the package root, so all 11
// delegate call sites derived the root with 3 hard-coded parent hops. The
// delegate precompile (fa51c5a54) then bundled those modules into
// `dist/cli-delegate/*.js` — 2 levels below the root. 3 hops from there lands
// on `<pkg>/..`, i.e. `node_modules/@event4u` for a scoped install, so
// `conformance` declared `dist/router.json` and `src/scripts/hook_manifest.yaml`
// missing and `tarball E2E` went red on both Node majors.
//
// The bundle-layout and nested-consumer cases below fail against the old
// 3-hop math, so they pin the bug rather than restate the fix.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PACKAGE_NAME, resolvePackageRoot } from '../../src/scripts/_lib/package_root.js';

let tmp: string;

/** Stage a package root whose package.json carries the real marker name. */
function stagePackage(root: string, name: string = PACKAGE_NAME): void {
    fs.mkdirSync(root, { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name }), 'utf-8');
}

function stageFile(p: string): string {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, '// stub\n', 'utf-8');
    return p;
}

describe('resolvePackageRoot', () => {
    beforeEach(() => {
        // realpath: macOS /var → /private/var, which would break path equality.
        tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'pkg-root-')));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('resolves the source layout (src/scripts/_cli → root)', () => {
        const root = path.join(tmp, 'repo');
        stagePackage(root);
        const mod = stageFile(path.join(root, 'src', 'scripts', '_cli', 'cmd_x.ts'));
        expect(resolvePackageRoot(pathToFileURL(mod).href)).toBe(root);
    });

    it('resolves the bundled layout (dist/cli-delegate → root)', () => {
        // 3 fixed hops from here would return `tmp`, not `root`.
        const root = path.join(tmp, 'repo');
        stagePackage(root);
        const mod = stageFile(path.join(root, 'dist', 'cli-delegate', 'cmd_x.js'));
        expect(resolvePackageRoot(pathToFileURL(mod).href)).toBe(root);
    });

    it('resolves a scoped install nested in a consumer, skipping its manifest', () => {
        // The exact production shape: 3 hops returned `node_modules/@event4u`.
        const consumer = path.join(tmp, 'project');
        stagePackage(consumer, 'consumer-app');
        const pkg = path.join(consumer, 'node_modules', '@event4u', 'agent-config');
        stagePackage(pkg);
        const mod = stageFile(path.join(pkg, 'dist', 'cli-delegate', 'cmd_x.js'));
        const got = resolvePackageRoot(pathToFileURL(mod).href);
        expect(got).toBe(pkg);
        expect(got).not.toBe(path.join(consumer, 'node_modules', '@event4u'));
    });

    it('is depth-independent — an extra nesting level does not shift the answer', () => {
        const root = path.join(tmp, 'repo');
        stagePackage(root);
        const mod = stageFile(path.join(root, 'dist', 'a', 'b', 'c', 'cmd_x.js'));
        expect(resolvePackageRoot(pathToFileURL(mod).href)).toBe(root);
    });

    it('accepts a plain path as well as a file: URL', () => {
        const root = path.join(tmp, 'repo');
        stagePackage(root);
        const mod = stageFile(path.join(root, 'dist', 'cli-delegate', 'cmd_x.js'));
        expect(resolvePackageRoot(mod)).toBe(root);
    });

    it('ignores an unparseable package.json on the way up', () => {
        const root = path.join(tmp, 'repo');
        stagePackage(root);
        const mid = path.join(root, 'dist');
        fs.mkdirSync(mid, { recursive: true });
        fs.writeFileSync(path.join(mid, 'package.json'), '{ not json', 'utf-8');
        const mod = stageFile(path.join(mid, 'cli-delegate', 'cmd_x.js'));
        expect(resolvePackageRoot(pathToFileURL(mod).href)).toBe(root);
    });

    it('falls back to the legacy hop count when no marker exists', () => {
        // No package.json anywhere: never throw during CLI startup.
        const mod = stageFile(path.join(tmp, 'a', 'b', 'c', 'cmd_x.js'));
        expect(resolvePackageRoot(pathToFileURL(mod).href, 3)).toBe(tmp);
        expect(resolvePackageRoot(pathToFileURL(mod).href, 2)).toBe(path.join(tmp, 'a'));
    });

    it('the real package resolves to this repo root', () => {
        const root = resolvePackageRoot(new URL('../../src/scripts/_lib/package_root.ts', import.meta.url).href);
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8')) as {
            name?: string;
        };
        expect(manifest.name).toBe(PACKAGE_NAME);
    });
});
