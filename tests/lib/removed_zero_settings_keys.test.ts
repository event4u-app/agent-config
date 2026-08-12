/**
 * The inverted invariants for the five keys deleted in `road-to-zero-settings`
 * Phase 2.1.
 *
 * Every entry above these in `REMOVED_KEYS` gated a real mechanism, so its
 * inverted invariant reads "absent ⇒ armed": the deletion changed a default and
 * the test pins the new one. These five gated nothing — no code path ever
 * consulted them — so "absent ⇒ armed" has no behaviour to name, and writing a
 * test that pretended otherwise would be the tautology this suite exists to
 * avoid.
 *
 * What IS falsifiable, and what each test below pins:
 *
 *   1. The key cannot come back by the front door — it is gone from the
 *      template AND from the Zod schema, so a fresh install cannot acquire it
 *      and the wizard cannot render it. (The parity gate already forbids one
 *      without the other; this pins the direction.)
 *   2. A leftover value in an older install is *surfaced*, not silently
 *      honoured — one stderr warning naming the key and what decides instead.
 *   3. The claim that made the deletion safe stays checkable: no reader. If
 *      somebody adds one later, that is a new key, and it arrives through the
 *      authoring gate with its own disposition.
 *
 * Without (1) and (2) the only thing that would notice a silent regression to
 * the old surface is a human reading a diff.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';

import * as ags from '../../src/scripts/_lib/agent_settings.js';
import { settingsSchema } from '../../src/server/schemas/settings.js';

/** dotted path → the YAML an older install would still carry, and the reason string. */
const DELETED: ReadonlyArray<{ key: string; leftover: string; reason: string }> = [
    {
        key: 'telegraph.speak_scope',
        leftover: 'telegraph:\n  speak_scope: "aggressive"\n',
        reason: 'the rule body states its own scope; compile_router gates on telegraph.speak alone',
    },
    {
        key: 'chat_history.max_size_kb',
        leftover: 'chat_history:\n  max_size_kb: 128\n',
        reason: 'the rotate command takes --max-kb from argv; session-count pruning bounds the file',
    },
    {
        key: 'chat_history.on_overflow',
        leftover: 'chat_history:\n  on_overflow: condense\n',
        reason: 'the overflow mode comes from the rotate command --mode argv',
    },
    {
        key: 'quality.wait_for_remote_ci',
        leftover: 'quality:\n  wait_for_remote_ci: true\n',
        reason: 'whether to poll follows from the push plus a detectable remote pipeline',
    },
    {
        key: 'legal_review_prep.consented_at',
        leftover: 'legal_review_prep:\n  consented_at: "2026-01-01T00:00:00Z"\n',
        reason: 'the provenance sidecar settings:set writes and consentVerdict reads',
    },
];

const TEMPLATE_PATH = resolve(process.cwd(), 'src/config/agent-settings.template.yml');

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

/** Unwrap the modifiers Zod stacks around an object (default / optional / effects). */
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

/** True when the dotted path resolves to a leaf the schema would accept. */
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

const tmp_dirs: string[] = [];

function make_tmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zero-settings-')));
    tmp_dirs.push(dir);
    return dir;
}

describe('road-to-zero-settings Phase 2.1 — the five unread `derivable` keys', () => {
    const template = parseYaml(readFileSync(TEMPLATE_PATH, 'utf8'));

    it.each(DELETED)('$key is absent from the shipped template', ({ key }) => {
        expect(readDotted(template, key)).toBeUndefined();
    });

    it.each(DELETED)('$key is absent from the Zod schema', ({ key }) => {
        // The schema is what the wizard renders and what a `settings:set`
        // round-trip re-materialises, so a key surviving here would quietly
        // re-enter every install that touched its section.
        expect(schemaHasPath(key)).toBe(false);
    });

    it('the path walker is not vacuously true — a surviving sibling still resolves', () => {
        // Without this, a broken `schemaHasPath` would report every key absent
        // and the five assertions above would pass for the wrong reason.
        expect(schemaHasPath('telegraph.speak')).toBe(true);
        expect(schemaHasPath('chat_history.enabled')).toBe(true);
        expect(schemaHasPath('quality.local_auto_run')).toBe(true);
        expect(schemaHasPath('legal_review_prep.acknowledged')).toBe(true);
    });

    it.each(DELETED)('a leftover $key warns once, naming what decides instead', ({ key, leftover, reason }) => {
        const tmp = make_tmp();
        const project = path.join(tmp, 'project.yml');
        fs.writeFileSync(project, leftover, 'utf-8');

        const spy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        try {
            ags.load_agent_settings({
                project_path: project,
                user_global_path: path.join(tmp, 'missing.yml'),
            });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(String(spy.mock.calls[0]?.[0])).toBe(`${key} was removed (${reason}); ignored.\n`);
        } finally {
            spy.mockRestore();
        }
    });

    it('the surviving sibling keys are untouched — the batch deleted leaves, not sections', () => {
        // `chat_history` and `legal_review_prep` each lost a leaf and kept the
        // rest. A section that vanished with its leaf would be a far larger
        // behaviour change than the one this batch argued for.
        expect(readDotted(template, 'chat_history.enabled')).toBe(true);
        expect(readDotted(template, 'legal_review_prep.acknowledged')).toBe(false);
        expect(readDotted(template, 'legal_review_prep.require_council')).toBe(true);
        expect(readDotted(template, 'telegraph.speak')).toBe(false);
        expect(readDotted(template, 'quality.local_auto_run')).toBe(false);
    });
});
