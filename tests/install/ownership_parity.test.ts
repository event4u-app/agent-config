// One ownership table, three readers — road-to-an-ownership-record-that-belongs-to-the-user,
// step 2.5.
//
// The preview (`computeConflicts`), the writer (`conflictTracker`) and
// `cmd_doctor` each decide which managed files the user edited. They read the
// same records and must name the same files, or the wizard previews one
// answer, the install acts on a second and doctor reports a third. The table
// below is fed to all three, once through a project manifest and once through
// the user-scoped ledger, and the three answers are compared with each other
// AND with the edited row the table declares — agreement alone could be three
// readers sharing one bug.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as YAML from 'yaml';

import { computeConflicts } from '../../src/install/conflict.js';
import { createConflictTracker } from '../../src/install/conflictTracker.js';
import type { FileEntry, InstallPlan } from '../../src/install/types.js';
import * as doctor from '../../src/scripts/_cli/cmd_doctor.js';
import { ledgerModifiedRecords } from '../../src/scripts/_cli/doctor_ownership_ledger.js';
import * as inv from '../../src/scripts/_lib/global_deploy_inventory.js';
import * as installed_tools from '../../src/scripts/_lib/installed_tools.js';

function sha(s: string): string {
    return crypto.createHash('sha256').update(s).digest('hex');
}

interface Row {
    readonly name: string;
    readonly wrote: string;
    readonly onDisk: string;
    /** `false` — recorded with no digest (a bridge-shaped entry). */
    readonly digest: boolean;
}

const PLANNED = '# the next package version\n';

/** The table. Exactly one row is an edit the user made to a file we wrote. */
const TABLE: readonly Row[] = [
    { name: 'ours.md', wrote: '# ours\n', onDisk: '# ours\n', digest: true },
    { name: 'edited.md', wrote: '# edited\n', onDisk: '# edited\nmy own note\n', digest: true },
    { name: 'no-digest.md', wrote: '# nd\n', onDisk: '# nd\nchanged\n', digest: false },
    // THE CASE THAT MAKES THE CONTAINMENT ASSERTION ABLE TO FAIL. Its bytes
    // equal the UNTAGGED planned content, so the preview's `onDisk ===
    // entry.sha256` short-circuit would drop it, while the writer — which
    // tags before hashing — finds a difference and preserves. Without this
    // row the invariant below is satisfied by a table that never exercises
    // the gap between the two comparisons.
    { name: 'untagged-match.md', wrote: '# um\n', onDisk: PLANNED, digest: false },
];
const EDITED = TABLE.filter((r) => r.digest && r.wrote !== r.onDisk).map((r) => r.name);

let tmp: string;
let root: string;
let dir: string;
const savedEnv: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined): void {
    if (!(key in savedEnv)) savedEnv[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'own-parity-'));
    root = path.join(tmp, 'project');
    dir = path.join(root, '.claude', 'rules');
    fs.mkdirSync(dir, { recursive: true });
    for (const r of TABLE) fs.writeFileSync(path.join(dir, r.name), r.onDisk);
    setEnv('AGENT_CONFIG_INSTALLED_TOOLS', undefined);
    setEnv(inv.INVENTORY_ENV, path.join(tmp, 'deployed-files.json'));
});

afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
        delete savedEnv[k];
    }
    fs.rmSync(tmp, { recursive: true, force: true });
});

function plan(): InstallPlan {
    const entries: FileEntry[] = TABLE.map((r) => ({
        path: path.join(dir, r.name),
        kind: 'deployed',
        sha256: sha(PLANNED),
    }));
    return {
        version: 2,
        target: 'global',
        root,
        filesByTool: { 'claude-code': entries },
        mergedKeysByTool: {},
        policy: {
            force: false,
            interactive: false,
            knownPaths: new Set(),
            knownPointers: new Set(),
            defaultStrategy: 'skip',
        },
    };
}

/**
 * What the preview can say about one plan, split by how much it knows.
 *
 * `decided` is the set it can settle on its own: a recorded digest diverged.
 * `candidates` is the set whose outcome belongs to the writer — ledger-listed,
 * no recorded digest — because settling it needs a comparison against the
 * bytes the install WOULD write, tag included, and `plannedSha256` is the
 * digest of the untagged source.
 */
function previewSays(): { decided: string[]; candidates: string[] } {
    const conflicts = computeConflicts(plan());
    const names = (f: (c: (typeof conflicts)[number]) => boolean): string[] =>
        conflicts.filter(f).map((c) => path.basename(c.path)).sort();
    return {
        decided: names((c) => c.ownership === 'recorded-modified'),
        candidates: names((c) => c.migration),
    };
}

/** The install-time tag, as a byte change the writer applies and the plan does not. */
const TAG = '\n<!-- package: test -->\n';

