// The user-scoped ownership ledger in the global deploy inventory —
// road-to-an-ownership-record-that-belongs-to-the-user, steps 2.1, 2.3 and 2.4.
//
// In-process and fast; the end-to-end proof through the real orchestrator is
// `ownership_ledger_real_install.test.ts`. Expected digests are computed from
// the fixture bytes held in each case, never pinned literals.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as inv from '../../src/scripts/_lib/global_deploy_inventory.js';
import { recordGlobalDeploy } from '../../src/install/ownershipLedger.js';
import { decideDeployWrite, sidecarPathFor } from '../../src/install/preserve.js';
import { recordedHashesWithLedger } from '../../src/install/recordedOwnership.js';

const TAG = 'event4u/agent-config';

let tmp: string;
let anchor: string;
let inventoryFile: string;

function sha(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex');
}

function write(rel: string, body: string): string {
    const p = path.join(anchor, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    return p;
}

function record(over: Partial<Parameters<typeof recordGlobalDeploy>[0]> = {}): ReturnType<typeof recordGlobalDeploy> {
    return recordGlobalDeploy({
        toolId: 'cursor',
        anchorRaw: anchor,
        anchor,
        currentFiles: new Set(['rules/a.md']),
        destSubs: ['rules'],
        packageTag: TAG,
        preserved: [],
        staged: new Map(),
        recordedFor: () => undefined,
        inventoryPath: inventoryFile,
        ...over,
    });
}

function digestsOf(): Map<string, inv.LedgerDigest> {
    return inv.recorded_digests('cursor', anchor, inv.load_inventory(inventoryFile));
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'own-ledger-unit-'));
    anchor = path.join(tmp, 'anchor');
    inventoryFile = path.join(tmp, 'deployed-files.json');
    fs.mkdirSync(anchor, { recursive: true });
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('step 2.1 — inventory schema 2 is additive', () => {
    it('a schema-1 inventory still loads, and its files still read as the path allowlist', () => {
        fs.writeFileSync(
            inventoryFile,
            JSON.stringify({ schema_version: 1, tools: { cursor: { anchor, files: ['rules/a.md'] } } }),
        );
        const loaded = inv.load_inventory(inventoryFile);
        expect([...inv.recorded_rel_files('cursor', anchor, loaded)]).toEqual(['rules/a.md']);
        expect(inv.recorded_digests('cursor', anchor, loaded).size).toBe(0);
    });

    it('records both digests per file and keeps files unchanged', () => {
        const body = '# a\n';
        write('rules/a.md', body);
        record();
        const saved = inv.load_inventory(inventoryFile) as {
            schema_version: number;
            tools: { cursor: { files: string[] } };
        };
        expect(saved.schema_version).toBe(2);
        expect(saved.tools.cursor.files).toEqual(['rules/a.md']);
        expect(digestsOf().get('rules/a.md')).toEqual({
            installed_sha256: sha(body),
            packaged_sha256: sha(body),
        });
    });

    it('a caller passing no digests writes an entry that reads exactly as schema 1', () => {
        const data: inv.Inventory = { schema_version: 1, tools: {} };
        inv.record_deploy('cursor', anchor, new Set(['rules/a.md']), data);
        expect((data['tools'] as Record<string, Record<string, unknown>>)['cursor']).toEqual({
            anchor,
            files: ['rules/a.md'],
        });
    });
});

describe('step 2.3 — the record is user-scoped, whatever directory installed', () => {
    it('a project root with no manifest still reads the digest the ledger recorded', () => {
        const body = '# a\n';
        const target = write('rules/a.md', body);
        record();
        const recorded = recordedHashesWithLedger(path.join(tmp, 'no-project-here'), {
            [inv.INVENTORY_ENV]: inventoryFile,
        });
        expect(recorded.get(target)).toBe(sha(body));
    });
});

