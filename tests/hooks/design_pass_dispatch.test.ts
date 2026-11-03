// The design pass through the shipped path: host payload → bundled dispatcher →
// in-process design-pass concern → host emission. The unit tests call targetPath
// directly and cannot see the dispatcher's envelope, which is where the concern
// once lost the written file path for every dispatched write.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BUNDLE = path.join(REPO_ROOT, 'dist', 'hooks', 'dispatch.js');

const tmpDirs: string[] = [];
afterEach(() => {
    while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

const GRADIENT_TEXT = '.title {\n  background: linear-gradient(90deg, red, blue);\n  background-clip: text;\n}\n';

function dispatchWrite(rel: string, content: string): string {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-dispatch-'));
    tmpDirs.push(ws);
    fs.writeFileSync(path.join(ws, '.agent-settings.yml'), 'hooks:\n  design_pass:\n    enabled: true\n');
    fs.mkdirSync(path.dirname(path.join(ws, rel)), { recursive: true });
    fs.writeFileSync(path.join(ws, rel), content);
    const r = spawnSync(process.execPath, [BUNDLE, '--platform', 'claude', '--event', 'post_tool_use', '--project-dir', ws], {
        encoding: 'utf-8',
        cwd: ws,
        input: JSON.stringify({ session_id: 'dp-dispatch', tool_name: 'Write', tool_input: { file_path: rel } }),
        timeout: 60_000,
    });
    expect(r.status, r.stderr).toBe(0);
    const out = r.stdout.trim();
    if (!out) return '';
    return String((JSON.parse(out) as { hookSpecificOutput?: { additionalContext?: string } }).hookSpecificOutput?.additionalContext ?? '');
}

describe.runIf(fs.existsSync(BUNDLE))('a written stylesheet reaches the design pass through the bundled dispatcher', () => {
    it('gradient text surfaces its rule with file and line', () => {
        expect(dispatchWrite('site/css/site.css', GRADIENT_TEXT)).toMatch(/site\/css\/site\.css:1\b.*C2|C2.*site\/css\/site\.css:1\b/);
    });

    it('a minified megabyte stylesheet is scanned within one hook timeout', () => {
        const big = 'a{color:red}'.repeat(90_000) + GRADIENT_TEXT.replace(/\n/g, '');
        const t = Date.now();
        expect(dispatchWrite('site/css/big.css', big)).toMatch(/C2/);
        expect(Date.now() - t).toBeLessThan(10_000);
    });
});