function writerSays(): string[] {
    const tracker = createConflictTracker({
        warn: () => undefined,
        fail: (m: string): never => {
            throw new Error(m);
        },
        logWrite: () => undefined,
        emitProgress: () => undefined,
        // A REAL tag, not a no-op. Stubbing this to nothing collapsed the
        // writer's "would write" onto the raw planned bytes — exactly what the
        // preview compares against — so the two agreed by construction and the
        // one test asserting the invariant could not see them drift apart.
        tagDeployed: (target: string) => {
            fs.appendFileSync(target, TAG);
        },
    });
    tracker.begin(root);
    // A real package source on disk, because the writer is handed one. The
    // COPY shape (`{ from }`) is the one these rows model, and it is the shape
    // that tags; `{ content }` is the generated-marker path, which writes
    // verbatim and would quietly make the tag disappear from this fixture.
    const src = path.join(tmp, 'package-source.md');
    fs.writeFileSync(src, PLANNED);
    return TABLE.filter(
        (r) => tracker.resolve(path.join(dir, r.name), false, { from: src, packageRoot: null }) === 'preserve',
    )
        .map((r) => r.name)
        .sort();
}

describe('step 2.5 — preview, writer and doctor agree on one table', () => {
    it('through a PROJECT manifest', () => {
        const lines = ['schema_version: 2', 'agent_config_version: "1.0.0"', 'tools:'];
        lines.push('  - name: claude-code', '    scope: project', '    bridge_marker: false');
        lines.push('    installed_at: "2026-10-16T00:00:00Z"', '    files:');
        for (const r of TABLE) {
            lines.push(`      - path: .claude/rules/${r.name}`, '        kind: deployed');
            lines.push(`        sha256: ${r.digest ? `"${sha(r.wrote)}"` : 'null'}`);
        }
        const manifest = installed_tools.manifest_path(root);
        fs.mkdirSync(path.dirname(manifest), { recursive: true });
        fs.writeFileSync(manifest, `${lines.join('\n')}\n`);

        // The classifier is fed the manifest parsed in full. `cmd_doctor`'s own
        // production read (`installed_tools.read_manifest`) drops every nested
        // `files[]` entry, so on a real tree this classifier is never reached —
        // a separate defect, pinned below until it is fixed on its own.
        const [records] = doctor._collect_manifest_entries(
            root,
            YAML.parse(fs.readFileSync(manifest, 'utf8')) as Record<string, unknown>,
        );
        const [, modified] = doctor._classify(records);
        const doctorSays = modified.map((m) => path.basename(String(m['path']))).sort();

        const preview = previewSays();
        expect(preview.decided).toEqual(EDITED);
        expect(writerSays()).toEqual(EDITED);
        expect(doctorSays).toEqual(EDITED);
        // No ledger here at all, so nothing is a migration candidate — the
        // project-manifest route is unchanged by that branch, and asserting
        // it says so rather than leaving it to be assumed.
        expect(preview.candidates).toEqual([]);

        // Pinned as it is today: the read `cmd_doctor` actually uses
        // hands the classifier no files at all. Flip this when that is fixed.
        const asDoctorReadsIt = installed_tools.read_manifest(manifest) as { tools: Array<{ files: unknown[] }> };
        expect(asDoctorReadsIt.tools[0]?.files).toEqual([]);
    });

    it('through the USER-scoped ledger, with no project manifest at all', () => {
        const digests = new Map<string, inv.LedgerDigest>();
        for (const r of TABLE) {
            if (!r.digest) continue;
            digests.set(r.name, { installed_sha256: sha(r.wrote), packaged_sha256: sha(r.wrote) });
        }
        const data = inv.record_deploy('claude-code', dir, new Set(TABLE.map((r) => r.name)), inv.load_inventory(), digests);
        inv.save_inventory(data);

        const doctorSays = ledgerModifiedRecords()
            .map((m) => path.basename(String(m['path'])))
            .sort();

        const preview = previewSays();
        const writer = writerSays();

        // On what all three CAN decide, all three agree.
        expect(preview.decided).toEqual(EDITED);
        expect(doctorSays).toEqual(EDITED);
        expect(writer).toContain('edited.md');

        // The two paths with no recorded digest are CANDIDATES: the preview
        // names them and stops, because settling them needs the tag it cannot
        // apply. `untagged-match.md` is the one that matters — its bytes equal
        // the untagged planned content, so the preview's own equality
        // short-circuit would have dropped it, and the writer preserves it.
        const CANDIDATES = ['no-digest.md', 'untagged-match.md'];
        expect(preview.candidates).toEqual(CANDIDATES);
        expect(writer).toEqual([...EDITED, ...CANDIDATES].sort());

        // THE CONTAINMENT THAT MATTERS, and it is the honest form of the
        // invariant: everything the writer preserves was either decided or
        // flagged by the preview, so the preview never stays silent about a
        // file the install is about to keep. The reverse does not hold and is
        // not asserted — a candidate may still be written.
        for (const name of writer) {
            expect([...preview.decided, ...preview.candidates], name).toContain(name);
        }

        // Doctor is the reader that cannot follow at all, and the gap is
        // asserted rather than hidden: it is not installing, so it has no
        // packaged digest, and `recorded_digests` does not even enumerate a
        // path without one. Reporting it `modified` anyway would assert an
        // edit nobody proved. Written as the difference, so doctor LEARNING
        // to cover it reds this case and forces its docstring to be re-read.
        expect(writer.filter((n) => !doctorSays.includes(n))).toEqual(CANDIDATES);
    });
});
