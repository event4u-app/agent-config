/**
 * Red/green coverage for prepack gate 3 (lifecycle-target guard) —
 * road-to-credible-install Phase 0. The 9.8.0 dead-postinstall
 * (`node dist/scripts/postinstall_gui.js` with nothing building the target)
 * must turn the gate red; the current package.json must be green.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — plain .mjs module without type declarations
import {
    checkLifecycleTargets,
    extractScriptTargets,
    isShippedPath,
} from '../../src/scripts/prepack_lifecycle_check.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

describe('extractScriptTargets', () => {
    it('extracts node/bash targets and skips flags + shell noise', () => {
        expect(extractScriptTargets('node dist/scripts/postinstall_gui.js 2>/dev/null || true')).toEqual([
            'dist/scripts/postinstall_gui.js',
        ]);
        expect(extractScriptTargets('[ -d .git ] && bash src/scripts/install-hooks.sh || true')).toEqual([
            'src/scripts/install-hooks.sh',
        ]);
        expect(extractScriptTargets('node --enable-source-maps dist/cli/agent-config.js')).toEqual([
            'dist/cli/agent-config.js',
        ]);
        expect(extractScriptTargets('tsc -p tsconfig.json')).toEqual([]);
    });
});

describe('isShippedPath', () => {
    it('matches directory prefixes and exact entries', () => {
        const files = ['dist/', 'src/scripts/', 'README.md'];
        expect(isShippedPath('dist/scripts/x.js', files)).toBe(true);
        expect(isShippedPath('src/scripts/install-hooks.sh', files)).toBe(true);
        expect(isShippedPath('README.md', files)).toBe(true);
        expect(isShippedPath('internal/secret.js', files)).toBe(false);
    });
});

describe('checkLifecycleTargets — red/green', () => {
    it('RED: the 9.8.0 dead postinstall is flagged', () => {
        const pkg = {
            scripts: { postinstall: 'node dist/scripts/postinstall_gui.js 2>/dev/null || true' },
            files: ['dist/'],
        };
        const errors = checkLifecycleTargets(pkg, () => false);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('dist/scripts/postinstall_gui.js');
        expect(errors[0]).toContain('does not exist');
    });

    it('RED: an existing target outside the files whitelist is flagged', () => {
        const pkg = {
            scripts: { postinstall: 'node internal/never-shipped.js' },
            files: ['dist/'],
        };
        const errors = checkLifecycleTargets(pkg, () => true);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('not covered by the package.json `files` whitelist');
    });

    it('GREEN: the real package.json lifecycle scripts are clean', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')) as {
            scripts?: Record<string, string>;
            files?: string[];
        };
        const errors = checkLifecycleTargets(pkg, (p: string) =>
            fs.existsSync(path.join(REPO_ROOT, p)),
        );
        expect(errors).toEqual([]);
    });

    it('GREEN: non-consumer scripts (build, test) are not scanned', () => {
        const pkg = {
            scripts: { build: 'node tools/does-not-exist.js' },
            files: ['dist/'],
        };
        expect(checkLifecycleTargets(pkg, () => false)).toEqual([]);
    });
});
