/**
 * The overlap notice `task generate-tools` prints — the surface that has to agree
 * with `check_single_delivery`.
 *
 * Written 2026-09-07, and the gap it closes is worth naming: this module had NO
 * test. Its own docstring says "two surfaces disagreeing about the same question
 * is worse than one surface being silent", and nothing checked that they agreed.
 * The `commands` key drifted apart from the gate's on the very change that made
 * the difference observable.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { overlapFindings, overlapNotice } from '../../src/scripts/_lib/layer_overlap_notice.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'lon-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const home = (): string => path.join(root, 'home');
const project = (): string => path.join(root, 'project');

function write(base: string, rel: string): void {
    const target = path.join(base, '.claude', rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, 'x', 'utf8');
}

function dir(base: string, rel: string): void {
    fs.mkdirSync(path.join(base, '.claude', rel), { recursive: true });
}

describe('overlapFindings', () => {
    it('skips a type whose layers are not BOTH readable', () => {
        // One layer absent means nothing is doubled there, and that is the topology
        // the notice wants — a warning would be noise on the success case.
        write(home(), 'rules/a.md');
        expect(overlapFindings(home(), project())).toEqual([]);
        expect(overlapNotice(home(), project())).toBeNull();
    });

    it('reports a genuinely shared name', () => {
        write(home(), 'rules/shared.md');
        write(project(), 'rules/shared.md');
        expect(overlapFindings(home(), project())).toEqual(['rules=1']);
        expect(overlapNotice(home(), project())).toContain('rules=1');
    });

    it('counts skills by directory name, the host unit for that family', () => {
        dir(home(), 'skills/alpha');
        dir(home(), 'skills/beta');
        dir(project(), 'skills/beta');
        expect(overlapFindings(home(), project())).toEqual(['skills=1']);
    });

    it('keys commands on the SUBPATH — a shared cluster over disjoint commands is no overlap', () => {
        // The false positive this key exists to remove, observed 2026-09-07: with
        // per-name withholding the project layer holds exactly the commands the host
        // lacks, and those sit inside a cluster the host also has. The top-level key
        // reported `commands=1` over two disjoint command sets.
        write(home(), 'commands/analyze/inbox.md');
        write(project(), 'commands/analyze/repo.md');
        expect(overlapFindings(home(), project())).toEqual([]);
    });

    it('STILL reports the same /cluster:sub present in both layers', () => {
        // The direction the key change must not weaken.
        write(home(), 'commands/analyze/inbox.md');
        write(project(), 'commands/analyze/inbox.md');
        expect(overlapFindings(home(), project())).toEqual(['commands=1']);
    });

    it('ignores README.md, which both layers carry and which names no command', () => {
        write(home(), 'commands/README.md');
        write(project(), 'commands/README.md');
        expect(overlapFindings(home(), project())).toEqual([]);
    });

    it('ignores a non-.md entry under commands', () => {
        write(home(), 'commands/notes.txt');
        write(project(), 'commands/notes.txt');
        expect(overlapFindings(home(), project())).toEqual([]);
    });

    it('reports several families in one notice', () => {
        write(home(), 'rules/r.md');
        write(project(), 'rules/r.md');
        dir(home(), 'skills/s');
        dir(project(), 'skills/s');
        expect(overlapFindings(home(), project())).toEqual(['rules=1', 'skills=1']);
    });
});
