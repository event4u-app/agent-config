// mandate_reask_report — road-to-mandates-scoped-to-the-goal step 0.2.
//
// Fixture store under tests/fixtures/mandate-reask/ mirrors the host shape
// `<root>/<project>/<session>.jsonl` plus `<session>/subagents/agent-*.jsonl`.
// Expected counts are read off the fixture lines by hand:
//   s-goal    goal turn → synthetic turn (ignored) → "erstelle den PR" = 1 re-ask;
//             the same turn replayed into s-goal-replay.jsonl is deduped;
//             the subagent file's "merge it" is not the main bucket.
//   s-pr      `gh pr create` result with a PR URL → assistant asks for a PR URL = 1.
//   s-control re-ask and URL question with no goal / no create before them = 0;
//             a goal revoked by "stop, nicht mergen" arms nothing for "push it".
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildReport, main, renderText } from '../../src/scripts/mandate_reask_report.js';

const FIXTURE_ROOT = path.resolve(__dirname, '../fixtures/mandate-reask');

const tmpDirs: string[] = [];
afterEach(() => {
    while (tmpDirs.length > 0) fs.rmSync(tmpDirs.pop() as string, { recursive: true, force: true });
});

function fixturePromptTexts(): string[] {
    const texts: string[] = [];
    const stack = [FIXTURE_ROOT];
    while (stack.length > 0) {
        const dir = stack.pop() as string;
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) { stack.push(full); continue; }
            for (const line of fs.readFileSync(full, 'utf-8').split('\n')) {
                if (line.trim() === '') continue;
                const rec = JSON.parse(line) as { message?: { content?: unknown } };
                const c = rec.message?.content;
                if (typeof c === 'string') texts.push(c);
                else if (Array.isArray(c)) {
                    for (const b of c as Array<Record<string, unknown>>) {
                        if (typeof b.text === 'string') texts.push(b.text);
                        if (typeof b.content === 'string') texts.push(b.content);
                    }
                }
            }
        }
    }
    return texts;
}

describe('mandate_reask_report', () => {
    it('(a) counts one reask_after_goal: goal sentence then a later re-ask', () => {
        const r = buildReport({ root: FIXTURE_ROOT });
        expect(r.metrics.reask_after_goal).toBe(1);
        expect(r.sessions.find((s) => s.session === 's-goal')?.reask_after_goal).toBe(1);
        expect(r.sessions.find((s) => s.session === 's-control')?.reask_after_goal ?? 0).toBe(0);
    });

    it('(b) counts one pr_target_asked_after_create: gh pr create result then a PR-URL question', () => {
        const r = buildReport({ root: FIXTURE_ROOT });
        expect(r.metrics.pr_target_asked_after_create).toBe(1);
        expect(r.sessions.find((s) => s.session === 's-pr')?.pr_target_asked_after_create).toBe(1);
    });

    it('scans the main bucket only and dedups replays', () => {
        const r = buildReport({ root: FIXTURE_ROOT });
        expect(r.sessions_scanned).toBe(3);
        expect(r.transcript_files).toBe(4);
    });

    it('(c) rendered output carries no substring of any fixture prompt', () => {
        const r = buildReport({ root: FIXTURE_ROOT });
        const rendered = `${renderText(r)}\n${JSON.stringify(r)}`;
        const texts = fixturePromptTexts();
        expect(texts.length).toBeGreaterThan(5);
        for (const t of texts) {
            expect(rendered).not.toContain(t);
            // The distinctive word of each fixture line never leaks either.
            for (const word of t.split(/\s+/).filter((w) => w.length >= 9)) {
                expect(rendered).not.toContain(word);
            }
        }
    });

    it('--since drops turns before the cutoff', () => {
        const r = buildReport({ root: FIXTURE_ROOT, since: '2026-11-02T00:00:00Z' });
        expect(r.metrics.reask_after_goal).toBe(0);
        expect(r.metrics.pr_target_asked_after_create).toBe(1);
    });

    it('--write-baseline records the command line and both metrics', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandate-reask-'));
        tmpDirs.push(dir);
        const out = path.join(dir, 'baseline.json');
        const argv = ['--root', FIXTURE_ROOT, '--write-baseline', out];
        expect(main(argv)).toBe(0);
        const parsed = JSON.parse(fs.readFileSync(out, 'utf-8')) as Record<string, unknown>;
        expect(parsed.command).toBe(`./scripts-run src/scripts/mandate_reask_report ${argv.join(' ')}`);
        expect((parsed.metrics as Record<string, number>).reask_after_goal).toBe(1);
        expect((parsed.metrics as Record<string, number>).pr_target_asked_after_create).toBe(1);
    });

    it('exits 1 on an empty store', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mandate-reask-empty-'));
        tmpDirs.push(dir);
        expect(main(['--root', dir, '--json'])).toBe(1);
    });
});
