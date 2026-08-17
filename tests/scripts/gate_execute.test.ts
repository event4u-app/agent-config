// Tests for src/agent-src/scripts/gate_execute.ts — `gates --execute <id>`,
// the acting half behind `road-to-gate-autonomy` Phase 2.
//
// One end-to-end fixture per class, against a temporary repo rather than the
// live estate: this is the one mode in the command that WRITES, and a test
// that exercises it on the real tree would resolve real blockers.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { commandOf, execute } from '../../src/agent-src/scripts/gate_execute.js';
import { parse_blockers } from '../../src/agent-src/scripts/update_roadmap_progress.js';

let repo = '';
let roadmapRoot = '';
const WHEN = new Date('2026-08-17T09:00:00Z');

/** A roadmap carrying one blocker with the given field lines. */
function roadmap(id: string, fields: readonly string[], extra = ''): string {
    return [
        '---',
        'complexity: lightweight',
        '---',
        '',
        '# Roadmap: fixture',
        '',
        '## Phase 1 — do it',
        '- [ ] **1.1** a step',
        extra,
        '',
        '## Blockers',
        '',
        `### blocker: ${id}`,
        '- **Status:** open',
        '- **Owner:** user',
        '- **Blocks:** Phase 1',
        ...fields,
        '- **Recommendation:** (a) — it is the cheap one.',
        '- **If you do nothing:** the phase stays parked.',
        '- **What to do:**',
        '  1. Run `the thing`.',
        '- **Resolved when:** the probe exits 0',
        '',
    ].join('\n');
}

function writeRoadmap(name: string, body: string): void {
    fs.writeFileSync(path.join(roadmapRoot, name), body, 'utf-8');
}

beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-exec-'));
    roadmapRoot = path.join(repo, 'agents', 'roadmaps');
    fs.mkdirSync(roadmapRoot, { recursive: true });
});

afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
});

