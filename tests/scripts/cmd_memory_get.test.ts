// Tests for src/scripts/_cli/cmd_memory_get.ts — the `agent-config memory:get`
// CLI twin of the `memory_get` MCP tool (batch full-entry fetch by id,
// road-to-reachable-code-memory Phase 1).
//
// Uses the same temp-repo-root + module-root-repoint fixture pattern as
// tests/scripts/memory_lookup.test.ts (`ml._setMemoryRoot` etc.) since
// `cmd_memory_get.ts` reuses `memory_get_v1` from that same module instance —
// no separate lookup logic to fixture around.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as ml from '../../src/scripts/memory_lookup.js';
import { main } from '../../src/scripts/_cli/cmd_memory_get.js';
import { runInProc } from '../_lib/run_in_process.js';

function write(p: string, content: string): void {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content, 'utf-8');
}

let tmp: string;
let origCwd: string;

function chdirInto(dir: string): void {
    process.chdir(dir);
    ml._setMemoryRoot(join('agents', 'memory'));
    ml._setIntakeRoot(join('agents', 'memory', 'intake'));
    ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
}

beforeEach(() => {
    origCwd = process.cwd();
    tmp = mkdtempSync(join(tmpdir(), 'memget-'));
});
afterEach(() => {
    process.chdir(origCwd);
    ml._setMemoryRoot(join('agents', 'memory'));
    ml._setIntakeRoot(join('agents', 'memory', 'intake'));
    ml._setKnowledgeRoot(join('agents', 'memory', 'knowledge'));
    rmSync(tmp, { recursive: true, force: true });
});

const FIXTURE_ENTRY = `
version: 1
entries:
  - id: own-1
    status: active
    confidence: high
    source: ["docs/teams.md"]
    owner: team-payments
    last_validated: 2026-01-01
    review_after_days: 180
    path: "app/Http/Controllers/Billing/**"
`;

describe('cmd_memory_get.ts — main()', () => {
    it('known id returns the full entry and exits 0', () => {
        chdirInto(tmp);
        write(join(tmp, 'agents/memory/ownership.yml'), FIXTURE_ENTRY);

        const result = runInProc(main, ['own-1']);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain('own-1');
        expect(result.stdout).toContain('team-payments');
        expect(result.stderr).toBe('');
    });

    it('known id in --format json exits 0 with a full-entry envelope', () => {
        chdirInto(tmp);
        write(join(tmp, 'agents/memory/ownership.yml'), FIXTURE_ENTRY);

        const result = runInProc(main, ['own-1', '--format', 'json']);

        expect(result.status).toBe(0);
        const parsed = JSON.parse(result.stdout) as { status: string; entries: unknown[] };
        expect(parsed.status).toBe('ok');
        expect(parsed.entries).toHaveLength(1);
    });

    it('unknown id exits 1 and reports the id as unknown', () => {
        chdirInto(tmp);
        write(join(tmp, 'agents/memory/ownership.yml'), FIXTURE_ENTRY);

        const result = runInProc(main, ['does-not-exist']);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('unknown id: does-not-exist');
    });

    it('mix of known + unknown ids exits 1 (partial) but still prints the known entry', () => {
        chdirInto(tmp);
        write(join(tmp, 'agents/memory/ownership.yml'), FIXTURE_ENTRY);

        const result = runInProc(main, ['own-1', 'does-not-exist']);

        expect(result.status).toBe(1);
        expect(result.stdout).toContain('own-1');
        expect(result.stderr).toContain('unknown id: does-not-exist');
    });

    it('no ids given exits 2 (usage error)', () => {
        chdirInto(tmp);
        const result = runInProc(main, []);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain('at least one <id> is required');
    });

    it('unrecognized flag exits 2 (usage error)', () => {
        chdirInto(tmp);
        const result = runInProc(main, ['own-1', '--bogus']);
        expect(result.status).toBe(2);
        expect(result.stderr).toContain('unrecognized arguments');
    });
});
