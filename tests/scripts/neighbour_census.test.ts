/**
 * The neighbour census over a planted consumer
 * (road-to-a-tree-that-keeps-its-neighbours Phase 2.1, 2.3, 2.4, 2.5).
 *
 * Every fixture here plants a real tree on disk rather than hand-writing a
 * census object: the thing under test is whether the walk FINDS a neighbour's
 * artefact where a host actually keeps it, and a literal would let the census
 * pass over a layout it cannot read.
 *
 * The secrets assertion is the one that must not be relaxed. A hook command
 * line can carry a token and this output can end up in a committed report, so
 * a planted argument string must never appear anywhere in the JSON.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { main, renderText, runCensus, summaryLine } from '../../src/scripts/_cli/cmd_doctor_neighbours.js';
import {
    census,
    commandHead,
    doubleGateWarnings,
    foreignSections,
    gatedEventsFrom,
    labelFor,
    type ForeignHookEntry,
} from '../../src/scripts/_lib/neighbour_census.js';

const dirs: string[] = [];

function tmp(): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'census-'));
    dirs.push(d);
    return d;
}

function write(root: string, rel: string, body: string): void {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body, 'utf-8');
}

afterEach(() => {
    while (dirs.length > 0) {
        const d = dirs.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

/**
 * A secret-shaped argument no output may ever carry.
 *
 * Deliberately HIGH-ENTROPY rather than a readable placeholder: a placeholder
 * made of dictionary words is neither credential-shaped nor high-entropy, so
 * it would have exercised the shape rules and silently skipped the
 * `secret_detector` gate behind them — the fixture would have been testing
 * less than it looked.
 *
 * Deliberately NOT a vendor-prefixed shape either, though that was the first
 * attempt: a `sk_live_…` string is rejected by the remote's push protection
 * even as a fixture, which is the correct behaviour and makes it unusable
 * here. Random characters with no prefix are caught by the detector's entropy
 * layer (`rule: entropy`), which is the layer this gate actually needs to
 * exercise — the one that catches a credential nobody wrote a pattern for.
 */
const PLANTED_TOKEN = 'xK7pQm2vRt9wYz4Bn6Hj8Lc3Fd5Gs1Av';

/**
 * An EMPTY user-scope root.
 *
 * The census reads `~/.claude/skills` and the user-level hook files, so a
 * fixture that let it see the real `$HOME` would assert against whatever the
 * developer happens to have installed. Every case here plants its own.
 */
function plantedHome(): string {
    return tmp();
}

/** A consumer with one neighbour artefact of every shape class. */
function plantedConsumer(): string {
    const root = tmp();
    write(
        root,
        '.cursor/hooks.json',
        JSON.stringify({
            version: 1,
            hooks: {
                beforeShellExecution: [
                    { command: `other-agent-pack hook --token ${PLANTED_TOKEN}`, timeout: 30 },
                    {
                        command:
                            '[ -x ./agent-config ] || exit 0; ./agent-config dispatch:hook --platform cursor --event pre_tool_use --native-event beforeShellExecution',
                    },
                ],
            },
        }),
    );
    write(root, '.claude/skills/their-skill/SKILL.md', '# their skill\n');
    write(root, '.claude/commands/their-command.md', '# their command\n');
    write(root, '.claude/agents/their-agent.md', '# their agent\n');
    write(root, '.mcp.json', JSON.stringify({ mcpServers: { 'their-server': { command: 'x' } } }));
    write(root, '.cursor/rules/other.mdc', '# their rule\n');
    write(root, 'AGENTS.md', '# Their Project\n\nbody\n\n## Their Section\n\nmore\n');
    return root;
}

