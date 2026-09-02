/**
 * Polarity for the write-time comment-discipline concern.
 *
 * The delivery half matters as much as the detection half: a concern that
 * fires with the wrong exit code either blocks a tool call it must never
 * block, or is silently dropped. Both directions are pinned here.
 */
import { describe, expect, it } from 'vitest';

import { buildAdvisoryLine, main, writtenText, MAX_REPORTED } from '../../src/scripts/hooks/comment_discipline_hook.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
import { scanText } from '../../src/scripts/lint_code_comments.js';

const run = (payload: unknown): { rc: number; out: string } => {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let out = '';
    // @ts-expect-error — narrow write swap, restored below
    process.stdout.write = (chunk: string) => { out += chunk; return true; };
    setHookStdinOverride(JSON.stringify(payload));
    try {
        return { rc: main(), out };
    } finally {
        process.stdout.write = originalWrite;
        clearHookStdinOverride();
    }
};

const envelope = (toolName: string, filePath: string, body: Record<string, string>) => ({
    schema_version: 1,
    platform: 'claude',
    event: 'post_tool_use',
    workspace_root: '/tmp/ws',
    payload: { tool_name: toolName, tool_input: { file_path: filePath, ...body } },
});

describe('payload extraction', () => {
    it('reads Write content', () => {
        expect(writtenText('Write', { content: 'x' })).toBe('x');
    });
    it('reads Edit new_string', () => {
        expect(writtenText('Edit', { new_string: 'y' })).toBe('y');
    });
    it('returns empty for a tool it does not handle', () => {
        expect(writtenText('Read', { content: 'x' })).toBe('');
    });
});

describe('fires', () => {
    it('warns at exit 2 on German comment content in a Write', () => {
        const r = run(envelope('Write', 'src/a.ts', {
            content: '// Hier stehen nur die Werte, die Bedeutung tragen\nconst a = 1;\n',
        }));
        expect(r.rc).toBe(2);
        expect(JSON.parse(r.out.trim()).decision).toBe('warn');
    });

    it('warns on an Edit that introduces a provenance comment', () => {
        const r = run(envelope('Edit', 'src/a.css', {
            new_string: '/* see agents/roadmaps/todos-task-module-frontend.md */\n',
        }));
        expect(r.rc).toBe(2);
        expect(JSON.parse(r.out.trim()).additional_context).toContain('provenance-comment');
    });
});

describe('stays silent', () => {
    it('on English comment content', () => {
        expect(run(envelope('Write', 'src/a.ts', { content: '// the cap is a stated default\n' })).rc).toBe(0);
    });
    it('on a markdown file', () => {
        expect(run(envelope('Write', 'docs/a.md', { content: '// Hier stehen die Werte und mehr\n' })).rc).toBe(0);
    });
    it('on a declaration file', () => {
        expect(run(envelope('Write', 'src/a.d.ts', { content: '// Hier stehen die Werte und mehr\n' })).rc).toBe(0);
    });
    it('on a tool that is neither Write nor Edit', () => {
        expect(run(envelope('Read', 'src/a.ts', { content: '// Hier stehen die Werte und mehr\n' })).rc).toBe(0);
    });
    it('on a malformed payload', () => {
        expect(run({ nonsense: true }).rc).toBe(0);
    });
    it('on a wrong event', () => {
        const e = envelope('Write', 'src/a.ts', { content: '// Hier stehen die Werte und mehr\n' });
        expect(run({ ...e, event: 'pre_tool_use' }).rc).toBe(0);
    });
});

describe('advisory line', () => {
    it('names at most MAX_REPORTED findings and counts the rest', () => {
        const src = Array.from({ length: 7 }, () => '// Hier stehen nur die Werte und mehr').join('\n');
        const line = buildAdvisoryLine('src/a.ts', scanText('src/a.ts', src));
        expect(line).toContain(`+${7 - MAX_REPORTED} more`);
        expect(line).toContain('src/a.ts');
    });
});
