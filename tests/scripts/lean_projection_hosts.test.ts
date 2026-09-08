// Unit tests for the `lean_projection.hosts` axis
// (`src/scripts/_lib/lean_projection_mode.ts` + `_lib/hook_settings.ts` —
// road-to-delivery-for-every-host step 1.1).
//
// The three cases the step's own `verify:` names are asserted first and named
// after it, so a reader can check the step against the tests rather than against
// a claim. The rest cover the property that makes D1 repairable at all: the
// resolved set NEVER widens implicitly.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { leanProjectionHostsRaw, leanProjectionModeRaw } from '../../src/scripts/_lib/hook_settings.js';
import {
    DEFAULT_LEAN_PROJECTION_HOSTS,
    THINNABLE_HOSTS,
    describeDroppedHosts,
    normalizeLeanProjectionMode,
    resolveLeanProjectionHosts,
    thinsHost,
} from '../../src/scripts/_lib/lean_projection_mode.js';

const temps: string[] = [];

function repoWith(settings: string | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lph-'));
    temps.push(dir);
    if (settings !== null) fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settings, 'utf-8');
    return dir;
}

afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});

describe('1.1 verify limb 1 — absent resolves to [claude-code]', () => {
    it('no settings file at all', () => {
        const res = resolveLeanProjectionHosts(leanProjectionHostsRaw(repoWith(null)));
        expect(res.hosts).toEqual([...DEFAULT_LEAN_PROJECTION_HOSTS]);
        expect(res.usedDefault).toBe(true);
    });

    it('a settings file with the section but no hosts key', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n');
        expect(leanProjectionHostsRaw(root)).toEqual([]);
        expect(resolveLeanProjectionHosts(leanProjectionHostsRaw(root)).hosts).toEqual(['claude-code']);
    });
});

describe("1.1 verify limb 2 — a typo'd id is dropped and reported", () => {
    it('drops an unknown id and says so', () => {
        const res = resolveLeanProjectionHosts(['claude-code', 'claud-code']);
        expect(res.hosts).toEqual(['claude-code']);
        expect(res.dropped).toEqual([{ id: 'claud-code', reason: 'unknown' }]);
        expect(describeDroppedHosts(res)[0]).toContain('not a thinnable host id');
    });

    it('distinguishes a real host with no per-rule tree from a typo', () => {
        // The operator's next action differs: fix the spelling, or learn the
        // host cannot be thinned. One wording for both would hide that.
        const res = resolveLeanProjectionHosts(['windsurf', 'nonsense']);
        expect(res.hosts).toEqual([]);
        expect(res.dropped).toEqual([
            { id: 'windsurf', reason: 'not-thinnable' },
            { id: 'nonsense', reason: 'unknown' },
        ]);
        expect(describeDroppedHosts(res)[0]).toContain('no per-rule rule tree');
    });

    it('a fully invalid list resolves to NO host, never back to the default', () => {
        // Falling back here would turn a typo into a Claude Code flip nobody
        // asked for — the opposite of the safe direction.
        const res = resolveLeanProjectionHosts(['clod-code']);
        expect(res.hosts).toEqual([]);
        expect(res.usedDefault).toBe(false);
    });
});

describe('1.1 verify limb 3 — mode unset means eager-all whatever hosts says', () => {
    it('thinsHost is false for every host when the mode is absent', () => {
        const root = repoWith('lean_projection:\n  hosts: [claude-code, cursor, cline]\n');
        const mode = normalizeLeanProjectionMode(leanProjectionModeRaw(root));
        const hosts = resolveLeanProjectionHosts(leanProjectionHostsRaw(root)).hosts;
        expect(mode).toBe('eager-all');
        expect(hosts).toEqual(['claude-code', 'cline', 'cursor']);
        for (const h of THINNABLE_HOSTS) expect(thinsHost(mode, hosts, h)).toBe(false);
    });

    it('an unspellable mode is eager-all, not a thinning mode', () => {
        const root = repoWith('lean_projection:\n  mode: delivry\n  hosts: [claude-code]\n');
        const mode = normalizeLeanProjectionMode(leanProjectionModeRaw(root));
        expect(mode).toBe('eager-all');
        expect(thinsHost(mode, ['claude-code'], 'claude-code')).toBe(false);
    });
});

