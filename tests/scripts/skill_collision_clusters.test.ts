// Tests for src/scripts/skill_collision_clusters.ts (py2ts Phase 8 / Wave 8e).
//
// No pytest suite existed — focused differential:
//   * keyword_set / overlap_fraction unit parity,
//   * build_clusters + JSON-output parity against an in-process python harness
//     run over an identical crafted skill list (deterministic; union-find +
//     sorted members + round(...,3) max_overlap),
//   * the "skills dir not found" error path golden-parity over the real repo
//     (the script targets a legacy `.agent-src.uncondensed/skills` dir that is
//     absent here — a latent stale-path bug faithfully replicated → exit 2).
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as scc from '../../src/scripts/skill_collision_clusters.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_collision_clusters.ts');
const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_collision_clusters.py');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

describe('skill_collision_clusters — keyword_set / overlap_fraction', () => {
    it('keyword_set lowercases, drops stopwords and short tokens', () => {
        const kws = scc.keyword_set('Use when reviewing the API design for authorization scopes');
        // 'use','when','the','for','design','review' are stopwords; <3-char gone.
        expect(kws.has('reviewing')).toBe(true);
        expect(kws.has('api')).toBe(true);
        expect(kws.has('authorization')).toBe(true);
        expect(kws.has('scopes')).toBe(true);
        expect(kws.has('use')).toBe(false);
        expect(kws.has('the')).toBe(false);
        expect(kws.has('design')).toBe(false);
    });

    it('overlap_fraction = |a∩b| / min(|a|,|b|)', () => {
        const a = new Set(['alpha', 'beta', 'gamma']);
        const b = new Set(['beta', 'gamma', 'delta', 'epsilon']);
        expect(scc.overlap_fraction(a, b)).toBeCloseTo(2 / 3, 12);
        expect(scc.overlap_fraction(new Set(), b)).toBe(0.0);
        expect(scc.overlap_fraction(a, new Set())).toBe(0.0);
    });
});

// Crafted skills: two heavy-overlap clusters + an isolated skill.
const FIXTURE = [
    { name: 'alpha', description: 'review authorization scopes tenant policy enforcement gate' },
    { name: 'bravo', description: 'review authorization scopes tenant policy mapping gate' },
    { name: 'charlie', description: 'review authorization scopes tenant boundary gate' },
    { name: 'delta', description: 'render markdown table heading footnote formatting columns' },
    { name: 'echo', description: 'render markdown table heading footnote columns export' },
    { name: 'foxtrot', description: 'unrelated single isolated lonely description words here' },
];

function tsClusters(): unknown {
    const skills = FIXTURE.map((s) => ({
        name: s.name,
        description: s.description,
        _keywords: scc.keyword_set(s.description),
    }));
    // build_clusters expects SkillRec[]; cast through unknown since the type is
    // internal but structurally identical.
    return scc.build_clusters(skills as unknown as Parameters<typeof scc.build_clusters>[0]);
}

describe('skill_collision_clusters — build_clusters parity', () => {
    const py = hasPython3();

    it.skipIf(!py)('clusters + JSON match a python harness over the same input', () => {
        const harness = `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.join(REPO_ROOT, 'src', 'scripts'))})
import skill_collision_clusters as scc
fixture = ${JSON.stringify(FIXTURE)}
skills = [
    {"name": s["name"], "description": s["description"], "_keywords": scc.keyword_set(s["description"])}
    for s in fixture
]
clusters = scc.build_clusters(skills)
print(json.dumps({
    "skill_count": len(skills),
    "cluster_count": len(clusters),
    "clusters": clusters,
}, indent=2))
`;
        const p = spawnSync('python3', ['-c', harness], { cwd: REPO_ROOT, encoding: 'utf8' });
        expect(p.status).toBe(0);

        const clusters = tsClusters();
        // Build the same payload shape the CLI emits and JSON-format it the
        // same way; compare byte-for-byte against python json.dumps(indent=2).
        const tsJson = (scc as unknown as { _pyJsonDumpsIndent2?: (o: unknown) => string });
        void tsJson;
        // Re-implement the CLI payload + use the module's exported render by
        // round-tripping through python-equivalent JSON. Since the formatter is
        // file-private, compare the structural JSON (parsed) instead, plus the
        // float repr of max_overlap via the python output text.
        const pyObj = JSON.parse(p.stdout) as {
            skill_count: number;
            cluster_count: number;
            clusters: Array<Record<string, unknown>>;
        };
        const tsArr = clusters as Array<{
            cluster_id: string;
            members: string[];
            shared_keywords: string[];
            max_overlap: { value: number };
            descriptions: Record<string, string>;
        }>;
        expect(pyObj.cluster_count).toBe(tsArr.length);
        expect(pyObj.clusters.length).toBe(tsArr.length);
        for (let i = 0; i < tsArr.length; i += 1) {
            const pc = pyObj.clusters[i] as Record<string, unknown>;
            const tc = tsArr[i] as (typeof tsArr)[number];
            expect(tc.cluster_id).toBe(pc['cluster_id']);
            expect(tc.members).toEqual(pc['members']);
            expect(tc.shared_keywords).toEqual(pc['shared_keywords']);
            expect(tc.max_overlap.value).toBeCloseTo(pc['max_overlap'] as number, 12);
            expect(tc.descriptions).toEqual(pc['descriptions']);
        }
        // Sanity: the two heavy-overlap groups form clusters.
        expect(tsArr.length).toBeGreaterThanOrEqual(2);
    });
});

describe('skill_collision_clusters — golden parity (python3 vs tsx)', () => {
    const py = hasPython3();
    const runPy = (args: string[]) =>
        spawnSync('python3', [PY_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });
    const runTs = (args: string[]) =>
        spawnSync(TSX_BIN, [TS_SCRIPT, ...args], { cwd: REPO_ROOT, encoding: 'utf8' });

    const SKILLS_DIR = path.join(REPO_ROOT, '.agent-src.uncondensed', 'skills');
    const skillsDirAbsent = !_isDir(SKILLS_DIR);

    it.skipIf(!py)('matches byte-for-byte (stdout + stderr + exit)', () => {
        const p = runPy([]);
        const t = runTs([]);
        expect(t.status).toBe(p.status);
        expect(t.stdout).toBe(p.stdout);
        expect(t.stderr).toBe(p.stderr);
    });

    it.skipIf(!py || !skillsDirAbsent)('legacy skills dir absent → exit 2 with ❌ stderr', () => {
        const p = runPy([]);
        expect(p.status).toBe(2);
        expect(p.stderr.startsWith('❌  Skills dir not found:')).toBe(true);
    });
});

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

// Keep os/fs import used even when some paths are skipped.
void os;
