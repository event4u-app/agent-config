// Tests for src/scripts/hooks/block_plumbing_writes.ts — the build-output half
// of "one mechanism per file class"
// (road-to-a-kernel-that-guards-its-plumbing 1.2).
//
// Both polarities throughout. A guard over two named files is trivially easy to
// write so that it refuses everything under `dist/`, which would satisfy every
// refusal test and wedge every ordinary build. The accepting cases are what pin
// the boundary, and the legitimate-build cases are what make `fail_closed: true`
// safe to declare.
import { describe, expect, it } from 'vitest';

import {
    check_envelope,
    PLUMBING_BUILD_OUTPUTS,
    targets_plumbing_output,
} from '../../../src/scripts/hooks/block_plumbing_writes.js';

const write = (file_path: string): Record<string, unknown> => ({
    payload: { tool_name: 'Write', tool_input: { file_path } },
});
const bash = (command: string): Record<string, unknown> => ({
    payload: { tool_name: 'Bash', tool_input: { command } },
});

describe('block_plumbing_writes — targets_plumbing_output', () => {
    it('matches each declared build output, repo-relative', () => {
        for (const output of PLUMBING_BUILD_OUTPUTS) {
            expect(targets_plumbing_output(output), output).toBe(output);
        }
    });

    it('matches under any parent, because a consumer install has its own root', () => {
        expect(targets_plumbing_output('/home/me/proj/dist/hooks/dispatch.js')).toBe(
            'dist/hooks/dispatch.js',
        );
        expect(targets_plumbing_output('./hooks/hooks.json')).toBe('hooks/hooks.json');
        expect(targets_plumbing_output('../../dist/hooks/dispatch.js')).toBe(
            'dist/hooks/dispatch.js',
        );
    });

    it('normalizes backslashes rather than missing a Windows path', () => {
        expect(targets_plumbing_output('dist\\hooks\\dispatch.js')).toBe('dist/hooks/dispatch.js');
    });

    it('does NOT match a bare basename or a same-named file elsewhere', () => {
        for (const p of [
            'dispatch.js',
            'hooks.json',
            'src/hooks/dispatch.js',
            'dist/cli/dispatch.js',
            'docs/hooks/hooks.json',
        ]) {
            expect(targets_plumbing_output(p), p).toBeNull();
        }
    });

    it('does NOT match the plumbing SOURCES — they carry a record, not a deny', () => {
        for (const p of [
            'src/scripts/hook_manifest.yaml',
            'src/scripts/hooks/host_lowering.yaml',
            'src/scripts/hooks/augment-dispatcher.sh',
            'src/config/hook-latency-budget.json',
        ]) {
            expect(targets_plumbing_output(p), p).toBeNull();
        }
    });

    /**
     * road-to-blocking-severities 2.2 — the two COMPILED tables.
     *
     * They sit beside their YAML sources and are the opposite case: the YAML is
     * hand-written and carries a record, while the JSON is written only by
     * `compile_hook_manifest` and has no legitimate hand edit at all. Until this
     * step a hand edit of `host_lowering.json` was refused by nothing, and the
     * reader serves it in preference to the YAML, so the edited body is what
     * every host would have been told.
     */
    it('matches the compiled plumbing tables, repo-relative and absolute', () => {
        for (const p of ['src/scripts/hook_manifest.json', 'src/scripts/hooks/host_lowering.json']) {
            expect(targets_plumbing_output(p), p).toBe(p);
            expect(targets_plumbing_output(`/Users/x/project/${p}`), p).toBe(p);
        }
    });

    /**
     * The boundary the compiled-table entries could plausibly over-reach into:
     * the schema beside the manifest, a fixture copy under `tests/`, and the
     * same basenames one directory off.
     */
    it('does NOT match a neighbour of the compiled tables', () => {
        for (const p of [
            'src/scripts/hook_manifest.schema.json',
            'src/scripts/host_lowering.json',
            'src/scripts/hooks/hook_manifest.json',
            'docs/contracts/hook_manifest.json',
        ]) {
            expect(targets_plumbing_output(p), p).toBeNull();
        }
    });

    it('returns null for an empty path', () => {
        expect(targets_plumbing_output('')).toBeNull();
    });
});

