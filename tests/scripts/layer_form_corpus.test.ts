import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { partitionOf } from '../../src/scripts/_lib/routing_corpus.js';
import {
    COMPARISON_CORPUS_REL,
    absentSources,
    loadComparisonCorpus,
    obligationRuleIds,
    readComparisonManifest,
} from '../../src/scripts/_lib/layer_form_corpus.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const temps: string[] = [];
afterEach(() => {
    for (const dir of temps.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

const HOLDOUT = 'fixture-0';
const TRAIN = 'fixture-2';

/**
 * A repository root carrying one train and one holdout trigger corpus. The
 * HOLDOUT corpus is a DIRECTORY at the path a corpus file would occupy, so any
 * reader that opens it raises `EISDIR` — the tripwire. The seal is kept by
 * refusal rather than by filtering, so a loader that read the file and
 * discarded the cases afterwards would fail here, which is the distinction the
 * assertion exists to make.
 */
function tripwireRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'layer-form-corpus-'));
    temps.push(root);
    fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src', 'rules'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tests', 'eval', 'routing-matrix'), { recursive: true });
    for (const rel of [COMPARISON_CORPUS_REL, path.join('src', 'config', 'rule-consequence-class.json')]) {
        fs.copyFileSync(path.join(REPO, rel), path.join(root, rel));
    }
    fs.writeFileSync(
        path.join(root, 'tests', 'eval', 'routing-matrix', 'fixture.yaml'),
        'rule: fixture\npositives:\n  - prompt: "one"\n    expected_skills: [x]\n',
    );
    fs.mkdirSync(path.join(root, 'src', 'skills', TRAIN, 'evals'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'skills', TRAIN, 'evals', 'triggers.json'),
        JSON.stringify({ queries: [{ q: 'a train prompt', trigger: true }] }),
    );
    // The tripwire: a directory where the sealed corpus file would be.
    fs.mkdirSync(path.join(root, 'src', 'skills', HOLDOUT, 'evals', 'triggers.json'), { recursive: true });
    return root;
}

describe('the layer-form comparison corpus', () => {
    it('names every source the manifest declares, and nothing else', () => {
        const manifest = readComparisonManifest(REPO);
        expect(manifest.sources.map((s) => s.id).sort()).toEqual([
            'conformance',
            'host-graded',
            'obligation',
            'routing-matrix',
            'trigger-corpus-train',
        ]);
        for (const source of manifest.sources) {
            if (source.state === 'absent') {
                expect(source.why.length).toBeGreaterThan(0);
                expect(source.reopens_when.length).toBeGreaterThan(0);
            }
        }
    });

    it('carries the two sources that do not exist as absent, never as a guess', () => {
        expect(absentSources(readComparisonManifest(REPO)).sort()).toEqual(['conformance', 'host-graded']);
    });

    it('resolves a non-empty case count for every present source, and nothing for an absent one', () => {
        const loaded = loadComparisonCorpus(REPO);
        expect(loaded.sources).toHaveLength(5);
        for (const source of loaded.sources) {
            if (source.state === 'present') expect(source.cases).toBeGreaterThan(0);
            else expect(source.cases).toBe(0);
        }
        expect(loaded.total).toBeGreaterThan(0);
    });

    it('counts an obligation case for every consequence-class and safety-floor rule', () => {
        const ids = obligationRuleIds(REPO);
        expect(ids.has('non-destructive-by-default')).toBe(true); // tier: safety-floor
        expect(ids.has('broken-access-control')).toBe(true); // consequence class
        expect(ids.has('markdown-safe-codeblocks')).toBe(false); // neither
    });

    // The step's verify clause: no sealed holdout corpus file is opened.
    it('opens no sealed holdout corpus file', () => {
        const root = tripwireRoot();
        // Control: the tripwire is on the sealed side and the read corpus is not.
        expect(partitionOf(HOLDOUT)).toBe('holdout');
        expect(partitionOf(TRAIN)).toBe('train');

        const loaded = loadComparisonCorpus(root);
        const train = loaded.sources.find((s) => s.id === 'trigger-corpus-train');
        // Control: the train corpus WAS opened, so surviving the tripwire is not vacuous.
        expect(train?.cases).toBe(1);
    });

    it('the tripwire is live — a reader that opens the sealed path fails', () => {
        const root = tripwireRoot();
        expect(() => fs.readFileSync(path.join(root, 'src', 'skills', HOLDOUT, 'evals', 'triggers.json'), 'utf8')).toThrow();
    });

    it('the manifest it reads is the committed one', () => {
        expect(fs.existsSync(path.join(REPO, COMPARISON_CORPUS_REL))).toBe(true);
    });
});
