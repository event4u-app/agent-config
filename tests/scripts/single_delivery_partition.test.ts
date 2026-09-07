// The single-delivery partition — ADR-236 and its 2026-09-07 amendment.
//
// The partition withholds an artefact from the project layer when the host-global
// layer demonstrably carries it. Because it is a REMOVAL, the build loses its own
// repair path: it can no longer heal a stale global layer by regenerating, since
// it stops writing the affected files. So the fail-safe direction is still pinned
// here — but PER ARTEFACT, which is the amendment. An unreadable layer withholds
// nothing; a layer missing one name withholds every other name and keeps that one.
//
// What these properties no longer pin, deliberately: `verifyHostLayer` used to
// DECIDE the withhold by comparing `installed.lock`'s version and fingerprint
// against the checkout, and any mismatch fell back to writing the full projection.
// Measured 2026-09-07, that veto delivered 261 skills and 29 personas twice per
// session for as long as an install lagged a release. It is now a DIAGNOSTIC: it
// reports whether the layer being withheld against is the one this checkout's
// installer stamped, and a `false` produces a warning, not a duplicate.
//
// `.github/workflows/consistency.yml:169` runs `task generate-tools` on a fresh
// checkout whose host layers are absent by that workflow's own comment. Under the
// per-name rule that checkout withholds nothing at all — the layer is unreadable
// — so the pipeline property the 2026-08-19 council round protected still holds,
// by a narrower route than a repo-wide veto.
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fingerprintLayers, hostLayerInputs } from '../../src/install/hostLayerFingerprint.js';
import {
    isExclusivelyPackageOnly,
    personaListFor,
    personaPartition,
    verifyHostLayer,
    MAINTAINER_WORKSPACE,
} from '../../src/install/partitionEligibility.js';
import {
    _resetClaudeLayerMemoForTest,
    claudeLayerHolds,
    claudeLayerNames,
    keepInProjectLayer,
} from '../../src/install/claudeLayerCarriage.js';
import { read_lockfile, write_lockfile } from '../../src/scripts/_lib/installed_lock.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-partition-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    _resetClaudeLayerMemoForTest();
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

