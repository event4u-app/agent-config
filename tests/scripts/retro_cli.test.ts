/**
 * `agent-config retro` — the `<retro-queue>` line's instruction made runnable in
 * a consumer install (#2994). A consumer has no `./scripts-run` and no tsx, so
 * the verb must route through a `_cli/cmd_*` entry the delegate bundle covers.
 * The usage refusal proves the wiring end to end without a forge call.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { build } from 'esbuild';

import { describe, expect, it } from 'vitest';

import { findCommand } from '../../src/cli/registry.js';
import { queueLine } from '../../src/scripts/retro_queue.js';

const ROOT = process.cwd();
const DISPATCH = path.join(ROOT, 'src/scripts/_dispatch.bash');
const WRAPPER = path.join(ROOT, 'src/scripts/_cli/cmd_retro.ts');

function countUsage(out: string): number {
    return out.split('usage: retro').length - 1;
}

describe('retro verb', () => {
    it('is registered for --help', () => {
        expect(findCommand('retro')?.disposition).toBe('delegate');
    });

    it('the dispatcher routes retro to the reader', () => {
        const r = spawnSync('bash', [DISPATCH, 'retro', '--no-such-form'], { encoding: 'utf8', timeout: 60_000 });
        expect(r.status).toBe(2);
        expect(countUsage(r.stdout)).toBe(1);
    });

    it('the wrapper runs the reader exactly once', () => {
        const r = spawnSync(process.execPath, ['--import', 'tsx', WRAPPER, '--no-such-form'], { encoding: 'utf8', timeout: 60_000 });
        expect(r.status).toBe(2);
        expect(countUsage(r.stdout)).toBe(1);
    });

    // The consumer runs the delegate bundle, not the source. Every module the
    // bundle inlines shares its `import.meta.url`, so an inlined script with an
    // unguarded entry check (memory_signal, knowledge_global_redaction, …) ran
    // ITS main first and the retro never answered.
    it('the delegate bundle answers as the retro, not as a module it inlines', async () => {
        const out = fs.mkdtempSync(path.join(os.tmpdir(), 'retro-bundle-'));
        try {
            await build({
                entryPoints: [WRAPPER],
                bundle: true,
                splitting: true,
                platform: 'node',
                format: 'esm',
                target: 'node20',
                define: { __AGENT_CONFIG_BUNDLE__: 'true', __AGENT_CONFIG_CLI_DELEGATE__: 'true' },
                outdir: out,
                banner: {
                    js: "import { createRequire as __acCreateRequire } from 'node:module'; const require = globalThis.require ?? __acCreateRequire(import.meta.url);",
                },
                logLevel: 'silent',
            });
            const r = spawnSync(process.execPath, [path.join(out, 'cmd_retro.js'), '--no-such-form'], {
                cwd: out,
                encoding: 'utf8',
                timeout: 60_000,
            });
            expect(r.stderr).not.toMatch(/^usage: (?!retro)/m);
            expect(r.status).toBe(2);
            expect(countUsage(r.stdout)).toBe(1);
        } finally {
            fs.rmSync(out, { recursive: true, force: true });
        }
    }, 60_000);

    it('the queue line and every /retro surface name the verb, never the dev-tree runner', () => {
        expect(queueLine([{ unit_key: 'k', kind: 'pr', pr: 1, enqueued_at: '2026-10-21T10:00:00Z' }])).toContain(
            '`agent-config retro`',
        );
        for (const rel of [
            'src/domains/meta/retro/command.md',
            'src/domains/meta/memory/propose/command.md',
            'src/domains/git/pr/merge/command.md',
        ]) {
            const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
            expect(text, rel).not.toContain('scripts-run src/scripts/retro');
            expect(text, rel).toContain('agent-config retro');
        }
    });
});
