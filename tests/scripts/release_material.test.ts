/**
 * Release-truth Phase 1 — one final source for release material.
 *
 * Pins the single-source derivation (`_lib/release_material.ts`) and the
 * equality gate (`check_release_surface_equality.ts`):
 *
 *   - fixture release with a late-added commit → all four surfaces carry the
 *     same content and the same test count (P1.1 verify)
 *   - seeded one-line divergence → red (P1.2 verify)
 *   - the test count appears in exactly one generated fragment that every
 *     surface includes (P1.3 verify)
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    CURATED_HEAD_INSTRUCTION,
    CURATED_HEAD_INSTRUCTION_COMMENT,
    MIX_RESPONSE_MARKER,
    MIX_RESPONSE_PLACEHOLDER,
    extract_changelog_section,
    normalize_release_text,
    render_mix_response,
    PR_ONLY_END,
    PR_ONLY_START,
    pr_body_from_section,
    release_notes_from_section,
    strip_pr_only_regions,
    strip_pr_wrapper,
    surface_divergence,
    tag_message_from_section,
    TRUNCATION_MARKER,
} from '../../src/scripts/_lib/release_material.js';
import { check_surface_equality } from '../../src/scripts/check_release_surface_equality.js';
import {
    mix_response_blockers,
    publication_blockers,
    section_publication_blockers,
} from '../../src/scripts/_lib/release_highlights.js';
import { render_release_head } from '../../src/scripts/release.js';

const V = '9.99.0';

function changelog(body: string, opts: { linkHeading?: boolean } = {}): string {
    const heading = opts.linkHeading
        ? `## [${V}](https://github.com/event4u-app/agent-config/compare/9.98.0...${V}) (2026-08-03)`
        : `## ${V} (2026-08-03)`;
    return [
        '# Changelog',
        '',
        heading,
        '',
        body,
        '',
        '## [9.98.0](https://github.com/event4u-app/agent-config/compare/9.97.0...9.98.0) (2026-07-20)',
        '',
        '* older content',
        '',
    ].join('\n');
}

const BODY = [
    '### Release highlights',
    '',
    '- **Behaviour changes:** _none_',
    '',
    '### Features',
    '',
    '* **release:** single-source surfaces ([abc1234](https://example))',
    '',
    'Tests: 10056 (+14 since 9.98.0)',
].join('\n');

describe('extract_changelog_section', () => {
    it('extracts plain and compare-link headings, bounded by the next version', () => {
        for (const linkHeading of [false, true]) {
            const section = extract_changelog_section(changelog(BODY, { linkHeading }), V);
            expect(section).not.toBeNull();
            expect(section!.body).toBe(BODY);
            expect(section!.body).not.toContain('older content');
        }
    });

    it('returns null for a version with no heading', () => {
        expect(extract_changelog_section(changelog(BODY), '1.2.3')).toBeNull();
    });

    it('does not match 9.99.10 when asked for 9.99.1 (word boundary)', () => {
        const text = changelog(BODY).replace(`## ${V} `, '## 9.99.10 ');
        expect(extract_changelog_section(text, '9.99.1')).toBeNull();
    });

    // Measured 2026-08-17 on the 14.0.0 release. The run's own era split
    // (`chore(changelog): split era 12.0.x → pre-14.0.0`) collapsed every
    // prior era into `# Era: pre-X — archived` banners appended BELOW the new
    // era, leaving `## [14.0.0]` as the last `##` heading in the file. The
    // bound was "next version heading or end of file", so the section ran to
    // EOF and swallowed 24 banners: the PR body went out at 22,289 chars
    // instead of ~11,500, and the same ~10k of archive pointers reached the
    // GitHub release notes and the annotated tag. The equality gate stayed
    // green throughout — all four surfaces derive from this one function, so
    // they were identically wrong. It fires on every release that splits an
    // era, which is why the bound is now the era banner too.
    //
    // Era banners are level 1 and release entries level 2+ — the same
    // invariant `changelog_release_section_gate.test.ts` pins from the other
    // side, where the gate anchored on the banner instead of the entry.
    it('stops at an era banner when the entry is the last version in the file', () => {
        const text = [
            '# Changelog',
            '',
            '# Era: 9.99.x — current',
            '',
            `## ${V} (2026-08-03)`,
            '',
            BODY,
            '',
            '# Era: pre-9.99.0 — archived',
            '',
            '> All entries before `9.99.0` live in',
            '> [`docs/archive/CHANGELOG-pre-9.99.0.md`](docs/archive/CHANGELOG-pre-9.99.0.md).',
            '',
        ].join('\n');
        const section = extract_changelog_section(text, V)!;
        expect(section.body).toBe(BODY);
        expect(section.body).not.toContain('archived');
        expect(section.body).not.toContain('docs/archive/');
    });

    // The near-miss probes the direction the era arm opened — an earlier stop.
    // `# Era:` is anchored at column 0 and level 1, so a deeper heading and a
    // quoted one both stay inside the body. Without these, tightening the
    // pattern to any `#`-prefixed line would pass unnoticed and truncate a
    // legitimate entry that merely discusses eras.
    // The era bug shipped in TWO places, and only one was found by reading the
    // symptom. `release.ts:_previous_test_count_from_changelog` carried its own
    // `const next_re = /^##\s+\[?\d+\.\d+\.\d+/m` and bounded the previous
    // entry with it — same construct, same blind spot, discovered only by
    // grepping the tree for the literal after fixing the first one. It now
    // imports `NEXT_SECTION_RE`, and that function is not fixture-testable
    // (it reads the module-level CHANGELOG constant), so what is pinned here
    // is the property that made the second instance possible: the boundary is
    // defined once. A re-introduced local copy fails this.
    it('is the only definition of the section boundary in the release sources', () => {
        const root = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
        const copies = ['src/scripts/release.ts', 'src/scripts/_lib/release_material.ts'].flatMap(
            (rel) =>
                fs
                    .readFileSync(path.join(root, rel), 'utf-8')
                    .split('\n')
                    // Matches the shared core of both spellings as source
                    // text — the `(?:…)` form and a bare `/^##\s+\[?\d+…`
                    // copy alike. An earlier version of this filter anchored
                    // on `(?:` and therefore matched only the definition it
                    // was supposed to be counting AGAINST: re-introducing the
                    // copy left it green, which is the one outcome that makes
                    // a pin worse than no pin.
                    .filter((line) => /##\\s\+\\\[\?\\d\+/.test(line))
                    .map((line) => `${rel}: ${line.trim()}`),
        );
        expect(copies).toHaveLength(1);
        expect(copies[0]).toContain('NEXT_SECTION_RE');
    });

    it('does not stop at a deeper or quoted era-shaped line inside the body', () => {
        const bodyWithEraProse = [
            BODY,
            '',
            '#### Era: naming rules',
            '',
            '> # Era: quoted in an example',
            '',
            '* trailing item after the era prose',
        ].join('\n');
        const section = extract_changelog_section(changelog(bodyWithEraProse), V)!;
        expect(section.body).toBe(bodyWithEraProse);
        expect(section.body).toContain('trailing item after the era prose');
    });
});

describe('single source — all four surfaces from one section (P1.1 + P1.3)', () => {
    it('late-added commit reaches every surface with the same test count', () => {
        // Plan-time render happened earlier; the maintainer then lands a late
        // commit and refreshes the entry — the derivations run on the FINAL
        // section, so all four surfaces agree by construction.
        const lateBody = BODY.replace(
            '* **release:** single-source surfaces ([abc1234](https://example))',
            '* **release:** single-source surfaces ([abc1234](https://example))\n' +
                '* **late:** commit added after plan time ([def5678](https://example))',
        ).replace('Tests: 10056 (+14 since 9.98.0)', 'Tests: 10058 (+16 since 9.98.0)');
        const section = extract_changelog_section(changelog(lateBody), V)!;

        const surfaces = [
            section.body, // CHANGELOG entry body
            strip_pr_wrapper(pr_body_from_section(section.body, V), V)!, // PR body middle
            release_notes_from_section(section.body, V), // GitHub release notes
            tag_message_from_section(section.body, V).replace(`release: ${V}\n\n`, '').trimEnd(), // tag message
        ];
        const counts = surfaces.map((s) => /^Tests:\s+(\d+)/mu.exec(s)?.[1]);
        expect(new Set(counts)).toEqual(new Set(['10058']));
        for (const s of surfaces) {
            // The count line appears exactly once per surface — one generated
            // fragment, included everywhere (P1.3).
            expect(s.match(/^Tests:\s+\d+/gmu)).toHaveLength(1);
            expect(surface_divergence(s, section.body)).toBeNull();
        }
        expect(surfaces[3]).toContain('* **late:** commit added after plan time');
    });
});

describe('equality gate (P1.2)', () => {
    it('is green when the PR body was derived from the changelog section', () => {
        const prBody = pr_body_from_section(BODY, V);
        const result = check_surface_equality({
            prBody,
            changelogText: changelog(BODY),
            version: V,
        });
        expect(result).toEqual({ ok: true, reason: null });
    });

    it('accepts the legacy release.py footer on old PR bodies', () => {
        const prBody = `Release ${V}.\n\n${BODY}\n\nCreated by \`scripts/release.py\`.`;
        expect(check_surface_equality({ prBody, changelogText: changelog(BODY), version: V }).ok).toBe(
            true,
        );
    });

    it('goes red on a seeded one-line divergence', () => {
        const seeded = BODY.replace('Tests: 10056', 'Tests: 10054');
        const result = check_surface_equality({
            prBody: pr_body_from_section(seeded, V),
            changelogText: changelog(BODY),
            version: V,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toMatch(/first divergence at line \d+/u);
        expect(result.reason).toContain('10054');
    });

    it('goes red when the changelog section is missing', () => {
        const result = check_surface_equality({
            prBody: pr_body_from_section(BODY, V),
            changelogText: '# Changelog\n\n## 1.0.0 (2020-01-01)\n\n* x\n',
            version: V,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('no section');
    });

    it('goes red on a hand-written PR body (no canonical prefix)', () => {
        const result = check_surface_equality({
            prBody: 'Some hand-written release description.',
            changelogText: changelog(BODY),
            version: V,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('canonical');
    });
});

describe('normalization + truncation tolerance', () => {
    it('normalizes only whitespace — content differences survive', () => {
        expect(normalize_release_text('a  \r\nb\n\n\n\nc\n')).toBe('a\nb\n\nc');
        expect(surface_divergence('a\nb', 'a\nc')).not.toBeNull();
        expect(surface_divergence('a \n\n\nb', 'a\n\nb')).toBeNull();
    });

    it('treats a capped surface as a prefix, not a divergence', () => {
        const truncated =
            BODY.split('\n').slice(0, 5).join('\n') +
            `\n\n> ${TRUNCATION_MARKER}'s 65,536-character body limit — full entry in \`CHANGELOG.md\`._`;
        expect(surface_divergence(truncated, BODY)).toBeNull();
        const wrong = truncated.replace('_none_', '_all_');
        expect(surface_divergence(wrong, BODY)).not.toBeNull();
    });
});

/**
 * Roadmap `road-to-publication-integrity-hard-fail` § Phase 2, Option A.
 *
 * The defect: `render_release_head` wrote the generator's authoring
 * instruction into every changelog section it cut, nothing removed it at
 * release time, and `package.json` `files` carries the bare `CHANGELOG.md` —
 * so the instruction was published to npm. Measured at `23391aec2`:
 * `grep -c 'Curated head: fill before merge' CHANGELOG.md` read 2.
 *
 * The fix moves the reminder into the release-PR body's PR-only region, a
 * surface that is never published, WITHOUT relaxing surface equality anywhere
 * else. The negative cases below are the load-bearing half: they pin that the
 * exclusion is delimiter-bounded and that ordinary divergence still reds.
 */
