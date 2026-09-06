// Tests for src/scripts/lint_evidence_artifacts.ts
// (road-to-release-review-p0 Phase 2).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GateLedger } from '../../src/scripts/_lib/gate_ledger.js';
import {
    checkFiles,
    EVIDENCE_TYPES,
    FEEL_METHODS,
    parseFeelLine,
    resolveEvidenceType,
} from '../../src/scripts/lint_evidence_artifacts.js';

const SCOPE = 'a'.repeat(64);

describe('resolveEvidenceType — the pre-existing grammars are read, never re-declared', () => {
    it('a completion-review marker resolves current-binding', () => {
        const body = `<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: ${SCOPE} | diff: abc1234 | reviewer: claude -->\n\n# Findings\n`;
        expect(resolveEvidenceType('agents/evidence/reviews/x.findings.md', body)).toEqual({
            type: 'current-binding',
            via: 'completion-review',
            invalidMarker: null,
        });
    });

    it('an honest-null line resolves honest-null', () => {
        const body = `# X\n\n**Honest-null:** 0 findings, scope ${SCOPE}, reviewed 2026-08-17\n`;
        expect(resolveEvidenceType('agents/evidence/reviews/x.findings.md', body).type).toBe('honest-null');
    });

    it('a skip declaration resolves declared-skip', () => {
        const body = `# X\n\n**Skipped:** no code surface for this completion — docs only, scope none, declared 2026-08-17\n`;
        expect(resolveEvidenceType('agents/evidence/reviews/x.findings.md', body).type).toBe('declared-skip');
    });

    // The contract's point: an artifact already carrying one of those grammars
    // must NOT be asked for a second marker, or the check reintroduces the
    // ambiguity it exists to remove.
    it('an artifact with a grammar needs no evidence-type marker', () => {
        const body = `<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: ${SCOPE} | diff: abc1234 | reviewer: claude -->\n`;
        expect(checkFiles('/nonexistent', [])).toEqual([]);
        expect(resolveEvidenceType('x.md', body).via).toBe('completion-review');
    });
});

describe('resolveEvidenceType — the explicit marker', () => {
    it('resolves analysis', () => {
        expect(resolveEvidenceType('agents/evidence/analysis/x.md', '<!-- evidence-type: analysis -->\n# X\n')).toEqual(
            { type: 'analysis', via: 'marker', invalidMarker: null },
        );
    });

    it('accepts every type in the published set', () => {
        for (const t of EVIDENCE_TYPES) {
            expect(resolveEvidenceType('x.md', `<!-- evidence-type: ${t} -->`).type).toBe(t);
        }
    });

    it('tolerates surrounding whitespace', () => {
        expect(resolveEvidenceType('x.md', '   <!--   evidence-type:   analysis   -->   ').type).toBe('analysis');
    });

    // Louder than absence, not quieter: a misspelled type reads as untyped to
    // every consumer, which is exactly the state being ended.
    it('a misspelled type is reported as an invalid marker, not as missing', () => {
        const r = resolveEvidenceType('x.md', '<!-- evidence-type: analisys -->');
        expect(r.type).toBeNull();
        expect(r.invalidMarker).toBe('analisys');
    });

    it('a marker below the scan window does not count — a type belongs at the top', () => {
        const body = `${'filler\n'.repeat(60)}<!-- evidence-type: analysis -->\n`;
        expect(resolveEvidenceType('x.md', body).type).toBeNull();
    });

    // R2 finding 8: the grammar scan used to walk the WHOLE file while the
    // marker scan stopped at 40 lines, so a quoted completion-review line deep
    // in a prose artifact silently overrode the author's own declaration.
    // Reverting the grammar scan to the unbounded form fails this test.
    it('a quoted grammar line deep in the file cannot override an explicit marker', () => {
        const body =
            '<!-- evidence-type: analysis -->\n' +
            `${'prose\n'.repeat(60)}` +
            `<!-- completion-review: v1 | reviewed: 2026-08-17 | scope: ${SCOPE} | diff: abc1234 | reviewer: quoted -->\n`;
        expect(resolveEvidenceType('agents/evidence/analysis/x.md', body)).toEqual({
            type: 'analysis',
            via: 'marker',
            invalidMarker: null,
        });
    });

    it('both scans share one window — a grammar line below it does not resolve either', () => {
        const body = `${'prose\n'.repeat(60)}**Honest-null:** 0 findings, scope ${SCOPE}, reviewed 2026-08-17\n`;
        expect(resolveEvidenceType('agents/evidence/analysis/x.md', body).type).toBeNull();
    });
});

describe('resolveEvidenceType — the one path-derived case', () => {
    it('a file inside a *.review-input directory resolves original-review', () => {
        const rel = path.join('agents', 'evidence', 'reviews', 'slug.review-input', 'prompt.md');
        expect(resolveEvidenceType(rel, '# prompt\n')).toEqual({
            type: 'original-review',
            via: 'review-input-path',
            invalidMarker: null,
        });
    });

    // The exception is narrow on purpose. A directory that merely CONTAINS the
    // word must not qualify, or the contract's "a directory name is not a
    // declaration" line stops being true.
    it('a lookalike directory does not qualify', () => {
        const rel = path.join('agents', 'evidence', 'reviews', 'review-inputs', 'prompt.md');
        expect(resolveEvidenceType(rel, '# prompt\n').type).toBeNull();
    });

    it('plain prose with no marker anywhere is untyped', () => {
        expect(resolveEvidenceType('agents/evidence/analysis/x.md', '# A census\n\nSome prose.\n').type).toBeNull();
    });
});

