// The single-delivery partition predicate — ADR-236, roadmap Phase 2 step 2.0.
//
// The partition withholds artefacts from the project layer on the strength of a
// verified host layer. Because it is a REMOVAL, the build loses its own repair
// path: it can no longer heal a stale global layer by regenerating, since it
// stops writing the affected files. Every property below therefore pins the
// FAIL-SAFE direction — an uncertainty must resolve to `standalone/full`, never
// to a partition and never to a refusal.
//
// The refusal half matters as much as the partition half:
// `.github/workflows/consistency.yml:169` runs `task generate-tools` on a fresh
// checkout whose host layers are absent by that workflow's own comment. A
// predicate that failed there would break the pipeline, which is what eliminated
// the refuse-option in the 2026-08-19 council round.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fingerprintLayers, hostLayerInputs } from '../../src/install/hostLayerFingerprint.js';
import {
    isExclusivelyPackageOnly,
    partitionVerdict,
    personaPartition,
    personaWithheldFor,
    MAINTAINER_WORKSPACE,
} from '../../src/install/partitionEligibility.js';
import { read_lockfile, write_lockfile } from '../../src/scripts/_lib/installed_lock.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-partition-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function layer(name: string, files: Record<string, string>): { label: string; root: string } {
    const root = path.join(tmp, name);
    for (const [rel, body] of Object.entries(files)) {
        const target = path.join(root, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, body, 'utf-8');
    }
    return { label: name, root };
}

describe('fingerprintLayers', () => {
    it('is stable across two reads of the same tree', () => {
        const l = layer('rules', { 'a.md': 'alpha', 'nested/b.md': 'beta' });
        expect(fingerprintLayers([l])).toBe(fingerprintLayers([l]));
    });

    it('changes on an edit, an addition, a deletion, and a rename', () => {
        const l = layer('rules', { 'a.md': 'alpha', 'b.md': 'beta' });
        const base = fingerprintLayers([l]);

        fs.writeFileSync(path.join(l.root, 'a.md'), 'alpha!', 'utf-8');
        const edited = fingerprintLayers([l]);
        expect(edited).not.toBe(base);

        fs.writeFileSync(path.join(l.root, 'c.md'), 'gamma', 'utf-8');
        const added = fingerprintLayers([l]);
        expect(added).not.toBe(edited);

        fs.unlinkSync(path.join(l.root, 'c.md'));
        expect(fingerprintLayers([l])).toBe(edited);

        fs.renameSync(path.join(l.root, 'b.md'), path.join(l.root, 'b2.md'));
        expect(fingerprintLayers([l])).not.toBe(edited);
    });

    it('treats an absent root as zero files rather than an error', () => {
        const absent = { label: 'skills', root: path.join(tmp, 'does-not-exist') };
        expect(() => fingerprintLayers([absent])).not.toThrow();
        // And an absent layer is distinguishable from a present empty-named one.
        const present = layer('skills', { 'x.md': '' });
        expect(fingerprintLayers([absent])).not.toBe(fingerprintLayers([present]));
    });

    it('does not confuse two layers whose contents are swapped', () => {
        const a = layer('rules', { 'x.md': 'one' });
        const b = layer('skills', { 'x.md': 'two' });
        const forward = fingerprintLayers([a, b]);
        const swapped = fingerprintLayers([b, a]);
        expect(forward).not.toBe(swapped);
    });
});

describe('hostLayerInputs — the layer list the whole partition rests on', () => {
    // A sabotage probe caught this gap: deleting `commands` from the list left
    // every other test green. The list is the ONE place that decides what must be
    // verified before an artefact is withheld, and the project layer writes skills
    // AND commands into one directory while the host keeps them apart — so a
    // missing entry means withholding something nobody checked, which is the exact
    // under-governance the partition exists to remove.
    it('covers rules, skills AND commands, under the host directory', () => {
        const layers = hostLayerInputs('/home/probe');
        expect(layers.map((l) => l.label)).toEqual(['rules', 'skills', 'commands']);
        for (const l of layers) {
            expect(l.root).toBe(path.join('/home/probe', '.claude', l.label));
        }
    });

    it('the order is fixed, because the digest folds layers in sequence', () => {
        // Two runs on the same machine must produce the same digest; a reordered
        // list would silently invalidate every recorded fingerprint.
        expect(hostLayerInputs('/x').map((l) => l.label)).toEqual(
            hostLayerInputs('/x').map((l) => l.label),
        );
        expect(hostLayerInputs('/x')).toHaveLength(3);
    });
});

