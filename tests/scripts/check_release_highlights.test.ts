/**
 * Highlight plausibility gate (release-truth Phase 2) — the three
 * pre-registered fixtures:
 *
 *   - span with a `fix(security)` commit + curated
 *     `Security and correctness: _none_` → red
 *   - correctly curated head → green
 *   - empty span with `_none_` everywhere → green
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
    _parse_git_log,
    derive_categories,
    HEAD_LABELS,
    highlight_contradictions,
    main,
    parse_curated_head,
    type SpanCommit,
} from '../../src/scripts/check_release_highlights.js';
import {
    DERIVED_MARKER,
    derive_category_hits,
    render_derived_head_values,
    stale_draft_labels,
} from '../../src/scripts/_lib/release_highlights.js';
import { render_release_head } from '../../src/scripts/release.js';
import { CURATED_HEAD_INSTRUCTION_COMMENT } from '../../src/scripts/_lib/release_material.js';

const SHA = 'a'.repeat(40);

function commit(overrides: Partial<SpanCommit>): SpanCommit {
    return {
        sha: SHA,
        subject: 'chore: routine',
        body: '',
        files: [],
        breaking: false,
        ...overrides,
    };
}

const ALL_NONE: Record<string, string> = Object.fromEntries(
    HEAD_LABELS.map((label) => [label, '_none_']),
);

describe('label parity with the generator', () => {
    it('parses every label render_release_head emits, and no other', () => {
        const head = render_release_head({}).join('\n');
        const parsed = parse_curated_head(head)!;
        expect(Object.keys(parsed).sort()).toEqual([...HEAD_LABELS].sort());
        expect(new Set(Object.values(parsed))).toEqual(new Set(['_none_']));
    });
});

describe('highlight_contradictions — pre-registered fixtures', () => {
    it('red: fix(security) commit meets a _none_ security field', () => {
        const derived = derive_categories([
            commit({ subject: 'fix(security): confine symlink traversal in catalog walk' }),
        ]);
        const contradictions = highlight_contradictions(ALL_NONE, derived);
        expect(contradictions.map((c) => c.label)).toEqual(['Security and correctness']);
        expect(contradictions[0]!.evidence[0]).toContain('fix(security)');
    });

    it('green: correctly curated head (field filled, not _none_)', () => {
        const derived = derive_categories([
            commit({ subject: 'fix(security): confine symlink traversal in catalog walk' }),
        ]);
        const curated = {
            ...ALL_NONE,
            'Security and correctness': 'symlink traversal in the catalog walk confined',
        };
        expect(highlight_contradictions(curated, derived)).toEqual([]);
    });

    it('green: empty span with _none_ everywhere', () => {
        expect(highlight_contradictions(ALL_NONE, derive_categories([]))).toEqual([]);
    });
});

describe('derive_categories — per-label rules', () => {
    it('behaviour changes from breaking commits, rule/schema diffs, removed public surface', () => {
        const derived = derive_categories([
            commit({ subject: 'feat!: change default routing', breaking: true }),
            commit({
                subject: 'feat(rules): tighten scope-control',
                files: [{ status: 'M', path: 'src/rules/scope-control.md' }],
            }),
            commit({
                subject: 'chore: drop the intent trigger type',
                files: [{ status: 'D', path: 'src/skills/old-skill/SKILL.md' }],
            }),
        ]);
        expect(derived['Behaviour changes']).toHaveLength(3);
        expect(derived['Behaviour changes']!.at(-1)).toContain('removes src/skills/old-skill/SKILL.md');
    });

    it('honest nulls from subject or multi-line body markers', () => {
        const derived = derive_categories([
            commit({ subject: 'docs: record honest null for A3 validator' }),
            commit({ subject: 'chore: verdict', body: 'first line\nrecorded as an honest-null.' }),
        ]);
        expect(derived['Honest nulls']).toHaveLength(2);
    });

    it('default changes from whole-word default/migration subjects only', () => {
        const derived = derive_categories([
            commit({ subject: 'feat: flip subagents.auto default to on' }),
            commit({ subject: 'fix: defaulting logic refactor' }), // no whole-word match
        ]);
        expect(derived['Default changes + migration']).toHaveLength(1);
    });

    it('never derives Known limitations', () => {
        const derived = derive_categories([
            commit({ subject: 'fix(security)!: everything at once — known limitation' }),
        ]);
        expect(derived['Known limitations']).toEqual([]);
    });
});

/**
 * The correctness half of `Security and correctness`. Before this the label
 * derived on security alone, so it fired 1 time against 45 hand-confirmed
 * in-category commits over the six spans measured in
 * `agents/evidence/analysis/release-head-derivation-recall.md`, and the curated
 * `_none_` shipped uncontested.
 *
 * Every fixture below is a REAL commit from those spans, not a constructed
 * one — the false-positive case in particular, because a hand-written
 * near-miss would only test the regex against itself.
 */
