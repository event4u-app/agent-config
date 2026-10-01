/**
 * The shadow quality pass wired into `verify-before-complete`
 * (`road-to-touched-files-that-pass-their-own-tools` 1.2, 1.3, 2.2).
 *
 * THE TOOLCHAIN IS REAL AND LOCAL. The fixture is a PHP-shaped project whose
 * `vendor/bin/phpstan` and `vendor/bin/pint` are shell scripts this file writes,
 * so `resolve_toolchain` detects them exactly as it would detect the real ones
 * and the exit codes are whatever the fixture chooses. No network, no installed
 * toolchain, and — the point — no stub standing in for the resolver: the
 * resolver runs, and what it resolves is what the pass executes.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    readTouchedFileQualityMode,
    run,
    statePathFor,
} from '../../src/scripts/before_complete_hook.js';

const SESSION = 'quality-session';

let tmp: string;
const stderrWrite = process.stderr.write.bind(process.stderr);
let captured: string[] = [];

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-quality-'));
    captured = [];
});

afterEach(() => {
    process.stderr.write = stderrWrite;
});

function captureStderr(): void {
    captured = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.stderr as any).write = (chunk: unknown): boolean => {
        captured.push(String(chunk));
        return true;
    };
}

/** A PHP project whose two quality tools are scripts with a chosen exit code. */
function seedProject(opts: {
    mode?: string;
    phpstanExit?: number;
    touched?: readonly string[];
    sessionIdInRecorder?: string;
}): void {
    const mode = opts.mode;
    if (mode !== undefined) {
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            `hooks:\n  verify_before_complete:\n    touched_file_quality: "${mode}"\n`,
            'utf-8',
        );
    }

    fs.writeFileSync(
        path.join(tmp, 'composer.json'),
        JSON.stringify({ 'require-dev': { 'phpstan/phpstan': '^1.0', 'laravel/pint': '^1.0' } }),
        'utf-8',
    );
    fs.mkdirSync(path.join(tmp, 'vendor', 'bin'), { recursive: true });
    fs.writeFileSync(
        path.join(tmp, 'vendor', 'bin', 'phpstan'),
        `#!/bin/sh\necho "phpstan: 1 error"\nexit ${String(opts.phpstanExit ?? 1)}\n`,
        { encoding: 'utf-8', mode: 0o755 },
    );
    // Writes when invoked WITHOUT --test, exactly like the real tool. The
    // no-mutation assertion below is what this exists for.
    fs.writeFileSync(
        path.join(tmp, 'vendor', 'bin', 'pint'),
        '#!/bin/sh\nfor a in "$@"; do [ "$a" = "--test" ] && exit 0; done\n' +
            'for a in "$@"; do case "$a" in --*) ;; *) echo "REWRITTEN" > "$a";; esac; done\nexit 0\n',
        { encoding: 'utf-8', mode: 0o755 },
    );

    const touched = opts.touched ?? ['Foo.php'];
    for (const f of touched) {
        fs.mkdirSync(path.join(tmp, path.dirname(f)), { recursive: true });
        fs.writeFileSync(path.join(tmp, f), '<?php\nclass Foo {}\n', 'utf-8');
    }

    // The working tree has to agree that these files changed — risk 4's second
    // narrowing. An untracked file is a change `git status --porcelain` reports.
    spawnSync('git', ['init', '-q'], { cwd: tmp });

    fs.mkdirSync(path.join(tmp, 'agents', 'state'), { recursive: true });
    fs.writeFileSync(
        path.join(tmp, 'agents', 'state', 'minimal-safe-diff.json'),
        JSON.stringify({
            session_id: opts.sessionIdInRecorder ?? SESSION,
            files_touched_this_turn: [...touched],
        }),
        'utf-8',
    );
}

function fire(event: string, payload: Record<string, unknown> = {}): number {
    return run(JSON.stringify({ event, session_id: SESSION, payload }), { consumer_root: tmp });
}

function state(): Record<string, unknown> {
    return JSON.parse(
        fs.readFileSync(path.join(tmp, statePathFor(SESSION)), 'utf8'),
    ) as Record<string, unknown>;
}

function qualityRuns(): Record<string, unknown>[] {
    const runs = state()['quality_runs'];
    return Array.isArray(runs) ? (runs as Record<string, unknown>[]) : [];
}