describe('block_plumbing_writes — check_envelope refuses', () => {
    it('DENIES an Edit targeting dist/hooks/dispatch.js', () => {
        const [blocked, reason] = check_envelope({
            payload: { tool_name: 'Edit', tool_input: { file_path: 'dist/hooks/dispatch.js' } },
        } as never);
        expect(blocked).toBe(true);
        expect(reason).toContain('dist/hooks/dispatch.js');
        expect(reason).toContain('npm run build:hooks');
    });

    it('DENIES a Write targeting hooks/hooks.json', () => {
        const [blocked, reason] = check_envelope(write('hooks/hooks.json') as never);
        expect(blocked).toBe(true);
        expect(reason).toContain('task sync');
    });

    it('DENIES a redirect into hooks/hooks.json', () => {
        const [blocked] = check_envelope(bash("cat > hooks/hooks.json") as never);
        expect(blocked).toBe(true);
    });

    it('DENIES the shell write shapes the kernel guard recognises', () => {
        for (const cmd of [
            'echo x >> dist/hooks/dispatch.js',
            'sed -i s/a/b/ dist/hooks/dispatch.js',
            'tee dist/hooks/dispatch.js',
            'rm hooks/hooks.json',
            'cp /tmp/x dist/hooks/dispatch.js',
            'mv /tmp/x hooks/hooks.json',
        ]) {
            expect(check_envelope(bash(cmd) as never)[0], cmd).toBe(true);
        }
    });

    /**
     * road-to-blocking-severities 2.2, the DENY path for the compiled tables —
     * the half that matters, since a matcher that returns a name buys nothing
     * unless the envelope check turns it into a refusal that names the command
     * to run instead.
     */
    it('DENIES an Edit and a shell write to either compiled table, naming the compiler', () => {
        for (const [p, table] of [
            ['src/scripts/hook_manifest.json', 'manifest'],
            ['src/scripts/hooks/host_lowering.json', 'host-lowering'],
        ] as const) {
            const [blocked, reason] = check_envelope({
                payload: { tool_name: 'Edit', tool_input: { file_path: p } },
            } as never);
            expect(blocked, p).toBe(true);
            expect(reason, p).toContain(p);
            expect(reason, p).toContain(`compile_hook_manifest --table ${table}`);

            expect(check_envelope(bash(`sed -i s/a/b/ ${p}`) as never)[0], p).toBe(true);
            expect(check_envelope(bash(`cat > ${p}`) as never)[0], p).toBe(true);
        }
    });

    /**
     * The regeneration itself must survive — a guard that refused its own
     * repair path would make the governed file unmaintainable, which is the
     * failure mode the `ALLOWS the legitimate builds` test below pins for the
     * other two outputs.
     */
    it('ALLOWS the compiler that writes the compiled tables', () => {
        for (const cmd of [
            './scripts-run src/scripts/compile_hook_manifest --table manifest',
            './scripts-run src/scripts/compile_hook_manifest --table host-lowering',
            'task sync',
        ]) {
            expect(check_envelope(bash(cmd) as never)[0], cmd).toBe(false);
        }
    });
});

describe('block_plumbing_writes — check_envelope allows', () => {
    it('ALLOWS the legitimate builds — the property fail_closed rests on', () => {
        for (const cmd of [
            'npm run build:hooks',
            'task sync',
            'npm run build',
        ]) {
            expect(check_envelope(bash(cmd) as never)[0], cmd).toBe(false);
        }
    });

    it('ALLOWS reading a build output — it is generated, not secret', () => {
        for (const cmd of [
            'cat dist/hooks/dispatch.js',
            'grep -n dispatch dist/hooks/dispatch.js',
            'head -5 hooks/hooks.json',
            'git show HEAD:hooks/hooks.json',
            'diff hooks/hooks.json /tmp/other.json',
        ]) {
            expect(check_envelope(bash(cmd) as never)[0], cmd).toBe(false);
        }
    });

    it('ALLOWS a Write to an unrelated file', () => {
        expect(check_envelope(write('src/scripts/hooks/dispatch_hook.ts') as never)[0]).toBe(false);
    });

    it('ALLOWS a copy whose build output is the SOURCE, not the destination', () => {
        expect(check_envelope(bash('cp dist/hooks/dispatch.js /tmp/bak.js') as never)[0]).toBe(
            false,
        );
    });

    it('ALLOWS an envelope with no tool name at all', () => {
        expect(check_envelope({} as never)[0]).toBe(false);
    });

    /**
     * The residual the header declares, asserted so it is a KNOWN-OPEN rather
     * than an assumption. A write whose target never appears as a path-shaped
     * token — it is built inside an interpreter's argument — carries none of
     * the recognised shapes. If a later change closes this, the assertion flips
     * here and the header sentence has to move with it.
     */
    it('does NOT detect a write built inside an interpreter argument (known-open)', () => {
        expect(
            check_envelope(
                bash('python3 -c "open(\'hooks/hooks.json\',\'w\').write(\'{}\')"') as never,
            )[0],
        ).toBe(false);
    });

    /**
     * The other half of that residual, and it goes the OTHER way — measured,
     * not assumed. `sh -c 'printf x > hooks/hooks.json'` routes through an
     * interpreter and is still refused, because the tokenizer splits on
     * whitespace and the redirect survives inside the quoted argument. Pinned
     * so the header's known-open claim stays exactly as wide as the behaviour:
     * "through an interpreter" does not by itself mean undetected.
     */
    it('DOES detect an interpreter argument that still carries a redirect shape', () => {
        expect(check_envelope(bash("sh -c 'printf x > hooks/hooks.json'") as never)[0]).toBe(true);
    });
});
