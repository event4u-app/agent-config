/**
 * road-to-tool-results-that-leave-a-handle.md steps 1.1 and 1.2.
 *
 * verify: this file.
 */
import { describe, expect, it } from 'vitest';

import {
    classifyResult,
    type ContentClass,
    contentProfile,
    D11_WINDOW_START,
    d11WindowEnd,
    inWindow,
    nearestRankP95,
    readCensus,
    type RepeatInput,
    repeatShare,
    selectClasses,
} from '../../src/scripts/report_reducible_classes.js';

function cls(tool: string, samples: number[]) {
    return { tool, count: samples.length, payload_bytes: samples.reduce((a, b) => a + b, 0), payload_samples: samples };
}

function spread(n: number, low: number, high: number): number[] {
    return Array.from({ length: n }, (_, i) => (i < n * 0.9 ? low : high));
}

describe('report_reducible_classes', () => {
    it('p95-is-nearest-rank-floor', () => {
        const samples = Array.from({ length: 100 }, (_, i) => i + 1);
        expect(nearestRankP95(samples)).toBe(96);
        expect(nearestRankP95([])).toBeNull();
    });

    it('failure-structured-class-above-threshold-is-selected', () => {
        const [v] = selectClasses({ Bash: cls('Bash', spread(100, 100, 20_000)) }, 8192);
        expect(v).toMatchObject({ tool: 'Bash', above_threshold: true, failure_structured: true, non_goal: null, selected: true });
    });

    it('failure-structured-class-below-threshold-is-not-selected', () => {
        const [v] = selectClasses({ Bash: cls('Bash', spread(100, 100, 6_282)) }, 8192);
        expect(v).toMatchObject({ p95: 6_282, above_threshold: false, selected: false });
    });

    it('large-class-without-failure-structure-is-not-selected', () => {
        const [v] = selectClasses({ Read: cls('Read', spread(100, 1_000, 42_029)) }, 8192);
        expect(v).toMatchObject({ above_threshold: true, failure_structured: false, selected: false });
    });

    it('non-goal-classes-are-never-selected', () => {
        const verdicts = selectClasses(
            {
                'Read:image': cls('Read:image', spread(100, 200_000, 600_000)),
                Edit: cls('Edit', spread(100, 265, 299)),
                Write: cls('Write', spread(100, 257, 287)),
            },
            8192,
        );
        expect(Object.fromEntries(verdicts.map((v) => [v.tool, [v.non_goal, v.selected]]))).toStrictEqual({
            'Read:image': ['K7', false],
            Edit: ['K3', false],
            Write: ['K3', false],
        });
    });

    it('legacy-census-line-is-envelope-bytes-with-delivered-unknown', () => {
        const text = [
            '{"ts":"2026-09-01T00:00:00Z","tool":"Bash","bytes":500}',
            '{"ts":"2026-10-01T00:00:00Z","tool":"Bash","raw_bytes":700,"delivered_bytes":700,"measurable":true}',
            'not json',
            '',
        ].join('\n');
        expect(readCensus(text)).toStrictEqual({
            legacy: 1,
            two_field: 1,
            unreadable: 1,
            delivered_unknown: 1,
            raw_bytes: 1_200,
            delivered_bytes_known: 700,
        });
    });
});

