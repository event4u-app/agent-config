/**
 * Evidence-artifact type check (`docs/contracts/evidence-artifact-types.md`).
 *
 * Every case below is anchored to a failure this repo's own corpus produced: a
 * superseded round read as current, a declared skip indistinguishable from a
 * review that found nothing, and an artifact read at a verdict its binding had
 * already moved away from. The agreement cases are the load-bearing half — a
 * declared type that nothing cross-checks is a field authors fill in and readers
 * learn to distrust, which would leave the ambiguity in place behind a marker
 * that looks like it was closed.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    EVIDENCE_TYPES,
    checkAgreement,
    checkFiles,
    isEvidenceArtifact,
    main,
    scanTypeMarker,
    type EvidenceType,
} from '../../src/scripts/lint_evidence_artifacts.js';

const SCOPE = 'a'.repeat(64);
const DATE = '2026-08-17';

function typeMarker(type: string, declared = DATE): string {
    return `<!-- evidence-type: v1 | type: ${type} | declared: ${declared} -->`;
}

const BINDING = `<!-- completion-review: v1 | reviewed: ${DATE} | scope: ${SCOPE} | diff: abc1234 | reviewer: r2 -->`;
const NULL_LINE = `**Honest-null:** 0 findings, scope ${SCOPE}, reviewed ${DATE}`;
const SKIP_LINE = `**Skipped:** no code surface for this completion — docs only, scope none, declared ${DATE}`;
const TABLE_HEAD = [
    '| # | Severity | File:Line | Finding | Status | Reason/Ref |',
    '|---|----------|-----------|---------|--------|------------|',
];
const ROW = '| 1 | low | src/x.ts:1 | a nit | open |  |';

function body(type: string, ...rest: string[]): string {
    return ['# Findings: fixture', BINDING, typeMarker(type), '', ...rest, ''].join('\n');
}

/** A temp repo with the evidence root populated. No tracked file is written. */
function withEvidence(files: Record<string, string>, run: (repo: string) => void): void {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'evtype-'));
    try {
        for (const [rel, text] of Object.entries(files)) {
            const abs = path.join(repo, rel);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, text);
        }
        run(repo);
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }
}

function agree(type: EvidenceType, text: string): string[] {
    const scan = scanTypeMarker(text);
    expect(scan.marker).not.toBeNull();
    return checkAgreement('f.md', text, scan.marker as NonNullable<typeof scan.marker>).map((v) => v.detail);
}

describe('marker grammar (§2)', () => {
    it('parses a well-formed marker', () => {
        const scan = scanTypeMarker(`# t\n${typeMarker('current-binding')}\n`);
        expect(scan.marker?.type).toBe('current-binding');
        expect(scan.marker?.declared).toBe(DATE);
        expect(scan.marker?.line).toBe(2);
        expect(scan.malformed).toEqual([]);
    });

    it('rejects an unknown type value instead of ignoring it', () => {
        const scan = scanTypeMarker(typeMarker('current_binding'));
        expect(scan.marker).toBeNull();
        expect(scan.malformed.join()).toMatch(/unknown type/);
    });

    it('rejects an unknown grammar version — a marker it cannot read is worse than none', () => {
        const scan = scanTypeMarker('<!-- evidence-type: v2 | type: current-binding | declared: 2026-08-17 -->');
        expect(scan.marker).toBeNull();
        expect(scan.malformed.join()).toMatch(/exact §2 grammar/);
    });

    it('rejects a missing declared date', () => {
        const scan = scanTypeMarker('<!-- evidence-type: v1 | type: current-binding -->');
        expect(scan.marker).toBeNull();
        expect(scan.malformed).toHaveLength(1);
    });

    it('reports a second well-formed marker rather than picking one', () => {
        const scan = scanTypeMarker(`${typeMarker('current-binding')}\n${typeMarker('honest-null')}\n`);
        expect(scan.marker?.type).toBe('current-binding');
        expect(scan.duplicateLines).toEqual([2]);
    });

    it('ignores lines that are not marker attempts', () => {
        expect(scanTypeMarker('# t\nsome prose about evidence types\n').malformed).toEqual([]);
    });

    it('accepts every value in the closed set', () => {
        for (const t of EVIDENCE_TYPES) {
            expect(scanTypeMarker(typeMarker(t)).marker?.type).toBe(t);
        }
    });
});

