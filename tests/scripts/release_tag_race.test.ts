// A tag push lost to a concurrent release run must not crash the release.
//
// Step 8's `_tag_exists_remote` is a live check, but it is a check-then-act:
// between it and the push, a parallel `task release -- --resume` can land the
// same tag. Measured 2026-08-09 on 9.28.0 — two resume runs raced, the loser
// died with a raw CalledProcessError although the repository was already in
// exactly the state the run wanted.
//
// The discriminator is pinned here against git's real wording, in both
// directions: the already-exists rejection must be recognised, and every
// other push failure (pre-push gate, credentials, moved branch) must NOT be,
// so a real error is never silently absorbed as "raced".
import { describe, expect, it } from 'vitest';

import { _is_tag_already_exists } from '../../src/scripts/release.js';

describe('_is_tag_already_exists — only the raced-tag case is tolerable', () => {
  it('recognises the remote-rejected cannot-lock-ref wording (the 9.28.0 case, verbatim)', () => {
    const stderr = [
      'To github.com:event4u-app/agent-config.git',
      " ! [remote rejected]     9.28.0 -> 9.28.0 (cannot lock ref 'refs/tags/9.28.0': reference already exists)",
      "error: failed to push some refs to 'github.com:event4u-app/agent-config.git'",
    ].join('\n');
    expect(_is_tag_already_exists(stderr, '')).toBe(true);
  });

  it('recognises the plain rejected already-exists variant', () => {
    const stderr = [
      'To github.com:event4u-app/agent-config.git',
      ' ! [rejected]        9.28.0 -> 9.28.0 (already exists)',
      'hint: Updates were rejected because the tag already exists in the remote.',
    ].join('\n');
    expect(_is_tag_already_exists(stderr, '')).toBe(true);
  });

  it('does NOT treat a pre-push hook rejection as a raced tag', () => {
    const stderr = [
      '❌  Preflight failed. These gates run in CI too, so pushing now buys a',
      '    red run and a fixup re-push.',
      "error: failed to push some refs to 'github.com:event4u-app/agent-config.git'",
    ].join('\n');
    expect(_is_tag_already_exists(stderr, '')).toBe(false);
  });

  it('does NOT treat credentials or protection failures as a raced tag', () => {
    expect(_is_tag_already_exists('remote: Permission to event4u-app/x.git denied', '')).toBe(false);
    expect(
      _is_tag_already_exists('remote: error: GH006: Protected branch update failed', ''),
    ).toBe(false);
  });

  it('does NOT treat a moved branch (non-fast-forward) as a raced tag', () => {
    const stderr = [
      ' ! [rejected]        main -> main (fetch first)',
      'hint: Updates were rejected because the remote contains work that you do not',
    ].join('\n');
    expect(_is_tag_already_exists(stderr, '')).toBe(false);
  });
});
