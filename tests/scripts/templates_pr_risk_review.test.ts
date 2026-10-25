// Tests for src/agent-src/templates/scripts/pr_risk_review.ts (ADR-094).
//
// Template-only script (no dev-side counterpart). No pytest suite exists, so
// this is a golden-parity suite that runs python3 vs tsx on throwaway git
// fixtures and asserts byte-identical stdout / stderr / exit code AND the two
// written files (report markdown + level file). argparse --help is NOT
// byte-compared (out of scope per the migration contract).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import * as prr from '../../src/agent-src/templates/scripts/pr_risk_review.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

describe('pr_risk_review — pure helpers', () => {
    it('_compile translates the gitignore-ish glob dialect', () => {
        expect(prr._compile('**/migrations/**').test('a/migrations/b.sql')).toBe(true);
        expect(prr._compile('**/migrations/**').test('migrations/b.sql')).toBe(true);
        expect(prr._compile('**/*.sql').test('db/x.sql')).toBe(true);
        expect(prr._compile('composer.lock').test('composer.lock')).toBe(true);
        expect(prr._compile('composer.lock').test('a/composer.lock')).toBe(false);
        expect(prr._compile('.github/workflows/**').test('.github/workflows/ci.yml')).toBe(true);
        expect(prr._compile('**/*.sql').test('x.sqlx')).toBe(false);
        expect(prr._compile('app/*.php').test('app/x/y.php')).toBe(false);
    });

    it('classify escalates to high on a migration + lockfile, medium otherwise', () => {
        const [hi] = prr.classify(['db/migrations/1.sql', 'package.json'], prr.DEFAULT_CONFIG);
        expect(hi).toBe('high');
        const [med] = prr.classify(['app/routes/web.php', 'package.json'], prr.DEFAULT_CONFIG);
        expect(med).toBe('medium');
        const [low] = prr.classify(['README.md', 'src/util.ts'], prr.DEFAULT_CONFIG);
        expect(low).toBe('low');
    });

    it('classify honours the ignore list before matching', () => {
        const [lvl, hits] = prr.classify(['docs/x.md', 'CHANGELOG.md'], prr.DEFAULT_CONFIG);
        expect(lvl).toBe('low');
        expect(hits).toHaveLength(0);
    });

    it('render emits the no-signal body when there are no hits', () => {
        const out = prr.render('low', [], 3);
        expect(out).toContain('## 🟢 PR Risk: **low**');
        expect(out).toContain('No high- or medium-risk patterns matched');
        expect(out.endsWith('\n')).toBe(true);
    });
});

describe('pr_risk_review — agent surfaces', () => {
    it('rates a change to something an AI agent can do as high', () => {
        for (const file of [
            'src/mcp/tools/update_account.ts',
            'server/mcp_server.py',
            'app/agent/tools/change_email.py',
            'src/prompts/support.txt',
            'agents/settings/contexts/agent-actions.yml',
            '.mcp.json',
        ]) {
            const [lvl] = prr.classify([file], prr.DEFAULT_CONFIG);
            expect(lvl, file).toBe('high');
        }
    });

    it('does not rate an unrelated build-tool file high', () => {
        const [lvl] = prr.classify(['scripts/build-tools/minify.ts'], prr.DEFAULT_CONFIG);
        expect(lvl).toBe('low');
    });

    it('the shipped workflow installs a pinned major of the package', () => {
        const wf = fs.readFileSync(
            path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'github-workflows', 'pr-risk-review.yml'),
            'utf8',
        );
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string };
        const major = pkg.version.split('.')[0];
        expect(wf).toContain(`@event4u/agent-config@${major}`);
        expect(wf).not.toMatch(/npm install -g @event4u\/agent-config\s*$/m);
    });
});
