// Upgrade over a real previous-release bridge (issue #2805). The fixture is the
// `.windsurf/hooks.json` the installer wrote before `pre_user_prompt` and
// `post_cascade_response` were withdrawn — taken verbatim from the bridge golden
// of that release — so this exercises the installer's own writer against what a
// consumer actually has on disk, not strings the test reconstructs.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as inst from '../../src/scripts/install.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const BEFORE = path.join(REPO_ROOT, 'tests', 'fixtures', 'host_bridges', 'windsurf_hooks_before_2026-11-07.json');

let tmpRoot: string;
let project: string;
let bridge: string;

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'windsurf-upgrade-'));
    project = path.join(tmpRoot, 'consumer');
    bridge = path.join(project, '.windsurf', 'hooks.json');
    fs.mkdirSync(path.dirname(bridge), { recursive: true });
});

afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

type Hooks = Record<string, Array<{ command: string }>>;

function seed(extra: (hooks: Hooks) => void): Hooks {
    const before = JSON.parse(fs.readFileSync(BEFORE, 'utf8')) as { hooks: Hooks };
    extra(before.hooks);
    fs.writeFileSync(bridge, JSON.stringify(before, null, 4) + '\n');
    return before.hooks;
}

function readHooks(): Hooks {
    return (JSON.parse(fs.readFileSync(bridge, 'utf8')) as { hooks: Hooks }).hooks;
}

describe('upgrading a pre-2026-11-07 windsurf bridge', () => {
    it('removes only the two withdrawn entries the previous release wrote', () => {
        const foreign = { command: 'npx other-agent-pack hook pre_user_prompt' };
        const before = seed((h) => {
            h['pre_user_prompt']!.push(foreign);
            h['post_cascade_response']!.push({ command: `${h['post_cascade_response']![0]!.command}; user-audit.sh` });
        });
        const appended = before['post_cascade_response']![1]!;

        inst.ensure_windsurf_bridge(project, false);

        const after = readHooks();
        expect(after['post_setup_worktree']).toStrictEqual(before['post_setup_worktree']);
        expect(after['pre_user_prompt']).toStrictEqual([foreign]);
        expect(after['post_cascade_response']).toStrictEqual([appended]);
    });

    it('leaves a bridge holding only our previous entries with just the retained event, and stays put', () => {
        seed(() => undefined);
        inst.ensure_windsurf_bridge(project, false);
        const once = fs.readFileSync(bridge, 'utf8');
        expect(Object.keys(readHooks())).toStrictEqual(['post_setup_worktree']);
        inst.ensure_windsurf_bridge(project, false);
        expect(fs.readFileSync(bridge, 'utf8')).toBe(once);
    });
});
