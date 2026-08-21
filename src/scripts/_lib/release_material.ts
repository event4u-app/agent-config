import { derived_marker_lines } from './release_highlights.js';

/**
 * Single-source release material (release-truth Phase 1).
 *
 * The recorded 9.14.0 failure: PR body, CHANGELOG entry, GitHub release
 * body, and tag metadata were generated at different times from different
 * scopes — the PR body said 10,054 tests while the merged changelog carried
 * 10,056 and more items. The fix is structural: the CHANGELOG section at the
 * relevant head is the ONE final source, and every other surface is a pure
 * derivation of it (release.ts re-derives on branch update / resume / merge,
 * so late commits cannot desynchronize the surfaces).
 *
 * Everything here is a pure function of strings so the equality gate
 * (`check_release_surface_equality.ts`) and the fixture tests exercise the
 * exact production code paths.
 */

export interface ChangelogSection {
    /** The `## …` heading line, verbatim. */
    heading: string;
    /** Section content below the heading, outer blank lines stripped. */
    body: string;
}

/**
 * Where a changelog section ends: the next release entry OR the next era
 * banner. Era banners are level 1 and release entries level 2+ — the same
 * invariant the release-validation `changelog-entry` gate relies on, and the
 * one `lint_changelog_rollback` / `lint_breaking_changes_index` already encode
 * as `/^##? /`. Without the era arm the newest entry runs to end-of-file after
 * a split, which leaves it as the last `##` heading above archived banners.
 *
 * Exported because release.ts bounds the previous entry the same way, and two
 * copies of a boundary is how one of them stays wrong.
 */
