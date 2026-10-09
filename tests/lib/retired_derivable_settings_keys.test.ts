/**
 * The `derivable` keys retired on 2026-10-09
 * (road-to-settings-classes-derivable-surface-stagnation Phase 2).
 *
 * Unlike the 2026-08-12 batch, every key here WAS read — by code or by rule and
 * command prose — and each reader was rewritten so the shipped default is the
 * only behavior left. What stays falsifiable after that, and what each block
 * below pins:
 *
 *   1. The key cannot come back by the front door: it is gone from the shipped
 *      template, the Zod schema the wizard renders, and the wizard / basic-path
 *      lists that would surface it.
 *   2. A leftover value in an older install is surfaced, never silently
 *      honoured — exactly one stderr line naming the key and what decides
 *      instead, with the reason the registry carries.
 *   3. Every reason names a replacement, never just "removed".
 */
import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { z } from 'zod';

import * as ags from '../../src/scripts/_lib/agent_settings.js';
import { REMOVED_KEYS } from '../../src/scripts/_lib/settings_removed_keys.js';
import { settingsSchema } from '../../src/server/schemas/settings.js';
import { BASIC_PATHS } from '../../src/ui/settings/basicPaths.js';
import { WIZARD_STEPS } from '../../src/ui/wizard/steps.js';

/** dotted key → the non-default value an opted-in older install would carry. */
const RETIRED: ReadonlyArray<{ key: string; hostile: unknown }> = [
    // 2.1 — output and tone
    { key: 'personal.minimal_output', hostile: false },
    { key: 'personal.play_by_play', hostile: true },
    { key: 'personal.pr_comment_bot_icon', hostile: true },
    { key: 'verbosity.intent_announcements', hostile: true },
    { key: 'verbosity.preview_artifacts', hostile: true },
    { key: 'verbosity.routine_confirmations', hostile: true },
    { key: 'verbosity.post_action_reports', hostile: 'full' },
    { key: 'telegraph.speak', hostile: true },
    { key: 'tokens.rich_skills', hostile: 'off' },
    // 2.2 — reasoning protocol switches
    { key: 'reasoning.auto_gate', hostile: false },
    { key: 'reasoning.components.orchestrator', hostile: false },
    { key: 'reasoning.components.notes_first', hostile: false },
    { key: 'reasoning.components.grounding', hostile: false },
    { key: 'reasoning.components.intent', hostile: false },
    { key: 'reasoning.components.complexity_first', hostile: false },
    { key: 'reasoning.components.verifier_default', hostile: false },
    { key: 'reasoning.components.prediction_tracking', hostile: false },
    { key: 'reasoning.components.decision_ledger', hostile: false },
    { key: 'reasoning.components.uncertainty_budget', hostile: false },
    // 2.3 — roadmap cadence (`roadmap.quality_cadence` moved back to the queue)
    { key: 'roadmap.skip_pre_run_gate', hostile: false },
    { key: 'roadmap.dashboard_regen_cadence', hostile: 'per_step' },
    // 2.4 — command suggestion and PR creation
    { key: 'commands.auto_detect', hostile: 'disabled' },
    { key: 'commands.suggestion.enabled', hostile: false },
    { key: 'commands.suggestion.confidence_floor', hostile: 0.8 },
    { key: 'commands.suggestion.cooldown_seconds', hostile: 30 },
    { key: 'commands.suggestion.max_options', hostile: 2 },
    { key: 'commands.create_pr.api_examples', hostile: false },
    { key: 'commands.create_pr.ui_paths', hostile: ['resources/views/**'] },
    { key: 'commands.create_pr.api_paths', hostile: ['app/Http/Controllers/Api/**'] },
    // 2.5 — memory and knowledge sharing
    { key: 'memory.cadence', hostile: 'never' },
    { key: 'memory.review_threshold', hostile: 0 },
    { key: 'knowledge.global_sharing.redaction.enabled', hostile: false },
    { key: 'knowledge.global_sharing.redaction.halt_on_trigger', hostile: false },
    { key: 'knowledge.global_sharing.auto_promote_threshold', hostile: 5 },
    { key: 'knowledge.global_sharing.freshness.hypothesis_after_days', hostile: 7 },
    { key: 'knowledge.global_sharing.freshness.stale_after_days', hostile: 14 },
    // 2.6 — hooks and engine
    { key: 'hooks.concern_budget.max_per_event', hostile: 3 },
    { key: 'hooks.concern_budget.hard_fail', hostile: true },
    { key: 'decision_engine.surface_traces', hostile: true },
    { key: 'decision_engine.on_block_fallback', hostile: 'warn' },
    { key: 'explain.enable_last', hostile: false },
    // 2.7 — remaining
    { key: 'project.pr_template', hostile: 'docs/PR_TEMPLATE.md' },
    { key: 'pipelines.skill_improvement', hostile: false },
    { key: 'consistency.cross_source', hostile: 'off' },
    { key: 'subagents.downshift', hostile: false },
    { key: 'ai_team.suppress_setup_hint', hostile: true },
];

