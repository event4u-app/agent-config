// Golden-parity rig for the py2ts work_engine `intent/classify` twin (ADR-094).
//
// `intent/classify.py` imports `from ..state import WorkState` only under
// TYPE_CHECKING, so the runtime module is stdlib-only and loads cleanly with
// the `from ..state import` lines rewritten (defensive — the TYPE_CHECKING
// guard means no rewrite is strictly needed, but the rewrite is harmless and
// keeps the loader uniform with the resolver rigs).
//
// `classify_intent` and `directive_set_for` are pure string functions — the
// harness drives both engines from the same prompt/title and asserts identical
// labels and identical ValueError text. `populate_routing` mutates a WorkState
// in place; it is exercised TS-side (it needs the WorkState class) and its
// classifier delegate is covered by the golden cases.
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { Input, WorkState } from '../../../src/agent-src/templates/scripts/work_engine/state.js';
import {
    INTENT_BACKEND,
    INTENT_MIXED,
    INTENT_UI_BUILD,
    INTENT_UI_IMPROVE,
    INTENT_UI_TRIVIAL,
    KNOWN_INTENTS,
    ValueError,
    classify_intent,
    directive_set_for,
    populate_routing,
} from '../../../src/agent-src/templates/scripts/work_engine/intent/classify.js';

const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
);

const WE = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
);
const STATE_PY = path.join(WE, 'state.py');
const CLASSIFY_PY = path.join(WE, 'intent', 'classify.py');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

function runPy(body: string, args: string[] = []): SpawnSyncReturns<string> {
    const loader = [
        'import sys, json, importlib.util',
        `_sspec = importlib.util.spec_from_file_location("state", ${JSON.stringify(STATE_PY)})`,
        'state = importlib.util.module_from_spec(_sspec)',
        'sys.modules["state"] = state',
        '_sspec.loader.exec_module(state)',
        `_src = open(${JSON.stringify(CLASSIFY_PY)}, encoding="utf-8").read()`,
        '_src = _src.replace("from ..state import WorkState", "from state import WorkState")',
        'mod = type(sys)("mod")',
        'exec(compile(_src, "mod", "exec"), mod.__dict__)',
    ].join('\n');
    return spawnSync('python3', ['-c', `${loader}\n${body}`, ...args], {
        encoding: 'utf8',
    });
}

