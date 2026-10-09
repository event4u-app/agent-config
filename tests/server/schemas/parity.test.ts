/**
 * Schema ↔ template parity gate.
 *
 * `config/agent-settings.template.yml` is the source of truth for every
 * configurable setting. `src/server/schemas/settings.ts` is the
 * machine-readable mirror the GUI relies on. Drift between the two
 * silently breaks the wizard, the diff endpoint, and `agent-config
 * settings`. This test walks both trees and fails CI when:
 *
 *   - a template key has no matching schema path (UI cannot render it),
 *   - a schema key has no matching template path (defaults will not
 *     survive a `task sync-agent-settings` round-trip),
 *   - the template type and the Zod type disagree at a leaf (string vs
 *     number vs boolean vs array).
 *
 * Council 2026-05-18, external pass: this gate is the only enforcement
 * keeping the form generator honest. Loosen it and the GUI silently
 * drifts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';
import { settingsSchema } from '../../../src/server/schemas/settings.js';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const TEMPLATE_PATH = resolve(process.cwd(), 'src/config/agent-settings.template.yml');

function loadTemplate(): Record<string, Json> {
    const raw = readFileSync(TEMPLATE_PATH, 'utf8');
    const parsed = parseYaml(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`template did not parse to an object: ${TEMPLATE_PATH}`);
    }
    return parsed as Record<string, Json>;
}

function isPlainObject(value: unknown): value is Record<string, Json> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function templatePaths(value: Json, prefix = ''): string[] {
    if (!isPlainObject(value)) return [prefix];
    return Object.entries(value).flatMap(([k, v]) => {
        const next = prefix === '' ? k : `${prefix}.${k}`;
        return templatePaths(v, next);
    });
}

/**
 * Walk a Zod object recursively, collecting every leaf path.
 * Leaf = anything that is not a ZodObject.
 */
function schemaPaths(schema: z.ZodTypeAny, prefix = ''): string[] {
    const unwrapped = unwrapOptional(schema);
    if (unwrapped instanceof z.ZodObject) {
        const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
        return Object.entries(shape).flatMap(([k, child]) => {
            const next = prefix === '' ? k : `${prefix}.${k}`;
            return schemaPaths(child, next);
        });
    }
    return [prefix];
}

function unwrapOptional(schema: z.ZodTypeAny): z.ZodTypeAny {
    let current: z.ZodTypeAny = schema;
    // ZodDefault and ZodOptional and ZodNullable all expose `_def.innerType`.
    while (
        current instanceof z.ZodDefault ||
        current instanceof z.ZodOptional ||
        current instanceof z.ZodNullable
    ) {
        current = (current._def as { innerType: z.ZodTypeAny }).innerType;
    }
    return current;
}

/**
 * Installer placeholder: `__FOO_BAR__` — substituted at `npx … init` time
 * by `scripts/install.py` and the wizard's Skip handler. Placeholders are
 * type-erased on the YAML side; the type check defers to the schema.
 */
const PLACEHOLDER_RE = /^__[A-Z][A-Z0-9_]*__$/;

function isPlaceholder(value: Json): boolean {
    return typeof value === 'string' && PLACEHOLDER_RE.test(value);
}

function leafKind(value: Json): 'string' | 'number' | 'boolean' | 'array' | 'null' | 'placeholder' {
    if (value === null) return 'null';
    if (isPlaceholder(value)) return 'placeholder';
    if (Array.isArray(value)) return 'array';
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') return t;
    throw new Error(`unsupported template leaf type: ${t}`);
}

function schemaKind(schema: z.ZodTypeAny): 'string' | 'number' | 'boolean' | 'array' | 'unknown' {
    const unwrapped = unwrapOptional(schema);
    if (unwrapped instanceof z.ZodString || unwrapped instanceof z.ZodEnum) return 'string';
    if (unwrapped instanceof z.ZodNumber) return 'number';
    if (unwrapped instanceof z.ZodBoolean) return 'boolean';
    if (unwrapped instanceof z.ZodArray) return 'array';
    return 'unknown';
}

