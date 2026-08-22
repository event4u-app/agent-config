// The gate that catches an executing bundle the source no longer produces.
//
// Its sibling `check_hook_bundle_freshness` compares MTIMES, which is ordering
// and not equivalence. The set it structurally cannot see: an mtime-preserving
// write, a `touch` on the bundle, a `cp -p` restore. Measured 2026-08-21 on the
// real tree — an edit to one constant left `dist/hooks/dispatch.js` at
// 1 139 302 bytes with an untouched mtime and a different digest.
//
// The gate is `local_only` and a declared no-op in CI, so nothing else ever
// exercises it: without this file a rename of `build:hooks`, of `rewriteOutfile`
// or of the outfile path degrades it to a permanent exit 2 or a permanent pass,
// silently. That is the same unreviewable-green class the gate itself exists to
// remove, which is why every branch below is pinned — the red as well as the
// green, since a gate never seen red has unknown sensitivity.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildScript, digestOf, main } from '../../src/scripts/check_hook_bundle_content.js';

/** A tree with a package.json whose `build:hooks` writes a deterministic file. */
function fixture(buildHooks: string | null, bundle: string | null): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hookcontent-'));
  fs.mkdirSync(path.join(root, 'dist', 'hooks'), { recursive: true });
  const pkg: Record<string, unknown> = { name: 'fixture', scripts: {} };
  if (buildHooks !== null) (pkg['scripts'] as Record<string, string>)['build:hooks'] = buildHooks;
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
  if (bundle !== null) fs.writeFileSync(path.join(root, 'dist', 'hooks', 'dispatch.js'), bundle);
  return root;
}

/** A `build:hooks` stand-in: writes `content` to whatever `--outfile=` names. */
function writer(content: string): string {
  return `sh -c 'printf %s ${JSON.stringify(content)} > "$(echo "$0" | sed s/.*--outfile=//)"' --outfile=dist/hooks/dispatch.js`;
}

describe('check_hook_bundle_content', () => {
  it('passes when the executing bundle is byte-identical to a rebuild', () => {
    const root = fixture(writer('BYTES'), 'BYTES');
    expect(main(root)).toBe(0);
  });

  it('FAILS when the bundle differs from what the source produces — the whole point', () => {
    // Same byte count on both sides, so a size check would not see it either.
    const root = fixture(writer('BYTES'), 'BYTEX');
    expect(main(root)).toBe(1);
  });

  it('is insensitive to mtime, which is exactly where the sibling gate is blind', () => {
    const root = fixture(writer('BYTES'), 'BYTEX');
    const live = path.join(root, 'dist', 'hooks', 'dispatch.js');
    // Make the bundle look freshly built. The mtime gate would pass; this must not.
    const future = Date.now() + 60_000;
    fs.utimesSync(live, future / 1000, future / 1000);
    expect(main(root)).toBe(1);
  });

  it('declares a loud no-op when no bundle exists — CI has none, and that is not a failure', () => {
    const root = fixture(writer('BYTES'), null);
    expect(main(root)).toBe(0);
  });

  it('refuses to guess when `build:hooks` is gone, rather than passing', () => {
    expect(main(fixture(null, 'BYTES'))).toBe(2);
  });

  it('refuses to guess when `build:hooks` stops writing the live outfile', () => {
    expect(main(fixture('esbuild --outfile=dist/hooks/somewhere-else.js', 'BYTES'))).toBe(2);
  });

  it('reports exit 2, never a pass, when the rebuild itself fails', () => {
    expect(main(fixture('sh -c "exit 3" --outfile=dist/hooks/dispatch.js', 'BYTES'))).toBe(2);
  });

  it('leaves no probe artefact behind on any path', () => {
    const root = fixture(writer('BYTES'), 'BYTES');
    main(root);
    const left = fs.readdirSync(path.join(root, 'dist', 'hooks')).filter((f) => f.includes('content-check'));
    expect(left).toEqual([]);
  });

  it('buildScript returns null rather than a guess when the script is absent', () => {
    expect(buildScript(fixture(null, null))).toBeNull();
  });

  it('digestOf distinguishes equal-length contents', () => {
    const root = fixture(null, null);
    const a = path.join(root, 'a');
    const b = path.join(root, 'b');
    fs.writeFileSync(a, 'BYTES');
    fs.writeFileSync(b, 'BYTEX');
    expect(digestOf(a)).not.toBe(digestOf(b));
  });
});
