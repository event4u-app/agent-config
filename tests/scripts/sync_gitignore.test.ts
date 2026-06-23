
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as sg from '../../src/scripts/sync_gitignore.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'sync_gitignore.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);

// Minimal template used throughout; matches sub-group shape of real template.
const TEMPLATE_CONTENT = `# Agent config — symlinked
.augment/skills/
.augment/commands/

# Agent config — CLI wrapper
/agent-config

# Agent config — chat history
/agents/.agent-chat-history
/agents/.agent-chat-history.bak

# Agent config — runtime cache
/agents/runtime/.agent-prices.md
`;

let tmp: string;
let template: string;
let gitignore: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgign-'));
    template = path.join(tmp, 'gitignore-block.txt');
    fs.writeFileSync(template, TEMPLATE_CONTENT, 'utf-8');
    gitignore = path.join(tmp, '.gitignore');
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.restoreAllMocks();
});

// Run main() capturing stdout/stderr; intercept process.exit so an argparse
// error (exit 2 etc.) becomes a thrown sentinel rather than killing vitest.
interface RunResult {
    rc: number;
    out: string;
    err: string;
}
class _Exit extends Error {
    constructor(public code: number) {
        super(`exit ${code}`);
    }
}
function runMain(args: string[]): RunResult {
    let out = '';
    let err = '';
    const so = vi.spyOn(process.stdout, 'write').mockImplementation((c: any) => {
        out += typeof c === 'string' ? c : c.toString('utf-8');
        return true;
    });
    const se = vi.spyOn(process.stderr, 'write').mockImplementation((c: any) => {
        err += typeof c === 'string' ? c : c.toString('utf-8');
        return true;
    });
    const ex = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new _Exit(code ?? 0);
    }) as never);
    let rc: number;
    try {
        rc = sg.main(args);
    } catch (e) {
        if (e instanceof _Exit) {
            rc = e.code;
        } else {
            throw e;
        }
    } finally {
        so.mockRestore();
        se.mockRestore();
        ex.mockRestore();
    }
    return { rc, out, err };
}

// --- Layer 1: ported behavioural spec ---------------------------------------