describe('thinsHost under a live delivery mode', () => {
    it('thins exactly the listed hosts and no others', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n  hosts: [claude-code]\n');
        const mode = normalizeLeanProjectionMode(leanProjectionModeRaw(root));
        const hosts = resolveLeanProjectionHosts(leanProjectionHostsRaw(root)).hosts;
        expect(mode).toBe('delivery');
        expect(thinsHost(mode, hosts, 'claude-code')).toBe(true);
        expect(thinsHost(mode, hosts, 'cursor')).toBe(false);
        expect(thinsHost(mode, hosts, 'cline')).toBe(false);
    });

    it('thin mode thins too — delivery is a superset, not a different switch', () => {
        expect(thinsHost('thin', ['claude-code'], 'claude-code')).toBe(true);
    });
});

describe('leanProjectionHostsRaw reads both YAML list shapes', () => {
    it('inline', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n  hosts: [claude-code, cursor]\n');
        expect(leanProjectionHostsRaw(root)).toEqual(['claude-code', 'cursor']);
    });

    it('block sequence', () => {
        const root = repoWith('lean_projection:\n  hosts:\n    - claude-code\n    - cline\n  mode: delivery\n');
        expect(leanProjectionHostsRaw(root)).toEqual(['claude-code', 'cline']);
    });

    it('a hosts key in a DIFFERENT top-level section is not read', () => {
        // The section guard is the whole reason this reader is indentation-shaped
        // rather than a grep; a grep would pick this up.
        const root = repoWith('other_section:\n  hosts: [cursor]\nlean_projection:\n  mode: delivery\n');
        expect(leanProjectionHostsRaw(root)).toEqual([]);
    });

    it('a block list ends at the next key at the same level', () => {
        const root = repoWith('lean_projection:\n  hosts:\n    - claude-code\n  mode: delivery\n');
        expect(leanProjectionHostsRaw(root)).toEqual(['claude-code']);
    });

    // A block sequence written at the KEY's own indent is legal YAML and is what
    // `js-yaml` loads identically to the deeper-indented form. The reader
    // required `indent > blockIndent`, so this shape parsed as `[]` — which
    // `resolveLeanProjectionHosts` then reads as "nothing was written" and
    // answers with the default `[claude-code]`, while `condense`'s real YAML
    // parse of the same file thins `cursor`. Projector and gates then disagree
    // about which host was thinned (R2 finding 2).
    it('block sequence at the key\'s own indent — the same-indent shape', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n  hosts:\n  - cursor\n  - cline\n');
        expect(leanProjectionHostsRaw(root)).toEqual(['cursor', 'cline']);
    });

    it('a same-indent block list ends at the next key at that level', () => {
        const root = repoWith('lean_projection:\n  hosts:\n  - cursor\n  mode: delivery\n');
        expect(leanProjectionHostsRaw(root)).toEqual(['cursor']);
        expect(leanProjectionModeRaw(root)).toBe('delivery');
    });

    it('a same-indent list does not fall back to the default host', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n  hosts:\n  - cursor\n');
        const res = resolveLeanProjectionHosts(leanProjectionHostsRaw(root));
        expect(res.hosts).toEqual(['cursor']);
        expect(res.usedDefault).toBe(false);
    });

    it('a sequence item SHALLOWER than the hosts key ends the block', () => {
        // Guard on the widening: `>=` must not become `>=0`. An item outdented
        // past the key belongs to a different mapping level, never to `hosts`.
        const root = repoWith('lean_projection:\n  mode: delivery\n    hosts:\n  - cursor\n');
        expect(leanProjectionHostsRaw(root)).toEqual([]);
    });

    it('quotes and stray whitespace are stripped', () => {
        const root = repoWith('lean_projection:\n  hosts: [ "claude-code" , \'cursor\' ]\n');
        expect(leanProjectionHostsRaw(root)).toEqual(['claude-code', 'cursor']);
    });
});