describe('commandHead — a classifier, never a disclosure', () => {
    it('keeps the program and drops every argument', () => {
        expect(commandHead(`npx thing --token ${PLANTED_TOKEN}`)).toBe('npx');
    });

    it('reads past a shell guard prefix to the program that actually runs', () => {
        expect(commandHead('[ -x ./x ] || exit 0; ./agent-config dispatch:hook --platform cursor')).toBe(
            './agent-config',
        );
    });

    it('answers empty for an empty command rather than inventing one', () => {
        expect(commandHead('   ')).toBe('');
    });

    // The three shapes an independent review supplied against the first
    // version, which took "the first token" and called that safe.

    it('drops a leading environment assignment — the first token IS the secret', () => {
        expect(commandHead(`TOKEN=${PLANTED_TOKEN} ./hook`)).toBe('./hook');
        expect(commandHead(`A=1 B=${PLANTED_TOKEN} /usr/bin/thing --x`)).toBe('/usr/bin/thing');
    });

    it('redacts a program carrying a credential in its URL', () => {
        expect(commandHead('https://user:hunter2@example.test/hook')).toBe('(redacted)');
        expect(commandHead('https://example.test/hook?token=abc')).toBe('(redacted)');
    });

    it('redacts a fragment promoted out of a quoted argument by the `;` split', () => {
        // `split(';')` is not shell-aware, so a semicolon inside a quoted
        // argument hands the tail to the head extractor. It cannot look like a
        // program name, so it is redacted rather than printed.
        expect(commandHead(`curl -H 'Auth: ${PLANTED_TOKEN};still-secret' https://x.test`)).toBe(
            '(redacted)',
        );
    });

    it('redacts an assignment-only command rather than printing the assignment', () => {
        expect(commandHead(`TOKEN=${PLANTED_TOKEN}`)).toBe('(redacted)');
    });

    it('redacts a credential spelled like a program name — the shape gate cannot see that', () => {
        expect(commandHead(PLANTED_TOKEN)).toBe('(redacted)');
        expect(commandHead('Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZg')).toBe('(redacted)');
    });

    it('states its residual rather than claiming a guarantee it does not have', () => {
        // A "secret" that is neither credential-shaped nor high-entropy and is
        // the whole command is indistinguishable from a program of that name.
        // Pinned so the limit is a known property rather than a surprise.
        expect(commandHead('not-really-a-secret-just-words')).toBe('not-really-a-secret-just-words');
    });

    it('never returns anything containing the planted token, across every shape', () => {
        const shapes = [
            `TOKEN=${PLANTED_TOKEN} ./hook`,
            `./hook --token ${PLANTED_TOKEN}`,
            `https://u:${PLANTED_TOKEN}@x.test/h`,
            `a;TOKEN=${PLANTED_TOKEN}`,
            `curl -H 'A: ${PLANTED_TOKEN};b' x`,
            `${PLANTED_TOKEN}`,
            `/bin/sh -c "export K=${PLANTED_TOKEN}; run"`,
        ];
        for (const s of shapes) {
            expect(commandHead(s), s).not.toContain(PLANTED_TOKEN);
        }
    });
});

describe('census over a planted consumer (2.1)', () => {
    it('finds one entry in each of the seven shape classes', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome() });
        expect(c.hook_groups).toHaveLength(1);
        expect(c.skills.map((s) => s.id)).toStrictEqual(['project:their-skill']);
        expect(c.commands.map((s) => s.id)).toStrictEqual(['project:their-command']);
        expect(c.agents.map((s) => s.id)).toStrictEqual(['project:their-agent']);
        expect(c.mcp_servers.map((s) => s.id)).toStrictEqual(['project:their-server']);
        expect(c.rule_files.map((s) => s.id)).toStrictEqual(['cursor:other']);
        expect(c.instruction_sections.map((s) => s.id)).toContain('AGENTS.md:Their Section');
    });

    it('gives every entry a qualified id, a digest and a shape class', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome() });
        const all = [
            ...c.hook_groups,
            ...c.skills,
            ...c.commands,
            ...c.agents,
            ...c.mcp_servers,
            ...c.rule_files,
            ...c.instruction_sections,
        ];
        expect(all.length).toBeGreaterThan(6);
        for (const e of all) {
            expect(e.id, JSON.stringify(e)).toMatch(/^[^:]+:.+/);
            expect(e.digest, JSON.stringify(e)).toMatch(/^[0-9a-f]{64}$/);
            expect(e.shape, JSON.stringify(e)).toBeTruthy();
        }
    });

    it('never counts our own entry as a neighbour', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome() });
        expect(c.hook_groups.map((e) => e.command_head)).toStrictEqual(['other-agent-pack']);
    });

    it('reads a neighbour effect as unknown — no host exposes it', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome() });
        expect(c.hook_groups[0]?.effect).toBe('unknown');
    });

    it('keeps the matcher and timeout, which are shape and not content', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome() });
        expect(c.hook_groups[0]?.timeout).toBe(30);
        expect(c.hook_groups[0]?.event).toBe('beforeShellExecution');
    });

    it('NEVER prints a planted argument anywhere in the census', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome() });
        expect(JSON.stringify(c)).not.toContain(PLANTED_TOKEN);
        expect(renderText(c).join('\n')).not.toContain(PLANTED_TOKEN);
    });

    it('answers empty on a consumer with no neighbours rather than throwing', () => {
        const c = census(tmp(), { homeRoot: plantedHome() });
        expect(c.hook_groups).toStrictEqual([]);
        expect(c.skills).toStrictEqual([]);
        expect(c.hosts).toStrictEqual([]);
    });
});