describe('sync_gitignore — ported behavioural spec', () => {
    it('template_entries extracts paths only', () => {
        const lines = sg.load_template(template);
        expect(sg.template_entries(lines)).toEqual([
            '.augment/skills/',
            '.augment/commands/',
            '/agent-config',
            '/agents/.agent-chat-history',
            '/agents/.agent-chat-history.bak',
            '/agents/runtime/.agent-prices.md',
        ]);
    });

    it('block_entries ignores comments and blanks', () => {
        const block = [
            '# event4u/agent-config',
            '# Agent config — X',
            '.foo',
            '',
            '.bar',
            '# event4u/agent-config — END',
        ];
        expect(sg.block_entries(block)).toEqual(['.foo', '.bar']);
    });

    it('find_block missing returns null', () => {
        expect(sg.find_block(['/vendor/', '/node_modules/'])).toBeNull();
    });

    it('find_block with explicit footer', () => {
        const lines = [
            '/vendor/',
            '',
            '# event4u/agent-config',
            '.foo',
            '# event4u/agent-config — END',
            '',
            '# user stuff',
        ];
        const loc = sg.find_block(lines);
        expect(loc).toEqual([2, 5]);
        expect(lines.slice(2, 5)).toEqual([
            '# event4u/agent-config',
            '.foo',
            '# event4u/agent-config — END',
        ]);
    });

    it('find_block legacy no footer extends to EOF', () => {
        const lines = ['/vendor/', '', '# event4u/agent-config', '# Agent config — X', '.foo', '.bar'];
        expect(sg.find_block(lines)).toEqual([2, 6]);
    });

    it('find_block legacy stops at foreign section', () => {
        const lines = [
            '# event4u/agent-config',
            '# Agent config — X',
            '.foo',
            '',
            '# Some user block',
            'user-stuff/',
        ];
        expect(sg.find_block(lines)).toEqual([0, 3]);
    });

    it('sync appends fresh block when missing', () => {
        fs.writeFileSync(gitignore, '/vendor/\n/node_modules/\n', 'utf-8');
        const { rc } = runMain(['--path', gitignore, '--template', template]);
        expect(rc).toBe(0);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).toContain('/vendor/');
        expect(text).toContain(sg.SECTION_HEADER);
        expect(text).toContain(sg.SECTION_FOOTER);
        expect(text).toContain('.agent-chat-history');
        expect(text.endsWith('\n') && !text.endsWith('\n\n')).toBe(true);
    });

    it('sync no changes when already complete', () => {
        runMain(['--path', gitignore, '--template', template]);
        const before = fs.readFileSync(gitignore, 'utf-8');
        const mtimeBefore = fs.statSync(gitignore).mtimeMs;
        const { rc, out } = runMain(['--path', gitignore, '--template', template]);
        expect(rc).toBe(0);
        expect(fs.readFileSync(gitignore, 'utf-8')).toBe(before);
        expect(fs.statSync(gitignore).mtimeMs).toBe(mtimeBefore);
        expect(out).toContain('already in sync');
    });

    it('sync appends missing entry to legacy block', () => {
        const existing =
            '/vendor/\n\n' +
            '# event4u/agent-config\n' +
            '# Agent config — symlinked\n' +
            '.augment/skills/\n' +
            '.augment/commands/\n' +
            '# Agent config — chat history\n' +
            '.agent-chat-history\n' +
            '.agent-chat-history.bak\n';
        fs.writeFileSync(gitignore, existing, 'utf-8');
        const { rc } = runMain(['--path', gitignore, '--template', template]);
        expect(rc).toBe(0);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).toContain('/agent-config');
        expect(text).toContain(sg.SECTION_FOOTER);
        expect(text.startsWith('/vendor/\n')).toBe(true);
    });

    it('sync preserves user-added lines inside block', () => {
        const existing =
            '# event4u/agent-config\n' +
            '# Agent config — symlinked\n' +
            '.augment/skills/\n' +
            '.augment/commands/\n' +
            'my-custom-entry.local\n' +
            '# event4u/agent-config — END\n';
        fs.writeFileSync(gitignore, existing, 'utf-8');
        const { rc } = runMain(['--path', gitignore, '--template', template]);
        expect(rc).toBe(0);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).toContain('my-custom-entry.local');
        expect(text).toContain('/agent-config');
        expect(text).toContain('.agent-chat-history');
    });

    it('sync replace mode rewrites block fully', () => {
        const existing =
            '# event4u/agent-config\n' +
            '# Agent config — symlinked\n' +
            '.augment/skills/\n' +
            'my-custom-entry.local\n' +
            'stale-entry\n' +
            '# event4u/agent-config — END\n';
        fs.writeFileSync(gitignore, existing, 'utf-8');
        const { rc } = runMain(['--path', gitignore, '--template', template, '--replace']);
        expect(rc).toBe(0);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).not.toContain('my-custom-entry.local');
        expect(text).not.toContain('stale-entry');
        expect(text).toContain('/agent-config');
        expect(text).toContain('.agent-chat-history');
    });

    it('sync dry-run prints diff without writing', () => {
        fs.writeFileSync(gitignore, '/vendor/\n', 'utf-8');
        const mtimeBefore = fs.statSync(gitignore).mtimeMs;
        const { rc, out, err } = runMain(['--path', gitignore, '--template', template, '--dry-run']);
        expect(rc).toBe(0);
        expect(fs.statSync(gitignore).mtimeMs).toBe(mtimeBefore);
        expect(out).toContain('# event4u/agent-config');
        expect(out).toContain('+/agents/.agent-chat-history');
        expect(err).toContain('(dry-run)');
    });

    it('sync creates gitignore when missing', () => {
        expect(fs.existsSync(gitignore)).toBe(false);
        const { rc } = runMain(['--path', gitignore, '--template', template]);
        expect(rc).toBe(0);
        expect(fs.statSync(gitignore).isFile()).toBe(true);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).toContain(sg.SECTION_HEADER);
        expect(text).toContain(sg.SECTION_FOOTER);
    });

    it('sync missing template returns 2', () => {
        const bogus = path.join(tmp, 'nope.txt');
        const { rc, err } = runMain(['--path', gitignore, '--template', bogus]);
        expect(rc).toBe(2);
        expect(err).toContain('template not found');
    });

    it('sync trims trailing newlines', () => {
        fs.writeFileSync(gitignore, '/vendor/\n\n\n', 'utf-8');
        runMain(['--path', gitignore, '--template', template]);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text.endsWith('\n') && !text.endsWith('\n\n')).toBe(true);
    });

    it('real config template works on package repo', () => {
        const def = sg.DEFAULT_TEMPLATE;
        expect(fs.statSync(def).isFile()).toBe(true);
        const lines = sg.load_template(def);
        const entries = sg.template_entries(lines);
        expect(entries.length).toBeGreaterThanOrEqual(5);
        expect(entries).toContain('/agents/.agent-chat-history');
    });

    // ---- cleanup-legacy ----

    it('cleanup_legacy removes root-level entries outside block', () => {
        const lines = ['/vendor/', '.agent-chat-history', '.agent-chat-history.bak', '.agent-prices.md', 'user-stuff/'];
        const [newLines, removed] = sg.cleanup_legacy(lines);
        expect(newLines).toEqual(['/vendor/', 'user-stuff/']);
        expect(new Set(removed)).toEqual(
            new Set(['.agent-chat-history', '.agent-chat-history.bak', '.agent-prices.md']),
        );
    });

    it('cleanup_legacy removes entries with leading slash', () => {
        const [newLines, removed] = sg.cleanup_legacy(['/.agent-chat-history', '/.agent-prices.md', '/vendor/']);
        expect(newLines).toEqual(['/vendor/']);
        expect(new Set(removed)).toEqual(new Set(['/.agent-chat-history', '/.agent-prices.md']));
    });

    it('cleanup_legacy preserves current managed paths', () => {
        const lines = [
            '/agents/.agent-chat-history',
            '/agents/.agent-chat-history.bak',
            '/agents/runtime/.agent-prices.md',
        ];
        const [newLines, removed] = sg.cleanup_legacy(lines);
        expect(newLines).toEqual(lines);
        expect(removed).toEqual([]);
    });

    it('cleanup_legacy strips intermediate prices path', () => {
        const [newLines, removed] = sg.cleanup_legacy(['/vendor/', '/agents/.agent-prices.md', 'user-stuff/']);
        expect(newLines).toEqual(['/vendor/', 'user-stuff/']);
        expect(removed).toEqual(['/agents/.agent-prices.md']);
    });

    it('cleanup_legacy strips budget-history paths', () => {
        const lines = [
            '/vendor/',
            '.augment-budget-history.jsonl',
            '.rule-budget-history.jsonl',
            '/agents/.augment-budget-history.jsonl',
            '/agents/.rule-budget-history.jsonl',
            'user-stuff/',
        ];
        const [newLines, removed] = sg.cleanup_legacy(lines);
        expect(newLines).toEqual(['/vendor/', 'user-stuff/']);
        expect(new Set(removed)).toEqual(
            new Set([
                '.augment-budget-history.jsonl',
                '.rule-budget-history.jsonl',
                '/agents/.augment-budget-history.jsonl',
                '/agents/.rule-budget-history.jsonl',
            ]),
        );
    });

    it('cleanup_legacy preserves comments and blanks', () => {
        const lines = [
            '# event4u/agent-config',
            '',
            '# Agent config — chat history',
            '.agent-chat-history',
            '',
            '# event4u/agent-config — END',
        ];
        const [newLines, removed] = sg.cleanup_legacy(lines);
        expect(newLines).toEqual([
            '# event4u/agent-config',
            '',
            '# Agent config — chat history',
            '',
            '# event4u/agent-config — END',
        ]);
        expect(removed).toEqual(['.agent-chat-history']);
    });

    it('cleanup_legacy noop when no legacy present', () => {
        const lines = ['/vendor/', '/node_modules/', '/agents/.agent-chat-history'];
        const [newLines, removed] = sg.cleanup_legacy(lines);
        expect(newLines).toEqual(lines);
        expect(removed).toEqual([]);
    });

    it('main cleanup-legacy strips outside block and syncs', () => {
        const existing =
            '/vendor/\n.agent-chat-history\n.agent-chat-history.bak\n.agent-prices.md\nuser-stuff/\n';
        fs.writeFileSync(gitignore, existing, 'utf-8');
        const { rc } = runMain(['--path', gitignore, '--template', template, '--cleanup-legacy']);
        expect(rc).toBe(0);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).not.toContain('\n.agent-chat-history\n');
        expect(text).not.toContain('\n.agent-chat-history.bak\n');
        expect(text).not.toContain('\n.agent-prices.md\n');
        expect(text).toContain('/agents/.agent-chat-history');
        expect(text).toContain('/agents/runtime/.agent-prices.md');
        expect(text).toContain(sg.SECTION_HEADER);
        expect(text).toContain(sg.SECTION_FOOTER);
        expect(text).toContain('/vendor/');
        expect(text).toContain('user-stuff/');
    });

    it('main cleanup-legacy strips inside block', () => {
        const existing =
            '# event4u/agent-config\n' +
            '# Agent config — chat history\n' +
            '.agent-chat-history\n' +
            '.agent-chat-history.bak\n' +
            '.agent-chat-history.*.bak\n' +
            '# event4u/agent-config — END\n';
        fs.writeFileSync(gitignore, existing, 'utf-8');
        const { rc } = runMain(['--path', gitignore, '--template', template, '--cleanup-legacy']);
        expect(rc).toBe(0);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).not.toContain('\n.agent-chat-history\n');
        expect(text).not.toContain('\n.agent-chat-history.bak\n');
        expect(text).toContain('/agents/.agent-chat-history');
    });

    it('main cleanup-legacy preserves user-added lines', () => {
        const existing = '/vendor/\n.agent-chat-history\nmy-custom-ignore.local\n';
        fs.writeFileSync(gitignore, existing, 'utf-8');
        const { rc } = runMain(['--path', gitignore, '--template', template, '--cleanup-legacy']);
        expect(rc).toBe(0);
        const text = fs.readFileSync(gitignore, 'utf-8');
        expect(text).toContain('my-custom-ignore.local');
        expect(text).not.toContain('\n.agent-chat-history\n');
    });

    it('main cleanup-legacy dry-run shows removed in diff', () => {
        fs.writeFileSync(gitignore, '.agent-chat-history\n.agent-prices.md\n', 'utf-8');
        const mtimeBefore = fs.statSync(gitignore).mtimeMs;
        const { rc, out, err } = runMain([
            '--path',
            gitignore,
            '--template',
            template,
            '--cleanup-legacy',
            '--dry-run',
        ]);
        expect(rc).toBe(0);
        expect(fs.statSync(gitignore).mtimeMs).toBe(mtimeBefore);
        expect(out).toContain('-.agent-chat-history');
        expect(err).toContain('would remove 2 legacy');
    });

    it('main cleanup-legacy noop when clean', () => {
        runMain(['--path', gitignore, '--template', template]);
        const mtimeBefore = fs.statSync(gitignore).mtimeMs;
        const { rc } = runMain(['--path', gitignore, '--template', template, '--cleanup-legacy']);
        expect(rc).toBe(0);
        expect(fs.statSync(gitignore).mtimeMs).toBe(mtimeBefore);
    });
});
const COMMITTED_GITIGNORE = path.join(REPO_ROOT, '.gitignore');
