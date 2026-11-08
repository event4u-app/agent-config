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
        ['git -C "my repo" commit -m x', 'git commit'],
        ["git -C 'my repo' push", 'git push'],
        ['git commit -m x # done', 'git commit'],
        ["echo '<<EOF'; git commit -m x", 'git commit'],
        ['make && \\\n  git push', 'git push'],
        ["cat > f <<EOF-1\nprose\nEOF-1\ngit commit -m x", 'git commit'],
        ["cat > a <<A > b <<B\none\nA\ntwo\nB\ngit push", 'git push'],
        ["cat > f <<-EOF\n\tbody\n\tEOF\ngit commit -m x", 'git commit'],
        ['sleep 1 & git push', 'git push'],
        ['git com\\mit -m x', 'git commit'],
        ['git "commit" -m x', 'git commit'],
        ['git push 2>&1 | tail -3', 'git push'],
        ['git push &>/dev/null', 'git push'],
        ['git com\\\nmit -m x', 'git commit'],
        ['cat <<E"OF"\nbody\nEOF\ngit push', 'git push'],
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
        ['echo hello\\; git push', 'git push'],
        ['echo x # ; git push', 'git push'],
        ['echo "a; git push"', 'git push'],
        ["echo 'git commit -m x'", 'git commit'],
        ['git -C "dir; git push" status', 'git push'],
        ["cat > f <<EOF\n  EOF\ngit push\nEOF", 'git push'],
        ['git "com\\mit" -m x', 'git commit'],
        ['cat <<E"OF"\ngit push\nEOF', 'git push'],
    ])('does not take %j for %s', (cmd, act) => {
        expect(commandRunsAct(cmd, act)).toBe(false);
    });
});

describe('candidates are syntactic, judged per simple command', () => {
    // Bash never runs the commit (exec replaces the shell); the recogniser names it,
    // because it does not evaluate control flow. Pinned here rather than in the bash
    // oracle, which compares against what bash runs.
    it('names an act after exec, which ends the shell', () => {
        expect(commandRunsAct('exec git push; git commit -m x', 'git commit')).toBe(true);
        expect(commandRunsAct('exec git push; git commit -m x', 'git push')).toBe(true);
    });
    it('names an act on a branch that never runs', () => {
        expect(commandRunsAct('false && git push', 'git push')).toBe(true);
    });
});

describe('the bundle pre-check never rejects a command the lexer would match', () => {
    it.each([
        'git com\\mit -m x',
        'git "commit" -m x',
        "git 'push'",
        'g\\h pr create',
        'git com\\\nmit -m x',
    ])('%j passes ACT_WORDS', async (cmd) => {
        const { actWordsMayMatch } = await import('../../src/scripts/hooks/reference_duty_loader.js');
        expect(actWordsMayMatch(cmd)).toBe(true);
    });
});

describe('the pre-check is narrow enough not to load the chunk for printf', () => {
    it('rejects commands that hold no bound act word', async () => {
        const { actWordsMayMatch } = await import('../../src/scripts/hooks/reference_duty_loader.js');
        expect(actWordsMayMatch('printf "%s" x')).toBe(false);
        expect(actWordsMayMatch('npm run build')).toBe(false);
    });
});
