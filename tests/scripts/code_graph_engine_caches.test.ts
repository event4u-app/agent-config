import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { discoverFiles } from '../../src/scripts/code_graph/build.js';

/**
 * Engine cache directories are skipped only beside the engine's own marker.
 *
 * Built in `os.tmpdir()` on purpose: a fixture inside this repository is
 * git-visible, and since #2808 the walk honours `.gitignore`, which would hide
 * the very case under test — a checkout with no git or no ignore file, where a
 * Unity `Library/PackageCache` contributes thousands of `.cs` files.
 */

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-engine-caches-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

function write(rel: string, body = ''): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body, 'utf8');
}

function walked(): string[] {
    return discoverFiles(root).map((f) => path.relative(root, f).split(path.sep).join('/'));
}

const UNITY_CACHES = ['Library', 'Temp', 'Obj', 'Logs', 'UserSettings'];
const UNREAL_CACHES = ['Intermediate', 'Saved', 'Binaries', 'DerivedDataCache'];

describe('code graph walk — engine cache directories', () => {
    it('the fixture is outside any git checkout', () => {
        expect(fs.existsSync(path.join(root, '.git'))).toBe(false);
    });

    it('a Unity root skips its caches and keeps its sources', () => {
        write('ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 2022.3.10f1\n');
        write('Assets/Scripts/Player.cs');
        for (const d of UNITY_CACHES) write(`${d}/Cached.cs`);
        expect(walked()).toEqual(['Assets/Scripts/Player.cs']);
    });

    it('an Unreal root skips its caches and keeps its sources', () => {
        write('Shooter.uproject', '{"FileVersion": 3}');
        write('Source/Shooter/Weapon.cs');
        for (const d of UNREAL_CACHES) write(`${d}/Cached.cs`);
        expect(walked()).toEqual(['Source/Shooter/Weapon.cs']);
    });

    it('without a marker the same names are ordinary directories', () => {
        for (const d of [...UNITY_CACHES, ...UNREAL_CACHES]) write(`${d}/Code.cs`);
        expect(walked()).toHaveLength(UNITY_CACHES.length + UNREAL_CACHES.length);
    });

    it('a Unity marker does not skip the Unreal names, nor a nested Library', () => {
        write('ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 2022.3.10f1\n');
        write('Intermediate/Kept.cs');
        write('Assets/Library/Kept.cs');
        expect(walked()).toEqual(['Assets/Library/Kept.cs', 'Intermediate/Kept.cs']);
    });

    it('an engine project in a subdirectory skips its own caches', () => {
        write('game/ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 2022.3.10f1\n');
        write('game/Library/Cached.cs');
        write('game/Assets/Player.cs');
        write('Library/Kept.cs');
        expect(walked()).toEqual(['Library/Kept.cs', 'game/Assets/Player.cs']);
    });
});
