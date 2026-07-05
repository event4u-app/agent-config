// Contract tests for the explain_last trace builder + Markdown renderer
// (py2ts Phase 1, ADR-200): index.ts (build_trace), render.ts, state_loader.ts,
// and the core slot builders exercised end-to-end on synthetic
// `.work-state.json` fixtures. The tsx twins are the source of truth (the
// python originals were deleted in the teardown); the serialized trace JSON +
// both renders are pinned via inline snapshots. mtimes are pinned and `now`
// is injected so every fixture is deterministic.
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { build_trace } from '../../../src/scripts/_cli/explain_last/index.js';
import { PyFloat } from '../../../src/scripts/_cli/explain_last/memory.js';
import { render } from '../../../src/scripts/_cli/explain_last/render.js';


// Fixed instant injected as `now` on both sides (ms-aligned so the Python
// `datetime` and the JS `Date` agree to the microsecond).
const NOW_DATE = new Date(Date.UTC(2026, 5, 17, 12, 0, 0));
// Pinned mtimes (epoch seconds): state anchor + a council file inside the window.
const STATE_MTIME = 1718000000.0;
const COUNCIL_MTIME = 1718000010.0;

let root: string;
beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'explast-'));
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});

// ---- PyFloat-aware json.dumps(indent=2, sort_keys=True, ensure_ascii=False)
function pyJsonStr(s: string): string {
    let out = '"';
    for (const ch of s) {
        const code = ch.codePointAt(0) as number;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\b') out += '\\b';
        else if (ch === '\f') out += '\\f';
        else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, '0')}`;
        else out += ch;
    }
    return `${out}"`;
}
function pyFloatRepr(n: number): string {
    if (!Number.isFinite(n)) return Number.isNaN(n) ? 'NaN' : n > 0 ? 'Infinity' : '-Infinity';
    return Number.isInteger(n) ? `${n}.0` : String(n);
}
function dumpSorted(v: unknown, depth: number): string {
    const pad = '  '.repeat(depth + 1);
    const close = '  '.repeat(depth);
    if (v === null || v === undefined) return 'null';
    if (v instanceof PyFloat) return pyFloatRepr(v.value);
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return pyJsonStr(v);
    if (Array.isArray(v)) {
        if (v.length === 0) return '[]';
        return `[\n${v.map((x) => pad + dumpSorted(x, depth + 1)).join(',\n')}\n${close}]`;
    }
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    if (keys.length === 0) return '{}';
    return `{\n${keys
        .map((k) => `${pad}${pyJsonStr(k)}: ${dumpSorted(o[k], depth + 1)}`)
        .join(',\n')}\n${close}}`;
}

function writeJson(p: string, obj: unknown): void {
    writeFileSync(p, JSON.stringify(obj), 'utf-8');
}

/** Build the "rich" fixture: every slot populated, scrubber-active values. */
function buildRichFixture(): void {
    mkdirSync(path.join(root, 'dist'), { recursive: true });
    mkdirSync(path.join(root, '.agent-memory'), { recursive: true });
    mkdirSync(path.join(root, 'agents', 'runtime', 'council', 'sessions', 's1'), {
        recursive: true,
    });
    writeJson(path.join(root, 'dist', 'router.json'), {
        kernel: ['k-one', 'k-two'],
        tier_1: [{ id: 't-a' }, { id: 't-b' }, { bad: 'noid' }, { id: 123 }],
    });
    writeFileSync(
        path.join(root, '.agent-memory', 'hits.jsonl'),
        `${JSON.stringify({ entry_id: 'm1', hit_score: 2, used_in: 'refine', run_id: 'TICK-1' })}\n`
        + `${JSON.stringify({ id: 'm2', score: 0.5 })}\n`
        + 'not json line\n'
        + `${JSON.stringify({ entry_id: 'other', run_id: 'OTHER' })}\n`,
        'utf-8',
    );
    const councilFile = path.join(
        root, 'agents', 'runtime', 'council', 'sessions', 's1', 'council-responses.json',
    );
    writeJson(councilFile, {
        responses: [
            {
                provider: 'anthropic', model: 'sonnet',
                text: 'Verdict line one\nignored second',
                citations: ['c1', 'note about srv.local'],
            },
            { provider: 'openai', model: 'gpt', text: '   ' },
            { model: 'solo', text: 'only model' },
        ],
    });
    const state = {
        version: 1,
        directive_set: '',
        input: {
            kind: 'ticket',
            data: {
                id: 'TICK-1',
                assumptions: [
                    'first assumption',
                    '   ',
                    { id: 'a2', accepted: false, source: 'halt' },
                ],
            },
        },
        persona: 'developer',
        memory: [{ entry_id: 's-mem', hit_score: 1.25, used_in: 'plan' }],
        halts: [{ reason: 'needs review', step: 'refine', surface: ['line A', 'line B'] }],
    };
    const stateFile = path.join(root, '.work-state.json');
    writeJson(stateFile, state);
    utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
    utimesSync(councilFile, COUNCIL_MTIME, COUNCIL_MTIME);
}