function getSchemaAt(schema: z.ZodTypeAny, path: string): z.ZodTypeAny | null {
    const parts = path.split('.');
    let current: z.ZodTypeAny = schema;
    for (const part of parts) {
        const unwrapped = unwrapOptional(current);
        if (!(unwrapped instanceof z.ZodObject)) return null;
        const shape = unwrapped.shape as Record<string, z.ZodTypeAny>;
        if (!(part in shape)) return null;
        current = shape[part];
    }
    return current;
}

function getTemplateAt(root: Json, path: string): Json | undefined {
    const parts = path.split('.');
    let current: Json | undefined = root;
    for (const part of parts) {
        if (!isPlainObject(current)) return undefined;
        current = current[part];
    }
    return current;
}

describe('settings schema ↔ template parity', () => {
    const template = loadTemplate();
    const templateLeaves = templatePaths(template);
    const schemaLeaves = schemaPaths(settingsSchema);

    it('every template key has a matching schema path', () => {
        const missing = templateLeaves.filter((p) => getSchemaAt(settingsSchema, p) === null);
        expect(missing, `template keys missing from schema:\n  ${missing.join('\n  ')}`).toEqual([]);
    });

    it('every schema leaf has a matching template key', () => {
        const missing = schemaLeaves.filter((p) => getTemplateAt(template, p) === undefined);
        expect(missing, `schema leaves missing from template:\n  ${missing.join('\n  ')}`).toEqual([]);
    });

    it('leaf types agree between template and schema', () => {
        const mismatches: string[] = [];
        for (const path of templateLeaves) {
            const tplValue = getTemplateAt(template, path);
            if (tplValue === undefined) continue;
            const tplKind = leafKind(tplValue);
            if (tplKind === 'null' || tplKind === 'placeholder') continue; // type-erased on the YAML side
            const node = getSchemaAt(settingsSchema, path);
            if (node === null) continue;
            const schKind = schemaKind(node);
            if (schKind === 'unknown') continue;
            if (tplKind !== schKind) {
                mismatches.push(`${path}: template=${tplKind}, schema=${schKind}`);
            }
        }
        expect(mismatches, `type mismatches:\n  ${mismatches.join('\n  ')}`).toEqual([]);
    });
});

/**
 * The five keys deleted on 2026-08-12 because no code path read any of them.
 *
 * Absence is asserted in `tests/lib/removed_zero_settings_keys.test.ts` — on both
 * the template and the schema side, with a not-vacuously-true probe — so it is
 * deliberately not repeated here. What that file does not cover, and what a
 * silent regression would look like, is the value coming *back*: a settings file
 * left over from before the deletion still carries these keys, and the danger is
 * a future edit that re-adds a leaf and starts honouring one. So the pin here is
 * the one assertion the sibling file lacks — the leftover value does not survive
 * a parse and cannot become a live setting again.
 */
const DELETED_2026_08_12: readonly (readonly [string, string, Json])[] = [
    ['telegraph', 'speak_scope', 'aggressive'],
    ['chat_history', 'max_size_kb', 64],
    ['chat_history', 'on_overflow', 'condense'],
    ['quality', 'wait_for_remote_ci', true],
    ['legal_review_prep', 'consented_at', '2026-01-01T00:00:00Z'],
    // `screenshots.data_bearing_gate` was the sixth unread key found in the same
    // pass and is deliberately NOT here: it was held open rather than deleted,
    // pending the decision on whether to build its missing reader or delete a
    // promise a Hard Floor can never honour. Adding it would assert a deletion
    // that has not happened.
] as const;

/**
 * The `derivable` keys retired on 2026-10-09
 * (road-to-settings-classes-derivable-surface-stagnation Phase 2): each one's
 * shipped default became the only behaviour. `section` is the dotted parent, so
 * a nested leaf (`commands.suggestion.enabled`) is stripped from the object that
 * actually owns it. The hostile value is the non-default one an opted-in install
 * would carry.
 */