describe('partitionVerdict — every uncertainty falls back to the full projection', () => {
    const fp = 'a'.repeat(64);
    const never = (): string => {
        throw new Error('expectedFingerprint must not be reached on a disqualified path');
    };

    it('no host layer → standalone/full, and the fingerprint is never computed', () => {
        const v = partitionVerdict({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: false,
            expectedFingerprint: never,
        });
        expect(v.mode).toBe('standalone/full');
        expect(v.reason).toContain('no host-global layer');
    });

    it('host layer but no install record → standalone/full', () => {
        const v = partitionVerdict({
            projectVersion: '14.6.0',
            lockfile: null,
            hostLayerPresent: true,
            expectedFingerprint: never,
        });
        expect(v.mode).toBe('standalone/full');
    });

    it('version mismatch → standalone/full, in BOTH directions', () => {
        for (const recorded of ['14.5.0', '14.7.0']) {
            const v = partitionVerdict({
                projectVersion: '14.6.0',
                lockfile: { agent_config_version: recorded, host_layer_fingerprint: fp },
                hostLayerPresent: true,
                expectedFingerprint: never,
            });
            expect(v.mode).toBe('standalone/full');
            expect(v.reason).toContain(recorded);
        }
    });

    it('a legacy record with no fingerprint → standalone/full, and says how to fix it', () => {
        const v = partitionVerdict({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0' },
            hostLayerPresent: true,
            expectedFingerprint: never,
        });
        expect(v.mode).toBe('standalone/full');
        expect(v.reason).toContain('agent-config install');
    });

    it('content drift → standalone/full', () => {
        const v = partitionVerdict({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: true,
            expectedFingerprint: () => 'b'.repeat(64),
        });
        expect(v.mode).toBe('standalone/full');
        expect(v.reason).toContain('differs');
    });

    it('a throwing fingerprint → standalone/full, never an exception', () => {
        const v = partitionVerdict({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: true,
            expectedFingerprint: () => {
                throw new Error('boom');
            },
        });
        expect(v.mode).toBe('standalone/full');
    });

    it('version equal AND content equal → dual-layer/partitioned', () => {
        const v = partitionVerdict({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: true,
            expectedFingerprint: () => fp,
        });
        expect(v.mode).toBe('dual-layer/partitioned');
    });
});

describe('isExclusivelyPackageOnly', () => {
    function rule(body: string): string {
        const p = path.join(tmp, `r-${createHash('sha1').update(body).digest('hex').slice(0, 8)}.md`);
        fs.writeFileSync(p, body, 'utf-8');
        return p;
    }

    it('is true only when every workspace entry is the maintainer workspace', () => {
        expect(isExclusivelyPackageOnly(rule(`---\nworkspaces: [${MAINTAINER_WORKSPACE}]\n---\nx`))).toBe(true);
        expect(
            isExclusivelyPackageOnly(rule(`---\nworkspaces: [${MAINTAINER_WORKSPACE}, engineering]\n---\nx`)),
        ).toBe(false);
        expect(isExclusivelyPackageOnly(rule('---\nworkspaces: [engineering]\n---\nx'))).toBe(false);
    });

    it('is false for an untagged, an empty-list, and an unreadable artefact', () => {
        expect(isExclusivelyPackageOnly(rule('---\ntype: "auto"\n---\nx'))).toBe(false);
        expect(isExclusivelyPackageOnly(rule('---\nworkspaces: []\n---\nx'))).toBe(false);
        expect(isExclusivelyPackageOnly(path.join(tmp, 'absent.md'))).toBe(false);
    });

    it('holds a kernel rule out of the project layer even when it is maintainer-tagged nowhere', () => {
        // `rule_in_scope` ships a kernel rule regardless of tags; this predicate
        // is the other axis and must not inherit that. A kernel rule with no
        // maintainer tag is delivered globally under the partition.
        expect(isExclusivelyPackageOnly(rule('---\ntype: "always"\n---\nx'))).toBe(false);
    });
});