const TEMPLATE_PATH = path.resolve(process.cwd(), 'src/config/agent-settings.template.yml');

function readDotted(root: unknown, dotted: string): unknown {
    let node: unknown = root;
    for (const part of dotted.split('.')) {
        if (typeof node !== 'object' || node === null || Array.isArray(node)) {
            return undefined;
        }
        node = (node as Record<string, unknown>)[part];
    }
    return node;
}

function nest(dotted: string, value: unknown): Record<string, unknown> {
    const parts = dotted.split('.');
    let node: unknown = value;
    for (const part of parts.reverse()) {
        node = { [part]: node };
    }
    return node as Record<string, unknown>;
}

function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
    let node = schema;
    for (;;) {
        if (node instanceof z.ZodDefault) {
            node = node._def.innerType as z.ZodTypeAny;
        } else if (node instanceof z.ZodOptional || node instanceof z.ZodNullable) {
            node = node.unwrap() as z.ZodTypeAny;
        } else if (node instanceof z.ZodEffects) {
            node = node.innerType() as z.ZodTypeAny;
        } else {
            return node;
        }
    }
}

function schemaHasPath(dotted: string): boolean {
    let node: z.ZodTypeAny = settingsSchema;
    for (const part of dotted.split('.')) {
        const unwrapped = unwrap(node);
        if (!(unwrapped instanceof z.ZodObject)) {
            return false;
        }
        const next = (unwrapped.shape as Record<string, z.ZodTypeAny | undefined>)[part];
        if (next === undefined) {
            return false;
        }
        node = next;
    }
    return true;
}

describe('the 2026-10-09 derivable retirement', () => {
    const template = parseYaml(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    const wizardPaths = new Set(WIZARD_STEPS.flatMap((s) => s.paths ?? []));

    it.each(RETIRED)('$key is absent from the shipped template', ({ key }) => {
        expect(readDotted(template, key)).toBeUndefined();
    });

    it.each(RETIRED)('$key is absent from the Zod schema', ({ key }) => {
        expect(schemaHasPath(key)).toBe(false);
    });

    it.each(RETIRED)('$key is not surfaced by the wizard or the basic settings view', ({ key }) => {
        expect(BASIC_PATHS.has(key)).toBe(false);
        expect(wizardPaths.has(key)).toBe(false);
    });

    it('the probes are not vacuously true — surviving keys still resolve on every surface', () => {
        expect(schemaHasPath('personal.autonomy')).toBe(true);
        expect(readDotted(template, 'personal.autonomy')).toBe('auto');
        expect(BASIC_PATHS.has('personal.autonomy')).toBe(true);
        expect(wizardPaths.has('personal.autonomy')).toBe(true);
    });

    it.each(RETIRED)('$key carries a reason that names what decides instead', ({ key }) => {
        const reason = REMOVED_KEYS.get(key);
        expect(reason, `${key} is registered`).toBeDefined();
        expect((reason ?? '').trim().length).toBeGreaterThan(20);
        expect(reason).not.toMatch(/^removed\.?$/iu);
    });

    it.each(RETIRED)('a leftover $key warns exactly once and is reported as ignored', ({ key, hostile }) => {
        const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'retired-derivable-')));
        try {
            const project = path.join(tmp, 'project.yml');
            fs.writeFileSync(project, dumpYaml(nest(key, hostile)), 'utf-8');
            const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
            try {
                ags.load_agent_settings({
                    project_path: project,
                    user_global_path: path.join(tmp, 'missing.yml'),
                });
                const lines = spy.mock.calls.map((c) => String(c[0]));
                expect(lines).toEqual([`${key} was removed (${REMOVED_KEYS.get(key) ?? ''}); ignored.\n`]);
            } finally {
                spy.mockRestore();
            }
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true });
        }
    });
});
