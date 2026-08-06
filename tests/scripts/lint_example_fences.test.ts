// Tests for src/scripts/lint_example_fences.ts.
//
// The unit under test is `scanFile`, because that is where every decision the
// gate makes lives: fence tracking, language scoping, the `unless` escape on a
// safe sibling form, and the escape-token contract. The CLI wiring around it is
// proven separately by the gate's own `--self-test`, which drives the real
// binary.
import { describe, expect, it } from 'vitest';

import { PATTERNS, parseAllow, reasonIsSubstantive, scanFile } from '../../src/scripts/lint_example_fences.js';

const rules = (text: string): string[] => scanFile('t.md', text).map((f) => f.rule);

describe('lint_example_fences — what counts as code', () => {
    it('reads inside a fence', () => {
        expect(rules('```js\nel.innerHTML = x;\n```\n')).toContain('render-innerhtml');
    });

    it('does not read prose — a rule naming the pattern in order to forbid it is the common case', () => {
        expect(rules('Never assign `.innerHTML =` on user input.\n')).toEqual([]);
    });

    it('scopes by the fence language: a web sink in a shell fence is a search string, not a sink', () => {
        // This exact line exists in the corpus: an `rg` pattern that hunts the
        // very sink it names. Firing on it would make the gate flag the tool
        // built to find the defect.
        expect(rules("```bash\nrg -n 'dangerouslySetInnerHTML|\\.innerHTML\\s*='\n```\n")).toEqual([]);
    });

    it('scans an untagged fence only with language-agnostic rules', () => {
        expect(rules('```\nel.innerHTML = x;\n```\n')).toEqual([]);
        expect(rules('```\napi_key = "abcd1234efgh"\n```\n')).toContain('secret-literal');
    });
});

describe('lint_example_fences — fence tracking', () => {
    it('does not treat an inner ``` as closing a ~~~ wrapper', () => {
        // `markdown-safe-codeblocks` mandates ~~~ as the outer fence when the
        // content itself contains ```. A naive toggle would close on the inner
        // fence and then scan the following prose as code.
        const text = [
            '~~~md',
            '```js',
            'const safe = 1;',
            '```',
            '~~~',
            '',
            'Prose after: el.innerHTML = x;',
            '',
        ].join('\n');
        expect(rules(text)).toEqual([]);
    });

    it('closes on a longer run of the same char', () => {
        expect(rules('````js\nel.innerHTML = x;\n````\nel.innerHTML = y;\n')).toEqual([
            'render-innerhtml',
        ]);
    });
});

describe('lint_example_fences — the safe sibling never fires', () => {
    it('accepts --force-with-lease and rejects a bare --force', () => {
        expect(rules('```bash\ngit push --force-with-lease=main:abc origin main\n```\n')).toEqual([]);
        expect(rules('```bash\ngit push --force origin main\n```\n')).toEqual(['git-force-push']);
    });

    it('does not fire on a placeholder credential', () => {
        expect(rules('```bash\nexport API_KEY="your-api-key-here"\n```\n')).toEqual([]);
        expect(rules('```bash\nexport API_KEY="${API_KEY}"\n```\n')).toEqual([]);
        expect(rules('```bash\nexport API_KEY="sk-live-93hf83hf8"\n```\n')).toEqual([
            'secret-literal',
        ]);
    });

    it('treats eval on a literal as a constant, and eval on a variable as the sink', () => {
        expect(rules('```js\neval("1 + 1");\n```\n')).toEqual([]);
        expect(rules('```js\neval(userSupplied);\n```\n')).toEqual(['render-eval']);
    });
});

describe('lint_example_fences — the escape token', () => {
    it('suppresses when the reason is substantive', () => {
        const text =
            '<!-- example-fence-allow: render-innerhtml -- negative example for the XSS section -->\n' +
            '```js\nel.innerHTML = x;\n```\n';
        expect(rules(text)).toEqual([]);
    });

    it('still reports when the reason is one word — a token that records nothing is not an allow', () => {
        const text =
            '<!-- example-fence-allow: render-innerhtml -- example -->\n```js\nel.innerHTML = x;\n```\n';
        expect(rules(text)).toEqual(['render-innerhtml/unsubstantive-reason']);
    });

    it('does not suppress a DIFFERENT rule than the one it names', () => {
        const text =
            '<!-- example-fence-allow: render-v-html -- negative example for the Vue section -->\n' +
            '```js\nel.innerHTML = x;\n```\n';
        expect(rules(text)).toEqual(['render-innerhtml']);
    });

    it('accepts the token on the opener line itself', () => {
        const text =
            '```js <!-- example-fence-allow: render-innerhtml -- shows the forbidden form on purpose -->\n' +
            'el.innerHTML = x;\n```\n';
        expect(rules(text)).toEqual([]);
    });

    it('parses a multi-id token', () => {
        const parsed = parseAllow('<!-- example-fence-allow: a, b -- because the section needs both -->');
        expect(parsed?.ids).toEqual(['a', 'b']);
        expect(parsed?.substantive).toBe(true);
    });
});

describe('lint_example_fences — reason quality', () => {
    it.each([
        ['example', false],
        ['negative', false],
        ['this is deliberate', true],
        ['a b', false],
    ])('reasonIsSubstantive(%j) === %s', (reason, expected) => {
        expect(reasonIsSubstantive(reason)).toBe(expected);
    });
});

describe('lint_example_fences — registry integrity', () => {
    it('every pattern declares a source rule, so a finding can be traced to the rule it violates', () => {
        for (const p of PATTERNS) {
            expect(p.source, `pattern ${p.id} has no source`).toBeTruthy();
        }
    });

    it('pattern ids are unique — an escape token must name exactly one rule', () => {
        const ids = PATTERNS.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('does not re-implement output-discipline, which lint_output_slop already owns', () => {
        // The registry deliberately stops short of the placeholder-prose class.
        // Detecting it here would produce two findings and two suppressions per
        // defect; this assertion is what keeps that decision from silently
        // eroding when someone adds "one more useful pattern".
        const overlap = PATTERNS.filter((p) => p.source === 'output-discipline');
        expect(overlap).toEqual([]);
    });
});
