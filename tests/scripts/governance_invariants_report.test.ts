/**
 * Pinned-report drift gate for `road-to-governance-invariants`.
 *
 * Phase 4's publication step requires that numbers render from a pinned report
 * rather than being hand-typed into a claim surface. `docs/benchmark.md` is
 * deliberately outside `check_claims`'s witness sweep (it matches the ratio
 * pattern on dozens of lines, and sweeping it would produce the flood that
 * teaches a maintainer to bypass the gate), so a prose number there is caught
 * by nothing.
 *
 * This file is the mechanism that closes that hole for THIS artefact: every
 * number published in `internal/bench/reports/governance-invariants.json` is
 * re-derived here from the same shipped source the spikes exercise. Edit the
 * report without the code agreeing, or change the code without the report
 * following, and CI fails.
 *
 * The report holds raw measurements. Interpretation — what counts as a finding
 * — lives in the roadmap and in each spike's pre-registered verdict block, not
 * here.
 */
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
    CONSENSUS_FRACTION,
    tally_stances,
} from '../../src/scripts/ai_council/stance_tally.js';
import { condense_text } from '../../src/scripts/condense_memory.js';
import { _check_command } from '../../src/scripts/hooks/block_no_verify.js';
import { check_envelope } from '../../src/scripts/hooks/block_kernel_rule_writes.js';
import { dispatch } from '../../src/scripts/runtime_dispatcher.js';
import { SkillRuntime } from '../../src/scripts/runtime_registry.js';
import { TOOL_REGISTRY } from '../../src/scripts/tool_registry.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPORT_PATH = path.join(REPO_ROOT, 'internal/bench/reports/governance-invariants.json');

interface Report {
    spikes: {
        s0_1_aggregation_steerability: { measurements: Record<string, number | boolean> };
        s0_2_decomposition_laundering: { measurements: Record<string, number> };
        s0_3_marker_survival: { measurements: Record<string, number | boolean> };
    };
    adjacent_properties: {
        examined: number;
        detail: Record<string, Record<string, number | boolean | string>>;
    };
}

const report = JSON.parse(readFileSync(REPORT_PATH, 'utf-8')) as Report;

describe('pinned report — S0.1 numbers are re-derived, not transcribed', () => {
    const m = report.spikes.s0_1_aggregation_steerability.measurements;

    it('the post-fix steering margin really is zero', () => {
        const stance = (l: string, c: string) => `STANCE: ${l} | CONFIDENCE: ${c} | DEALBREAKER: no`;
        const backers = [
            { member: 'anthropic:a', text: stance('Adopt', 'high') },
            { member: 'openai:b', text: stance('Adopt', 'med') },
        ];
        const margin = (ms: { member: string; text: string }[]): number => {
            const r = tally_stances(ms);
            return (r.options[0]?.weight ?? 0) - r.threshold;
        };
        const abstained = [...backers, { member: 'x:c', text: stance('abstain', 'high') }];
        const unparseable = [...backers, { member: 'x:c', text: 'I will not answer this.' }];
        expect(margin(unparseable) - margin(abstained)).toBe(m['steering_margin_post_fix']);
    });

    it('the pre-fix margins reconstruct from the old denominator', () => {
        const stance = (l: string, c: string) => `STANCE: ${l} | CONFIDENCE: ${c} | DEALBREAKER: no`;
        const withRefuser = [
            { member: 'anthropic:a', text: stance('Adopt', 'high') },
            { member: 'openai:b', text: stance('Adopt', 'med') },
            { member: 'x:c', text: stance('abstain', 'high') },
        ];
        const top = tally_stances(withRefuser).options[0]?.weight ?? 0;
        const pre = m['quorum_denominator_pre_fix'] as number;
        const post = m['quorum_denominator_post_fix'] as number;
        expect(top - CONSENSUS_FRACTION * post).toBeCloseTo(
            m['margin_refusal_parsed_pre_fix'] as number,
            8,
        );
        expect(top - CONSENSUS_FRACTION * pre).toBeCloseTo(
            m['margin_refusal_unparsed_pre_fix'] as number,
            8,
        );
        expect(
            (m['margin_refusal_unparsed_pre_fix'] as number) -
                (m['margin_refusal_parsed_pre_fix'] as number),
        ).toBeCloseTo(m['steering_margin_pre_fix'] as number, 8);
    });

    it('the quorum denominator the report claims is the one the code uses', () => {
        const r = tally_stances([
            { member: 'a', text: 'STANCE: Adopt | CONFIDENCE: high | DEALBREAKER: no' },
            { member: 'b', text: 'STANCE: Adopt | CONFIDENCE: med | DEALBREAKER: no' },
            { member: 'c', text: 'prose refusal, no stance line' },
        ]);
        expect(r.w_total).toBe(m['quorum_denominator_post_fix']);
    });
});

