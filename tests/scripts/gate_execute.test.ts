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

/** The class-1 receipt ledger inside the fixture repo. */
function ledger(): string {
    return path.join(repo, 'agents', 'runtime', 'state', 'gate-budget-ledger.jsonl');
}

/** Configure the standing class-1 budget in the fixture repo's own settings. */
function writeCaps(perRun: number, rolling: number): void {
    fs.writeFileSync(
        path.join(repo, '.agent-settings.yml'),
        [
            'roadmap:',
            '  gate_budget:',
            `    max_cost_per_run_usd: ${String(perRun)}`,
            `    max_cost_per_rolling_7d_usd: ${String(rolling)}`,
            '',
        ].join('\n'),
        'utf-8',
    );
}

/** A class-1 entry whose stated estimate is far over any sane per-run cap. */
const PAID_FIELDS: readonly string[] = [
    '- **Class:** 1',
    '- **Run:** `echo SHOULD-NOT-RUN`',
    '- **Budget:** ~50 USD per run',
    '- **Question:** authorize the paid eval?',
];

/** The same entry, priced inside the caps the tests configure. */
const CHEAP_FIELDS: readonly string[] = [
    '- **Class:** 1',
    '- **Run:** `echo ran-the-paid-thing`',
    '- **Budget:** ~$4 per run',
    '- **Question:** authorize the paid eval?',
];

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

        const r = execute(roadmapRoot, 'time-window', WHEN, { confirm: true });
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

        const r = execute(roadmapRoot, 'flaky', WHEN, { confirm: true });
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