describe('derive_categories — the correctness half', () => {
    it('catches a fix that repairs executable surface (missed by the old rule)', () => {
        // 591369c, span 11.0.0..12.0.0 — no "security" anywhere in it.
        const c = commit({
            subject: 'fix(dispatch): refuse a cli-delegate bundle older than its sources',
            files: [{ status: 'M', path: 'src/scripts/_lib/dispatch_guard.ts' }],
        });
        expect(derive_categories([c])['Security and correctness']).toHaveLength(1);
        // The old rule keyed only on /secur/ — assert this subject carries none,
        // so the case genuinely distinguishes new from old.
        expect(/secur/i.test(c.subject)).toBe(false);
    });

    it('stays uncaught on the Phase 1 false-positive fixture (a fix that fixes prose)', () => {
        // 52d7fe1, span 11.0.0..12.0.0 — reads like a repair, changes two
        // markdown files, and repairs nothing. The naive "any fix( counts"
        // rule reads this bug REPORT as a bug FIX.
        const derived = derive_categories([
            commit({
                subject: 'fix(worktrees): the inventory misclassifies from inside a worktree, totally',
                files: [
                    { status: 'M', path: 'agents/roadmaps-progress.md' },
                    { status: 'M', path: 'agents/roadmaps/road-to-worktree-hygiene.md' },
                ],
            }),
        ]);
        expect(derived['Security and correctness']).toEqual([]);
    });

    it('keys on the fix/revert type, not on touching code at all', () => {
        const derived = derive_categories([
            commit({
                subject: 'feat(bench): build the scale-history producer',
                files: [{ status: 'A', path: 'src/scripts/bench/producer.ts' }],
            }),
        ]);
        expect(derived['Security and correctness']).toEqual([]);
    });

    it('counts a revert of executable surface, and a workflow change', () => {
        const derived = derive_categories([
            commit({
                subject: 'revert(gates): restore the previous scan root',
                files: [{ status: 'M', path: 'src/scripts/check_thing.ts' }],
            }),
            commit({
                subject: 'fix(ci): stop the job resolving the wrong base',
                files: [{ status: 'M', path: '.github/workflows/tests.yml' }],
            }),
        ]);
        expect(derived['Security and correctness']).toHaveLength(2);
    });

    it('counts the revert subject git itself writes, not only the conventional one', () => {
        // `git revert` produces `Revert "<original subject>"`, which is not a
        // conventional commit at all. Keying on the conventional form alone
        // silently excluded the class most likely to be a correctness repair.
        const derived = derive_categories([
            commit({
                subject: 'Revert "feat(dispatch): resolve the bundle lazily"',
                files: [{ status: 'M', path: 'src/scripts/_lib/dispatch_guard.ts' }],
            }),
        ]);
        expect(derived['Security and correctness']).toHaveLength(1);
    });

    it('needs the conventional separator — a subject that merely starts with "fix" is not a fix', () => {
        const derived = derive_categories([
            commit({
                subject: 'fix the flaky runner',
                files: [{ status: 'M', path: 'src/scripts/runner.ts' }],
            }),
        ]);
        expect(derived['Security and correctness']).toEqual([]);
    });

    it('sees composite actions and extensionless shebang entry points', () => {
        const derived = derive_categories([
            commit({
                subject: 'fix(ci): the composite action resolved the wrong node',
                files: [{ status: 'M', path: '.github/actions/setup-task/action.yml' }],
            }),
            commit({
                subject: 'fix(cli): the entry point swallowed a non-zero exit',
                files: [{ status: 'M', path: 'scripts-run' }],
            }),
        ]);
        expect(derived['Security and correctness']).toHaveLength(2);
    });
});

