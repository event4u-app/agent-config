// road-to-a-tick-the-shipped-path-earns 2.4: a worker that skips instruction
// files receives the project's constraints on the host's own SubagentStart path.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    definitionSkipsInstructions,
    digestFor,
    EMISSION_MAX_BYTES,
    FLOOR_RULE_IDS,
    instructionDigest,
    replyLine,
    ruleLaw,
} from '../../src/scripts/hooks/subagent_constraints_hook.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');
const PLANTED = 'PLANTED-CONSTRAINT-7f3a: never write under vendor/.';

let root: string;
let config: string;

function definition(name: string, skips: boolean): void {
    const dir = path.join(root, '.claude', 'agents');
    fs.mkdirSync(dir, { recursive: true });
    const fm = `---\nname: ${name}\ndescription: fixture\ntools: Read\n${skips ? 'omitClaudeMd: true\n' : ''}---\n`;
    fs.writeFileSync(path.join(dir, `${name}.md`), `${fm}\nYou are a fixture worker.\n`);
}

beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-constraints-')));
    config = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-constraints-cfg-'));
    fs.mkdirSync(path.join(root, '.git'));
    fs.writeFileSync(path.join(root, 'CLAUDE.md'), `# Fixture project\n\n${PLANTED}\n`);
    definition('ac-worker', true);
    definition('ac-plain', false);
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(config, { recursive: true, force: true });
});

const env = (): NodeJS.ProcessEnv => ({ ...process.env, CLAUDE_CONFIG_DIR: config });

