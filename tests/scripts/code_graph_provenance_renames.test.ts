import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import { readGitHistory } from '../../src/scripts/code_graph/map_answers.js';
import { readProvenance } from '../../src/scripts/code_graph/provenance.js';
import { provenanceAnswer } from '../../src/scripts/code_graph/provenance_verbs.js';
import { RENAMED_MIGRATION, writeAuditFixture } from './code_graph/audit_fixture.js';

let root: string;
let cacheDir: string;

beforeAll(() => {
    root = writeAuditFixture();
    cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-renames-'));
});
afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
});

describe('provenance reads renames from the history, never --follow (7.2, H14/H15)', () => {
    it('the renamed migration timeline holds its own commits and no other file’s create commit', async () => {
        const { graph } = await buildFromRepo(root, null, { lanes: false });
        const a = provenanceAnswer(root, graph, readProvenance(root)!, RENAMED_MIGRATION.to, cacheDir);
        const timeline = a.lines.slice(a.lines.findIndex((l) => l.includes('timeline')));
        expect(timeline.join('\n')).toContain('rename status migration (#11)');
        expect(timeline.join('\n')).toContain('feat: status (#9)');
        expect(timeline.join('\n')).not.toContain('add orders');
    }, 120_000);

    it('authors and last change follow the rename', () => {
        const h = readGitHistory(root)!;
        expect(h.get(RENAMED_MIGRATION.to)?.churn).toBe(2);
        expect(h.has(RENAMED_MIGRATION.from)).toBe(false);
        expect(h.get(RENAMED_MIGRATION.to)?.owners).toEqual([['Dev One', 1]]);
    });
});