describe('derive_categories — recorded-null forms beyond the literal marker', () => {
    it('derives the 12.0.0-era waived soak', () => {
        // ef5ca46, span 11.0.0..12.0.0 — the specimen the roadmap names.
        const c = commit({
            subject:
                'feat(manifest): set the tier sunset, and record that the soak was waived not met',
        });
        expect(derive_categories([c])['Honest nulls']).toHaveLength(1);
        expect(/honest[ -]null/i.test(c.subject)).toBe(false);
    });

    it('derives a published null and a falsifier archival', () => {
        const derived = derive_categories([
            // 92f9b9a, span 10.1.0..10.2.0
            commit({
                subject: 'chore(roadmaps): archive road-to-completion-loop, closed as a published null',
            }),
            // 3fd5a77, span 10.3.0..10.4.0
            commit({ subject: 'docs(roadmap): archive road-to-august-program on its own falsifier' }),
        ]);
        expect(derived['Honest nulls']).toHaveLength(2);
    });

    it('the widening does not make the next release red — the generator pre-fills', () => {
        // Risk 2 of the roadmap: "a wider derivation makes every release red".
        // It does not, and this is why: the generator renders a derived line for
        // every SUBSTANTIATED label, so the curated field is no longer `_none_`
        // and there is nothing for the gate to contradict. A wider derivation
        // moves work to the generator, not to the release PR.
        const span = [
            commit({
                subject: 'fix(dispatch): refuse a cli-delegate bundle older than its sources',
                files: [{ status: 'M', path: 'src/scripts/_lib/dispatch_guard.ts' }],
            }),
            commit({
                subject: 'feat(manifest): record that the soak was waived not met',
            }),
        ];
        const prefilled = render_derived_head_values(derive_category_hits(span));
        expect(prefilled['Security and correctness']).toContain(DERIVED_MARKER);
        expect(prefilled['Honest nulls']).toContain(DERIVED_MARKER);

        const curated = parse_curated_head(render_release_head(prefilled).join('\n'))!;
        expect(highlight_contradictions(curated, derive_categories(span))).toEqual([]);
    });

    it('does not fire on a commit that merely mentions a soak or a nullable field', () => {
        const derived = derive_categories([
            commit({ subject: 'chore(kernel): start the 24h soak for the rule edit' }),
            commit({ subject: 'fix(schema): allow a nullable owner field' }),
            commit({ subject: 'docs: the token_delta is null by design' }),
        ]);
        expect(derived['Honest nulls']).toEqual([]);
    });

    it('separates a recorded null RESULT from a field that merely holds null — in the body', () => {
        // The loose form is applied to subject AND body, and the body is where
        // a field name shows up. Both halves pinned in one place so narrowing
        // the pattern cannot silently cost the true positive.
        const derived = derive_categories([
            commit({
                subject: 'feat(ledger): widen the dispatch record',
                body: 'The emitter records null token_delta when the provider omits usage.',
            }),
            commit({
                subject: 'docs(evidence): close the probe',
                body: 'Publishes the null rather than leaving the question open.',
            }),
        ]);
        expect(derived['Honest nulls']).toHaveLength(1);
        expect(derived['Honest nulls']![0]).toContain('close the probe');
    });

    it('does not let the field-name exclusion reach across a line break', () => {
        // 92f9b9a's real shape, and the bug the first narrowing shipped: the
        // subject ends on "a published null" and the body opens with an
        // identifier. A `\s`-based lookahead crossed the newline and dropped a
        // true positive; the exclusion is same-line only.
        const derived = derive_categories([
            commit({
                subject: 'chore(roadmaps): archive road-to-completion-loop, closed as a published null',
                body: 'count_open reached 0 with count_deferred 0 — 5 steps done.',
            }),
        ]);
        expect(derived['Honest nulls']).toHaveLength(1);
    });
});

