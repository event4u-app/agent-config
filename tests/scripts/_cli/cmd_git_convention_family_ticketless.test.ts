/**
 * Owner decision 2026-10-07: under an approved family a subject without a
 * ticket is the family's form without the ticket part, git's own `fixup!`,
 * `squash!`, `amend!` and `Revert "…"` subjects are always valid, and a ticket,
 * when present, stands in the family's leading position — the way the
 * `ticket-conventional` setting value already treats its optional ticket.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APPROVED_CARD, runGitConvention } from '../../../src/scripts/_cli/cmd_git_convention.js';

const made: string[] = [];
const prevHome = process.env.EVENT4U_CONFIG_HOME;

beforeEach(() => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-ticketless-home-'));
    made.push(home);
    process.env.EVENT4U_CONFIG_HOME = home;
});

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
    if (prevHome === undefined) delete process.env.EVENT4U_CONFIG_HOME;
    else process.env.EVENT4U_CONFIG_HOME = prevHome;
});

function withCard(family: string): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-ticketless-')));
    made.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    fs.mkdirSync(path.dirname(path.join(dir, APPROVED_CARD)), { recursive: true });
    fs.writeFileSync(path.join(dir, APPROVED_CARD), `---\ndominant_family: ${family}\n---\n`);
    return dir;
}

const subject = (dir: string, ...lines: string[]) => runGitConvention(['subject'], dir, `${lines.join('\n')}\n`);

describe('an approved ticket-prefix card', () => {
    it('accepts subjects without a ticket and git\'s own subjects', () => {
        const r = subject(withCard('ticket-prefix'), 'chore: apply formatting', 'Add thing without ticket', 'fixup! x', 'squash! y', 'amend! z', 'Revert "Add thing"');
        expect(r.out.join('\n')).not.toContain('✗');
        expect(r.code).toBe(0);
    });

    it('still accepts the ticket in the leading position', () => {
        expect(subject(withCard('ticket-prefix'), '[DEV-1] Add thing', 'DEV-1 Add thing').code).toBe(0);
    });

    it('refuses a ticket anywhere but the leading position', () => {
        const r = subject(withCard('ticket-prefix'), 'Add thing for DEV-1');
        expect(r.code).toBe(1);
        expect(r.out.join('\n')).toContain('DEV-1');
    });
});

describe('an approved ticket-conventional card', () => {
    it('accepts the conventional form without a ticket and git\'s own subjects', () => {
        expect(subject(withCard('ticket-conventional'), 'chore: apply formatting', 'fixup! DEV-1 feat: x', 'Revert "feat: x"').code).toBe(0);
    });

    it('refuses a plain subject, which is not the family\'s form without a ticket', () => {
        expect(subject(withCard('ticket-conventional'), 'Add thing without ticket').code).toBe(1);
    });
});

describe('an approved conventional card', () => {
    it('accepts git\'s own subjects', () => {
        expect(subject(withCard('conventional'), 'fixup! feat: x', 'Revert "feat: x"').code).toBe(0);
    });
});