describe('verifyHostLayer — the diagnostic, and every uncertainty reads as unverified', () => {
    const fp = 'a'.repeat(64);
    const never = (): string => {
        throw new Error('expectedFingerprint must not be reached on a disqualified path');
    };

    it('no host layer → unverified, and the fingerprint is never computed', () => {
        const v = verifyHostLayer({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: false,
            expectedFingerprint: never,
        });
        expect(v.verified).toBe(false);
        expect(v.reason).toContain('no host-global layer');
    });

    it('host layer but no install record → unverified', () => {
        const v = verifyHostLayer({
            projectVersion: '14.6.0',
            lockfile: null,
            hostLayerPresent: true,
            expectedFingerprint: never,
        });
        expect(v.verified).toBe(false);
    });

    it('version mismatch → unverified, in BOTH directions', () => {
        for (const recorded of ['14.5.0', '14.7.0']) {
            const v = verifyHostLayer({
                projectVersion: '14.6.0',
                lockfile: { agent_config_version: recorded, host_layer_fingerprint: fp },
                hostLayerPresent: true,
                expectedFingerprint: never,
            });
            expect(v.verified).toBe(false);
            expect(v.reason).toContain(recorded);
        }
    });

    it('a legacy record with no fingerprint → unverified, and says how to fix it', () => {
        const v = verifyHostLayer({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0' },
            hostLayerPresent: true,
            expectedFingerprint: never,
        });
        expect(v.verified).toBe(false);
        expect(v.reason).toContain('agent-config install');
    });

    it('content drift → unverified', () => {
        const v = verifyHostLayer({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: true,
            expectedFingerprint: () => 'b'.repeat(64),
        });
        expect(v.verified).toBe(false);
        expect(v.reason).toContain('differs');
    });

    it('a throwing fingerprint → unverified, never an exception', () => {
        const v = verifyHostLayer({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: true,
            expectedFingerprint: () => {
                throw new Error('boom');
            },
        });
        expect(v.verified).toBe(false);
    });

    it('version equal AND content equal → verified', () => {
        const v = verifyHostLayer({
            projectVersion: '14.6.0',
            lockfile: { agent_config_version: '14.6.0', host_layer_fingerprint: fp },
            hostLayerPresent: true,
            expectedFingerprint: () => fp,
        });
        expect(v.verified).toBe(true);
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

describe('personaListFor — the family the partition never reached until 2026-08-21', () => {
    // `.claude/personas` was written unconditionally while `~/.claude/personas` was
    // installed from `_CLAUDE_SKILL_BUNDLE`: 29 shared names on a freshly
    // regenerated tree, measured by neither delivery surface because `personas` was
    // in neither's TYPES. From 2026-08-21 it was gated on the repo-wide verdict,
    // which an install one release behind turned off — so the 29 duplicates
    // survived the fix. From 2026-09-07 the narrowed list is the evidence itself.
    it('gives a Claude tool directory the narrowed list', () => {
        expect(personaListFor('.claude/personas', ['a.md', 'b.md'], ['b.md'])).toEqual(['b.md']);
    });

    it('narrows nothing when the claude layer supplied no evidence', () => {
        // The fail-safe direction, now per name: an unreadable `~/.claude/personas`
        // makes `keepInProjectLayer` return every name, so the narrowed list IS the
        // full list and withholding cannot deliver a persona nowhere.
        const all = ['a.md', 'b.md'];
        expect(personaListFor('.claude/personas', all, all)).toEqual(all);
        expect(personaListFor('.cursor/personas', all, all)).toEqual(all);
    });

    it('never narrows a non-Claude tool directory, whatever the claude layer holds', () => {
        // The evidence is `~/.claude/personas`. It says nothing about ~/.cursor, so
        // narrowing a cursor persona on the strength of a claude directory listing
        // is the one outcome that loses an artefact outright.
        const all = ['a.md', 'b.md'];
        for (const dir of ['.cursor/personas', '.windsurf/personas', '.augment/personas']) {
            expect(personaListFor(dir, all, [])).toEqual(all);
        }
        expect(personaListFor('.claude/personas', all, [])).toEqual([]);
    });

    it('exposes the full list unchanged, so the caller can still report the count', () => {
        expect(personaPartition(['a.md', 'b.md']).all).toEqual(['a.md', 'b.md']);
    });

    it('listFor returns an EMPTY ARRAY for a withheld directory, not null', () => {
        // The shape the caller's stale-symlink sweep depends on: it removes any
        // link absent from the list it was given, so `[]` is what empties a
        // populated tree. `null` or the full list would stop new duplication and
        // leave the existing symlinks standing.
        //
        // This asserts the CONTRACT only. An earlier version of this test
        // reimplemented the production expression (`personaListFor`'s predecessor,
        // then `personaWithheldFor(...) ? [] : ['a.md']`) and called that
        // a reconciliation test — both seats of a neutral review named it: it
        // would stay green if the generator stopped applying the partition. The
        // reconciliation itself is exercised through the real generators in
        // `partition_delivery_topology.test.ts`, which reds when the gating is
        // removed.
        // A fixture HOME, not the operator's. Corrected 2026-09-07 after a neutral
        // review: this called `personaPartition` WITHOUT the `home` seam the same
        // change added, so it read the real `~/.claude/personas` — and the old
        // assertion `length === 0 || length === 2` encoded the pre-amendment
        // all-or-nothing topology. Under per-name withholding length 1 is
        // reachable (a layer holding exactly one of the two names), so the
        // assertion was both environment-dependent and a latent red.
        const carried = path.join(tmp, 'persona-home', '.claude', 'personas');
        fs.mkdirSync(carried, { recursive: true });
        fs.writeFileSync(path.join(carried, 'a.md'), 'x', 'utf-8');
        const p = personaPartition(['a.md', 'b.md'], path.join(tmp, 'persona-home'));
        // `a.md` is carried, `b.md` is not — the length-1 case the old assertion
        // could not express.
        expect(p.listFor('.claude/personas')).toEqual(['b.md']);
        expect(p.countFor('.claude/personas')).toBe(1);
        expect(p.countFor('.cursor/personas')).toBe(2);
        // `.cursor/` is never withheld, whatever the install state — this one IS
        // machine-independent and is the assertion that would catch a helper
        // withholding everywhere.
        expect(p.listFor('.cursor/personas')).toEqual(['a.md', 'b.md']);
    });
});

describe('claudeLayerCarriage — the evidence the withhold decision actually reads', () => {
    // These are the properties the repo-wide veto had no way to express. Each one
    // is a direction the old gate got wrong on a real machine: a stale lockfile
    // withheld nothing (261 duplicates), and a single absent name would have
    // withheld everything had the gate ever been on.
    function claudeHome(files: Record<string, string>): string {
        const home = path.join(tmp, `home-${String(Object.keys(files).length)}-${Math.random().toString(36).slice(2)}`);
        for (const [rel, body] of Object.entries(files)) {
            const target = path.join(home, rel);
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, body, 'utf-8');
        }
        return home;
    }

    it('an ABSENT layer is no evidence — every name is kept', () => {
        const home = claudeHome({ 'unrelated.txt': 'x' });
        expect(claudeLayerNames('skills', home)).toBeNull();
        expect(keepInProjectLayer('skills', ['a', 'b'], home)).toEqual(['a', 'b']);
        expect(claudeLayerHolds('skills', 'a', home)).toBe(false);
    });

    it('an EMPTY layer is evidence of nothing carried — also every name kept', () => {
        // The distinction the null return exists for: an empty directory is
        // readable and holds nothing, so it withholds nothing. Collapsing it to
        // "no names present ⇒ withhold all" is the inversion that loses artefacts.
        const home = claudeHome({ '.claude/skills/.keep': '' });
        expect(claudeLayerNames('skills', home)?.size).toBe(1);
        expect(keepInProjectLayer('skills', ['a', 'b'], home)).toEqual(['a', 'b']);
    });

    it('withholds PER NAME — one absent name does not rescue the others', () => {
        const home = claudeHome({
            '.claude/skills/carried/SKILL.md': 'x',
            '.claude/skills/also-carried/SKILL.md': 'x',
        });
        expect(keepInProjectLayer('skills', ['carried', 'orphan', 'also-carried'], home)).toEqual([
            'orphan',
        ]);
    });

    it('reads commands as a POSIX SUBPATH, so the colon form is comparable', () => {
        // A clustered command's host-side name is `<cluster>/<sub>.md`. Comparing
        // basenames would make `roadmap/next.md` and `worktree/next.md` the same
        // name and withhold one of them on the other's evidence.
        const home = claudeHome({
            '.claude/commands/roadmap/next.md': 'x',
            '.claude/commands/agent-status.md': 'x',
        });
        const names = claudeLayerNames('commands', home);
        expect([...(names ?? [])].sort()).toEqual(['agent-status.md', 'roadmap/next.md']);
        expect(claudeLayerHolds('commands', 'roadmap/next.md', home)).toBe(true);
        expect(claudeLayerHolds('commands', 'worktree/next.md', home)).toBe(false);
    });

    it('never treats README.md as a carried artefact', () => {
        const home = claudeHome({ '.claude/personas/README.md': 'x', '.claude/personas/a.md': 'x' });
        expect(keepInProjectLayer('personas', ['README.md', 'a.md'], home)).toEqual(['README.md']);
    });

    it('memoises per home, and the reset seam clears it', () => {
        // The memo is what keeps a per-NAME question from re-walking the commands
        // tree hundreds of times. It must not outlive a test that changes the layer.
        const home = claudeHome({ '.claude/skills/one/SKILL.md': 'x' });
        expect(keepInProjectLayer('skills', ['one', 'two'], home)).toEqual(['two']);
        fs.mkdirSync(path.join(home, '.claude/skills/two'), { recursive: true });
        expect(keepInProjectLayer('skills', ['one', 'two'], home)).toEqual(['two']);
        _resetClaudeLayerMemoForTest();
        expect(keepInProjectLayer('skills', ['one', 'two'], home)).toEqual([]);
    });
});
