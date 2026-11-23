/**
 * `closure:scan` / `closure:lint` — the consumer-reachable entries for the two
 * `/challenge-me closure` tools (issue #2988). Before them the command named
 * `./scripts-run src/scripts/...`, which a consumer install does not have.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../../../src/scripts/_cli/cmd_closure.js';
import { findCommand } from '../../../src/cli/registry.js';

let tmp: string;
let out: string;
let err: string;

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cmd-closure-')));
    out = '';
    err = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((c: string | Uint8Array) => {
        out += String(c);
        return true;
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((c: string | Uint8Array) => {
        err += String(c);
        return true;
    });
});
afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('cmd_closure', () => {
    it('scan forwards to closure_scan and reports the plan\'s open decisions', () => {
        const plan = path.join(tmp, 'road-to-x.md');
        fs.writeFileSync(plan, '# Road to x\n\n- [ ] Pick the codec: TBD\n');
        expect(main(['scan', plan, '--json'])).toBe(0);
        const parsed = JSON.parse(out) as { open: number };
        expect(parsed.open).toBeGreaterThan(0);
    });

    it('lint forwards to lint_decision_classes and reds a bad ownership class in the given file', () => {
        const plan = path.join(tmp, 'road-to-y.md');
        fs.writeFileSync(
            plan,
            [
                '## Decisions',
                '',
                '| ID | ownership | resolved by | decision | evidence | revisit if |',
                '|---|---|---|---|---|---|',
                '| D1 | high impact | owner | x | y | z |',
                '',
            ].join('\n'),
        );
        expect(main(['lint', plan])).toBe(1);
        expect(err).toMatch(/not one of the eight ownership classes/);
    });

    it('rejects an unknown verb with exit 2', () => {
        expect(main(['frobnicate'])).toBe(2);
        expect(err).toContain('unknown closure verb');
    });

    it('both verbs are registered as delegate commands', () => {
        expect(findCommand('closure:scan')?.disposition).toBe('delegate');
        expect(findCommand('closure:lint')?.disposition).toBe('delegate');
    });
});
