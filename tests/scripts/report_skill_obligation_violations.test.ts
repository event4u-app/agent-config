// SK-2 loaded-but-violated (round-6 Phase 3.2 / 3.3).
//
// The live run returns ZERO flags over 137 sessions, so these fixtures ARE the
// evidence that the detector discriminates. Without a firing case, "0 flags" and
// "blind" are the same output — the false-green class this repo has recorded four
// times from its own history. Every negative case below is a false positive the
// detector must refuse: a read instead of a write, an act before the skill loaded,
// the artefact touched in a session that never loaded the skill.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    extractObligations,
    loadedSkills,
    render,
    scanSessionForViolations,
    scanStore,
    type Obligation,
} from '../../src/scripts/report_skill_obligation_violations.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sk2-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) {
        fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
    }
});

/** The injected form a skill body takes when it reaches context. */
function skillBody(name: string): string {
    return JSON.stringify({
        type: 'user',
        message: { content: `Base directory for this skill: /Users/x/.claude/skills/${name}\n\n# ${name}\n` },
    });
}

function assistant(tools: Array<{ name: string; input: Record<string, unknown> }>): string {
    return JSON.stringify({
        type: 'assistant',
        message: { content: tools.map((t) => ({ type: 'tool_use', name: t.name, input: t.input })) },
    });
}

const FORBIDDEN_PATH: Obligation = {
    skill: 'license-compliance-credits',
    line: '- NEVER hand-edit `docs/THIRD-PARTY-NOTICES.md`.',
    artefact: 'docs/THIRD-PARTY-NOTICES.md',
    kind: 'path',
    polarity: 'forbidden',
};
const FORBIDDEN_CMD: Obligation = {
    skill: 'rtk-output-filtering',
    line: '**NEVER `cargo install rtk`**',
    artefact: 'cargo install rtk',
    kind: 'command',
    polarity: 'forbidden',
};

describe('extractObligations — derived from the shipped skills, never a list', () => {
    it('reads the real corpus and separates forbidden from prescribed artefacts', () => {
        const c = extractObligations(REPO_ROOT);
        // The census set, not a number this test owns: the point of importing it
        // is that "the 30" has one definition.
        expect(c.skills.length).toBeGreaterThan(0);
        expect(c.totalLines).toBeGreaterThan(c.withArtefact.length);
        expect(c.forbidden.length + c.prescribed.length).toBe(c.withArtefact.length);
        // Every forbidden artefact must be non-empty and attributed to a skill in
        // the census set — a detector rule with no owner is unauditable.
        for (const o of c.forbidden) {
            expect(o.artefact).not.toBe('');
            expect(c.skills).toContain(o.skill);
        }
    });

    it('classifies the prescribed alternative as prescribed, not as the offence', () => {
        // `using-git-worktrees`: "NEVER `rm -rf` a worktree — use `git worktree
        // remove`". A naive extraction lifts the remedy and flags the fix.
        const c = extractObligations(REPO_ROOT);
        const remedy = c.prescribed.find((o) => o.artefact.startsWith('git worktree'));
        expect(remedy, 'the worktree remedy must be classified prescribed').toBeDefined();
        expect(c.forbidden.map((o) => o.artefact)).not.toContain('git worktree remove');
    });

    it('does not count a bare prose absolute as artefact-bearing', () => {
        const c = extractObligations(REPO_ROOT);
        // The overwhelming majority are judgement calls; if this ratio ever
        // inverted, the extraction has started matching prose.
        expect(c.withArtefact.length).toBeLessThan(c.totalLines / 2);
    });
});

describe('loadedSkills', () => {
    it('records an injected body and a Skill call, at their first occurrence', () => {
        const loaded = loadedSkills([
            '',
            skillBody('rtk-output-filtering'),
            assistant([{ name: 'Skill', input: { skill: 'ai-council' } }]),
            skillBody('rtk-output-filtering'),
        ]);
        expect(loaded.get('rtk-output-filtering')).toBe(1);
        expect(loaded.get('ai-council')).toBe(2);
    });

    it('normalises a slash-command spelling to the skill stem', () => {
        const loaded = loadedSkills([assistant([{ name: 'Skill', input: { skill: 'roadmap:process-full' } }])]);
        expect(loaded.has('roadmap-process-full')).toBe(true);
    });

    it('survives a malformed line without losing the rest of the session', () => {
        const loaded = loadedSkills(['{not json', skillBody('rtk-output-filtering')]);
        expect(loaded.has('rtk-output-filtering')).toBe(true);
    });
});

