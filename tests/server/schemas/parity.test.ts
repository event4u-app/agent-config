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