// R2 finding 5: the gate's FAILING path had no test at all — both prior
// `checkFiles` cases asserted `[]`, so nothing executable proved a real
// untyped file on disk produces a finding. That is the one behaviour the
// roadmap's acceptance criterion names ("a typeless evidence artifact fails
// its check"), and it was marked `[x]` on the strength of a manual run.
describe('checkFiles — over real files on disk', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-lint-'));
        fs.mkdirSync(path.join(root, 'agents', 'evidence', 'analysis'), { recursive: true });
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function write(rel: string, body: string): string {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf8');
        return rel;
    }

    it('an untyped artifact on disk produces exactly one finding', () => {
        const rel = write('agents/evidence/analysis/untyped.md', '# A census\n\nSome prose.\n');
        const findings = checkFiles(root, [rel]);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.file).toBe(rel);
        expect(findings[0]?.reason).toContain('no evidence type declared');
    });

    it('a typed artifact on disk produces none', () => {
        const rel = write('agents/evidence/analysis/typed.md', '<!-- evidence-type: analysis -->\n# X\n');
        expect(checkFiles(root, [rel])).toEqual([]);
    });

    it('a misspelled type is reported as invalid, with the offending value named', () => {
        const rel = write('agents/evidence/analysis/bad.md', '<!-- evidence-type: analisys -->\n');
        const findings = checkFiles(root, [rel]);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.reason).toContain('analisys');
    });

    it('mixed input reports only the untyped members', () => {
        const bad = write('agents/evidence/analysis/a.md', '# prose\n');
        write('agents/evidence/analysis/b.md', '<!-- evidence-type: analysis -->\n');
        expect(checkFiles(root, [bad, 'agents/evidence/analysis/b.md']).map((f) => f.file)).toEqual([bad]);
    });

    it('the ledger accounts for every planned target', () => {
        const bad = write('agents/evidence/analysis/a.md', '# prose\n');
        write('agents/evidence/analysis/b.md', '<!-- evidence-type: analysis -->\n');
        const ledger = new GateLedger('lint_evidence_artifacts');
        checkFiles(root, [bad, 'agents/evidence/analysis/b.md'], ledger);
        const tally = ledger.finalize();
        expect(tally.planned).toBe(2);
        expect(tally.failed).toBe(1);
        expect(tally.completed).toBe(1);
    });
});

describe('checkFiles', () => {
    it('an empty file list yields no findings', () => {
        expect(checkFiles(process.cwd(), [])).toEqual([]);
    });

    it('a path that does not exist on disk is skipped, not reported', () => {
        expect(checkFiles(process.cwd(), ['agents/evidence/analysis/definitely-not-here.md'])).toEqual([]);
    });
});

// road-to-one-motion-authority Phase 3. The perceptual class: its result may be
// unbacked, its method line may not be absent.
describe('the feel evidence type', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-feel-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    function write(rel: string, body: string): string {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body, 'utf8');
        return rel;
    }

    it('is one of the declared types', () => {
        expect(EVIDENCE_TYPES as readonly string[]).toContain('feel');
    });

    it('resolves from the marker', () => {
        const body = '<!-- evidence-type: feel -->\n\n**Feel:** slow-motion — the modal exit reads abrupt at 0.25x\n';
        expect(resolveEvidenceType('agents/evidence/analysis/motion.md', body).type).toBe('feel');
    });

    it('accepts a fixture carrying a method and an outcome', () => {
        const rel = write(
            'agents/evidence/analysis/motion-feel.md',
            '<!-- evidence-type: feel -->\n\n**Feel:** slow-motion — the modal exit reads abrupt at 0.25x\n',
        );
        expect(checkFiles(root, [rel])).toEqual([]);
    });

    it('accepts an unbacked outcome — a check that ran and settled nothing still ran', () => {
        const rel = write(
            'agents/evidence/analysis/motion-unbacked.md',
            '<!-- evidence-type: feel -->\n\n**Feel:** next-day — unbacked\n',
        );
        expect(checkFiles(root, [rel])).toEqual([]);
    });

    it('accepts every method in the closed set', () => {
        for (const method of FEEL_METHODS) {
            const rel = write(
                `agents/evidence/analysis/m-${method}.md`,
                `<!-- evidence-type: feel -->\n\n**Feel:** ${method} — unbacked\n`,
            );
            expect(checkFiles(root, [rel]), method).toEqual([]);
        }
    });

    // Sensitivity: the floor is the token, not the word.
    it('refuses a feel artifact with no method line', () => {
        const rel = write('agents/evidence/analysis/no-method.md', '<!-- evidence-type: feel -->\n\nIt felt fine.\n');
        const findings = checkFiles(root, [rel]);
        expect(findings).toHaveLength(1);
        expect(findings[0]?.reason).toMatch(/no `\*\*Feel:\*\* <method>/);
    });

    it('refuses a method outside the closed set', () => {
        const rel = write(
            'agents/evidence/analysis/bad-method.md',
            '<!-- evidence-type: feel -->\n\n**Feel:** vibes — looked great\n',
        );
        expect(checkFiles(root, [rel])).toHaveLength(1);
    });

    it('parseFeelLine reads the method and the outcome, and rejects anything else', () => {
        expect(parseFeelLine('**Feel:** frame-step — one duplicated frame at the apex')).toEqual({
            method: 'frame-step',
            outcome: 'one duplicated frame at the apex',
        });
        expect(parseFeelLine('**Feel:** device —')).toBeNull();
        expect(parseFeelLine('Feel: device — fine')).toBeNull();
    });
});
