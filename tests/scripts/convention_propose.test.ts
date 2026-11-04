// road-to-a-noted-that-is-a-write 3.1 — the convention is proposed as a diff;
// nothing changes without an accept that names that diff (OQ-32, option b).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    applyEditorconfig,
    applyProposal,
    editorconfigSettings,
    main,
    proposeConvention,
} from '../../src/scripts/convention_propose.js';

let root: string;
beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'propose-')));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
});

function listing(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of fs.readdirSync(root)) out[f] = fs.readFileSync(path.join(root, f), 'utf-8');
    return out;
}

describe('convention_propose', () => {
    it('emits the proposal and changes no file without the accept', () => {
        fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project\n');
        const before = listing();
        const out: string[] = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => {
            out.push(String(s));
            return true;
        });
        expect(main(['Use tabs, not spaces.'], root)).toBe(0);
        expect(listing()).toEqual(before);
        const text = out.join('');
        expect(text).toContain('+++ b/.editorconfig');
        expect(text).toContain('+indent_style = tab');
        expect(text).toContain('nothing was written');
    });

    it('writes exactly the shown diff with the matching digest', () => {
        const p = proposeConvention(root, 'Use tabs, not spaces.');
        expect(applyProposal(root, p, p.digest)).toBeNull();
        expect(fs.readFileSync(path.join(root, '.editorconfig'), 'utf-8')).toBe('root = true\n\n[*]\nindent_style = tab\n');
    });

    it('refuses a wrong digest and a target that moved since the diff was shown', () => {
        const p = proposeConvention(root, 'Keine Emojis in Commits.');
        expect(applyProposal(root, p, 'deadbeef0000')).toMatch(/does not match/);
        fs.writeFileSync(path.join(root, 'AGENTS.md'), 'changed meanwhile\n');
        expect(applyProposal(root, p, p.digest)).toMatch(/changed since/);
        expect(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf-8')).toBe('changed meanwhile\n');
    });

    it('routes check and prose rungs to one AGENTS.md bullet under ## Conventions', () => {
        fs.writeFileSync(path.join(root, 'AGENTS.md'), '# Project\n\n## Conventions\n\n- Existing.\n\n## Other\n\nx\n');
        const p = proposeConvention(root, 'Keine Emojis in Commits.');
        expect(p.rung).toBe('check');
        expect(p.file).toBe('AGENTS.md');
        expect(p.after).toBe('# Project\n\n## Conventions\n\n- Existing.\n- Keine Emojis in Commits.\n\n## Other\n\nx\n');
        expect(p.diff).toContain('+- Keine Emojis in Commits.');
    });

    it('sends a formatter-only config rung to AGENTS.md and says why', () => {
        const p = proposeConvention(root, 'Always use single quotes in TypeScript.');
        expect(p.rung).toBe('config');
        expect(p.file).toBe('AGENTS.md');
        expect(p.note).toMatch(/formatter-specific/);
    });

    it('proposes nothing when the carrier already says it', () => {
        fs.writeFileSync(path.join(root, '.editorconfig'), 'root = true\n\n[*]\nindent_style = tab\n');
        const p = proposeConvention(root, 'Use tabs, not spaces.');
        expect(p.before).toBe(p.after);
    });

    it.each([
        ['Indent with 4 spaces.', { indent_style: 'space', indent_size: '4' }],
        ['Einrückung immer mit zwei Leerzeichen.', { indent_style: 'space', indent_size: '2' }],
        ['Leerzeichen statt Tabs.', { indent_style: 'space' }],
        ['Use LF line endings everywhere.', { end_of_line: 'lf' }],
        ['Files end with a final newline.', { insert_final_newline: 'true' }],
        ['Line length is at most 120 characters.', { max_line_length: '120' }],
    ])('reads the editorconfig keys of %s', (sentence, keys) => {
        expect(editorconfigSettings(sentence)).toEqual(keys);
    });

    it('replaces a key inside [*] and leaves other sections alone', () => {
        const before = 'root = true\n\n[*]\nindent_style = space\n\n[*.md]\ntrim_trailing_whitespace = false\n';
        expect(applyEditorconfig(before, { indent_style: 'tab', insert_final_newline: 'true' })).toBe(
            'root = true\n\n[*]\nindent_style = tab\ninsert_final_newline = true\n\n[*.md]\ntrim_trailing_whitespace = false\n',
        );
    });
});
