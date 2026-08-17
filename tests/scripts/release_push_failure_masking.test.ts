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
// So the discriminator is pinned here against git's real wording, in both
// directions: the recovery must engage for a moved ref and must NOT engage for
// anything else.
import { describe, expect, it } from 'vitest';

import { _is_non_fast_forward } from '../../src/scripts/release.js';

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