describe('gates --execute — class 0 is run, and its output is the unblock', () => {
    it('runs the command, appends evidence at the blocker, flips the status', () => {
        writeRoadmap(
            'road-to-x.md',
            roadmap('time-window', ['- **Class:** 0', '- **Run:** `echo window-is-past`']),
        );

        const r = execute(roadmapRoot, 'time-window', WHEN);
        expect(r.outcome).toBe('resolved');
        expect(r.code).toBe(0);

        const after = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');
        expect(after).toContain('- **Status:** resolved 2026-08-17 — class-0 auto-run');
        expect(after).toContain('**Unblock evidence (2026-08-17):**');
        expect(after).toContain('window-is-past');
        // And the parser agrees it is settled — the point of the whole flip.
        const [b] = parse_blockers(after);
        expect(b!.status.startsWith('resolved')).toBe(true);
    });

    it('a failed command resolves nothing and says so', () => {
        writeRoadmap(
            'road-to-x.md',
            roadmap('flaky', ['- **Class:** 0', '- **Run:** `exit 3`']),
        );
        const before = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');

        const r = execute(roadmapRoot, 'flaky', WHEN);
        expect(r.outcome).toBe('failed');
        expect(r.code).toBe(1);
        expect(r.report).toContain('exited 3');
        // The file is byte-identical: a gate marked resolved by a command that
        // failed is worse than an open one.
        expect(fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8')).toBe(before);
    });

    it('class 0 with no Run: executes nothing rather than guessing one', () => {
        writeRoadmap('road-to-x.md', roadmap('bare', ['- **Class:** 0']));
        const r = execute(roadmapRoot, 'bare', WHEN);
        expect(r.outcome).toBe('failed');
        expect(r.report).toContain('no **Run:** command');
    });
});

describe('gates --execute — class 1 renders instead of running', () => {
    it('with no budget ledger it emits the consent line and spends nothing', () => {
        writeRoadmap(
            'road-to-x.md',
            roadmap('paid-eval', [
                '- **Class:** 1',
                '- **Run:** `echo SHOULD-NOT-RUN`',
                '- **Budget:** ~50 USD per run',
                '- **Question:** authorize the paid eval?',
            ]),
        );
        const before = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');

        const r = execute(roadmapRoot, 'paid-eval', WHEN);
        expect(r.outcome).toBe('rendered');
        expect(r.code).toBe(0);
        expect(r.report).toContain('CONSENT');
        expect(r.report).toContain('no budget ledger');
        expect(r.report).not.toContain('SHOULD-NOT-RUN');
        expect(fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8')).toBe(before);
    });
});

describe('gates --execute — classes 2 and 3 are untouched', () => {
    it('class 2 emits one consent line with its recommendation and a default', () => {
        writeRoadmap(
            'road-to-x.md',
            roadmap('a-preference', ['- **Class:** 2', '- **Question:** which sink?']),
        );
        const r = execute(roadmapRoot, 'a-preference', WHEN);
        expect(r.outcome).toBe('rendered');
        expect(r.report).toContain('CONSENT · a-preference');
        expect(r.report).toContain('which sink?');
        expect(r.report).toContain('Recommendation: (a)');
        expect(r.report).toContain('Default if you say nothing');
    });

    it('a paragraph-shaped recommendation is flagged, not silently rendered', () => {
        // Risk 5: the defect being fixed is reading load, so a mechanism that
        // emits paragraphs recreates it. The taxonomy's remedy is
        // reclassification to 3, and the line says so at the entry.
        writeRoadmap(
            'road-to-x.md',
            roadmap('wordy', ['- **Class:** 2']).replace(
                '- **Recommendation:** (a) — it is the cheap one.',
                `- **Recommendation:** ${'why this option and not the other '.repeat(8)}`,
            ),
        );
        const r = execute(roadmapRoot, 'wordy', WHEN);
        expect(r.report).toContain('reclassified to 3');
    });

    it('a one-line recommendation carries no such note', () => {
        writeRoadmap('road-to-x.md', roadmap('terse', ['- **Class:** 2']));
        expect(execute(roadmapRoot, 'terse', WHEN).report).not.toContain('reclassified to 3');
    });

    it('class 3 executes nothing and writes nothing', () => {
        writeRoadmap('road-to-x.md', roadmap('a-deploy', ['- **Class:** 3']));
        const before = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');
        const r = execute(roadmapRoot, 'a-deploy', WHEN);
        expect(r.outcome).toBe('rendered');
        expect(r.report).toContain('class 3 — human-only');
        expect(fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8')).toBe(before);
    });

    it('an unclassified blocker is class 3 — the absent-field default holds here too', () => {
        writeRoadmap('road-to-x.md', roadmap('legacy-entry', ['- **Run:** `echo NOPE`']));
        const r = execute(roadmapRoot, 'legacy-entry', WHEN);
        expect(r.report).toContain('class 3');
        expect(r.report).not.toContain('NOPE');
    });
});

describe('gates --execute — refusals', () => {
    it('an unknown id fails loudly rather than silently doing nothing', () => {
        writeRoadmap('road-to-x.md', roadmap('real', ['- **Class:** 3']));
        const r = execute(roadmapRoot, 'imaginary', WHEN);
        expect(r.outcome).toBe('not-found');
        expect(r.code).toBe(1);
    });

    it('an already-resolved blocker is not re-run', () => {
        writeRoadmap(
            'road-to-x.md',
            roadmap('done-already', ['- **Class:** 0', '- **Run:** `echo AGAIN`']).replace(
                '- **Status:** open',
                '- **Status:** resolved 2026-08-01 — done',
            ),
        );
        const r = execute(roadmapRoot, 'done-already', WHEN);
        expect(r.outcome).toBe('not-found');
    });

    it('commandOf strips the backticks an authored Run: field carries', () => {
        expect(commandOf({ run: '`task ci`' } as never)).toBe('task ci');
        expect(commandOf({ run: 'task ci' } as never)).toBe('task ci');
        expect(commandOf({ run: '' } as never)).toBe('');
    });
});