describe('agreement (§4) — the type must match the body', () => {
    it('original-review: clean without a binding marker', () => {
        expect(agree('original-review', `# input\n${typeMarker('original-review')}\n\nprose\n`)).toEqual([]);
    });

    it('original-review: an input that binds a scope is the ambiguity, not a valid input', () => {
        expect(agree('original-review', body('original-review', 'prose')).join()).toMatch(/does ?\n?not bind|not bind/);
    });

    it('current-binding: clean with a marker and a row', () => {
        expect(agree('current-binding', body('current-binding', ...TABLE_HEAD, ROW))).toEqual([]);
    });

    it('current-binding: an empty table is an honest-null, not a binding with no findings', () => {
        expect(agree('current-binding', body('current-binding', ...TABLE_HEAD)).join()).toMatch(/honest-null/);
    });

    it('current-binding: without a completion-review marker there is no scope to bind', () => {
        const text = ['# t', typeMarker('current-binding'), '', ...TABLE_HEAD, ROW, ''].join('\n');
        expect(agree('current-binding', text).join()).toMatch(/no `completion-review:` marker/);
    });

    it('honest-null: clean with the §2.3 line', () => {
        expect(agree('honest-null', body('honest-null', NULL_LINE))).toEqual([]);
    });

    it('honest-null: findings rows contradict the null', () => {
        expect(agree('honest-null', body('honest-null', NULL_LINE, ...TABLE_HEAD, ROW)).join()).toMatch(
            /carries findings rows/,
        );
    });

    it('honest-null: a skip line is the conflation the contract exists to remove', () => {
        expect(agree('honest-null', body('honest-null', NULL_LINE, SKIP_LINE)).join()).toMatch(/nobody looked/);
    });

    it('declared-skip: clean with the §2.4 line and no binding marker', () => {
        const text = ['# t', typeMarker('declared-skip'), '', SKIP_LINE, ''].join('\n');
        expect(agree('declared-skip', text)).toEqual([]);
    });

    it('declared-skip: missing the declaration is a skip nobody declared', () => {
        const text = ['# t', typeMarker('declared-skip'), '', 'we skipped it', ''].join('\n');
        expect(agree('declared-skip', text).join()).toMatch(/no §2.4 skip declaration/);
    });

    it('rebind-event: clean when the move is traceable', () => {
        expect(
            agree('rebind-event', body('rebind-event', '## Dispositions — re-bound at `abc1234`', ...TABLE_HEAD, ROW)),
        ).toEqual([]);
    });

    it('rebind-event: an untraceable move tells the reader nothing', () => {
        expect(agree('rebind-event', body('rebind-event', ...TABLE_HEAD, ROW)).join()).toMatch(/not traceable/);
    });
});

describe('scope selection', () => {
    it('governs markdown under the evidence root only', () => {
        expect(isEvidenceArtifact('agents/evidence/reviews/x.findings.md')).toBe(true);
        expect(isEvidenceArtifact('agents/evidence/x.md')).toBe(true);
        expect(isEvidenceArtifact('agents/evidence/sweep.json')).toBe(false);
        expect(isEvidenceArtifact('agents/roadmaps/x.md')).toBe(false);
        expect(isEvidenceArtifact('docs/evidence/x.md')).toBe(false);
    });

    it('demands a marker only when presence is in scope', () => {
        withEvidence({ 'agents/evidence/reports/r.md': '# r\n\nprose\n' }, (repo) => {
            const rel = ['agents/evidence/reports/r.md'];
            expect(checkFiles(repo, rel, false).violations).toEqual([]);
            expect(checkFiles(repo, rel, true).violations.map((v) => v.kind)).toEqual(['missing-marker']);
        });
    });

    it('checks agreement on a pre-existing artifact even though presence is not demanded', () => {
        withEvidence({ 'agents/evidence/reports/r.md': body('original-review', 'prose') }, (repo) => {
            const out = checkFiles(repo, ['agents/evidence/reports/r.md'], false);
            expect(out.typed).toBe(1);
            expect(out.violations.map((v) => v.kind)).toEqual(['agreement:original-review']);
        });
    });

    it('does not stack a missing-marker violation on top of a malformed one', () => {
        withEvidence({ 'agents/evidence/reports/r.md': `# r\n${typeMarker('nope')}\n` }, (repo) => {
            const kinds = checkFiles(repo, ['agents/evidence/reports/r.md'], true).violations.map((v) => v.kind);
            expect(kinds).toEqual(['malformed-marker']);
        });
    });

    it('counts the untyped remainder so the shrink is observable', () => {
        withEvidence(
            {
                'agents/evidence/a.md': '# a\n',
                'agents/evidence/b.md': `# b\n${typeMarker('original-review')}\n`,
            },
            (repo) => {
                const out = checkFiles(repo, ['agents/evidence/a.md', 'agents/evidence/b.md'], false);
                expect(out).toMatchObject({ scanned: 2, typed: 1, untyped: 1 });
            },
        );
    });
});

describe('CLI', () => {
    it('--all over an absent evidence root is a POLICY failure, never a clean pass', () => {
        withEvidence({ 'README.md': '# x\n' }, (repo) => {
            expect(main(['--repo', repo, '--all', '--quiet'])).toBe(1);
        });
    });

    it('--all passes on a typed corpus that agrees with itself', () => {
        withEvidence({ 'agents/evidence/reports/r.md': `# r\n${typeMarker('original-review')}\n\nprose\n` }, (repo) => {
            expect(main(['--repo', repo, '--all', '--quiet'])).toBe(0);
        });
    });

    it('--all fails a typed corpus whose type disagrees with its body', () => {
        withEvidence({ 'agents/evidence/reports/r.md': body('original-review', 'prose') }, (repo) => {
            expect(main(['--repo', repo, '--all', '--quiet'])).toBe(1);
        });
    });

    it('an unresolvable change set exits 1 — this gate’s normal pass IS zero', () => {
        // A non-git temp dir cannot resolve `origin/main...HEAD`. Since an empty
        // change set is this gate's ordinary green, an unresolvable one must not
        // degrade into the same output.
        withEvidence({ 'agents/evidence/reports/r.md': '# r\n' }, (repo) => {
            expect(main(['--repo', repo, '--quiet'])).toBe(1);
        });
    });

    it('rejects an unknown argument instead of silently scanning the default scope', () => {
        expect(main(['--all', '--nope'])).toBe(1);
    });

    it('--help exits 0 and emits the scanned line', () => {
        expect(main(['--help'])).toBe(0);
    });
});

describe('the repo’s own corpus', () => {
    it('every typed artifact on this branch agrees with its body', () => {
        const repo = path.resolve(__dirname, '../..');
        expect(main(['--repo', repo, '--all', '--quiet'])).toBe(0);
    });
});
