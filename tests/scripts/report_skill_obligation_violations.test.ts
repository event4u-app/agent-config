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
    main,
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
    verb: 'NEVER',
    artefact: 'docs/THIRD-PARTY-NOTICES.md',
    kind: 'path',
    polarity: 'forbidden',
};
const FORBIDDEN_CMD: Obligation = {
    skill: 'rtk-output-filtering',
    line: '**NEVER `cargo install rtk`**',
    verb: 'NEVER',
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

    it('never classifies a corpus artefact as both forbidden and prescribed', () => {
        // The polarity mechanism itself is pinned on synthetic lines below, so
        // this assertion deliberately names no shipped skill: hard-coding one
        // corpus member's wording makes an unrelated skill edit red this file
        // with a message pointing at the detector.
        const c = extractObligations(REPO_ROOT);
        const forbidden = new Set(c.forbidden.map((o) => `${o.skill}:${o.artefact}`));
        for (const o of c.prescribed) {
            expect(forbidden.has(`${o.skill}:${o.artefact}`)).toBe(false);
        }
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

// ── R2 completion-review repairs (2026-08-08) ──────────────────────────────
//
// Every case below pins a defect the fixtures above could NOT have caught,
// which is the point: the first suite proved the detector fires and still left
// the loaded-set reader broken for the only shape the real store uses.

/** The shape the store actually stores: content BLOCKS, not a bare string. */
function skillBodyBlocks(name: string): string {
    return JSON.stringify({
        type: 'user',
        message: {
            content: [
                { type: 'text', text: `Base directory for this skill: /Users/x/.claude/skills/${name}\n` },
            ],
        },
    });
}

describe('loadedSkills — the content shape that actually occurs', () => {
    it('detects a skill body delivered as content BLOCKS, not only as a string', () => {
        // Measured in one 30-session store: 0 injected skill bodies arrive as a
        // bare string and 41 arrive as blocks. A string-only reader therefore
        // detected NONE of them, and an empty loaded-set returns no findings —
        // indistinguishable from compliance.
        expect(loadedSkills([skillBodyBlocks('rtk-output-filtering')]).has('rtk-output-filtering')).toBe(
            true,
        );
    });

    it('still detects the string shape, so the repair is additive', () => {
        expect(loadedSkills([skillBody('rtk-output-filtering')]).has('rtk-output-filtering')).toBe(true);
    });

    it('ignores a sidechain turn — a subagent load is not a main-thread load', () => {
        const side = JSON.stringify({
            type: 'user',
            isSidechain: true,
            message: { content: [{ type: 'text', text: 'Base directory for this skill: /x/skills/ai-council' }] },
        });
        expect(loadedSkills([side]).size).toBe(0);
    });

    it('flags a violation reached through the block shape end to end', () => {
        const flags = scanSessionForViolations(
            's',
            [
                skillBodyBlocks('license-compliance-credits'),
                assistant([{ name: 'Edit', input: { file_path: 'docs/THIRD-PARTY-NOTICES.md' } }]),
            ],
            [FORBIDDEN_PATH],
        );
        expect(flags).toHaveLength(1);
    });
});

describe('scanSessionForViolations — what the target fields exclude', () => {
    it('does NOT flag a forbidden path that appears only in replacement TEXT', () => {
        // Editing some other file whose content mentions the path is not
        // hand-editing it. Concatenating every string input value made it one.
        const flags = scanSessionForViolations(
            's',
            [
                skillBodyBlocks('license-compliance-credits'),
                assistant([
                    {
                        name: 'Edit',
                        input: {
                            file_path: 'docs/README.md',
                            new_string: 'see docs/THIRD-PARTY-NOTICES.md for the notices',
                        },
                    },
                ]),
            ],
            [FORBIDDEN_PATH],
        );
        expect(flags).toEqual([]);
    });

    it('does NOT flag a forbidden command quoted in a tool description', () => {
        const flags = scanSessionForViolations(
            's',
            [
                skillBodyBlocks('rtk-output-filtering'),
                assistant([
                    { name: 'Bash', input: { command: 'echo hi', description: 'why not cargo install rtk' } },
                ]),
            ],
            [FORBIDDEN_CMD],
        );
        expect(flags).toEqual([]);
    });

    it('ignores a sidechain assistant turn as the violating act', () => {
        const sideEdit = JSON.stringify({
            type: 'assistant',
            isSidechain: true,
            message: {
                content: [
                    { type: 'tool_use', name: 'Edit', input: { file_path: 'docs/THIRD-PARTY-NOTICES.md' } },
                ],
            },
        });
        expect(
            scanSessionForViolations('s', [skillBodyBlocks('license-compliance-credits'), sideEdit], [
                FORBIDDEN_PATH,
            ]),
        ).toEqual([]);
    });
});

describe('polarity — the pivot must not swallow the prohibition', () => {
    it('keeps "NEVER use `X`" forbidden', () => {
        // A bare `use` anywhere in the line put the pivot BEFORE the artefact and
        // classified the forbidden thing as the remedy — silently shrinking the
        // mechanisable set this report publishes as its headline.
        const root = tmpdir();
        const skills = path.join(root, 'src', 'skills', 'fixture-skill');
        fs.mkdirSync(skills, { recursive: true });
        fs.writeFileSync(
            path.join(skills, 'SKILL.md'),
            '---\nname: fixture-skill\ndescription: x\n---\n\n- NEVER use `cargo install rtk` for this.\n',
            'utf8',
        );
        const c = extractObligations(root);
        expect(c.forbidden.map((o) => o.artefact)).toContain('cargo install rtk');
        expect(c.prescribed).toEqual([]);
    });

    it('still classifies a dash-introduced remedy as prescribed', () => {
        const root = tmpdir();
        const skills = path.join(root, 'src', 'skills', 'fixture-skill');
        fs.mkdirSync(skills, { recursive: true });
        fs.writeFileSync(
            path.join(skills, 'SKILL.md'),
            '---\nname: fixture-skill\ndescription: x\n---\n\n* NEVER hand-roll it — use `git worktree remove`.\n',
            'utf8',
        );
        const c = extractObligations(root);
        expect(c.prescribed.map((o) => o.artefact)).toContain('git worktree remove');
        expect(c.forbidden).toEqual([]);
    });

    it('counts artefact-bearing LINES apart from artefacts, so the ratio is honest', () => {
        const root = tmpdir();
        const skills = path.join(root, 'src', 'skills', 'fixture-skill');
        fs.mkdirSync(skills, { recursive: true });
        fs.writeFileSync(
            path.join(skills, 'SKILL.md'),
            '---\nname: fixture-skill\ndescription: x\n---\n\n' +
                '- NEVER touch `docs/a.md` or `docs/b.md`.\n' +
                '- NEVER be impolite.\n',
            'utf8',
        );
        const c = extractObligations(root);
        expect(c.totalLines).toBe(2);
        expect(c.withArtefact).toHaveLength(2); // two artefacts…
        expect(c.linesWithArtefact).toBe(1); // …on ONE line
    });
});


describe('polarity reads the VERB, not only the position', () => {
    function fixture(body: string): string {
        const root = tmpdir();
        const dir = path.join(root, 'src', 'skills', 'fixture-skill');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'SKILL.md'),
            `---\nname: fixture-skill\ndescription: x\n---\n\n${body}\n`,
            'utf8',
        );
        return root;
    }

    it('never classifies a MUST/ALWAYS artefact as forbidden', () => {
        // Verified before the fix: `ALWAYS run \`task ci\`` produced
        // forbidden: ["task ci"], so the detector would have flagged COMPLIANCE
        // as a violation of an obligation that requires it.
        const c = extractObligations(fixture('- ALWAYS run `task ci` before pushing.'));
        expect(c.forbidden).toEqual([]);
        expect(c.required.map((o) => o.artefact)).toEqual(['task ci']);
        expect(c.required[0]?.verb).toBe('ALWAYS');
    });

    it('treats a MUST line the same way', () => {
        const c = extractObligations(fixture('- MUST run `npm test` first.'));
        expect(c.forbidden).toEqual([]);
        expect(c.required.map((o) => o.verb)).toEqual(['MUST']);
    });

    it('keeps a NEVER line forbidden, so the repair is not a blanket exclusion', () => {
        const c = extractObligations(fixture('- NEVER run `cargo install rtk`.'));
        expect(c.forbidden.map((o) => o.artefact)).toEqual(['cargo install rtk']);
        expect(c.required).toEqual([]);
    });

    it('excludes required artefacts from what the detector tests', () => {
        const root = fixture('- ALWAYS run `task ci` before pushing.');
        const c = extractObligations(root);
        // Nothing to scan for: the census carries the artefact, the forbidden set
        // does not, so no session can be flagged on it.
        expect(scanSessionForViolations('s', [], c.forbidden)).toEqual([]);
    });

    it('rejects a flag in the --store value position', () => {
        expect(main(['--store', '--json'])).toBe(1);
        expect(main(['--limit', '--json'])).toBe(1);
    });
});
