// Contract tests for src/scripts/propose_modules_config.ts (py2ts Phase 8).
//
// Covers the JSON envelope + interactive TTY block on a no-modules root, a
// crafted root with a real `app/Modules/<Module>` dir (candidate-detection +
// suggested-block render), and the argparse error paths. Pure read-only scan;
// never writes.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'propose_modules_config.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

const runTs = (args: string[]) =>
    spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            // ignore
        }
    }
});

/** Mask a temp root so a fixture snapshot is host-independent. Masks the
 *  realpath form FIRST (longest match — macOS resolves /var → /private/var),
 *  then the raw form, then collapses any residual macOS `/private` prefix so
 *  the snapshot is identical on macOS and Linux. */
function mask(s: string, d: string): string {
    let real = d;
    try {
        real = fs.realpathSync(d);
    } catch {
        // dir already gone — nothing to resolve
    }
    return s
        .split(real).join('<TMP>')
        .split(d).join('<TMP>')
        .split('/private<TMP>').join('<TMP>');
}

// The tsx twin is the source of truth (the python original was deleted in the
// teardown). Package-root runs scan the real repo → structural only (drift-free);
// temp-root runs are fully controlled → pinned via masked inline snapshots.
describe('propose_modules_config — CLI contract', () => {
    it('package root: --json is valid, interactive runs (exit 0)', () => {
        const j = runTs(['--project', REPO_ROOT, '--json']);
        expect(j.status, j.stderr).toBe(0);
        expect(() => JSON.parse(j.stdout)).not.toThrow();
        expect(runTs(['--project', REPO_ROOT]).status).toBe(0);
    });

    it('no-modules temp root (pinned)', () => {
        const d = mkTmp();
        const j = runTs(['--project', d, '--json']);
        expect(j.status, j.stderr).toBe(0);
        expect(mask(j.stdout, d)).toMatchInlineSnapshot(`
          "{
            "project_root": "<TMP>",
            "candidates": [],
            "proposed_block": {
              "enabled": false,
              "root_paths": [],
              "namespace_template": "",
              "agent_folder": "agents",
              "skip_dirs": [
                ".module-template",
                ".example"
              ]
            }
          }
          "
        `);
        expect(mask(runTs(['--project', d]).stdout, d)).toMatchInlineSnapshot(`
          "⚠️  No module roots detected.

          Skipping \`modules:\` config. Re-run after adding a module directory (app/Modules/, src/Module/, packages/, internal/, ...).
          "
        `);
    });

    it('root with a laravel module dir (pinned)', () => {
        const d = mkTmp();
        fs.mkdirSync(path.join(d, 'app', 'Modules', 'Billing'), { recursive: true });
        const j = runTs(['--project', d, '--json']);
        expect(j.status, j.stderr).toBe(0);
        expect(mask(j.stdout, d)).toMatchInlineSnapshot(`
          "{
            "project_root": "<TMP>",
            "candidates": [
              {
                "path": "app/Modules",
                "stack": "laravel-hmvc",
                "namespace_template_guess": "App\\\\Modules\\\\{ModuleName}",
                "confidence": "high"
              }
            ],
            "proposed_block": {
              "enabled": true,
              "root_paths": [
                "app/Modules"
              ],
              "namespace_template": "App\\\\Modules\\\\{ModuleName}",
              "agent_folder": "agents",
              "skip_dirs": [
                ".module-template",
                ".example"
              ]
            }
          }
          "
        `);
        expect(mask(runTs(['--project', d]).stdout, d)).toMatchInlineSnapshot(`
          "📦 Detected module-root candidates:

            #  Path              Stack            Confidence  Namespace template
            ─  ────────────────  ───────────────  ──────────  ────────────────────
            1  app/Modules       laravel-hmvc     high        App\\Modules\\{ModuleName}

          Suggested \`modules:\` block (paste into .agent-project-settings.yml):

          modules:
            enabled: true
            root_paths: [app/Modules]
            namespace_template: 'App\\Modules\\{ModuleName}'
            agent_folder: agents
            skip_dirs: [.module-template, .example]
          "
        `);
    });

    it('bad flag + unreachable project root exit 2', () => {
        expect(runTs(['--bogus']).status).toBe(2);
        expect(runTs(['--project', path.join(mkTmp(), 'does-not-exist')]).status).toBe(2);
    });
});
