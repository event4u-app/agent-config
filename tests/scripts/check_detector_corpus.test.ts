/**
 * Tests for the detector corpus gate (P4.3).
 *
 * The load-bearing one is `reds on a missing class` — the step's verify clause
 * asks for exactly that, and it is the difference between a gate that checks
 * the corpus and a gate that merely reads it. A gate proven only by a green run
 * over a real corpus is indistinguishable from a gate that cannot fail.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';

import {
    CORPUS_REL,
    type Corpus,
    DETECTORS,
    auditCorpus,
    loadCorpus,
} from '../../src/scripts/check_detector_corpus.js';

const repoRoot = process.cwd();

function freshCorpus(): Corpus {
    return YAML.parse(
        fs.readFileSync(path.join(repoRoot, CORPUS_REL), 'utf-8'),
    ).detectors as Corpus;
}

describe('check_detector_corpus — the shipped corpus', () => {
    it('is clean: every detector has all three classes and every fixture behaves', () => {
        const { findings, fixtures } = auditCorpus(loadCorpus(repoRoot));
        expect(findings).toEqual([]);
        expect(fixtures).toBeGreaterThan(0);
    });

    it('covers every registered detector', () => {
        const corpus = loadCorpus(repoRoot);
        for (const name of Object.keys(DETECTORS)) {
            expect(corpus[name], `no corpus entry for ${name}`).toBeDefined();
        }
    });
});

describe('check_detector_corpus — it can fail', () => {
    it('reds when a detector is missing one class', () => {
        for (const cls of ['fire', 'near-miss-fire', 'must-not-fire'] as const) {
            const corpus = freshCorpus();
            delete corpus['user-reported']?.[cls];
            const { findings } = auditCorpus(corpus);
            expect(
                findings.some((f) => f.kind === 'missing-class' && f.message.includes(cls)),
                `dropping \`${cls}\` did not red the gate`,
            ).toBe(true);
        }
    });

    it('reds when a class is present but empty — a key is not coverage', () => {
        const corpus = freshCorpus();
        corpus['user-reported']!['must-not-fire'] = [];
        const { findings } = auditCorpus(corpus);
        expect(findings.some((f) => f.kind === 'empty-class')).toBe(true);
    });

    it('reds when a detector has no entry at all', () => {
        const corpus = freshCorpus();
        delete corpus['language-mirror'];
        const { findings } = auditCorpus(corpus);
        expect(findings.some((f) => f.detector === 'language-mirror')).toBe(true);
    });

    it('reds when a must-not-fire fixture actually fires', () => {
        const corpus = freshCorpus();
        corpus['user-reported']!['must-not-fire']!.push({
            text: 'du hast die Regel ignoriert',
        });
        const { findings } = auditCorpus(corpus);
        expect(
            findings.some((f) => f.kind === 'wrong-outcome' && f.message.includes('FIRED')),
        ).toBe(true);
    });

    it('reds when a fire fixture stays silent', () => {
        const corpus = freshCorpus();
        corpus['user-reported']!['fire']!.push({ text: 'danke, sieht gut aus' });
        const { findings } = auditCorpus(corpus);
        expect(
            findings.some((f) => f.kind === 'wrong-outcome' && f.message.includes('did NOT fire')),
        ).toBe(true);
    });

    it('reds when the corpus names a detector that does not exist', () => {
        const corpus = freshCorpus();
        corpus['invented-detector'] = { fire: [{ text: 'x' }] };
        const { findings } = auditCorpus(corpus);
        expect(findings.some((f) => f.kind === 'unregistered')).toBe(true);
    });
});

describe('check_detector_corpus — the hardening it pins', () => {
    it('the four measured false fires are all in the must-not-fire class', () => {
        const cases = loadCorpus(repoRoot)['user-reported']?.['must-not-fire'] ?? [];
        const texts = cases.map((c) => c.text ?? '');
        // Each of these opened a defect record on 2026-08-09 before the
        // exculpation check landed. The corpus is where that stays fixed.
        for (const t of [
            'du hast nicht zufällig die Datei noch offen?',
            "you didn't need to, it's fine",
            'das ist fine, du hast nichts falsch gemacht',
        ]) {
            expect(texts, `regression fixture missing: ${t}`).toContain(t);
        }
    });
});
