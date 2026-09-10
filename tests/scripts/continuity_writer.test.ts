/**
 * The deterministic continuity-record writer
 * (`road-to-continuity-writer-activation` step 1.2).
 *
 * Properties pinned, one per clause of the step's `verify:`:
 *
 *   - a session past the threshold with the switch ARMED leaves a record, and
 *     the writer reaches no provider to do it;
 *   - a session that did nothing substantive leaves none, even though it is
 *     past the threshold and the switch is armed — so the decision comes from
 *     the concern's own counters, not from the threshold and not from file
 *     presence;
 *   - with the switch at its shipped default the tree behaves exactly as it
 *     does today: no record, and every other emission unchanged;
 *   - the record is the `continuity_record` variant and carries none of the
 *     judgement fields that variant forbids.
 */
// code-comment-allow-file -- every `##` line below sits inside the ROADMAP
// fixture string, not a comment: the headings ARE the data under test, since
// what is being verified is that the writer reads phase spans and the
// acceptance-criteria section the way the dashboard does.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    acceptanceCriteria,
    auto_record_enabled,
    buildContinuityRecord,
    roadmapShape,
} from '../../src/scripts/_lib/continuity_writer.js';
import {
    CONTINUITY_RECORD_FORBIDDEN_KEYS,
    validateRecycleEnvelope,
} from '../../src/scripts/_lib/subagent_capsule.js';
import { recycle_envelope_rel } from '../../src/scripts/_lib/recycle_envelope_paths.js';
import {
    main,
    THRESHOLD_OVERRIDE_ENV,
} from '../../src/scripts/hooks/session_eol_hook.js';
import { roadmap_claim_rel } from '../../src/scripts/session_register_hook.js';
import {
    clearHookStdinOverride,
    setHookStdinOverride,
} from '../../src/scripts/hooks/hook_stdin.js';

const SLUG = 'road-to-example';
const SESSION = 'session-a';

let workspace: string;
let home: string;
let transcript: string;
let priorHome: string | undefined;

const ROADMAP = `# Road to example

## Phase 1 — the first phase

- [x] **1.1 done already.**
      verify: it is done.
- [ ] **1.2 still open.**
      verify: it is not done.
- [~] **1.3 deferred.** <!-- carried-to=elsewhere -->

## Phase 2 — the second phase

- [ ] **2.1 also open.**

## Blockers

### blocker: not-a-step

- **Status:** open

## Acceptance Criteria

- [ ] AC-1 — the gate is wired.
- [ ] AC-2 — the vector reads zero.
`;

function assistantLine(input: number, cacheRead: number): string {
    return (
        JSON.stringify({
            type: 'assistant',
            isSidechain: false,
            timestamp: '2026-09-08T10:00:00.000Z',
            message: {
                role: 'assistant',
                usage: {
                    input_tokens: input,
                    cache_read_input_tokens: cacheRead,
                    cache_creation_input_tokens: 0,
                    output_tokens: 10,
                },
            },
        }) + '\n'
    );
}

const USER_LINE = JSON.stringify({ type: 'user', message: { role: 'user', content: 'go' } }) + '\n';

function envelopeJson(sessionId: string): string {
    return JSON.stringify({
        schema_version: 1,
        platform: 'claude',
        event: 'stop',
        native_event: 'Stop',
        workspace_root: workspace,
        session_id: sessionId,
        payload: { transcript_path: transcript },
        settings: {},
    });
}

function runMain(sessionId = SESSION): { rc: number; out: string } {
    setHookStdinOverride(envelopeJson(sessionId));
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        out += String(chunk);
        return true;
    });
    try {
        const rc = main() ?? 0;
        return { rc, out };
    } finally {
        spy.mockRestore();
        clearHookStdinOverride();
    }
}

function writeRoadmap(text: string = ROADMAP): void {
    const p = path.join(workspace, 'agents', 'roadmaps', `${SLUG}.md`);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
}

function claim(sessionId = SESSION, slug = SLUG): void {
    const p = path.join(workspace, roadmap_claim_rel(sessionId));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ slug, session_id: sessionId }));
}

function arm(value: 'on' | 'off'): void {
    fs.writeFileSync(
        path.join(workspace, '.agent-settings.yml'),
        `continuity:\n  auto_record: "${value}"\n`,
    );
}

