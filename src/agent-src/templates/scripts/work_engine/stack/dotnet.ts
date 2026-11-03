/**
 * .NET detection for `runner.ts`, split out of it at the source size budget.
 * Imports only the leaf `./engine` and never `runner.ts` back, so the
 * HIGH/MEDIUM tier is decided there from {@link DotnetBasis.test_stack}.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { engine_marker } from './engine.js';

/** What marks a scope as a runnable .NET target, and whether it names a test stack. */
export interface DotnetBasis {
    basis: string;
    /** A PROJECT file names a test stack — the HIGH tier. */
    test_stack: boolean;
}

/**
 * .NET project / solution extensions, matched by a root listing.
 *
 * .NET is the one ecosystem whose marker has no fixed FILENAME (the project
 * file is `<whatever>.csproj`), so this is an extension list over the root.
 *
 * **Residual cache gap.** `runner.ts`'s `latest_manifest_mtime` stats fixed NAMES, so
 * a signal it does not list is invisible to the key: a project-only .NET
 * scope, `features/support/env.rb`, `spec/spec_helper.rb`, `setup.cfg`,
 * `pytest.ini` and the `mvnw` / `gradlew` wrappers. Known, not closed.
 */
const _DOTNET_PROJECT_EXTS = ['.sln', '.slnx', '.csproj', '.fsproj', '.vbproj'];

/** The packages that make a .NET project a TEST project, for the HIGH tier. */
const _DOTNET_TEST_STACK = /Microsoft\.NET\.Test\.Sdk|xunit|nunit|mstest/i;

/**
 * How deep `_dotnet_project_text` looks. The conventional layout keeps the
 * solution at the root and projects at `src/<Name>/<Name>.csproj`, which a
 * root-only scan misses entirely. Depth 2 reaches it; a flat root still costs
 * one listing, since the walk descends only when the scope holds no project.
 */
const _DOTNET_SCAN_DEPTH = 2;

/** Ceiling on project files read per scope, once the descent is entered at all. */
const _DOTNET_MAX_PROJECTS = 50;

/** Solution extensions — named once, so the descent and its hit test agree. */
const _DOTNET_SOLUTION_EXTS = ['.sln', '.slnx'];

/** Does this scope hold a solution file? The precondition for descending. */
function _has_dotnet_solution(dir: string): boolean {
    try {
        // `withFileTypes`: an extension list over bare NAMES counts a
        // DIRECTORY called `x.sln` as a target. The walk already filters.
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .some((e) => e.isFile() && _DOTNET_SOLUTION_EXTS.includes(path.extname(e.name).toLowerCase()));
    } catch {
        return false;
    }
}

/** The root's .NET project or solution file, or `undefined` — files only, sorted. */
function _dotnet_root_target(root: string): string | undefined {
    let names: string[];
    try {
        // SORTED: the basis names the matched file and is serialised, so an
        // unsorted listing churns a stable config on rename. FILES only — a
        // directory named `x.csproj` is no target, and this row reaches
        // `selected`.
        names = fs
            .readdirSync(root, { withFileTypes: true })
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .sort();
    } catch {
        names = [];
    }
    // A ROOT TARGET, not a target anywhere. `dotnet test` is NOT recursive:
    // with no project or solution in the working directory it fails MSB1003,
    // whatever sits below. So the row is gated on this listing, and a scope
    // whose only .NET evidence is an SDK pin gets NO row — confidence does not
    // gate `selected`, so a row here would be a command that cannot run.
    return names.find((n) => _DOTNET_PROJECT_EXTS.includes(path.extname(n).toLowerCase()));
}

/**
 * .NET — the basis string, or `null` when nothing marks a .NET project.
 *
 * Mirrors the PHP gradation, awarding HIGH only for a NAMED runner: HIGH
 * needs a PROJECT file naming a TEST stack (`Microsoft.NET.Test.Sdk`, xunit,
 * nunit, mstest); a bare project or solution is MEDIUM, the analogue of the
 * bare manifest. That stops a bare non-test project raising the WHOLE
 * repository to HIGH, but does NOT keep the row out of `selected` —
 * `_apply_guard` has never read `confidence` — which is why a marker with no
 * project anywhere emits no row.
 */
