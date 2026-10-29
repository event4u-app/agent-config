// The `recurring-criticism` rule and the self-repair user-report detector name
// the same moment twice: the rule's triggers say "the user brought it back", the
// detector decides whether that turn becomes a record. A trigger the detector
// does not catch is a recurrence the occurrences counter never sees, so every
// trigger either fires the detector or carries a stated reason here.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as YAML from 'yaml';

import { detectUserReport } from '../../src/scripts/_lib/self_repair.js';

const RULE = path.join(process.cwd(), 'src', 'rules', 'recurring-criticism.md');

const ALLOWLIST: Record<string, string> = {
    'schon mehrfach':
        'a bare count fires on ordinary prose ("schon mehrfach erfolgreich gelaufen"); the detector requires a saying-verb next to it',
    'schon wieder':
        'a bare repetition word ("schon wieder Montag") is not a complaint; the detector requires a second-person clause nearby',
};

function triggers(): string[] {
    const text = fs.readFileSync(RULE, 'utf-8');
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (m === null) {
        throw new Error(`no frontmatter in ${RULE}`);
    }
    const fm = YAML.parse(m[1] ?? '') as { triggers?: Array<{ phrase?: string }> };
    return (fm.triggers ?? []).map((t) => t.phrase ?? '').filter((p) => p.length > 0);
}

/** A complaint sentence whose only recurrence signal is the trigger itself. */
function complaint(phrase: string): string {
    return `${phrase}: wir nutzen Tabs!`;
}

describe('recurring-criticism triggers stay in step with detectUserReport', () => {
    const phrases = triggers();

    it('reads triggers from the rule', () => {
        expect(phrases.length).toBeGreaterThan(0);
    });

    it.each(phrases)('trigger %j fires the user-report detector', (phrase) => {
        if (phrase in ALLOWLIST) {
            expect(ALLOWLIST[phrase]?.length ?? 0).toBeGreaterThan(0);
            return;
        }
        expect(
            detectUserReport(complaint(phrase)),
            `"${complaint(phrase)}" did not fire — add a COMPLAINT_PATTERNS branch or an allowlist reason`,
        ).not.toBeNull();
    });

    it('allowlists only phrases the rule still names', () => {
        for (const phrase of Object.keys(ALLOWLIST)) {
            expect(phrases, `stale allowlist entry ${phrase}`).toContain(phrase);
        }
    });
});