function recordAt(sessionId = SESSION): Record<string, unknown> | null {
    const p = path.join(workspace, recycle_envelope_rel(sessionId));
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
}

beforeEach(() => {
    workspace = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-writer-ws-')));
    home = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-writer-home-')));
    priorHome = process.env['HOME'];
    process.env['HOME'] = home;
    transcript = path.join(home, 'projects', 'p', 't.jsonl');
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
});

afterEach(() => {
    if (priorHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = priorHome;
    delete process.env[THRESHOLD_OVERRIDE_ENV];
    vi.restoreAllMocks();
});

describe('the switch', () => {
    it('resolves ON from the shipped template when the workspace says nothing', () => {
        // The cascade merges the shipped template, so "absent" is not "off" —
        // it is whatever the template says. That was `off` until 2026-09-10
        // and is `on` since (step 3.2). Pinned in this direction deliberately:
        // the flip is a change to what a default install DOES, and a test that
        // still asserted `false` here would be asserting the old product.
        expect(auto_record_enabled(workspace)).toBe(true);
    });

    it('accepts the string `on` and YAML’s bare `on`', () => {
        arm('on');
        expect(auto_record_enabled(workspace)).toBe(true);
        fs.writeFileSync(
            path.join(workspace, '.agent-settings.yml'),
            'continuity:\n  auto_record: on\n',
        );
        expect(auto_record_enabled(workspace)).toBe(true);
    });

    // ── the fail-closed matrix (AI council 2026-09-10, option A) ───────
    //
    // The property was documented from step 1.4 and carried by the TEMPLATE's
    // `off`, not by the reader — `load_agent_settings` skips a malformed layer
    // instead of throwing, so the `catch` never ran for that case. The flip to
    // `on` exposed it. These cases pin the property for the reason its name
    // gives, which is the part the previous fixture could not do.

    it('a malformed project settings layer disarms the writer', () => {
        fs.writeFileSync(path.join(workspace, '.agent-settings.yml'), ':\n  - [\n');
        expect(auto_record_enabled(workspace)).toBe(false);
    });

    it('and it disarms it INDEPENDENTLY of the template, which now says `on`', () => {
        // The sensitivity arm, and the whole reason option (A) was executed. If
        // the verdict still came from the resolved value, this would be `true`:
        // a malformed layer resolves to the template, and the template is `on`.
        expect(auto_record_enabled(workspace)).toBe(true); // template, no project file
        fs.writeFileSync(path.join(workspace, '.agent-settings.yml'), 'continuity: [\n');
        expect(auto_record_enabled(workspace)).toBe(false);
    });

    it('a malformed layer is not confused with an absent one', () => {
        // Both merge to nothing, which is why the loader conflated them. The
        // repair is that they now decide differently.
        expect(auto_record_enabled(workspace)).toBe(true);
        fs.writeFileSync(path.join(workspace, '.agent-settings.yml'), '\t- }{\n');
        expect(auto_record_enabled(workspace)).toBe(false);
        fs.rmSync(path.join(workspace, '.agent-settings.yml'));
        expect(auto_record_enabled(workspace)).toBe(true);
    });

    it('a VALID layer that omits the key still resolves the template', () => {
        // The bound of the repair: only a broken layer disarms. A well-formed
        // file that simply says nothing about this key must not.
        fs.writeFileSync(path.join(workspace, '.agent-settings.yml'), 'quality:\n  local_auto_run: false\n');
        expect(auto_record_enabled(workspace)).toBe(true);
    });

    it('is off for any other value, including a typo', () => {
        fs.writeFileSync(
            path.join(workspace, '.agent-settings.yml'),
            'continuity:\n  auto_record: "yes"\n',
        );
        expect(auto_record_enabled(workspace)).toBe(false);
    });
});

describe('roadmap reading agrees with the dashboard vocabulary', () => {
    it('counts phase-span checkboxes only, and never an acceptance criterion', () => {
        const shape = roadmapShape(ROADMAP);
        expect(shape.total).toBe(4);
        expect(shape.done).toBe(1);
        expect(shape.open).toEqual(['1.2 still open.', '2.1 also open.']);
    });

    it('reads the declared acceptance criteria from their own section', () => {
        expect(acceptanceCriteria(ROADMAP)).toEqual([
            'AC-1 — the gate is wired.',
            'AC-2 — the vector reads zero.',
        ]);
    });
});

describe('buildContinuityRecord', () => {
    it('derives a valid `continuity_record` from the claimed roadmap', () => {
        writeRoadmap();
        const now = new Date('2026-09-08T12:00:00.000Z');
        const out = buildContinuityRecord({
            root: workspace,
            sessionId: SESSION,
            slug: SLUG,
            counters: { turns: 4, assistant_records: 4, tool_calls: 9 } as never,
            now,
        });
        expect(out.record).not.toBeNull();
        const rec = out.record as Record<string, unknown>;
        expect(validateRecycleEnvelope(rec)).toEqual([]);
        expect(rec['variant']).toBe('continuity_record');
        expect(rec['task']).toBe(SLUG);
        expect(rec['summary']).toBe(`${SLUG}: 1 of 4 steps closed`);
        expect(rec['remaining']).toEqual(['1.2 still open.', '2.1 also open.']);
        expect(rec['acceptance_criteria']).toEqual([
            'AC-1 — the gate is wired.',
            'AC-2 — the vector reads zero.',
        ]);
        expect(rec['predecessor']).toBe('none');
        expect(rec['written_at']).toBe(now.toISOString());
    });

    it('carries none of the judgement fields the variant forbids', () => {
        writeRoadmap();
        const out = buildContinuityRecord({
            root: workspace,
            sessionId: SESSION,
            slug: SLUG,
            counters: { turns: 1, assistant_records: 1, tool_calls: 1 } as never,
        });
        const rec = out.record as Record<string, unknown>;
        for (const forbidden of CONTINUITY_RECORD_FORBIDDEN_KEYS) {
            expect(Object.keys(rec)).not.toContain(forbidden);
        }
    });

    it('falls back to the definitional criterion when a roadmap declares none', () => {
        writeRoadmap('# R\n\n## Phase 1 — p\n\n- [ ] **1.1 open.**\n');
        const out = buildContinuityRecord({
            root: workspace,
            sessionId: SESSION,
            slug: SLUG,
            counters: { turns: 1, assistant_records: 1, tool_calls: 1 } as never,
        });
        const rec = out.record as Record<string, unknown>;
        expect(rec['acceptance_criteria']).toEqual([
            `every phase step in agents/roadmaps/${SLUG}.md is closed`,
        ]);
        expect(validateRecycleEnvelope(rec)).toEqual([]);
    });

    it('builds nothing when the session claimed no roadmap', () => {
        const out = buildContinuityRecord({
            root: workspace,
            sessionId: SESSION,
            slug: null,
            counters: { turns: 9, assistant_records: 9, tool_calls: 9 } as never,
        });
        expect(out.record).toBeNull();
        expect(out.reason).toContain('no claimed roadmap');
    });

    it('builds nothing when the session is not substantive', () => {
        writeRoadmap();
        const out = buildContinuityRecord({
            root: workspace,
            sessionId: SESSION,
            slug: SLUG,
            counters: {
                turns: 1,
                assistant_records: 0,
                tool_calls: 0,
                final_context_tokens: 5,
            } as never,
        });
        expect(out.record).toBeNull();
        expect(out.reason).toContain('not substantive');
    });

    it('builds nothing when the claimed roadmap has no phase checkboxes', () => {
        writeRoadmap('# R\n\nProse only, no phases.\n');
        const out = buildContinuityRecord({
            root: workspace,
            sessionId: SESSION,
            slug: SLUG,
            counters: { turns: 1, assistant_records: 1, tool_calls: 1 } as never,
        });
        expect(out.record).toBeNull();
        expect(out.reason).toContain('no phase checkboxes');
    });
});

describe('no model spend, by construction', () => {
    it('imports no provider, network or council module', () => {
        const src = fs.readFileSync(
            path.join(process.cwd(), 'src', 'scripts', '_lib', 'continuity_writer.ts'),
            'utf-8',
        );
        const imports = [...src.matchAll(/^import[\s\S]*?from '([^']+)';$/gm)].map(
            (m) => m[1] as string,
        );
        expect(imports.length).toBeGreaterThan(0);
        for (const spec of imports) {
            expect(spec).not.toMatch(/ai_council|provider|openai|anthropic|fetch|undici|https?$/i);
            expect(spec).not.toMatch(/node:(http|https|net|tls)$/);
        }
        // And no child process: a subprocess is the other way a Stop path
        // acquires a cost the step forbids.
        expect(src).not.toMatch(/child_process|execSync|spawnSync/);
    });
});

