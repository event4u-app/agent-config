// Every CONCERN_REGISTRY entry must be callable the way the dispatcher calls it.
//
// WHY THIS FILE EXISTS. `suggestion_capture_hook.ts` declared
// `main(now: Date = new Date())` while `_run_concern_inproc`
// (`hooks/dispatch_hook.ts:666`) calls `main(argv)`. An array arrived where a
// Date was expected, `now.getTime()` threw, and the concern's own catch — "an
// instrument never breaks the turn it observes" — swallowed it and returned
// EXIT_ALLOW. The dispatcher recorded exit 0, severity allow, no output:
// indistinguishable from a disabled hook. The concern had never worked.
//
// AI council 2/2 (2026-08-24) asked for registry-wide coverage AND rejected the
// obvious form of it. Both seats made the same point independently: a
// "does not throw" assertion would have PASSED on the defect, because the throw
// was caught. Quoting the openai seat: "A no-throw assertion could reproduce the
// original false confidence."
//
// So the load-bearing layer here is not the call — it is the SIGNATURE. A
// concern's first parameter is argv or nothing, and that is decidable by reading
// the source, with no dependence on an exception the concern is designed to
// swallow. The runtime call is the second layer: it catches an entry that is not
// callable at all, which the source scan cannot see.
//
// TypeScript does not close this: `main(now?: Date)` is structurally assignable
// to `ConcernMain` when the first parameter is optional, which is exactly how
// the defect passed a green typecheck for its whole life.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONCERN_REGISTRY } from '../../src/scripts/hooks/concern_registry';
import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin';

const REPO = path.resolve(__dirname, '..', '..');

/** The registry's keys ARE the manifest script paths — the dispatcher indexes by them. */
const ENTRIES = Object.keys(CONCERN_REGISTRY).sort();

/**
 * The first parameter of `export function main(...)`, verbatim, or `null` when
 * the function takes none.
 */
function firstParamOf(scriptRel: string): string | null {
    const src = fs.readFileSync(path.join(REPO, scriptRel), 'utf8');
    // `design_pass_hook.ts` declares `main` and re-exports it as `_main`, which
    // is the name the registry imports. Read the declaration, not the alias:
    // the alias is a rename, the parameter list is the contract.
    const m = /(?:export\s+)?function\s+main\s*\(([^)]*)\)/.exec(src);
    if (m === null) return 'NO_MAIN_EXPORT';
    const params = m[1]!.trim();
    if (params === '') return null;
    // Split on the top-level comma only — a default value may contain one.
    let depth = 0;
    let first = '';
    for (const ch of params) {
        if (ch === '(' || ch === '[' || ch === '{' || ch === '<') depth++;
        if (ch === ')' || ch === ']' || ch === '}' || ch === '>') depth--;
        if (ch === ',' && depth === 0) break;
        first += ch;
    }
    return first.trim();
}

/**
 * Is this first parameter argv-shaped?
 *
 * Accepts an argv name with any string-array annotation, and accepts an
 * underscore prefix for a concern that ignores it. Rejects anything else —
 * including a `Date`, which is the defect this file exists for.
 */
function isArgvShaped(param: string): boolean {
    // Strip a rest prefix and an optional marker: `argv?: string[]` and
    // `...argv: string[]` are both argv, and both appear in the tree.
    const name = (param.split(':')[0] ?? '')
        .trim()
        .replace(/^\.\.\./, '')
        .replace(/\?$/, '');
    if (!/^_?argv$/.test(name)) return false;
    const annotated = param.includes(':') ? param.slice(param.indexOf(':') + 1) : '';
    if (annotated === '') return true;
    const type = (annotated.split('=')[0] ?? '').trim();
    return /string\s*\[\s*\]/.test(type) || /Array<\s*string\s*>/.test(type);
}

describe('the registry is not empty — a scan of nothing proves nothing', () => {
    it('holds the whole in-process concern set', () => {
        // A floor, not a `> 0` check: the registry silently shrinking to two
        // entries would pass any emptiness test while disarming this file.
        expect(ENTRIES.length).toBeGreaterThanOrEqual(25);
    });

    it('every key resolves to a file on disk', () => {
        for (const rel of ENTRIES) {
            expect(fs.existsSync(path.join(REPO, rel)), `${rel} is missing`).toBe(true);
        }
    });
});

describe("every concern's main() takes argv first, or nothing", () => {
    // The deterministic layer. It would have failed on the defect; a
    // does-not-throw assertion would not have.
    it.each(ENTRIES)('%s', (rel) => {
        const first = firstParamOf(rel);
        expect(first, `${rel} exports no main()`).not.toBe('NO_MAIN_EXPORT');
        if (first === null) return; // `main()` — nothing for argv to land on.
        expect(
            isArgvShaped(first),
            `${rel}: main()'s first parameter is \`${first}\`. The dispatcher calls ` +
                'main(argv) (dispatch_hook.ts:666), so a non-argv first parameter receives an ' +
                'array. If the concern then treats it as its declared type it throws, its own ' +
                'catch swallows the throw, and the dispatcher records exit 0 with no output — ' +
                'indistinguishable from a disabled hook. Move the parameter to second position.',
        ).toBe(true);
    });

    it('rejects a Date first parameter — the shape that actually shipped', () => {
        // Sensitivity: the predicate is exercised against the real defect and
        // against the forms that must keep passing.
        expect(isArgvShaped('now: Date = new Date()')).toBe(false);
        expect(isArgvShaped('now: Date')).toBe(false);
        expect(isArgvShaped('root: string')).toBe(false);
        expect(isArgvShaped('opts: { quiet: boolean }')).toBe(false);
        expect(isArgvShaped('argv?: string[]')).toBe(true);
        expect(isArgvShaped('argv: string[] = process.argv.slice(2)')).toBe(true);
        expect(isArgvShaped('_argv: readonly string[] = []')).toBe(true);
        expect(isArgvShaped('argv')).toBe(true);
    });
});

describe('every concern survives the dispatcher call shape at runtime', () => {
    // The second layer. It catches an entry that is not callable at all — a
    // shape the source scan cannot see. It deliberately does NOT assert
    // behaviour: with empty stdin every concern is supposed to be silent, and
    // asserting silence here would re-create the false confidence the council
    // warned about. That is why the scan above carries the contract.
    it.each(ENTRIES)('%s is callable with an argv array', (rel) => {
        setHookStdinOverride('');
        try {
            const rc = CONCERN_REGISTRY[rel]!(['--platform', 'claude']);
            expect(typeof rc, `${rel} returned a non-number`).toBe('number');
        } finally {
            clearHookStdinOverride();
        }
    });
});
