/**
 * The upgrade leg's settings assertion
 * (road-to-a-release-that-reads-its-settings-delta, step 4.1).
 *
 * The archived upgrade step closed on the words "settings-sync produces the
 * expected upgrade-delta" and named `conformance` as the probe. `conformance`
 * reads no delta, so the leg installed two versions and asserted nothing about
 * the surface between them. The comparison now exists; these tests exercise
 * its branches without the network, so an agreement and a disagreement are
 * both reachable in vitest rather than only in the weekly matrix.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertUpgradeDelta } from '../../src/scripts/consumer_matrix.js';
import { computeSurfaceDelta } from '../../src/shared/settingsSurface.js';
import {
    classifySettingsDelta,
    compareInstallerDelta,
    emitReleasedSurface,
    readReleasedSurface,
    type InstallerDelta,
    type ReleasedSurface,
    type SettingsDeltaFindings,
} from '../../src/scripts/_lib/release_settings_surface.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function findings(over: Partial<SettingsDeltaFindings> = {}): SettingsDeltaFindings {
    return {
        untombstoned_removals: [],
        carried_removals: [],
        type_changed: [],
        enum_removed: [],
        added_without_default: [],
        ...over,
    };
}

function delta(changes: InstallerDelta['changes']): InstallerDelta {
    return { oldVersion: '16.5.0', newVersion: '16.6.0', changes };
}

describe('the upgrade leg reads the delta the installer wrote', () => {
    it('an identical pair produces no delta and no disagreement', () => {
        // The committed surface against ITSELF. Against the working tree the
        // pair is identical only until a branch removes a key, and then this
        // case reds every PR until the next release cuts a new surface.
        const base = readReleasedSurface();
        const computed = classifySettingsDelta(base, base);
        expect(compareInstallerDelta(delta([]), computed)).toEqual([]);
    });

    it('agreement: the same removals, type changes and lost values on both sides', () => {
        const computed = findings({
            untombstoned_removals: ['a.one'],
            carried_removals: [{ key: 'b.two', via: 'removed' }],
            type_changed: ['c.three'],
            enum_removed: [{ key: 'd.four', values: ['x', 'y'] }],
            // Not compared: neither refuses a cut and neither can invalidate an
            // installed value.
            added_without_default: ['e.five'],
        });
        const wrote = delta([
            { kind: 'removed', key: 'b.two' },
            { kind: 'removed', key: 'a.one' },
            { kind: 'type_changed', key: 'c.three' },
            { kind: 'enum_removed', key: 'd.four', values: ['y', 'x'] },
            { kind: 'added', key: 'e.five' },
            { kind: 'default_changed', key: 'f.six' },
            { kind: 'enum_added', key: 'g.seven', values: ['z'] },
        ]);
        expect(compareInstallerDelta(wrote, computed)).toEqual([]);
    });

    it('a removal the installer saw and the release does not is a disagreement', () => {
        const out = compareInstallerDelta(delta([{ kind: 'removed', key: 'a.one' }]), findings());
        expect(out).toHaveLength(1);
        expect(out[0]).toContain('removed');
        expect(out[0]).toContain('a.one');
    });

    it('a removal the release computes and the installer did not write is a disagreement', () => {
        const out = compareInstallerDelta(delta([]), findings({ untombstoned_removals: ['a.one'] }));
        expect(out).toHaveLength(1);
        expect(out[0]).toContain('a.one');
    });

    it('a carried removal still has to appear on the installer side', () => {
        // A tombstoned removal is a removal in the SHIPPED bytes too. Treating
        // the tombstone as an exemption here would let an annotated removal
        // that never reached the package pass unnoticed.
        const out = compareInstallerDelta(
            delta([]),
            findings({ carried_removals: [{ key: 'b.two', via: 'renamed', to: 'b.three' }] }),
        );
        expect(out).toHaveLength(1);
        expect(out[0]).toContain('b.two');
    });

    it('a type change on one side only is a disagreement', () => {
        const out = compareInstallerDelta(delta([{ kind: 'type_changed', key: 'c.three' }]), findings());
        expect(out.join('\n')).toContain('type_changed');
    });

    it('the same key losing DIFFERENT values is a disagreement', () => {
        const out = compareInstallerDelta(
            delta([{ kind: 'enum_removed', key: 'd.four', values: ['x'] }]),
            findings({ enum_removed: [{ key: 'd.four', values: ['x', 'y'] }] }),
        );
        expect(out.join('\n')).toContain('d.four');
        expect(out.join('\n')).toContain('y');
    });

    it('the leg is wired to the path the installer actually writes', () => {
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/consumer_matrix.ts'), 'utf8');
        expect(src).toContain('assertUpgradeDelta(upHome, published, packed)');
        // Not a guess at the path — the one `install.ts` writes.
        const installer = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/install.ts'), 'utf8');
        expect(installer).toContain("path.join('state', 'settings-delta.json')");
        expect(src).toContain("'state', 'settings-delta.json'");
    });

    it('the leg itself throws on a disagreement, and returns on agreement', () => {
        // The leg function is RUN here, against a delta file on disk — the
        // network half (two npm installs) is the weekly matrix's, but the
        // failure path is this test's and is exercised rather than read.
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-delta-'));
        const stateDir = path.join(home, '.event4u', 'agent-config', 'state');
        fs.mkdirSync(stateDir, { recursive: true });
        const deltaFile = path.join(stateDir, 'settings-delta.json');
        const base = readReleasedSurface();
        // What the release computes for this tree, written as the installer
        // would write it — so the agreeing case holds whatever the tree has
        // removed since the committed surface was cut.
        const computed = classifySettingsDelta(base, emitReleasedSurface(base.version));
        const agreeing: InstallerDelta['changes'] = [
            ...computed.untombstoned_removals.map((key) => ({ kind: 'removed' as const, key })),
            ...computed.carried_removals.map((r) => ({ kind: 'removed' as const, key: r.key })),
            ...computed.type_changed.map((key) => ({ kind: 'type_changed' as const, key })),
            ...computed.enum_removed.map((e) => ({ kind: 'enum_removed' as const, key: e.key, values: e.values })),
        ];
        const write = (d: InstallerDelta): void =>
            fs.writeFileSync(deltaFile, `${JSON.stringify(d, null, 2)}\n`, 'utf8');

        try {
            // No file at all, upgrading onto the same version — the installer writes no delta then.
            expect(assertUpgradeDelta(home, base.version, base.version)).toContain('no settings delta');

            // No file although the versions differ and the release computes a change: the
            // installer failed to write the delta, and the leg says so instead of "identical".
            const live = emitReleasedSurface('9999.0.0');
            const expectsDelta = computeSurfaceDelta(base, live).changes.length > 0;
            if (expectsDelta) {
                expect(() => assertUpgradeDelta(home, base.version, '9999.0.0')).toThrow(/no settings delta was written/);
            } else {
                expect(assertUpgradeDelta(home, base.version, '9999.0.0')).toContain('compared, surfaces identical');
            }
            // Registry latest is not the version the committed surface was cut at: no
            // comparison can run, and the output says the assertion did not run.
            expect(assertUpgradeDelta(home, '0.0.1', '9999.0.0')).toMatch(/settings delta NOT asserted/);

            // A pair the committed file is not about is skipped, not failed — and named as not asserted.
            write({ oldVersion: '0.0.1', newVersion: base.version, changes: [] });
            expect(assertUpgradeDelta(home, '0.0.1', base.version)).toContain('skipped');
            expect(assertUpgradeDelta(home, '0.0.1', base.version)).toMatch(/NOT asserted/);

            // The real pair carrying exactly what the release computes: the surfaces agree.
            write({ oldVersion: base.version, newVersion: base.version, changes: agreeing });
            expect(assertUpgradeDelta(home, base.version, base.version)).toContain('agrees');

            // A removal the release does not compute: the leg throws.
            write({
                oldVersion: base.version,
                newVersion: base.version,
                changes: [...agreeing, { kind: 'removed', key: 'quality.local_auto_run' }],
            });
            expect(() => assertUpgradeDelta(home, base.version, base.version)).toThrow(/settings delta disagrees/);
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });

    it('the released surface this leg reads is the one the cut writes', () => {
        const base: ReleasedSurface = readReleasedSurface();
        expect(base.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(Object.keys(base.entries).length).toBeGreaterThan(50);
    });
});
