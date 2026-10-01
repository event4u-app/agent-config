/**
 * The neighbour census — what else is installed beside this package, by shape.
 *
 * A consumer installs several agent packages. Until now this suite could not
 * say so: `doctor` listed unclaimed FILES under its own deploy roots and
 * nothing else, so a neighbour's hook entry, skill, command, MCP server or
 * instruction section was invisible, and the only way the suite ever
 * acknowledged one was by deleting it.
 *
 * Read-only, and by SHAPE rather than by name. No vendor name is a constant
 * here: an artefact is a neighbour's because nothing of ours claims it — no
 * signature in the command, no entry in the lockfile, no heading in our own
 * template — never because it matched a list of other packages. A name list
 * would be wrong the day a package renames and wrong forever about one nobody
 * thought of.
 *
 * Secrets discipline: a hook command line can carry a token, and this census
 * can end up in a committed report. Only the command HEAD is ever printed —
 * the first whitespace-separated token, which is the program — never its
 * arguments. The fixture asserts that an argument string planted in a
 * neighbour's command never reaches the output.
 *
 * The honest limit this whole surface sits inside: the host owns load order
 * and context order. The census can say a neighbour is there and what its
 * entry would do; it cannot say what ran first, and nothing here implies it.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { HOOK_SIGNATURES, entryCommands, isManagedEntry } from './host_hook_merge.js';
import { readRecordedHashes } from '../../install/recordedOwnership.js';
import { manifest_path } from './installed_tools.js';

/** The seven shape classes a neighbour artefact can take. */
export type ShapeClass =
    | 'hook_group'
    | 'skill'
    | 'command'
    | 'agent'
    | 'mcp_server'
    | 'rule_file'
    | 'instruction_section';

/** What a hook entry does to a turn, as far as this tree can tell. */
export type Effect =
    | 'permission'
    | 'context'
    | 'verification'
    | 'telemetry'
    | 'memory'
    | 'notification'
    | 'formatting'
    | 'unknown';

export interface NeighbourEntry {
    /** `<origin>:<name>` — origin is WHERE it was found, never who wrote it. */
    id: string;
    shape: ShapeClass;
    digest: string;
    /** The file it was found in, relative to the root it was found under. */
    source: string;
}

export interface ForeignHookEntry extends NeighbourEntry {
    shape: 'hook_group';
    event: string;
    matcher: string | null;
    /** The program only. Arguments are never read into the report. */
    command_head: string;
    timeout: number | null;
    effect: Effect;
}

export type EnvironmentLabel = 'controlled' | 'coordinated' | 'degraded' | 'uncontrolled';

export interface HostCensus {
    host: string;
    file: string;
    present: boolean;
    hook_groups: ForeignHookEntry[];
    /** Our own group is registered in this file. */
    ours_bound: boolean;
    label: EnvironmentLabel;
    /** Why the label is what it is — one clause, always present. */
    label_reason: string;
}

export interface CensusWarning {
    kind: 'double-gate' | 'shadowed' | 'removed-after-install' | 'settings-takeover';
    detail: string;
}

export interface NeighbourCensus {
    project_root: string;
    hosts: HostCensus[];
    hook_groups: ForeignHookEntry[];
    skills: NeighbourEntry[];
    commands: NeighbourEntry[];
    agents: NeighbourEntry[];
    mcp_servers: NeighbourEntry[];
    rule_files: NeighbourEntry[];
    instruction_sections: NeighbourEntry[];
    warnings: CensusWarning[];
}

/** Our MCP server's key — ours, so naming it here is not a vendor table. */
const OUR_MCP_KEY = 'agent-config';

function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf-8').digest('hex');
}

