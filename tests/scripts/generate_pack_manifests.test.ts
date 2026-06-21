// Intent tests for src/scripts/generate_pack_manifests.ts — the `_py_safe_dump`
// serializer (the byte-identity risk this writer carries).
//
// `_py_safe_dump` is a pure PyYAML-`safe_dump(sort_keys=True, allow_unicode=
// True)`-faithful emitter (value in, YAML string out — no I/O, no repo state),
// so its contract is frozen here as committed expected literals. The literals
// were captured once from PyYAML 6.0.3 (`yaml.safe_dump`) and pin the
// behaviours the pack manifests depend on: key sorting, plain/single-quoted
// scalar selection (implicit-resolver re-typing of `yes/no/on/true/1.2`),
// int/bool/null reprs, empty `{}`/`[]`, nested block maps, block sequences
// aligned at the key indent, and the 80-column plain-scalar fold. No python at
// runtime. (The "every committed manifest regenerates byte-identically" check
// is a repo-wide CI concern — `task generate-pack-manifests --check` — not a
// hermetic unit test, so it is not duplicated here.)
import { describe, it, expect } from 'vitest';

import * as gpm from '../../src/scripts/generate_pack_manifests.js';

// [name, input, expected PyYAML-faithful output]
const CASES: Array<[string, unknown, string]> = [
    ['empty mapping → inline {}', {}, '{}\n'],
    ['empty sequence → inline []', [], '[]\n'],
    ['keys are sorted; int scalars bare', { b: 1, a: 2 }, 'a: 2\nb: 1\n'],
    ['bool + null reprs, sorted', { flag: true, empty_val: null }, 'empty_val: null\nflag: true\n'],
    [
        'plain string with em-dash (allow_unicode) stays unquoted',
        { description: 'Git workflow — commit, pull requests, branch sync.' },
        'description: Git workflow — commit, pull requests, branch sync.\n',
    ],
    ['unicode label plain', { label: 'Founder — Strategy' }, 'label: Founder — Strategy\n'],
    ['version-like string stays plain (not re-typed)', { version: '5.10.1' }, 'version: 5.10.1\n'],
    ['integer value bare', { artefact_count: 86 }, 'artefact_count: 86\n'],
    ['one-item list under key → block seq at key indent', { owner: ['engineering'] }, 'owner:\n- engineering\n'],
    ['empty list value → inline []', { empty: [] }, 'empty: []\n'],
    ["empty string → single-quoted ''", { description: '' }, "description: ''\n"],
    ["'yes' re-types to bool → single-quoted", { x: 'yes' }, "x: 'yes'\n"],
    ["'no' re-types to bool → single-quoted", { x: 'no' }, "x: 'no'\n"],
    ["'on' re-types to bool → single-quoted", { x: 'on' }, "x: 'on'\n"],
    ["'y' stays plain (not a YAML 1.1 bool in safe_dump)", { x: 'y' }, 'x: y\n'],
    ["'true' re-types to bool → single-quoted", { x: 'true' }, "x: 'true'\n"],
    ["number-like '1.2' → single-quoted", { v: '1.2' }, "v: '1.2'\n"],
    ['nested non-empty mapping indents +2', { nested: { a: 1, b: 'two' } }, 'nested:\n  a: 1\n  b: two\n'],
    ["leading '#' forces single-quote", { hash: '# leading hash' }, "hash: '# leading hash'\n"],
    ["apostrophe in plain context stays plain", { quote: "it's fine" }, "quote: it's fine\n"],
    [
        'composite: sorted keys, empty + nested lists, block seqs at key indent',
        {
            id: 'fun',
            label: 'Fun',
            owner: ['small-business'],
            dependencies: { rules: [], skills: ['prediction-pool-optimizer'] },
        },
        'dependencies:\n  rules: []\n  skills:\n  - prediction-pool-optimizer\nid: fun\nlabel: Fun\nowner:\n- small-business\n',
    ],
    ['no word boundary → no fold even past 80 cols', { k: 'x'.repeat(100) }, `k: ${'x'.repeat(100)}\n`],
    [
        '80-column plain-scalar fold at a word boundary, continuation indent 2',
        { desc: 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi' },
        'desc: alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron\n  pi\n',
    ],
];

describe('generate_pack_manifests — _py_safe_dump (PyYAML-faithful)', () => {
    it.each(CASES)('%s', (_name, input, expected) => {
        expect(gpm._py_safe_dump(input)).toBe(expected);
    });
});
