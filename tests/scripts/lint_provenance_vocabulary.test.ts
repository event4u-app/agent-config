// Tests for src/scripts/lint_provenance_vocabulary.ts
// (road-to-provenance-and-license-governance Phase 3, S3.2/S3.3; rule 4 from
// road-to-evidence-based-adr-governance / ADR-238 § 6).
//
// Differential over the exported pure helpers: a banned phrase must fail, an
// approved-vocabulary use without a co-located scope box must fail, a valid
// box must pass, a box figure absent from docs/CLAIMS.md must fail, a clean
// file must pass, and the real repo tree — README.md + docs/** — must be
// clean (the linter enforces its own README section).
//
// Rule 4 (permanence language) is tested sensitivity-first and in BOTH
// directions: every rule has a planted violation that must fire AND a
// near-miss that must stay silent. The false-positive half is what makes the
// rule usable at all — the same word list unscoped matches 41 lines across 30
// ADR records, and the large majority of them are legitimate.
import * as fs from 'node:fs';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
    bannedPhraseViolations,
    coLocationViolations,
    scopeBoxNumberMismatches,
    lintFile,
    lintProvenanceVocabulary,
    SCOPE_BOX_ANCHOR,
    APPROVED_TERMS,
    isAdrRecord,
    lintAdrPermanence,
    permanenceViolations,
    PERMANENCE_GATE,
    PERMANENCE_PHRASES,
    PERMANENCE_WORDS,
} from '../../src/scripts/lint_provenance_vocabulary.js';

const REPO = path.resolve(__dirname, '..', '..');

const VALID_BOX = [
    'Our borrow discipline is **provenance-governed**.',
    '',
    SCOPE_BOX_ANCHOR,
    '#### Scope & limits',
    '',
    '- Unconscious training-data reproduction is not detectable at this layer.',
    '- Detection covers a knowledge base of known OSS only.',
    '- No CI-facing detection gate exists.',
    '- Rename-only laundering is not detected by anything we ship.',
    '- Measured recall 12/16, false positives 2/12.',
].join('\n');

const CLAIMS_WITH_NUMBERS = 'the ledger records recall 12/16 and false positives 2/12 on the frozen corpus';
const CLAIMS_WITHOUT_NUMBERS = 'the ledger records no comparable figures in this fixture';

describe('lint_provenance_vocabulary — banned phrases', () => {
    it('flags "copyright-safe" as a live claim', () => {
        const v = bannedPhraseViolations('Our tool makes your code copyright-safe.', 'x.md');
        expect(v.some((x) => x.rule === 'banned-phrase')).toBe(true);
    });

    it('flags near-variants (copyright-proof, IP-safe, legally safe)', () => {
        expect(bannedPhraseViolations('This output is copyright-proof.', 'x.md').length).toBeGreaterThan(0);
        expect(bannedPhraseViolations('Every borrow is IP-safe by design.', 'x.md').length).toBeGreaterThan(0);
        expect(bannedPhraseViolations('Reusing this snippet is legally safe.', 'x.md').length).toBeGreaterThan(0);
    });

    it('does NOT flag the phrase when the line names the ban (negation carve-out)', () => {
        const v = bannedPhraseViolations('We never claim any output is "copyright-safe".', 'x.md');
        expect(v).toEqual([]);
    });

    it('ignores a banned phrase inside a fenced code block', () => {
        const text = ['```', 'copyright-safe', '```'].join('\n');
        expect(bannedPhraseViolations(text, 'x.md')).toEqual([]);
    });
});

