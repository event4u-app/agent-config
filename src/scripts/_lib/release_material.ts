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

/**
 * The generator's authoring instruction, identified by ONE named sentinel.
 *
 * Roadmap `road-to-publication-integrity-hard-fail` § Phase 2, Option A. Until
 * 2026-09-01 `render_release_head` wrote this comment into every changelog
 * section it cut, and nothing removed it at release time — so it shipped. At
 * that commit `grep -c 'Curated head: fill before merge' CHANGELOG.md` read 2,
 * and `package.json` `files` carries the bare `"CHANGELOG.md"`, which is the
 * npm-published artifact. The instruction now lives in the release-PR body,
 * which is never published, and the writer emits none.
 *
 * **A sentinel, deliberately not a shape match.** A council seat warned that a
 * pattern such as `/<!-- .* should(?: only)? be .* -->/` is overbroad and
 * under-specified: it rejects unrelated legitimate comments while missing the
 * prohibited instruction after harmless rewording. This follows the discipline
 * `DERIVED_MARKER` already follows — one definition, imported by every
 * consumer, including the gates that refuse on it.
 */
export const CURATED_HEAD_INSTRUCTION = 'Curated head: fill before merge';

/**
 * The full authoring instruction as the release-PR body carries it.
 *
 * Parameterized rather than importing `RELEASE_HEAD_CAP_LINES` / `HEAD_NONE`,
 * because this module has no imports and that is load-bearing: it is the one
 * place the equality gate, the drill fixtures and the unit tests all reach, so
 * a dependency here is a dependency in all three.
 */
/**
 * Cap on curated-head lines, and the placeholder a label carries when the
 * answer is genuinely nothing.
 *
 * Relocated here from `release.ts` on 2026-09-01 with the instruction text:
 * this module builds the release-PR body, so the instruction and the two
 * values it interpolates belong on the same side of the import boundary. The
 * generator re-exports `RELEASE_HEAD_CAP_LINES` under its original name, so
 * nothing that referenced it there has to change.
 */
export const RELEASE_HEAD_CAP_LINES = 10;

/**
 * The fallback value of a head line the span does not substantiate.
 *
 * `_none_` and not a placeholder token: where nothing was derived it is the
 * **true** answer, and a release that genuinely changed no defaults should say
 * so rather than carry an unfilled marker.
 *
 * It is a fallback and no longer a blanket default. Writing `_none_` into
 * every field made the generator assert five things it had not checked, and
 * `check_release_highlights` rejected exactly that assertion the moment the
 * span contradicted it — which for this package is every release, because every
 * release touches `src/rules/` or `src/scripts/schemas/`. Substantiated labels
 * are now pre-filled from the span (`_derive_head_prefill`), so the tool states
 * only what it can support and `_none_` means what it says.
 */
export const RELEASE_HEAD_DEFAULT = '_none_';

export function render_curated_head_instruction(capLines: number, headDefault: string): string {
    return (
        `<!-- ${CURATED_HEAD_INSTRUCTION}, keep it under ${capLines} lines, and leave ` +
        `\`${headDefault}\` where it is genuinely the answer. The generated log below is ` +
        'unchanged. -->'
    );
}

/** The instruction exactly as the release-PR body carries it. */
export const CURATED_HEAD_INSTRUCTION_COMMENT = render_curated_head_instruction(
    RELEASE_HEAD_CAP_LINES,
    RELEASE_HEAD_DEFAULT,
);

/**
 * Delimiters bounding the release-PR-only region.
 *
 * The region exists so the PR body can carry something the changelog must not,
 * WITHOUT relaxing surface equality anywhere else. `strip_pr_wrapper` removes
 * exactly what sits between these two markers and nothing else — never a prose
 * match, never a whole-body relaxation. Relaxing equality wholesale would
 * remove the release-truth guarantee that the PR body and the changelog say
 * the same thing, which is a larger floor than the one this change
 * strengthens.
 *
 * An UNTERMINATED region is deliberately left in place: it then surfaces as an
 * ordinary divergence instead of silently swallowing the rest of the body.
 */
export const PR_ONLY_START = '<!-- release-pr-only:start -->';
export const PR_ONLY_END = '<!-- release-pr-only:end -->';

/** Remove every complete PR-only region. Delimiter-bounded, never a prose match. */
export function strip_pr_only_regions(s: string): string {
    const out: string[] = [];
    let rest = s;
    for (;;) {
        const i = rest.indexOf(PR_ONLY_START);
        if (i === -1) {
            out.push(rest);
            break;
        }
        const j = rest.indexOf(PR_ONLY_END, i + PR_ONLY_START.length);
        if (j === -1) {
            // Unterminated — leave it standing so equality reports it.
            out.push(rest);
            break;
        }
        out.push(rest.slice(0, i));
        rest = rest.slice(j + PR_ONLY_END.length);
    }
    return out.join('');
}

/** Footer appended to the release-PR body; the strip helper accepts legacy variants. */
export const PR_BODY_FOOTER = 'Created by `src/scripts/release.ts`.';
const _LEGACY_PR_FOOTERS = ['Created by `scripts/release.py`.', PR_BODY_FOOTER];

/** Marker `_cap_body` embeds when a surface was truncated to a GitHub limit. */
export const TRUNCATION_MARKER = '_Changelog truncated to fit GitHub';

/**
 * Release-PR body derived from the (possibly capped) changelog-section body.
 *
 * Carries the authoring instruction inside the PR-only region. The region is
 * emitted unconditionally rather than passed in by each caller: there are two
 * PR-creation paths (`release.ts` and `release_publication.ts`), and a caller
 * that forgot the argument would silently ship a PR with no reminder — the
 * failure this change exists to make impossible, reintroduced one level up.
 */
export function pr_body_from_section(cappedBody: string, version: string): string {
    const prOnly = `${PR_ONLY_START}\n${CURATED_HEAD_INSTRUCTION_COMMENT}\n${PR_ONLY_END}`;
    return `Release ${version}.\n\n${prOnly}\n\n${cappedBody}\n\n${PR_BODY_FOOTER}`;
}

/** GitHub-release notes derived from the (possibly capped) changelog-section body. */
export function release_notes_from_section(cappedBody: string, version: string): string {
    return cappedBody || `Release ${version}`;
}

/** Annotated-tag message derived from the merged changelog-section body. */
export function tag_message_from_section(body: string, version: string): string {
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
    // Delimiter-bounded, before the footer walk: the region is PR-only material
    // by construction, so it is removed from the comparison rather than
    // compared. Everything outside it still has to match the changelog.
    s = strip_pr_only_regions(s);
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
