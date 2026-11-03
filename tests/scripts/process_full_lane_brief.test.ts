import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { procedureText } from '../_lib/procedure_text.js';

const COMMAND = path.resolve(__dirname, '../../src/domains/product-basic/roadmap/process-full/command.md');

function section(text: string, heading: string): string {
    const start = text.indexOf(heading);
    if (start < 0) return '';
    const rest = text.slice(start + heading.length);
    const next = rest.search(/\n#{2,3} /);
    return next < 0 ? rest : rest.slice(0, next);
}

/** The fenced brief inside `### Lanes`. */
export function laneBrief(text: string): string {
    const lanes = section(text, '### Lanes');
    const m = /```text\n([\s\S]*?)\n```/.exec(lanes);
    return m?.[1] ?? '';
}

const FORBIDDEN: readonly RegExp[] = [
    /open,? (and )?green PR/i,
    /partial (progress )?PR/i,
    /phase \d+ only|only phase/i,
    /remove (that|the) part/i,
    /do not ask the owner/i,
];

const text = procedureText(path.relative(path.resolve(__dirname, '..', '..'), COMMAND));

describe('process-full lane brief', () => {
    const brief = laneBrief(text);

    it('exists and sets count_open == 0 and one PR as the finish line', () => {
        expect(brief).toMatch(/finish line is count_open == 0 for this roadmap and exactly ONE pull request/);
    });

    it('leaves revalidation at run start to the loop every lane runs', () => {
        const loopSet = fs.readFileSync(path.resolve(__dirname, '../../src/agent-src/contexts/execution/roadmap-process-loop-set.md'), 'utf-8');
        expect(loopSet).toMatch(/At run start and on resume the same check runs before the first mutation/);
        expect(loopSet).toMatch(/freshness/);
    });

    it('forbids intermediate pushes and self-flipped boxes', () => {
        expect(brief).toMatch(/no intermediate push, PR or merge/);
        expect(brief).toMatch(/Do not flip checkboxes/);
        expect(brief).toMatch(/gated: <step>/);
    });

    it.each(FORBIDDEN.map((re) => [re.source, re] as const))('carries no %s', (_src, re) => {
        expect(brief).not.toMatch(re);
    });
});

describe('process-full finish-first contract', () => {
    it('states one roadmap, one PR, and finish-before-start in the Iron Law', () => {
        const law = section(text, '## Iron Law — Full is Full');
        expect(law).toMatch(/ONE ROADMAP, ONE PR: NO PUSH, PR OR MERGE OF A ROADMAP BEFORE ITS LAST STEP/);
        expect(law).toMatch(/NO PR OF A ROADMAP IS MERGED BEFORE ITS LANE REPORTS `complete`/);
        expect(law).toMatch(/A STARTED ROADMAP THAT CAN STILL MOVE IS FINISHED BEFORE ANY OTHER IS STARTED/);
    });

    it('takes the queue from the script, not from prose by percent', () => {
        const all = section(text, '### `--all`');
        expect(all).toMatch(/src\/scripts\/roadmap_drain_queue/);
        expect(all).not.toMatch(/in \*\*descending\*\* progress/);
        expect(all).toMatch(/widens how many roadmaps are FINISHED, never how\s+many are STARTED/);
    });

    it('caps lanes at two and reports a higher ask', () => {
        expect(section(text, '### Lanes')).toMatch(/At most two lanes run at once/);
    });
});

describe('process-full scope-delta row agrees with the execution contract (ADR-237)', () => {
    const EXEC = path.resolve(__dirname, '../../src/agent-src/contexts/execution');
    const close = fs.readFileSync(path.join(EXEC, 'roadmap-process-loop-close.md'), 'utf8');
    const contract = fs.readFileSync(path.join(EXEC, 'roadmap-execution-contract.md'), 'utf8');
    const row = (wrapper: string): string[] =>
        (close.split('\n').find((l) => l.startsWith(`| \`${wrapper}\` |`)) ?? '')
            .split('|')
            .map((c) => c.trim());

    it('the contract still says the process-full invocation IS the confirmation', () => {
        expect(contract.replace(/\s+/g, ' ')).toMatch(/the invocation IS the confirmation/);
    });

    it('the process-full row does not gate the contract on execution.mode', () => {
        const cell = row('process-full')[4] ?? '';
        expect(cell).not.toBe('');
        expect(cell).toMatch(/invocation is the confirmation/i);
        expect(cell).toMatch(/ADR-237/);
        expect(cell).not.toMatch(/^When `execution\.mode/);
    });

    it('the process-phase row keeps its execution.mode gate', () => {
        expect(row('process-phase')[4]).toMatch(/^When `execution\.mode: autonomous/);
    });
});

describe('process-full says one thing about who grants the run (inbox-2026-11-v Phase 1)', () => {
    const flat = text.replace(/\s+/g, ' ');

    it('its scope delta does not ask for an acceptance the invocation already gave', () => {
        expect(flat).not.toMatch(/ONE acceptance activates/);
        expect(section(text, '## Scope delta').replace(/\s+/g, ' ')).toMatch(
            /the invocation is the confirmation/i,
        );
    });

    it('names the process-phase rules it inherits instead of inheriting all of them', () => {
        const rules = section(text, '## Rules').replace(/\s+/g, ' ');
        expect(rules).not.toMatch(/All other rules from .{0,80}apply unchanged/);
        expect(rules).toMatch(/dashboard sync/i);
        expect(rules).toMatch(/council/i);
        expect(rules).toMatch(/decline = silence/i);
    });

    it('turns owner answers in the invocation into dated owner rows, never council rows', () => {
        const contract = fs
            .readFileSync(path.resolve(__dirname, '../../src/agent-src/contexts/execution/roadmap-execution-contract.md'), 'utf8')
            .replace(/\s+/g, ' ');
        expect(contract).toMatch(/### 2d\. Owner answers carried by the invocation/);
        expect(contract).toMatch(/`owner \(invocation, <date>\)`/);
        expect(contract).toMatch(/never a council row/i);
        expect(flat).toMatch(/2d\. Owner answers carried by the invocation|owner answers carried by the invocation/i);
    });

    it('lets the invocation declare the run-level policy and keeps it across a resume', () => {
        expect(text).toMatch(/argument-hint: ".*--late-artifacts auto-research.*"/);
        expect(text).toMatch(/argument-hint: ".*--deferred spawn-follow-up-draft.*"/);
        const contract = fs
            .readFileSync(path.resolve(__dirname, '../../src/agent-src/contexts/execution/roadmap-execution-contract.md'), 'utf8')
            .replace(/\s+/g, ' ');
        expect(contract).toMatch(/`--late-artifacts auto-research`/);
        expect(contract).toMatch(/`--deferred spawn-follow-up-draft`/);
        expect(contract).toMatch(/Decisions table.{0,80}survives a resumed run/i);
    });

    it('records the environment at run start without stopping on it', () => {
        const delivery = fs.readFileSync(
            path.resolve(__dirname, '../../src/agent-src/contexts/execution/process-full-delivery.md'),
            'utf8',
        );
        expect(delivery).toMatch(/hooks:status/);
        expect(delivery).toMatch(/routing:doctor/);
    });
});