function readJson(p: string): Record<string, unknown> | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(p, 'utf-8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** The program a command line runs, with every argument discarded. */
export function commandHead(command: string): string {
    const trimmed = command.trim();
    if (trimmed === '') return '';
    // A shell guard prefix (`[ -x ./x ] || exit 0; real-command …`) is this
    // package's own shape and a neighbour may use one too; take the program
    // after the last `;` so the head names what actually runs.
    const lastStatement = trimmed.split(';').pop() ?? trimmed;
    return (lastStatement.trim().split(/\s+/)[0] ?? '').trim();
}

/**
 * The census's name for one host hook file.
 *
 * Scope-prefixed because the same host has a project file and a user file and
 * they are different environments: a neighbour registered in `~/.cursor` is
 * present in every project the consumer opens, one in `.cursor` only here.
 * A label that collapsed the two would report the wrong blast radius.
 */
export function hostNameFor(label: string): string {
    const user = label.startsWith('~/');
    const dir = label.replace(/^~\//, '').replace(/\/[^/]+$/, '');
    const name = dir
        .split('/')
        .map((seg) => seg.replace(/^\./, ''))
        .join('/');
    return user ? `user:${name}` : `project:${name}`;
}

/**
 * Every host hook file this package knows how to read, with its signature.
 *
 * `homeRoot` is injectable because the user-scope half of this list is real
 * `$HOME` in production and must be a planted tree in a fixture — a census
 * that could only read the developer's own machine would be untestable, and
 * its output would carry that machine into any report.
 */
export function hookFiles(
    projectRoot: string,
    homeRoot?: string,
): Array<{ host: string; file: string; signature: string }> {
    const home = homeRoot ?? os.homedir();
    const expand = (label: string): string =>
        label.startsWith('~/') ? path.join(home, label.slice(2)) : path.join(projectRoot, label);
    const out = Object.entries(HOOK_SIGNATURES).map(([label, signature]) => ({
        host: hostNameFor(label),
        file: expand(label),
        signature,
    }));
    // Claude is the one host whose managed block predates this table; its
    // signature lives with its own writer and is not a hook-array label.
    out.push({
        host: 'project:claude',
        file: path.join(projectRoot, '.claude', 'settings.json'),
        signature: 'dispatch:hook --platform claude',
    });
    return out;
}

/** Foreign hook entries in one host file, plus whether ours is registered. */
export function censusHookFile(
    host: string,
    file: string,
    signature: string,
): { entries: ForeignHookEntry[]; oursBound: boolean; present: boolean } {
    const doc = readJson(file);
    if (doc === null) return { entries: [], oursBound: false, present: false };
    const hooks = doc['hooks'];
    if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) {
        return { entries: [], oursBound: false, present: true };
    }
    const entries: ForeignHookEntry[] = [];
    let oursBound = false;
    for (const [event, list] of Object.entries(hooks as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        for (const raw of list) {
            if (isManagedEntry(raw, signature)) {
                oursBound = true;
                continue;
            }
            const commands = entryCommands(raw);
            const head = commandHead(commands[0] ?? '');
            const obj = (raw ?? {}) as Record<string, unknown>;
            const matcher = typeof obj['matcher'] === 'string' ? obj['matcher'] : null;
            const timeout = typeof obj['timeout'] === 'number' ? obj['timeout'] : null;
            entries.push({
                id: `${host}:${event}/${head === '' ? 'unreadable' : head}`,
                shape: 'hook_group',
                digest: sha256(JSON.stringify(raw)),
                source: file,
                event,
                matcher,
                command_head: head,
                timeout,
                // No host exposes another package's hook execution to a hook,
                // so a neighbour's effect is not readable from its
                // registration. `unknown` is the honest answer, and 2.3 treats
                // it as capable of denying rather than assuming it is not.
                effect: 'unknown',
            });
        }
    }
    entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { entries, oursBound, present: true };
}

/** Files directly under `dir` the manifest does not claim. */
function unclaimedUnder(
    dir: string,
    origin: string,
    shape: ShapeClass,
    owned: ReadonlySet<string>,
    opts: { nested?: boolean } = {},
): NeighbourEntry[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir).sort();
    } catch {
        return [];
    }
    const out: NeighbourEntry[] = [];
    for (const name of names) {
        if (name.startsWith('.')) continue;
        const full = path.join(dir, name);
        // A skill is a DIRECTORY with a SKILL.md; a command or rule is a file.
        const probe = opts.nested === true ? path.join(full, 'SKILL.md') : full;
        let body: string;
        try {
            const st = fs.statSync(probe);
            if (!st.isFile()) continue;
            body = fs.readFileSync(probe, 'utf-8');
        } catch {
            continue;
        }
        if (owned.has(path.resolve(probe))) continue;
        out.push({
            id: `${origin}:${opts.nested === true ? name : name.replace(/\.[^.]+$/, '')}`,
            shape,
            digest: sha256(body),
            source: probe,
        });
    }
    return out;
}

