// road-to-a-noted-that-is-a-write — Phase 1 (turn snapshot, subject index)
// and step 2.1 (the persistence-claim detector).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    type DefectFinding,
    detectPersistenceClaim,
    detectUserReport,
    mergeRecord,
    runDetectors,
    type TurnSnapshot,
    writesCarrier,
} from '../../src/scripts/_lib/self_repair.js';
import {
    listRecords,
    SUBJECT_INDEX_FILE,
    storeDir,
    subjectCounts,
    upsertFinding,
    writeSubjectIndex,
} from '../../src/scripts/_lib/self_repair_store.js';
import { readTurn } from '../../src/scripts/self_repair_hook.js';

const NOW = '2026-11-04T10:00:00.000Z';

function turn(partial: Partial<TurnSnapshot>): TurnSnapshot {
    return { prompt: '', reply: '', toolCommands: [], pinnedLanguage: null, ...partial };
}

let tmp: string;
beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noted-')));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function transcript(lines: unknown[]): string {
    const tp = path.join(tmp, 't.jsonl');
    fs.writeFileSync(tp, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf-8');
    return tp;
}

describe('1.1 — the turn snapshot carries write paths', () => {
    it.each([
        ['Write', { file_path: '/repo/.editorconfig', content: 'x' }, 'Write /repo/.editorconfig'],
        ['Edit', { file_path: '/repo/AGENTS.md', old_string: 'a', new_string: 'b' }, 'Edit /repo/AGENTS.md'],
        ['MultiEdit', { file_path: '/repo/CLAUDE.md', edits: [] }, 'MultiEdit /repo/CLAUDE.md'],
        ['NotebookEdit', { notebook_path: '/repo/n.ipynb', new_source: '' }, 'NotebookEdit /repo/n.ipynb'],
        ['Bash', { command: 'ls -la' }, 'Bash ls -la'],
        ['Read', { file_path: '/repo/AGENTS.md' }, 'Read /repo/AGENTS.md'],
    ])('%s is recorded with its target', (name, input, expected) => {
        const tp = transcript([
            { type: 'user', message: { content: 'go' } },
            { type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } },
        ]);
        expect(readTurn(tp, null).toolCommands).toEqual([expected]);
    });

    it('scopes tool calls to the last turn, so an earlier write does not discharge a new claim', () => {
        const tp = transcript([
            { type: 'user', message: { content: 'nimm Tabs' } },
            {
                type: 'assistant',
                message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: '/r/.editorconfig' } }] },
            },
            { type: 'user', message: { content: 'und ab jetzt immer Single Quotes' } },
            { type: 'assistant', message: { content: [{ type: 'text', text: 'Notiert, ab jetzt Single Quotes.' }] } },
        ]);
        const t = readTurn(tp, null);
        expect(t.toolCommands).toEqual([]);
        expect(runDetectors(t).map((f) => f.defect_class)).toContain('persistence-claim');
    });

    it('keeps tool results inside the same turn (array-content user lines are not prompts)', () => {
        const tp = transcript([
            { type: 'user', message: { content: 'ab jetzt Tabs' } },
            {
                type: 'assistant',
                message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: '/r/.editorconfig' } }] },
            },
            { type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
            { type: 'assistant', message: { content: [{ type: 'text', text: 'Notiert, ab jetzt Tabs.' }] } },
        ]);
        const t = readTurn(tp, null);
        expect(t.toolCommands).toEqual(['Edit /r/.editorconfig']);
        expect(detectPersistenceClaim(t)).toBeNull();
    });
});

describe('1.2 — precision gaps named by the 2026-10-29 council review', () => {
    it.each([
        'how many times should I retry?',
        'How many times will we run the migration?',
        'wie oft soll ich es versuchen?',
        'wie oft muss ich den Job neu starten?',
    ])('a first-person question about a count stays silent: %s', (prompt) => {
        expect(detectUserReport(prompt)).toBeNull();
    });

    it.each([
        'how many times do I have to tell you',
        'wie oft soll ich dir das noch sagen',
        'How many times do I have to say it — use `Tabs` please',
    ])('a recurrence still fires: %s', (prompt) => {
        expect(detectUserReport(prompt)).not.toBeNull();
    });

    it('takes the subject from the complaint sentence, not an unrelated backtick elsewhere', () => {
        const f = detectUserReport('Ich schaue mir `build.ts` später an. Du hast schon wieder `tabs` vergessen!');
        expect(f?.subject).toBe('tabs');
    });

    it('does not split a sentence on a dot inside a code span', () => {
        const f = detectUserReport("you didn't format `foo.ts` again");
        expect(f?.subject).toBe('foo.ts');
    });

    it('counts each subject on its own when one fingerprint folds two subjects', () => {
        const a = detectUserReport('you forgot `tabs`')!;
        const b = detectUserReport('you forgot `lint`')!;
        const first = mergeRecord(null, a, NOW);
        const second = mergeRecord(first, b, NOW);
        expect(second.fingerprint).toBe(first.fingerprint);
        expect(second.subject).toBe('tabs');
        expect(second.subjects).toEqual({ tabs: 1, lint: 1 });
    });
});

