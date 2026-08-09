// The hook-bundle healer's two pure seams, pinned against real shapes.
//
// The build command is READ from package.json (single home for the esbuild
// flag set) with only `--outfile=` rewritten — so the rewrite must work on
// the real script string as committed, and must refuse loudly when the
// expected token is gone. The probe contract exists because exit 0 alone is
// NOT proof of a working dispatcher: a bundle that cannot resolve its
// manifest answers "manifest missing" with exit 0 (measured 2026-08-08).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { probeVerdict, rewriteOutfile } from '../../src/scripts/rebuild_hook_bundle.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('rewriteOutfile — the committed build:hooks script is the contract', () => {
  it('rewrites the real package.json build:hooks outfile and nothing else', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf-8')) as {
      scripts: Record<string, string>;
    };
    const script = pkg.scripts['build:hooks'] as string;
    const rewritten = rewriteOutfile(script, path.join('dist', 'hooks', 'dispatch.new.js'));
    expect(rewritten).not.toBeNull();
    expect(rewritten).toContain('--outfile=dist/hooks/dispatch.new.js');
    expect(rewritten).not.toContain('--outfile=dist/hooks/dispatch.js');
    // The banner and defines must survive untouched — they are the fix for
    // the esbuild CLI-guard collision and the bundle path-depth switch.
    expect(rewritten).toContain('--banner:js=');
    expect(rewritten).toContain('--define:__AGENT_CONFIG_BUNDLE__=true');
  });

  it('returns null when the expected outfile token is absent (changed package.json fails loudly)', () => {
    expect(rewriteOutfile('esbuild x.ts --outfile=somewhere/else.js', 'dist/hooks/dispatch.new.js')).toBeNull();
  });
});

describe('probeVerdict — exit 0 alone is not a working dispatcher', () => {
  it('passes the real dry-run shape: exit 0 + JSON with non-empty concerns', () => {
    const stdout = JSON.stringify({
      platform: 'claude',
      event: 'pre_tool_use',
      concerns: ['block-no-verify', 'rtk-wrap'],
    });
    expect(probeVerdict(0, stdout)).toBeNull();
  });

  it('fails a non-zero exit', () => {
    expect(probeVerdict(1, '{}')).toMatch(/exited 1/);
  });

  it('fails the manifest-missing shape (exit 0, non-JSON prose) — the 2026-08-08 trap', () => {
    expect(probeVerdict(0, 'dispatch_hook: manifest missing at /tmp/x/hook_manifest.yaml')).toMatch(
      /not JSON/,
    );
  });

  it('fails JSON that dispatched nothing (no concerns)', () => {
    expect(probeVerdict(0, JSON.stringify({ platform: 'claude', concerns: [] }))).toMatch(
      /no concerns/,
    );
    expect(probeVerdict(0, '{}')).toMatch(/no concerns/);
  });
});
