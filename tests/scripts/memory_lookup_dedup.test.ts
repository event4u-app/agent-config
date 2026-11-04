// A union merge of a flat curated file can leave the same entry block twice.
// The reader keeps the first entry per id, across both layouts, in the dev
// script and in the template a consumer installs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ml from '../../src/scripts/memory_lookup.js';

const REPO_ROOT = resolve(__dirname, '..', '..');
const TSX_BIN = join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const TEMPLATE = join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'memory_lookup.ts');
const TODAY_ISO = new Date().toISOString().slice(0, 10);

function entry(id: string, status = 'active'): string {
    return [
        `  - id: ${id}`,
        `    status: ${status}`,
        '    confidence: high',
        '    source: ["docs/teams.md"]',
        '    owner: team-payments',
        `    last_validated: ${TODAY_ISO}`,
        '    review_after_days: 180',
        '    path: "app/Http/Controllers/Billing/**"',
    ].join('\n');
}

let tmp: string;
let origCwd: string;

function writeMem(rel: string, body: string): void {
    const full = join(tmp, 'agents', 'memory', rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body, 'utf-8');
}

function devIds(): string[] {
    process.chdir(tmp);
    ml._setMemoryRoot(join('agents', 'memory'));
    ml._setIntakeRoot(join('agents', 'memory', 'intake'));
    ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
    return ml.retrieve(['ownership'], ['billing'], 10).map((h) => String(h.id)).sort();
}

function templateIds(): string[] {
    const r = spawnSync(TSX_BIN, [TEMPLATE, '--types', 'ownership', '--key', 'billing', '--limit', '10'], {
        cwd: tmp,
        encoding: 'utf8',
    });
    expect(r.status, r.stderr).toBe(0);
    return [...r.stdout.matchAll(/id=(\S+)/g)].map((m) => m[1] ?? '').sort();
}

beforeEach(() => {
    origCwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), 'memlook-dedup-'));
    mkdirSync(join(tmp, 'agents', 'memory', 'intake'), { recursive: true });
});
afterEach(() => {
    process.chdir(origCwd);
    ml._setMemoryRoot(join('agents', 'memory'));
    ml._setIntakeRoot(join('agents', 'memory', 'intake'));
    ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
    rmSync(tmp, { recursive: true, force: true });
});

describe('curated reader — one hit per id', () => {
    for (const [label, ids] of [
        ['dev', devIds],
        ['template', templateIds],
    ] as const) {
        it(`${label}: a flat file holding the same id twice returns one hit`, () => {
            writeMem('ownership.yml', `entries:\n${entry('own-1')}\n${entry('own-1')}\n`);
            expect(ids()).toEqual(['own-1']);
        });

        it(`${label}: two distinct ids return two hits`, () => {
            writeMem('ownership.yml', `entries:\n${entry('own-1')}\n${entry('own-2')}\n`);
            expect(ids()).toEqual(['own-1', 'own-2']);
        });

        it(`${label}: an id in both layouts is yielded once`, () => {
            writeMem('ownership.yml', `entries:\n${entry('own-1')}\n`);
            writeMem('ownership/entries.yml', `entries:\n${entry('own-1')}\n${entry('own-3')}\n`);
            expect(ids()).toEqual(['own-1', 'own-3']);
        });

        it(`${label}: the first entry of an id decides, even when it is excluded`, () => {
            writeMem('ownership.yml', `entries:\n${entry('own-1', 'deprecated')}\n${entry('own-1')}\n`);
            expect(ids()).toEqual([]);
        });
    }
});
