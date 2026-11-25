// The `arena-route` PreToolUse guard: an arena is the bracket engine, never a
// hand-written Workflow named after one.
//
// Drives the concern's entry point (envelope → extract → verdict → exit code).
// The deny cases come first: a guard never seen refuse has unknown sensitivity.
// The allow cases include the real carrier shapes the engine's own procedure
// produces, because a guard that blocks the engine it routes to is worse than
// none. The release is engine STATE: a run whose bracket.json exists.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { engineRun, extractWorkflowCall, main, runDirs, selfTest, verdict, writeEngineRun } from '../../src/scripts/hooks/arena_route_hook.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';

let repo = '';
let elsewhere = '';

beforeAll(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-route-repo-'));
    writeEngineRun(repo, 'tcc-signing');
    // The shape of the real imitation: a run folder the engine never wrote.
    fs.mkdirSync(path.join(repo, 'agents/runtime/bracket/vertrag-01/lines'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'agents/runtime/bracket/vertrag-01/ergebnis.json'), '{}');
    // A bare bracket.json: exists, carries nothing the engine holds a run to.
    fs.mkdirSync(path.join(repo, 'agents/runtime/bracket/bare'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'agents/runtime/bracket/bare/bracket.json'), '{}');
    fs.writeFileSync(path.join(repo, 'agents/runtime/bracket/bare/task.md'), 'x');
    // An engine run whose task.md changed after init: the engine's own task-drift refusal.
    const drifted = writeEngineRun(repo, 'drifted');
    fs.writeFileSync(path.join(drifted, 'task.md'), 'edited after init');
    // A copied run: valid state under another folder name.
    const copied = writeEngineRun(repo, 'original');
    fs.cpSync(copied, path.join(repo, 'agents/runtime/bracket/copied'), { recursive: true });
    elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-route-other-'));
    writeEngineRun(elsewhere, 'abs-run');
});

afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(elsewhere, { recursive: true, force: true });
});

function run(envelope: unknown): number {
    setHookStdinOverride(JSON.stringify(envelope));
    try {
        return main([]);
    } finally {
        clearHookStdinOverride();
    }
}

const handRolled = `export const meta = {
  name: 'pr-gate-arena',
  description: '10-agent arena: decide how the PR test gate should look',
  phases: [{ title: 'Propose' }, { title: 'Judge' }],
}
const proposals = await parallel(OPTIONS.map(o => () => agent(o.text, { label: 'propose:' + o.key })))`;

// The shape of a real line carrier: the run folder named once, with no slash after the run id.
const carrier = `export const meta = {
  name: 'tcc-signing-arena-judge',
  description: 'Judge arena matches: deterministic checks on both lines, rubric scores',
  phases: [{ title: 'Judge' }],
}
const RUN = \`\${REPO}/agents/runtime/bracket/tcc-signing\`
const results = await parallel(args.matches.map(m => () => agent(\`judge \${RUN}/lines/\${m.a}.md\`, { label: \`judge:\${m.id}\` })))`;

const workflow = (input: Record<string, unknown>) => ({ tool_name: 'Workflow', tool_input: input, cwd: repo });
const run_ = (script: string) => run(workflow({ script }));

describe('arena-route — the deny path', () => {
    it('blocks a Workflow whose meta names an arena and that carries no engine run', () => {
        expect(run(workflow({ script: handRolled }))).toBe(1);
    });

    it('blocks the same script passed by path, so a saved script cannot route around it', () => {
        const file = path.join(elsewhere, 'pr-gate-arena.js');
        fs.writeFileSync(file, handRolled);
        expect(run(workflow({ scriptPath: file }))).toBe(1);
    });

    it('blocks a bracket named in the description only', () => {
        const s = `export const meta = { name: 'pick-design', description: 'Tournament bracket of 8 designs' }`;
        expect(verdict(extractWorkflowCall(workflow({ script: s }))).block).toBe(true);
    });

    it('blocks a run whose bracket.json the engine would not accept: bare, drifted or copied', () => {
        for (const run of ['bare', 'drifted', 'copied']) {
            const s = `export const meta = { name: 'x-arena' }\nconst B = \`\${REPO}/agents/runtime/bracket/${run}\``;
            expect(run_(s), run).toBe(1);
        }
    });

    it('blocks a mention of the engine path in a comment — text is not a run', () => {
        const s = `${handRolled}\n// see agents/runtime/bracket/fake for how the engine does it`;
        expect(run(workflow({ script: s }))).toBe(1);
    });

    it('blocks a run folder the engine never wrote (no bracket.json), as the real vertrags-arena did', () => {
        const s = `export const meta = { name: 'vertrags-arena', description: 'contract arena' }\nconst B = '${repo}/agents/runtime/bracket/vertrag-01'`;
        expect(run(workflow({ script: s }))).toBe(1);
    });

    it('names /arena, the engine and /panel in the refusal', () => {
        const v = verdict(extractWorkflowCall(workflow({ script: handRolled })));
        expect(v.reason).toMatch(/\/arena/);
        expect(v.reason).toMatch(/agent-config bracket/);
        expect(v.reason).toMatch(/\/panel/);
    });
});