describe('lint_provenance_vocabulary — co-location', () => {
    it('flags approved vocabulary used without a co-located scope box', () => {
        const v = coLocationViolations('This is a provenance-governed workflow.', 'x.md');
        expect(v.some((x) => x.rule === 'co-location')).toBe(true);
    });

    it('passes approved vocabulary WITH a complete, co-located scope box', () => {
        expect(coLocationViolations(VALID_BOX, 'x.md')).toEqual([]);
    });

    it('does NOT require a box when the term is only CITED in quotes (naming the rule, not using it)', () => {
        const text = 'Approved vocabulary ("provenance-governed", "license-policy-enforced", "audited borrow trail") requires a co-located scope box.';
        expect(coLocationViolations(text, 'x.md')).toEqual([]);
    });

    it('flags a scope-box anchor with no following heading', () => {
        const text = [`${SCOPE_BOX_ANCHOR}`, '', '', '', '', '', 'no heading in the window'].join('\n');
        const v = coLocationViolations(text, 'x.md');
        expect(v.some((x) => x.rule === 'co-location')).toBe(true);
    });

    it('flags a box missing a required element (e.g. the rename-only statement)', () => {
        const incomplete = VALID_BOX.replace(
            '- Rename-only laundering is not detected by anything we ship.\n',
            '',
        );
        const v = coLocationViolations(incomplete, 'x.md');
        expect(v.some((x) => x.rule === 'scope-box-content' && x.msg.includes('rename-only'))).toBe(true);
    });

    it('flags a box with no measured N/D figure', () => {
        const noNumbers = VALID_BOX.replace('- Measured recall 12/16, false positives 2/12.', '- No figures here.');
        const v = coLocationViolations(noNumbers, 'x.md');
        expect(v.some((x) => x.rule === 'scope-box-content' && x.msg.includes('N/D figure'))).toBe(true);
    });

    it('exposes the approved-vocabulary list non-empty', () => {
        expect(APPROVED_TERMS.length).toBeGreaterThan(0);
    });
});

describe('lint_provenance_vocabulary — number cross-check', () => {
    it('fails when a box figure is absent from docs/CLAIMS.md', () => {
        const v = scopeBoxNumberMismatches(VALID_BOX, 'x.md', CLAIMS_WITHOUT_NUMBERS);
        expect(v.some((x) => x.rule === 'number-drift')).toBe(true);
    });

    it('passes when every box figure appears in docs/CLAIMS.md', () => {
        expect(scopeBoxNumberMismatches(VALID_BOX, 'x.md', CLAIMS_WITH_NUMBERS)).toEqual([]);
    });
});

describe('lint_provenance_vocabulary — clean file', () => {
    it('passes a file with no banned phrases and no approved vocabulary', () => {
        const text = 'This package ships rules, skills, and commands for coding agents.';
        expect(lintFile(text, 'x.md', CLAIMS_WITH_NUMBERS)).toEqual([]);
    });
});

