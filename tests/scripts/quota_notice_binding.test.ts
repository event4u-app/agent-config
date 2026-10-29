// `quota-notice` only reaches the user while it is bound to claude's
// `user_prompt_submit` with `effect: notification`. Dropping either half
// silences every quota and context line without failing anything else, so the
// binding is pinned here — and the pin is shown to fail on a manifest copy
// that lost it.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

const MANIFEST = path.join(import.meta.dirname, '..', '..', 'src', 'scripts', 'hook_manifest.yaml');

type Manifest = {
    concerns?: Record<string, { effect?: string; script?: string }>;
    platforms?: Record<string, Record<string, unknown>>;
};

function bindingProblems(m: Manifest): string[] {
    const problems: string[] = [];
    const concern = m.concerns?.['quota-notice'];
    if (concern === undefined) problems.push('concern quota-notice is not declared');
    else if (concern.effect !== 'notification') problems.push(`quota-notice effect is ${String(concern.effect)}, not notification`);
    const slot = m.platforms?.['claude']?.['user_prompt_submit'];
    if (!Array.isArray(slot) || !slot.includes('quota-notice')) {
        problems.push('quota-notice is not bound to claude user_prompt_submit');
    }
    return problems;
}

const manifest = (): Manifest => parseYaml(fs.readFileSync(MANIFEST, 'utf-8')) as Manifest;

describe('quota-notice binding', () => {
    it('is bound to claude user_prompt_submit with its notification effect', () => {
        expect(bindingProblems(manifest())).toEqual([]);
    });

    it('fails against a manifest copy with the binding removed', () => {
        const copy = manifest();
        const slot = copy.platforms!['claude']!['user_prompt_submit'] as string[];
        copy.platforms!['claude']!['user_prompt_submit'] = slot.filter((c) => c !== 'quota-notice');
        expect(bindingProblems(copy)).toEqual(['quota-notice is not bound to claude user_prompt_submit']);
    });

    it('fails against a manifest copy whose concern lost its notification effect', () => {
        const copy = manifest();
        copy.concerns!['quota-notice'] = { ...copy.concerns!['quota-notice'], effect: 'context' };
        expect(bindingProblems(copy)).toEqual(['quota-notice effect is context, not notification']);
    });
});
