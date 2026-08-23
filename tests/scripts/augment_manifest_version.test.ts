// The .augment-plugin/ manifests are version-synced to package.json.
//
// road-to-skill-link-integrity-and-manifest-sync Phase 2 Step 1. Both files
// ship in the npm tarball (`src/config/publish-surface.json` roots) and both
// carried `version: 1.0.0` while package.json moved to 14.x, with no process
// owning that number: lint_marketplace opened only the .claude-plugin twin,
// check_release_pr_shape allowlisted only that twin, and release.ts bumped only
// that twin. Nothing in the tree ever claimed 1.0.0 was an independent
// plugin-API version.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { check_augment_manifests } from '../../src/scripts/lint_marketplace.js';
import { set_augment_manifest_version } from '../../src/scripts/release.js';

const REPO = path.resolve(import.meta.dirname, '..', '..');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'aug-ver-'));
    fs.mkdirSync(path.join(tmp, '.augment-plugin'), { recursive: true });
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFixture(version: string): void {
    fs.writeFileSync(
        path.join(tmp, '.augment-plugin', 'plugin.json'),
        JSON.stringify({ name: 'agent-config', version }, null, 2) + '\n',
        'utf-8',
    );
    fs.writeFileSync(
        path.join(tmp, '.augment-plugin', 'marketplace.json'),
        JSON.stringify(
            {
                name: 'event4u-agent-config',
                version,
                metadata: { description: 'd', version },
                plugins: [{ name: 'agent-config', version, source: '.' }],
            },
            null,
            2,
        ) + '\n',
        'utf-8',
    );
}

describe('augment manifest version sync', () => {
    it('the real tree carries the package.json version in both manifests', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as {
            version: string;
        };
        const errors: string[] = [];
        check_augment_manifests(pkg.version, errors, REPO);
        expect(errors).toEqual([]);
    });

    // Sensitivity: the fixture pinned at 1.0.0 is the state the tree shipped in.
    // All four version fields must be reported, not just the first.
    it('is red on a fixture pair pinned at 1.0.0', () => {
        writeFixture('1.0.0');
        const errors: string[] = [];
        check_augment_manifests('14.10.0', errors, tmp);
        expect(errors).toHaveLength(4);
        expect(errors.join('\n')).toContain('plugin.json: version `1.0.0`');
        expect(errors.join('\n')).toContain('marketplace.json: metadata.version `1.0.0`');
        expect(errors.join('\n')).toContain('marketplace.json: plugins[0].version `1.0.0`');
    });

    it('release.ts bumps every version field in both manifests', () => {
        writeFixture('1.0.0');
        set_augment_manifest_version(path.join(tmp, '.augment-plugin', 'plugin.json'), '99.0.0');
        set_augment_manifest_version(
            path.join(tmp, '.augment-plugin', 'marketplace.json'),
            '99.0.0',
        );
        const errors: string[] = [];
        check_augment_manifests('99.0.0', errors, tmp);
        expect(errors).toEqual([]);
    });

    // The trigger-without-reader gap: the workflow re-ran on a drift in these
    // files and then no job read them.
    it('the release workflow both triggers on and reads both augment manifests', () => {
        const wf = fs.readFileSync(
            path.join(REPO, '.github', 'workflows', 'release-validation.yml'),
            'utf-8',
        );
        expect(wf).toContain("- '.augment-plugin/marketplace.json'");
        expect(wf).toContain("- '.augment-plugin/plugin.json'");
        expect(wf).toContain(".augment-plugin/plugin.json'");
        // the version-consistency step must jq-read both files
        expect(wf).toContain("jq -r '.version' .augment-plugin/plugin.json");
        expect(wf).toContain("jq -r '.metadata.version' .augment-plugin/marketplace.json");
    });

    it('a release PR may carry both augment manifests', () => {
        const shape = fs.readFileSync(
            path.join(REPO, 'src', 'scripts', 'check_release_pr_shape.ts'),
            'utf-8',
        );
        expect(shape).toContain("'.augment-plugin/plugin.json'");
        expect(shape).toContain("'.augment-plugin/marketplace.json'");
    });
});
