// The web-launch rows through the shipped path: host payload → bundled dispatcher →
// in-process design-pass concern → conditional chunk → host emission. The unit tests
// call `scanWebLaunch` directly and cannot see the dispatcher's envelope, which is
// exactly where the concern once lost the written file path for every write.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE = path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js');
const CORPUS = path.join(REPO_ROOT, 'tests', 'fixtures', 'third-party-load');

const tmpDirs: string[] = [];
afterEach(() => {
    while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

function workspaceWith(rel: string, fixture: string): string {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'wl-dispatch-'));
    tmpDirs.push(ws);
    fs.writeFileSync(path.join(ws, '.agent-settings.yml'), 'hooks:\n  design_pass:\n    enabled: true\n');
    fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
    fs.copyFileSync(path.join(CORPUS, fixture), path.join(ws, rel));
    return ws;
}

function dispatchWrite(ws: string, rel: string): string {
    const r = spawnSync(process.execPath, [BUNDLE, '--platform', 'claude', '--event', 'post_tool_use', '--project-dir', ws], {
        encoding: 'utf-8',
        cwd: ws,
        input: JSON.stringify({ session_id: 'wl-dispatch', tool_name: 'Write', tool_input: { file_path: rel } }),
        timeout: 60_000,
    });
    expect(r.status, r.stderr).toBe(0);
    const out = r.stdout.trim();
    if (!out) return '';
    return String((JSON.parse(out) as { hookSpecificOutput?: { additionalContext?: string } }).hookSpecificOutput?.additionalContext ?? '');
}

const webLaunchLines = (ctx: string): string[] => ctx.split('\n').filter((l) => l.includes('[P2 web-launch]'));

describe('a written page reaches the agent through the bundled dispatcher', () => {
    it('a page loading Google Fonts surfaces both loads, with file and line', () => {
        const ws = workspaceWith('site/index.html', 'planted/index.html');
        const lines = webLaunchLines(dispatchWrite(ws, 'site/index.html'));
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/site\/index\.html:6 — <link rel="preconnect"> loads `fonts\.gstatic\.com`/);
        expect(lines[1]).toMatch(/site\/index\.html:7 — <link rel="stylesheet"> loads `fonts\.googleapis\.com`/);
    });

    it('a stylesheet @import of the provider surfaces line 1', () => {
        const ws = workspaceWith('site/css/site.css', 'planted/css/site.css');
        const lines = webLaunchLines(dispatchWrite(ws, 'site/css/site.css'));
        expect(lines.map((l) => /site\.css:(\d+)/.exec(l)?.[1])).toEqual(['1']);
    });

    it('the safe twin surfaces no web-launch row, and the pass did not degrade for it', () => {
        const ws = workspaceWith('site/index.html', 'safe/index.html');
        const ctx = dispatchWrite(ws, 'site/index.html');
        expect(webLaunchLines(ctx)).toEqual([]);
        expect(ctx).not.toMatch(/web-launch rows not run/);
    });

    it('no size lets a load go unreported: a page padded past 4,000,000 characters, before or after its loads, still surfaces both', () => {
        const pad = `<!--${'x'.repeat(4_000_001)}-->`;
        for (const wrap of [(p: string) => p + pad, (p: string) => pad + p]) {
            // A fresh workspace each: the pass never re-surfaces a finding it already reported.
            const ws = workspaceWith('site/index.html', 'planted/index.html');
            const abs = path.join(ws, 'site/index.html');
            fs.writeFileSync(abs, wrap(fs.readFileSync(abs, 'utf-8')));
            const ctx = dispatchWrite(ws, 'site/index.html');
            expect(webLaunchLines(ctx)).toHaveLength(2);
            expect(ctx).not.toMatch(/web-launch rows not run/);
        }
    });
});