describe('foreignSections (2.1g)', () => {
    it('keeps a heading our own template carries out of the listing', () => {
        const root = tmp();
        write(root, 'AGENTS.md', '# Shared\n\na\n\n## Theirs\n\nb\n');
        write(root, 'tpl/AGENTS.md', '# Shared\n\nwhatever\n');
        const out = foreignSections(
            path.join(root, 'AGENTS.md'),
            path.join(root, 'tpl', 'AGENTS.md'),
            'AGENTS.md',
        );
        expect(out.map((s) => s.id)).toStrictEqual(['AGENTS.md:Theirs']);
    });

    it('treats every section as foreign when no template resolves', () => {
        const root = tmp();
        write(root, 'AGENTS.md', '# One\n\na\n\n## Two\n\nb\n');
        const out = foreignSections(path.join(root, 'AGENTS.md'), path.join(root, 'absent.md'), 'x');
        expect(out).toHaveLength(2);
    });
});

describe('double-gate and shadowed (2.3)', () => {
    const entry = (event: string, head: string): ForeignHookEntry => ({
        id: `cursor:${event}/${head}`,
        shape: 'hook_group',
        digest: 'd',
        source: 'f',
        event,
        matcher: 'Edit|Write',
        command_head: head,
        timeout: null,
        effect: 'unknown',
    });

    it('fires on an event this package gates', () => {
        const w = doubleGateWarnings([entry('PreToolUse', 'x')], new Set(['PreToolUse']));
        expect(w).toHaveLength(1);
        expect(w[0]?.kind).toBe('double-gate');
    });

    it('says the host runs both, and never states an order the host has no concept of', () => {
        const w = doubleGateWarnings([entry('PreToolUse', 'x')], new Set(['PreToolUse']));
        expect(w[0]?.detail).toContain('The host runs both; either deny applies.');
        expect(w[0]?.detail).not.toMatch(/\bfirst\b|\blast\b|\bbefore\b|\bafter\b/);
    });

    it('stays silent on an event where nothing of ours can refuse', () => {
        expect(doubleGateWarnings([entry('Notification', 'x')], new Set(['PreToolUse']))).toStrictEqual(
            [],
        );
    });

    it('warns when a neighbour skill carries one of our names', () => {
        const root = plantedConsumer();
        const c = census(root, { homeRoot: plantedHome(), ourSkillNames: new Set(['their-skill']) });
        expect(c.warnings.filter((w) => w.kind === 'shadowed')).toHaveLength(1);
    });

    it('does not warn when the name is theirs alone', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome(), ourSkillNames: new Set(['ours-only']) });
        expect(c.warnings.filter((w) => w.kind === 'shadowed')).toStrictEqual([]);
    });
});

describe('gatedEventsFrom (2.3)', () => {
    it('collects only the events a permission concern of ours sits on', () => {
        const events = gatedEventsFrom(
            {
                concerns: { gate: { effect: 'permission' }, nudge: { effect: 'notification' } },
                platforms: { claude: { pre_tool_use: ['gate'], stop: ['nudge'] } },
            },
            { claude: { PreToolUse: 'pre_tool_use' } },
        );
        expect([...events].sort()).toStrictEqual(['PreToolUse', 'pre_tool_use']);
    });

    it('collects nothing from a manifest whose concerns declare no effect', () => {
        const events = gatedEventsFrom({
            concerns: { gate: {} },
            platforms: { claude: { pre_tool_use: ['gate'] } },
        });
        expect([...events]).toStrictEqual([]);
    });
});

describe('the four environment labels (2.5)', () => {
    const e = (event: string): ForeignHookEntry => ({
        id: `x:${event}`,
        shape: 'hook_group',
        digest: 'd',
        source: 'f',
        event,
        matcher: null,
        command_head: 'x',
        timeout: null,
        effect: 'unknown',
    });

    it('controlled — ours bound, nothing foreign', () => {
        expect(labelFor([], true, new Set()).label).toBe('controlled');
    });

    it('coordinated — foreign entries, none on a slot we gate', () => {
        expect(labelFor([e('Notification')], true, new Set(['PreToolUse'])).label).toBe('coordinated');
    });

    it('degraded — a foreign entry of unread effect on a slot we gate', () => {
        const r = labelFor([e('PreToolUse')], true, new Set(['PreToolUse']));
        expect(r.label).toBe('degraded');
        expect(r.reason).toContain('x:PreToolUse');
    });

    it('degraded — a foreign Stop entry, whatever else is on the file', () => {
        expect(labelFor([e('Stop')], true, new Set()).label).toBe('degraded');
    });

    it('uncontrolled — our own group is not in the file after our own install', () => {
        const r = labelFor([e('Notification')], false, new Set());
        expect(r.label).toBe('uncontrolled');
    });

    it('every label carries a reason, so none of them is a bare word', () => {
        for (const [entries, bound] of [
            [[], true],
            [[e('Notification')], true],
            [[e('PreToolUse')], true],
            [[e('Notification')], false],
        ] as Array<[ForeignHookEntry[], boolean]>) {
            expect(labelFor(entries, bound, new Set(['PreToolUse'])).reason).not.toBe('');
        }
    });
});