describe('lint_provenance_vocabulary — real repo', () => {
    it('the shipped README + docs tree is clean (0 violations)', () => {
        expect(lintProvenanceVocabulary()).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Rule 4 — permanence language in ADR records
// ---------------------------------------------------------------------------

const ADR_PATH = 'docs/decisions/ADR-999-fixture.md';

interface AdrFixture {
    slug?: string;
    title?: string;
    /** Extra frontmatter lines, e.g. the `owner_intent` escape. */
    frontmatter?: readonly string[];
    /** Body sections, already including their own headings. */
    body: readonly string[];
}

function adr(f: AdrFixture): string {
    return [
        '---',
        'adr: 999',
        'status: accepted',
        `decision: ${f.slug ?? 'a-reversible-mechanism-choice'}`,
        ...(f.frontmatter ?? []),
        '---',
        '',
        `# ADR-999 — ${f.title ?? 'a reversible mechanism choice'}`,
        '',
        ...f.body,
        '',
    ].join('\n');
}

function fires(text: string, file: string = ADR_PATH): boolean {
    return permanenceViolations(text, file).some((v) => v.rule === 'permanence-language');
}

describe('lint_provenance_vocabulary — rule 4 record identification', () => {
    it('recognises a flat ADR record and a per-area record', () => {
        expect(isAdrRecord('docs/decisions/ADR-208-dist-agent-src-keep-forever.md')).toBe(true);
        expect(isAdrRecord('docs/adrs/telegraph/0001-default-off-until-bench.md')).toBe(true);
    });

    it('excludes indexes and the non-ADR documents that share docs/decisions/', () => {
        expect(isAdrRecord('docs/adrs/telegraph/README.md')).toBe(false);
        expect(isAdrRecord('docs/decisions/README.md')).toBe(false);
        expect(isAdrRecord('docs/decisions/adr-reopen-sweep-2026-08.md')).toBe(false);
        expect(isAdrRecord('docs/contracts/adr-layout.md')).toBe(false);
    });

    it('is inert on a non-ADR prose file, so the same word list cannot leak into docs/**', () => {
        const prose = adr({ title: 'kept forever', body: ['## Decision', '', 'KEEP — permanently.'] });
        expect(fires(prose, ADR_PATH)).toBe(true);
        expect(permanenceViolations(prose, 'docs/guidelines/whatever.md')).toEqual([]);
    });
});

describe('lint_provenance_vocabulary — rule 4 fires in load-bearing positions', () => {
    it('fires on an ADR-208-shaped title', () => {
        const text = adr({
            title: '`dist/agent-src/` is kept forever as the shipped projection tree',
            body: ['## Decision', '', 'KEEP. The installer keeps reading the projection root.'],
        });
        const v = permanenceViolations(text, ADR_PATH);
        expect(v.some((x) => x.msg.includes("record's title"))).toBe(true);
    });

    it('fires on an ADR-208-shaped `decision:` slug', () => {
        const text = adr({
            slug: 'dist-agent-src-keep-forever',
            body: ['## Decision', '', 'KEEP. Nothing else in this record says the word.'],
        });
        const v = permanenceViolations(text, ADR_PATH);
        expect(v.some((x) => x.msg.includes('`decision:` slug'))).toBe(true);
    });

    it('fires on an ADR-208-shaped Decision statement', () => {
        const text = adr({ body: ['## Decision', '', '**KEEP — permanently.** The tree remains the shipped root.'] });
        const v = permanenceViolations(text, ADR_PATH);
        expect(v.some((x) => x.msg.includes("record's decision"))).toBe(true);
    });

    it('fires on a predicative `permanent` in the Decision', () => {
        expect(fires(adr({ body: ['## Decision', '', '2. **The liability disclaimer is permanent.** It holds regardless.'] }))).toBe(true);
    });

    it('fires on each multi-word equivalent in the Decision', () => {
        for (const phrase of PERMANENCE_PHRASES) {
            expect(
                fires(adr({ body: ['## Decision', '', `We adopt the mechanism; ${phrase}.`] })),
                `phrase "${phrase}" did not fire`,
            ).toBe(true);
        }
    });

    it('fires inside an Addendum, which appends a new claim rather than historicising one', () => {
        const text = adr({
            body: [
                '## Decision',
                '',
                'Adopt the mechanism behind a default-off setting.',
                '',
                '### Addendum 2026-08-21 — the measurement came back null',
                '',
                'The surface stays default-off permanently.',
            ],
        });
        const v = permanenceViolations(text, ADR_PATH);
        expect(v.some((x) => x.msg.includes("record's addendum"))).toBe(true);
    });

    it('exposes the word and phrase lists non-empty', () => {
        expect(PERMANENCE_WORDS.length).toBeGreaterThan(0);
        expect(PERMANENCE_PHRASES.length).toBeGreaterThan(0);
    });
});

describe('lint_provenance_vocabulary — rule 4 stays silent in describing positions', () => {
    it('stays silent when the same word rejects an option under Alternatives', () => {
        const line = '- **Council-strict default `off` forever** is the option under review.';
        const text = adr({
            body: ['## Decision', '', 'Adopt the mechanism, reopenable per the trigger above.', '', '## Alternatives considered', '', line],
        });
        expect(fires(text)).toBe(false);
        // Sensitivity: the SAME line under `## Decision` fires, so the silence
        // above is the scoping working, not the matcher failing to see it.
        expect(fires(adr({ body: ['## Decision', '', line] }))).toBe(true);
    });

    it('stays silent when the same word reports an outcome under Consequences', () => {
        const line = '- Negative / accepted: the repo permanently carries a second tracked copy.';
        const text = adr({
            body: ['## Decision', '', 'Adopt the mechanism, reopenable per the trigger above.', '', '## Consequences', '', line],
        });
        expect(fires(text)).toBe(false);
        // Sensitivity, same construct one heading up.
        expect(fires(adr({ body: ['## Decision', '', line] }))).toBe(true);
    });

    it('stays silent under Context, an Amendment, and a quoted open question', () => {
        for (const heading of ['## Context', '## Amendment (2026-08-21, deep-council)', '## Open question (deliberately NOT decided here)']) {
            const text = adr({
                body: ['## Decision', '', 'Adopt the mechanism.', '', heading, '', 'The earlier record treated it as permanent, and said so forever.'],
            });
            expect(fires(text), `${heading} should be silent`).toBe(false);
        }
    });

    it('stays silent on a table rationale cell inside the Decision (ADR-074 shape)', () => {
        const text = adr({
            body: [
                '## Decision',
                '',
                '| # | Question | Answer | Rationale |',
                '|---|---|---|---|',
                '| 4 | Probe failure | Re-open and restart the cooldown. | Bounds a misconfigured host probing forever. |',
            ],
        });
        expect(fires(text)).toBe(false);
        // Sensitivity: the same cell text as prose in the Decision fires.
        expect(fires(adr({ body: ['## Decision', '', 'Bounds a misconfigured host probing forever.'] }))).toBe(true);
    });

    it('stays silent on an attributive `permanent` naming an artifact, not the decision', () => {
        expect(fires(adr({ body: ['## Decision', '', 'Two permanent regression fixtures cover the hostile-registry shape.'] }))).toBe(false);
        expect(fires(adr({ body: ['## Decision', '', 'The defer ships a forcing function so it cannot calcify into permanent debt.'] }))).toBe(false);
    });

    it('stays silent on a hyphen-compound modifier describing something else', () => {
        expect(fires(adr({ body: ['## Decision', '', 'Hash equality replaces a forever-incomplete enumeration of triggers.'] }))).toBe(false);
        expect(fires(adr({ body: ['## Decision', '', 'The queue is a permanently-parked backlog of harvest candidates.'] }))).toBe(false);
    });

    it('stays silent when the sentence NEGATES the permanence', () => {
        expect(fires(adr({ body: ['## Decision', '', 'The default is not permanent; it is reopened by the trigger above.'] }))).toBe(false);
        expect(fires(adr({ body: ['## Decision', '', 'The freeze cannot silently become permanent.'] }))).toBe(false);
    });

    it('stays silent when the sentence is CONDITIONAL, including across a hard wrap', () => {
        const text = adr({
            body: [
                '## Decision',
                '',
                'Both forms are accepted during the transition window so in-flight',
                'branches still merge. If step 8 slips, the dual-form acceptance becomes',
                'permanent with a deprecation warning on the logical form.',
            ],
        });
        expect(fires(text)).toBe(false);
    });

    it('stays silent when the word is only NAMED in a quoted or backtick span', () => {
        expect(fires(adr({ body: ['## Decision', '', 'The words `forever` and `permanently` are linted out of new records.'] }))).toBe(false);
    });

    it('stays silent inside a fenced code block in the Decision', () => {
        const text = adr({ body: ['## Decision', '', '```', 'keep = "forever"', '```'] });
        expect(fires(text)).toBe(false);
    });
});

describe('lint_provenance_vocabulary — rule 4 escape 1: external invariant + stop condition', () => {
    const EXTERNAL_CLAIM = 'The wire format is fixed permanently by the upstream protocol contract.';

    it('stays silent when the external invariant carries its stop condition in the same section', () => {
        const text = adr({
            body: [
                '## Decision',
                '',
                EXTERNAL_CLAIM,
                '',
                'The constraint stops applying when the upstream protocol is retired or the',
                'last consumer on the old version is gone.',
            ],
        });
        expect(fires(text)).toBe(false);
    });

    it('fires on the SAME external claim when no stop condition is stated', () => {
        const text = adr({ body: ['## Decision', '', EXTERNAL_CLAIM] });
        expect(fires(text)).toBe(true);
    });

    it('does not let a stop condition rescue a permanence claim that is NOT externally scoped', () => {
        const text = adr({
            body: [
                '## Decision',
                '',
                '**KEEP — permanently.** This is our own tree, not anyone else’s contract.',
                '',
                'The gate is reopened when the package size grows past 5 MB.',
            ],
        });
        expect(fires(text)).toBe(true);
    });
});

describe('lint_provenance_vocabulary — rule 4 escape 2: owner_intent', () => {
    const OWNER_CLAIM = ['## Decision', '', 'The suite is open-source forever; there is no commercial tier.'];

    it('stays silent when the record records `authority_basis: owner_intent`', () => {
        const text = adr({ frontmatter: ['authority_basis: owner_intent'], body: OWNER_CLAIM });
        expect(fires(text)).toBe(false);
    });

    it('stays silent when the escape is nested under another frontmatter key', () => {
        const text = adr({ frontmatter: ['provenance:', '  kind: human', 'authority_basis: owner_intent'], body: OWNER_CLAIM });
        expect(fires(text)).toBe(false);
    });

    it('fires on the SAME claim without the escape', () => {
        expect(fires(adr({ body: OWNER_CLAIM }))).toBe(true);
    });

    it('does NOT let the escape silence the title or the slug — a field cannot qualify a name tools print without reading it', () => {
        const text = adr({
            slug: 'open-source-forever-no-commercial-tier',
            title: 'the suite is open-source forever; no commercial tier',
            frontmatter: ['authority_basis: owner_intent'],
            body: ['## Decision', '', 'There is no paid distribution.'],
        });
        const kinds = permanenceViolations(text, ADR_PATH).map((v) => v.msg);
        expect(kinds.some((m) => m.includes('`decision:` slug'))).toBe(true);
        expect(kinds.some((m) => m.includes("record's title"))).toBe(true);
    });
});

describe('lint_provenance_vocabulary — rule 4 over the real corpus', () => {
    const live = lintAdrPermanence();

    it('the recorded baseline equals the live count', () => {
        const baselines = JSON.parse(
            fs.readFileSync(path.join(REPO, 'src/config/gate-violation-baselines.json'), 'utf-8'),
        ) as { gates: Record<string, { count: number } | undefined> };
        const entry = baselines.gates[PERMANENCE_GATE];
        expect(entry, `${PERMANENCE_GATE} has no baseline entry`).toBeDefined();
        // Equality, not `<=`: a baseline ABOVE the live count silently grants
        // one free regression and the gate still prints green.
        expect(entry?.count).toBe(live.length);
    });

    it('detects every record the doctrine names, in the position it names', () => {
        const found = new Set(live.map((v) => `${v.file.split('/').pop() ?? ''}`));
        for (const record of [
            'ADR-107-legal-domain-pack-adoption.md',
            'ADR-108-open-source-forever-no-commercial-tier.md',
            'ADR-122-adversarial-verification-council.md',
            'ADR-124-embedded-engine-doctrine.md',
            'ADR-208-dist-agent-src-keep-forever.md',
        ]) {
            expect(found.has(record), `${record} should be detected`).toBe(true);
        }
        // ADR-208 is the canonical case and must fire in all three positions.
        const adr208 = live.filter((v) => v.file.includes('ADR-208'));
        expect(adr208.some((v) => v.msg.includes('`decision:` slug'))).toBe(true);
        expect(adr208.some((v) => v.msg.includes("record's title"))).toBe(true);
        expect(adr208.some((v) => v.msg.includes("record's decision"))).toBe(true);
    });

    it('stays silent on every verified describing position in the corpus', () => {
        // file:line pairs read from the tree and classified by hand as
        // Alternatives / Consequences / Context / open-question / table-cell
        // positions. A regression here is the gate turning into noise.
        const mustBeSilent: ReadonlyArray<readonly [string, number]> = [
            ['ADR-042', 36],
            ['ADR-059', 79],
            ['ADR-059', 144],
            ['ADR-074', 41],
            ['ADR-105', 97],
            ['ADR-136', 90],
            ['ADR-137', 148],
            ['ADR-137', 149],
            ['ADR-137', 151],
            ['ADR-201', 343],
            ['ADR-212', 133],
            ['ADR-216', 278],
            ['ADR-216', 298],
            ['ADR-225', 64],
        ];
        const hits = new Set(
            live.map((v) => `${(v.file.split('/').pop() ?? '').slice(0, 7)}:${/line (\d+)/.exec(v.msg)?.[1] ?? ''}`),
        );
        for (const [record, line] of mustBeSilent) {
            expect(hits.has(`${record}:${String(line)}`), `${record}:${String(line)} must stay silent`).toBe(false);
        }
    });

    it('reads a non-empty ADR corpus — a scoped rule that read nothing would print green', () => {
        expect(fs.existsSync(path.join(REPO, 'docs/decisions'))).toBe(true);
        expect(fs.existsSync(path.join(REPO, 'docs/adrs'))).toBe(true);
    });
});