describe('report_reducible_classes — content profile (PREREG)', () => {
    it('content-class-follows-the-prereg', () => {
        const cases: Array<[string, string | null, ContentClass]> = [
            // Read rows: text is content, an image is K7 and stays out.
            ['Read', null, 'Read:text'],
            ['Read:image', null, 'out-of-scope'],
            // Bash:file-print — every program of the table, alone and piped.
            ['Bash', 'cat src/a.ts', 'Bash:file-print'],
            ['Bash', 'head -n 40 README.md', 'Bash:file-print'],
            ['Bash', 'tail -20 CHANGELOG.md', 'Bash:file-print'],
            ['Bash', 'nl -ba src/a.ts', 'Bash:file-print'],
            ['Bash', 'wc -l src/a.ts src/b.ts', 'Bash:file-print'],
            ['Bash', "sed -n '1,120p' src/a.ts", 'Bash:file-print'],
            ['Bash', "sed -n -e '10p' -e '/^## /p' a.md", 'Bash:file-print'],
            ['Bash', "sed -n '1,5p;40,60p' a.md", 'Bash:file-print'],
            ['Bash', 'cat a.md | head -50 | nl', 'Bash:file-print'],
            ['Bash', "nl -ba a.ts | sed -n '200,260p'", 'Bash:file-print'],
            ['Bash', 'cat "a b.md"', 'Bash:file-print'],
            ['Bash', "cat 'x; y && z > w'", 'Bash:file-print'],
            // sed without -n, with a non-print script, or in place is not print-only.
            ['Bash', "sed 's/a/b/' a.md", 'execution'],
            ['Bash', "sed -n 's/a/b/p' a.md", 'execution'],
            ['Bash', "sed -n -i '1p' a.md", 'execution'],
            ['Bash', "sed '1,10p' a.md", 'execution'],
            ['Bash', 'sed -n', 'execution'],
            // Bash:vcs-content — first stage git diff / git show / git log -p, later stages file-print.
            ['Bash', 'git diff', 'Bash:vcs-content'],
            ['Bash', 'git diff origin/main -- src/', 'Bash:vcs-content'],
            ['Bash', 'git show HEAD~1:src/a.ts', 'Bash:vcs-content'],
            ['Bash', 'git log -p -3 -- src/a.ts', 'Bash:vcs-content'],
            ['Bash', 'git diff | head -200', 'Bash:vcs-content'],
            ['Bash', 'git log --oneline -5', 'execution'],
            ['Bash', 'git status', 'execution'],
            ['Bash', 'git -C src diff', 'execution'],
            ['Bash', 'git diff | grep foo', 'execution'],
            ['Bash', 'cat a.md | git diff', 'execution'],
            // Other Bash is the execution profile.
            ['Bash', 'npx vitest run tests/x.test.ts', 'execution'],
            ['Bash', 'grep -rn foo src', 'execution'],
            ['Bash', 'cat a.md | grep foo', 'execution'],
            ['Bash', 'FOO=1 cat a.md', 'execution'],
            // Exclusions — residue, whatever the command prints.
            ['Bash', 'cd src', 'residue'],
            ['Bash', 'cd src && cat a.ts', 'residue'],
            ['Bash', 'cat a.ts && cat b.ts', 'residue'],
            ['Bash', 'cat a.ts; cat b.ts', 'residue'],
            ['Bash', 'cat a.ts || true', 'residue'],
            ['Bash', 'cat a.ts\ncat b.ts', 'residue'],
            ['Bash', 'cat a.ts &', 'residue'],
            ['Bash', 'cat a.ts > out.txt', 'residue'],
            ['Bash', 'cat a.ts 2>/dev/null', 'residue'],
            ['Bash', 'git diff 2>&1 | head', 'residue'],
            ['Bash', 'cat < a.ts', 'residue'],
            ['Bash', '(cat a.ts)', 'residue'],
            ['Bash', 'cat $(ls *.md)', 'residue'],
            ['Bash', 'cat "$(ls)"', 'residue'],
            ['Bash', 'cat `ls`', 'residue'],
            ['Bash', 'cat "unterminated', 'residue'],
            // A Bash call without a command string joins no content class.
            ['Bash', null, 'execution'],
            // Other tools are outside both profiles.
            ['Edit', null, 'out-of-scope'],
            ['Grep', null, 'out-of-scope'],
        ];
        const got = cases.map(([tool, command]) => [tool, command, classifyResult(tool, command)]);
        expect(got).toStrictEqual(cases);
    });

    it('content-profile-verdicts-apply-size-and-sample-floor', () => {
        const reads = (n: number, size: number) =>
            Array.from({ length: n }, (_, i) => ({ tool: 'Read', command: null, bytes: i < n * 0.9 ? 100 : size }));
        const bash = (command: string, n: number, size: number) => Array.from({ length: n }, () => ({ tool: 'Bash', command, bytes: size }));
        const report = contentProfile(
            [
                ...reads(200, 42_029),
                ...bash('cat a.md', 199, 20_000),
                ...bash('git diff', 300, 500),
                ...bash('cd x && cat y', 3, 9_000),
                ...bash('cd x', 5, 10),
            ],
            8192,
        );
        expect(Object.fromEntries(report.classes.map((c) => [c.class, [c.count, c.p95, c.verdict]]))).toStrictEqual({
            'Read:text': [200, 42_029, 'selected'],
            'Bash:file-print': [199, 20_000, 'insufficient'],
            'Bash:vcs-content': [300, 500, 'out'],
        });
        expect(report.residue).toStrictEqual({ count: 8, above_threshold: 3 });
        expect(report.selected).toStrictEqual(['Read:text']);
    });

    it('content-window-is-strictly-after-start-and-before-end', () => {
        const start = Date.parse(D11_WINDOW_START);
        const end = Date.parse(d11WindowEnd());
        expect(end - start).toBe(14 * 24 * 3600 * 1000);
        expect(inWindow(D11_WINDOW_START, start, end)).toBe(false);
        expect(inWindow('2026-10-15T10:26:28Z', start, end)).toBe(true);
        expect(inWindow(d11WindowEnd(), start, end)).toBe(false);
        expect(inWindow(null, start, end)).toBe(false);
    });
    it('repeat-share-counts-byte-identical-redelivery', () => {
        const r = (o: Partial<RepeatInput>): RepeatInput => ({
            tool: 'Read',
            command: null,
            bytes: 1_000,
            session: 's1',
            path: '/repo/a.ts',
            range: null,
            digest: 'd1',
            advised: false,
            timestamp: null,
            ...o,
        });
        const records = [
            // Out of timestamp order on input: the 09:00 read is the first delivery.
            r({ timestamp: '2026-10-16T09:05:00Z', advised: true }),
            r({ timestamp: '2026-10-16T09:00:00Z' }),
            // Same path, other range: not a repeat of the full read.
            r({ timestamp: '2026-10-16T09:06:00Z', range: '10+5' }),
            // Same path and range, changed content: not a repeat.
            r({ timestamp: '2026-10-16T09:07:00Z', digest: 'd2' }),
            // Same key and digest in another session: not a repeat.
            r({ timestamp: '2026-10-16T09:08:00Z', session: 's2' }),
            // A content-class Bash command repeated byte-identically: a repeat.
            r({ tool: 'Bash', command: "sed -n '1,40p' a.md", path: null, timestamp: '2026-10-16T09:01:00Z', digest: 'b1', bytes: 400 }),
            r({ tool: 'Bash', command: "sed -n '1,40p' a.md", path: null, timestamp: '2026-10-16T09:02:00Z', digest: 'b1', bytes: 400 }),
            // Execution-profile Bash repeated: outside the content profile, never counted.
            r({ tool: 'Bash', command: 'npm test', path: null, timestamp: '2026-10-16T09:03:00Z', digest: 'e1' }),
            r({ tool: 'Bash', command: 'npm test', path: null, timestamp: '2026-10-16T09:04:00Z', digest: 'e1' }),
            // An image read is K7 and outside the profile.
            r({ tool: 'Read:image', timestamp: '2026-10-16T09:09:00Z' }),
            // A content result without a digest counts as content but never matches.
            r({ timestamp: '2026-10-16T09:10:00Z', digest: null }),
            r({ timestamp: '2026-10-16T09:11:00Z', digest: null }),
        ];
        const share = repeatShare(records);
        expect(share.content).toStrictEqual({ count: 9, bytes: 7_800 });
        expect(share.repeats).toStrictEqual({ count: 2, bytes: 1_400, advised: 1 });
        expect(share.by_class['Read:text']).toStrictEqual({ count: 7, bytes: 7_000, repeats: 1, repeat_bytes: 1_000 });
        expect(share.by_class['Bash:file-print']).toStrictEqual({ count: 2, bytes: 800, repeats: 1, repeat_bytes: 400 });
        expect(share.by_class['Bash:vcs-content']).toStrictEqual({ count: 0, bytes: 0, repeats: 0, repeat_bytes: 0 });
    });

    it('repeat-share-first-delivery-is-the-earliest-timestamp-and-undated-results-sort-last', () => {
        const base = { tool: 'Read', command: null, session: 's', path: '/a', range: null, digest: 'd' };
        const share = repeatShare([
            { ...base, bytes: 10, timestamp: '2026-10-16T09:10:00Z', advised: true },
            { ...base, bytes: 20, timestamp: null, advised: true },
            { ...base, bytes: 30, timestamp: '2026-10-16T09:05:00Z', advised: false },
        ]);
        // 09:05 is the first delivery; the 09:10 read and the undated one repeat it.
        expect(share.repeats).toStrictEqual({ count: 2, bytes: 30, advised: 2 });
    });
});
