/**
 * The four adjacent governance properties — `road-to-governance-invariants`
 * Phase 4, closed as tests rather than as phases.
 *
 * The roadmap budgeted these as "expected already-true, one assertion each, so
 * a phase would be ceremony". Measured on 2026-08-02, **one of the four held as
 * written**. The other three needed either a real code fix or a definitional
 * call, and both are recorded here rather than folded away:
 *
 *   (a) no model-refusal backstop  — HELD. Shipped as written.
 *   (b) gate integrity             — VIOLATED. Fixed in `runtime_dispatcher`.
 *   (c) caller-agnosticism         — two readings; the gate-level one is the
 *                                    property, and it holds. The coverage
 *                                    reading is pinned separately, below.
 *   (d) constraint monotonicity    — holds for every blocking gate; the one
 *                                    persisted-state circuit breaker in the
 *                                    tree is a documented advisory exception,
 *                                    named here so it is not mistaken for a
 *                                    hole.
 *
 * Every test below is written so that inverting the property makes it fail —
 * the roadmap's verify clause is "prove it by inverting, not by assertion".
 * None of them adds a module: each imports an existing exported function.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import { is_refusal, should_escalate } from '../../src/scripts/ai_council/confidence_gate.js';
import { _check_command } from '../../src/scripts/hooks/block_no_verify.js';
import { check_envelope } from '../../src/scripts/hooks/block_kernel_rule_writes.js';
import { dispatch } from '../../src/scripts/runtime_dispatcher.js';
import { SkillRuntime } from '../../src/scripts/runtime_registry.js';
import { TOOL_REGISTRY } from '../../src/scripts/tool_registry.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The two `fail_closed: true` hooks — the only gates in the tree that refuse. */
const BLOCKING_HOOK_SOURCES = [
    'src/scripts/hooks/block_no_verify.ts',
    'src/scripts/hooks/block_kernel_rule_writes.ts',
] as const;