describe('arena-route — the allow path', () => {
    it('allows a real bracket carrier that names its run relative to the session cwd', () => {
        expect(run(workflow({ script: carrier }))).toBe(0);
    });

    it('allows a carrier that names its run by an absolute path outside the cwd', () => {
        const s = `export const meta = { name: 'x-arena-lines' }\nconst B = '${elsewhere}/agents/runtime/bracket/abs-run'`;
        expect(run(workflow({ script: s }))).toBe(0);
    });

    it('allows a carrier that drives the CLI for a live run', () => {
        const s = `export const meta = { name: 'x-arena-lines', description: 'arena lines' }\n// then: agent-config bracket scan --run tcc-signing`;
        expect(run(workflow({ script: s }))).toBe(0);
    });

    it('allows a Workflow that is not an arena', () => {
        const s = `export const meta = { name: 'find-flaky-tests', description: 'Find flaky tests and propose fixes' }`;
        expect(run(workflow({ script: s }))).toBe(0);
    });

    it('allows a tournament that names no arena or bracket (tournament selection is an algorithm)', () => {
        expect(run_(`export const meta = { name: 'tournament-selection', description: 'genetic algorithm tuning' }`)).toBe(0);
    });

    it('allows a word inside a longer identifier (arenas of the codebase, not an arena run)', () => {
        const s = `export const meta = { name: 'map-arenaviews', description: 'map the ArenaView components' }`;
        expect(run(workflow({ script: s }))).toBe(0);
    });

    it('never looks at another tool', () => {
        expect(run({ tool_name: 'Bash', tool_input: { command: "echo 'arena'" } })).toBe(0);
    });

    it('allows what it cannot read: an unreadable path, an empty or malformed envelope', () => {
        expect(run(workflow({ scriptPath: '/nonexistent/arena.js' }))).toBe(0);
        expect(run({})).toBe(0);
        setHookStdinOverride('{not json');
        try {
            expect(main([])).toBe(0);
        } finally {
            clearHookStdinOverride();
        }
    });

    it('the kill switch lets a hand-rolled arena through', () => {
        process.env['AGENT_CONFIG_ALLOW_HANDROLLED_ARENA'] = '1';
        try {
            expect(run(workflow({ script: handRolled }))).toBe(0);
        } finally {
            delete process.env['AGENT_CONFIG_ALLOW_HANDROLLED_ARENA'];
        }
    });

    it('a named saved workflow is not a script and is allowed', () => {
        expect(run(workflow({ name: 'review-changes' }))).toBe(0);
    });
});

describe('arena-route — run references', () => {
    it('reads a `${REPO}/` prefix as the cwd and an absolute prefix as itself', () => {
        expect(runDirs('`${REPO}/agents/runtime/bracket/a`', '/w')).toEqual(['/w/agents/runtime/bracket/a']);
        expect(runDirs("'/x/y/agents/runtime/bracket/b'", '/w')).toEqual(['/x/y/agents/runtime/bracket/b', '/w/agents/runtime/bracket/b']);
        expect(runDirs('agent-config bracket advance --run c', '/w')).toEqual(['/w/agents/runtime/bracket/c']);
    });
});

describe('arena-route — what counts as an engine run', () => {
    it('accepts the state `bracket init` leaves and refuses each broken invariant', () => {
        expect(engineRun(path.join(repo, 'agents/runtime/bracket/tcc-signing'))).toBe(true);
        expect(engineRun(path.join(repo, 'agents/runtime/bracket/vertrag-01'))).toBe(false);
        expect(engineRun(path.join(repo, 'agents/runtime/bracket/bare'))).toBe(false);
        expect(engineRun(path.join(repo, 'agents/runtime/bracket/drifted'))).toBe(false);
        expect(engineRun(path.join(repo, 'agents/runtime/bracket/copied'))).toBe(false);
        expect(engineRun(path.join(repo, 'agents/runtime/bracket/missing'))).toBe(false);
    });
});

describe('arena-route — self-test', () => {
    it('passes its own fixtures', () => {
        expect(selfTest()).toBe(0);
    });
});