const RETIRED_2026_10_09: readonly (readonly [string, string, Json])[] = [
    ['personal', 'minimal_output', false],
    ['personal', 'play_by_play', true],
    ['personal', 'pr_comment_bot_icon', true],
    ['verbosity', 'intent_announcements', true],
    ['verbosity', 'preview_artifacts', true],
    ['verbosity', 'routine_confirmations', true],
    ['verbosity', 'post_action_reports', 'full'],
    ['telegraph', 'speak', true],
    ['tokens', 'rich_skills', 'off'],
    ['reasoning', 'auto_gate', false],
    ['reasoning.components', 'orchestrator', false],
    ['reasoning.components', 'notes_first', false],
    ['reasoning.components', 'grounding', false],
    ['reasoning.components', 'intent', false],
    ['reasoning.components', 'complexity_first', false],
    ['reasoning.components', 'verifier_default', false],
    ['reasoning.components', 'prediction_tracking', false],
    ['reasoning.components', 'decision_ledger', false],
    ['reasoning.components', 'uncertainty_budget', false],
    ['roadmap', 'skip_pre_run_gate', false],
    ['roadmap', 'dashboard_regen_cadence', 'per_step'],
    ['commands', 'auto_detect', 'disabled'],
    ['commands.suggestion', 'enabled', false],
    ['commands.suggestion', 'confidence_floor', 0.8],
    ['commands.suggestion', 'cooldown_seconds', 30],
    ['commands.suggestion', 'max_options', 2],
    ['commands.create_pr', 'api_examples', false],
    ['commands.create_pr', 'ui_paths', ['resources/views/**']],
    ['commands.create_pr', 'api_paths', ['app/Http/Controllers/Api/**']],
    ['memory', 'cadence', 'never'],
    ['memory', 'review_threshold', 0],
    ['knowledge.global_sharing', 'redaction', { enabled: false, halt_on_trigger: false }],
    ['knowledge.global_sharing', 'auto_promote_threshold', 5],
    ['knowledge.global_sharing', 'freshness', { hypothesis_after_days: 7, stale_after_days: 14 }],
] as const;

describe('deleted settings keys cannot be honoured again', () => {
    for (const [section, leaf, hostileValue] of [...DELETED_2026_08_12, ...RETIRED_2026_10_09]) {
        const dotted = `${section}.${leaf}`;

        it(`${dotted} is stripped rather than honoured when a stale file still carries it`, () => {
            // The hostile value is the one a pre-deletion file would plausibly
            // hold AND the one whose survival would change behaviour — `off` for
            // a gate, `true` for a poll, a non-default enum for a scope.
            //
            // The section is parsed on its own, made partial first: the top-level
            // schema has sibling sections with no default, and the template's
            // installer placeholders are type-erased strings, so neither the whole
            // tree nor a one-key fragment of it parses. `.partial()` isolates the
            // property under test — zod's unknown-key stripping — from every
            // unrelated required leaf.
            const owner = getSchemaAt(settingsSchema, section);
            if (owner === null) {
                // The whole section left with its last leaf (`telegraph`,
                // `tokens`): zod strips the unknown top-level key, so the value
                // cannot survive a parse. Asserted on the parent's shape, because
                // the parent is the object that would have to re-admit it.
                const parentPath = section.split('.').slice(0, -1).join('.');
                const parent = parentPath === '' ? settingsSchema : getSchemaAt(settingsSchema, parentPath);
                expect(parent, `${parentPath || '<root>'} still exists`).not.toBeNull();
                const parentShape = (unwrapOptional(parent as z.ZodTypeAny) as z.ZodObject<z.ZodRawShape>).shape;
                expect(Object.keys(parentShape)).not.toContain(section.split('.').pop());
                return;
            }
            const sectionSchema = unwrapOptional(owner);
            expect(sectionSchema).toBeInstanceOf(z.ZodObject);
            const parsed = (sectionSchema as z.ZodObject<z.ZodRawShape>)
                .partial()
                .parse({ [leaf]: hostileValue });
            expect(Object.hasOwn(parsed as object, leaf)).toBe(false);
        });
    }
});