describe('subagent-constraints concern', () => {
    it('reads the omitClaudeMd flag off the definition the host runs', () => {
        expect(definitionSkipsInstructions(root, 'ac-worker', config)).toBe(true);
        expect(definitionSkipsInstructions(root, 'ac-plain', config)).toBe(false);
        expect(definitionSkipsInstructions(root, 'missing', config)).toBe(false);
        expect(definitionSkipsInstructions(root, '../ac-worker', config)).toBe(false);
    });

    it('falls back to the user-level definition directory', () => {
        fs.rmSync(path.join(root, '.claude'), { recursive: true });
        fs.mkdirSync(path.join(config, 'agents'));
        fs.writeFileSync(path.join(config, 'agents', 'ac-worker.md'), '---\nname: ac-worker\nomitClaudeMd: true\n---\n');
        expect(definitionSkipsInstructions(root, 'ac-worker', config)).toBe(true);
    });

    it('digests a skipping worker and stays silent for any other', () => {
        const payload = (agent: string): unknown => ({ event: 'subagent_start', payload: { agent_type: agent, cwd: root } });
        expect(digestFor(payload('ac-worker'), env())).toContain(PLANTED);
        expect(digestFor(payload('ac-plain'), env())).toBeNull();
        expect(digestFor(payload('ac-worker'), { ...env(), AGENT_CONFIG_SUBAGENT_CONSTRAINTS: 'off' })).toBeNull();
        expect(digestFor({ event: 'subagent_stop', payload: { agent_type: 'ac-worker', cwd: root } }, env())).toBeNull();
    });

    it('reads the definition flag as YAML, CRLF and comments included', () => {
        const dir = path.join(root, '.claude', 'agents');
        fs.writeFileSync(path.join(dir, 'crlf.md'), '---\r\nname: crlf\r\nomitClaudeMd: true\r\n---\r\nbody\r\n');
        fs.writeFileSync(path.join(dir, 'commented.md'), '---\nname: c\nomitClaudeMd: true # skip\n---\n');
        fs.writeFileSync(path.join(dir, 'quoted.md'), '---\nname: q\nomitClaudeMd: "true"\n---\n');
        fs.writeFileSync(path.join(dir, 'broken.md'), '---\nname: [b\nomitClaudeMd: true\n---\n');
        expect(definitionSkipsInstructions(root, 'crlf', config)).toBe(true);
        expect(definitionSkipsInstructions(root, 'commented', config)).toBe(true);
        expect(definitionSkipsInstructions(root, 'quoted', config)).toBe(false);
        expect(definitionSkipsInstructions(root, 'broken', config)).toBe(false);
    });

    it('prints the files root-most first and names every one in the inventory', () => {
        const sub = path.join(root, 'pkg');
        fs.mkdirSync(path.join(sub, '.claude'), { recursive: true });
        fs.writeFileSync(path.join(sub, '.claude', 'CLAUDE.md'), 'inner rule\n');
        const digest = instructionDigest(sub) as string;
        expect(digest.indexOf(PLANTED)).toBeLessThan(digest.indexOf('inner rule'));
        expect(digest).toContain('CLAUDE.md (full), pkg/.claude/CLAUDE.md (full)');
    });

    it('names a file that is empty once comments are removed', () => {
        fs.writeFileSync(path.join(root, 'CLAUDE.local.md'), '<!-- only a comment -->\n\n');
        expect(instructionDigest(root)).toContain('CLAUDE.md (full), CLAUDE.local.md (empty)');
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), '<!-- nothing -->');
        expect(instructionDigest(root)).toBeNull();
    });

    it('gives room to the nearest file first when a root file is too large', () => {
        const sub = path.join(root, 'pkg');
        fs.mkdirSync(sub);
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), `${'root filler line\n'.repeat(600)}`);
        fs.writeFileSync(path.join(sub, 'CLAUDE.local.md'), `${PLANTED}\n`);
        const digest = instructionDigest(sub) as string;
        expect(digest).toContain(PLANTED);
        expect(digest).toContain('CLAUDE.md (cut), pkg/CLAUDE.local.md (full)');
        expect(digest).toContain('[cut here]');
    });

    it('names a file it had no room for as omitted', () => {
        const sub = path.join(root, 'pkg');
        fs.mkdirSync(sub);
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'root rule\n');
        fs.writeFileSync(path.join(sub, 'CLAUDE.md'), `${'near filler line\n'.repeat(600)}`);
        const digest = instructionDigest(sub) as string;
        expect(digest).toContain('CLAUDE.md (omitted), pkg/CLAUDE.md (cut)');
        expect(digest).not.toContain('root rule');
    });

    it('keeps the serialized reply under the registered ceiling under worst-case escaping', () => {
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), '"\\\u0001\t'.repeat(3_000));
        const digest = instructionDigest(root) as string;
        expect(Buffer.byteLength(replyLine(digest), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), '\u{1F600}x'.repeat(3_000));
        const emoji = instructionDigest(root) as string;
        expect(Buffer.byteLength(replyLine(emoji), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        expect(emoji.isWellFormed()).toBe(true);
    });

    it('holds the ceiling when the header and inventory alone would not fit', () => {
        let dir = root;
        for (let i = 0; i < 30; i++) {
            dir = path.join(dir, `longish-dir-name-${i}`);
            fs.mkdirSync(dir);
            fs.writeFileSync(path.join(dir, 'CLAUDE.md'), `rule ${i}\n`);
        }
        const deep = instructionDigest(dir) as string;
        expect(Buffer.byteLength(replyLine(deep), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        expect(deep).toMatch(/\d+ nearer the root not named/);
        expect(deep).toContain('rule 29');
        for (const cap of [200, 400, 800]) {
            expect(Buffer.byteLength(replyLine(instructionDigest(dir, cap) as string), 'utf-8')).toBeLessThanOrEqual(cap);
        }
    });

    it('reaches the subagent through the real dispatcher on SubagentStart', () => {
        const run = (agent: string): { code: number; out: string } => {
            const r = spawnSync(
                'npx',
                ['tsx', DISPATCH, '--platform', 'claude', '--event', 'subagent_start', '--native-event', 'SubagentStart', '--project-dir', root],
                {
                    input: JSON.stringify({
                        session_id: 'fixture-session',
                        hook_event_name: 'SubagentStart',
                        agent_id: `agent-${agent}`,
                        agent_type: agent,
                        cwd: root,
                    }),
                    encoding: 'utf-8',
                    cwd: REPO,
                    timeout: 180_000,
                    env: env(),
                },
            );
            return { code: r.status ?? -1, out: r.stdout ?? '' };
        };
        const skipping = run('ac-worker');
        expect(skipping.code).toBe(0);
        const reply = JSON.parse(skipping.out.trim().split('\n').pop() as string) as {
            hookSpecificOutput: { hookEventName: string; additionalContext: string };
        };
        expect(reply.hookSpecificOutput.hookEventName).toBe('SubagentStart');
        expect(reply.hookSpecificOutput.additionalContext).toContain(PLANTED);
        const loading = run('ac-plain');
        expect(loading.code).toBe(0);
        expect(loading.out).not.toContain(PLANTED);
    }, 240_000);

});