describe('1.2 — the subject-count index', () => {
    const reports = [
        'Du hast schon wieder `tabs` ignoriert',
        'For the third time: tabs.',
        'I already told you about `tabs`',
    ];

    it('three records with different fingerprints and one subject count 3', () => {
        for (const r of reports) upsertFinding(tmp, detectUserReport(r)!, NOW);
        const recs = listRecords(tmp);
        expect(new Set(recs.map((r) => r.fingerprint)).size).toBe(3);
        const counts = subjectCounts(tmp);
        expect(counts).toEqual([
            { subject: 'tabs', arrivals: 3, records: recs.map((r) => r.fingerprint).sort() },
        ]);
    });

    it('writes a byte-stable index beside the records that listRecords never reads as a record', () => {
        for (const r of reports) upsertFinding(tmp, detectUserReport(r)!, NOW);
        writeSubjectIndex(tmp);
        const file = path.join(storeDir(tmp), SUBJECT_INDEX_FILE);
        const once = fs.readFileSync(file, 'utf-8');
        fs.rmSync(file);
        writeSubjectIndex(tmp);
        expect(fs.readFileSync(file, 'utf-8')).toBe(once);
        expect(listRecords(tmp)).toHaveLength(3);
    });


    it('reads a legacy record that carries only `subject` as all of its arrivals', () => {
        const f: DefectFinding = { ...detectUserReport('For the third time: tabs.')! };
        const rec = { ...mergeRecord(null, f, NOW), occurrences: 4 };
        delete rec.subjects;
        fs.mkdirSync(storeDir(tmp), { recursive: true });
        fs.writeFileSync(path.join(storeDir(tmp), `${rec.fingerprint}.json`), JSON.stringify(rec), 'utf-8');
        expect(subjectCounts(tmp)[0]?.arrivals).toBe(4);
    });
});

describe('2.1 — a "noted" with no write is a defect', () => {
    it.each([
        'Write /repo/.editorconfig',
        'Edit /repo/AGENTS.md',
        'Edit /repo/packages/a/CLAUDE.local.md',
        'Write /repo/.prettierrc.json',
        'Write /repo/eslint.config.mjs',
        'Write /repo/.claude/rules/tabs.md',
        'Write /home/x/.claude/projects/p/memory/tabs.md',
        'Bash agent-config memory:add --type feedback "tabs"',
        'Bash echo "- tabs" >> AGENTS.md',
        'Bash printf x | tee -a CLAUDE.md',
    ])('counts as a carrier write: %s', (cmd) => {
        expect(writesCarrier(cmd)).toBe(true);
    });

    it.each([
        'Read /repo/AGENTS.md',
        'Bash cat AGENTS.md',
        'Edit /repo/src/agents.ts',
        'Write /repo/docs/AGENTS.md.bak',
        'Bash grep tabs .editorconfig',
    ])('does not count as a carrier write: %s', (cmd) => {
        expect(writesCarrier(cmd)).toBe(false);
    });

    it('fires on the owner case and names the claim', () => {
        const f = detectPersistenceClaim(
            turn({ prompt: 'Benutze ab jetzt immer Tabs.', reply: 'Notiert — ab jetzt Tabs statt Spaces.' }),
        );
        expect(f?.defect_class).toBe('persistence-claim');
        expect(f?.source).toBe('self-detected');
        expect(f?.evidence.toLowerCase()).toContain('ab jetzt');
    });

    it('"noted, see the PR" beside a write to .editorconfig stays silent', () => {
        expect(
            detectPersistenceClaim(
                turn({
                    prompt: 'always use tabs',
                    reply: 'Noted, see the PR.',
                    toolCommands: ['Write /repo/.editorconfig'],
                }),
            ),
        ).toBeNull();
    });

    it('a weak "noted" without a durable ask stays silent', () => {
        expect(detectPersistenceClaim(turn({ prompt: 'what failed?', reply: 'Noted — the lint step failed.' }))).toBeNull();
    });
});
