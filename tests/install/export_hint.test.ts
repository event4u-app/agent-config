/**
 * A global install writes nothing for copilot / aider / zed / jetbrains and
 * prints an `agent-config export` command instead. That command is the whole
 * deliverable, so this runs it exactly as printed — it used to name a tool id
 * `export` does not know (`copilot`) and omit the `--output` it requires.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { GLOBAL_HINT_TOOLS, exportHintCommand } from '../../src/install/exportHint.js';
import { main } from '../../src/scripts/_cli/cmd_export.js';
import { runInProc } from '../_lib/run_in_process.js';

const roots: string[] = [];
afterEach(() => {
    while (roots.length) fs.rmSync(roots.pop() as string, { recursive: true, force: true });
});

describe('global-install export hint', () => {
    it('is null for a tool that gets real files', () => {
        expect(exportHintCommand('claude-code')).toBeNull();
    });

    for (const tool of GLOBAL_HINT_TOOLS) {
        it(`prints a command for ${tool} that export runs and that writes a file`, () => {
            const cmd = exportHintCommand(tool);
            expect(cmd).not.toBeNull();
            const argv = (cmd as string).split(/\s+/);
            expect(argv.slice(0, 2)).toEqual(['agent-config', 'export']);

            const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'achint-'));
            roots.push(cwd);
            const res = runInProc(main, argv.slice(2), { cwd });
            expect(res.stderr).toBe('');
            expect(res.status).toBe(0);

            const output = argv.find((a) => a.startsWith('--output='))?.slice('--output='.length);
            expect(output, 'printed command names no --output').toBeDefined();
            expect(fs.statSync(path.join(cwd, output as string)).size).toBeGreaterThan(0);
        });
    }
});