export function _dotnet_basis(root: string): DotnetBasis | null {
    const target = _dotnet_root_target(root);
    if (target === undefined) {
        return null;
    }
    // A Unity or Unreal root carries a `.sln` and `*.csproj` the editor
    // generates for the IDE; its tests run in the engine's own runner, and
    // `dotnet test` there fails or runs nothing. No runner beats a wrong one.
    const engine = engine_marker(root);
    if (engine === 'unity' || engine === 'unreal') {
        return null;
    }
    // The DESCENT still matters for the tier: a root `.sln` is a valid target
    // whose own body names no package, so the projects it references decide
    // HIGH vs MEDIUM.
    return _DOTNET_TEST_STACK.test(_dotnet_project_text(root))
        ? { basis: 'test stack named in a .NET project file', test_stack: true }
        : { basis: `${target} present, no test stack named`, test_stack: false };
}

/**
 * The engine whose root made `_dotnet_basis` withhold a root .NET target, or
 * `null` when it withheld nothing — the suppression alone reads like "no .NET".
 */
export function _dotnet_withheld_by(root: string): 'unity' | 'unreal' | null {
    const engine = engine_marker(root);
    return (engine === 'unity' || engine === 'unreal') && _dotnet_root_target(root) !== undefined ? engine : null;
}

/**
 * Concatenated text of the .NET project files belonging to this scope.
 *
 * Scans the scope and, holding no project file of its own, descends to
 * {@link _DOTNET_SCAN_DEPTH}: the `root/src/<Name>/<Name>.csproj` layout,
 * where the root carries only a `.sln` and a `.sln` names no package. Sorted
 * at every level, so deterministic. Depth is bounded, and files READ are
 * bounded — directories LISTED are not, and the max-projects exits fire only
 * once a project was found.
 */
export function _dotnet_project_text(dir: string): string {
    const texts: string[] = [];
    // Gated on a solution. The gate suppresses the DESCENT only: this
    // directory is listed here and again by the walk, in every scope of every
    // repository. NOT pruned at scope boundaries either, so a root solution
    // plus package scopes can still double-attribute — both residue.
    const solution = _has_dotnet_solution(dir);
    const walk = (at: string, depth: number): void => {
        if (texts.length >= _DOTNET_MAX_PROJECTS) {
            return;
        }
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(at, { withFileTypes: true });
        } catch {
            return;
        }
        entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        let hit = false;
        for (const e of entries) {
            if (!e.isFile() || !_DOTNET_PROJECT_EXTS.includes(path.extname(e.name).toLowerCase())) {
                continue;
            }
            // A SOLUTION's body is project NAMES, never packages — neither
            // read as project text nor a reason to stop descending. Read,
            // `MyApp.SpecFlow.Tests` emits a HIGH `specflow` row no project
            // supports, and a legacy SpecFlow name beside a Reqnroll one makes
            // two dotnet rows the grouping REFUSES — a false positive deleting
            // a true row. Presence is still a descent signal.
            if (_DOTNET_SOLUTION_EXTS.includes(path.extname(e.name).toLowerCase())) {
                continue;
            }
            if (texts.length >= _DOTNET_MAX_PROJECTS) {
                return;
            }
            texts.push(_read_text(path.join(at, e.name)));
            hit = true;
        }
        if (hit || !solution || depth >= _DOTNET_SCAN_DEPTH) {
            return;
        }
        for (const e of entries) {
            if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
                walk(path.join(at, e.name), depth + 1);
            }
        }
    };
    walk(dir, 0);
    return texts.join('\n');
}

function _read_text(p: string): string {
    try {
        return fs.statSync(p).isFile() ? fs.readFileSync(p, { encoding: 'utf-8' }) : '';
    } catch {
        return '';
    }
}
