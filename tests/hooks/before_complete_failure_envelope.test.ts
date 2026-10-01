/**
 * A FAILING verification command must leave a run record carrying its exit code.
 *
 * The envelope these cases feed is captured from a live host session, not
 * constructed. That is load-bearing rather than tidy: the defect pinned here is
 * exactly the one a constructed fixture hides — the recorder was tested against
 * the shape this repository imagined a failure had, and the host sends another.
 *
 * Two halves, failing for two independent reasons before the fix:
 *
 *   1. ROUTING. A failing call fires `PostToolUseFailure`, and that native event
 *      is bound to nothing — so the recorder never runs and writes no record at
 *      all. Asserted against the generated Claude hook matrix, which is the one
 *      source both `hooks/hooks.json` and the managed settings block derive from.
 *   2. PARSING. The failure envelope has no `tool_response`; the exit status is a
 *      top-level `error` string whose first line reads `Exit code N`, and the
 *      interrupt flag is spelled `is_interrupt`. `_extract_exit_reading` scans
 *      neither, so a routed-but-unparsed failure would be recorded with
 *      `exit_code: null` — an instrument gap wearing the shape of a fix.
 *
 * Risk 2 of the roadmap is pinned here too: the host fires exactly one of the two
 * events per call, so one failing command must produce exactly ONE record.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { parse as parseYaml } from 'yaml';

import {
    FAILURE_EVENT_NAMES,
    run,
    statePathFor,
} from '../../src/scripts/before_complete_hook.js';
import { build_claude_hook_matrix } from '../../src/scripts/_lib/claude_settings_hooks.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const FIXTURE = path.join(
    REPO_ROOT,
    'tests',
    'fixtures',
    'hook-envelopes',
    'claude-bash-failure.json',
);

const SESSION = 'failure-envelope-session';

function failurePayload(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as Record<string, unknown>;
}

/** The dispatcher's envelope: the host payload under the canonical slot it lowers to. */
function envelope(
    event: string,
    payload: Record<string, unknown>,
    native_event = 'PostToolUseFailure',
): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event,
        native_event,
        session_id: SESSION,
        workspace_root: '/work',
        payload,
    });
}

function runs(root: string): Array<Record<string, unknown>> {
    const raw = JSON.parse(
        fs.readFileSync(path.join(root, statePathFor(SESSION)), 'utf8'),
    ) as Record<string, unknown>;
    return (raw['verification_runs'] ?? []) as Array<Record<string, unknown>>;
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'failure-envelope-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('the fixture itself', () => {
    it('is the observed failure shape, not a constructed one', () => {
        const p = failurePayload();
        expect(p['hook_event_name']).toBe('PostToolUseFailure');
        expect(p['tool_name']).toBe('Bash');
        // The three properties the parser has to cope with.
        expect(p['tool_response']).toBeUndefined();
        expect(String(p['error'])).toMatch(/^Exit code 2\b/);
        expect(p['is_interrupt']).toBe(false);
    });
});

describe('routing — PostToolUseFailure reaches the recorder', () => {
    const matrix = build_claude_hook_matrix(MANIFEST);

    it('binds PostToolUseFailure to the post_tool_use concern list', () => {
        expect(Object.keys(matrix)).toContain('PostToolUseFailure');
        expect(matrix['PostToolUseFailure']).toContain('--event post_tool_use');
        expect(matrix['PostToolUseFailure']).toContain('--native-event PostToolUseFailure');
    });

    it('does not cost the success binding — both natives stay bound', () => {
        expect(matrix['PostToolUse']).toContain('--event post_tool_use');
        expect(matrix['PostToolUse']).toContain('--native-event PostToolUse');
        // Distinct commands: the `--native-event` tag is what a dispatcher log
        // reads back, so collapsing the two would erase which one fired.
        expect(matrix['PostToolUse']).not.toBe(matrix['PostToolUseFailure']);
    });

    it('emits the same pair into the plugin hooks.json', () => {
        const hooks = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'hooks', 'hooks.json'), 'utf8'),
        ) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
        const entry = hooks.hooks['PostToolUseFailure'];
        expect(entry).toBeDefined();
        expect(entry[0].hooks[0].command).toContain('--event post_tool_use');
        expect(hooks.hooks['PostToolUse']).toBeDefined();
    });
});

