import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runGitConvention } from '../../../src/scripts/_cli/cmd_git_convention.js';
import { commitlintIssuePrefixes, parseTicketKeys } from '../../../src/scripts/_lib/git_convention_grammar.js';

const made: string[] = [];
afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function repo(files: Record<string, string> = {}): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'git-convention-keys-')));
    made.push(dir);
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    for (const [rel, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, rel), text);
    return dir;
}

const CARD = '---\nobserved_n: 137\ndominant_family: ticket-prefix\nticket_keys: [DEV, OPS]\n---\n';

describe('the card line', () => {
    it('reads ticket_keys out of a card in flow, comma and bare form', () => {
        expect(parseTicketKeys(CARD)).toEqual(['DEV', 'OPS']);
        expect(parseTicketKeys('ticket_keys: DEV, OPS')).toEqual(['DEV', 'OPS']);
        expect(parseTicketKeys('DEV OPS')).toEqual(['DEV', 'OPS']);
    });

    it('reads no keys from a card without the line, and refuses a key outside the grammar', () => {
        expect(parseTicketKeys('---\nobserved_n: 1\n---\n')).toEqual([]);
        expect(parseTicketKeys('ticket_keys: [dev, OPS]')).toEqual(['OPS']);
    });
});

describe('commitlint issue prefixes as a proposal', () => {
    it('reads the prefixes out of a config', () => {
        const js = "module.exports = { parserPreset: { parserOpts: { issuePrefixes: ['DEV-', 'OPS-'] } } };";
        expect(commitlintIssuePrefixes(js)).toEqual(['DEV', 'OPS']);
        expect(commitlintIssuePrefixes('{"parserPreset":{"parserOpts":{"issuePrefixes":["#"]}}}')).toEqual([]);
        expect(commitlintIssuePrefixes('module.exports = {};')).toEqual([]);
    });

    it('offers them for the card and writes nothing', () => {
        const dir = repo({ 'commitlint.config.js': "module.exports = { parserPreset: { parserOpts: { issuePrefixes: ['DEV-'] } } };\n" });
        const before = fs.readdirSync(dir).sort();
        const r = runGitConvention(['ticket', 'feat/DEV-1-x'], dir);
        expect(r.out.join('\n')).toMatch(/proposal +ticket_keys: DEV/);
        expect(fs.readdirSync(dir).sort()).toEqual(before);
    });

    it('offers them when a commit-msg hook is listed before the config', () => {
        const dir = repo({ 'commitlint.config.js': "module.exports = { parserPreset: { parserOpts: { issuePrefixes: ['DEV-'] } } };\n" });
        fs.mkdirSync(path.join(dir, '.husky'));
        fs.writeFileSync(path.join(dir, '.husky', 'commit-msg'), '#!/bin/sh\nnpx --no -- commitlint --edit "$1"\n', { mode: 0o755 });
        execFileSync('git', ['config', 'core.hooksPath', '.husky'], { cwd: dir });
        const r = runGitConvention(['ticket', 'feat/DEV-1-x'], dir);
        expect(r.out.join('\n')).toMatch(/proposal +ticket_keys: DEV \(issuePrefixes in .*commitlint\.config\.js\)/);
    });

    it('offers nothing once the caller passes the card line', () => {
        const dir = repo({ 'commitlint.config.js': "module.exports = { parserPreset: { parserOpts: { issuePrefixes: ['DEV-'] } } };\n" });
        const r = runGitConvention(['ticket', 'feat/DEV-1-x', '--keys', 'ticket_keys: [DEV]'], dir);
        expect(r.out.join('\n')).not.toContain('proposal');
    });
});

describe('the caller passes the line', () => {
    it('marks a candidate whose key is not on the card as unknown-key', () => {
        const r = runGitConvention(['ticket', 'feat/ABC-9-x', '--keys', 'ticket_keys: [DEV, OPS]', '--json'], repo());
        const parsed = JSON.parse(r.out.join('\n')) as { ticket: string | null; candidates: { token: string; status: string }[] };
        expect(parsed.ticket).toBeNull();
        expect(parsed.candidates).toEqual([expect.objectContaining({ token: 'ABC-9', status: 'unknown-key' })]);
    });

    it('applies the grammar and the denylist alone without a card', () => {
        const parsed = JSON.parse(runGitConvention(['ticket', 'fix/CVE-2026-12345-patch', '--json'], repo()).out.join('\n')) as {
            ticket: string | null;
        };
        expect(parsed.ticket).toBeNull();
        expect(runGitConvention(['ticket', 'feat/ABC-9-x'], repo()).out[0]).toBe('ticket ABC-9');
    });
});