describe('installed.lock carries the fingerprint across a round trip', () => {
    it('writes, reads back, and omits the line entirely when no fingerprint is given', () => {
        const target = path.join(tmp, 'installed.lock');
        write_lockfile('14.6.0', ['claude-code'], {
            path: target,
            host_layer_fingerprint: 'c'.repeat(64),
        });
        expect(read_lockfile(target)?.host_layer_fingerprint).toBe('c'.repeat(64));

        write_lockfile('14.6.0', ['claude-code'], { path: target });
        expect(fs.readFileSync(target, 'utf-8')).not.toContain('host_layer_fingerprint');
        expect(read_lockfile(target)?.host_layer_fingerprint).toBeUndefined();
    });

    it('still parses the tools block that follows the fingerprint line', () => {
        const target = path.join(tmp, 'installed.lock');
        write_lockfile('14.6.0', ['cursor', 'claude-code'], {
            path: target,
            host_layer_fingerprint: 'd'.repeat(64),
        });
        const back = read_lockfile(target);
        expect(back?.tools).toEqual(['claude-code', 'cursor']);
        expect(back?.host_layer_fingerprint).toBe('d'.repeat(64));
    });

    it('rejects a malformed fingerprint rather than accepting a placeholder', () => {
        const target = path.join(tmp, 'installed.lock');
        fs.writeFileSync(
            target,
            'schema_version: 1\nagent_config_version: "14.6.0"\nhost_layer_fingerprint: "not-a-digest"\ntools:\n  - claude-code\n',
            'utf-8',
        );
        const back = read_lockfile(target);
        expect(back?.host_layer_fingerprint).toBeUndefined();
        expect(back?.agent_config_version).toBe('14.6.0');
    });
});

describe('personaWithheldFor — the family the partition never reached until 2026-08-21', () => {
    // `.claude/personas` was written unconditionally while `~/.claude/personas` was
    // installed from `_CLAUDE_SKILL_BUNDLE`: 29 shared names on a freshly
    // regenerated tree, measured by neither delivery surface because `personas` was
    // in neither's TYPES.
    it('withholds a Claude tool directory when the partition is active', () => {
        expect(personaWithheldFor('.claude/personas', true)).toBe(true);
    });

    it('withholds NOTHING when the partition is inactive', () => {
        // The fail-safe direction: no verified host layer means the project layer
        // is the only one, so withholding would deliver the persona nowhere.
        expect(personaWithheldFor('.claude/personas', false)).toBe(false);
        expect(personaWithheldFor('.cursor/personas', false)).toBe(false);
    });

    it('never withholds a non-Claude tool directory, even when active', () => {
        // `partitionActive` verifies the CLAUDE host layer against installed.lock.
        // It says nothing about ~/.cursor, so withholding a cursor persona on the
        // strength of a claude fingerprint is the one outcome that loses an
        // artefact outright.
        expect(personaWithheldFor('.cursor/personas', true)).toBe(false);
        expect(personaWithheldFor('.windsurf/personas', true)).toBe(false);
    });

    it('exposes the full list unchanged, so the caller can still report the count', () => {
        expect(personaPartition(process.cwd(), ['a.md', 'b.md']).all).toEqual(['a.md', 'b.md']);
    });

    it('a withheld directory yields an EMPTY ARRAY, which is what reconciles a stale tree', () => {
        // Reconciliation is the empty list, not a second code path: the caller's
        // stale-symlink sweep removes any link absent from the list it was given.
        // A helper returning `null` or the full list for a withheld directory would
        // stop new duplication and leave the existing 29 symlinks standing.
        const listFor = (active: boolean): readonly string[] =>
            personaWithheldFor('.claude/personas', active) ? [] : ['a.md'];
        expect(listFor(true)).toEqual([]);
        expect(listFor(false)).toEqual(['a.md']);
    });
});