// road-to-a-cold-start-paid-once D16 (owner directive 2026-10-24): the user's own
// `~/.claude` layer — CLAUDE.md, what it imports, and the rules — rides in the same digest.
describe('subagent-constraints concern — the user layer', () => {
    const USER_LINE = 'PLANTED-USER-LINE-91c2: reply in the user\'s language.';
    const IMPORTED = 'PLANTED-IMPORT-5d0e: wrap verbose output.';
    const lawRule = (id: string, law: string, prose = 'Why this rule exists, at length.'): string =>
        `---\npackage: fixture\n---\n\n# ${id}\n\n## The Iron Law\n\n\`\`\`\n${law}\n\`\`\`\n\n${prose}\n`;
    const writeRule = (id: string, law: string, prose?: string): void => {
        fs.mkdirSync(path.join(config, 'rules'), { recursive: true });
        fs.writeFileSync(path.join(config, 'rules', `${id}.md`), lawRule(id, law, prose));
    };
    const reply = (agent = 'ac-worker'): string =>
        digestFor({ event: 'subagent_start', payload: { agent_type: agent, cwd: root } }, env()) as string;

    it('carries a planted user rule, the user CLAUDE.md and what it imports', () => {
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), `${USER_LINE}\n\n@EXTRA.md\n`);
        fs.writeFileSync(path.join(config, 'EXTRA.md'), `${IMPORTED}\n`);
        writeRule('my-house-rule', 'PLANTED-RULE-LAW-3b7a: NEVER EDIT GENERATED FILES.', 'PROSE-NOT-CARRIED');
        const digest = reply();
        expect(digest).toContain(PLANTED);
        expect(digest).toContain(USER_LINE);
        expect(digest).toContain(IMPORTED);
        expect(digest).toContain('PLANTED-RULE-LAW-3b7a');
        expect(digest).not.toContain('PROSE-NOT-CARRIED');
        expect(digest).toMatch(/User files: user:CLAUDE\.md \(full\), user:EXTRA\.md \(full\)\./);
        expect(digest).toContain('User rules (Iron Law blocks): 1 full, 0 first block only, 0 cut, as headed below; 0 empty; 0 omitted.');
        expect(digest).toContain('--- rule my-house-rule ---');
        expect(reply('ac-plain')).toBeNull();
    });

    it('keeps the floor and consequence-class laws whole when the rest must be cut', () => {
        for (const id of FLOOR_RULE_IDS) writeRule(id, `FLOOR-LAW-${id}: ${'NEVER CROSS THIS LINE. '.repeat(6)}`);
        for (let i = 0; i < 80; i++) writeRule(`zz-other-${String(i).padStart(2, '0')}`, `OTHER-LAW-${i}: ${'filler law text '.repeat(40)}`);
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), 'user filler line\n'.repeat(800));
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), `${PLANTED}\n${'project filler line\n'.repeat(800)}`);
        const digest = reply();
        expect(Buffer.byteLength(replyLine(digest), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        for (const id of FLOOR_RULE_IDS) expect(digest).toContain(`FLOOR-LAW-${id}: ${'NEVER CROSS THIS LINE. '.repeat(6).trimEnd()}`);
        // Floor laws lead the digest; the cut falls on what ranks below them.
        expect(digest.indexOf(`--- rule ${FLOOR_RULE_IDS[0]} ---`)).toBeLessThan(digest.indexOf('--- CLAUDE.md ---'));
        expect(digest).toMatch(/omitted: [^;.]*zz-other-/);
        expect(digest).not.toContain('OTHER-LAW-79');
    });

    it('holds the registered ceiling for every cap, and names what it could not show', () => {
        for (let i = 0; i < 300; i++) writeRule(`rule-with-a-long-name-${i}`, `LAW ${i} "\\\u0001\t ${'x'.repeat(200)}`);
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), '\u{1F600}"\\'.repeat(4_000));
        for (const cap of [200, 400, 800, 4_096, EMISSION_MAX_BYTES]) {
            const d = instructionDigest(root, cap, config) as string;
            expect(Buffer.byteLength(replyLine(d), 'utf-8')).toBeLessThanOrEqual(cap);
            expect(d.isWellFormed()).toBe(true);
        }
        expect(instructionDigest(root, EMISSION_MAX_BYTES, config)).toMatch(/\d+ more not named/);
    });

    it('carries a rule by its Iron Law blocks, falling back to its first fence and then its first paragraph', () => {
        const multi = '---\na: b\n---\n# T\n\n## Iron Law 1\n\n```\nONE\n```\n\nprose\n\n## Iron Law 2\n\n```\nTWO\n```\n\n## Other\n\n```\nNOT-A-LAW\n```\n';
        expect(ruleLaw(multi)).toBe('ONE\n\nTWO');
        expect(ruleLaw('# T\n\nintro\n\n```\nFIRST\n```\n\n```\nSECOND\n```\n')).toBe('FIRST');
        expect(ruleLaw('# T\n\nThe first paragraph.\n\nThe second.\n')).toBe('The first paragraph.');
    });

    it('lists the safety-floor rules first, then exactly the consequence class', () => {
        const rulesDir = path.join(REPO, 'src', 'rules');
        const floor = fs
            .readdirSync(rulesDir)
            .filter((f) => /^tier:\s*"?safety-floor"?\s*$/m.test(fs.readFileSync(path.join(rulesDir, f), 'utf-8')))
            .map((f) => f.replace(/\.md$/, ''));
        const members = Object.keys(
            (JSON.parse(fs.readFileSync(path.join(REPO, 'src', 'config', 'rule-consequence-class.json'), 'utf-8')) as {
                members: Record<string, unknown>;
            }).members,
        );
        expect(new Set(FLOOR_RULE_IDS.slice(0, floor.length))).toEqual(new Set(floor));
        expect(new Set(FLOOR_RULE_IDS.slice(floor.length))).toEqual(new Set(members));
        expect(new Set(FLOOR_RULE_IDS).size).toBe(FLOOR_RULE_IDS.length);
    });

    // Round-1 ratification findings: identity is the canonical path, discovery of a floor rule
    // does not depend on the walk's file limit, and an import is read once whatever path names it.
    it('classifies a floor rule by its canonical path, never by a nested file of the same name', () => {
        for (const id of FLOOR_RULE_IDS) writeRule(id, `FLOOR-LAW-${id}: ${'NEVER CROSS THIS LINE. '.repeat(6)}`);
        fs.mkdirSync(path.join(config, 'rules', 'aaa'), { recursive: true });
        for (const id of FLOOR_RULE_IDS) {
            fs.writeFileSync(path.join(config, 'rules', 'aaa', `${id}.md`), lawRule(id, `IMPOSTOR-${id}: ${'x'.repeat(400)}`));
        }
        const digest = reply();
        for (const id of FLOOR_RULE_IDS) expect(digest).toContain(`FLOOR-LAW-${id}`);
        expect(digest).not.toContain(`--- rule aaa/${FLOOR_RULE_IDS[0]} ---`);
    });

    it('reads every floor rule even when the rules tree holds more files than the walk takes', () => {
        fs.mkdirSync(path.join(config, 'rules', '000-bulk'), { recursive: true });
        for (let i = 0; i < 520; i++) fs.writeFileSync(path.join(config, 'rules', '000-bulk', `r${String(i).padStart(3, '0')}.md`), lawRule(`r${i}`, `BULK ${i}`));
        writeRule('user-interrupt-priority', 'LAST-FLOOR-LAW-7e1: STOP, RUN THE NEW TASK, ASK BEFORE RESUMING.');
        expect(reply()).toContain('LAST-FLOOR-LAW-7e1');
    });

    it('reads an imported file once, whichever path names it', () => {
        fs.writeFileSync(path.join(config, 'EXTRA.md'), `${IMPORTED}\n`);
        fs.symlinkSync(path.join(config, 'EXTRA.md'), path.join(config, 'ALIAS.md'));
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), `${USER_LINE}\n@EXTRA.md\n@./EXTRA.md\n@ALIAS.md\n`);
        const digest = reply();
        expect(digest.split(IMPORTED).length - 1).toBe(1);
        expect(digest).toMatch(/User files: user:CLAUDE\.md \(full\), user:EXTRA\.md \(full\)\./);
    });

    // Round-2 ratification finding: the user-file inventory names whole entries and counts the rest.
    it('names whole user-file entries and counts the ones it cannot name', () => {
        const refs: string[] = [];
        for (let i = 0; i < 24; i++) {
            const name = `an-imported-instruction-file-with-a-long-name-${String(i).padStart(2, '0')}.md`;
            fs.writeFileSync(path.join(config, name), `import ${i}\n`);
            refs.push(`@${name}`);
        }
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), `${USER_LINE}\n${refs.join('\n')}\n`);
        const line = reply().split('\n').find((l) => l.startsWith('User files:')) as string;
        const m = /^User files: (.*?)(?:, (\d+) more not named)?\.$/.exec(line);
        expect(m).not.toBeNull();
        const named = (m?.[1] as string).split(', ');
        for (const entry of named) expect(entry).toMatch(/^user:[^ ]+ \((full|cut|omitted|empty)\)$/);
        expect(named.length + Number(m?.[2] ?? 0)).toBe(25);
        expect(Number(m?.[2] ?? 0)).toBeGreaterThan(0);
    });

    // Round-3 ratification finding: a label is never shortened, so two long paths stay distinct.
    it('keeps long labels whole, so long paths sharing a prefix stay distinct or are counted', () => {
        const prefix = `${'a-very-long-directory-name-'.repeat(7)}`;
        const names = [`${prefix}one`, `${prefix}two`];
        for (const n of names) {
            fs.mkdirSync(path.join(config, 'rules', n), { recursive: true });
            fs.writeFileSync(path.join(config, 'rules', n, 'rule.md'), lawRule(n, `LAW OF ${n.slice(-3)}`));
            fs.writeFileSync(path.join(config, `${n}.md`), `import ${n.slice(-3)}\n`);
        }
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), `${USER_LINE}\n${names.map((n) => `@${n}.md`).join('\n')}\n`);
        const digest = reply();
        for (const n of names) {
            expect(digest).toContain(`--- rule ${n}/rule ---`);
            expect(digest).toContain(`--- user:${n}.md ---`);
        }
        for (const heading of digest.split('\n').filter((l) => l.startsWith('--- '))) expect(heading).toMatch(/ ---$/);
        // The bounded user-file inventory names a long file whole or counts it, never a shortened form.
        const inv = digest.split('\n').find((l) => l.startsWith('User files:')) as string;
        const listed = names.filter((n) => inv.includes(`user:${n}.md (full)`)).length;
        const counted = Number(/(\d+) (?:more )?not named/.exec(inv)?.[1] ?? 0);
        expect(listed + counted + 1).toBe(3);
        expect(inv).not.toMatch(/a-very-long-directory-name-(?!a-very|one|two)/);
    });

    // Round-4 ratification finding: every law block of a floor rule outranks project and user text.
    it('hands the first law block of every floor rule room before the project and user files', () => {
        const multi = (id: string): string =>
            `---\npackage: fixture\n---\n\n# ${id}\n\n## Iron Law 1\n\n\`\`\`\nFIRST-${id}: ${'A'.repeat(60)}\n\`\`\`\n\n## Iron Law 2\n\n\`\`\`\nSECOND-${id}: ${'B'.repeat(60)}\n\`\`\`\n`;
        fs.mkdirSync(path.join(config, 'rules'), { recursive: true });
        for (const id of FLOOR_RULE_IDS) fs.writeFileSync(path.join(config, 'rules', `${id}.md`), multi(id));
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'project filler line\n'.repeat(800));
        const digest = reply();
        // D17 superseded round 4's all-blocks order: the first block outranks the files, the later ones are cut.
        for (const id of FLOOR_RULE_IDS) {
            expect(digest).toContain(`FIRST-${id}: ${'A'.repeat(60)}\n[later law blocks not carried]`);
            expect(digest).not.toContain(`SECOND-${id}`);
        }
    });

    // Round-5 ratification finding: only a count-only inventory is reserved ahead of the floor laws;
    // named inventories take room after them, and give way to counts when there is none.
    it('reserves only counts ahead of the floor laws, and names files only with room left over', () => {
        for (const id of FLOOR_RULE_IDS) writeRule(id, `FLOOR-${id}: ${'N'.repeat(225 - id.length)}`);
        for (let i = 0; i < 80; i++) writeRule(`an-ordinary-rule-with-a-name-${String(i).padStart(2, '0')}`, `ORD ${i}`);
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), `${USER_LINE}\n`);
        const digest = reply();
        expect(Buffer.byteLength(replyLine(digest), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        for (const id of FLOOR_RULE_IDS) expect(digest).toContain(`FLOOR-${id}: ${'N'.repeat(225 - id.length)}`);
        expect(digest).toMatch(/User rules \(Iron Law blocks\): \d+ full, \d+ first block only, \d+ cut, \d+ empty, \d+ omitted\./);
    });

    // Owner directive D17 (2026-10-24, answer "2"): a floor rule is carried by its first law block,
    // its later blocks are listed as cut, and the room that frees goes to the CLAUDE.md files.
    it('carries every floor rule by its first law block and frees room for both CLAUDE.md files', () => {
        const present = FLOOR_RULE_IDS.filter((id) => id !== 'low-impact-corpus-privacy-floor' && id !== 'source-confidentiality');
        fs.mkdirSync(path.join(config, 'rules'), { recursive: true });
        for (const id of present) {
            fs.writeFileSync(
                path.join(config, 'rules', `${id}.md`),
                `---\npackage: fixture\n---\n\n# ${id}\n\n## Iron Law 1\n\n\`\`\`\nFIRST-${id}: ${'A'.repeat(110)}\n\`\`\`\n\n## Iron Law 2\n\n\`\`\`\nLATER-${id}: ${'B'.repeat(220)}\n\`\`\`\n`,
            );
        }
        for (let i = 0; i < 77; i++) writeRule(`ordinary-${String(i).padStart(2, '0')}`, `ORDINARY ${i}: ${'o'.repeat(150)}`);
        fs.writeFileSync(path.join(config, 'CLAUDE.md'), `${USER_LINE}\n`);
        fs.writeFileSync(path.join(root, 'CLAUDE.md'), `${PLANTED}\n${'project line\n'.repeat(80)}`);
        const digest = reply();
        expect(Buffer.byteLength(replyLine(digest), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        for (const id of present) {
            expect(digest).toContain(`--- rule ${id} ---\nFIRST-${id}: ${'A'.repeat(110)}\n[later law blocks not carried]`);
            expect(digest).not.toContain(`LATER-${id}`);
        }
        expect(digest).toContain(USER_LINE);
        expect(digest).toContain(PLANTED);
        expect(digest).toContain(`${present.length} first block only`);
    });

    // Round-6 ratification finding: a floor rule's first block is placed whole or not at all, and
    // the digest tells a rule carried by its first block apart from one cut mid-text or left out.
    it('never cuts a floor rule mid-block: an oversized first block is omitted and listed', () => {
        writeRule('non-destructive-by-default', `HUGE-FIRST: ${'H'.repeat(12_000)}`);
        writeRule('scope-control', 'SMALL-FIRST: STAY IN SCOPE.');
        const digest = reply();
        expect(Buffer.byteLength(replyLine(digest), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        expect(digest).not.toContain('HUGE-FIRST');
        expect(digest).toContain('SMALL-FIRST: STAY IN SCOPE.');
        expect(digest).toMatch(/omitted: non-destructive-by-default/);
    });

    it('when the first blocks overflow, the later floor rules are omitted whole and named', () => {
        for (const id of FLOOR_RULE_IDS) writeRule(id, `FIRST-${id}: ${'F'.repeat(400)}`);
        const digest = reply();
        expect(Buffer.byteLength(replyLine(digest), 'utf-8')).toBeLessThanOrEqual(EMISSION_MAX_BYTES);
        let carried = 0;
        for (const id of FLOOR_RULE_IDS) {
            if (digest.includes(`--- rule ${id} ---`)) {
                expect(digest).toContain(`--- rule ${id} ---\nFIRST-${id}: ${'F'.repeat(400)}`);
                carried += 1;
            }
        }
        expect(carried).toBeGreaterThan(0);
        expect(carried).toBeLessThan(FLOOR_RULE_IDS.length);
        expect(digest).not.toContain('[cut here]');
        expect(digest).toContain(`omitted: ${FLOOR_RULE_IDS[carried]}`);
    });
});