describe('publication integrity — the authoring instruction (Phase 2, Option A)', () => {
    it('the writer emits no authoring instruction', () => {
        const head = render_release_head({}).join('\n');
        expect(head).not.toContain(CURATED_HEAD_INSTRUCTION);
        expect(head).toContain('### Release highlights');
        // The head still does its job: every label is still rendered.
        expect(head).toMatch(/^- \*\*/mu);
    });

    it('the release-PR body carries the instruction, inside the delimiters', () => {
        const prBody = pr_body_from_section(BODY, V);
        expect(prBody).toContain(CURATED_HEAD_INSTRUCTION);
        const start = prBody.indexOf(PR_ONLY_START);
        const end = prBody.indexOf(PR_ONLY_END);
        expect(start).toBeGreaterThanOrEqual(0);
        expect(end).toBeGreaterThan(start);
        expect(prBody.indexOf(CURATED_HEAD_INSTRUCTION)).toBeGreaterThan(start);
        expect(prBody.indexOf(CURATED_HEAD_INSTRUCTION)).toBeLessThan(end);
    });

    it('the changelog-derived middle of that PR body is exactly the section body', () => {
        const middle = strip_pr_wrapper(pr_body_from_section(BODY, V), V);
        expect(middle).toBe(BODY);
        expect(surface_divergence(middle!, BODY)).toBeNull();
        expect(middle).not.toContain(CURATED_HEAD_INSTRUCTION);
    });

    it('equality is NOT relaxed: a difference outside the region still reds', () => {
        // The failure this pins: excluding the region by relaxing comparison
        // over the whole body would silently drop the release-truth guarantee
        // that the PR body and the changelog say the same thing.
        const seeded = BODY.replace('Tests: 10056', 'Tests: 10054');
        const result = check_surface_equality({
            prBody: pr_body_from_section(seeded, V),
            changelogText: changelog(BODY),
            version: V,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toContain('10054');
    });

    it('an unterminated region is left standing, so it surfaces as divergence', () => {
        // Fail-closed: a half-written delimiter must not swallow the rest of
        // the body into "PR-only" and pass.
        const broken = `Release ${V}.\n\n${PR_ONLY_START}\n${CURATED_HEAD_INSTRUCTION_COMMENT}\n\n${BODY}\n\nCreated by \`src/scripts/release.ts\`.`;
        const middle = strip_pr_wrapper(broken, V);
        expect(middle).toContain(PR_ONLY_START);
        expect(surface_divergence(middle!, BODY)).not.toBeNull();
    });

    it('strips only delimited regions — never a prose match', () => {
        // A legitimate comment that merely looks instruction-shaped survives,
        // which a shape match such as /<!-- .* before merge.* -->/ would eat.
        const other = '<!-- a normal comment that should be kept before merge -->';
        expect(strip_pr_only_regions(`a\n${other}\nb`)).toBe(`a\n${other}\nb`);
        expect(strip_pr_only_regions(`a\n${PR_ONLY_START}\nx\n${PR_ONLY_END}\nb`)).toBe('a\n\nb');
    });

    it('the publish guard refuses a section carrying the instruction', () => {
        const reasons = publication_blockers(`### Release highlights\n\n${CURATED_HEAD_INSTRUCTION_COMMENT}\n\n- **Fixes:** x`, V);
        expect(reasons).toHaveLength(1);
        expect(reasons[0]).toContain(CURATED_HEAD_INSTRUCTION);
        expect(reasons[0]).toContain('published to npm');
    });

    it('the publish guard is silent on a clean section', () => {
        expect(publication_blockers(render_release_head({ Fixes: 'x' }).join('\n'), V)).toEqual([]);
    });

    it('SABOTAGE: restoring the writer emission is caught by the guard', () => {
        // Sensitivity, stated as a test rather than as a claim: the head the
        // writer produced BEFORE this change is refused by the guard that now
        // stands over it. A guard never seen red has unknown sensitivity.
        const restored = [
            '### Release highlights',
            '',
            CURATED_HEAD_INSTRUCTION_COMMENT,
            '- **Fixes:** x',
        ].join('\n');
        expect(publication_blockers(restored, V).length).toBe(1);
    });
});

/**
 * Acceptance over the REAL package, not over a file on disk.
 *
 * A check written against `dist/CHANGELOG.md` would pass while the comment
 * ships: that path does not exist, and `package.json` `files` carries the bare
 * `CHANGELOG.md` — the repository root. Measured at `23391aec2`, the archive
 * member `package/CHANGELOG.md` is byte-identical to the root file and carried
 * the prohibited instruction twice. So the assertion is over EXTRACTED BYTES
 * from a freshly created tarball, and every failure mode below fails closed.
 *
 * `--ignore-scripts` is used because `prepack` runs a full build; it changes
 * neither the file list nor the archive member names.
 */
describe('publication integrity — acceptance over npm pack', () => {
    const REPO = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

    it('the shipped CHANGELOG member carries no authoring instruction', () => {
        const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-pack-'));
        try {
            const packed = spawnSync(
                'npm',
                ['pack', '--ignore-scripts', '--pack-destination', dest],
                { cwd: REPO, encoding: 'utf-8' },
            );
            // (7) pack failure fails closed — never "skip because npm was odd".
            expect(packed.status, packed.stderr).toBe(0);

            // (1) a NEWLY created tarball: `dest` is a fresh mkdtemp, so a
            // stale artefact from an earlier run cannot satisfy this test.
            const tarballs = fs.readdirSync(dest).filter((f) => f.endsWith('.tgz'));
            expect(tarballs).toHaveLength(1);
            const tarball = path.join(dest, tarballs[0]!);

            // (2) exactly one CHANGELOG member, and it is the expected one.
            const listed = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf-8' });
            expect(listed.status, listed.stderr).toBe(0);
            const changelogMembers = listed.stdout
                .split('\n')
                .filter((m) => /(^|\/)CHANGELOG\.md$/u.test(m.trim()));
            expect(changelogMembers).toEqual(['package/CHANGELOG.md']);

            // (5) no dist/ fallback may satisfy this test.
            expect(listed.stdout).not.toContain('package/dist/CHANGELOG.md');

            // (4) extracted bytes, not the file on disk.
            const extracted = spawnSync('tar', ['-xOzf', tarball, 'package/CHANGELOG.md'], {
                encoding: 'utf-8',
                maxBuffer: 64 * 1024 * 1024,
            });
            expect(extracted.status, extracted.stderr).toBe(0);

            // (3) non-empty, and recognisably the release changelog.
            expect(extracted.stdout.length).toBeGreaterThan(1000);
            expect(extracted.stdout).toContain('# Changelog');

            expect(extracted.stdout).not.toContain(CURATED_HEAD_INSTRUCTION);

            // (6) sensitivity, in-test: the same assertion over the same bytes
            // plus one restored instruction line must fail. The out-of-test
            // half — putting the comment back into CHANGELOG.md and watching
            // this spec go red — was run on the branch and is recorded in the
            // PR body.
            const sabotaged = `${extracted.stdout}\n${CURATED_HEAD_INSTRUCTION_COMMENT}\n`;
            expect(sabotaged).toContain(CURATED_HEAD_INSTRUCTION);
        } finally {
            fs.rmSync(dest, { recursive: true, force: true });
        }
    }, 180_000);
});

/**
 * The governance-versus-product obligation, read by the SAME predicate on both
 * sides of the push.
 *
 * 14.17.0 (PR #1856) failed `check_release_highlights` on a missing
 * `> **Governance mix:**` line. Nothing emitted the line and no local guard
 * asked for it, so the earliest possible discovery was the release PR — a
 * property `docs/contracts/CHANGELOG-conventions.md` had recorded as an
 * accepted gap. These specs pin the three pieces that close it: the writer
 * emits, the predicate refuses the writer's own placeholder, and the predicate
 * is the one both guards call.
 */
describe('governance-mix response', () => {
    const V = '9.9.9';
    const LEVEL = 'governance-only 31 vs consumer-only 13 (taxonomy 1.0.0)';
    const head = '### Release highlights\n\n- **Fixes:** x';

    it('is not owed when the obligation did not trigger', () => {
        expect(mix_response_blockers(head, V, '`main`', null)).toEqual([]);
        expect(mix_response_blockers(head, V, '`main`', { triggered: false, level: LEVEL })).toEqual(
            [],
        );
    });

    it('refuses a triggered obligation the section does not answer', () => {
        const out = mix_response_blockers(head, V, '`main`', { triggered: true, level: LEVEL });
        expect(out).toHaveLength(1);
        expect(out[0]).toContain(MIX_RESPONSE_MARKER);
        expect(out[0]).toContain(LEVEL);
    });

    it('refuses the second placeholder too — CHANGELOG.md is published to npm', () => {
        // Deleting only the first token would leave `<roadmap or issue>` in a
        // file `package.json` `files` ships, which is the same failure
        // CURATED_HEAD_INSTRUCTION exists for, one token to the right.
        const half =
            `${head}\n\n> ${MIX_RESPONSE_MARKER} ${LEVEL}.\n` +
            '> Next cycle ships the install flow, tracked in <roadmap or issue>.';
        expect(half).not.toContain(MIX_RESPONSE_PLACEHOLDER);
        const out = mix_response_blockers(half, V, '`main`', { triggered: true, level: LEVEL });
        expect(out).toHaveLength(1);
        expect(out[0]).toContain('<roadmap or issue>');
    });

    it('refuses the writer’s placeholder — an emitted line is not an answer', () => {
        // The measured level alone clears the 40-character floor, so without
        // this the generator would discharge a written-answer obligation for
        // itself. That is the smuggled auto-approval the placeholder prevents.
        const emitted = `${head}\n\n${render_mix_response(LEVEL).join('\n')}`;
        expect(emitted).toContain(MIX_RESPONSE_PLACEHOLDER);
        const out = mix_response_blockers(emitted, V, '`main`', { triggered: true, level: LEVEL });
        expect(out).toHaveLength(1);
        expect(out[0]).toContain(MIX_RESPONSE_PLACEHOLDER);
    });

    it('accepts a written answer', () => {
        const answered =
            `${head}\n\n> ${MIX_RESPONSE_MARKER} ${LEVEL}.\n` +
            '> Next cycle ships the consumer-facing install flow, tracked in road-to-install-ux.';
        expect(mix_response_blockers(answered, V, '`main`', { triggered: true, level: LEVEL })).toEqual(
            [],
        );
    });

    it('refuses a bare marker with no answer after it', () => {
        const bare = `${head}\n\n> ${MIX_RESPONSE_MARKER}\n`;
        const out = mix_response_blockers(bare, V, '`main`', { triggered: true, level: LEVEL });
        expect(out).toHaveLength(1);
    });

    it('reaches the section-level predicate the guards call', () => {
        // The head-level predicate stays usable with a bare head (the prefill
        // specs pass fragments); the section level is what the three guard
        // sites read, and it is where the tests footer joins the mix response.
        const section = `${head}\n\nTests: 100 (+1 since 9.9.8)`;
        expect(publication_blockers(section, V)).toEqual([]);
        const blocked = section_publication_blockers(section, V, '`main`', {
            triggered: true,
            level: LEVEL,
        });
        expect(blocked.some((b) => b.includes(MIX_RESPONSE_MARKER))).toBe(true);
    });

    it('refuses a section that lost its Tests footer', () => {
        const out = section_publication_blockers(head, V);
        expect(out.some((b) => b.includes('Tests: N'))).toBe(true);
    });
});