export const NEXT_SECTION_RE = /^(?:##\s+\[?\d+\.\d+\.\d+|# Era:)/m;

function _reEscape(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the CHANGELOG section for `version` — heading plus body up to the
 * next version heading or era banner (or end of file). Returns null when no
 * heading for `version` exists. Matches both heading shapes the generator
 * emits (`## X.Y.Z (date)` and `## [X.Y.Z](compare-url) (date)`).
 */
export function extract_changelog_section(text: string, version: string): ChangelogSection | null {
    const headingRe = new RegExp(`^##\\s+\\[?${_reEscape(version)}\\b.*$`, 'm');
    const m = headingRe.exec(text);
    if (!m) {
        return null;
    }
    const bodyStart = m.index + m[0].length;
    const rest = text.slice(bodyStart);
    const next = NEXT_SECTION_RE.exec(rest);
    const sectionEnd = bodyStart + (next ? next.index : rest.length);
    const body = text
        .slice(bodyStart, sectionEnd)
        .replace(/^\n+/u, '')
        .replace(/\s+$/u, '');
    return { heading: m[0], body };
}

/** Footer appended to the release-PR body; the strip helper accepts legacy variants. */
export const PR_BODY_FOOTER = 'Created by `src/scripts/release.ts`.';
const _LEGACY_PR_FOOTERS = ['Created by `scripts/release.py`.', PR_BODY_FOOTER];

/** Marker `_cap_body` embeds when a surface was truncated to a GitHub limit. */
export const TRUNCATION_MARKER = '_Changelog truncated to fit GitHub';

/** Release-PR body derived from the (possibly capped) changelog-section body. */
export function pr_body_from_section(cappedBody: string, version: string): string {
    return `Release ${version}.\n\n${cappedBody}\n\n${PR_BODY_FOOTER}`;
}

/**
 * Publication guard — refuse to render shipping text that still carries the
 * auto-derived highlight placeholder.
 *
 * `check_release_highlights` already detects a surviving marker on a release PR
 * and deliberately does NOT own the exit code there: on a fresh release branch
 * the highlights are derived first and curated afterwards, so a blocking check
 * at that point would be red by construction. That recorded decision stands and
 * is not reversed — note that `pr_body_from_section` above is NOT guarded, for
 * exactly that reason. What was missing is a refusal at the boundary where the
 * marker stops being recoverable, and the marker has shipped into published
 * changelogs.
 *
 * The guard sits on the two RENDERERS rather than on call sites in `release.ts`,
 * and that is the stronger shape rather than a convenience. The named failure
 * mode of the fix was "attached to only one release path while another bypasses
 * it" — and the bypass is real: `release.ts` step 8 reads the changelog only in
 * its tag-creation branch, so `--resume` over a created-but-unpushed tag skips
 * that branch entirely. Guarding the renderers covers every path that produces
 * shipping text by construction, and a future call site inherits the refusal
 * instead of needing its own.
 *
 * It throws rather than returning a verdict because there is no rendered value
 * that would be correct to return: the caller is about to tag, or to publish
 * release notes, and both are irreversible.
 */
function _refuse_placeholder(body: string, version: string, action: string): void {
    const offenders = derived_marker_lines(body);
    if (offenders.length === 0) {
        return;
    }
    throw new Error(
        `CHANGELOG section for ${version} still carries unrewritten auto-derived ` +
            `highlight line(s) — refusing to ${action}:\n` +
            offenders.map((l) => `    ${l}`).join('\n') +
            `\n  Rewrite them in CHANGELOG.md, then re-run with --resume. The ` +
            `release-PR check reports this as advisory on purpose; publication is ` +
            `where it is refused.`,
    );
}

/** GitHub-release notes derived from the (possibly capped) changelog-section body. */
export function release_notes_from_section(cappedBody: string, version: string): string {
    _refuse_placeholder(cappedBody, version, 'publish the GitHub Release notes');
    return cappedBody || `Release ${version}`;
}

/** Annotated-tag message derived from the merged changelog-section body. */
export function tag_message_from_section(body: string, version: string): string {
    _refuse_placeholder(body, version, 'tag the release');
    const trailer = body ? `\n\n${body}` : '';
    return `release: ${version}${trailer}\n`;
}

/**
 * Inverse of `pr_body_from_section`: return the changelog-derived middle of a
 * release-PR body, or null when the body does not carry the canonical
 * `Release X.Y.Z.` prefix (then it was not generated by this pipeline).
 */
export function strip_pr_wrapper(prBody: string, version: string): string | null {
    const prefix = `Release ${version}.`;
    let s = prBody.replace(/\r\n/gu, '\n').trim();
    if (!s.startsWith(prefix)) {
        return null;
    }
    s = s.slice(prefix.length);
    for (const footer of _LEGACY_PR_FOOTERS) {
        if (s.trimEnd().endsWith(footer)) {
            s = s.trimEnd();
            s = s.slice(0, s.length - footer.length);
            break;
        }
    }
    return s.replace(/^\n+/u, '').replace(/\s+$/u, '');
}

/**
 * Whitespace/anchor normalization — deliberately nothing stronger, per the
 * roadmap lock ("not 'similar', equal"): CRLF → LF, trailing whitespace per
 * line dropped, runs of blank lines collapsed to one, outer blank lines
 * trimmed. Content differences always survive normalization.
 */
export function normalize_release_text(s: string): string {
    return s
        .replace(/\r\n/gu, '\n')
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/u, ''))
        .join('\n')
        .replace(/\n{3,}/gu, '\n\n')
        .replace(/^\n+/u, '')
        .replace(/\n+$/u, '');
}

/**
 * Compare a derived release surface against the changelog-section body it
 * must equal. Returns null when equal (after normalization), else a
 * human-readable first-divergence report. A truncated surface (carrying the
 * `_cap_body` notice) is compared as a prefix of the changelog side — the
 * truncation itself is not a divergence.
 */
export function surface_divergence(surfaceText: string, changelogBody: string): string | null {
    const a = normalize_release_text(surfaceText);
    const b = normalize_release_text(changelogBody);
    if (a.includes(TRUNCATION_MARKER)) {
        const cut = a.indexOf(TRUNCATION_MARKER);
        const prefix = a
            .slice(0, cut)
            .replace(/>\s*$/u, '')
            .replace(/\n+$/u, '');
        if (b.startsWith(prefix)) {
            return null;
        }
        return _first_diff(prefix, b.slice(0, prefix.length));
    }
    if (a === b) {
        return null;
    }
    return _first_diff(a, b);
}

function _first_diff(a: string, b: string): string {
    const al = a.split('\n');
    const bl = b.split('\n');
    const n = Math.max(al.length, bl.length);
    for (let i = 0; i < n; i++) {
        if (al[i] !== bl[i]) {
            return (
                `first divergence at line ${i + 1}: ` +
                `surface=${JSON.stringify(al[i] ?? '<missing>')} ` +
                `changelog=${JSON.stringify(bl[i] ?? '<missing>')}`
            );
        }
    }
    return 'surfaces differ only in normalization-invisible content';
}
