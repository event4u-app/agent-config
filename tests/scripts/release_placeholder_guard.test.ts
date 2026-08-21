import { describe, expect, it } from 'vitest';

import { DERIVED_MARKER, derived_marker_lines } from '../../src/scripts/_lib/release_highlights.js';
import {
    pr_body_from_section,
    release_notes_from_section,
    tag_message_from_section,
} from '../../src/scripts/_lib/release_material.js';

/**
 * Publication guard for the auto-derived highlight placeholder
 * (road-to-wiring-truth-corrections Phase 2).
 *
 * The defect: `check_release_highlights` detects a surviving marker and prints
 * `advisory, not blocking` — the exit code there is owned solely by the
 * `_none_` check, deliberately, because a blocking check on a fresh release
 * branch is red by construction. Nothing refused the marker at the boundary
 * where it stops being recoverable, and it has shipped into published
 * changelogs.
 *
 * The guard sits on the two RENDERERS, not on call sites in `release.ts`. The
 * named failure mode of the fix was "attached to only one release path while
 * another bypasses it", and the bypass is real: step 8 reads the changelog only
 * in its tag-creation branch, so `--resume` over a created-but-unpushed tag
 * skips it. Guarding what RENDERS the shipping text covers every path by
 * construction, and the last describe block below pins the one renderer that
 * must NOT refuse.
 */

const CURATED = [
    '### Highlights',
    '',
    '- **Runtime** — the dispatcher now budgets per turn.',
    '- **Governance** — the estate ratchet walks down.',
].join('\n');

const WITH_MARKER = [
    '### Highlights',
    '',
    `- **Runtime** — ${DERIVED_MARKER} 4 commits touched the dispatcher.`,
    '- **Governance** — the estate ratchet walks down.',
].join('\n');

describe('derived_marker_lines — the body-level predicate', () => {
    it('finds nothing in a curated section', () => {
        expect(derived_marker_lines(CURATED)).toEqual([]);
    });

    it('returns the offending line, trimmed, so the message can name it', () => {
        const hits = derived_marker_lines(WITH_MARKER);
        expect(hits).toHaveLength(1);
        expect(hits[0]).toContain(DERIVED_MARKER);
        expect(hits[0]).toBe(hits[0]!.trim());
    });

    it('is not fooled by a section that merely mentions the word derived', () => {
        expect(derived_marker_lines('- **Runtime** — a derived value, rewritten.')).toEqual([]);
    });
});

describe('tag_message_from_section — the first irreversible render', () => {
    it('renders a curated section', () => {
        expect(tag_message_from_section(CURATED, '14.8.0')).toContain('release: 14.8.0');
    });

    it('refuses a section carrying the marker, naming the version and the action', () => {
        expect(() => tag_message_from_section(WITH_MARKER, '14.8.0')).toThrow(/14\.8\.0/u);
        expect(() => tag_message_from_section(WITH_MARKER, '14.8.0')).toThrow(/tag the release/u);
    });

    it('names the offending line so the fix is one edit', () => {
        expect(() => tag_message_from_section(WITH_MARKER, '14.8.0')).toThrow(
            new RegExp(DERIVED_MARKER.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'),
        );
    });

    it('renders an empty section — a missing body is a different guard problem', () => {
        // The two die() calls in release.ts steps 8 and 9 own the missing-section
        // case. If this guard also fired on it, one cause would have two
        // refusals and the less informative one could win.
        expect(tag_message_from_section('', '14.8.0')).toBe('release: 14.8.0\n');
    });
});

describe('release_notes_from_section — the publication render', () => {
    it('renders a curated section', () => {
        expect(release_notes_from_section(CURATED, '14.8.0')).toBe(CURATED);
    });

    it('refuses a section carrying the marker, with its own action named', () => {
        expect(() => release_notes_from_section(WITH_MARKER, '14.8.0')).toThrow(
            /publish the GitHub Release notes/u,
        );
    });

    it('is independent of the tag render — the --resume path reaches only this one', () => {
        // On --resume over an existing local tag, step 8 short-circuits to
        // skip-or-push and no tag message is rendered at all. This renderer is
        // then the only thing between the marker and a published release, so it
        // must refuse on its own rather than relying on the tag path.
        expect(() => release_notes_from_section(WITH_MARKER, '14.8.0')).toThrow();
    });
});

describe('pr_body_from_section — the recorded advisory decision, preserved', () => {
    it('does NOT refuse a marked section', () => {
        // On a fresh release branch the highlights are auto-derived first and
        // curated afterwards, so the marker legitimately exists here. Making
        // this renderer refuse would red every release PR by construction — the
        // guaranteed-red failure mode check_release_highlights recorded its
        // advisory posture to avoid. This assertion is what keeps a later
        // "be consistent, guard all three" edit from reversing that decision.
        expect(() => pr_body_from_section(WITH_MARKER, '14.8.0')).not.toThrow();
        expect(pr_body_from_section(WITH_MARKER, '14.8.0')).toContain(DERIVED_MARKER);
    });
});
