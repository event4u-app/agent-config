import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A forked evaluator inherits the author's conversation. The doctrine must say so on
// every surface that picks a dispatch primitive or dispatches an evaluator.
const root = path.resolve(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(path.join(root, rel), 'utf8');

describe('judge-never-fork doctrine', () => {
    it('the dispatch_primitive table routes evaluators to subagent before the fork row', () => {
        const doc = read('src/agent-src/contexts/execution/auto-dispatch-classification.md');
        const table = doc.slice(doc.indexOf('| Slice shape | `dispatch_primitive` |'));
        const judgeRow = table.search(/^\| Judges, reviews, validates[^\n]*`subagent`, never `fork`/m);
        const forkRow = table.search(/^\| Continues the parent's task[^\n]*`fork`/m);
        expect(judgeRow).toBeGreaterThan(-1);
        expect(forkRow).toBeGreaterThan(judgeRow);
    });

    it('no longer calls a named subagent the only primitive in use', () => {
        const doc = read('src/agent-src/contexts/execution/auto-dispatch-classification.md');
        expect(doc).not.toContain('the only primitive this suite');
    });

    it.each([
        ['src/skills/subagent-orchestration/SKILL.md', /judge, reviewer or validator is never a fork/],
        ['src/skills/subagent-orchestration/prompts/README.md', /judge, reviewer or\s+validator is never forked/],
        ['src/domains/engineering-base/review/changes/command.md', /named subagent, never\s+a fork/],
    ])('%s carries the mirror sentence', (rel, pattern) => {
        expect(read(rel)).toMatch(pattern);
    });
});