describe('liveness (2.4)', () => {
    it('reports removed-after-install when our group is gone from a host file', () => {
        const root = tmp();
        write(
            root,
            '.cursor/hooks.json',
            JSON.stringify({ hooks: { beforeShellExecution: [{ command: 'other-pack hook' }] } }),
        );
        const c = census(root, { homeRoot: plantedHome() });
        expect(c.warnings.filter((w) => w.kind === 'removed-after-install')).toHaveLength(1);
        expect(c.hosts[0]?.label).toBe('uncontrolled');
    });

    it('reports nothing of the kind while our group is still registered', () => {
        const c = census(plantedConsumer(), { homeRoot: plantedHome() });
        expect(c.warnings.filter((w) => w.kind === 'removed-after-install')).toStrictEqual([]);
    });

    it('reports a model override, which decides what reads our rules', () => {
        const root = tmp();
        write(root, '.claude/settings.json', JSON.stringify({ model: 'something-else' }));
        const c = census(root, { homeRoot: plantedHome() });
        const w = c.warnings.filter((x) => x.kind === 'settings-takeover');
        expect(w).toHaveLength(1);
        expect(w[0]?.detail).toContain('`model`');
    });

    it('reports a host environment key, which changes the harness our hooks run in', () => {
        const root = tmp();
        write(
            root,
            '.claude/settings.json',
            JSON.stringify({ env: { CLAUDE_CODE_SOMETHING: '1', UNRELATED: '1' } }),
        );
        const c = census(root, { homeRoot: plantedHome() });
        const w = c.warnings.filter((x) => x.kind === 'settings-takeover');
        expect(w).toHaveLength(1);
        expect(w[0]?.detail).toContain('CLAUDE_CODE_SOMETHING');
        expect(w[0]?.detail).not.toContain('UNRELATED');
    });

    it('reports nothing for a settings file that sets neither', () => {
        const root = tmp();
        write(root, '.claude/settings.json', JSON.stringify({ enabledPlugins: { x: true } }));
        const c = census(root, { homeRoot: plantedHome() });
        expect(c.warnings.filter((x) => x.kind === 'settings-takeover')).toStrictEqual([]);
    });
});

describe('the doctor surfaces (2.1 verify, 2.6)', () => {
    function capture(argv: string[]): { code: number; out: string } {
        const chunks: string[] = [];
        const real = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((c: unknown) => {
            chunks.push(String(c));
            return true;
        }) as typeof process.stdout.write;
        try {
            return { code: main(argv), out: chunks.join('') };
        } finally {
            process.stdout.write = real;
        }
    }

    it('--json carries hook_groups and instruction_sections', () => {
        const { code, out } = capture(['--json', '--project', plantedConsumer(), '--home', plantedHome()]);
        expect(code).toBe(0);
        expect(out).toMatch(/"hook_groups":\s*\[\{/);
        expect(out).toMatch(/"instruction_sections"/);
    });

    it('--json never carries a planted argument', () => {
        const { out } = capture(['--json', '--project', plantedConsumer(), '--home', plantedHome()]);
        expect(out).not.toContain(PLANTED_TOKEN);
    });

    it('refuses an argument it does not know rather than ignoring it', () => {
        const { code } = capture(['--nonsense']);
        expect(code).toBe(2);
    });

    it('the summary line carries counts and one label per host', () => {
        const root = plantedConsumer();
        const line = summaryLine(runCensus(root, process.cwd(), plantedHome()));
        expect(line).toContain('neighbours:');
        expect(line).toMatch(/1 hook group\(s\)/);
        expect(line).toMatch(/cursor=(controlled|coordinated|degraded|uncontrolled)/);
    });

    it('the rendered census states the load-order limit instead of implying an order', () => {
        const text = renderText(census(plantedConsumer(), { homeRoot: plantedHome() })).join('\n');
        expect(text).toContain('The host owns load order');
        expect(text).toContain('no label here refuses anything');
    });
});
