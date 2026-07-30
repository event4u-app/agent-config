// Behaviour test for `detect_managed_agents_folder`
// (`src/scripts/_lib/managed_agents_folder.ts`) — the managed-`agents/`-
// folder detector from Phase 0 of the roadmap-subagent-cache plan.
//
// Covers the three-state contract (`managed` / `unmanaged` / `not-a-project`)
// plus the adversarial case the exit gate names explicitly: a third-party
// repo that happens to contain an `agents/` directory must resolve
// `unmanaged`, never `managed`.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { detect_managed_agents_folder } from '../../../src/scripts/_lib/managed_agents_folder.js';

const _tmpDirs: string[] = [];

function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'managed-agents-folder-'));
    _tmpDirs.push(d);
    return d;
}

afterEach(() => {
    while (_tmpDirs.length > 0) {
        const d = _tmpDirs.pop();
        if (d) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

function makeGitProject(): string {
    const d = mkTmp();
    fs.mkdirSync(path.join(d, '.git'));
    return d;
}

describe('detect_managed_agents_folder', () => {
    it("returns 'not-a-project' for a bare directory outside any repo", () => {
        const d = mkTmp();
        // No `.git`, no `agents/` — just an empty directory.
        expect(detect_managed_agents_folder(d)).toBe('not-a-project');
    });

    it("returns 'not-a-project' for a directory that does not exist", () => {
        const d = path.join(mkTmp(), 'does-not-exist');
        expect(detect_managed_agents_folder(d)).toBe('not-a-project');
    });

    it("returns 'unmanaged' for a real repo with no agents/ folder at all", () => {
        const d = makeGitProject();
        expect(detect_managed_agents_folder(d)).toBe('unmanaged');
    });

    it("returns 'unmanaged' — adversarial: third-party repo with an unrelated agents/ dir", () => {
        const d = makeGitProject();
        // A third-party repo's own `agents/` directory — e.g. a multi-agent
        // framework's source — with none of this package's markers.
        fs.mkdirSync(path.join(d, 'agents'));
        fs.writeFileSync(path.join(d, 'agents', 'roster.yaml'), 'agents: []\n');
        expect(detect_managed_agents_folder(d)).toBe('unmanaged');
    });

    it("returns 'managed' via the agents/overrides/ marker", () => {
        const d = makeGitProject();
        fs.mkdirSync(path.join(d, 'agents', 'overrides'), { recursive: true });
        expect(detect_managed_agents_folder(d)).toBe('managed');
    });

    it("returns 'managed' via the .gitignore managed-block header", () => {
        const d = makeGitProject();
        fs.mkdirSync(path.join(d, 'agents'));
        fs.writeFileSync(
            path.join(d, '.gitignore'),
            '# event4u/agent-config\nagents/runtime/\n# event4u/agent-config — END\n',
        );
        expect(detect_managed_agents_folder(d)).toBe('managed');
    });

    it("returns 'managed' via a resolvable canonical .agent-settings.yml", () => {
        const d = makeGitProject();
        fs.mkdirSync(path.join(d, 'agents', 'settings'), { recursive: true });
        fs.writeFileSync(path.join(d, 'agents', 'settings', '.agent-settings.yml'), 'name: x\n');
        expect(detect_managed_agents_folder(d)).toBe('managed');
    });

    it("returns 'managed' via a resolvable legacy root .agent-settings.yml", () => {
        const d = makeGitProject();
        fs.mkdirSync(path.join(d, 'agents'));
        fs.writeFileSync(path.join(d, '.agent-settings.yml'), 'name: x\n');
        expect(detect_managed_agents_folder(d)).toBe('managed');
    });

    it("returns 'unmanaged' when agents/ exists with markers present elsewhere but agents/ itself is absent", () => {
        // Markers alone (no agents/ dir at all) must never flip to 'managed' —
        // the predicate is has_agents AND has_marker, not has_marker alone.
        const d = makeGitProject();
        fs.writeFileSync(
            path.join(d, '.gitignore'),
            '# event4u/agent-config\nagents/runtime/\n# event4u/agent-config — END\n',
        );
        fs.writeFileSync(path.join(d, '.agent-settings.yml'), 'name: x\n');
        expect(detect_managed_agents_folder(d)).toBe('unmanaged');
    });

    it("returns 'not-a-project' even when agents/ + markers exist without .git", () => {
        // The project-existence gate (`.git`) is checked first and wins —
        // no repo at all is not-a-project regardless of folder contents.
        const d = mkTmp();
        fs.mkdirSync(path.join(d, 'agents', 'overrides'), { recursive: true });
        expect(detect_managed_agents_folder(d)).toBe('not-a-project');
    });
});
