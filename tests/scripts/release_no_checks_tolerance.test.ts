// "No checks reported" means two different things. Only one of them is safe.
//
// `watch_pr_checks` accepted both: a repo that configures no required checks
// (nothing will ever arrive — accepting is right) and a repo whose checks have
// not been dispatched yet (accepting merges, tags and publishes unvalidated).
//
// Measured 2026-08-06/07: during a critical GitHub Actions incident
// (15:22–02:04 UTC; webhook triggers throttled from 20:34) pull_request events
// arrived 15–30 minutes late. The waiter's grace period is five seconds. The
// 9.26.0 release therefore ran the whole way through — tag, GitHub Release,
// npm publish — on a PR whose checks had not started. It was safe only because
// `main` happened to be independently green at that commit, which is luck, not
// a gate.
//
// The branch's own protection rules tell the two apart, so both halves are
// pinned here: the parser that reads them, and the decision that follows.
import { describe, expect, it } from 'vitest';

import { _no_checks_action, _required_contexts_from_rules } from '../../src/scripts/release.js';

describe('_required_contexts_from_rules — reads the ruleset, not the legacy API', () => {
  it('extracts every required context from the effective-rules payload', () => {
    const payload = JSON.stringify([
      { type: 'deletion' },
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: [
            { context: 'Sync + Generate Tools Consistency', integration_id: 15368 },
            { context: 'Tests' },
          ],
        },
      },
    ]);
    expect(_required_contexts_from_rules(payload)).toEqual([
      'Sync + Generate Tools Consistency',
      'Tests',
    ]);
  });

  it('returns [] for a branch with rules but no required checks', () => {
    expect(_required_contexts_from_rules(JSON.stringify([{ type: 'non_fast_forward' }]))).toEqual(
      [],
    );
  });

  it('degrades to [] on an error payload, unparseable text, or a non-array', () => {
    // The classic protection endpoint answers this for a ruleset-protected
    // branch — the exact shape that must not be read as "checks required".
    expect(_required_contexts_from_rules('{"message":"Branch not protected"}')).toEqual([]);
    expect(_required_contexts_from_rules('not json')).toEqual([]);
    expect(_required_contexts_from_rules('')).toEqual([]);
  });

  it('skips malformed context entries rather than emitting empty strings', () => {
    const payload = JSON.stringify([
      {
        type: 'required_status_checks',
        parameters: { required_status_checks: [{ context: '' }, { nope: 1 }, { context: 'ok' }] },
      },
    ]);
    expect(_required_contexts_from_rules(payload)).toEqual(['ok']);
  });
});

describe('_no_checks_action — tolerance only where nothing is expected', () => {
  it('accepts immediately when the branch requires no checks (pre-existing behaviour)', () => {
    expect(_no_checks_action([], 0, 10)).toBe('accept');
    expect(_no_checks_action([], 99, 10)).toBe('accept');
  });

  it('waits while required checks are declared but absent — the incident case', () => {
    const required = ['Sync + Generate Tools Consistency'];
    expect(_no_checks_action(required, 0, 10)).toBe('retry');
    expect(_no_checks_action(required, 9, 10)).toBe('retry');
  });

  it('refuses rather than releasing blind once the budget is spent', () => {
    expect(_no_checks_action(['Sync + Generate Tools Consistency'], 10, 10)).toBe('die');
    expect(_no_checks_action(['a', 'b'], 11, 10)).toBe('die');
  });

  it('never answers accept while a required check is outstanding, at any round', () => {
    // The property that matters: no round number may reproduce the old
    // unconditional accept once something IS expected.
    for (let round = 0; round < 25; round++) {
      expect(_no_checks_action(['x'], round, 10)).not.toBe('accept');
    }
  });
});
