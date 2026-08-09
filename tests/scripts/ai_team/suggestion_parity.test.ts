/**
 * Command-suggestion parity pin for team mode — road-to-team-mode Phase 6
 * acceptance criterion, updated for the CLI-first availability posture
 * (road-to-always-on-orchestration Phase 1, Step 1.3 — `ai_team.enabled`
 * deleted).
 *
 * Council verdict 2026-07-28 (claude-sonnet-4-5 + gpt-4o, 2 rounds,
 * option C): the suggestion SURFACE may carry the `/team` master as
 * eligible because suggestions never auto-execute and its
 * `trigger_context` textually carries the availability precondition the
 * suggesting agent must check (command-suggestion-policy). That
 * precondition is now "/team is available" (codex CLI + auth, not a
 * settings flag) rather than `ai_team.enabled is true`. Parity is
 * therefore pinned as: (1) exactly one team-family command is eligible,
 * (2) its trigger_context carries the availability precondition,
 * (3) every sub-command is ineligible, (4) the deterministic suggester
 * has zero `ai_team` awareness — its output is invariant w.r.t. that
 * config, so flipping `ai_team.*` can never change suggestion behavior.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { load_commands } from '../../../src/scripts/command_suggester/loader';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const TEAM_DIR = path.join(REPO_ROOT, 'src', 'domains', 'meta', 'team');
const SUGGESTER_DIR = path.join(REPO_ROOT, 'src', 'scripts', 'command_suggester');

describe('team-mode suggestion parity (availability posture)', () => {
    const specs = load_commands(TEAM_DIR);

    it('loads the full /team family from source', () => {
        expect(specs.map((s) => s.name).sort()).toEqual([
            'team',
            'team-adversarial',
            'team-delegate',
            'team-review',
            'team-status',
        ]);
    });

    it('exactly one team-family command is suggestion-eligible: the /team master', () => {
        const eligible = specs.filter((s) => s.eligible).map((s) => s.name);
        expect(eligible).toEqual(['team']);
    });

    it('the /team trigger_context carries the availability precondition (agent-side gate)', () => {
        const master = specs.find((s) => s.name === 'team');
        expect(master?.trigger_context).toContain('/team is available');
    });

    it('the deterministic suggester has zero ai_team awareness — output invariant w.r.t. that config', () => {
        const offenders: string[] = [];
        for (const entry of fs.readdirSync(SUGGESTER_DIR)) {
            if (!entry.endsWith('.ts')) {
                continue;
            }
            const body = fs.readFileSync(path.join(SUGGESTER_DIR, entry), 'utf-8');
            if (body.includes('ai_team')) {
                offenders.push(entry);
            }
        }
        expect(offenders).toEqual([]);
    });
});
