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
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

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
        const base = readReleasedSurface();
        const computed = classifySettingsDelta(base, emitReleasedSurface(base.version));
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

    it('the leg calls the comparison and fails on a disagreement', () => {
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/consumer_matrix.ts'), 'utf8');
        expect(src).toContain('assertUpgradeDelta(upHome, published)');
        expect(src).toContain('compareInstallerDelta(installer, computed)');
        expect(src).toContain('settings delta disagrees after');
        // The path the installer actually writes, not a guess at it.
        const installer = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/install.ts'), 'utf8');
        expect(installer).toContain("path.join('state', 'settings-delta.json')");
        expect(src).toContain("'state', 'settings-delta.json'");
    });

    it('a pair the committed file is not about is skipped, not failed', () => {
        // During a release window the registry's latest can differ from the
        // version the committed surface was cut at. That is a different pair,
        // and a different pair is not a disagreement about this one.
        const src = fs.readFileSync(path.join(REPO_ROOT, 'src/scripts/consumer_matrix.ts'), 'utf8');
        expect(src).toContain('released.version !== installer.oldVersion');
        expect(src).toContain('settings delta skipped');
    });

    it('the released surface this leg reads is the one the cut writes', () => {
        const base: ReleasedSurface = readReleasedSurface();
        expect(base.version).toMatch(/^\d+\.\d+\.\d+$/);
        expect(Object.keys(base.entries).length).toBeGreaterThan(50);
    });
});
