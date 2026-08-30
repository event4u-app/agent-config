// The denominator's vocabularies must equal the dispatcher's.
//
// `road-to-supervised-telemetry-collector`, R2 finding 11. `recordOpportunity`
// refuses any event outside `COLLECTOR_EVENTS`, and the dispatcher decides what
// an event IS from its own independent `EVENT_VOCABULARY` literal. The two lists
// agreed when both were written and nothing asserted that they must.
//
// Drift is silent AND directional: an event added to the dispatcher and not here
// is refused by the denominator, so those dispatches never enter the
// denominator, so the capture rate is computed over a smaller opportunity set —
// biased UPWARD, which is the one direction that makes a 90 % target look met.
// A test is the only thing that can catch it, because both sides are literals.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';

import {
    COLLECTOR_EVENTS,
    COLLECTOR_PLATFORMS,
} from '../../src/scripts/_lib/collector_record.js';
import { EVENT_VOCABULARY } from '../../src/scripts/hooks/dispatch_hook.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('collector vocabulary parity', () => {
    it('COLLECTOR_EVENTS equals the dispatcher\'s EVENT_VOCABULARY, exactly', () => {
        const collector = [...COLLECTOR_EVENTS].sort();
        const dispatcher = [...EVENT_VOCABULARY].sort();
        expect(collector).toEqual(dispatcher);
    });

    // removing_this_constraint_reds_it: add an eleventh event to either literal
    // without the other. Nothing else in the tree reds — which is the whole
    // reason this file exists.

    it('COLLECTOR_PLATFORMS equals the hook manifest\'s platform keys, exactly', () => {
        // The SECOND axis, and it has the identical, identically-directional
        // failure (R2 round-2 finding 6). `recordOpportunity` refuses any
        // platform outside `COLLECTOR_PLATFORMS`, and the dispatcher validates
        // no platform at all — `args.platform` is whatever the trampoline
        // passes, and there is no `PLATFORM_VOCABULARY` to compare against. So
        // the authority is the manifest that declares which platforms exist.
        //
        // A platform added there and not here is dropped from the denominator
        // silently, shrinking the opportunity set and biasing the rate UPWARD —
        // the one direction that makes the 90 % target look met.
        const manifest = parseYaml(
            fs.readFileSync(path.join(REPO, 'src', 'scripts', 'hook_manifest.yaml'), 'utf8'),
        ) as { platforms?: Record<string, unknown> };
        const declared = Object.keys(manifest.platforms ?? {}).sort();
        expect(declared.length, 'the manifest declares platforms').toBeGreaterThan(0);
        expect([...COLLECTOR_PLATFORMS].sort()).toEqual(declared);
    });

    // removing_this_constraint_reds_it: add a platform key to
    // `hook_manifest.yaml` without adding it to `COLLECTOR_PLATFORMS` — this
    // reds and nothing else in the tree does, which is the whole reason the
    // file exists.

    it('states the direction of the bias, so a future reader does not have to re-derive it', () => {
        // Not a tautology: it pins WHICH set is the denominator's gate, so a
        // refactor that made the dispatcher filter instead would red here.
        const onlyInDispatcher = [...EVENT_VOCABULARY].filter(
            (e) => !(COLLECTOR_EVENTS as readonly string[]).includes(e),
        );
        // Any member of this set is a dispatch the denominator silently drops.
        expect(onlyInDispatcher).toEqual([]);
    });
});
