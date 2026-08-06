// The gate that catches a merged-but-unbuilt hook fix.
//
// The failure it encodes, measured 2026-08-06: PR #1195 merged four hook fixes
// (language-mirror pin, git-authorization ledger, evidence-independence,
// pr-url-reminder). The self-hosted `dist/hooks/dispatch.js` those hooks
// actually execute from was built at 05:27 UTC the same morning — before any
// of them existed. Ten hook sources were newer than the bundle, and in the
// session that shipped the language fix the conformance scanner still counted
// four German-prompt / English-reply violations. The fix was merged, correct,
// and not loaded, and no gate, test, or workflow said so.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { bundledSources, check } from '../../src/scripts/check_hook_bundle_freshness.js';

/** A minimal tree with the three inputs the gate reads. */
function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hookfresh-'));
  fs.mkdirSync(path.join(root, 'src', 'scripts', 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist', 'hooks'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'scripts', 'hook_manifest.yaml'),
    'schema_version: 1\nconcerns:\n  demo:\n    script: src/scripts/demo_hook.ts\n',
  );
  fs.writeFileSync(path.join(root, 'src', 'scripts', 'demo_hook.ts'), '// concern\n');
  fs.writeFileSync(path.join(root, 'src', 'scripts', 'hooks', 'a.ts'), '// hook\n');
  return root;
}

function touch(file: string, whenMs: number): void {
  fs.utimesSync(file, whenMs / 1000, whenMs / 1000);
}

describe('check_hook_bundle_freshness', () => {
  it('counts a concern script outside hooks/ as bundled — the manifest decides, not the directory', () => {
    const root = fixture();
    const srcs = bundledSources(root);
    expect(srcs).toContain('src/scripts/demo_hook.ts');
    expect(srcs).toContain(path.join('src', 'scripts', 'hooks', 'a.ts'));
    expect(srcs).toContain(path.join('src', 'scripts', 'hook_manifest.yaml'));
  });

  it('reports skipped — never stale — when the repo runs no self-hosted bundle', () => {
    const root = fixture();
    const r = check(root); // dist/hooks/dispatch.js deliberately not created
    expect(r.skipped).toBe(true);
    expect(r.stale).toEqual([]);
    // A fresh checkout / CI must not be told to rebuild something it does not use.
    expect(r.checked).toBe(0);
  });

  it('passes when the bundle is newer than every source it bundles', () => {
    const root = fixture();
    const bundle = path.join(root, 'dist', 'hooks', 'dispatch.js');
    fs.writeFileSync(bundle, '// built\n');
    const t = Date.now();
    for (const rel of bundledSources(root)) touch(path.join(root, rel), t - 60_000);
    touch(bundle, t);

    const r = check(root);
    expect(r.skipped).toBe(false);
    expect(r.stale).toEqual([]);
    expect(r.checked).toBeGreaterThan(0); // never a vacuous pass
  });

  it('names every source newer than the bundle — the round-2 situation', () => {
    const root = fixture();
    const bundle = path.join(root, 'dist', 'hooks', 'dispatch.js');
    fs.writeFileSync(bundle, '// built\n');
    const t = Date.now();
    // Age everything behind the bundle first, so the assertion below is about
    // the ONE edited file and not about fixture creation order.
    for (const rel of bundledSources(root)) touch(path.join(root, rel), t - 120_000);
    touch(bundle, t - 60_000);
    // One edited hook is enough to invalidate the running dispatcher.
    touch(path.join(root, 'src', 'scripts', 'hooks', 'a.ts'), t);

    const r = check(root);
    expect(r.stale.map((s) => s.file)).toEqual([path.join('src', 'scripts', 'hooks', 'a.ts')]);
    // The untouched sources must NOT be reported — a gate that lists everything
    // teaches the reader to ignore it.
    expect(r.stale).toHaveLength(1);
    expect(r.checked).toBeGreaterThan(1);
  });

  it('treats an equal mtime as fresh — only a strictly newer source is stale', () => {
    const root = fixture();
    const bundle = path.join(root, 'dist', 'hooks', 'dispatch.js');
    fs.writeFileSync(bundle, '// built\n');
    const t = Date.now();
    for (const rel of bundledSources(root)) touch(path.join(root, rel), t);
    touch(bundle, t);

    expect(check(root).stale).toEqual([]);
  });
});