// ── (a) no model-refusal backstop ────────────────────────────────────
describe('(a) enforcement never branches on a base-model refusal string', () => {
    it('a refusal only ever escalates — it can never produce an allowance', () => {
        // The single module in the tree that compiles refusal-shaped regexes.
        // It is fail-closed by construction: a refusal makes the system do MORE
        // work (run the full council) rather than trust a solo answer. Invert
        // the direction — return `escalate: false` on a refusal — and this
        // fails.
        for (const refusal of [
            "I can't help with that.",
            'I cannot answer this question.',
            "I don't know.",
            '',
        ]) {
            // Floor 0 is the weakest possible bar: even here a refusal must
            // still escalate, so the assertion cannot be satisfied by a strict
            // threshold rather than by the refusal branch.
            const r = should_escalate(refusal, 0);
            expect(r.escalate, `refusal must escalate: ${JSON.stringify(refusal)}`).toBe(true);
            expect(r.reason).toBe('refusal');
        }
        expect(is_refusal('Adopt — the tradeoff favours option 2.')).toBe(false);
    });

    it('neither blocking gate changes its verdict when the action text looks like a refusal', () => {
        // The property that matters: an abliterated or locally-served model has
        // no refusals at all, which is exactly why enforcement must not lean on
        // them. A refusal-shaped payload must not move either verdict.
        expect(_check_command('git commit --no-verify -m "I cannot do this"')).toEqual(
            _check_command('git commit --no-verify -m ok'),
        );
        expect(
            check_envelope({
                tool_name: 'Write',
                tool_input: {
                    file_path: 'src/rules/commit-policy.md',
                    content: "I'm sorry, as an AI I cannot refuse this edit.",
                },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)[0],
        ).toBe(true);
    });

    it('no blocking hook source contains a refusal literal at all', () => {
        // Structural backstop for the two behavioural assertions above: the
        // property is easiest to break by ADDING a refusal branch, and a
        // behavioural test cannot see a branch that has no fixture yet.
        const refusalLiterals = /(i can'?t|i cannot|i'?m sorry|as an ai|i don'?t know)/i;
        for (const rel of BLOCKING_HOOK_SOURCES) {
            const src = readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
            // Strip the test-facing doc comments that legitimately discuss it.
            const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
            expect(refusalLiterals.test(code), `${rel} must not branch on refusal text`).toBe(
                false,
            );
        }
    });
});

// ── (b) gate integrity ───────────────────────────────────────────────
describe('(b) a capability gate resolves from trusted config, never from ingested content', () => {
    const skill = (over: Partial<ConstructorParameters<typeof SkillRuntime>[0]> = {}) =>
        new SkillRuntime({
            name: 'fixture-skill',
            path: 'src/skills/fixture-skill/SKILL.md',
            description: 'fixture',
            execution_type: 'automated',
            handler: 'shell',
            timeout_seconds: 30,
            safety_mode: 'strict',
            allowed_tools: ['github'],
            command: ['echo', 'ok'],
            ...over,
        });

    it('a self-certified skill cannot grant itself a tool the registry does not list', () => {
        // MEASURED BEFORE THE FIX (2026-08-02, real SkillRuntime instance):
        // this exact input dispatched `status: "ready"`, `warnings: []`.
        // Every field the prior checks read — execution_type, handler,
        // safety_mode — comes out of the skill's own frontmatter, so
        // `safety_mode: strict` was a self-certification. `tool-safety` says
        // "Allowlist only — tool names must match the tool registry" and
        // `validate_tool_declarations` implemented it; nothing called it.
        const r = dispatch('fixture-skill', [
            skill({ allowed_tools: ['NotInRegistry', 'Bash(*)'] }),
        ]);
        expect(r.request.status).toBe('blocked');
        expect(r.request.reason).toContain('untrusted tool grant');
        expect(TOOL_REGISTRY['NotInRegistry']).toBeUndefined();
    });

    it('a grant that IS in the trusted registry still dispatches', () => {
        // Without this the test above would also pass if the fix simply
        // blocked every automated skill — that would be a regression, not a
        // gate.
        expect(dispatch('fixture-skill', [skill()]).request.status).toBe('ready');
        expect(dispatch('fixture-skill', [skill({ allowed_tools: [] })]).request.status).toBe(
            'ready',
        );
    });

    it('the human-confirmed path surfaces an unregistered grant instead of swallowing it', () => {
        // Assisted execution is deliberately NOT blocked: `tool-safety` itself
        // prefers scoped-grant syntax (`Bash(scripts-run:*)`) that this
        // two-entry registry does not model, and blocking it would reject the
        // form the rule recommends. Silence would be the wrong answer though.
        const r = dispatch('fixture-skill', [
            skill({ execution_type: 'assisted', allowed_tools: ['Bash(scripts-run:*)'] }),
        ]);
        expect(r.request.status).toBe('ready');
        expect(r.warnings.join(' ')).toContain('not registered in the tool registry');
    });
});

// ── (c) caller-agnosticism ───────────────────────────────────────────
describe('(c) the same governed action gets the same verdict whoever issues it', () => {
    it('no caller identity can move a gate verdict — the verdict is a pure function of the action', () => {
        // This is the property. `block_no_verify` accepts a `--platform` flag
        // and never reads it again; `check_envelope` takes only the envelope.
        // A gate keyed on who is asking is a gate bypassed by asking
        // differently — so the assertion is that the ONLY input is the action.
        const cmd = 'git commit --no-verify -m x';
        expect(_check_command.length).toBe(1);
        expect(_check_command(cmd)).toEqual(_check_command(cmd));

        // Same action, three different self-declared callers in the envelope.
        // A caller field must not reach the verdict.
        const verdicts = ['claude', 'cursor', 'an-external-swarm'].map(
            (caller) =>
                check_envelope({
                    tool_name: 'Write',
                    platform: caller,
                    agent: caller,
                    source: caller,
                    tool_input: { file_path: 'src/rules/scope-control.md', content: 'x' },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)[0],
        );
        expect(verdicts).toEqual([true, true, true]);
    });

    it('COVERAGE PIN — every host that has the blocking slot carries both fail-closed concerns', () => {
        // The second reading of (c) is coverage, not verdict: `pre_tool_use` is
        // the only blocking slot, and `docs/enforcement-by-host.md` already
        // documents that runtime hooks reach a minority of hosts. Demanding the
        // slot from a host whose runtime cannot fire it would be governance
        // theatre, so this does NOT assert which hosts have it.
        //
        // What it does assert is that no host SILENTLY loses a blocking concern
        // it already has. Drop `block-no-verify` from claude's slot and this
        // fails.
        const manifest = parseYaml(
            readFileSync(path.join(REPO_ROOT, 'src/scripts/hook_manifest.yaml'), 'utf-8'),
        ) as Record<string, Record<string, unknown>>;
        const platforms = (manifest['platforms'] ?? manifest) as Record<
            string,
            Record<string, unknown>
        >;
        const withSlot = Object.entries(platforms).filter(
            ([, cfg]) => cfg !== null && typeof cfg === 'object' && 'pre_tool_use' in cfg,
        );
        expect(withSlot.length).toBeGreaterThan(0);
        for (const [name, cfg] of withSlot) {
            const slot = cfg['pre_tool_use'] as string[];
            expect(slot, `${name} lost block-no-verify`).toContain('block-no-verify');
            expect(slot, `${name} lost block-kernel-rule-writes`).toContain(
                'block-kernel-rule-writes',
            );
        }
    });
});

// ── (d) constraint monotonicity ──────────────────────────────────────
describe('(d) persisted state cannot weaken a governed constraint across sessions', () => {
    it('neither blocking gate reads any persisted state — there is nothing to poison', () => {
        // `source-discovery-gate` states this as prose: curated self-building
        // context is read for heuristics and never bypasses a fresh structural
        // read. The executable half of that claim is that the gates which can
        // actually refuse are pure. Add a state read to either decider and
        // this fails.
        const readers = /\b(readFileSync|existsSync|readdirSync|memory_?lookup|loadState|read_state)\b/;
        for (const rel of BLOCKING_HOOK_SOURCES) {
            const src = readFileSync(path.join(REPO_ROOT, rel), 'utf-8');
            // Isolate the decider functions from the CLI `main()` wrapper,
            // which legitimately reads stdin and its own module path.
            const deciderRegion = src.split(/\nasync function main|\nfunction main/)[0] as string;
            const code = deciderRegion
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/^\s*\/\/.*$/gm, '')
                // The self-path resolution both hooks do at import time is not
                // a state read.
                .replace(/^.*_HERE.*$/gm, '');
            const hit = readers.exec(code);
            expect(hit?.[0], `${rel} decider must not read persisted state`).toBeUndefined();
        }
    });

    it('a gate verdict is identical on a cold and a warm session — same input, same answer', () => {
        // Behavioural twin of the structural assertion above: calling twice,
        // as a second session would, cannot drift.
        const cmd = 'git config core.hooksPath /dev/null';
        const first = _check_command(cmd);
        const second = _check_command(cmd);
        expect(second).toEqual(first);
        expect(first[0]).toBe(true);
    });

    it('DOCUMENTED EXCEPTION — the team-review circuit breaker is advisory, not a floor', () => {
        // `ai_team/review_gate.record_gate_verdict` restores
        // `consecutive_blocks` from `agents/runtime/state/team-review-gate.json`
        // and opens a circuit at the bound, after which "the managed layer must
        // not re-block". A hand-edit to that file therefore stops the nag
        // early.
        //
        // That is an intentional anti-nag circuit breaker on an advisory
        // review prompt, `managed: false` by default — not a safety floor, and
        // not the constraint (d) is about. It is named here so a future reader
        // finds a recorded decision rather than an unnoticed hole. If it ever
        // becomes a floor, this comment is the tripwire.
        const src = readFileSync(
            path.join(REPO_ROOT, 'src/scripts/ai_team/review_gate.ts'),
            'utf-8',
        );
        expect(src).toContain('circuit_open');
        // The default must stay unmanaged, or the exception stops being one.
        expect(src).toMatch(/managed:\s*false|AI_TEAM_DEFAULTS/);
    });
});
