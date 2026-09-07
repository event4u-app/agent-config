/**
 * The partition's DELIVERY PATHS, exercised through the real generators.
 *
 * ## Why this file exists
 *
 * A neutral review of PR #1512 landed the same finding from both seats: the
 * partition's unit tests covered the pure predicate and nothing exercised the
 * stateful half. One of them reimplemented the production expression
 * (then `personaWithheldFor(...) ? [] : [...]`, today `personaListFor`) and called that a reconciliation
 * test — so it would stay green if the generator stopped applying the partition,
 * or applied it and left the stale symlinks standing. Reviewer B put it exactly:
 * "reconstructs the desired expression instead of calling the generator".
 *
 * So these tests drive `generate_persona_symlinks()` and
 * `generate_claude_project_commands()` over a temp project with a SYNTHETIC HOME
 * whose `~/.claude` really does carry the fixture's own artefact NAMES, and then
 * assert what is on disk.
 *
 * The seam changed on 2026-09-07 and it is the point of the change: the fixture
 * used to arm a LOCKFILE — version equality plus a fingerprint — because the
 * withhold was gated on one repo-wide verdict. It now seeds the artefacts
 * themselves, because the withhold reads each host directory's own contents. The
 * lockfile is still written, so the DIAGNOSTIC half stays exercised, but no
 * assertion below depends on it any more.
 *
 * Three properties, none of which the predicate tests can reach:
 *
 * 1. layer CARRIES the names → the Claude directories are empty and the
 *    non-Claude ones are populated. Withholding everywhere would deliver a cursor
 *    persona from NEITHER layer, the one outcome the fail-safe design forbids.
 * 2. A tree an EARLIER version populated is emptied by one run. A gate that only
 *    declines to write leaves the duplicate standing — the partition would stop
 *    new duplication and keep the old, which is not a partition.
 * 3. layer ABSENT → everything is written, including the Claude side. The project
 *    copy is the only reachable one there.
 *
 * `process.env.HOME` is the seam: the carriage reader resolves the host layer
 * through `$HOME`, falling back to `os.homedir()`. Windows is skipped rather than
 * guessed at — `os.homedir()` does not read `$HOME` there, so the fixture would
 * silently point at the real profile and the test would assert against whatever
 * that machine happens to hold.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fingerprintLayers, hostLayerInputs } from '../../src/install/hostLayerFingerprint.js';
import { _resetHostLayerVerdictForTest } from '../../src/install/partitionEligibility.js';
import { _resetClaudeLayerMemoForTest } from '../../src/install/claudeLayerCarriage.js';
import * as condense from '../../src/scripts/condense.js';
import { lockfile_path, read_lockfile, write_lockfile } from '../../src/scripts/_lib/installed_lock.js';

const WINDOWS = process.platform === 'win32';

function tmp(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A project tree with the personas the generator reads and one clustered command. */
function project(root: string, personas: readonly string[]): void {
    const src = path.join(root, 'dist', 'agent-src', 'personas');
    fs.mkdirSync(src, { recursive: true });
    for (const p of personas) {
        fs.writeFileSync(path.join(src, p), '---\nname: x\n---\nbody\n', 'utf-8');
    }
    const cmd = path.join(root, 'src', 'domains', 'product-basic', 'roadmap', 'process-full');
    fs.mkdirSync(cmd, { recursive: true });
    fs.writeFileSync(
        path.join(cmd, 'command.md'),
        '---\nname: roadmap-process-full\ndescription: Demo.\n---\n\nBody.\n',
        'utf-8',
    );
}

/**
 * A HOME whose `~/.claude` carries THIS fixture's own artefact names.
 *
 * `carried` is what the withhold now reads, so it is what the fixture must seed:
 * the persona filenames and the colon-form command subpath the project tree
 * below produces. Seeding a generic `seed.md` instead — which is what this
 * fixture did while the verdict was the gate — would arm the lockfile and
 * withhold nothing, turning both ACTIVE assertions green for the wrong reason.
 *
 * The fingerprint is still COMPUTED from the directories just written rather than
 * hardcoded — a literal would pass by construction and stop meaning anything the
 * moment `hostLayerInputs` changes which directories it reads.
 */
function armedHome(version: string, carried: readonly string[]): string {
    const home = tmp('pdt-home-');
    // HOME FIRST, before anything that could resolve a default path. This is not
    // defensive style — it is the fix for real damage this file did: the first
    // version called `write_lockfile` with the wrong signature (an object where
    // `version: string` goes, the target path where `tools: string[]` goes) and
    // therefore with `options = {}`, so the target fell through to
    // `lockfile_path()`. With HOME still pointing at the real profile that
    // OVERWROTE `~/.event4u/agent-config/installed.lock` with
    // `agent_config_version: "[object Object]"` and a char-split `tools` list,
    // silently disabling the partition on the machine running the tests.
    process.env['HOME'] = home;
    for (const family of ['rules', 'skills', 'commands', 'personas']) {
        fs.mkdirSync(path.join(home, '.claude', family), { recursive: true });
    }
    for (const rel of carried) {
        const target = path.join(home, '.claude', rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, 'carried\n', 'utf-8');
    }
    const lock = path.join(home, '.event4u', 'agent-config', 'installed.lock');
    // Explicit override BEFORE the write, so the resolver cannot fall through to
    // the real install record even if the `path` option below were ever dropped.
    process.env['AGENT_CONFIG_INSTALLED_LOCK'] = lock;
    // Belt and braces: a wrong signature must fail loudly, not write elsewhere.
    if (!lockfile_path().startsWith(home)) {
        throw new Error(`fixture escape: lockfile_path() = ${lockfile_path()}`);
    }
    write_lockfile(version, ['claude-code'], {
        path: lock,
        host_layer_fingerprint: fingerprintLayers(hostLayerInputs(home)),
    });
    if (read_lockfile(lock)?.agent_config_version !== version) {
        // The signature error was invisible: it produced a lockfile that PARSED,
        // just with no version — which the predicate reads as "not verified" and
        // resolves fail-safe. A fixture that silently fails to arm the thing it
        // exists to arm turns two real assertions into two green ones.
        throw new Error('fixture did not arm: lockfile carries no matching version');
    }
    return home;
}