describe('scanSessionForViolations — it fires, and on what', () => {
    it('flags a write to the forbidden path after the skill loaded', () => {
        const flags = scanSessionForViolations(
            's',
            [
                skillBody('license-compliance-credits'),
                assistant([{ name: 'Edit', input: { file_path: '/repo/docs/THIRD-PARTY-NOTICES.md', new_string: 'x' } }]),
            ],
            [FORBIDDEN_PATH],
        );
        expect(flags).toHaveLength(1);
        expect(flags[0]).toMatchObject({ skill: 'license-compliance-credits', kind: 'path', tool: 'Edit', loadedAt: 0, at: 1 });
        // The evidence quote is what makes the flag hand-checkable by someone who
        // was not in the session — 3.3 depends on it.
        expect(flags[0]?.evidence).toContain('THIRD-PARTY-NOTICES.md');
    });

    it('flags the forbidden command in a shell call after the skill loaded', () => {
        const flags = scanSessionForViolations(
            's',
            [skillBody('rtk-output-filtering'), assistant([{ name: 'Bash', input: { command: 'cargo install rtk --force' } }])],
            [FORBIDDEN_CMD],
        );
        expect(flags).toHaveLength(1);
        expect(flags[0]).toMatchObject({ kind: 'command', tool: 'Bash' });
    });

    it('does NOT flag a read of the forbidden path — the obligation is about editing', () => {
        const flags = scanSessionForViolations(
            's',
            [
                skillBody('license-compliance-credits'),
                assistant([{ name: 'Read', input: { file_path: '/repo/docs/THIRD-PARTY-NOTICES.md' } }]),
                assistant([{ name: 'Grep', input: { pattern: 'x', path: 'docs/THIRD-PARTY-NOTICES.md' } }]),
            ],
            [FORBIDDEN_PATH],
        );
        expect(flags).toEqual([]);
    });

    it('does NOT flag an act that precedes the load — loaded-BUT-violated, in that order', () => {
        const flags = scanSessionForViolations(
            's',
            [
                assistant([{ name: 'Edit', input: { file_path: 'docs/THIRD-PARTY-NOTICES.md' } }]),
                skillBody('license-compliance-credits'),
            ],
            [FORBIDDEN_PATH],
        );
        // A skill invoked to clean up after an edit must not be read as having
        // caused it.
        expect(flags).toEqual([]);
    });

    it('does NOT flag when the skill was never in context — that would be a repo-wide grep', () => {
        const flags = scanSessionForViolations(
            's',
            [assistant([{ name: 'Edit', input: { file_path: 'docs/THIRD-PARTY-NOTICES.md' } }])],
            [FORBIDDEN_PATH],
        );
        expect(flags).toEqual([]);
    });

    it('does not cross the wire between a path rule and a shell call', () => {
        // A path obligation is about a write tool; naming the path inside a shell
        // command (a `cat`, a `git add`) is not the hand-edit it forbids.
        const flags = scanSessionForViolations(
            's',
            [skillBody('license-compliance-credits'), assistant([{ name: 'Bash', input: { command: 'git add docs/THIRD-PARTY-NOTICES.md' } }])],
            [FORBIDDEN_PATH],
        );
        expect(flags).toEqual([]);
    });
});

describe('the report is advisory and leads with coverage', () => {
    it('prints the coverage ratio above the flag count', () => {
        const r = scanStore(REPO_ROOT, path.join(tmpdir(), 'no-store'), 5);
        const out = render(r);
        expect(out).toMatch(/COVERAGE \(the headline/);
        expect(out.indexOf('COVERAGE')).toBeLessThan(out.indexOf('Flags:'));
        // The uncovered majority is named, not implied.
        expect(out).toMatch(/reported as uncovered rather than approximated/);
        expect(out).toMatch(/PRECISION/);
    });

    it('returns an empty report for an absent store instead of throwing', () => {
        const r = scanStore(REPO_ROOT, path.join(tmpdir(), 'absent'), 5);
        expect(r.sessions).toBe(0);
        expect(r.flags).toEqual([]);
        // …but the census is still real, so the coverage half of the report is
        // never blank just because a store is missing.
        expect(r.census.totalLines).toBeGreaterThan(0);
    });

    it('counts sessions that had a skill in context separately from sessions scanned', () => {
        const store = tmpdir();
        fs.writeFileSync(path.join(store, 'a.jsonl'), `${skillBody('rtk-output-filtering')}\n`, 'utf8');
        fs.writeFileSync(path.join(store, 'b.jsonl'), `${assistant([{ name: 'Read', input: { file_path: 'x' } }])}\n`, 'utf8');
        const r = scanStore(REPO_ROOT, store, 10);
        expect(r.sessions).toBe(2);
        expect(r.sessionsWithASkill).toBe(1);
    });
});
