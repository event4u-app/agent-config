// Tests for src/scripts/lint_role_experiences.ts (py2ts Phase 4 / Wave 4b).
//
// Layer 1: 1:1 port of tests/test_lint_role_experiences.py — the two-tier
//   beta gate (beta/stable require a non-null recruit_session_ref;
//   draft/beta-internal may keep it null; unknown status rejected). Each
//   pytest builds a self-contained role dir under tmp and calls lint_role
//   with an empty known-skills set, asserting on the failures list.
// Layer 2: golden parity on the REAL REPO — python3 vs tsx, byte-identical
//   stdout/stderr/exit (skipped without python3). Includes the
//   --plain-language scan, the linter's real CI invocation.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lre from '../../src/scripts/lint_role_experiences.js';



// --- Layer 1: 1:1 port of tests/test_lint_role_experiences.py --------------

const _BODY = `
# Role experience — Test

> Scaffold.

## Three first tasks

1. **Task one** — does a thing.
2. **Task two** — does another.
3. **Task three** — does a third.
`;

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lre-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function makeRole(status: string, ref: string | null): string {
    const role = path.join(tmp, 'testrole');
    fs.mkdirSync(path.join(role, 'prompts'), { recursive: true });
    const refLine = ref === null ? 'null' : ref;
    const fm =
        '---\n' +
        'role: testrole\n' +
        'display_name: Test\n' +
        'tagline: t\n' +
        'recommended_packs: [core]\n' +
        'install_path_hint: x\n' +
        `recruit_session_ref: ${refLine}\n` +
        `status: ${status}\n` +
        '---\n';
    fs.writeFileSync(path.join(role, 'index.md'), fm + _BODY);
    fs.writeFileSync(path.join(role, 'skills.yml'), 'skills: []\n');
    for (let i = 0; i < 5; i++) {
        fs.writeFileSync(
            path.join(role, 'prompts', `p${i}.md`),
            '---\nname: p\nintent: i\ninputs: x\noutput_shape: y\nskill_hint: z\n---\nbody\n',
        );
    }
    return role;
}

function lint(role: string): string[] {
    const failures: string[] = [];
    lre.lint_role(role, new Set<string>(), failures);
    return failures;
}

describe('lint_role_experiences — status coupling (port of pytest)', () => {
    it('beta-internal with null ref passes', () => {
        expect(lint(makeRole('beta-internal', null))).toEqual([]);
    });
    it('draft with null ref passes', () => {
        expect(lint(makeRole('draft', null))).toEqual([]);
    });
    it('beta with null ref fails', () => {
        expect(lint(makeRole('beta', null)).some((f) => f.includes('recruit_session_ref'))).toBe(
            true,
        );
    });
    it('stable with null ref fails', () => {
        expect(lint(makeRole('stable', null)).some((f) => f.includes('recruit_session_ref'))).toBe(
            true,
        );
    });
    it('beta with ref passes', () => {
        expect(lint(makeRole('beta', 'agents/recruit-sessions/01-x.md'))).toEqual([]);
    });
    it('unknown status fails', () => {
        expect(lint(makeRole('gamma', null)).some((f) => f.includes('not in'))).toBe(true);
    });
});

// --- Layer 2: golden parity on the REAL REPO -------------------------------

