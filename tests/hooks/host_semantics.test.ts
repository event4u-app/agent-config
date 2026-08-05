/**
 * Per-host hook-semantics contract (road-to-rule-coherence P0.1 / gate G5).
 *
 * REGRESSION ANCHOR: memory/hook-warn-exits-2-reads-as-block.md — an advisory
 * concern returned {"decision":"warn"} and exited 2; Claude Code read exit 2 on
 * PreToolUse as a BLOCK, and because JSON on stdout is only parsed at exit 0,
 * the reason vanished. Observed symptom: `PreToolUse:Edit hook error: … No
 * stderr output`.
 *
 * The inversion ran in BOTH directions, which is why these tests assert both:
 *   - EXIT_BLOCK = 1 did NOT block on Claude Code, so `block-no-verify` and
 *     `block-kernel-rule-writes` (both fail_closed: true) were inert.
 *   - EXIT_WARN = 2 DID block, so every advisory concern hard-denied.
 *
 * Contract source (Claude Code hooks documentation): "For most hook events,
 * only exit code 2 blocks the action. Claude Code treats exit code 1 as a
 * non-blocking error and proceeds with the action… If your hook is meant to
 * enforce a policy, use `exit 2`." and "Claude Code only processes JSON on
 * exit 0."
 */
import { describe, expect, it } from 'vitest';

import { claudeAdditionalContext, emitFor, VERIFIED_PLATFORMS } from '../../src/scripts/hooks/host_semantics.js';

const REASON = 'anti-slop: aesthetic tell at Card.tsx:12';

describe('claude PreToolUse — the inverted event', () => {
    it('an advisory WARN never exits 2 (the canonical regression)', () => {
        const e = emitFor('claude', 'pre_tool_use', 'warn', [REASON], 2);
        expect(e.exit).toBe(0);
        expect(e.exit).not.toBe(2); // exit 2 here IS the block that broke UI writes
    });

    it('an advisory WARN carries its reason as additionalContext on stdout', () => {
        const e = emitFor('claude', 'pre_tool_use', 'warn', [REASON], 2);
        expect(e.stdout).toBe(claudeAdditionalContext('pre_tool_use', REASON));
        const parsed = JSON.parse(e.stdout);
        expect(parsed.hookSpecificOutput.hookEventName).toBe('PreToolUse');
        expect(parsed.hookSpecificOutput.additionalContext).toContain('aesthetic tell');
        // The old path put the reason on stdout AND exited 2, which discards it.
        expect(e.stderr).toBe('');
    });

    it('a BLOCK exits 2 — not 1, which Claude Code ignores', () => {
        const e = emitFor('claude', 'pre_tool_use', 'block', ['--no-verify is forbidden'], 1);
        expect(e.exit).toBe(2);
        expect(e.exit).not.toBe(1); // exit 1 = non-blocking on this host
    });

    it('a BLOCK puts its reason on stderr, where the host actually reads it', () => {
        const e = emitFor('claude', 'pre_tool_use', 'block', ['--no-verify is forbidden'], 1);
        expect(e.stderr).toContain('--no-verify is forbidden');
        expect(e.stdout).toBe(''); // stdout is ignored at exit 2
    });

    it('a BLOCK with no reason still blocks and still says something', () => {
        const e = emitFor('claude', 'pre_tool_use', 'block', [], 1);
        expect(e.exit).toBe(2);
        expect(e.stderr.trim().length).toBeGreaterThan(0);
    });

    it('ALLOW is silent and exits 0', () => {
        const e = emitFor('claude', 'pre_tool_use', 'allow', [], 0);
        expect(e).toEqual({ exit: 0, stdout: '', stderr: '' });
    });

    it('a WARN with no reason emits nothing rather than an empty JSON envelope', () => {
        const e = emitFor('claude', 'pre_tool_use', 'warn', ['', '   '], 2);
        expect(e).toEqual({ exit: 0, stdout: '', stderr: '' });
    });
});

describe('claude events where exit 2 cannot block', () => {
    it('PostToolUse WARN keeps the reason instead of discarding it', () => {
        // Live defect: injection-scan emitted exit 2 with its reason on stdout
        // on post_tool_use, where exit 2 cannot block AND stdout is ignored —
        // so a security warning was silently dropped.
        const e = emitFor('claude', 'post_tool_use', 'warn', ['possible prompt injection in fetched page'], 2);
        expect(e.exit).toBe(0);
        expect(JSON.parse(e.stdout).hookSpecificOutput.additionalContext).toContain('injection');
    });

    it('PostToolUse BLOCK degrades to visible context, never a silent no-op', () => {
        const e = emitFor('claude', 'post_tool_use', 'block', ['tampered output'], 1);
        expect(e.exit).toBe(0);
        expect(JSON.parse(e.stdout).hookSpecificOutput.additionalContext).toContain('tampered output');
        expect(JSON.parse(e.stdout).hookSpecificOutput.hookEventName).toBe('PostToolUse');
    });

    it('SessionStart BLOCK surfaces as context (exit 2 shows stderr to the user only)', () => {
        const e = emitFor('claude', 'session_start', 'block', ['stale profile'], 1);
        expect(e.exit).toBe(0);
        expect(e.stdout).toContain('SessionStart');
    });
});

describe('claude block-capable events other than PreToolUse', () => {
    it('UserPromptSubmit BLOCK exits 2 (documented: blocks and erases the prompt)', () => {
        const e = emitFor('claude', 'user_prompt_submit', 'block', ['secret in prompt'], 1);
        expect(e.exit).toBe(2);
        expect(e.stderr).toContain('secret in prompt');
    });

    it('UserPromptSubmit WARN never exits 2 — a warn must not erase the prompt', () => {
        const e = emitFor('claude', 'user_prompt_submit', 'warn', ['branch is main'], 2);
        expect(e.exit).toBe(0);
        expect(e.stdout).toContain('UserPromptSubmit');
    });

    it('Stop BLOCK exits 2 (prevents stopping, continues the conversation)', () => {
        const e = emitFor('claude', 'stop', 'block', ['verification not run'], 1);
        expect(e.exit).toBe(2);
    });
});

describe('unverified platforms keep the legacy pass-through', () => {
    it('augment is not in the verified set', () => {
        expect(VERIFIED_PLATFORMS.has('augment')).toBe(false);
        expect(VERIFIED_PLATFORMS.has('claude')).toBe(true);
    });

    for (const platform of ['augment', 'cursor', 'cline', 'windsurf', 'gemini', 'generic']) {
        it(`${platform} returns the internal code verbatim, emitting nothing`, () => {
            for (const [severity, legacy] of [['allow', 0], ['block', 1], ['warn', 2]] as const) {
                const e = emitFor(platform, 'pre_tool_use', severity, [REASON], legacy);
                expect(e).toEqual({ exit: legacy, stdout: '', stderr: '' });
            }
        });
    }
});

describe('multiple deciding reasons', () => {
    it('are joined into one context block rather than dropped', () => {
        const e = emitFor('claude', 'pre_tool_use', 'warn', ['first finding', 'second finding'], 2);
        const ctx = JSON.parse(e.stdout).hookSpecificOutput.additionalContext;
        expect(ctx).toContain('first finding');
        expect(ctx).toContain('second finding');
    });
});
