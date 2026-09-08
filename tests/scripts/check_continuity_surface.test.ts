/**
 * Tests for the continuity-surface inventory and its ratchet.
 *
 * The gate's own `--self-test` already proves the four failure classes in both
 * directions against throwaway repositories, and CI runs it. What THESE tests
 * add is the half a self-test cannot reach without becoming a second test
 * suite: properties of the SHIPPED inventory over the SHIPPED tree, and the
 * behaviour of the discovery walk itself.
 *
 * The distinction matters because the two can fail independently. A self-test
 * green over synthetic fixtures says the mechanism works; it says nothing about
 * whether the committed inventory still describes this repository, which is the
 * property the roadmap's AC-8 actually depends on.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    AXES,
    TARGETS,
    countAxes,
    discoverStateLeaves,
    locusResolves,
    readInventory,
    validateInventory,
} from '../../src/scripts/_lib/continuity_surface.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

describe('the shipped inventory describes the shipped tree', () => {
    it('disposes of every discovered persisted-state leaf, with no dead loci', () => {
        const inv = readInventory(REPO_ROOT);
        const discovered = discoverStateLeaves(REPO_ROOT);
        const findings = validateInventory(REPO_ROOT, inv, discovered);
        // Named rather than counted: a bare length assertion reports "expected 0
        // got 3" and makes the reader go find which three.
        expect(findings.map((f) => `${f.kind}: ${f.detail}`)).toEqual([]);
    });

    it('discovers a non-trivial corpus — a moved root reads zero and must not pass silently', () => {
        expect(discoverStateLeaves(REPO_ROOT).length).toBeGreaterThan(30);
    });

    it('gives every row a reason, not only the exclusions', () => {
        const thin = readInventory(REPO_ROOT).rows.filter((r) => r.reason.trim().length < 20);
        expect(thin.map((r) => r.id)).toEqual([]);
    });

    it('keeps every axis on the contract, so a typo cannot silently drop a row from a count', () => {
        const off = readInventory(REPO_ROOT).rows.filter((r) => !AXES.includes(r.axis));
        expect(off.map((r) => `${r.id} -> ${String(r.axis)}`)).toEqual([]);
    });
});

describe('the derivation is a derivation, not an assertion', () => {
    it('counts only `counted` rows', () => {
        const rows = [
            { id: 'a', axis: 'continuity_schemas' as const, disposition: 'counted' as const, locus: 'x', reason: 'r'.repeat(30) },
            { id: 'b', axis: 'continuity_schemas' as const, disposition: 'excluded' as const, locus: 'x', reason: 'r'.repeat(30) },
        ];
        expect(countAxes({ rows }).continuity_schemas).toBe(1);
    });

    it('reports the five axes in the order the parent roadmap states them', () => {
        // The goal line reads `0 / 0 / 1 / 1 / 0` positionally. A reordering
        // here would silently change what a reader comparing against that line
        // is comparing.
        expect([...AXES]).toEqual([
            'public_continuity_commands',
            'session_resume_pickers',
            'persistent_continuity_artefacts',
            'continuity_schemas',
            'normal_path_manual_actions',
        ]);
        expect(TARGETS).toEqual({
            public_continuity_commands: 0,
            session_resume_pickers: 0,
            persistent_continuity_artefacts: 1,
            continuity_schemas: 1,
            normal_path_manual_actions: 0,
        });
    });
});

describe('the exclusions the council required to stay visible are present and reasoned', () => {
    it('lists `checkpoints` as an excluded artefact with the run-integrity reason', () => {
        const row = readInventory(REPO_ROOT).rows.find((r) => r.id === 'checkpoints');
        expect(row).toBeDefined();
        expect(row?.disposition).toBe('excluded');
        // The worked example the AI council of 2026-09-07 named as the gaming
        // vector: classifying run_checkpoint outside "continuity" is exactly how
        // position 3 could be made to read 1 with nothing retired. It stays
        // excluded on a recorded ruling, and the ruling stays in the row.
        expect(row?.reason).toMatch(/run:supervise/);
    });

    it('lists the run-checkpoint SCHEMA as excluded on the same ruling', () => {
        const row = readInventory(REPO_ROOT).rows.find((r) => r.id === 'schema:run-checkpoint');
        expect(row?.disposition).toBe('excluded');
    });
});

describe('locus resolution', () => {
    it('accepts a bare path that exists and a line inside it', () => {
        expect(locusResolves(REPO_ROOT, 'src/config/continuity-surface.json')).toBe(true);
        expect(locusResolves(REPO_ROOT, 'src/config/continuity-surface.json:1')).toBe(true);
    });

    it('refuses a path that does not exist — a retirement claimed but not made', () => {
        expect(locusResolves(REPO_ROOT, 'src/scripts/never_existed_here.ts')).toBe(false);
    });

    it('refuses a line past the end of the file', () => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ccs-locus-'));
        fs.writeFileSync(path.join(dir, 'short.ts'), 'one\ntwo\n');
        expect(locusResolves(dir, 'short.ts:2')).toBe(true);
        expect(locusResolves(dir, 'short.ts:99')).toBe(false);
    });
});

describe('the discovery walk', () => {
    it('sees a state path in a source file and not one in a *.test.ts fixture', () => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ccs-walk-'));
        fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
        const prefix = 'agents/runtime/' + 'state/';
        fs.writeFileSync(path.join(dir, 'src', 'scripts', 'a.ts'), `const P='${prefix}real.json';\n`);
        fs.writeFileSync(path.join(dir, 'src', 'scripts', 'a.test.ts'), `const P='${prefix}fixture.json';\n`);
        expect(discoverStateLeaves(dir).map((d) => d.leaf)).toEqual(['real.json']);
    });

    it('sees the path-segment spelling too, so a `path.join` write cannot hide', () => {
        const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ccs-walk2-'));
        fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'src', 'scripts', 'b.ts'),
            "const P = path.join('agents', 'runtime', 'state', 'joined.json');\n",
        );
        expect(discoverStateLeaves(dir).map((d) => d.leaf)).toEqual(['joined.json']);
    });

    it('is deterministic and sorted, so two runs over one tree diff only when the tree does', () => {
        const a = discoverStateLeaves(REPO_ROOT).map((d) => d.leaf);
        const b = discoverStateLeaves(REPO_ROOT).map((d) => d.leaf);
        expect(a).toEqual(b);
        expect(a).toEqual([...a].sort());
    });
});