function projectVersion(root: string): string {
    // The version the predicate compares against is the checkout's own
    // package.json, so the fixture has to carry one.
    const v = '99.0.0';
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: v }), 'utf-8');
    return v;
}

describe.skipIf(WINDOWS)('partition delivery topology — through the generators', () => {
    let saved: ReturnType<typeof condense._getStateForTest>;
    let savedHome: string | undefined;
    let savedLock: string | undefined;
    let root: string;
    let home: string;

    beforeEach(() => {
        saved = condense._getStateForTest();
        savedHome = process.env['HOME'];
        savedLock = process.env['AGENT_CONFIG_INSTALLED_LOCK'];
        root = tmp('pdt-proj-');
        project(root, ['alpha.md', 'beta.md']);
    });

    afterEach(() => {
        condense._setStateForTest(saved);
        if (savedHome === undefined) delete process.env['HOME'];
        else process.env['HOME'] = savedHome;
        if (savedLock === undefined) delete process.env['AGENT_CONFIG_INSTALLED_LOCK'];
        else process.env['AGENT_CONFIG_INSTALLED_LOCK'] = savedLock;
        _resetHostLayerVerdictForTest();
        _resetClaudeLayerMemoForTest();
        fs.rmSync(root, { recursive: true, force: true });
        if (home !== undefined) fs.rmSync(home, { recursive: true, force: true });
    });

    const claudePersonas = (): string[] => list(path.join(root, '.claude', 'personas'));
    const cursorPersonas = (): string[] => list(path.join(root, '.cursor', 'personas'));
    const claudeCommands = (): string[] => {
        const dir = path.join(root, '.claude', 'commands');
        if (!fs.existsSync(dir)) return [];
        const out: string[] = [];
        const walk = (d: string): void => {
            for (const e of fs.readdirSync(d, { withFileTypes: true })) {
                if (e.isDirectory()) walk(path.join(d, e.name));
                else out.push(e.name);
            }
        };
        walk(dir);
        return out;
    };

    function list(dir: string): string[] {
        if (!fs.existsSync(dir)) return [];
        return fs
            .readdirSync(dir)
            .filter((n) => n !== 'README.md')
            .sort();
    }

    /** Make the host layer carry the fixture's artefacts, or nothing at all. */
    function activate(active: boolean): void {
        const v = projectVersion(root);
        if (active) {
            // sets HOME itself, deliberately — see its note
            home = armedHome(v, [
                'personas/alpha.md',
                'personas/beta.md',
                'commands/roadmap/process-full.md',
            ]);
        } else {
            home = tmp('pdt-home-empty-');
            // No host layer AND no install record — an unreadable `~/.claude` is
            // the no-evidence state the per-name fail-safe rests on. Leaving a
            // stale override here would make this case depend on the previous one.
            delete process.env['AGENT_CONFIG_INSTALLED_LOCK'];
        }
        process.env['HOME'] = home;
        _resetHostLayerVerdictForTest();
        _resetClaudeLayerMemoForTest();
        condense._resetStateForTest(root);
    }

    it('CARRIED: withholds the Claude directories and still populates the others', () => {
        activate(true);
        condense.generate_persona_symlinks();
        condense.generate_claude_project_commands();

        expect(claudePersonas()).toEqual([]);
        expect(claudeCommands()).toEqual([]);
        // The failure this pins: withholding everywhere. The evidence is the
        // CLAUDE layer and says nothing about ~/.cursor, so a cursor persona
        // withheld on a claude directory listing is delivered nowhere.
        expect(cursorPersonas()).toEqual(['alpha.md', 'beta.md']);
    });

    it('CARRIED: RECONCILES a tree an earlier version populated, in one run', () => {
        // Written the way a pre-partition generator left it, then one run.
        activate(false);
        condense.generate_persona_symlinks();
        condense.generate_claude_project_commands();
        expect(claudePersonas()).toEqual(['alpha.md', 'beta.md']);
        expect(claudeCommands()).toEqual(['process-full.md']);

        activate(true);
        condense.generate_persona_symlinks();
        condense.generate_claude_project_commands();

        expect(claudePersonas()).toEqual([]);
        // And the empty cluster DIRECTORIES go too: `check_single_delivery`
        // counts directory names, so 40 empty dirs read as 40 overlapping
        // commands against a layer delivering none.
        expect(fs.existsSync(path.join(root, '.claude', 'commands', 'roadmap'))).toBe(false);
        expect(cursorPersonas()).toEqual(['alpha.md', 'beta.md']);
    });

    it('ABSENT LAYER: writes the Claude directories — the project copy is the only one', () => {
        activate(false);
        condense.generate_persona_symlinks();
        condense.generate_claude_project_commands();

        expect(claudePersonas()).toEqual(['alpha.md', 'beta.md']);
        expect(claudeCommands()).toEqual(['process-full.md']);
    });
});
