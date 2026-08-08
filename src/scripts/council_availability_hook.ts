#!/usr/bin/env node
/**
 * Council-availability fact — `session_start` concern.
 *
 * Carries ONE fact the context does not otherwise contain: whether an AI council
 * is configured for this machine, and where its config was resolved from.
 *
 * WHY THIS EXISTS — the measured failure, not a general reminder.
 *
 * 2026-08-08, in a consumer project with no project-scope install, an agent
 * announced:
 *
 *   "Kein Council konfiguriert (keine `.agent-settings.yml`) — ich nutze
 *    Subagenten-Fächer mit gegnerischen Linsen als Ersatz"
 *
 * and substituted a weaker path. The council was configured the whole time. The
 * user's correction was blunt and correct. The inference was wrong twice over:
 *
 *   1. Council config has not lived in `.agent-settings.yml` since the Phase-0
 *      migration removed that block.
 *   2. Per ADR-104 the project tree is NEVER searched for council config, so the
 *      presence or absence of ANY project file says nothing about availability
 *      in either direction.
 *
 * The guidance was not missing. `/council default` states it emphatically in
 * four separate places, and it is correct. But a command file loads only when
 * that command is invoked, and the agent was answering a prior question — "does
 * this capability exist?" — before invoking anything. The always-loaded rule
 * layer refers to the council conditionally ("when the council is enabled")
 * and never says how to determine that. Faced with a conditional and no test,
 * the agent guessed the location every other setting lives in, and that guess
 * is the one location this config specifically is not in.
 *
 * So this is not more prose, and it is deliberately not a rule. It is the
 * language-mirror pattern applied to a capability: a hook can supply a fact the
 * transcript cannot express. `council:status` makes the fact *obtainable*; this
 * makes it *present*, which is the difference between a check an agent could
 * have run and one it did not need to.
 *
 * Advisory, always. It never blocks, and a resolution failure degrades to
 * silence rather than to a claim — a hook that guessed here would reproduce the
 * defect it exists to remove.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { readHookStdin } from './hooks/hook_stdin.js';
import {
    COUNCIL_CONFIG_ENV,
    load_council_config,
    resolve_config_path,
} from './ai_council/config.js';

const EXIT_ALLOW = 0;

export interface Availability {
    configured: boolean;
    path: string;
    exists: boolean;
    provenance: 'user-global' | 'env-override';
    membersEnabled: number;
    memberNames: string[];
}

/**
 * Resolve availability without throwing. A malformed or unreadable config is
 * reported as not-configured with `exists: true`, which is the distinction a
 * reader needs: "write a config" and "fix your config" are different actions.
 */
export function resolveAvailability(
    cwd: string,
    env: Record<string, string | undefined>,
): Availability | null {
    let p: string;
    try {
        p = String(resolve_config_path(cwd, { env: env as never }));
    } catch {
        return null; // cannot resolve — say nothing rather than guess
    }
    const exists = fs.existsSync(p);
    const provenance = env[COUNCIL_CONFIG_ENV] ? 'env-override' : 'user-global';
    if (!exists) {
        return { configured: false, path: p, exists: false, provenance, membersEnabled: 0, memberNames: [] };
    }
    try {
        const cfg = load_council_config(p);
        const enabled = [...cfg.members.entries()].filter(([, m]) => m.enabled).map(([n]) => n);
        return {
            configured: cfg.enabled && enabled.length > 0,
            path: p,
            exists: true,
            provenance,
            membersEnabled: enabled.length,
            memberNames: enabled,
        };
    } catch {
        return { configured: false, path: p, exists: true, provenance, membersEnabled: 0, memberNames: [] };
    }
}

export function buildFact(a: Availability): string {
    const head = a.configured
        ? `An AI council IS configured: ${String(a.membersEnabled)} enabled member(s) — ${a.memberNames.join(', ')}.`
        : a.exists
          ? 'An AI council config exists but is NOT usable (unreadable, disabled, or no enabled member).'
          : 'No AI council is configured on this machine.';
    return [
        '<council-availability>',
        head,
        `Resolved from ${a.provenance}: ${a.path}`,
        'The project tree is NEVER searched for council config (ADR-104), and the',
        'config has not lived in `.agent-settings.yml` since the Phase-0 migration.',
        'So do NOT infer council availability from any project file, in either',
        'direction — this line is the answer, and `agent-config council:status`',
        're-checks it on demand without spending anything.',
        a.configured
            ? 'Never announce that no council is configured, and never substitute a weaker path on that basis.'
            : 'A substitute is legitimate here — say which one you are using and why.',
        '</council-availability>',
    ].join('\n');
}

function _workspaceRoot(env: Record<string, unknown>): string {
    for (const key of ['project_dir', 'projectDir', 'cwd', 'workspace_root']) {
        const v = env[key];
        if (typeof v === 'string' && v.trim() !== '') {
            return v;
        }
    }
    return process.cwd();
}

export function run(stdin: string, options: { env?: Record<string, string | undefined> } = {}): number {
    let envelope: Record<string, unknown> = {};
    if (stdin.trim() !== '') {
        try {
            const parsed = JSON.parse(stdin) as unknown;
            if (parsed !== null && typeof parsed === 'object') {
                envelope = parsed as Record<string, unknown>;
            }
        } catch {
            return EXIT_ALLOW; // never act on a malformed envelope
        }
    }
    const event = envelope['event'];
    const slot = typeof event === 'string' && event !== '' ? event : 'session_start';
    if (slot !== 'session_start') {
        return EXIT_ALLOW;
    }
    const a = resolveAvailability(_workspaceRoot(envelope), options.env ?? process.env);
    if (a === null) {
        return EXIT_ALLOW;
    }
    process.stdout.write(
        `${JSON.stringify({
            decision: 'allow',
            reason: `council-availability: ${a.configured ? 'configured' : 'not configured'}`,
            context: buildFact(a),
        })}\n`,
    );
    return EXIT_ALLOW;
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    let env = process.env;
    void args;
    return run(readHookStdin(), { env });
}

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (_isCliEntry()) {
    process.exit(main());
}

void fileURLToPath;
