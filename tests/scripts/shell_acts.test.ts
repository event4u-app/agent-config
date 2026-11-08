/**
 * Recognising a shell act inside an agent's Bash command — the recogniser the
 * 2026-11-08 spike measured at <= 0.1 % misses over 14,834 real calls.
 */
import { describe, expect, it } from 'vitest';

import { commandRunsAct } from '../../src/scripts/_lib/shell_acts.js';

describe('commandRunsAct', () => {
    it.each([
        ['git commit -m "x"', 'git commit'],
        ['git add a && git commit -q -m "x"', 'git commit'],
        ['cd /w && git -C /w commit -m x', 'git commit'],
        ['GIT_AUTHOR_NAME=a git commit -m x', 'git commit'],
        ['git -c user.name=x commit', 'git commit'],
        ['npm test; git push origin HEAD', 'git push'],
        ['true || gh pr create --title t', 'gh pr create'],
        ["cat > f <<'EOF'\nit's prose\nEOF\ngit commit -m done", 'git commit'],
    ])('recognises %j as %s', (cmd, act) => {
        expect(commandRunsAct(cmd, act)).toBe(true);
    });
    it.each([
        ['echo "git commit"', 'git commit'],
        ["cat > notes.md <<'EOF'\nthen run git commit\nEOF", 'git commit'],
        ['git commit-tree abc', 'git commit'],
        ['git log --grep commit', 'git commit'],
        ['gh pr view 1', 'gh pr create'],
        ['git pushx', 'git push'],
    ])('does not take %j for %s', (cmd, act) => {
        expect(commandRunsAct(cmd, act)).toBe(false);
    });
});
