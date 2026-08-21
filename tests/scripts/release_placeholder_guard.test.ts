import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { DERIVED_MARKER, derived_marker_lines } from '../../src/scripts/_lib/release_highlights.js';
import { _placeholder_refusal } from '../../src/scripts/release.js';

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
 * The named failure mode of the fix was "attached to only one release path
 * while another bypasses it". Step 8 reads the changelog only in its
 * tag-creation branch, so `--resume` over a created-but-unpushed tag skips that
 * branch entirely. The wiring block below therefore asserts each of the three
 * call sites SEPARATELY: no single one of them satisfies this file.
 */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RELEASE_TS = path.join(REPO_ROOT, 'src', 'scripts', 'release.ts');

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

describe('_placeholder_refusal — the decision', () => {
    it('permits a curated section', () => {
        expect(_placeholder_refusal('14.8.0', 'tag the release', CURATED)).toBeNull();
    });

    it('refuses a section carrying the marker, naming the version and the action', () => {
        const msg = _placeholder_refusal('14.8.0', 'tag the release', WITH_MARKER);
        expect(msg).not.toBeNull();
        expect(msg!).toContain('14.8.0');
        expect(msg!).toContain('tag the release');
        expect(msg!).toContain(DERIVED_MARKER);
    });

    it('carries the action verbatim, so each call site names its own boundary', () => {
        for (const action of ['push the tag', 'publish the GitHub Release notes']) {
            expect(_placeholder_refusal('14.8.0', action, WITH_MARKER)!).toContain(action);
        }
    });

    it('permits a missing section — a resume must never be blocked by this guard', () => {
        // A missing section is owned by the two existing `die()` calls in steps
        // 8 and 9. If this guard also fired on it, a release whose changelog
        // section genuinely cannot be read would have two different refusals
        // for one cause, and the less informative one would win.
        expect(_placeholder_refusal('14.8.0', 'tag the release', null)).toBeNull();
    });
});

describe('wiring — every irreversible path is guarded, and each independently', () => {
    const source = fs.readFileSync(RELEASE_TS, 'utf-8');

    it('guards the push-only path, which is the --resume bypass', () => {
        // `_tag_exists_local` short-circuits step 8 to skip-or-push. The tag
        // already exists here, so pushing it is the first irreversible act —
        // it is what triggers publish-npm.yml.
        expect(source).toMatch(
            /_refuse_unrewritten_placeholder\(plan\.target, 'push the tag'\);\s*\n\s*_push_tag\(plan\.target\);/,
        );
    });

    it('guards tag creation, before the annotated tag exists', () => {
        expect(source).toMatch(
            /_refuse_unrewritten_placeholder\(plan\.target, 'tag the release', merged!\.body\);\s*\n\s*run\(\['git', 'tag', '-a'/,
        );
    });

    it('guards the GitHub Release notes, read at the tag rather than at plan time', () => {
        expect(source).toMatch(
            /_refuse_unrewritten_placeholder\(\s*plan\.target,\s*'publish the GitHub Release notes',\s*tagged_section!\.body,?\s*\);/,
        );
    });

    it('has exactly three call sites — a fourth path would need its own assertion', () => {
        const calls = source.match(/_refuse_unrewritten_placeholder\(/g) ?? [];
        // 3 call sites + the function's own declaration.
        expect(calls).toHaveLength(4);
    });
});