describe('explain_last build_trace + render — contract', () => {
    it('rich fixture: trace JSON + both renders (pinned)', () => {
        buildRichFixture();
        const stateFile = path.join(root, '.work-state.json');
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        const json = dumpSorted(trace, 0);
        expect(json).toMatchInlineSnapshot(`
          "{
            "assumptions": [
              {
                "accepted": true,
                "id": "first assumption",
                "source": "refine"
              },
              {
                "accepted": false,
                "id": "a2",
                "source": "halt"
              }
            ],
            "council": [
              {
                "citations": [
                  "c1",
                  "note about <host>"
                ],
                "member_id": "anthropic/sonnet",
                "verdict": "Verdict line one"
              },
              {
                "citations": [],
                "member_id": "solo",
                "verdict": "only model"
              }
            ],
            "generated_at": "2026-06-17T12:00:00+00:00",
            "halt": {
              "reason": "needs review",
              "step": "refine",
              "surface": [
                "line A",
                "line B"
              ]
            },
            "inputs": {
              "preset": "balanced",
              "profile": "developer",
              "rule_loading_tier": "balanced",
              "source_per_knob": {
                "preset": "profile",
                "profile": "default",
                "rule_loading_tier": "default"
              }
            },
            "memory": [
              {
                "entry_id": "s-mem",
                "hit_score": 1.25,
                "used_in": "plan"
              },
              {
                "entry_id": "m1",
                "hit_score": 2.0,
                "used_in": "refine"
              },
              {
                "entry_id": "m2",
                "hit_score": 0.5,
                "used_in": "unspecified"
              }
            ],
            "pack": null,
            "provider": null,
            "route": {
              "kernel_rules": [
                "k-one",
                "k-two"
              ],
              "matched_rules": [
                "t-a",
                "t-b"
              ],
              "persona": "developer"
            },
            "run_id": "TICK-1",
            "subject": "implement-ticket",
            "version": 1
          }"
        `);
        expect(render(trace, { with_footer: true })).toMatchInlineSnapshot(`
          "# explain last — run TICK-1

          **Subject:** /implement-ticket · **Started:** 2026-06-17T12:00:00+00:00

          ## Why this route?

          - Active rules: t-a, t-b
          - Kernel rules: 2
          - Persona: developer

          ## Why this profile / preset?

          | knob | value | source |
          |---|---|---|
          | profile.id | developer | default |
          | preset.id | balanced | profile |
          | rule_loading_tier | balanced | default |

          ## Memory hits influencing this run

          - s-mem (score 1.25) — used in plan
          - m1 (score 2.00) — used in refine
          - m2 (score 0.50) — used in unspecified

          ## Council

          ### anthropic/sonnet

          > Verdict line one

          Citations:
          - c1
          - note about <host>

          ### solo

          > only model

          ## Why halted?

          - **Reason:** \`needs review\`
          - **Hook event:** \`refine\`

          Surface emitted to the user:

            line A
            line B

          ## Assumptions

          - [x] first assumption  — recorded in step \`refine\`
          - [ ] a2  — recorded in step \`halt\`

          _tip: pass \`--json\` to emit machine-readable trace; \`--quiet\` to drop this footer._
          "
        `);
        expect(render(trace, { with_footer: false })).toMatchInlineSnapshot(`
          "# explain last — run TICK-1

          **Subject:** /implement-ticket · **Started:** 2026-06-17T12:00:00+00:00

          ## Why this route?

          - Active rules: t-a, t-b
          - Kernel rules: 2
          - Persona: developer

          ## Why this profile / preset?

          | knob | value | source |
          |---|---|---|
          | profile.id | developer | default |
          | preset.id | balanced | profile |
          | rule_loading_tier | balanced | default |

          ## Memory hits influencing this run

          - s-mem (score 1.25) — used in plan
          - m1 (score 2.00) — used in refine
          - m2 (score 0.50) — used in unspecified

          ## Council

          ### anthropic/sonnet

          > Verdict line one

          Citations:
          - c1
          - note about <host>

          ### solo

          > only model

          ## Why halted?

          - **Reason:** \`needs review\`
          - **Hook event:** \`refine\`

          Surface emitted to the user:

            line A
            line B

          ## Assumptions

          - [x] first assumption  — recorded in step \`refine\`
          - [ ] a2  — recorded in step \`halt\`
          "
        `);
        // spot-checks: PyFloat carries the int-valued float; scrubber fired.
        const mem = trace.memory as Array<Record<string, unknown>>;
        expect(mem[1]?.hit_score).toBeInstanceOf(PyFloat);
        expect(json).toContain('"hit_score": 2.0');
        expect(json).toContain('<host>'); // srv.local citation scrubbed
    });

    it('empty/minimal state: every slot degrades to null/placeholder', () => {
        const state = { version: 1, input: { kind: 'prompt', data: {} } };
        const stateFile = path.join(root, '.work-state.json');
        writeJson(stateFile, state);
        utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        expect(dumpSorted(trace, 0)).toMatchInlineSnapshot(`
          "{
            "assumptions": [],
            "council": null,
            "generated_at": "2026-06-17T12:00:00+00:00",
            "halt": null,
            "inputs": {
              "preset": "balanced",
              "profile": "developer",
              "rule_loading_tier": "balanced",
              "source_per_knob": {
                "preset": "profile",
                "profile": "default",
                "rule_loading_tier": "default"
              }
            },
            "memory": null,
            "pack": null,
            "provider": null,
            "route": null,
            "run_id": "2024-06-10T06:13:20+00:00",
            "subject": "work",
            "version": 1
          }"
        `);
        expect(render(trace, { with_footer: true })).toMatchInlineSnapshot(`
          "# explain last — run 2024-06-10T06:13:20+00:00

          **Subject:** /work · **Started:** 2026-06-17T12:00:00+00:00

          ## Why this route?

          - (none) — router.json missing or unreadable

          ## Why this profile / preset?

          | knob | value | source |
          |---|---|---|
          | profile.id | developer | default |
          | preset.id | balanced | profile |
          | rule_loading_tier | balanced | default |

          ## Memory hits influencing this run

          - (none)

          ## Council

          (none recorded for this run)

          ## Why halted?

          (clean run — no halt recorded)

          ## Assumptions

          - (none captured)

          _tip: pass \`--json\` to emit machine-readable trace; \`--quiet\` to drop this footer._
          "
        `);
        expect(trace.run_id).toBe('2024-06-10T06:13:20+00:00'); // mtime fallback, no µs
    });

    it('video subject: provider slot + section populate and scrub', () => {
        const state = {
            version: 1,
            directive_set: 'video',
            input: { kind: 'file', data: {} },
            video_provider: { id: 'sora', selection_reason: 'budget on host.internal $40/m' },
        };
        const stateFile = path.join(root, '.work-state.json');
        writeJson(stateFile, state);
        utimesSync(stateFile, 1718000000.5, 1718000000.5); // fractional → µs in run_id
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        expect(dumpSorted(trace, 0)).toMatchInlineSnapshot(`
          "{
            "assumptions": [],
            "council": null,
            "generated_at": "2026-06-17T12:00:00+00:00",
            "halt": null,
            "inputs": {
              "preset": "balanced",
              "profile": "developer",
              "rule_loading_tier": "balanced",
              "source_per_knob": {
                "preset": "profile",
                "profile": "default",
                "rule_loading_tier": "default"
              }
            },
            "memory": null,
            "pack": null,
            "provider": {
              "id": "sora",
              "selection_reason": "budget on <host> <money>/m"
            },
            "route": null,
            "run_id": "2024-06-10T06:13:20.500000+00:00",
            "subject": "video",
            "version": 1
          }"
        `);
        expect(render(trace, { with_footer: false })).toMatchInlineSnapshot(`
          "# explain last — run 2024-06-10T06:13:20.500000+00:00

          **Subject:** /video · **Started:** 2026-06-17T12:00:00+00:00

          ## Why this route?

          - (none) — router.json missing or unreadable

          ## Why this profile / preset?

          | knob | value | source |
          |---|---|---|
          | profile.id | developer | default |
          | preset.id | balanced | profile |
          | rule_loading_tier | balanced | default |

          ## Memory hits influencing this run

          - (none)

          ## Council

          (none recorded for this run)

          ## Why halted?

          (clean run — no halt recorded)

          ## Why this provider?

          - **Provider:** \`sora\`
          - **Selection reason:** budget on <host> <money>/m

          ## Assumptions

          - (none captured)
          "
        `);
        expect(trace.run_id).toBe('2024-06-10T06:13:20.500000+00:00');
        expect((trace.provider as Record<string, unknown>).selection_reason).toBe(
            'budget on <host> <money>/m',
        );
    });

    it('council out of ±1h window → null', () => {
        mkdirSync(path.join(root, 'agents', 'runtime', 'council', 'sessions', 's9'), {
            recursive: true,
        });
        const cf = path.join(
            root, 'agents', 'runtime', 'council', 'sessions', 's9', 'council-responses.json',
        );
        writeJson(cf, { responses: [{ provider: 'x', model: 'y', text: 'v' }] });
        const state = { version: 1, input: { kind: 'diff', data: { id: '  spaced  ' } } };
        const stateFile = path.join(root, '.work-state.json');
        writeJson(stateFile, state);
        utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
        utimesSync(cf, STATE_MTIME + 99999, STATE_MTIME + 99999); // outside window
        const trace = build_trace(root, stateFile, { now: NOW_DATE });
        expect(dumpSorted(trace, 0)).toMatchInlineSnapshot(`
          "{
            "assumptions": [],
            "council": null,
            "generated_at": "2026-06-17T12:00:00+00:00",
            "halt": null,
            "inputs": {
              "preset": "balanced",
              "profile": "developer",
              "rule_loading_tier": "balanced",
              "source_per_knob": {
                "preset": "profile",
                "profile": "default",
                "rule_loading_tier": "default"
              }
            },
            "memory": null,
            "pack": null,
            "provider": null,
            "route": null,
            "run_id": "spaced",
            "subject": "work",
            "version": 1
          }"
        `);
        expect(trace.council).toBe(null);
        expect(trace.run_id).toBe('spaced'); // raw_id.strip() then scrub
    });

    it('subject derivation: council/video override, kind map, unknown', () => {
        const cases: Array<[Record<string, unknown>, string]> = [
            [{ directive_set: 'council', input: { kind: 'ticket', data: {} } }, 'council'],
            [{ directive_set: 'video', input: { kind: 'ticket', data: {} } }, 'video'],
            [{ input: { kind: 'prompt', data: {} } }, 'work'],
            [{ input: { kind: 'diff', data: {} } }, 'work'],
            [{ input: { kind: 'file', data: {} } }, 'work'],
            [{ input: { kind: 'mystery', data: {} } }, 'unknown'],
            [{ input: { data: {} } }, 'unknown'],
        ];
        for (const [extra, expectedSubject] of cases) {
            const stateFile = path.join(root, '.work-state.json');
            writeJson(stateFile, { version: 1, ...extra });
            utimesSync(stateFile, STATE_MTIME, STATE_MTIME);
            const trace = build_trace(root, stateFile, { now: NOW_DATE });
            expect(trace.subject).toBe(expectedSubject);
        }
    });
});