describe('gates --execute — nothing runs without --confirm', () => {
    // Regression for R2 finding 1: `Run:` is arbitrary shell read out of a
    // markdown field, and the first cut executed it on one keypress.

    it('echoes the command and executes nothing by default', () => {
        writeRoadmap(
            'road-to-x.md',
            roadmap('probe', ['- **Class:** 0', '- **Run:** `echo MUST-NOT-RUN`']),
        );
        const before = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');

        const r = execute(roadmapRoot, 'probe', WHEN);
        expect(r.outcome).toBe('rendered');
        expect(r.code).toBe(0);
        expect(r.report).toContain('echo MUST-NOT-RUN');
        expect(r.report).toContain('--confirm');
        // Echoed, not run: the file is untouched and no evidence was appended.
        expect(fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8')).toBe(before);
        expect(r.report).not.toContain('resolved.');
    });

    it('refuses a Hard-Floor command even WITH --confirm', () => {
        // Class 0 means reversible. A push is not, so the entry is
        // misclassified and the answer is refusal, not a confirmation prompt.
        for (const cmd of ['git push origin main', 'terraform apply', 'rm -rf dist', 'gh pr merge 12']) {
            writeRoadmap('road-to-x.md', roadmap('oops', ['- **Class:** 0', `- **Run:** \`${cmd}\``]));
            const r = execute(roadmapRoot, 'oops', WHEN, { confirm: true });
            expect(r.outcome, cmd).toBe('failed');
            expect(r.report, cmd).toContain('Hard-Floor');
            expect(r.report, cmd).toContain('misclassified');
        }
    });

    it('a near-miss is not mistaken for a Hard-Floor command', () => {
        // The words appear, but not as the command: the pattern anchors at a
        // command position, so mentioning a push in output is not pushing.
        writeRoadmap(
            'road-to-x.md',
            roadmap('fine', ['- **Class:** 0', '- **Run:** `echo nothing to push here`']),
        );
        expect(execute(roadmapRoot, 'fine', WHEN, { confirm: true }).outcome).toBe('resolved');
    });
});

describe('gates --execute — the evidence lands under the blocker', () => {
    it('a blocker followed by another ## section keeps its evidence in place', () => {
        // Regression for R2 finding 3: the body ran to the end of the file for
        // the LAST blocker, which is the common shape, so the bullet landed
        // after the risk table instead of under the entry.
        writeRoadmap(
            'road-to-x.md',
            roadmap('last-one', ['- **Class:** 0', '- **Run:** `echo ok`']) +
                ['## Risk Register', '', '| Rank | Item |', '|---|---|', '| 1 | something |', ''].join('\n'),
        );
        execute(roadmapRoot, 'last-one', WHEN, { confirm: true });

        const after = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');
        const evidenceAt = after.indexOf('**Unblock evidence');
        const riskAt = after.indexOf('## Risk Register');
        expect(evidenceAt).toBeGreaterThan(-1);
        expect(evidenceAt).toBeLessThan(riskAt);
    });

    it('a blocker id carrying a regex metacharacter does not throw', () => {
        // Regression for R2 finding 13: ids are parsed with `(.+?)`, so a
        // metacharacter is legal in the tree and threw AFTER the command ran.
        writeRoadmap(
            'road-to-x.md',
            roadmap('b-foo(1)', ['- **Class:** 0', '- **Run:** `echo ok`']),
        );
        const r = execute(roadmapRoot, 'b-foo(1)', WHEN, { confirm: true });
        expect(r.outcome).toBe('resolved');
    });
});

describe('gates --execute — class 1 runs only inside the standing budget', () => {
    // Every refusal below RENDERS. That is the blocker's own prescription for a
    // missing ledger, generalised: a budget that cannot say yes says the
    // consent line, never a degraded run.
    it('with no caps configured it emits the consent line and spends nothing', () => {
        writeRoadmap('road-to-x.md', roadmap('paid-eval', PAID_FIELDS));
        const before = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');

        const r = execute(roadmapRoot, 'paid-eval', WHEN, { confirm: true });
        expect(r.outcome).toBe('rendered');
        expect(r.code).toBe(0);
        expect(r.report).toContain('CONSENT');
        expect(r.report).toContain('no standing class-1 budget is configured');
        expect(r.report).not.toContain('SHOULD-NOT-RUN');
        expect(fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8')).toBe(before);
        expect(fs.existsSync(ledger())).toBe(false);
    });

    it('over the per-run cap it renders and names the two figures', () => {
        writeCaps(5, 25);
        writeRoadmap('road-to-x.md', roadmap('paid-eval', PAID_FIELDS));

        const r = execute(roadmapRoot, 'paid-eval', WHEN, { confirm: true });
        expect(r.outcome).toBe('rendered');
        expect(r.report).toContain('exceeds the per-run cap');
        expect(r.report).toContain('$50.00');
        expect(r.report).toContain('$5.00');
        expect(r.report).not.toContain('SHOULD-NOT-RUN');
        expect(fs.existsSync(ledger())).toBe(false);
    });

    it('over the rolling cap it renders even though the per-run cap passes', () => {
        // Per-run 5 admits a $5 estimate — the caps are inclusive, so a run
        // exactly AT a cap is allowed and only crossing it refuses. Rolling 22
        // with $20 already receipted is therefore the shape that isolates the
        // rolling half: the per-run check passes and the window still refuses.
        writeCaps(5, 22);
        fs.mkdirSync(path.dirname(ledger()), { recursive: true });
        fs.writeFileSync(
            ledger(),
            [0, 1, 2, 3]
                .map((d) =>
                    JSON.stringify({
                        kind: 'consumption',
                        blocker: 'paid-eval',
                        authorization: 'confirm-flag',
                        estimated_usd: 5,
                        actual_usd: null,
                        at: new Date(WHEN.getTime() - d * 3600_000).toISOString(),
                        single_use: true,
                    }),
                )
                .join('\n') + '\n',
            'utf-8',
        );
        writeRoadmap(
            'road-to-x.md',
            roadmap('paid-eval', [
                '- **Class:** 1',
                '- **Run:** `echo SHOULD-NOT-RUN`',
                '- **Budget:** ~$5 per run',
                '- **Question:** authorize the paid eval?',
            ]),
        );

        const r = execute(roadmapRoot, 'paid-eval', WHEN, { confirm: true });
        expect(r.outcome).toBe('rendered');
        expect(r.report).toContain('over the rolling cap');
        expect(r.report).toContain('$20.00 is already receipted');
        expect(r.report).not.toContain('SHOULD-NOT-RUN');
    });

    it('a Budget field with no USD figure renders rather than guessing one', () => {
        writeCaps(5, 25);
        writeRoadmap(
            'road-to-x.md',
            roadmap('paid-eval', [
                '- **Class:** 1',
                '- **Run:** `echo SHOULD-NOT-RUN`',
                '- **Budget:** ~50 queries per run',
                '- **Question:** authorize the paid eval?',
            ]),
        );

        const r = execute(roadmapRoot, 'paid-eval', WHEN, { confirm: true });
        expect(r.outcome).toBe('rendered');
        expect(r.report).toContain('states no USD estimate');
        expect(r.report).not.toContain('SHOULD-NOT-RUN');
    });

    it('inside the budget but without --confirm it echoes and runs nothing', () => {
        writeCaps(5, 25);
        writeRoadmap('road-to-x.md', roadmap('paid-eval', CHEAP_FIELDS));
        const before = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');

        const r = execute(roadmapRoot, 'paid-eval', WHEN);
        expect(r.outcome).toBe('rendered');
        expect(r.report).toContain('is class 1 and would run');
        expect(r.report).toContain('--confirm');
        expect(fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8')).toBe(before);
        expect(fs.existsSync(ledger())).toBe(false);
    });

    it('inside the budget with --confirm it runs, receipts, and resolves', () => {
        writeCaps(5, 25);
        writeRoadmap('road-to-x.md', roadmap('paid-eval', CHEAP_FIELDS));

        const r = execute(roadmapRoot, 'paid-eval', WHEN, { confirm: true });
        expect(r.outcome).toBe('resolved');
        expect(r.code).toBe(0);
        const body = fs.readFileSync(path.join(roadmapRoot, 'road-to-x.md'), 'utf-8');
        expect(body).toContain('ran-the-paid-thing');
        expect(body).toContain('**Status:** resolved 2026-08-17');

        const lines = fs
            .readFileSync(ledger(), 'utf-8')
            .split('\n')
            .filter((l) => l.trim() !== '');
        expect(lines).toHaveLength(1);
        const rec = JSON.parse(lines[0]!) as Record<string, unknown>;
        expect(rec['kind']).toBe('consumption');
        expect(rec['blocker']).toBe('paid-eval');
        expect(rec['authorization']).toBe('confirm-flag');
        expect(rec['estimated_usd']).toBe(4);
        expect(rec['actual_usd']).toBeNull();
        expect(rec['single_use']).toBe(true);
        expect(r.report).toContain('Receipt appended');
    });

    it('a Hard-Floor Run is refused even with --confirm and inside the budget', () => {
        writeCaps(5, 25);
        writeRoadmap(
            'road-to-x.md',
            roadmap('paid-eval', [
                '- **Class:** 1',
                '- **Run:** `git push origin main`',
                '- **Budget:** ~$1 per run',
                '- **Question:** authorize the paid eval?',
            ]),
        );

        const r = execute(roadmapRoot, 'paid-eval', WHEN, { confirm: true });
        expect(r.outcome).toBe('failed');
        expect(r.report).toContain('is class 1 but its **Run:** command contains');
        expect(r.report).toContain('Classes 0 and 1 are');
        expect(fs.existsSync(ledger())).toBe(false);
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
