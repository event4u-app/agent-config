// A failed release push must show the reason it failed.
//
// `push_release_branch` was written for one real failure — the remote ref
// moved under us, repaired by fetch + merge + retry (measured 2026-08-03,
// 9.15.0). It then took that path for EVERY non-zero push, and the recovery's
// first step is `git fetch origin <branch>`, which exits 128 for a branch that
// was never pushed.
//
// Measured 2026-08-06 on 9.26.0: a pre-push gate rejected the push, and the
// operator saw
//
//     fatal: couldn't find remote ref release/9.26.0
//     CalledProcessError: Command 'git fetch origin release/9.26.0' … status 128
//
// The gate's own message never reached them. An hour went into the git layer
// before anyone looked at the layer that had actually refused.
//
// Measured 2026-08-17 on the 13.0.0 release, the mirror failure: the recovery
// did NOT engage for a ref that had genuinely moved. Two `--resume` runs
// overlapped, run A pushed the era-split plus main-merge head, run B had
// snapshotted the remote before that and pushed after, so the server refused
// the ref transaction and quoted the stale expectation back:
//
//     ! [remote rejected]  release/13.0.0 -> release/13.0.0
//       (cannot lock ref 'refs/heads/release/13.0.0': is at dbd2efb9e
//        but expected 11ab66bba)
//
// Neither half of the discriminator matched. `[remote rejected]` does not
// contain the literal `[rejected]`, and the reason phrase was in no list — so
// the classifier said false and the caller asserted "the remote ref did not
// move" one line after printing an error stating that it had. The operator was
// sent to pre-push gates, credentials and branch protection, none of which were
// involved, while the repair sat directly below the check that refused it.
//
// Widening the marker to admit `[remote rejected]` also admits server-side hook
// declines, which print the identical marker. The reason list therefore stays
// the discriminator, and a `pre-receive hook declined` is pinned false below —
// a near-miss probing the direction that widening opened, not one that was
// already closed (the 9.26.0 case above carries no marker at all, so it could
// not have caught an over-broad marker).
//
// The narrative lives here rather than in `release.ts` because `src/**/*.ts`
// carries a growth ratchet (`check_source_size_budget`) and `tests/` does not —
// the same reason the 9.26.0 case above is documented here.
//
// So the discriminator is pinned here against git's real wording, in both
// directions: the recovery must engage for a moved ref and must NOT engage for
// anything else.
import { afterEach, describe, expect, it } from 'vitest';

import { DERIVED_MARKER } from '../../src/scripts/_lib/release_highlights.js';
import { _is_non_fast_forward, _set_changelog_reader } from '../../src/scripts/release.js';
import {
  guard_release_branch_push,
  guard_release_curation,
} from '../../src/scripts/release_publication.js';

