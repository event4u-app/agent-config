/**
 * Every shipped instruction that reads or acts on `git.update_strategy` passes
 * `--base`.
 *
 * Nothing infers a pull request's base any more: without `--base` the target is
 * the default branch, which for a stacked or release-line PR is a valid carrier
 * at the wrong commit, read with exit 0. So the base has to travel with the
 * call, and a call site that drops it is the defect, found here rather than on
 * the PR it misjudges. `show --key` naming only keys read at `HEAD` is exempt:
 * those never consult the target.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..', '..');
const TREES = ['src/domains', 'src/skills', 'src/agent-src', 'src/rules'];

function markdown(dir: string): string[] {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
}

/** The invocation text: from the verb to the end of its code span, or to a shell comment. */
export function invocations(text: string): string[] {
    const found: string[] = [];
    for (const line of text.split('\n')) {
        for (const m of line.matchAll(/git:convention (sync|show)|sync_pr_branch(?= --|`? now)/g)) {
            const rest = line.slice(m.index);
            found.push(rest.split(/`|\s#/)[0] as string);
        }
    }
    return found;
}

export function missingBase(call: string): boolean {
    if (/--base\s+\S/.test(call)) return false;
    if (!/^git:convention show/.test(call)) return true;
    const keys = [...call.matchAll(/--key\s+(\S+)/g)].map((k) => k[1]);
    return keys.length === 0 || keys.includes('update_strategy');
}

describe('PR-scoped git:convention calls carry --base', () => {
    it('the detector flags a dropped base and spares a HEAD-only key', () => {
        expect(missingBase('git:convention sync')).toBe(true);
        expect(missingBase('git:convention show')).toBe(true);
        expect(missingBase('git:convention show --key update_strategy')).toBe(true);
        expect(missingBase('git:convention sync --base origin/<base>')).toBe(false);
        expect(missingBase('git:convention show --key update_strategy --base origin/<base>')).toBe(false);
        expect(missingBase('git:convention show --key commit_format')).toBe(false);
        expect(invocations('run `agent-config git:convention sync`, then')).toEqual(['git:convention sync']);
    });

    it('every call site in the shipped trees passes --base', () => {
        const offenders: string[] = [];
        let seen = 0;
        for (const file of TREES.flatMap(markdown)) {
            const calls = invocations(fs.readFileSync(path.join(ROOT, file), 'utf8'));
            seen += calls.length;
            for (const call of calls) if (missingBase(call)) offenders.push(`${file}: ${call}`);
        }
        expect(seen).toBeGreaterThanOrEqual(6);
        expect(offenders).toEqual([]);
    });
});