describe('the new event reaches no refusal', () => {
    it('every concern on the slot it lowers to is advisory and fail-open', () => {
        const manifest = parseYaml(
            fs.readFileSync(path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml'), 'utf8'),
        ) as {
            concerns: Record<string, { severity?: string; fail_closed?: boolean }>;
            platforms: Record<string, Record<string, unknown>>;
        };
        const list = manifest.platforms['claude']?.['post_tool_use'] as string[];
        expect(Array.isArray(list)).toBe(true);
        expect(list.length).toBeGreaterThan(0);

        // The property that makes the alias safe, asserted rather than argued:
        // routing a new native event onto this slot runs all of these, so a
        // blocking or fail-closed concern here would mean the diff armed a
        // refusal on a payload shape nothing has tested. A future edit that adds
        // one has to come past this line.
        const armed = list.filter((name) => {
            const c = manifest.concerns[name] ?? {};
            return c.severity === 'blocking' || c.fail_closed === true;
        });
        expect(armed).toEqual([]);
    });
});

describe('parsing — the record carries the exit code', () => {
    it('writes one record with the non-zero exit and its provenance', () => {
        run(envelope('session_start', {}), { consumer_root: tmp });
        expect(run(envelope('post_tool_use', failurePayload()), { consumer_root: tmp })).toBe(0);

        const recorded = runs(tmp);
        // Exactly one: the host fires one event per call, so a doubled record
        // would mean the binding fires twice and the cap evicts real evidence.
        expect(recorded).toHaveLength(1);
        const rec = recorded[0];
        expect(rec['command']).toBe('npx tsc --noEmit /nonexistent-probe-file.ts');
        expect(rec['exit_code']).toBe(2);
        expect(rec['exit_source']).toBe('error_prefix');
        expect(rec['interrupted']).toBe(false);
        // `other`, not `tsc`: `runnerOf` names TEST runners, and a type-checker
        // is not one. Asserted rather than left implicit because the obvious
        // next edit is to widen that vocabulary, and widening it would move the
        // red-green detector's reading of every non-test command.
        expect(rec['runner']).toBe('other');
    });

    it('keeps the failure output readable instead of dropping it', () => {
        run(envelope('session_start', {}), { consumer_root: tmp });
        run(envelope('post_tool_use', failurePayload()), { consumer_root: tmp });

        const rec = runs(tmp)[0];
        // The compiler's own diagnostic, not the `Exit code 2` header line: a
        // classifier reading the tail needs the reason, and the header is the
        // part `exit_code` already carries.
        expect(String(rec['stdout_tail'])).toContain('TS6053');
    });

    it('a zero exit is never manufactured when the host says nothing', () => {
        // A failure envelope stripped of its only status field: the honest
        // reading is `null`, because silence is not a pass.
        const p = failurePayload();
        delete p['error'];
        run(envelope('session_start', {}), { consumer_root: tmp });
        run(envelope('post_tool_use', p), { consumer_root: tmp });

        const rec = runs(tmp)[0];
        expect(rec['exit_code']).toBeNull();
        expect(rec['exit_source']).toBeNull();
    });

    it('an interrupted call is a kill, not a verdict', () => {
        const p = failurePayload();
        p['is_interrupt'] = true;
        delete p['error'];
        run(envelope('session_start', {}), { consumer_root: tmp });
        run(envelope('post_tool_use', p), { consumer_root: tmp });

        const rec = runs(tmp)[0];
        expect(rec['interrupted']).toBe(true);
        expect(rec['exit_code']).toBeNull();
    });

    it('a failure event never yields a zero exit, whatever its text says', () => {
        // The reviewer's case: a command whose own error text opens `Exit code
        // 0`. The host has already said the call failed, so parsing a pass out
        // of its output would contradict the one authoritative field in the
        // envelope — and in the direction that manufactures the strongest
        // possible evidence from a red run.
        const p = failurePayload();
        p['error'] = 'Exit code 0\nsomething the command printed';
        run(envelope('session_start', {}), { consumer_root: tmp });
        run(envelope('post_tool_use', p), { consumer_root: tmp });

        const rec = runs(tmp)[0];
        expect(rec['exit_code']).toBeNull();
        expect(rec['exit_source']).toBeNull();
    });

    it('seals a zero arriving on a failure event through any reading', () => {
        // Not only the error-prefix path: a numeric field and the success
        // response shape are sealed too, so the guarantee is about the EVENT and
        // not about one branch that happened to be audited.
        for (const shaped of [
            { exit_code: 0 },
            { tool_response: { stdout: 'ok', stderr: '', interrupted: false } },
        ]) {
            fs.rmSync(path.join(tmp, statePathFor(SESSION)), { force: true });
            run(envelope('session_start', {}), { consumer_root: tmp });
            run(
                envelope('post_tool_use', {
                    hook_event_name: 'PostToolUseFailure',
                    tool_name: 'Bash',
                    tool_input: { command: 'npx vitest run tests/unit' },
                    ...shaped,
                }),
                { consumer_root: tmp },
            );
            expect(runs(tmp)[0]?.['exit_code']).toBeNull();
        }
    });

    it('the observed failure event is named explicitly, and the manifest binds it', () => {
        // The set is what a reader checks against the manifest; the suffix
        // fallback below it covers a name this tree has never seen.
        expect(FAILURE_EVENT_NAMES.has('PostToolUseFailure')).toBe(true);
        const matrix = build_claude_hook_matrix(MANIFEST);
        for (const name of FAILURE_EVENT_NAMES) expect(Object.keys(matrix)).toContain(name);
    });

    it('a non-zero on a failure event is recorded unchanged', () => {
        // The seal removes a zero, never a real code — otherwise it would turn
        // the defect it fixes into a different one.
        run(envelope('session_start', {}), { consumer_root: tmp });
        run(envelope('post_tool_use', failurePayload()), { consumer_root: tmp });
        expect(runs(tmp)[0]?.['exit_code']).toBe(2);
    });

    it('the success shape is untouched by the failure reading', () => {
        run(envelope('session_start', {}), { consumer_root: tmp });
        run(
            envelope(
                'post_tool_use',
                {
                    tool_name: 'Bash',
                    tool_input: { command: 'npx vitest run tests/unit' },
                    tool_response: {
                        stdout: ' Tests  3 passed (3)',
                        stderr: '',
                        interrupted: false,
                    },
                },
                'PostToolUse',
            ),
            { consumer_root: tmp },
        );

        const rec = runs(tmp)[0];
        expect(rec['exit_code']).toBe(0);
        expect(rec['exit_source']).toBe('response_shape');
    });
});
