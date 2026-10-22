// Unit tests for the delivery-host axis
// (`src/scripts/_lib/lean_projection_mode.ts` — road-to-delivery-for-every-host
// step 1.1). Since ADR-293 no settings key feeds it: the indentation readers of
// `lean_projection.*` were removed with their last gate caller (finding
// 3b0993429472), and the shape cases below now assert that a leftover value in
// any YAML shape reaches no gate.
//
// The three cases the step's own `verify:` names are asserted first and named
// after it, so a reader can check the step against the tests rather than against
// a claim. The rest cover the property that makes D1 repairable at all: the
// resolved set NEVER widens implicitly.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { _lean_projection_settings_for as gateDeliveryHosts } from '../../src/scripts/check_rule_projection_integrity.js';
import {
    DEFAULT_LEAN_PROJECTION_HOSTS,
    THINNABLE_HOSTS,
    describeDroppedHosts,
    normalizeLeanProjectionMode,
    resolveLeanProjectionHosts,
    thinsHost,
} from '../../src/scripts/_lib/lean_projection_mode.js';

const temps: string[] = [];

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FORM_REL = path.join('src', 'config', 'project-tree-form.json');

/** A temp root with an optional leftover settings file and, by default, the shipped form record. */
function repoWith(settings: string | null, record = true): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lph-'));
    temps.push(dir);
    if (settings !== null) fs.writeFileSync(path.join(dir, '.agent-settings.yml'), settings, 'utf-8');
    if (record) {
        fs.mkdirSync(path.join(dir, 'src', 'config'), { recursive: true });
        fs.copyFileSync(path.join(REPO_ROOT, FORM_REL), path.join(dir, FORM_REL));
    }
    return dir;
}

afterEach(() => {
    while (temps.length > 0) fs.rmSync(temps.pop() as string, { recursive: true, force: true });
});

describe('1.1 verify limb 1 — absent resolves to [claude-code]', () => {
    it('nothing configured at all', () => {
        const res = resolveLeanProjectionHosts(undefined);
        expect(res.hosts).toEqual([...DEFAULT_LEAN_PROJECTION_HOSTS]);
        expect(res.usedDefault).toBe(true);
    });

    it('an empty list resolves to the default, and a leftover settings section moves no gate', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n', false);
        expect(gateDeliveryHosts(root).hosts).toEqual([]);
        expect(resolveLeanProjectionHosts([]).hosts).toEqual(['claude-code']);
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
        const mode = normalizeLeanProjectionMode(undefined);
        const hosts = resolveLeanProjectionHosts(['claude-code', 'cursor', 'cline']).hosts;
        expect(mode).toBe('eager-all');
        expect(hosts).toEqual(['claude-code', 'cline', 'cursor']);
        for (const h of THINNABLE_HOSTS) expect(thinsHost(mode, hosts, h)).toBe(false);
    });

    it('an unspellable mode is eager-all, not a thinning mode', () => {
        const mode = normalizeLeanProjectionMode('delivry');
        expect(mode).toBe('eager-all');
        expect(thinsHost(mode, ['claude-code'], 'claude-code')).toBe(false);
    });
});

describe('thinsHost under a live delivery mode', () => {
    it('thins exactly the listed hosts and no others', () => {
        const mode = normalizeLeanProjectionMode('delivery');
        const hosts = resolveLeanProjectionHosts(['claude-code']).hosts;
        expect(mode).toBe('delivery');
        expect(thinsHost(mode, hosts, 'claude-code')).toBe(true);
        expect(thinsHost(mode, hosts, 'cursor')).toBe(false);
        expect(thinsHost(mode, hosts, 'cline')).toBe(false);
    });

    it('thin mode thins too — delivery is a superset, not a different switch', () => {
        expect(thinsHost('thin', ['claude-code'], 'claude-code')).toBe(true);
    });
});

// Every YAML shape a human could write a leftover `hosts:` list in. Each one
// used to be READ (and the same-indent shape was misread until R2 finding 2);
// since ADR-293 none of them may reach the gate, whose delivery set is the
// shipped record's `['claude-code']` whatever the settings file says.
describe('no YAML shape of a leftover hosts list reaches the gate (ADR-293)', () => {
    it('inline', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n  hosts: [claude-code, cursor]\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
    });

    it('block sequence', () => {
        const root = repoWith('lean_projection:\n  hosts:\n    - claude-code\n    - cline\n  mode: delivery\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
    });

    it('a hosts key in a DIFFERENT top-level section', () => {
        const root = repoWith('other_section:\n  hosts: [cursor]\nlean_projection:\n  mode: delivery\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
    });

    it('a block list followed by another key', () => {
        const root = repoWith('lean_projection:\n  hosts:\n    - claude-code\n  mode: eager-all\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
    });

    it("block sequence at the key's own indent — the same-indent shape", () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n  hosts:\n  - cursor\n  - cline\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
    });

    it('a same-indent block list followed by an eager-all mode', () => {
        const root = repoWith('lean_projection:\n  hosts:\n  - cursor\n  mode: eager-all\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
        expect(gateDeliveryHosts(repoWith('lean_projection:\n  mode: delivery\n', false)).hosts).toEqual([]);
    });

    it('a same-indent list does not enrol cursor', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n  hosts:\n  - cursor\n');
        const res = gateDeliveryHosts(root);
        expect(res.hosts).toEqual(['claude-code']);
        expect(res.hosts).not.toContain('cursor');
    });

    it('a sequence item SHALLOWER than the hosts key', () => {
        const root = repoWith('lean_projection:\n  mode: delivery\n    hosts:\n  - cursor\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
    });

    it('quoted ids with stray whitespace', () => {
        const root = repoWith('lean_projection:\n  hosts: [ "claude-code" , \'cursor\' ]\n');
        expect(gateDeliveryHosts(root).hosts).toEqual(['claude-code']);
    });
});
