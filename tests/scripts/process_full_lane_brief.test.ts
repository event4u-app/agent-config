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
