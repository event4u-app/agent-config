import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    auditCarries,
    carryProblems,
    deadRoadmaps,
    selfTestCases,
} from '../../src/scripts/lint_carrier_integrity.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

let dir: string;

function plant(rel: string, body: string): void {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

const PARENT = '---\ncomplexity: bounded\n---\n# Parent\n\n## Phase 1 - a phase\n\n- [~] **1.1 A carried step.**\n      <!-- deferred-resolution: carried-to=road-to-receiver -->\n';

const BARE_PARENT = '---\ncomplexity: bounded\n---\n# Parent\n\n## Phase 1 - a phase\n\n- [~] **1.1 A step nobody said where to send.**\n';

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'carrier-unit-'));
});

afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

describe('carryProblems classes', () => {
    it('classes a missing annotation as unannotated, not as a broken destination', () => {
        const found = carryProblems(dir, 'road-to-parent', BARE_PARENT);
        expect(found).toHaveLength(1);
        expect(found[0]!.cls).toBe('unannotated');
    });

    it('classes a deleted receiver as broken-destination', () => {
        const found = carryProblems(dir, 'road-to-parent', PARENT);
        expect(found).toHaveLength(1);
        expect(found[0]!.cls).toBe('broken-destination');
        expect(found[0]!.detail).toContain('no longer exists');
    });

    it('accepts a live receiver that back-links', () => {
        plant(
            'agents/roadmaps/road-to-receiver.md',
            '---\ncomplexity: bounded\nparent_roadmap: road-to-parent\n---\n# R\n',
        );
        expect(carryProblems(dir, 'road-to-parent', PARENT)).toEqual([]);
    });

    it('accepts a receiver that completed and archived, and rejects one archived with open steps', () => {
        const head = '---\ncomplexity: bounded\nparent_roadmap: road-to-parent\n---\n# R\n';
        plant('agents/roadmaps/archive/road-to-receiver.md', `${head}- [x] **1.1 Done.**\n`);
        expect(carryProblems(dir, 'road-to-parent', PARENT)).toEqual([]);

        plant('agents/roadmaps/archive/road-to-receiver.md', `${head}- [ ] **1.1 Open.**\n`);
        const stranded = carryProblems(dir, 'road-to-parent', PARENT);
        expect(stranded).toHaveLength(1);
        expect(stranded[0]!.cls).toBe('broken-destination');
        expect(stranded[0]!.detail).toContain('stranded');
    });

    it('refuses a roadmap naming itself as the destination', () => {
        const selfRef = PARENT.replace('carried-to=road-to-receiver', 'carried-to=road-to-parent');
        const found = carryProblems(dir, 'road-to-parent', selfRef);
        expect(found).toHaveLength(1);
        expect(found[0]!.detail).toContain('OWN roadmap');
    });
});

describe('auditCarries walk', () => {
    it('reads the dead directories only, and reports what it read', () => {
        plant('agents/roadmaps/archive/road-to-parent.md', PARENT);
        plant('agents/roadmaps/road-to-active.md', PARENT);
        const { problems, scanned } = auditCarries(dir);
        expect(scanned).toBe(1);
        expect(problems.map((p) => p.source)).toEqual(['agents/roadmaps/archive/road-to-parent.md']);
    });

    it('skips INDEX and README rather than parsing them as roadmaps', () => {
        plant('agents/roadmaps/archive/INDEX.md', '- [~] a row\n');
        plant('agents/roadmaps/archive/README.md', '- [~] a row\n');
        expect(deadRoadmaps(dir)).toEqual([]);
        expect(auditCarries(dir).scanned).toBe(0);
    });

    it('finds an unannotated step even though the annotation marker is absent from the file', () => {
        plant('agents/roadmaps/archive/road-to-parent.md', BARE_PARENT);
        const { problems } = auditCarries(dir);
        expect(problems).toHaveLength(1);
        expect(problems[0]!.cls).toBe('unannotated');
    });
});

describe('the self-test suite itself', () => {
    it('declares only broken-destination cases, in both polarities', () => {
        const cases = selfTestCases(REPO_ROOT);
        expect(cases.filter((c) => c.expect === 'reject').length).toBeGreaterThanOrEqual(5);
        expect(cases.filter((c) => c.expect === 'accept').length).toBeGreaterThanOrEqual(4);
    });
});