describe('through the real hook, on the Stop path', () => {
    it('leaves a record when the switch is armed and the session is substantive', () => {
        writeRoadmap();
        claim();
        arm('on');
        process.env[THRESHOLD_OVERRIDE_ENV] = '10000';
        fs.writeFileSync(transcript, USER_LINE + assistantLine(1_000, 50_000));

        const res = runMain();
        expect(res.rc === 0 || res.rc === 2).toBe(true);

        const rec = recordAt();
        expect(rec).not.toBeNull();
        expect((rec as Record<string, unknown>)['variant']).toBe('continuity_record');
        expect((rec as Record<string, unknown>)['task']).toBe(SLUG);
        expect(validateRecycleEnvelope(rec)).toEqual([]);
    });

    it('writes a record with the switch at its shipped default (step 3.2)', () => {
        // The inverse of what this case asserted before 2026-09-10, and the
        // inversion IS the step: a substantive session inside a claimed
        // roadmap now leaves a record with no settings file and no command
        // run. Without this the flip would be a template edit nothing observes.
        writeRoadmap();
        claim();
        process.env[THRESHOLD_OVERRIDE_ENV] = '10000';
        fs.writeFileSync(transcript, USER_LINE + assistantLine(1_000, 50_000));

        runMain();
        const rec = recordAt();
        expect(rec).not.toBeNull();
        expect((rec as Record<string, unknown>)['variant']).toBe('continuity_record');
    });

    it('leaves NO record with the switch explicitly off — the switch still works', () => {
        // The sensitivity arm for the case above. Without it, "writes a record
        // by default" would pass equally against a writer that ignores the
        // switch entirely.
        writeRoadmap();
        claim();
        arm('off');
        process.env[THRESHOLD_OVERRIDE_ENV] = '10000';
        fs.writeFileSync(transcript, USER_LINE + assistantLine(1_000, 50_000));

        runMain();
        expect(recordAt()).toBeNull();
    });

    it('leaves NO record for a non-substantive session past the threshold', () => {
        writeRoadmap();
        claim();
        arm('on');
        // Threshold crossed, substantive floor not: the decision has to come
        // from the counters, and this is the fixture that separates the two.
        process.env[THRESHOLD_OVERRIDE_ENV] = '50';
        fs.writeFileSync(transcript, USER_LINE + assistantLine(100, 0));

        runMain();
        expect(recordAt()).toBeNull();
    });

    it('leaves NO record when the session claimed no roadmap', () => {
        writeRoadmap();
        arm('on');
        process.env[THRESHOLD_OVERRIDE_ENV] = '10000';
        fs.writeFileSync(transcript, USER_LINE + assistantLine(1_000, 50_000));

        runMain();
        expect(recordAt()).toBeNull();
    });

    it('supersedes its own record on a later Stop rather than accumulating', () => {
        writeRoadmap();
        claim();
        arm('on');
        process.env[THRESHOLD_OVERRIDE_ENV] = '10000';
        fs.writeFileSync(transcript, USER_LINE + assistantLine(1_000, 50_000));
        runMain();
        const first = recordAt() as Record<string, unknown>;

        fs.appendFileSync(transcript, USER_LINE + assistantLine(2_000, 80_000));
        runMain();
        const second = recordAt() as Record<string, unknown>;

        expect(second).not.toBeNull();
        expect(
            Date.parse(String(second['written_at'])) >= Date.parse(String(first['written_at'])),
        ).toBe(true);
        const dir = path.join(workspace, 'agents', 'runtime', 'state');
        const records = fs
            .readdirSync(dir)
            .filter((n) => n.startsWith('recycle-envelope') && n.endsWith('.json'));
        expect(records).toHaveLength(1);
    });
});
