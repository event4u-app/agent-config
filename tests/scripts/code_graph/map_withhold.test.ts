import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MapModel } from '../../../src/scripts/code_graph/map_model.js';
import { GATE_CONFIG, sourceWithholding, WITHHELD_SUBJECT, withholdSources } from '../../../src/scripts/code_graph/map_withhold.js';

const roots: string[] = [];
afterEach(() => {
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

function repo(config?: object): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'map-withhold-'));
    roots.push(root);
    if (config) {
        fs.mkdirSync(path.join(root, path.dirname(GATE_CONFIG)), { recursive: true });
        fs.writeFileSync(path.join(root, GATE_CONFIG), JSON.stringify(config));
    }
    return root;
}

function model(externals: string[], subjects: string[]): MapModel {
    return {
        files: [{ externals: [...externals] }],
        analyses: { externals: externals.map((e) => [e, 1]) },
        provenance: { commits: subjects.map((s, i) => [`sha${i}`, '2026-01-01', 'a', '', [], s]) },
    } as unknown as MapModel;
}

describe('map source withholding', () => {
    it('is inactive where the repository runs no source gate', () => {
        expect(sourceWithholding(repo())).toBeNull();
    });

    it('withholds denied subjects and slug specifiers, keeps the rest in place', () => {
        const w = sourceWithholding(repo({ deny: ['\\bacmesrc\\b'] }));
        expect(w).not.toBeNull();
        const m = model(['github.com/someowner/somerepo/v2', 'lodash', './local'], ['port ideas from AcmeSrc', 'fix: plain subject']);
        const n = withholdSources(m, w as NonNullable<typeof w>);
        expect(n).toBe(3);
        expect(m.files[0]?.externals).toEqual(['lodash', './local']);
        expect(m.analyses.externals.map(([s]) => s)).toEqual(['lodash', './local']);
        expect(m.provenance?.commits.map((c) => c[5])).toEqual([WITHHELD_SUBJECT, 'fix: plain subject']);
        // the tuple keeps its shape: the subject is replaced, never dropped
        expect(m.provenance?.commits[0]).toHaveLength(6);
    });

    it('does not treat a deny token inside a longer word as a hit when the pattern is word-bounded', () => {
        const w = sourceWithholding(repo({ deny: ['\\bacmesrc\\b'] })) as (t: string) => boolean;
        expect(w('acmesrcx tooling')).toBe(false);
        expect(w('acmesrc')).toBe(true);
    });

    it('withholds every text when only digests are configured', () => {
        const w = sourceWithholding(repo({ deny: [], deny_digests: ['abc'] })) as (t: string) => boolean;
        expect(w('fix: plain subject')).toBe(true);
    });
});
