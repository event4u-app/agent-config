// The `arena-route` PreToolUse guard: an arena is the bracket engine, never a
// hand-written Workflow named after one.
//
// Drives the concern's entry point (envelope → extract → verdict → exit code).
// The deny cases come first: a guard never seen refuse has unknown sensitivity.
// The allow cases include the real carrier shapes the engine's own procedure
// produces, because a guard that blocks the engine it routes to is worse than
// none.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { extractWorkflowCall, main, selfTest, verdict } from '../../src/scripts/hooks/arena_route_hook.js';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';

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

const workflow = (input: Record<string, unknown>) => ({ tool_name: 'Workflow', tool_input: input });

describe('arena-route — the deny path', () => {
    it('blocks a Workflow whose meta names an arena and that never touches the bracket engine', () => {
        expect(run(workflow({ script: handRolled }))).toBe(1);
    });

    it('blocks the same script passed by path, so a saved script cannot route around it', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-route-'));
        const file = path.join(dir, 'pr-gate-arena.js');
        fs.writeFileSync(file, handRolled);
        expect(run(workflow({ scriptPath: file }))).toBe(1);
    });

    it('blocks a bracket or tournament named in the description only', () => {
        const s = `export const meta = { name: 'pick-design', description: 'Tournament bracket of 8 designs' }`;
        expect(verdict(extractWorkflowCall(workflow({ script: s }))).block).toBe(true);
    });

    it('names /arena and the engine in the refusal', () => {
        const v = verdict(extractWorkflowCall(workflow({ script: handRolled })));
        expect(v.reason).toMatch(/\/arena/);
        expect(v.reason).toMatch(/agent-config bracket/);
    });
});

describe('arena-route — the allow path', () => {
    it('allows a real bracket carrier that names the run folder with no trailing slash', () => {
        expect(run(workflow({ script: carrier }))).toBe(0);
    });

    it('allows a carrier that drives the CLI', () => {
        const s = `export const meta = { name: 'x-arena-lines', description: 'arena lines' }\n// then: agent-config bracket scan --run x`;
        expect(run(workflow({ script: s }))).toBe(0);
    });

    it('allows a Workflow that is not an arena', () => {
        const s = `export const meta = { name: 'find-flaky-tests', description: 'Find flaky tests and propose fixes' }`;
        expect(run(workflow({ script: s }))).toBe(0);
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

describe('arena-route — self-test', () => {
    it('passes its own fixtures', () => {
        expect(selfTest()).toBe(0);
    });
});
