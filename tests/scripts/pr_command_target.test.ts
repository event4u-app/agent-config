// Text contract for how a PR command picks its target PR — road-to-mandates-
// scoped-to-the-goal 1.3. Both commands resolve the PR in one fixed order:
// explicit URL → the session default target (the one OPEN row of the
// `<session-prs>` block the session-register hook injects) → current-branch
// detection → ask once. A PR number recalled from the conversation stays
// forbidden; the session store is not that, because a hook writes it from
// `gh pr create` output.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const COMMANDS = [
    'src/domains/engineering-base/fix/pr-comments-loop/command.md',
    'src/domains/engineering-base/fix/pr-comments/command.md',
    'src/domains/engineering-base/prepare-for-review/command.md',
];

function inputSection(file: string): string {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf-8');
    const start = text.indexOf('\n## Input');
    expect(start, `${file} has an Input section`).toBeGreaterThan(-1);
    const next = text.indexOf('\n## ', start + 1);
    return text.slice(start, next === -1 ? undefined : next);
}

const plain = (s: string): string => s.replace(/\*\*/g, '');

describe.each(COMMANDS)('%s — PR target order', (file) => {
    const section = inputSection(file);
    const body = plain(section);

    it('names the four sources in order: URL → session default → current branch → ask once', () => {
        const at = [
            body.search(/explicit PR URL/i),
            body.indexOf('`<session-prs>` block lists exactly'),
            body.search(/current branch/i),
            body.search(/ask (?:for it |the user )?once/i),
        ];
        for (const i of at) expect(i).toBeGreaterThan(-1);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
    });

    it('uses a resolved PR and names it in one line, without a confirmation question', () => {
        expect(body).toMatch(/name it in one line/i);
        expect(body).not.toMatch(/Is that the one\?/);
        expect(body).not.toMatch(/Wait for confirmation/i);
    });

    it('keeps recalled PR numbers forbidden and says why the session store is not memory', () => {
        expect(body).not.toContain('Never reuse a PR number from earlier in the conversation');
        expect(body).toMatch(/PR number recalled from the conversation/i);
        expect(body).toMatch(/gh pr create/);
        expect(body).toMatch(/hook/i);
    });
});

describe('pr-comments-loop keeps its prod-trunk refusal verbatim', () => {
    it('still refuses a PR whose head branch is a production trunk', () => {
        const text = fs.readFileSync(path.join(ROOT, COMMANDS[0] as string), 'utf-8');
        expect(text).toContain(
            "if the PR's head branch **is** a production trunk\n(`main`, `master`, `prod*`, `release/*`), refuse and stop before iteration 1.",
        );
    });
});
