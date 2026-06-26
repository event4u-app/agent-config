#!/usr/bin/env tsx
/**
 * Host-compliance probe for thin projection (token-saving Phase 0).
 *
 * Thin projection is a CONTRACT WITH THE HOST: a non-kernel rule body is
 * demoted to a router pointer, and the host is trusted to load the body only
 * on trigger-match. On a host that reconstructs rule bodies internally (e.g. a
 * plugin loader that re-inlines everything), thin projection is a silent no-op
 * — so it must be falsified per host before the thin flip ships.
 *
 * This probe has two halves:
 *
 *   MECHANICAL (here, automated): run the real thin projector (`thin_entry`)
 *   on a canary rule fixture and assert the body is replaced by a pointer that
 *   still carries the trigger hint (so the router can select it). This proves
 *   the projector demotes correctly — the prerequisite for any host test.
 *
 *   LIVE (operator gate): install the thin-projected canary into each host,
 *   invoke its keyword, and confirm the host shows the POINTER, not the body.
 *   This is a human-run step (live trigger-eval is a human gate) — the probe
 *   prints the checklist + a results table to fill in.
 *
 * CLI:
 *   ./scripts-run src/scripts/probe_host_compliance           # mechanical check + checklist
 *   ./scripts-run src/scripts/probe_host_compliance --json
 *
 * Exit codes: 0 demotion verified · 1 file error · 2 projector failed to demote.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { thin_entry } from './project_thin_rules.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CANARY = path.join(
  REPO_ROOT,
  'tests/fixtures/host-compliance/host-compliance-canary.md',
);
const CANARY_ID = 'host-compliance-canary';
const SENTINEL = 'CANARY_BODY_SENTINEL_DO_NOT_INLINE';
const KEYWORD = 'xyzzy-canary-probe';
const POINTER_MARKER = 'Routed rule — load the body on trigger-match';

// The supported hosts whose live thin-compliance must be falsified.
const HOSTS = ['claude-code', 'cursor', 'augment'];

export interface DemotionResult {
  ok: boolean;
  pointer_present: boolean;
  body_removed: boolean;
  trigger_hint_preserved: boolean;
  link_present: boolean;
}

/** Assert a thinned canary is a valid pointer (body gone, still selectable). */
export function evaluate_demotion(
  thinned: string,
  opts: { sentinel: string; keyword: string } = { sentinel: SENTINEL, keyword: KEYWORD },
): DemotionResult {
  const pointer_present = thinned.includes(POINTER_MARKER);
  const body_removed = !thinned.includes(opts.sentinel);
  const trigger_hint_preserved = thinned.includes(opts.keyword);
  const link_present = /Body: \[`[^`]+`\]\(/.test(thinned);
  return {
    ok: pointer_present && body_removed && trigger_hint_preserved && link_present,
    pointer_present,
    body_removed,
    trigger_hint_preserved,
    link_present,
  };
}

function operator_checklist(): string {
  const rows = HOSTS.map(
    (h) => `  - [ ] ${h}: fires on \`${KEYWORD}\` AND shows the pointer, NOT the body sentinel`,
  ).join('\n');
  return (
    'LIVE host-compliance step (operator gate — live trigger-eval is human-run):\n' +
    '  1. Set `lean_projection.mode: thin` and run `task generate-tools && task sync`.\n' +
    '  2. Install the projected canary into each host.\n' +
    `  3. Invoke the keyword \`${KEYWORD}\` in a session on each host.\n` +
    '  4. PASS = the rule fires AND the host surfaces the router pointer;\n' +
    `     FAIL = the host surfaces the body sentinel (\`${SENTINEL}\`) → thin\n` +
    '     projection is a no-op there; escalate to the host vendor.\n' +
    'Results:\n' +
    rows +
    '\n'
  );
}

function main(argv: string[]): number {
  const asJson = argv.includes('--json');
  for (const a of argv) {
    if (!['--json', '-h', '--help'].includes(a)) {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
    if (a === '-h' || a === '--help') {
      process.stdout.write('usage: probe_host_compliance [--json]\n');
      return 0;
    }
  }

  let text: string;
  try {
    text = fs.readFileSync(CANARY, 'utf-8');
  } catch {
    process.stderr.write(`error: cannot read canary fixture ${path.relative(REPO_ROOT, CANARY)}\n`);
    return 1;
  }
  const thinned = thin_entry(CANARY_ID, text);
  const result = evaluate_demotion(thinned);

  if (asJson) {
    process.stdout.write(
      JSON.stringify({ ...result, hosts: HOSTS, keyword: KEYWORD, sentinel: SENTINEL }, null, 2) + '\n',
    );
    return result.ok ? 0 : 2;
  }

  process.stdout.write(
    `${result.ok ? '✅' : '❌'}  mechanical demotion: ` +
      `pointer=${result.pointer_present} body-removed=${result.body_removed} ` +
      `hint=${result.trigger_hint_preserved} link=${result.link_present}\n`,
  );
  if (!result.ok) {
    process.stdout.write('❌  the thin projector did NOT demote the canary correctly.\n');
    return 2;
  }
  process.stdout.write('\n' + operator_checklist());
  return 0;
}

const _IS_MAIN =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
