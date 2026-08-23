import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { DeliveryState } from '../../../src/agent-src/templates/scripts/work_engine/delivery_state.js';
import {
    _playbook_lines,
    _read_playbook,
    _scaffold_playbooks,
    run as scaffoldRun,
} from '../../../src/agent-src/templates/scripts/work_engine/directives/ui/scaffold.js';

const PLAYBOOK = [
    '---',
    'task: "Add a new component to this repository"',
    'scope: "packages/ui"',
    'grade: "configured"',
    'invokes:',
    '  - "turbo gen component"',
    '---',
    '',
    '1. Run the generator.',
].join('\n');

/** A project root with an optional playbook home. */
const project = (playbook: string | null): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-playbook-'));
    if (playbook !== null) {
        const home = path.join(root, 'agents', 'settings', 'contexts');
        fs.mkdirSync(home, { recursive: true });
        fs.writeFileSync(path.join(home, 'add-ui-component.md'), playbook, 'utf8');
    }
    return root;
};

/** Run the scaffold lane with cwd pinned, the way the engine runs in a consumer project. */
const runIn = (root: string): { questions: string[]; message: string } => {
    const prev = process.cwd();
    process.chdir(root);
    try {
        const st = new DeliveryState({
            ui_audit: { greenfield: true, greenfield_decision: 'scaffold' },
            stack: { frontend: 'react-shadcn', scope_root: 'packages/ui' },
            ui_design: { locked: true },
            ui_scaffold: { pages: ['Home', 'Settings'], routes: ['/', '/settings'] },
        } as never);
        const r = scaffoldRun(st);
        return { questions: r.questions as string[], message: r.message as string };
    } finally {
        process.chdir(prev);
    }
};

describe('UI lane reads playbooks (step 2.2)', () => {
    describe('the step verify — both halves', () => {
        it("proposes the repository's generator ahead of the stack-skill content", () => {
            const q = runIn(project(PLAYBOOK)).questions;
            const body = q.join('\n');
            expect(body, 'the generator id must reach the human').toContain('turbo gen component');

            const playbookAt = q.findIndex((l) => l.includes('turbo gen component'));
            const stackAt = q.findIndex((l) => l.includes('Scaffold plan is ready'));
            expect(playbookAt).toBeGreaterThanOrEqual(0);
            expect(stackAt).toBeGreaterThanOrEqual(0);
            // The @agent-directive marker stays at index 0 — it is the engine's dispatch
            // target, not a step the human performs. The ordering claim is about the CONTENT
            // lines: the repository's own procedure is read before the stack skill's brief.
            expect(playbookAt).toBeLessThan(stackAt);
            expect(q[0]).toContain('agent-directive');
        });

        it('is byte-identical to HEAD behaviour when the playbook home is empty', () => {
            // The other half of the verify, and the one that protects every existing
            // consumer: no playbook home → not one extra character.
            const withNone = runIn(project(null));
            const withEmptyHome = (() => {
                const root = project(null);
                fs.mkdirSync(path.join(root, 'agents', 'settings', 'contexts'), { recursive: true });
                return runIn(root);
            })();
            expect(withEmptyHome).toEqual(withNone);
            expect(withNone.questions.join('\n')).not.toContain('own procedure');
        });
    });

    describe('what the lane refuses to dispatch', () => {
        it('ignores an observed playbook — advisory never outranks a gate', () => {
            const observed = PLAYBOOK.replace('grade: "configured"', 'grade: "observed"');
            const body = runIn(project(observed)).questions.join('\n');
            expect(body).not.toContain('turbo gen component');
        });

        it('ignores a playbook scoped to a different workspace', () => {
            const other = PLAYBOOK.replace('scope: "packages/ui"', 'scope: "packages/api"');
            const body = runIn(project(other)).questions.join('\n');
            expect(body).not.toContain('turbo gen component');
        });

        it('accepts a repo-scoped playbook', () => {
            const repo = PLAYBOOK.replace('scope: "packages/ui"', 'scope: "repo"');
            expect(runIn(project(repo)).questions.join('\n')).toContain('turbo gen component');
        });

        it('ignores a configured playbook with an empty invokes list', () => {
            // Nothing to propose. Emitting "the repository's procedure" with no command
            // would be worse than silence — it asserts authority and gives no action.
            const empty = ['---', 'task: "Add a component"', 'scope: "repo"', 'grade: "configured"', 'invokes:', '---', ''].join('\n');
            expect(_read_playbook.length).toBeGreaterThan(0);
            const root = project(empty);
            expect(runIn(root).questions.join('\n')).not.toContain('own procedure');
        });

        it('ignores a playbook whose task is unrelated to the verb', () => {
            const unrelated = PLAYBOOK.replace(
                'task: "Add a new component to this repository"',
                'task: "Rotate the production database credentials"',
            );
            expect(runIn(project(unrelated)).questions.join('\n')).not.toContain('turbo gen component');
        });
    });

    describe('the lines themselves', () => {
        it('say propose-never-run, because a playbook is authoritative about what, not who runs it', () => {
            const lines = _playbook_lines([
                { file: 'x/add-ui-component.md', task: 'Add a component', invokes: ['turbo gen component'] },
            ]);
            expect(lines.join('\n')).toContain('Propose, never run');
            expect(lines.join('\n')).toContain('goes FIRST');
        });

        it('are empty for an empty match set', () => {
            expect(_playbook_lines([])).toEqual([]);
        });

        it('scope matching treats a sibling workspace as no match', () => {
            const root = project(PLAYBOOK);
            const st = new DeliveryState({ stack: { scope_root: 'packages/ui-kit' } } as never);
            expect(_scaffold_playbooks(st, ['component'], root)).toEqual([]);
        });
    });
});
