/**
 * The reference-duty arms of step 3.1 (`internal/bench/refduty-PREREG.md`).
 *
 * Every arm carries the kernel rule text (`profile-minimal`), as a real install
 * does. `ref-full` adds the bound references' bodies to the system prompt;
 * `ref-deliver` and `ref-gate` install a project-level PreToolUse hook into the
 * clone that, at a bound shell act, either names the reference or blocks once
 * until it has been read. The references are copied into the clone's `.claude/`,
 * which the scorer excludes, so the agent can read them and the diff stays the
 * task's.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import actReferences from '../../../../src/config/act-references.json';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const RULES = path.join(REPO, 'src', 'rules');
const AGENT_SRC = path.join(REPO, 'src', 'agent-src');
const TSX = path.join(REPO, 'node_modules', '.bin', 'tsx');

export const ACT_HOOK_SCRIPT = path.join(REPO, 'internal', 'bench', 'refduty', 'act_hook.ts');

export type ActHookMode = 'deliver' | 'gate';

interface BoundReference {
    rule: string;
    /** Absolute source path under `src/agent-src`. */
    source: string;
}

function loadContext(rule: string): string[] {
    const text = fs.readFileSync(path.join(RULES, `${rule}.md`), 'utf8');
    const fm = parseYaml(text.slice(3, text.indexOf('\n---', 3))) as Record<string, unknown>;
    const lc = fm['load_context'];
    return Array.isArray(lc) ? lc.filter((x): x is string => typeof x === 'string') : [];
}

/** The references each bound act makes due, resolved to their source files. */
export function boundReferences(): Array<{ shell_command: string; refs: BoundReference[] }> {
    return actReferences.bindings.map((b) => ({
        shell_command: b.shell_command,
        refs: b.rules.flatMap((rule) => loadContext(rule).map((rel) => ({ rule, source: path.resolve(AGENT_SRC, rel.replace(/^(\.\.\/)+/, '')) }))),
    }));
}

/** The `ref-full` injection: every bound reference body, once each. */
export function refs_injection_text(): string {
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const b of boundReferences()) {
        for (const r of b.refs) {
            if (seen.has(r.source)) continue;
            seen.add(r.source);
            parts.push(`<!-- reference of ${r.rule}: ${path.basename(r.source)} -->\n${fs.readFileSync(r.source, 'utf8')}`);
        }
    }
    return parts.join('\n\n');
}

/**
 * Copy the bound references into `<clone>/.claude/references/`, write the act
 * map the hook reads, and register the hook in the clone's project settings.
 */
export function install_act_hook(clone: string, mode: ActHookMode): void {
    const dir = path.join(clone, '.claude');
    const refsDir = path.join(dir, 'references');
    fs.mkdirSync(refsDir, { recursive: true });
    const acts = boundReferences().map((b) => ({
        shell_command: b.shell_command,
        refs: b.refs.map((r) => {
            const rel = path.join('.claude', 'references', path.basename(r.source));
            fs.copyFileSync(r.source, path.join(clone, rel));
            return { rule: r.rule, path: rel };
        }),
    }));
    fs.writeFileSync(path.join(dir, 'refduty.json'), `${JSON.stringify({ acts }, null, 2)}\n`);
    const command = `${JSON.stringify(TSX)} ${JSON.stringify(ACT_HOOK_SCRIPT)} ${mode} ${JSON.stringify(clone)}`;
    const settings = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command }] }] } };
    fs.writeFileSync(path.join(dir, 'settings.json'), `${JSON.stringify(settings, null, 2)}\n`);
}
