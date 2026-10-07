import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _blockerEntries,
    _classifyOwner,
    _ownerQuestionLines,
    collect,
    format,
    main,
} from '../../src/scripts/report_parked_blockers.js';
import { runInProc } from '../_lib/run_in_process.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'parked-blockers-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function blocker(id: string, status: string, owner: string): string {
    return [
        `### blocker: ${id}`,
        `- **Status:** ${status}`,
        `- **Owner:** ${owner}`,
        '- **Blocks:** step 1.1',
        '- **What to do:** decide',
        '- **Resolved when:** decided',
        '',
    ].join('\n');
}

const PARKED_A = [
    '# Parked A',
    '',
    '> **Owner question, posed 2026-10-01:** archive or keep?',
    '',
    '```',
    '> owner question inside a fence is not one',
    '```',
    '',
    '## Blockers',
    '',
    blocker('needs-owner', 'open', 'maintainer'),
    blocker('needs-run', 'open', 'implementer'),
    blocker('done', 'resolved 2026-09-01 by #1', 'user'),
    '## Risk Register',
    '',
    '### blocker: outside-section',
    '- **Status:** open',
    '- **Owner:** owner',
].join('\n');

const PARKED_B = ['# Parked B', '', '## Blockers', '', blocker('ask-me', 'open', 'User — the maintainer.')].join('\n');

describe('report_parked_blockers', () => {
    it('classifies owner-wait by the owner set and everything else as agent-wait', () => {
        expect(_classifyOwner('maintainer')).toBe('owner');
        expect(_classifyOwner('User — the maintainer.')).toBe('owner');
        expect(_classifyOwner('owner')).toBe('owner');
        expect(_classifyOwner('implementer')).toBe('agent');
        expect(_classifyOwner('council')).toBe('agent');
        expect(_classifyOwner('')).toBe('agent');
    });

    it('reads entries only inside the Blockers section', () => {
        const ids = _blockerEntries(PARKED_A).map((e) => e.id);
        expect(ids).toEqual(['needs-owner', 'needs-run', 'done']);
    });

    it('finds owner-question blockquotes and skips fenced ones', () => {
        const q = _ownerQuestionLines(PARKED_A);
        expect(q).toHaveLength(1);
        expect(q[0]?.line).toBe(3);
    });

    it('counts open blockers per file, split by who they wait on', () => {
        fs.writeFileSync(path.join(tmp, 'a.md'), PARKED_A);
        fs.writeFileSync(path.join(tmp, 'b.md'), PARKED_B);
        fs.writeFileSync(path.join(tmp, 'c.md'), '# No blockers\n');
        const c = collect(tmp, tmp);
        expect(c.files_scanned).toBe(3);
        expect(c.files_with_open_blockers).toBe(2);
        expect(c.blockers.map((b) => `${b.file}:${b.id}:${b.wait}`)).toEqual([
            'a.md:needs-owner:owner',
            'a.md:needs-run:agent',
            'b.md:ask-me:owner',
        ]);
        expect(c.owner_questions).toEqual([
            { file: 'a.md', line: 3, text: '> **Owner question, posed 2026-10-01:** archive or keep?', blocker_entries_in_file: 3 },
        ]);
        const text = format(c);
        expect(text).toContain('owner-wait 2, agent-wait 1');
        expect(text).toContain('Owner: User — the maintainer.');
    });

    it('exits 0 on a report and 2 on a usage error', async () => {
        fs.writeFileSync(path.join(tmp, 'a.md'), PARKED_A);
        const ok = await runInProc(main, ['--dir', tmp, '--format', 'json']);
        expect(ok.status).toBe(0);
        expect(JSON.parse(ok.stdout).blockers).toHaveLength(2);
        const bad = await runInProc(main, ['--format', 'xml']);
        expect(bad.status).toBe(2);
    });
});
