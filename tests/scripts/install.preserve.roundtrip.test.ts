// Preservation across REPEATED installs — the seam Phase 5.1 shipped without.
//
// `install.preserve.test.ts` covers one run: it hand-writes a manifest, calls
// the copy loop once, and asserts the edit survived. Every one of its cases
// passes while preservation is good for exactly one install, because none of
// them ever lets the installer REWRITE the manifest and then runs again.
//
// That gap is the whole defect these cases exist for. The manifest is rebuilt
// from the paths the copy loop actually wrote, a preserved path is by
// definition not one of them, and the recorded digest is what proves the file
// is a user edit rather than ours. Losing it downgrades the next run's verdict
// to `unknown`, and `unknown` overwrites — silently, exit 0.
//
// So these drive the real cycle: install, edit, install, install. Expectations
// are derived from the fixture bytes held in the test, never pinned literals.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as inst from '../../src/scripts/install.js';
import { readRecordedByTool } from '../../src/install/manifestFiles.js';
import { EXIT_COMPLETED_WITH_CONFLICTS, sidecarPathFor } from '../../src/install/preserve.js';

const TOOL = 'claude-code';

describe('install — preservation survives repeated installs', () => {
    let fakeHome: string;
    let prevHome: string | undefined;
    let prevManifest: string | undefined;
    let prevQuiet: boolean;
    let root: string;
    let src: string;
    let dest: string;
    let source: string;
    let target: string;
    let manifest: string;

    /**
     * One full install: copy the package tree, then rebuild the manifest from
     * the result exactly as `main()` does, and fold conflicts into the rc.
     */
    function install(force = false): number {
        inst.tracker.begin(root);
        const [written, skipped, paths] = inst._copy_dir_dereferencing_symlinks(src, dest, force);
        inst._update_installed_tools_manifest(
            root,
            new Set([TOOL]),
            'project',
            force,
            inst._files_by_tool_from_deploy({ [TOOL]: [written, skipped, 'deployed', paths] }),
        );
        return inst.tracker.finalizeRc(0);
    }

    /** Every digest the manifest now records, keyed by resolved path. */
    function recorded(): Map<string, unknown> {
        const out = new Map<string, unknown>();
        for (const inv of readRecordedByTool(manifest, root).values()) {
            for (const file of inv.files) out.set(file.resolved, file.entry['sha256']);
        }
        return out;
    }

    /** Publish a new package version. */
    function publish(content: string): void {
        fs.writeFileSync(source, content);
    }

    beforeEach(() => {
        fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'roundtrip-home-'));
        prevHome = process.env['HOME'];
        process.env['HOME'] = fakeHome;
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'roundtrip-root-'));
        manifest = path.join(root, 'installed-tools.lock');
        prevManifest = process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
        process.env['AGENT_CONFIG_INSTALLED_TOOLS'] = manifest;
        prevQuiet = inst.state.QUIET;
        inst.state.QUIET = true;
        src = path.join(root, 'pkg');
        dest = path.join(root, 'deployed');
        source = path.join(src, 'AGENTS.md');
        target = path.join(dest, 'AGENTS.md');
        fs.mkdirSync(src, { recursive: true });
        fs.mkdirSync(dest, { recursive: true });
    });

    afterEach(() => {
        if (prevHome === undefined) delete process.env['HOME'];
        else process.env['HOME'] = prevHome;
        if (prevManifest === undefined) delete process.env['AGENT_CONFIG_INSTALLED_TOOLS'];
        else process.env['AGENT_CONFIG_INSTALLED_TOOLS'] = prevManifest;
        inst.state.QUIET = prevQuiet;
        inst.tracker.begin(null);
        fs.rmSync(fakeHome, { recursive: true, force: true });
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('keeps preserving a user edit across a third install (install → edit → install → install)', () => {
        const edit = '# v1\nmy own note\n';

        publish('# v1\n');
        expect(install()).toBe(0);
        expect(fs.readFileSync(target, 'utf8')).toBe('# v1\n');

        fs.writeFileSync(target, edit);

        publish('# v2\n');
        expect(install()).toBe(EXIT_COMPLETED_WITH_CONFLICTS);
        expect(fs.readFileSync(target, 'utf8')).toBe(edit);

        // The run that preserved the edit must still record a digest for it.
        // Dropping it here is what re-armed the overwrite one run later.
        expect(recorded().has(path.resolve(target))).toBe(true);

        publish('# v3\n');
        const rc = install();

        // The assertion the feature is FOR: a third install still does not
        // destroy the edit, and still says the installation is not current.
        expect(fs.readFileSync(target, 'utf8')).toBe(edit);
        expect(rc).toBe(EXIT_COMPLETED_WITH_CONFLICTS);
        expect(inst.tracker.conflictState.preserved).toEqual([target]);
    });

    it('refreshes a sidecar it staged for an older version instead of aborting', () => {
        const edit = '# v1\nmy own note\n';

        publish('# v1\n');
        install();
        fs.writeFileSync(target, edit);

        publish('# v2\n');
        install();
        expect(fs.readFileSync(sidecarPathFor(target), 'utf8')).toBe('# v2\n');

        // A new version lands while the v2 sidecar is still unmerged — which is
        // the staging workflow working, not a foreign file. The run completes
        // and the sidecar now carries the CURRENT package content.
        publish('# v3\n');
        const rc = install();

        expect(rc).toBe(EXIT_COMPLETED_WITH_CONFLICTS);
        expect(fs.readFileSync(sidecarPathFor(target), 'utf8')).toBe('# v3\n');
        expect(fs.readFileSync(target, 'utf8')).toBe(edit);
    });

    it('still refuses a sidecar path holding bytes it cannot attribute to itself', () => {
        const edit = '# v1\nmy own note\n';

        publish('# v1\n');
        install();
        fs.writeFileSync(target, edit);
        fs.writeFileSync(sidecarPathFor(target), 'someone else wrote this\n');

        publish('# v2\n');

        expect(() => install()).toThrow();
        // The refusal is only worth having if it leaves both files alone.
        expect(fs.readFileSync(sidecarPathFor(target), 'utf8')).toBe('someone else wrote this\n');
        expect(fs.readFileSync(target, 'utf8')).toBe(edit);
    });

    it('a --force run after a preserved one replaces the file and clears the conflict', () => {
        const edit = '# v1\nmy own note\n';

        publish('# v1\n');
        install();
        fs.writeFileSync(target, edit);
        publish('# v2\n');
        expect(install()).toBe(EXIT_COMPLETED_WITH_CONFLICTS);

        expect(install(true)).toBe(0);
        expect(fs.readFileSync(target, 'utf8')).toBe('# v2\n');

        // And the forced write is recorded, so the NEXT install sees an
        // unmodified managed file rather than an unknown one.
        publish('# v3\n');
        expect(install()).toBe(0);
        expect(fs.readFileSync(target, 'utf8')).toBe('# v3\n');
    });

    it('does not erase the recorded digests of a tool this run did not install', () => {
        publish('# v1\n');
        install();

        const other = path.join(dest, 'OTHER.md');
        fs.writeFileSync(other, '# other\n');
        const entries = [
            ...(readRecordedByTool(manifest, root).get(TOOL)?.files.map((f) => f.entry) ?? []),
        ];
        expect(entries.length).toBeGreaterThan(0);

        // Record a second tool, then install only the first one again.
        const text = fs.readFileSync(manifest, 'utf8');
        fs.writeFileSync(
            manifest,
            `${text}  - name: cursor\n    scope: project\n    bridge_marker: .cursorrules\n` +
                `    installed_at: "2026-01-01"\n    files:\n      - path: ${other}\n` +
                `        kind: deployed\n        sha256: deadbeef\n`,
        );

        publish('# v2\n');
        install();

        expect(recorded().has(path.resolve(other))).toBe(true);
    });
});