describe('a preserved edit is recorded as the content WE last produced, never as the edit', () => {
    it('records the staged digest, so a merged sidecar is clean and an unmerged edit is not', () => {
        const ours = '# a v1\n';
        const target = write('rules/a.md', ours);
        record();

        const edit = '# a v1\nmy own note\n';
        fs.writeFileSync(target, edit);
        const staged = '# a v2\n';
        const sidecar = sidecarPathFor(target);
        fs.writeFileSync(sidecar, staged);
        record({ preserved: [target], staged: new Map([[sidecar, sha(staged)]]) });

        expect(digestsOf().get('rules/a.md')).toEqual({
            installed_sha256: sha(staged),
            packaged_sha256: sha(staged),
        });
        const env = { [inv.INVENTORY_ENV]: inventoryFile };
        const decide = (): string =>
            decideDeployWrite({
                exists: true,
                recordedSha256: recordedHashesWithLedger(path.join(tmp, 'elsewhere'), env).get(target),
                onDiskSha256: sha(fs.readFileSync(target, 'utf8')),
                force: false,
            });
        // Unmerged: still the user's edit, still preserved by the next run.
        expect(decide()).toBe('preserve');
        // Merged by hand: the file matches what we produced, the conflict clears.
        fs.writeFileSync(target, staged);
        expect(decide()).toBe('write');
        fs.writeFileSync(target, edit);
        expect(digestsOf().get('rules/a.md.agent-config.new')).toEqual({
            installed_sha256: sha(staged),
            packaged_sha256: sha(staged),
            kind: 'sidecar',
        });
        // The staged sidecar is not reaped by the run that staged it.
        expect(fs.existsSync(sidecar)).toBe(true);
    });
});

describe('a retired file — spared when edited, reaped when not', () => {
    it('keeps an edited retired file in place AND in the record, then reaps it once restored', () => {
        const ours = `---\npackage: ${TAG}\n---\n# gone\n`;
        const retired = write('rules/gone.md', ours);
        write('rules/a.md', '# a\n');
        record({ currentFiles: new Set(['rules/a.md', 'rules/gone.md']) });

        fs.writeFileSync(retired, `${ours}my own note\n`);
        const first = record();
        expect(first.retained.map((p) => fs.realpathSync(p))).toEqual([fs.realpathSync(retired)]);
        expect(fs.existsSync(retired)).toBe(true);
        expect(digestsOf().get('rules/gone.md')).toEqual({
            installed_sha256: sha(ours),
            packaged_sha256: null,
        });

        // Next run: no longer in `files`, still in the record, still spared.
        expect(record().retained).toHaveLength(1);
        expect(fs.existsSync(retired)).toBe(true);

        // Restored to our bytes → retired-unmodified → ours to remove.
        fs.writeFileSync(retired, ours);
        const last = record();
        expect(last.retained).toEqual([]);
        expect(fs.existsSync(retired)).toBe(false);
    });

    it('a tagged orphan with no recorded digest is still reaped — nothing to compare', () => {
        const orphan = write('rules/legacy.md', `---\npackage: ${TAG}\n---\n# legacy\nedited\n`);
        write('rules/a.md', '# a\n');
        const out = record();
        expect(out.reaped.map((p) => fs.realpathSync(path.dirname(p)))).toEqual([
            fs.realpathSync(path.dirname(orphan)),
        ]);
        expect(fs.existsSync(orphan)).toBe(false);
    });
});

describe('step 2.4 / AC-5 — a genuinely unrecorded pre-existing file is still written', () => {
    it('no ledger record and no manifest record: write, not preserve', () => {
        const target = write('rules/foreign.md', 'someone else\n');
        const recorded = recordedHashesWithLedger(path.join(tmp, 'no-project-here'), {
            [inv.INVENTORY_ENV]: inventoryFile,
        });
        expect(
            decideDeployWrite({
                exists: true,
                recordedSha256: recorded.get(target),
                onDiskSha256: sha('someone else\n'),
                force: false,
            }),
        ).toBe('write');
    });
});
