// Contract tests for src/scripts/linked_projects_list.ts (py2ts Phase 8).
//
// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Two layers:
//   1. real-repo smoke — the CLI runs cleanly over the actual repo (exit 0,
//      valid JSON) and rejects a bad `--format` (exit 2). Structural only, so
//      it never drifts with the repo's real linked_projects state.
//   2. crafted fixture (a .code-workspace pointing at a sibling git repo) —
//      the three opt-in states (yes / no / undecided) in text + json, pinned
//      via inline snapshots with the tmp paths masked (fully deterministic).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'linked_projects_list.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const runTs = (args: string[]): { stdout: string; stderr: string; status: number | null } => {
    const r = spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    return { stdout: r.stdout, stderr: r.stderr, status: r.status };
};

describe('linked_projects_list — real repo (smoke)', () => {
    it('text + json run cleanly (exit 0, valid JSON)', () => {
        expect(runTs([]).status).toBe(0);
        expect(runTs(['--format', 'json']).status).toBe(0);
        const json = runTs(['--all', '--format', 'json']);
        expect(json.status).toBe(0);
        expect(() => JSON.parse(json.stdout)).not.toThrow();
    });

    it('bad --format exits 2', () => {
        const t = runTs(['--format', 'xml']);
        expect(t.status).toBe(2);
        expect(t.stderr).toContain('xml');
    });
});

describe('linked_projects_list — fixture with a sibling', () => {
    let tmp: string;
    let proj: string;
    let siblingResolved: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lpl-'));
        proj = path.join(tmp, 'proj');
        const sibling = path.join(tmp, 'sibling');
        fs.mkdirSync(proj, { recursive: true });
        fs.mkdirSync(path.join(sibling, '.git'), { recursive: true });
        // realpath so the opt-in path matches Path.resolve() output.
        siblingResolved = fs.realpathSync(sibling);
        fs.writeFileSync(
            path.join(proj, 'ws.code-workspace'),
            JSON.stringify({ folders: [{ path: '../sibling' }] }),
            'utf-8',
        );
        fs.mkdirSync(path.join(proj, 'agents', 'settings'), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    function writeOptIn(include: boolean): void {
        fs.writeFileSync(
            path.join(proj, 'agents', 'settings', '.agent-settings.local.yml'),
            `linked_projects:\n  - path: "${siblingResolved}"\n    include: ${include}\n`,
            'utf-8',
        );
    }

    /** Run tsx over the fixture, assert exit 0, and mask the tmp paths so the
     *  snapshot is host-independent. */
    function out(args: string[]): string {
        const r = runTs(args);
        expect(r.status, r.stderr).toBe(0);
        return r.stdout
            .split(siblingResolved).join('<SIBLING>')
            .split(fs.realpathSync(tmp)).join('<TMP>')
            .split(tmp).join('<TMP>');
    }

    it('opted-in: json + text + --all (pinned)', () => {
        writeOptIn(true);
        expect(out(['--root', proj, '--format', 'json'])).toMatchInlineSnapshot(`
          "{
            "root": "<TMP>/proj",
            "siblings": [
              {
                "path": "<SIBLING>",
                "detected_via": "vscode_workspace",
                "large": false,
                "include": true
              }
            ]
          }
          "
        `);
        expect(out(['--root', proj])).toMatchInlineSnapshot(`
          "| path | detected via | large | opted in |
          |---|---|---|---|
          | <SIBLING> | vscode_workspace | no | yes |
          "
        `);
        expect(out(['--root', proj, '--all'])).toMatchInlineSnapshot(`
          "| path | detected via | large | opted in |
          |---|---|---|---|
          | <SIBLING> | vscode_workspace | no | yes |
          "
        `);
    });

    it('declined: --all surfaces include=no (pinned)', () => {
        writeOptIn(false);
        expect(out(['--root', proj, '--all', '--format', 'json'])).toMatchInlineSnapshot(`
          "{
            "root": "<TMP>/proj",
            "siblings": [
              {
                "path": "<SIBLING>",
                "detected_via": "vscode_workspace",
                "large": false,
                "include": false
              }
            ]
          }
          "
        `);
        expect(out(['--root', proj, '--all'])).toMatchInlineSnapshot(`
          "| path | detected via | large | opted in |
          |---|---|---|---|
          | <SIBLING> | vscode_workspace | no | no |
          "
        `);
        // opted-in-only view is empty
        expect(out(['--root', proj, '--format', 'json'])).toMatchInlineSnapshot(`
          "{
            "root": "<TMP>/proj",
            "siblings": []
          }
          "
        `);
    });

    it('undecided (no opt-in file): --all surfaces undecided (pinned)', () => {
        expect(out(['--root', proj, '--all', '--format', 'json'])).toMatchInlineSnapshot(`
          "{
            "root": "<TMP>/proj",
            "siblings": [
              {
                "path": "<SIBLING>",
                "detected_via": "vscode_workspace",
                "large": false,
                "include": null
              }
            ]
          }
          "
        `);
        expect(out(['--root', proj, '--all'])).toMatchInlineSnapshot(`
          "| path | detected via | large | opted in |
          |---|---|---|---|
          | <SIBLING> | vscode_workspace | no | undecided |
          "
        `);
    });
});
