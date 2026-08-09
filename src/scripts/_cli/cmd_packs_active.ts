/**
 * `agent-config packs:active` — which packs are active HERE, and from which file.
 *
 * Phase 2 of `road-to-capability-answerability`. The sibling verb `packs ls`
 * lists the packs the *catalogue* knows about, which reads authoritative and
 * answers a different question. Five safety floors open with "auto-activates
 * when pack X is installed" and, before this verb, nothing could tell an agent
 * whether pack X is installed in the project it is standing in — so the honest
 * answer was an inference from a filename, which is the whole defect class this
 * roadmap exists to close.
 *
 * The answer has three parts and all three are printed, because two of them are
 * what makes the third checkable:
 *
 * - the resolved **profile id** and the layer that resolved it,
 * - the **packs** that profile declares, and the file they were read from,
 * - whether the resolution took the **degraded branch**.
 *
 * That last part is the reason this is a probe rather than a one-line lookup.
 * `resolve_profile` has a branch — a settings file exists but declares no
 * `profile.id` — that returns the default id with an EMPTY body: no packs, no
 * personas. An agent asking "which profile is active" gets `developer` and
 * concludes the developer packs are on. They are not, and nothing says so. The
 * carve-out module records this as one of nine keys where absent is not the
 * template default (`src/shared/settingsCarveOut.ts`, `profile.id`); this verb
 * is where it becomes visible at the moment somebody asks.
 *
 * Read-only by construction: nothing here opens a file for writing.
 *
 * Exit codes: `0` answered (including the degraded answer, which is a real
 * answer) · `1` the profile id names a file that does not exist.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    DEFAULT_PROJECT_FILE,
    load_agent_settings,
    resolve_project_root,
} from '../_lib/agent_settings.js';
import {
    ProfileError,
    profile_file,
    resolve_profile,
    SOURCE_MISSING,
    type ResolvedProfile,
} from '../config/profiles.js';

export interface PacksActiveOptions {
    /** Where to resolve from. Defaults to the process CWD. */
    cwd: string;
    json: boolean;
}

export interface PacksActiveResult {
    code: 0 | 1;
    out: string[];
    err: string[];
}

/**
 * Human-readable gloss per `resolve_profile` source constant.
 *
 * The raw constants (`user-settings`, `missing`, …) are precise and mean
 * nothing to a reader who has not read `profiles.ts`. A probe whose output
 * needs its own source lookup has not answered the question.
 */
const SOURCE_GLOSS: Readonly<Record<string, string>> = {
    runtime: 'set for this run (runtime override)',
    env: 'AGENT_CONFIG_PROFILE_ID environment variable',
    'user-settings': `profile.id in ${DEFAULT_PROJECT_FILE}`,
    pack: 'declared by an installed pack',
    default: 'no settings file — package default',
    [SOURCE_MISSING]: `settings file present but it declares no profile.id`,
};

/**
 * The file the profile body was read from, or `null` when it was never read.
 *
 * `null` is the degraded branch and only that branch: `resolve_profile`
 * returns an id without touching a file, so there is no path to name. Every
 * other branch delegates to the resolver's own `profile_file`, which is why
 * this function is four lines and not a second path search.
 */
export function profileFileFor(projectRoot: string, profile: ResolvedProfile): string | null {
    if (profile.source === SOURCE_MISSING) return null;
    const resolved = profile_file(projectRoot, profile.id);
    return _isFile(resolved) ? resolved : null;
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

export function runPacksActive(opts: PacksActiveOptions): PacksActiveResult {
    const out: string[] = [];
    const err: string[] = [];

    const [projectRoot] = resolve_project_root(null, { cwd: opts.cwd });
    const settings = load_agent_settings({ cwd: opts.cwd });

    let profile: ResolvedProfile;
    try {
        profile = resolve_profile({ project_root: projectRoot, user_settings: settings });
    } catch (exc) {
        if (exc instanceof ProfileError) {
            err.push(
                `❌  packs:active — ${exc.message}`,
                '    The profile id resolves but its file does not exist, so no pack set can be',
                '    named. This is a broken install or a hand-edited profile.id, not an empty one.',
            );
            return { code: 1, out, err };
        }
        throw exc;
    }

    const degraded = profile.source === SOURCE_MISSING;
    const file = profileFileFor(projectRoot, profile);
    const gloss = SOURCE_GLOSS[profile.source] ?? profile.source;

    if (opts.json) {
        out.push(
            JSON.stringify(
                {
                    profile_id: profile.id,
                    source: profile.source,
                    degraded,
                    packs: [...profile.packs],
                    personas: [...profile.personas],
                    profile_file: file,
                    project_root: projectRoot,
                },
                null,
                2,
            ),
        );
        return { code: 0, out, err };
    }

    out.push(`profile   ${profile.id}   (${gloss})`);
    out.push(
        profile.packs.length > 0
            ? `packs     ${profile.packs.join(', ')}   (${String(profile.packs.length)})`
            : 'packs     none',
    );
    out.push(`file      ${file ?? '— the profile body was never loaded'}`);
    out.push(`root      ${projectRoot}`);

    if (degraded) {
        out.push(
            '',
            '⚠️  Degraded resolution — this is the answer, not a warning about it.',
            `    A ${DEFAULT_PROJECT_FILE} exists here but declares no profile.id, so the id fell`,
            '    back to the package default while the profile BODY was never read: zero packs,',
            '    zero personas. Any rule that says "auto-activates when pack X is installed"',
            '    cannot activate in this project, and nothing else reports that.',
            '    Fix: set profile.id in the settings file, or run `agent-config use <id>`.',
        );
    } else if (profile.packs.length === 0) {
        out.push(
            '',
            `ℹ️  The ${profile.id} profile declares no packs. Pack-gated rules stay inert here.`,
        );
    }

    if (profile.warning !== null && !degraded) {
        out.push('', `⚠️  ${profile.warning}`);
    }

    return { code: 0, out, err };
}

interface ParsedArgv {
    ok: boolean;
    message?: string;
    json?: boolean;
}

export function parseArgv(argv: readonly string[]): ParsedArgv {
    let json = false;
    for (const a of argv) {
        if (a === '--json') {
            json = true;
        } else if (a === '-h' || a === '--help') {
            return { ok: false, message: 'usage: agent-config packs:active [--json]' };
        } else {
            return { ok: false, message: `unknown argument: ${a}` };
        }
    }
    return { ok: true, json };
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const parsed = parseArgv(argv);
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message ?? 'usage error'}\n`);
        return 2;
    }
    const result = runPacksActive({ cwd: process.cwd(), json: parsed.json === true });
    for (const line of result.out) process.stdout.write(`${line}\n`);
    for (const line of result.err) process.stderr.write(`${line}\n`);
    return result.code;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