describe('readTouchedFileQualityMode — fail-closed on the flag', () => {
    it.each([
        ['no settings file at all', undefined, 'off'],
        ['the key absent', 'hooks:\n  injection_scan:\n    enabled: true\n', 'off'],
        ['an unrecognised value', 'hooks:\n  verify_before_complete:\n    touched_file_quality: "loud"\n', 'off'],
        ['shadow', 'hooks:\n  verify_before_complete:\n    touched_file_quality: "shadow"\n', 'shadow'],
        ['warn', 'hooks:\n  verify_before_complete:\n    touched_file_quality: "warn"\n', 'warn'],
    ])('%s resolves to %s', (_label, yml, expected) => {
        if (yml !== undefined) fs.writeFileSync(path.join(tmp, '.agent-settings.yml'), yml, 'utf-8');
        expect(readTouchedFileQualityMode(tmp)).toBe(expected);
    });

    it('does not read a sibling hooks section under this key', () => {
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'hooks:\n  other_section:\n    touched_file_quality: "warn"\n' +
                '  verify_before_complete:\n    something_else: 1\n',
            'utf-8',
        );
        expect(readTouchedFileQualityMode(tmp)).toBe('off');
    });

    it('ships "off" as the template default', () => {
        const template = fs.readFileSync(
            path.join(process.cwd(), 'src/config/agent-settings.template.yml'),
            'utf-8',
        );
        expect(template).toMatch(/touched_file_quality:\s*"off"/);
    });
});

describe('1.2 — shadow records, and the exit code never moves', () => {
    it('writes quality_runs[0].exit_code = 1 for a failing check and exits 0', () => {
        seedProject({ mode: 'shadow', phpstanExit: 1 });
        expect(fire('user_prompt_submit')).toBe(0);
        expect(fire('stop')).toBe(0);

        const runs = qualityRuns();
        const phpstan = runs.find((r) => r['source_command'] === 'vendor/bin/phpstan analyse');
        expect(phpstan).toBeDefined();
        expect(phpstan?.['exit_code']).toBe(1);
        expect(phpstan?.['skipped']).toBeNull();
        expect(phpstan?.['output_head']).toContain('phpstan: 1 error');
    });

    it('records the path source so a cross-session read is auditable', () => {
        seedProject({ mode: 'shadow' });
        fire('user_prompt_submit');
        fire('stop');
        expect(state()['quality_files_source']).toBe('minimal-safe-diff∩worktree');
    });

    it('records nothing but the source when the recorder belongs to another session', () => {
        seedProject({ mode: 'shadow', sessionIdInRecorder: 'somebody-else' });
        fire('user_prompt_submit');
        expect(fire('stop')).toBe(0);
        expect(qualityRuns()).toEqual([]);
        expect(state()['quality_files_source']).toBe('none');
    });

    it('emits no advisory line in shadow, however red the check', () => {
        seedProject({ mode: 'shadow', phpstanExit: 2 });
        fire('user_prompt_submit');
        captureStderr();
        expect(fire('stop')).toBe(0);
        expect(captured.join('')).toBe('');
    });

    it('never rewrites a touched file — pint runs only in its --test form', () => {
        seedProject({ mode: 'shadow' });
        const before = fs.readFileSync(path.join(tmp, 'Foo.php'), 'utf-8');
        fire('user_prompt_submit');
        fire('stop');
        expect(fs.readFileSync(path.join(tmp, 'Foo.php'), 'utf-8')).toBe(before);
        const pint = qualityRuns().find((r) => r['source_command'] === 'vendor/bin/pint');
        expect(pint?.['command']).toContain('--test');
    });
});

describe('acceptance — with the pass off, the record is the base-ref record', () => {
    it('writes no quality key and exits 0', () => {
        seedProject({ mode: 'off', phpstanExit: 1 });
        expect(fire('user_prompt_submit')).toBe(0);
        expect(fire('stop')).toBe(0);
        expect(Object.keys(state())).not.toContain('quality_runs');
        expect(Object.keys(state())).not.toContain('quality_files_source');
    });

    it('writes no quality key when no settings file exists at all', () => {
        seedProject({ phpstanExit: 1 });
        fire('user_prompt_submit');
        expect(fire('stop')).toBe(0);
        expect(Object.keys(state())).not.toContain('quality_runs');
    });

    it('a turn boundary clears the keys, restoring the base-ref shape', () => {
        seedProject({ mode: 'shadow' });
        fire('user_prompt_submit');
        fire('stop');
        expect(Object.keys(state())).toContain('quality_runs');
        fire('user_prompt_submit');
        expect(Object.keys(state())).not.toContain('quality_runs');
        expect(Object.keys(state())).not.toContain('quality_files_source');
    });
});

