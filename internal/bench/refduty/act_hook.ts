/**
 * Bench-only PreToolUse hook for the reference-duty arms (step 3.1). Installed
 * into a trial's clone by `install_act_hook`; never shipped.
 *
 *   act_hook.ts deliver <clone>   names the reference at a bound act, once each
 *   act_hook.ts gate <clone>      blocks a bound act once per unread reference
 *
 * "Read" is decided from the session transcript: a Read of the reference path,
 * or a Bash command naming it. State lives in `<clone>/.claude/refduty-state.json`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { commandRunsAct } from '../../../src/scripts/_lib/shell_acts.js';

interface ActMap {
    acts: Array<{ shell_command: string; refs: Array<{ rule: string; path: string }> }>;
}

function main(): number {
    const [mode, clone] = process.argv.slice(2);
    if ((mode !== 'deliver' && mode !== 'gate') || clone === undefined) return 0;
    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(fs.readFileSync(0, 'utf8')) as Record<string, unknown>;
    } catch {
        return 0;
    }
    if (payload['tool_name'] !== 'Bash') return 0;
    const command = String((payload['tool_input'] as Record<string, unknown> | undefined)?.['command'] ?? '');
    const map = JSON.parse(fs.readFileSync(path.join(clone, '.claude', 'refduty.json'), 'utf8')) as ActMap;
    const due = map.acts.filter((a) => commandRunsAct(command, a.shell_command)).flatMap((a) => a.refs.map((r) => ({ ...r, act: a.shell_command })));
    if (due.length === 0) return 0;
    const statePath = path.join(clone, '.claude', 'refduty-state.json');
    const state = fs.existsSync(statePath) ? (JSON.parse(fs.readFileSync(statePath, 'utf8')) as Record<string, string[]>) : {};
    const done = new Set(state[mode] ?? []);
    let transcript = '';
    try {
        transcript = fs.readFileSync(String(payload['transcript_path'] ?? ''), 'utf8');
    } catch {
        transcript = '';
    }
    const unread = due.filter((r) => !transcript.includes(r.path) && !transcript.includes(path.join(clone, r.path)));
    const fresh = (mode === 'deliver' ? due : unread).filter((r) => !done.has(r.path));
    if (fresh.length === 0) return 0;
    for (const r of fresh) done.add(r.path);
    fs.writeFileSync(statePath, JSON.stringify({ ...state, [mode]: [...done] }));
    const lines = fresh.map((r) => `\`${r.act}\` falls under ${r.rule}; its reference is ${r.path}.`);
    if (mode === 'deliver') {
        process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: lines.join(' ') } }));
        return 0;
    }
    process.stderr.write(`Blocked once: read the reference before this command. ${lines.join(' ')}`);
    return 2;
}

process.exit(main());
