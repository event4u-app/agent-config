/**
 * The negative half of `road-to-capability-native-execution` step 0.4.
 *
 * That step's `verify:` clause has two halves: a table naming each existing
 * runtime-routing primitive with an extend-or-not decision (in the roadmap),
 * and a property — *"no new module duplicates `ToolProbeStatus`/`ChannelStatus`
 * or re-implements a priority-ordered resolver"*. At Phase 0 the property is
 * trivially true because no adapter or resolver code exists yet, which is
 * exactly when a promise is cheapest to make and least worth anything.
 *
 * So it is a check instead. These tests fail the moment a second module
 * declares either status vocabulary, which is the failure 0.4 exists to
 * prevent and the one a table alone cannot catch.
 *
 * What this does NOT check, stated because the gap matters: "re-implements a
 * priority-ordered resolver" is not decidable from a file's text. A resolver is
 * recognisable by what it does, not by a token, and a check that guessed at it
 * would either miss the real case or fire on every `find`/`sort`. That half
 * stays model-carried and is carried into Phase 4's exit criteria rather than
 * asserted here.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** The one legal home of each status vocabulary. */
const OWNERS: Readonly<Record<string, string>> = {
    ToolProbeStatus: 'src/scripts/_lib/tool_probe.ts',
    ChannelStatus: 'src/scripts/reach_doctor.ts',
};

/** The member sets, read from their owning file rather than restated here. */
function ownedUnion(name: string): string[] {
    const src = fs.readFileSync(path.join(REPO_ROOT, OWNERS[name]), 'utf8');
    const m = new RegExp(`export type ${name} =([^;]+);`).exec(src);
    expect(m, `${OWNERS[name]} no longer declares ${name}`).not.toBeNull();
    return [...(m as RegExpExecArray)[1].matchAll(/'([a-z][a-z-]*)'/g)].map((x) => x[1]);
}

function tsFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name.endsWith('.ts')) out.push(path.relative(REPO_ROOT, full));
        }
    };
    walk(path.join(REPO_ROOT, root));
    return out;
}

describe('step 0.4 — no second declaration of a status vocabulary', () => {
    it('ToolProbeStatus is declared exactly once, in tool_probe.ts', () => {
        const offenders = tsFiles('src').filter(
            (rel) => rel !== OWNERS.ToolProbeStatus && /export type ToolProbeStatus\s*=/.test(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')),
        );
        expect(offenders).toEqual([]);
    });

    it('ChannelStatus is declared exactly once, in reach_doctor.ts', () => {
        const offenders = tsFiles('src').filter(
            (rel) => rel !== OWNERS.ChannelStatus && /export type ChannelStatus\s*=/.test(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')),
        );
        expect(offenders).toEqual([]);
    });

    it('no module outside the owners re-lists a full status member set', () => {
        const sets = Object.keys(OWNERS).map((n) => [n, ownedUnion(n)] as const);
        const owners = new Set(Object.values(OWNERS));
        const offenders: string[] = [];
        for (const rel of tsFiles('src')) {
            if (owners.has(rel)) continue;
            const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
            for (const [name, values] of sets) {
                if (values.length === 0) continue;
                for (const m of src.matchAll(/(?:type|const)\s+\w+\s*(?::[^=]*)?=\s*([\s\S]{0,300}?);/g)) {
                    if (values.every((v) => m[1].includes(`'${v}'`))) {
                        offenders.push(`${rel} re-lists the ${name} member set`);
                    }
                }
            }
        }
        expect([...new Set(offenders)]).toEqual([]);
    });

    it('ChannelStatus still COMPOSES ToolProbeStatus rather than restating it', () => {
        // The precedent 0.4's table rests on: a third state set is added by
        // composition, never by forking. If this ever becomes a flat union the
        // extend-not-fork argument in the roadmap has silently expired.
        const src = fs.readFileSync(path.join(REPO_ROOT, OWNERS.ChannelStatus), 'utf8');
        expect(src).toMatch(/export type ChannelStatus = ToolProbeStatus \|/);
    });
});
