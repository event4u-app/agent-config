// A concern must read the tool fields where the DISPATCHER puts them.
//
// Why this test exists, stated plainly because it is the second instance of
// the same defect.
//
// `_build_envelope` (dispatch_hook.ts) hands every concern
// `{schema_version, platform, event, native_event, session_id,
//   workspace_root, payload, settings}` — the host-shaped tool fields live
// under `payload`. A concern invoked bare by a host sees those same fields at
// the TOP level. A concern that reads only the top level therefore works in
// its own unit test, works when a human pipes a hand-written envelope into it,
// and does nothing at all in production.
//
// Round 2 found and fixed exactly that in `pr_url_reminder` (it had never
// fired). Round 3 ran the sibling search the fix should have triggered and
// found one more, out of the 15 concerns bound to a tool event:
// `design_slop` — proven silent by driving a real P1 side-stripe through both
// envelope shapes (flat: exit 2 + reason; nested: exit 0, nothing).
//
// Scope, stated honestly: this pins the CONTRACT plus the two concerns that
// have a cheap deterministic trigger. It is not a sweep over all 15 — the
// others need per-concern fixtures, and a static "does the source mention
// payload" check would pass `injection_scan` (which survives nesting only via
// a whole-envelope JSON fallback) while proving nothing about the rest. A weak
// gate that scans almost nothing is worse than a named gap.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { _build_envelope } from '../../src/scripts/hooks/dispatch_hook.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

describe('dispatcher envelope contract', () => {
  it('nests the host payload under `payload` and never at the top level', () => {
    const env = _build_envelope(
      {
        platform: 'claude',
        event: 'pre_tool_use',
        native_event: 'PreToolUse',
      } as never,
      JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'a.css', content: 'x' } }),
    );

    // The shape both sides of the boundary must code against.
    expect(env['payload']).toMatchObject({ tool_name: 'Write' });
    expect(env['tool_name']).toBeUndefined();
    expect(env['tool_input']).toBeUndefined();
    expect(env).toHaveProperty('workspace_root');
  });
});

/** Run a concern with a raw stdin envelope; return its exit code + stdout. */
function runConcern(script: string, envelope: unknown): { code: number; out: string } {
  const r = spawnSync('npx', ['tsx', path.join(REPO, script)], {
    input: JSON.stringify(envelope),
    encoding: 'utf-8',
    cwd: REPO,
    timeout: 120_000,
  });
  return { code: r.status ?? -1, out: r.stdout ?? '' };
}

describe('a tool-bound concern behaves identically flat and nested', () => {
  // A real P1 finding (slop-v1-side-stripe): a >1px coloured side border.
  const SLOP = '.card { border-left: 4px solid #7c3aed; padding: 12px; }';

  it('design_slop flags the same write whether the fields are nested or flat', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-envelope-'));
    fs.writeFileSync(
      path.join(root, '.agent-settings.yml'),
      'hooks:\n  design_slop:\n    enabled: true\n',
    );
    const inner = {
      tool_name: 'Write',
      tool_input: { file_path: path.join(root, 'a.css'), content: SLOP },
    };
    const script = 'src/scripts/hooks/design_slop_hook.ts';

    const flat = runConcern(script, { cwd: root, ...inner });
    const nested = runConcern(script, { cwd: root, payload: inner });

    // The flat shape is the pre-existing behaviour — assert it really fires,
    // so a fixture that silently stops triggering cannot make this test vacuous.
    expect(flat.code).toBe(2);
    expect(flat.out).toContain('slop-v1-side-stripe');

    // The regression: under the dispatcher's shape it used to exit 0, silent.
    expect(nested.code).toBe(flat.code);
    expect(nested.out).toContain('slop-v1-side-stripe');
  }, 240_000);
});
