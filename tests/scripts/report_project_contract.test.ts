// Which of the four contract sections a consumer `AGENTS.md` carries —
// `road-to-a-project-contract-written-down` step 1.3.
//
// The reader is READ-ONLY and infers nothing. The point of the report is that
// a missing section reads as missing: a goal the agent could have guessed from
// the project description is still a goal nobody wrote, and reporting it as
// present would make the whole count a statement about the agent rather than
// about the file.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readContract, renderReport, type Contract } from '../../src/scripts/report_project_contract.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function file(body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-contract-'));
    dirs.push(dir);
    const p = path.join(dir, 'AGENTS.md');
    fs.writeFileSync(p, body);
    return p;
}

const GOAL = '## Goal\n\nEvery booking reaches the organiser within a minute.\n\n';
const NOGOS = '## No-gos\n\n- Never edit `migrations/` by hand.\n\n';
const ARCH = '## Architecture\n\nControllers thin, logic in services.\n\n';
const CONV = '## Conventions\n\nStrings live in translation files.\n\n';

describe('readContract — presence, never inference', () => {
    it('reads all four when all four are there', () => {
        const got = readContract(file(GOAL + NOGOS + ARCH + CONV));
        expect(got).toEqual<Contract>({ goal: true, noGos: true, architecture: true, conventions: true });
    });

    it('reads none from an empty file', () => {
        const got = readContract(file('# Project\n\n> A description.\n'));
        expect(got).toEqual<Contract>({ goal: false, noGos: false, architecture: false, conventions: false });
    });

    it('a goal and no no-gos is 3 of 4 ONLY when the other two are present', () => {
        // The step names this case explicitly, because the interesting failure
        // is a reader that counts to 3 on a file carrying one section.
        expect(renderReport(readContract(file(GOAL + ARCH + CONV)))).toContain('3 of 4');
        expect(renderReport(readContract(file(GOAL)))).toContain('1 of 4');
    });

    it('does NOT infer a goal from a description, a README line or a mission', () => {
        const body = [
            '# Project',
            '',
            '> Our goal is to delight every user.',
            '',
            'This project aims to make bookings reliable.',
            '',
            '## Overview',
            '',
            'The goal of this section is to orient a reader.',
            '',
        ].join('\n');
        expect(readContract(file(body)).goal).toBe(false);
    });

    it('matches the heading, not the word, and not a deeper level', () => {
        expect(readContract(file('### Goal\n\nnested.\n')).goal).toBe(false);
        expect(readContract(file('## Goals\n\nplural.\n')).goal).toBe(false);
        expect(readContract(file('## No-go\n\nsingular.\n')).noGos).toBe(false);
    });

    it('accepts the spellings the guide and the template actually use', () => {
        expect(readContract(file('## No-gos\n\n- x\n')).noGos).toBe(true);
        expect(readContract(file('## Architecture\n\nx\n')).architecture).toBe(true);
        expect(readContract(file('## Architecture style\n\nx\n')).architecture).toBe(true);
        expect(readContract(file('## Conventions\n\nx\n')).conventions).toBe(true);
        expect(readContract(file('## Coding conventions\n\nx\n')).conventions).toBe(true);
    });

    it('ignores a heading inside a fenced block', () => {
        // The guide itself ships these headings inside ```markdown fences, so a
        // reader that counted them would report 4 of 4 for the guide.
        const body = ['# Project', '', '```markdown', '## Goal', '', 'copy me', '```', ''].join('\n');
        expect(readContract(file(body)).goal).toBe(false);
    });

    it('a missing file is not four missing sections', () => {
        expect(() => readContract(path.join(os.tmpdir(), 'definitely-not-here-AGENTS.md'))).toThrow(/not found|ENOENT/i);
    });
});

describe('renderReport — says what is missing, by name', () => {
    it('names every missing section', () => {
        const out = renderReport({ goal: true, noGos: false, architecture: false, conventions: true });
        expect(out).toContain('2 of 4');
        expect(out).toContain('no-gos');
        expect(out).toContain('architecture');
        expect(out).not.toMatch(/missing:.*\bgoal\b/i);
    });

    it('says so plainly when nothing is missing', () => {
        const out = renderReport({ goal: true, noGos: true, architecture: true, conventions: true });
        expect(out).toContain('4 of 4');
    });

    it('writes nothing — the report is a string', () => {
        expect(typeof renderReport({ goal: false, noGos: false, architecture: false, conventions: false })).toBe(
            'string',
        );
    });
});