/** Top-level headings in `file` that this package's own template does not carry. */
export function foreignSections(file: string, templateFile: string, origin: string): NeighbourEntry[] {
    let body: string;
    try {
        body = fs.readFileSync(file, 'utf-8');
    } catch {
        return [];
    }
    let ours = new Set<string>();
    try {
        ours = new Set(
            fs
                .readFileSync(templateFile, 'utf-8')
                .split('\n')
                .filter((l) => /^#{1,2} /.test(l))
                .map((l) => l.replace(/^#{1,2} /, '').trim()),
        );
    } catch {
        // No template to compare against: every section reads as foreign,
        // which is the conservative answer and is visible as such.
    }
    const out: NeighbourEntry[] = [];
    const lines = body.split('\n');
    const isHeading = (n: number): boolean => /^#{1,2} /.test(lines[n] ?? '');
    for (let i = 0; i < lines.length; i += 1) {
        if (!isHeading(i)) continue;
        const heading = (lines[i] ?? '').replace(/^#{1,2} /, '').trim();
        if (ours.has(heading)) continue;
        let j = i + 1;
        while (j < lines.length && !isHeading(j)) j += 1;
        out.push({
            id: `${origin}:${heading}`,
            shape: 'instruction_section',
            digest: sha256(lines.slice(i, j).join('\n')),
            source: file,
        });
    }
    return out;
}

/** MCP servers in `.mcp.json` other than ours. */
function foreignMcpServers(projectRoot: string): NeighbourEntry[] {
    const file = path.join(projectRoot, '.mcp.json');
    const doc = readJson(file);
    const servers = doc?.['mcpServers'];
    if (servers === null || servers === undefined || typeof servers !== 'object' || Array.isArray(servers)) {
        return [];
    }
    return Object.entries(servers as Record<string, unknown>)
        .filter(([name]) => name !== OUR_MCP_KEY)
        .map(([name, spec]) => ({
            id: `project:${name}`,
            shape: 'mcp_server' as const,
            digest: sha256(JSON.stringify(spec)),
            source: file,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Label one host's environment.
 *
 * `degraded` is deliberately easy to reach — a foreign entry whose effect
 * cannot be read sits on a slot we gate, and that IS the degraded case. The
 * label names the entries responsible so the consumer can judge; it is a
 * report and never a refusal, and nothing downstream reads it as one.
 */
export function labelFor(
    entries: readonly ForeignHookEntry[],
    oursBound: boolean,
    gatedEvents: ReadonlySet<string>,
): { label: EnvironmentLabel; reason: string } {
    if (!oursBound) {
        return {
            label: 'uncontrolled',
            reason: 'this package has no hook group registered in this file',
        };
    }
    if (entries.length === 0) {
        return { label: 'controlled', reason: 'no foreign hook entry in this file' };
    }
    const onGated = entries.filter((e) => gatedEvents.has(e.event));
    const stopEntries = entries.filter((e) => /stop/i.test(e.event));
    if (onGated.length > 0 || stopEntries.length > 0) {
        const named = [...new Set([...onGated, ...stopEntries].map((e) => e.id))].sort();
        return {
            label: 'degraded',
            reason: `foreign entr(ies) of unread effect on a slot this package gates: ${named.join(', ')}`,
        };
    }
    return {
        label: 'coordinated',
        reason: `${entries.length} foreign entr(ies), none on a slot this package gates`,
    };
}

export interface CensusOptions {
    /** Events this package registers a `permission` concern on. */
    gatedEvents?: ReadonlySet<string>;
    /** Where this package's instruction templates live. */
    templatesRoot?: string;
    /** Our own skill names, for the `shadowed` warning. */
    ourSkillNames?: ReadonlySet<string>;
    /** The user-scope root; real `$HOME` in production, planted in a fixture. */
    homeRoot?: string;
}

/** Run the whole census for one consumer root. */
export function census(projectRoot: string, opts: CensusOptions = {}): NeighbourCensus {
    const gated = opts.gatedEvents ?? new Set<string>();
    const owned = new Set(readRecordedHashes(manifest_path(projectRoot), projectRoot).keys());
    const home = opts.homeRoot ?? os.homedir();

    const hosts: HostCensus[] = [];
    const hookGroups: ForeignHookEntry[] = [];
    for (const { host, file, signature } of hookFiles(projectRoot, home)) {
        const { entries, oursBound, present } = censusHookFile(host, file, signature);
        if (!present) continue;
        const { label, reason } = labelFor(entries, oursBound, gated);
        hosts.push({
            host,
            file,
            present,
            hook_groups: entries,
            ours_bound: oursBound,
            label,
            label_reason: reason,
        });
        hookGroups.push(...entries);
    }

    const skills = [
        ...unclaimedUnder(path.join(projectRoot, '.claude', 'skills'), 'project', 'skill', owned, {
            nested: true,
        }),
        ...unclaimedUnder(path.join(home, '.claude', 'skills'), 'user', 'skill', owned, {
            nested: true,
        }),
    ];
    const commands = unclaimedUnder(
        path.join(projectRoot, '.claude', 'commands'),
        'project',
        'command',
        owned,
    );
    const agents = unclaimedUnder(
        path.join(projectRoot, '.claude', 'agents'),
        'project',
        'agent',
        owned,
    );
    const ruleFiles = [
        ...unclaimedUnder(path.join(projectRoot, '.cursor', 'rules'), 'cursor', 'rule_file', owned),
        ...unclaimedUnder(path.join(projectRoot, '.windsurf', 'rules'), 'windsurf', 'rule_file', owned),
        ...unclaimedUnder(path.join(projectRoot, '.claude', 'rules'), 'claude', 'rule_file', owned),
    ];

    const templates = opts.templatesRoot ?? '';
    const instructionSections = [
        ...foreignSections(
            path.join(projectRoot, 'AGENTS.md'),
            path.join(templates, 'AGENTS.md'),
            'AGENTS.md',
        ),
        ...foreignSections(
            path.join(projectRoot, '.github', 'copilot-instructions.md'),
            path.join(templates, 'copilot-instructions.md'),
            'copilot-instructions.md',
        ),
    ];

    const warnings: CensusWarning[] = [];
    const ourSkills = opts.ourSkillNames ?? new Set<string>();
    for (const s of skills) {
        const name = s.id.split(':').slice(1).join(':');
        if (ourSkills.has(name)) {
            warnings.push({
                kind: 'shadowed',
                detail: `a skill named \`${name}\` sits at ${s.source} and this package ships one under the same name; which one the host resolves is the host's choice, not ours`,
            });
        }
    }
    warnings.push(...doubleGateWarnings(hookGroups, gated));
    warnings.push(...settingsTakeover(path.join(projectRoot, '.claude', 'settings.json')));
    warnings.push(...settingsTakeover(path.join(home, '.claude', 'settings.json')));
    for (const h of hosts) {
        if (!h.ours_bound) {
            warnings.push({
                kind: 'removed-after-install',
                detail: `${h.file} carries hook entries but none of ours — this package's group is absent after its own install`,
            });
        }
    }

    return {
        project_root: projectRoot,
        hosts,
        hook_groups: hookGroups,
        skills,
        commands,
        agents,
        mcp_servers: foreignMcpServers(projectRoot),
        rule_files: ruleFiles,
        instruction_sections: instructionSections,
        warnings,
    };
}

/**
 * One warning per event where a foreign entry shares a slot this package gates.
 *
 * Worded as the host behaves and no further: every registered hook on an event
 * runs, and a deny from any of them applies. There is no order to report
 * because the host does not give one, so the warning never implies that ours
 * runs first, last, or instead.
 */
export function doubleGateWarnings(
    entries: readonly ForeignHookEntry[],
    gatedEvents: ReadonlySet<string>,
): CensusWarning[] {
    const byEvent = new Map<string, ForeignHookEntry[]>();
    for (const e of entries) {
        if (!gatedEvents.has(e.event)) continue;
        const arr = byEvent.get(e.event);
        if (arr) arr.push(e);
        else byEvent.set(e.event, [e]);
    }
    return [...byEvent.entries()]
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([event, list]) => ({
            kind: 'double-gate' as const,
            detail:
                `${event}: ${list.length} foreign entr(ies) (${list.map((e) => e.id).join(', ')}) ` +
                `share this event with a gate of ours. The host runs both; either deny applies.`,
        }));
}

/**
 * Settings keys a neighbour can set that change what the host does to US.
 *
 * Liveness, not trust: this is not an accusation that whoever wrote the key
 * meant harm, and the census never removes one. It is the second half of
 * "is this package still doing what it was installed to do" — a `model`
 * override decides which model reads our rules, and a `CLAUDE_CODE_*`
 * environment key can change the harness underneath every hook we bound.
 * Both are legitimate things for a consumer to set. Neither is visible
 * anywhere else, which is the whole reason the census reports them.
 */
export function settingsTakeover(settingsFile: string): CensusWarning[] {
    const doc = readJson(settingsFile);
    if (doc === null) return [];
    const out: CensusWarning[] = [];
    if (doc['model'] !== undefined) {
        out.push({
            kind: 'settings-takeover',
            detail: `${settingsFile} sets \`model\` — the host resolves every turn against it, including the ones this package's rules are loaded into`,
        });
    }
    const env = doc['env'];
    if (env !== null && typeof env === 'object' && !Array.isArray(env)) {
        const keys = Object.keys(env as Record<string, unknown>)
            .filter((k) => k.startsWith('CLAUDE_CODE_'))
            .sort();
        if (keys.length > 0) {
            out.push({
                kind: 'settings-takeover',
                detail: `${settingsFile} sets host environment key(s) ${keys.join(', ')} — these change the harness the hooks this package bound run inside`,
            });
        }
    }
    return out;
}

/** Events this package registers a `permission` concern on, from the manifest. */
export function gatedEventsFrom(
    manifest: { concerns?: Record<string, { effect?: string }>; platforms?: Record<string, Record<string, unknown>> },
    nativeAliases: Record<string, Record<string, string>> = {},
): Set<string> {
    const concerns = manifest.concerns ?? {};
    const permission = new Set(
        Object.keys(concerns).filter((n) => concerns[n]?.effect === 'permission'),
    );
    const out = new Set<string>();
    for (const [host, events] of Object.entries(manifest.platforms ?? {})) {
        if (events === null || typeof events !== 'object') continue;
        for (const [event, chain] of Object.entries(events)) {
            if (!Array.isArray(chain)) continue;
            if (!chain.some((c) => permission.has(String(c)))) continue;
            out.add(event);
            const native = nativeAliases[host]?.[event];
            if (typeof native === 'string') out.add(native);
            // The host's own event name is what a neighbour's file uses, and
            // the alias table maps one way; add the reverse hits too.
            for (const [nativeName, acEvent] of Object.entries(nativeAliases[host] ?? {})) {
                if (acEvent === event) out.add(nativeName);
            }
        }
    }
    return out;
}
