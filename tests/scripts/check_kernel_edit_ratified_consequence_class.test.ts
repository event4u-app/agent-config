import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    CONSEQUENCE_CLASS_PATHS,
    classifyPaths,
    consequenceRuleSlugs,
    evaluate,
    requiresRatification,
} from '../../src/scripts/check_kernel_edit_ratified.js';
import { is_kernel_rule } from '../../src/scripts/_lib/kernel_rules.js';
import { gatedFilesOf } from '../../src/scripts/_lib/ratification_subject.js';

/**
 * Step 4.2 — rule law beyond the nine kernel rules.
 *
 * The gate's reach was the nine kernel rules by name. The high-consequence
 * class of `rule-consequence-class.json` is 28 rules selected by a CRITERION
 * rather than by name, and a rule earns a row by what its own law obligates —
 * so a rule whose law is an authority boundary or a security boundary was
 * editable without a record simply because it was not one of the nine.
 *
 * The list and its criterion join the watch list, so that a change cannot drop
 * a member in order to edit the rule that member names. That is the case the
 * step is really about, and it has its own test below.
 */

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'conseq-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/** A member of the class that is NOT one of the nine — the whole point of 4.2. */
function nonKernelMember(): string {
    const slug = [...consequenceRuleSlugs()].find((s) => !is_kernel_rule(s));
    expect(slug, 'the class must contain a rule outside the kernel').toBeDefined();
    return slug as string;
}

describe('the class is read from the gate’s own tree', () => {
    it('is non-empty and selected by the criterion, not by this test', () => {
        const slugs = consequenceRuleSlugs();
        expect(slugs.size).toBeGreaterThanOrEqual(20);
        // Read back from the file rather than asserted as a literal: the list is
        // the criterion's output and a number pinned here would go stale the
        // moment a rule earns or loses its row.
        const raw = JSON.parse(
            fs.readFileSync(
                path.join(
                    path.resolve(__dirname, '..', '..'),
                    CONSEQUENCE_CLASS_PATHS[0] as string,
                ),
                'utf8',
            ),
        ) as { members: Record<string, unknown> };
        expect(slugs.size).toBe(Object.keys(raw.members).length);
    });

    it('an absent or unparseable list WIDENS nothing and refuses nothing', () => {
        // Deliberately asymmetric with the quorum policy, which fails closed.
        // That policy decides whether a control can measure at all; this list
        // only widens the gated set, so losing it falls back to the pre-4.2
        // kernel-and-hooks reach rather than opening a door.
        expect(consequenceRuleSlugs(root).size).toBe(0);
    });
});

describe('a high-consequence rule outside the kernel needs a record', () => {
    it('is gated, and named as a high-consequence rule', () => {
        const rel = `src/rules/${nonKernelMember()}.md`;
        const g = classifyPaths([rel]);
        expect(g.consequenceRules).toEqual([rel]);
        expect(g.kernelRules).toEqual([]);
        expect(requiresRatification(g)).toBe(true);

        const r = evaluate([rel], root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain(`high-consequence rule ${rel}`);
    });

    it('enters the digest, so a record is bound to it', () => {
        const rel = `src/rules/${nonKernelMember()}.md`;
        expect([...gatedFilesOf([rel])]).toContain(rel);
    });

    it('a rule OUTSIDE the class is still an ordinary change', () => {
        const slugs = consequenceRuleSlugs();
        const outsider = 'markdown-safe-codeblocks';
        expect(slugs.has(outsider), `${outsider} must not be in the class`).toBe(false);
        const rel = `src/rules/${outsider}.md`;
        expect(requiresRatification(classifyPaths([rel]))).toBe(false);
        expect(evaluate([rel], root, 2).exitCode).toBe(0);
    });

    it('a kernel rule is still reported as a kernel rule, not reclassified', () => {
        const g = classifyPaths(['src/rules/commit-policy.md']);
        expect(g.kernelRules).toEqual(['src/rules/commit-policy.md']);
        expect(g.consequenceRules).toEqual([]);
    });
});

describe('the list and its criterion cannot be edited without a record', () => {
    it.each([...CONSEQUENCE_CLASS_PATHS])('%s is gated', (p) => {
        expect(requiresRatification(classifyPaths([p]))).toBe(true);
    });

    it('dropping a member in order to edit its rule still needs a record', () => {
        // The move the watch list exists to make visible: the same diff removes
        // a rule from the class AND edits that rule. The list edit is gated, so
        // the diff carries a record either way.
        const rel = `src/rules/${nonKernelMember()}.md`;
        const diff = [CONSEQUENCE_CLASS_PATHS[0] as string, rel];
        const r = evaluate(diff, root, 2);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('the review mechanism itself');
    });
});