describe('1.3 — a quality run is not verification', () => {
    it('quality run is not verification: a clean check leaves verified_this_turn false', () => {
        seedProject({ mode: 'shadow', phpstanExit: 0 });
        fire('user_prompt_submit');
        fire('stop');

        // The pass ran and came back green…
        const phpstan = qualityRuns().find((r) => r['source_command'] === 'vendor/bin/phpstan analyse');
        expect(phpstan?.['exit_code']).toBe(0);

        // …and none of the verification surface moved.
        expect(state()['verified_this_turn']).toBe(false);
        expect(state()['verifications_this_turn']).toBe(0);
        expect(state()['verification_runs']).toEqual([]);
    });

    it('quality run is not verification: the two arrays never share a row', () => {
        seedProject({ mode: 'shadow', phpstanExit: 0 });
        fire('user_prompt_submit');
        // A real verification in the same turn, so both arrays are non-empty and
        // the assertion is about separation rather than about emptiness.
        fire('post_tool_use', {
            tool_name: 'Bash',
            tool_input: { command: 'npx vitest run' },
            tool_response: '3 passed',
        });
        fire('stop');

        const verification = state()['verification_runs'];
        expect(Array.isArray(verification) && verification.length).toBeGreaterThan(0);
        expect(qualityRuns().length).toBeGreaterThan(0);
        const qualityCommands = new Set(qualityRuns().map((r) => r['command']));
        for (const v of verification as Record<string, unknown>[]) {
            expect(qualityCommands.has(v['command'])).toBe(false);
        }
    });

    it('quality run is not verification: tsc recorded by this module sets nothing', () => {
        // The sharpest form of the negative: `npx tsc --noEmit` IS a verification
        // command to the classifier. Recorded by the quality pass it must still
        // leave the verification surface untouched, because the pass never routes
        // through `_extract_command` at all.
        fs.writeFileSync(
            path.join(tmp, '.agent-settings.yml'),
            'hooks:\n  verify_before_complete:\n    touched_file_quality: "shadow"\n',
            'utf-8',
        );
        fs.writeFileSync(
            path.join(tmp, 'package.json'),
            JSON.stringify({ devDependencies: { typescript: '^5' } }),
            'utf-8',
        );
        fs.writeFileSync(path.join(tmp, 'a.ts'), 'export const a = 1;\n', 'utf-8');
        spawnSync('git', ['init', '-q'], { cwd: tmp });
        fs.mkdirSync(path.join(tmp, 'agents', 'state'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, 'agents', 'state', 'minimal-safe-diff.json'),
            JSON.stringify({ session_id: SESSION, files_touched_this_turn: ['a.ts'] }),
            'utf-8',
        );

        fire('user_prompt_submit');
        fire('stop');

        const tsc = qualityRuns().find((r) => r['source_command'] === 'npx tsc --noEmit');
        expect(tsc?.['skipped']).toBe('unscoped');
        expect(state()['verified_this_turn']).toBe(false);
        expect(state()['verifications_this_turn']).toBe(0);
    });
});

describe('2.2 — warn emits exactly one advisory line and never blocks', () => {
    it('one line, at most 200 bytes, naming the command and the file, exit 0', () => {
        seedProject({ mode: 'warn', phpstanExit: 1 });
        fire('user_prompt_submit');
        captureStderr();
        const code = fire('stop');
        process.stderr.write = stderrWrite;

        expect(code).toBe(0);
        const lines = captured.join('').split('\n').filter((l) => l !== '');
        expect(lines).toHaveLength(1);
        const line = lines[0] ?? '';
        expect(Buffer.byteLength(line, 'utf-8')).toBeLessThanOrEqual(200);
        expect(line).toContain('vendor/bin/phpstan analyse');
        expect(line).toContain('Foo.php');
    });

    it('says nothing when every check is green', () => {
        seedProject({ mode: 'warn', phpstanExit: 0 });
        fire('user_prompt_submit');
        captureStderr();
        expect(fire('stop')).toBe(0);
        process.stderr.write = stderrWrite;
        expect(captured.join('').trim()).toBe('');
    });

    it('still records the runs — warn is shadow plus a line, not instead of it', () => {
        seedProject({ mode: 'warn', phpstanExit: 1 });
        fire('user_prompt_submit');
        captureStderr();
        fire('stop');
        process.stderr.write = stderrWrite;
        expect(qualityRuns().length).toBeGreaterThan(0);
    });
});
