/**
 * Game-engine project markers, read from a scope ROOT only.
 *
 * Leaf module — stdlib only. Shared by {@link "./dotnet"} (an engine root
 * suppresses `dotnet test`) and {@link "./detect"} (an engine root is not a
 * `plain` web project). A marker below the root says nothing about the root:
 * a repository can carry a Unity client beside a .NET service.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export type GameEngine = 'godot' | 'unity' | 'unreal';

/** Unity writes this file into every project; it is the editor's own version pin. */
export const UNITY_MARKER = path.join('ProjectSettings', 'ProjectVersion.txt');

/** Godot's project file, always at the project root. */
export const GODOT_MARKER = 'project.godot';

/** Unreal's project file has no fixed name, only the extension. */
export const UNREAL_EXT = '.uproject';

/** The engine whose marker sits at `root`, or `null`. Never raises. */
export function engine_marker(root: string): GameEngine | null {
    if (_is_file(path.join(root, GODOT_MARKER))) return 'godot';
    if (_is_file(path.join(root, UNITY_MARKER))) return 'unity';
    if (has_unreal_project(root)) return 'unreal';
    return null;
}

/** Does `root` hold a `*.uproject` FILE? */
export function has_unreal_project(root: string): boolean {
    try {
        return fs
            .readdirSync(root, { withFileTypes: true })
            .some((e) => e.isFile() && path.extname(e.name).toLowerCase() === UNREAL_EXT);
    } catch {
        return false;
    }
}

function _is_file(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}