describe('pinned report — S0.2 numbers are re-derived', () => {
    const m = report.spikes.s0_2_decomposition_laundering.measurements;
    const g1 = (c: string): boolean => _check_command(c)[0];
    const g2 = (t: string, i: Record<string, string>): boolean =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        check_envelope({ tool_name: t, tool_input: i } as any)[0];

    it('every single-step control the report counts really is blocked', () => {
        const controls = [
            g1('git commit --no-verify -m x'),
            g1('git -c core.hooksPath=/dev/null commit -m x'),
            g2('Write', { file_path: 'src/rules/commit-policy.md', content: 'x' }),
            g2('Write', { file_path: '.claude/rules/commit-policy.md', content: 'x' }),
        ];
        expect(controls).toHaveLength(m['single_step_controls_total'] as number);
        expect(controls.filter(Boolean)).toHaveLength(m['single_step_controls_blocked'] as number);
    });

    it('the count of sequences Phase 1 closed matches the gates', () => {
        const closed = [
            g1('git config core.hooksPath /dev/null'),
            g2('Bash', { command: "sed -i '' 's/NEVER/ALWAYS/' src/rules/commit-policy.md" }),
        ];
        expect(closed.filter(Boolean)).toHaveLength(m['sequences_closed_by_phase_1'] as number);
    });

    it('the count of published-open sequences matches the gates', () => {
        const stillOpen = [
            g1('mv .git/hooks/pre-commit /tmp/x'),
            g1('chmod -x .git/hooks/pre-commit'),
        ];
        expect(stillOpen.filter((blocked) => !blocked)).toHaveLength(
            m['sequences_left_open_and_published'] as number,
        );
    });
});

describe('pinned report — S0.3 numbers are re-derived', () => {
    const m = report.spikes.s0_3_marker_survival.measurements;

    it('the marker-loss count really is what the report publishes', () => {
        const cases: [string, string[]][] = [
            ['The endpoint shape is unverified.', ['unverified']],
            ['This value is assumed, not measured.', ['assumed']],
            ['Confidence: low on the second column.', ['Confidence', 'low']],
            ['I think this holds, but it is untested.', ['untested']],
            ['Per council 2026-08-02, recorded.', ['council', '2026-08-02']],
        ];
        const lost = cases.filter(([line, carriers]) => {
            const out = condense_text(line);
            return carriers.some((c) => !out.includes(c));
        });
        expect(lost).toHaveLength(m['marker_loss_count'] as number);
    });

    it('the condenser is actually exercised — the null is not measuring a no-op', () => {
        expect(condense_text('the result is a value that was checked')).not.toBe(
            'the result is a value that was checked',
        );
    });
});

describe('pinned report — adjacent-property counts are re-derived', () => {
    const d = report.adjacent_properties.detail;

    it('the trusted-registry entry count matches the registry', () => {
        expect(Object.keys(TOOL_REGISTRY)).toHaveLength(
            d['b_gate_integrity']?.['trusted_registry_entries'] as number,
        );
    });

    it('the validator really has a production caller now', () => {
        const skill = new SkillRuntime({
            name: 's',
            path: 'p',
            description: 'd',
            execution_type: 'automated',
            handler: 'shell',
            timeout_seconds: 30,
            safety_mode: 'strict',
            allowed_tools: ['NotInRegistry'],
            command: ['echo', 'ok'],
        });
        expect(dispatch('s', [skill]).request.status).toBe('blocked');
        expect(d['b_gate_integrity']?.['validator_production_callers_post_fix']).toBe(1);
    });

    it('the pinned platform-coverage counts match the manifest', () => {
        const manifest = parseYaml(
            readFileSync(path.join(REPO_ROOT, 'src/scripts/hook_manifest.yaml'), 'utf-8'),
        ) as Record<string, Record<string, unknown>>;
        const platforms = (manifest['platforms'] ?? manifest) as Record<
            string,
            Record<string, unknown>
        >;
        const withSlot = Object.values(platforms).filter(
            (cfg) => cfg !== null && typeof cfg === 'object' && 'pre_tool_use' in cfg,
        );
        expect(withSlot).toHaveLength(
            d['c_caller_agnosticism']?.['platforms_with_the_blocking_slot'] as number,
        );
    });

    it('the report examines exactly the four properties the roadmap names', () => {
        expect(report.adjacent_properties.examined).toBe(4);
        expect(Object.keys(d)).toHaveLength(4);
    });
});
