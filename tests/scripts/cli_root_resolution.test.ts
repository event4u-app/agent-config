// A `_cli` command must find the package root from the layout it SHIPS in.
//
// The defect, measured 2026-08-06 on a clean `main`:
//
//     $ ./agent-config route:explain "commit this and push to main"
//     route:explain: cannot read …/event4u/dist/router.json: ENOENT
//
// Both routing commands — the two the operator uses to inspect what the router
// does — were dead through the shipped binary while working perfectly under
// `npx tsx`. `cmd_route_explain.ts` and `cmd_route_audit.ts` derived the root
// with three hard-coded parent hops. That is correct from
// `src/scripts/_cli/` (three levels down) and wrong from the precompiled
// `dist/cli-delegate/` (two): three hops from the bundle lands on `<pkg>/..`,
// which for a scoped install is `node_modules/@event4u`.
//
// This repo had already paid for that lesson once: `_lib/package_root.ts`
// exists because the same hop arithmetic turned a 9.11.0 release PR's tarball
// E2E red on both Node majors, and 12 sibling commands were migrated to it.
// These two were left behind, and nothing noticed for one reason — the existing
// `cmd_route_explain.test.ts` imports `build_report` and `render_text`
// directly. Pure functions cannot observe the module-level constant that broke,
// so the suite was green the whole time.
//
// Three layers below, deliberately: a class gate that needs no build, a layout
// assertion that pins the two-vs-three hop asymmetry, and an end-to-end run of
// the real binary.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { describe, expect, it } from 'vitest';

import { PACKAGE_NAME, resolvePackageRoot } from '../../src/scripts/_lib/package_root.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CLI_DIR = path.join(REPO, 'src', 'scripts', '_cli');
const BINARY = path.join(REPO, 'dist', 'cli', 'agent-config.js');

/** The exact wrong construct: a root derived by counting `..` from this module. */
const HOP_COUNTED_ROOT =
  /path\.resolve\(\s*(?:path\.dirname\()?fileURLToPath\(import\.meta\.url\)\)?\s*,\s*(?:'\.\.'\s*,?\s*)+\)/;

describe('no _cli command counts hops to the package root', () => {
  it('every module that derives a root uses the marker-anchored resolver', () => {
    const offenders: string[] = [];
    for (const name of fs.readdirSync(CLI_DIR).sort()) {
      if (!name.endsWith('.ts')) continue;
      const src = fs.readFileSync(path.join(CLI_DIR, name), 'utf8');
      if (HOP_COUNTED_ROOT.test(src) && !src.includes('resolvePackageRoot')) {
        offenders.push(name);
      }
    }
    // Named rather than counted: a bare number invites someone to bump it.
    expect(offenders).toEqual([]);
  });

  it('scans a non-empty population — the gate must not pass by finding nothing', () => {
    const modules = fs.readdirSync(CLI_DIR).filter((f) => f.endsWith('.ts'));
    expect(modules.length).toBeGreaterThan(5);
  });
});

describe('resolvePackageRoot is layout-independent', () => {
  /** A package tree with the marker manifest and both call-site layouts. */
  function pkg(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pkgroot-'));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: PACKAGE_NAME }));
    fs.mkdirSync(path.join(root, 'src', 'scripts', '_cli'), { recursive: true });
    fs.mkdirSync(path.join(root, 'dist', 'cli-delegate'), { recursive: true });
    return root;
  }

  it('resolves from the source layout (three levels down)', () => {
    const root = pkg();
    const from = path.join(root, 'src', 'scripts', '_cli', 'cmd_x.ts');
    expect(fs.realpathSync(resolvePackageRoot(from))).toBe(fs.realpathSync(root));
  });

  it('resolves from the precompiled delegate layout (two levels down) — the case hops got wrong', () => {
    const root = pkg();
    const from = path.join(root, 'dist', 'cli-delegate', 'cmd_x.js');
    expect(fs.realpathSync(resolvePackageRoot(from))).toBe(fs.realpathSync(root));
  });

  it('skips a consumer package.json on the way up', () => {
    const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'consumer-'));
    fs.writeFileSync(path.join(outer, 'package.json'), JSON.stringify({ name: 'some-app' }));
    const root = path.join(outer, 'node_modules', '@event4u', 'agent-config');
    fs.mkdirSync(path.join(root, 'dist', 'cli-delegate'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: PACKAGE_NAME }));
    const from = path.join(root, 'dist', 'cli-delegate', 'cmd_x.js');
    expect(fs.realpathSync(resolvePackageRoot(from))).toBe(fs.realpathSync(root));
  });
});

describe('the shipped binary can actually route', () => {
  const built = fs.existsSync(BINARY);

  it.skipIf(!built)('route:explain reads router.json and reports matches', () => {
    const r = spawnSync('node', [BINARY, 'route:explain', 'commit this and push to main'], {
      encoding: 'utf-8',
      cwd: REPO,
      timeout: 120_000,
    });
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    // The exact failure this test exists for.
    expect(out).not.toMatch(/cannot read .*router\.json/);
    expect(out).toContain('kernel (always active');
    expect(r.status).toBe(0);
  }, 180_000);

  it.skipIf(!built)('route:audit reads router.json too', () => {
    const r = spawnSync('node', [BINARY, 'route:audit'], {
      encoding: 'utf-8',
      cwd: REPO,
      timeout: 120_000,
    });
    expect(`${r.stdout ?? ''}${r.stderr ?? ''}`).not.toMatch(/cannot read .*router\.json/);
  }, 180_000);

  // The two cases above skip on an unbuilt checkout, so on its own this
  // end-to-end layer could go dark exactly the way the defect did. This is the
  // guard on the guard: CI must still build before it runs vitest, or the only
  // coverage that drives the real binary silently stops existing.
  it('CI builds the CLI before the vitest job, so the E2E above is never skipped there', () => {
    const wf = parseYaml(
      fs.readFileSync(path.join(REPO, '.github', 'workflows', 'tests.yml'), 'utf8'),
    ) as { jobs: Record<string, { name?: string; steps?: { run?: string }[] }> };

    const nodeTests = Object.values(wf.jobs).find((j) => (j.name ?? '').startsWith('Node Tests'));
    expect(nodeTests, 'a job named "Node Tests …" must exist in tests.yml').toBeDefined();

    const runs = (nodeTests?.steps ?? []).map((s) => s.run ?? '');
    const buildAt = runs.findIndex((c) => /npm run build\b/.test(c));
    // The job invokes the suite through the npm script, not the binary name.
    const vitestAt = runs.findIndex((c) => /\bvitest\b|npm run test:ts\b/.test(c));
    expect(buildAt, 'Node Tests must run `npm run build`').toBeGreaterThanOrEqual(0);
    expect(vitestAt, 'Node Tests must run the vitest suite').toBeGreaterThanOrEqual(0);
    expect(buildAt).toBeLessThan(vitestAt);
  });
});
