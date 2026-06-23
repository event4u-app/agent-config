
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as scc from '../../src/scripts/skill_collision_clusters.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'skill_collision_clusters.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

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

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

// Keep os/fs import used even when some paths are skipped.
void os;
