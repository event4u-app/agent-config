/**
 * AC-1 of `road-to-an-analysis-family-that-deepens-itself`: from a subfolder
 * EVERY one of the four ADR-288 doors prints the scope line before any read.
 *
 * `analysis_target.test.ts` pins the resolver — that a module without a marker
 * places under the outer project, that `project_root` stays the outer one. It
 * cannot see whether a door actually calls it, and the source door did not,
 * so an invocation there printed no scope at all. This is the per-door half:
 * one assertion per door, so a door that drops the line fails here rather than
 * in a run nobody replays.
 *
 * The contract is the obligation, not one phrasing: a door satisfies it by
 * naming the scope line (or the template `analysis-loop` defines) and saying,
 * within that sentence, that it comes first.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOORS = ['repo', 'and-optimize', 'pr', 'inbox'] as const;
/** `scope line`, or the template itself, which is the same obligation spelled out. */
const MENTION = /scope line|Scope: <repo\|module\|subdir>/gu;
const FIRST = /\bfirst\b|\bbefore any read\b|\bbefore it reads\b/u;

function door(name: string): string {
    return fs.readFileSync(
        path.join(ROOT, 'src/domains/analysis-workbench/analyze', name, 'command.md'),
        'utf-8',
    );
}

describe('the four doors resolve and print one scope', () => {
    for (const name of DOORS) {
        it(`${name} prints the scope line before it reads`, () => {
            const text = door(name);
            const windows = [...text.matchAll(MENTION)].map((m) =>
                text.slice(Math.max(0, m.index - 200), m.index + 200),
            );
            expect(windows.length).toBeGreaterThan(0);
            expect(windows.some((w) => FIRST.test(w))).toBe(true);
        });
    }

    it('every door links the context that defines the line and names its resolver', () => {
        for (const name of DOORS) {
            expect(door(name)).toContain('](../../contexts/execution/analysis-loop.md)');
        }
        const ctx = fs.readFileSync(
            path.join(ROOT, 'src/agent-src/contexts/execution/analysis-loop.md'),
            'utf-8',
        );
        expect(ctx).toContain('analysis_target.ts');
    });
});