describe('_is_non_fast_forward — only the moved-ref case takes the retry path', () => {
  it('recognises the classic non-fast-forward rejection', () => {
    const stderr = [
      'To github.com:event4u-app/agent-config.git',
      ' ! [rejected]        release/9.26.0 -> release/9.26.0 (non-fast-forward)',
      "error: failed to push some refs to 'github.com:event4u-app/agent-config.git'",
      'hint: Updates were rejected because the tip of your current branch is behind',
      'hint: its remote counterpart. Integrate the remote changes (e.g.',
    ].join('\n');
    expect(_is_non_fast_forward(stderr, '')).toBe(true);
  });

  it('recognises the fetch-first variant git emits for a moved remote', () => {
    const stderr = [
      ' ! [rejected]        main -> main (fetch first)',
      'hint: Updates were rejected because the remote contains work that you do not',
      'hint: have locally.',
    ].join('\n');
    expect(_is_non_fast_forward(stderr, '')).toBe(true);
  });

  it('does NOT treat a pre-push hook rejection as a moved ref — the 9.26.0 case', () => {
    const stderr = [
      '❌  .claude/skills: 27 of 288 authored skill(s) never reached the host tree',
      '   Push blocked — fix the failures above and re-push.',
      "error: failed to push some refs to 'github.com:event4u-app/agent-config.git'",
    ].join('\n');
    // `error: failed to push some refs` alone must not arm the recovery —
    // that line is common to every push failure, which is exactly how the
    // hook rejection got misread as a moved ref.
    expect(_is_non_fast_forward(stderr, '')).toBe(false);
  });

  it('recognises the stale-lease rejection two concurrent resume runs produce — the 13.0.0 case', () => {
    // Measured 2026-08-17. Run A pushed the era-split + main-merge head; run B
    // had snapshotted the remote before that and pushed after, so the server
    // quoted the client's stale expectation back. The ref HAD moved and the
    // fetch + merge + retry was the repair — but the marker is
    // `[remote rejected]`, which does not contain the literal `[rejected]`,
    // and the reason phrase was in no list, so the recovery never engaged.
    const stderr = [
      'To github.com:event4u-app/agent-config.git',
      ' ! [remote rejected]     release/13.0.0 -> release/13.0.0 ' +
        "(cannot lock ref 'refs/heads/release/13.0.0': is at " +
        'dbd2efb9e9388b500a49bd189f7e37318bc59bc7 but expected ' +
        '11ab66bbae8f052fc83a51b0def90c9abb075b8a)',
      "error: failed to push some refs to 'github.com:event4u-app/agent-config.git'",
    ].join('\n');
    expect(_is_non_fast_forward(stderr, '')).toBe(true);
  });

  it('does NOT treat a server-side hook decline as a moved ref — same marker, different reason', () => {
    // The direction the `[remote rejected]` widening opens. A pre-receive hook
    // decline carries the identical marker, so if the reason list ever stops
    // being the discriminator this goes green and the recovery fires on a
    // refusal it cannot repair.
    const stderr = [
      'To github.com:event4u-app/agent-config.git',
      ' ! [remote rejected]     main -> main (pre-receive hook declined)',
      "error: failed to push some refs to 'github.com:event4u-app/agent-config.git'",
    ].join('\n');
    expect(_is_non_fast_forward(stderr, '')).toBe(false);
  });

  it('does NOT treat missing credentials or a protected branch as a moved ref', () => {
    expect(_is_non_fast_forward('remote: Permission to event4u-app/x.git denied', '')).toBe(false);
    expect(
      _is_non_fast_forward(
        'remote: error: GH006: Protected branch update failed for refs/heads/main.',
        '',
      ),
    ).toBe(false);
    expect(_is_non_fast_forward('fatal: Authentication failed', '')).toBe(false);
  });

  it('reads stdout too — git splits push reporting across both streams', () => {
    expect(_is_non_fast_forward('', ' ! [rejected]  x -> x (fetch first)')).toBe(true);
  });

  it('is false on empty output rather than defaulting into the retry path', () => {
    expect(_is_non_fast_forward('', '')).toBe(false);
  });
});

// ── The push guard: refuse the FIRST remote state, not the release PR ────────
//
// Measured 2026-09-02 on PR #1812 (14.14.0): the 2026-09-01 flip made an
// unrewritten `_auto-derived, rewrite before merge:_` head line block the
// release PR, and nothing in the pipeline asked for the rewrite before the
// pipeline created remote state. So the run pushed the branch, opened the PR,
// waited on `Curated highlights plausible against the span`, and died on a
// check that could not pass — the flip's own risk register had pre-registered
// this as Risk 1 and named "the releaser edits prose before merge" as the
// mitigation.
//
// `guard_release_branch_push` moves the refusal to the branch push, which is
// the first thing in the pipeline that leaves the machine. What has to be
// pinned is BOTH directions: it refuses the state that shipped eighteen marker
// lines, and it stays silent everywhere a push has nothing to do with the
// section under release — otherwise a correctness guard on the only path to
// publishing becomes a permanent red on unrelated pushes.
describe('guard_release_branch_push — refuses before any remote state, and only there', () => {
  const MARKED = [
    '# Changelog',
    '',
    '## [9.9.9]',
    '',
    '### Release highlights',
    '',
    `- **Behaviour changes:** ${DERIVED_MARKER} rule/schema diffs in abc1234.`,
    '',
    '## [0.0.0]',
    '',
    '- earlier release',
    '',
  ].join('\n');

  const CLEAN = MARKED.replace(
    `- **Behaviour changes:** ${DERIVED_MARKER} rule/schema diffs in abc1234.`,
    '- **Behaviour changes:** the comment gate now blocks in source (abc1234).',
  );

  afterEach(() => {
    _set_changelog_reader(null);
  });

  it('refuses the push when the section under release still carries the draft marker', () => {
    _set_changelog_reader(() => MARKED);
    expect(() => guard_release_branch_push('release/9.9.9')).toThrow();
  });

  it('passes a curated section straight through', () => {
    _set_changelog_reader(() => CLEAN);
    expect(() => guard_release_branch_push('release/9.9.9')).not.toThrow();
  });

  it('ignores a branch that is not a release branch', () => {
    // The guard sits inside the shared push helper, so a non-release push must
    // not inherit a release precondition.
    _set_changelog_reader(() => MARKED);
    expect(() => guard_release_branch_push('feat/some-work')).not.toThrow();
  });

  it('is scoped to the section under release — a marked OTHER section does not block', () => {
    // Roadmap § 1.3, from the other side: eighteen historical marker lines
    // exist. A repo-wide read here would refuse every future release push.
    _set_changelog_reader(() => MARKED);
    expect(() => guard_release_branch_push('release/1.2.3')).not.toThrow();
  });
});

