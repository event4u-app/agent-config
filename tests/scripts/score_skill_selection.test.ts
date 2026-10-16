// Tests for src/scripts/score_skill_selection.ts (py2ts Phase 8 / Wave 8c).
//
// The script reads tests/fixtures/skill_selection/fixtures.yml plus the
// clusters JSON that `skill_collision_clusters.ts` writes, and writes a JSON
// report (default agents/reports/skill-selection-accuracy.json).
//
//   A. With NO selection flag it prints "❌  Specify ..." to stderr and exits 2
//      BEFORE reading any input.
//
//   B. `--baseline` without the clusters JSON throws on the read → exit 1,
//      empty stdout, no report written.
//
//   C. The happy path runs on every machine, against a fixture written at the
//      PRODUCER's path, imported from the producer. It used to be gated on a
//      file existing at a path nothing writes, so the suite stayed green while
//      the happy path never ran (road-to-unknowns-that-say-so F6).
//
// B and C swap the shared clusters file in and out under the global-state lock
// and restore whatever was there before.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { acquireGlobalStateLock } from './_global_state_lock.js';
import { CLUSTERS_JSON_PATH as READER_CLUSTERS, main } from '../../src/scripts/score_skill_selection.js';
import { OUT_JSON as PRODUCER_CLUSTERS } from '../../src/scripts/skill_collision_clusters.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'agents', 'reports', 'skill-selection-accuracy.json');

const FIXTURE_CLUSTERS = {
    clusters: [{ id: 'C01', members: ['adversarial-review', 'security-audit', 'performance-analysis'] }],
};

function runTs(args: string[]) {
    return runInProc(main, args);
}

/** Run `body` with the shared clusters file set to `content` (null = absent), then restore it. */
function withClustersFile<T>(content: string | null, body: () => T): T {
    const release = acquireGlobalStateLock();
    const before = fs.existsSync(PRODUCER_CLUSTERS) ? fs.readFileSync(PRODUCER_CLUSTERS, 'utf-8') : null;
    try {
        if (content === null) {
            fs.rmSync(PRODUCER_CLUSTERS, { force: true });
        } else {
            fs.mkdirSync(path.dirname(PRODUCER_CLUSTERS), { recursive: true });
            fs.writeFileSync(PRODUCER_CLUSTERS, content, 'utf-8');
        }
        return body();
    } finally {
        if (before !== null) fs.writeFileSync(PRODUCER_CLUSTERS, before, 'utf-8');
        else fs.rmSync(PRODUCER_CLUSTERS, { force: true });
        release();
    }
}

describe('score_skill_selection — CLI contract', () => {
    it('no selection flag → exit 2 + identical stderr, no write', () => {
        const before = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
        const ts = runTs([]);
        expect(ts.status).toBe(2);
        const after = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
        expect(after).toBe(before);
    });

    it('--baseline without clusters JSON → exit 1, empty stdout, no write', () => {
        withClustersFile(null, () => {
            const before = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
            const ts = runTs(['--baseline']);
            expect(ts.status).toBe(1);
            expect(ts.stdout).toBe('');
            const after = fs.existsSync(DEFAULT_OUT) ? fs.readFileSync(DEFAULT_OUT, 'utf-8') : null;
            expect(after).toBe(before);
        });
    });

    it('reader-and-writer-share-the-clusters-path', () => {
        expect(READER_CLUSTERS).toBe(PRODUCER_CLUSTERS);
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'score-skill-selection-'));
        const out = path.join(tmp, 'accuracy.json');
        try {
            withClustersFile(JSON.stringify(FIXTURE_CLUSTERS), () => {
                const ts = runTs(['--baseline', '--out', out]);
                expect(ts.status, ts.stderr).toBe(0);
                expect(ts.stdout).toContain('source=tfidf-baseline');
                const report = JSON.parse(fs.readFileSync(out, 'utf-8')) as {
                    source: string;
                    overall: { n: number };
                    clusters: Array<{ cluster: string }>;
                };
                expect(report.source).toBe('tfidf-baseline');
                expect(report.overall.n).toBeGreaterThan(0);
                expect(report.clusters.map((c) => c.cluster)).toContain('C01');
            });
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });

    it('bad flag → exit code parity (argparse banner prose not compared)', () => {
        expect(runTs(['--bogus']).status).toBe(2);
    });
});