/** Python classify_intent(raw, title=...). args: rawJson, titleJson (or "null"). */
function pyClassify(rawJson: string, titleJson: string): string {
    const body = [
        'raw = json.loads(sys.argv[1])',
        'title = json.loads(sys.argv[2])',
        'sys.stdout.write(mod.classify_intent(raw, title=title))',
    ].join('\n');
    const r = runPy(body, [rawJson, titleJson]);
    if (r.status !== 0) throw new Error(`py classify failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function pyDirectiveSet(intentJson: string): string {
    const body = [
        'intent = json.loads(sys.argv[1])',
        'sys.stdout.write(mod.directive_set_for(intent))',
    ].join('\n');
    const r = runPy(body, [intentJson]);
    if (r.status !== 0) throw new Error(`py directive_set failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function pyDirectiveSetError(intentJson: string): string {
    const body = [
        'intent = json.loads(sys.argv[1])',
        'try:',
        '    mod.directive_set_for(intent)',
        '    sys.stdout.write("__NO_ERROR__")',
        'except ValueError as exc:',
        '    sys.stdout.write(str(exc))',
    ].join('\n');
    const r = runPy(body, [intentJson]);
    if (r.status !== 0) throw new Error(`py directive_set error-probe failed: ${r.stderr || r.stdout}`);
    return r.stdout;
}

function tsClassify(rawJson: string, titleJson: string): string {
    const raw = JSON.parse(rawJson) as string;
    const title = JSON.parse(titleJson) as string | null;
    return classify_intent(raw, { title });
}

function tsDirectiveSetError(intentJson: string): string {
    try {
        directive_set_for(JSON.parse(intentJson) as string);
        return '__NO_ERROR__';
    } catch (exc) {
        return (exc as Error).message;
    }
}

const PY = hasPython3();
const describePy = PY ? describe : describe.skip;

// [raw, title-or-null] prompt fixtures spanning every ladder rung.
const CLASSIFY_CASES: Array<[string, string, string]> = [
    ['empty → backend', '', 'null'],
    ['whitespace → backend', '   \t ', 'null'],
    ['plain backend prompt', 'add a webhook listener for the queue', 'null'],
    ['trivial: make the button red', 'make the button red', 'null'],
    ['trivial: rename the label (verb + short)', 'rename the sidebar label', 'null'],
    ['trivial verb but long (>14 words) → not trivial', 'change the button color and also rework the entire dashboard layout with new cards and panels everywhere', 'null'],
    ['mixed: form + endpoint', 'build a form that posts to a new API endpoint', 'null'],
    ['mixed: page + migration', 'the dashboard page needs a schema migration', 'null'],
    ['ui-improve: improve the modal', 'improve the modal spacing', 'null'],
    ['ui-improve: existing surface marker', 'work on the existing dashboard page', 'null'],
    ['ui-build: add a new component', 'add a new sidebar component', 'null'],
    ['ui-build: new screen marker', 'design a new screen for onboarding', 'null'],
    ['ui signal, no verb → ui-improve default', 'the navigation sidebar', 'null'],
    ['ui via style word only (css)', 'tweak the css padding', 'null'],
    ['title carries the UI signal', 'do the thing', JSON.stringify('Redesign the dashboard page')],
    ['title + body concatenated', 'with grid layout', JSON.stringify('New tile component')],
    ['backend word table is NOT a UI noun', 'add an index on the users table', 'null'],
    ['style multiword dark mode', 'support dark mode on the page', 'null'],
    ['trivial pattern across <=40 chars span', 'set the header text to primary', 'null'],
    ['improve verb fix on a panel', 'fix the panel border', 'null'],
];

describePy('intent/classify — classify_intent label parity (python3 vs tsx)', () => {
    for (const [label, raw, title] of CLASSIFY_CASES) {
        it(`identical label — ${label}`, () => {
            const py = pyClassify(JSON.stringify(raw), title);
            const ts = tsClassify(JSON.stringify(raw), title);
            expect(ts).toBe(py);
        });
    }
});

describePy('intent/classify — directive_set_for parity (python3 vs tsx)', () => {
    for (const intent of [...KNOWN_INTENTS]) {
        it(`identical directive set — ${intent}`, () => {
            const py = pyDirectiveSet(JSON.stringify(intent));
            const ts = directive_set_for(intent);
            expect(ts).toBe(py);
        });
    }

    const badCases = ['bogus', 'BACKEND', '', 'ui-build '];
    for (const bad of badCases) {
        it(`identical ValueError text — ${JSON.stringify(bad)}`, () => {
            const py = pyDirectiveSetError(JSON.stringify(bad));
            const ts = tsDirectiveSetError(JSON.stringify(bad));
            expect(py).not.toBe('__NO_ERROR__');
            expect(ts).toBe(py);
        });
    }
});

describe('intent/classify — TS-side unit checks (no python3 needed)', () => {
    it('label constants', () => {
        expect(INTENT_BACKEND).toBe('backend-coding');
        expect(INTENT_MIXED).toBe('mixed');
        expect([...KNOWN_INTENTS].sort()).toEqual([
            'backend-coding',
            'mixed',
            'ui-build',
            'ui-improve',
            'ui-trivial',
        ]);
    });

    it('directive_set_for maps every label', () => {
        expect(directive_set_for(INTENT_UI_BUILD)).toBe('ui');
        expect(directive_set_for(INTENT_UI_IMPROVE)).toBe('ui');
        expect(directive_set_for(INTENT_UI_TRIVIAL)).toBe('ui-trivial');
        expect(directive_set_for(INTENT_MIXED)).toBe('mixed');
        expect(directive_set_for(INTENT_BACKEND)).toBe('backend');
    });

    it('directive_set_for throws ValueError on unknown', () => {
        expect(() => directive_set_for('nope')).toThrow(ValueError);
    });

    it('populate_routing: diff/file route straight to ui-improve', () => {
        const st = new WorkState({ input: new Input('diff', { raw: '--- a\n+++ b\n@@ -1 +1 @@\n' }) });
        populate_routing(st);
        expect(st.intent).toBe('ui-improve');
        expect(st.directive_set).toBe('ui');
    });

    it('populate_routing: prompt envelope classifies from raw', () => {
        const st = new WorkState({ input: new Input('prompt', { raw: 'make the button red' }) });
        populate_routing(st);
        expect(st.intent).toBe('ui-trivial');
        expect(st.directive_set).toBe('ui-trivial');
    });

    it('populate_routing: ticket uses title + first AC', () => {
        const st = new WorkState({
            input: new Input('ticket', {
                title: 'Redesign the dashboard',
                acceptance_criteria: ['improve the layout', ''],
            }),
        });
        populate_routing(st);
        expect(st.intent).toBe('ui-improve');
    });

    it('populate_routing: idempotent / override-safe (non-backend untouched)', () => {
        const st = new WorkState({
            input: new Input('prompt', { raw: 'make the button red' }),
            intent: 'mixed',
            directive_set: 'mixed',
        });
        populate_routing(st);
        expect(st.intent).toBe('mixed');
        expect(st.directive_set).toBe('mixed');
    });

    it('populate_routing: backend default stays backend', () => {
        const st = new WorkState({ input: new Input('prompt', { raw: 'add a queue worker' }) });
        populate_routing(st);
        expect(st.intent).toBe('backend-coding');
        expect(st.directive_set).toBe('backend');
    });
});
