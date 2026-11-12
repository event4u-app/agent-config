import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { InstallProgress, deployedToolLines, tildePath, versionHeadline } from '../../src/install/installProgress.js';

const ctx = {
    anchors: { 'claude-code': '~/.claude/', cursor: '~/.cursor/', kiro: '~/.kiro/' },
    claudeDesktopBundlesDir: () => '/h/.event4u/agent-config/claude-desktop/bundles',
    exportHint: (id: string) => `agent-config export --tool=${id}`,
};

describe('installProgress — what an install shows by default', () => {
    it('names the version change, or says it is new', () => {
        expect(versionHeadline(null, '2.0.0')).toBe('agent-config 2.0.0 — new install');
        expect(versionHeadline('1.0.0', '2.0.0')).toBe('agent-config 1.0.0 → 2.0.0');
        expect(versionHeadline('2.0.0', '2.0.0')).toBe('agent-config 2.0.0 — reinstall');
    });

    it('one line per tool, for every deploy outcome', () => {
        const lines = deployedToolLines(
            {
                cursor: [377, 0, 'deployed'],
                'claude-desktop': [5, 0, 'deployed'],
                aider: [0, 0, 'hint'],
                kiro: [1, 0, 'marker'],
                zz: [0, 0, 'unsupported'],
            },
            ctx,
        );
        expect(lines).toEqual([
            'aider           → no user-scope convention; per project: `agent-config export --tool=aider`',
            'claude-desktop  → /h/.event4u/agent-config/claude-desktop/bundles (5 bundles)',
            'cursor          → ~/.cursor/ (377 files, 0 skipped)',
            'kiro            → ~/.kiro/agent-config.md (written)',
            'zz              → no global-scope content yet (project-scope install supported)',
        ]);
    });

    it('tildePath shortens only paths under home', () => {
        expect(tildePath('/home/u/.event4u', '/home/u')).toBe('~/.event4u');
        expect(tildePath('/home/user2/x', '/home/u')).toBe('/home/user2/x');
        expect(tildePath(path.join(os.homedir(), 'a'))).toBe(`~${path.sep}a`);
    });

    it('a whole run: headline, one step per tool, then where it went', () => {
        let out = '';
        let t = 0;
        const p = new InstallProgress({ from: '1.0.0', to: '2.0.0', tools: 2, out: { write: (s) => void (out += s) }, tty: false, now: () => t });
        p.tool('claude-code');
        p.tool('cursor');
        p.finishing();
        t = 2500;
        p.done({
            to: '2.0.0',
            root: '/root/.event4u/agent-config',
            results: { 'claude-code': [10, 0, 'deployed'], cursor: [3, 0, 'deployed'] },
            ctx,
            now: () => t,
        });
        expect(out.split('\n')).toEqual([
            'agent-config 1.0.0 → 2.0.0',
            '  [1/4] preparing …',
            '  [2/4] deploying to claude-code …',
            '  [3/4] deploying to cursor …',
            '  [4/4] finishing …',
            '  Installed to: /root/.event4u/agent-config',
            '  AI tools (2):',
            '    claude-code     → ~/.claude/ (10 files, 0 skipped)',
            '    cursor          → ~/.cursor/ (3 files, 0 skipped)',
            '✅  agent-config 2.0.0 ready (2.5 s). Full report: add --verbose.',
            '',
        ]);
    });
});