describe('draft head cadence — REVERSED 2026-09-01, the marker now refuses', () => {
    /**
     * `HEAD..HEAD` is empty by construction and needs no tag, so the span is
     * the same on a shallow CI checkout as it is locally. An empty span
     * derives no categories, which isolates the draft-marker branch: whatever
     * this asserts about the exit code is owned by that branch alone.
     *
     * UPDATED 2026-09-01 rather than deleted, so the change of contract is
     * visible in the diff. These two cases previously pinned the ADVISORY
     * behaviour — "warns and does NOT red the build". They now pin the
     * refusal. The helper also captures stderr, because the message moved
     * there with the exit code.
     */
    function runOnDraftHead(sectionsBefore = ''): { code: number; stdout: string; stderr: string } {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-head-'));
        const changelog = path.join(dir, 'CHANGELOG.md');
        const head = render_release_head({
            'Behaviour changes': `${DERIVED_MARKER} rule/schema diffs in abc1234.`,
        }).join('\n');
        fs.writeFileSync(
            changelog,
            `${sectionsBefore}## [9.99.0](https://example.invalid) (2026-01-01)\n\n${head}\n`,
        );
        let stdout = '';
        let stderr = '';
        const outSpy = vi
            .spyOn(process.stdout, 'write')
            .mockImplementation((chunk: string | Uint8Array): boolean => {
                stdout += String(chunk);
                return true;
            });
        const errSpy = vi
            .spyOn(process.stderr, 'write')
            .mockImplementation((chunk: string | Uint8Array): boolean => {
                stderr += String(chunk);
                return true;
            });
        try {
            const code = main([
                '--version',
                '9.99.0',
                '--from',
                'HEAD',
                '--to',
                'HEAD',
                '--changelog',
                changelog,
            ]);
            return { code, stdout, stderr };
        } finally {
            outSpy.mockRestore();
            errSpy.mockRestore();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    it('a surviving draft marker REDS the build and names the section', () => {
        const { code, stderr } = runOnDraftHead();
        expect(code).toBe(1);
        expect(stderr).toContain('unrewritten auto-derived head line(s) in the 9.99.0 section');
        expect(stderr).toContain('Behaviour changes');
        // The old contract, pinned as gone rather than merely absent from the
        // assertions above: a later edit that reinstates the warning wording
        // has to delete this line to pass, which makes the revert visible.
        expect(stderr).not.toContain('advisory, not blocking');
    });

    it('the draft marker refuses on its OWN mechanism, not as a _none_ contradiction', () => {
        // Unchanged expectation, changed meaning. `highlight_contradictions`
        // still returns nothing for a draft marker — the marker is not a
        // `_none_` claim — and the exit code above is therefore owned by the
        // `stale_draft_labels` branch alone. Asserting both halves keeps the
        // two mechanisms from being conflated by a later refactor.
        const curated = {
            ...ALL_NONE,
            'Behaviour changes': `${DERIVED_MARKER} rule/schema diffs in abc1234.`,
        };
        expect(highlight_contradictions(curated, derive_categories([]))).toEqual([]);
        expect(stale_draft_labels(curated)).toEqual(['Behaviour changes']);
    });
});

describe('§ 1.3 — the read is scoped to the section under release', () => {
    /**
     * Eighteen `_auto-derived, rewrite before merge:_` lines are already
     * published across 14.9.0-14.13.0. If the gate read the FILE rather than
     * the SECTION, every future release would be red until an editorial pass
     * nobody has scheduled — a correctness guard turned into a permanent red.
     *
     * ORDERING IS THE WHOLE FIXTURE, and this is a correction made by
     * sabotage rather than by review. The first version of this test put the
     * target section first, which is the newest-first order a real changelog
     * happens to have. Neutralising the scoping — swapping
     * `parse_curated_head(section.body)` for a read of the whole file — left
     * it GREEN, because `parse_curated_head` takes the FIRST match of each
     * label and the target's line was already first. The test proved nothing
     * about scope; it proved that the target sorts first.
     *
     * A marker-bearing section placed BEFORE the target is the state that
     * discriminates, and it is not hypothetical: an era split, a patch cut on
     * an older line, or any hand edit that reorders the file produces it. With
     * that ordering a file-wide read reds and a section-scoped read does not.
     */
    function runWithSections(first: string, second: string, target = '9.99.0'): number {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-scope-'));
        const changelog = path.join(dir, 'CHANGELOG.md');
        fs.writeFileSync(
            changelog,
            `# Changelog\n\n${first}\n\n${second}\n`,
        );
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
        const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            return main([
                '--version',
                target,
                '--from',
                'HEAD',
                '--to',
                'HEAD',
                '--changelog',
                changelog,
            ]);
        } finally {
            spy.mockRestore();
            errSpy.mockRestore();
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }

    const CLEAN_HEAD = render_release_head({
        'Behaviour changes': 'the port branch now refuses on an unrewritten head.',
    }).join('\n');
    const MARKED_HEAD = render_release_head({
        'Behaviour changes': `${DERIVED_MARKER} rule/schema diffs in abc1234.`,
    }).join('\n');

    const section = (v: string, date: string, head: string): string =>
        `## [${v}](https://example.invalid) (${date})\n\n${head}`;

    const TARGET_CLEAN = section('9.99.0', '2026-01-01', CLEAN_HEAD);
    const TARGET_MARKED = section('9.99.0', '2026-01-01', MARKED_HEAD);
    const OLD_MARKED = section('9.98.0', '2025-12-01', MARKED_HEAD);
    const OLD_CLEAN = section('9.98.0', '2025-12-01', CLEAN_HEAD);

    it('a marker-bearing historical section ABOVE the target does not block it', () => {
        // The sensitive ordering. This is the case that goes red the moment
        // the read stops being section-scoped.
        expect(runWithSections(OLD_MARKED, TARGET_CLEAN)).toBe(0);
    });

    it('a marker-bearing historical section BELOW the target does not block it', () => {
        // The newest-first ordering a real changelog has. Kept because it is
        // the realistic layout — but it is NOT the sensitive one, and saying
        // so here stops a later reader from trusting it as scope evidence.
        expect(runWithSections(TARGET_CLEAN, OLD_MARKED)).toBe(0);
    });

    it('the same marker in the TARGET section still refuses — the scope is not a hole', () => {
        // Without this, "exits 0" above is equally satisfied by a gate that
        // reads nothing at all.
        expect(runWithSections(TARGET_MARKED, OLD_CLEAN)).toBe(1);
    });

    // ── roadmap § 2.2 — the leaked AUTHORING INSTRUCTION, a different
    // mechanism from the marker above: an unpolished claim vs. a reminder to
    // the releaser that was never release content. It needs its own fixture
    // rather than riding on the marker check.
    const INSTRUCTED_HEAD = [
        '### Release highlights',
        '',
        CURATED_HEAD_INSTRUCTION_COMMENT,
        '- **Behaviour changes:** the writer no longer emits its own instruction.',
    ].join('\n');
    const TARGET_INSTRUCTED = section('9.99.0', '2026-01-01', INSTRUCTED_HEAD);
    const OLD_INSTRUCTED = section('9.98.0', '2025-12-01', INSTRUCTED_HEAD);

    it('an instruction comment in the TARGET section refuses the release', () => {
        expect(runWithSections(TARGET_INSTRUCTED, OLD_CLEAN)).toBe(1);
    });

    it('an instruction comment in a HISTORICAL section does not block the release', () => {
        // Risk 1 of the roadmap, pinned: five released sections carry this
        // comment today. A gate that read them would be permanently red.
        expect(runWithSections(OLD_INSTRUCTED, TARGET_CLEAN)).toBe(0);
        expect(runWithSections(TARGET_CLEAN, OLD_INSTRUCTED)).toBe(0);
    });
});

describe('_parse_git_log', () => {
    it('parses records with name-status lines and multi-line bodies', () => {
        const raw =
            `\u001e${SHA}\u001ffix(security): patch walk\u001fbody line 1\n` +
            'body line 2 with honest null marker\n' +
            'M\tsrc/rules/x.md\n' +
            `D\tsrc/skills/gone/SKILL.md\n` +
            `\u001e${'b'.repeat(40)}\u001fchore: noop\u001f\n`;
        const commits = _parse_git_log(raw);
        expect(commits).toHaveLength(2);
        expect(commits[0]!.files).toEqual([
            { status: 'M', path: 'src/rules/x.md' },
            { status: 'D', path: 'src/skills/gone/SKILL.md' },
        ]);
        expect(commits[0]!.body).toContain('honest null marker');
        const derived = derive_categories(commits);
        expect(derived['Security and correctness']).toHaveLength(1);
        expect(derived['Honest nulls']).toHaveLength(1);
    });
});