// The fifth guard site. `guard_release_branch_push` refuses before any REMOTE
// state exists; it cannot refuse before LOCAL state exists, because by the time
// a push is attempted step 2 has bumped six files and regenerated the derived
// trees and step 3 has committed all of it as `release: X.Y.Z`. Measured on
// 14.14.1 (2026-09-03): the run died at step 4/10 having already produced
// `136cea960 release: 14.14.1`, so the operator curated prose on top of a
// commit that already claimed to be the release.
//
// The sentence being closed is in the push guard's own docstring — the flip's
// risk register named "the releaser edits prose before merge" as the mitigation
// and "nothing in the pipeline asked, so nothing did". Refusing is not asking.
//
// Pinned in both directions for the same reason as its sibling: a guard on the
// only path to a release must refuse the draft AND stay silent on everything
// else, or every release stops on a state that is already correct.
describe('guard_release_curation — asks before the release commit exists', () => {
  const MARKED_HEAD = [
    '# Changelog',
    '',
    '## [9.9.9]',
    '',
    '### Release highlights',
    '',
    `- **Behaviour changes:** ${DERIVED_MARKER} rule/schema diffs in abc1234.`,
    `- **Security and correctness:** ${DERIVED_MARKER} fixes to executable surface in def5678.`,
    '- **Honest nulls:** _none_',
    '',
    '## [0.0.0]',
    '',
    '- earlier release',
    '',
  ].join('\n');

  const CURATED_HEAD = MARKED_HEAD.split('\n')
    .map((l) =>
      l.includes(DERIVED_MARKER)
        ? '- **Behaviour changes:** the comment gate now blocks in source (abc1234).'
        : l,
    )
    .join('\n');

  afterEach(() => {
    _set_changelog_reader(null);
  });

  it('refuses while the head is still the generator draft', () => {
    _set_changelog_reader(() => MARKED_HEAD);
    expect(() => guard_release_curation('9.9.9')).toThrow();
  });

  it('names every marked line, so the operator does not hunt for them', () => {
    // The point of a pre-commit ask over a pre-push refusal is that the next
    // action is an edit. A message that says "a marker is present" without
    // saying WHERE is the friction that made the refusal read as a failure.
    // `die` writes the operator-facing text to stderr and then throws a bare
    // SystemExitError, so the thrown value carries none of it. Asserting on the
    // exception would pass against an empty message — the failure this catches
    // is a guard that stops the release and says nothing useful.
    _set_changelog_reader(() => MARKED_HEAD);
    const written: string[] = [];
    const original = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
    try {
      expect(() => guard_release_curation('9.9.9')).toThrow();
    } finally {
      process.stderr.write = original;
    }
    const msg = written.join('');
    expect(msg).toContain('Behaviour changes');
    expect(msg).toContain('Security and correctness');
    expect(msg).toContain('Stopped BEFORE committing');
  });

  it('passes a curated head straight through', () => {
    _set_changelog_reader(() => CURATED_HEAD);
    expect(() => guard_release_curation('9.9.9')).not.toThrow();
  });

  it('is scoped to the version under release — a marked OTHER section is not its business', () => {
    // Eighteen historical marker lines exist in this repo's own changelog. A
    // whole-file read here would stop every future release before step 3.
    _set_changelog_reader(() => MARKED_HEAD);
    expect(() => guard_release_curation('1.2.3')).not.toThrow();
  });

  it('stays silent when the version has no section at all', () => {
    // Same division of labour as the push guard: a missing section is the
    // publication sites' refusal to make, not this one's.
    _set_changelog_reader(() => '# Changelog\n');
    expect(() => guard_release_curation('9.9.9')).not.toThrow();
  });
});
