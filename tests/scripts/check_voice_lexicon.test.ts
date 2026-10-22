// check_voice_lexicon — "never say X" and "this claim needs a proof", checked
// on the finished draft (road-to-a-brand-the-tree-can-check 0.4, 5.1-5.3).
//
// The 5.3 negative-corpus bar is asserted over corpus v2 only: v1's first
// measurement missed (0.28 per 10k), so registry v2 and a corpus it was not
// revised against were pre-registered before v2 was scanned, so the bar is not
// tuned to the corpus that measures it.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    blankExempt,
    claimsFromSlot,
    checkDraft,
    lexiconFromGhostwriter,
    lexiconFromSlot,
    lexiconFromUserProfile,
    scanClaims,
    scanLexicon,
    unknownTellIds,
    unwrapSingleFence,
    type LexiconTerm,
} from '../../src/scripts/check_voice_lexicon.js';
import { validateBrandVoiceSlotText } from '../../src/scripts/_lib/brand_voice_slot.js';
import { CLAIM_PHRASES } from '../../src/scripts/_lib/claim_phrases.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'check_voice_lexicon.ts');
const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
const NOW = new Date('2026-10-17T12:00:00Z');

const GHOSTWRITER_PROFILE = [
    '---',
    'version: 1',
    'fictional: true',
    'taboos:',
    '  - "game-changer"',
    '  - "political endorsements"',
    '---',
    '# Notes',
    '',
].join('\n');

function slot(extra = ''): string {
    return [
        '---',
        'version: 1',
        'attributes:',
        '  - { is: warm, is_not: gushing, proof: "thanks once" }',
        '  - { is: precise, is_not: pedantic, proof: "units" }',
        '  - { is: direct, is_not: curt, proof: "answer first" }',
        'avoid:',
        '  - { term: synergy, match: word, note: "say what combines" }',
        '  - { term: leverag, match: substring }',
        'claims:',
        '  - { text: "fastest importer we measured", evidence_ref: docs/bench.md, expires: 2027-03-01 }',
        '  - { text: "zero downtime since 2024", evidence_ref: docs/uptime.md, expires: 2026-01-01 }',
        'provenance:',
        '  sources: [{ ref: docs/voice.md, tier: authoritative }]',
        '  confidence: med',
        '  last_reviewed_at: 2026-10-01',
        extra,
        '---',
        '# Voice',
        '',
    ].join('\n');
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-lexicon-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function write(name: string, body: string): string {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

function run(args: string[], input?: string): { status: number | null; stdout: string; stderr: string } {
    const r = spawnSync(TSX, [SCRIPT, ...args], { encoding: 'utf8', cwd: REPO_ROOT, input });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe('check_voice_lexicon — control', () => {
    // 0.4: before this checker, a ghostwriter draft carrying its own taboo and a
    // brand draft claiming "the number one platform" produced no finding from
    // any tool. Both must now be located.
    it('control: a taboo in a ghostwriter draft and an unbacked claim in a brand draft are both found', () => {
        const profile = write('profile.md', GHOSTWRITER_PROFILE);
        const gwDraft = write('gw.md', 'This launch is a real game-changer for the team.\n');
        const gw = run(['--draft', gwDraft, '--ghostwriter', profile, '--json']);
        expect(gw.status, gw.stderr).toBe(1);
        const gwOut = JSON.parse(gw.stdout) as { findings: Array<{ kind: string; severity: string; line: number }> };
        expect(gwOut.findings).toEqual([expect.objectContaining({ kind: 'avoid', severity: 'error', line: 1 })]);

        const slotPath = write('brand-voice.md', slot());
        const brandDraft = write('brand.md', 'Meet the number one platform for teams.\n');
        const brand = run(['--draft', brandDraft, '--slot', slotPath, '--json', '--now', '2026-10-17']);
        expect(brand.status, brand.stderr).toBe(0);
        const brandOut = JSON.parse(brand.stdout) as { findings: Array<{ kind: string; text: string }> };
        expect(brandOut.findings).toEqual([expect.objectContaining({ kind: 'unbacked-claim', text: 'number one' })]);
    });
});

describe('check_voice_lexicon — lexicon', () => {
    const terms: LexiconTerm[] = [
        { term: 'synergy', match: 'word', source: 'brand', note: 'say what combines' },
        { term: 'leverag', match: 'substring', source: 'brand' },
    ];

    it('lexicon: word and substring matches are located, case-insensitively', () => {
        const text = 'Line one.\nOur Synergy is real; we are LEVERAGING it.\n';
        const found = scanLexicon(text, terms);
        expect(found.map((f) => [f.line, f.column, f.text, f.note])).toEqual([
            [2, 5, 'Synergy', 'say what combines'],
            [2, 29, 'LEVERAG', undefined],
        ]);
    });

    it('lexicon: word mode does not match inside a longer word', () => {
        expect(scanLexicon('synergystic synergyX', terms.slice(0, 1))).toEqual([]);
    });

    it('lexicon: quoted, cited and code-fenced text is exempt, and locations survive the blanking', () => {
        const text = [
            'They wrote "pure synergy" in the brief.',
            '> synergy, said the memo',
            '```',
            'synergy()',
            '```',
            'Inline `synergy` is code.',
            'But this synergy counts.',
        ].join('\n');
        const blanked = blankExempt(text);
        expect(blanked.length).toBe(text.length);
        expect(blanked.split('\n').length).toBe(text.split('\n').length);
        expect(scanLexicon(text, terms.slice(0, 1)).map((f) => [f.line, f.column])).toEqual([[7, 10]]);
    });

    it('lexicon: a ghostwriter taboo is not hidden by wrapping it in quotes', () => {
        const taboo: LexiconTerm[] = [{ term: 'game changer', match: 'word', source: 'ghostwriter' }];
        const found = scanLexicon('This is a "game changer" for you.\n> game changer\n', taboo);
        expect(found.map((f) => [f.line, f.severity])).toEqual([[1, 'error']]);
    });

    it('lexicon: a term is an escaped literal, never a pattern', () => {
        const t: LexiconTerm[] = [{ term: 'a.b*', match: 'substring', source: 'user' }];
        expect(scanLexicon('axbbb and a.b* here', t).map((f) => f.column)).toEqual([11]);
    });

    it('lexicon: sources load from the slot and the ghostwriter profile', () => {
        expect(lexiconFromSlot(slot()).map((t) => [t.term, t.source])).toEqual([
            ['synergy', 'brand'],
            ['leverag', 'brand'],
        ]);
        expect(lexiconFromGhostwriter(GHOSTWRITER_PROFILE).map((t) => [t.term, t.match, t.source])).toEqual([
            ['game-changer', 'word', 'ghostwriter'],
            ['political endorsements', 'word', 'ghostwriter'],
        ]);
    });

    it('lexicon: an empty lexicon is SKIPPED with its reason, never a green nothing', () => {
        const draft = write('d.md', 'Plain words.\n');
        const r = run(['--draft', draft, '--json']);
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as { lexicon: { status: string; reason?: string } };
        expect(out.lexicon.status).toBe('skipped');
        expect(out.lexicon.reason).toMatch(/scanned 0/);
    });

    it('lexicon: hidden Unicode in the draft is a finding', () => {
        const report = checkDraft('Hello​world\n', { terms, claims: [], tellExemptions: [], now: NOW });
        expect(report.findings.map((f) => f.kind)).toContain('hidden-unicode');
    });
});

describe('check_voice_lexicon — tell-exemptions', () => {
    const TELLING =
        'Great question! I hope this helps. He called it “fast”, “simple” and “safe”. ' +
        "In today's fast-paced world, it's worth noting that quality matters.\n";

    it('tell-exemptions: exempted tell ids are excluded from the detector, others still report', () => {
        const without = checkDraft(TELLING, { terms: [], claims: [], tellExemptions: [], now: NOW });
        const ids = without.tells.map((t) => t.id);
        expect(ids.length).toBeGreaterThan(1);
        const [exempt, ...rest] = ids as [string, ...string[]];
        const withExempt = checkDraft(TELLING, { terms: [], claims: [], tellExemptions: [exempt], now: NOW });
        const after = withExempt.tells.map((t) => t.id);
        expect(after).not.toContain(exempt);
        expect(after).toEqual(expect.arrayContaining(rest));
    });

    it('tell-exemptions: an unknown id is a lint error in the slot and the CLI', () => {
        expect(unknownTellIds(['tell-curly-quotes', 'tell-not-a-rule'])).toEqual(['tell-not-a-rule']);
        const issues = validateBrandVoiceSlotText(slot('tell_exemptions: [tell-not-a-rule]'));
        expect(issues.map((i) => i.field)).toContain('tell_exemptions[0]');
        const slotPath = write('brand-voice.md', slot('tell_exemptions: [tell-not-a-rule]'));
        const draft = write('d.md', 'Plain words.\n');
        const r = run(['--draft', draft, '--slot', slotPath, '--json']);
        expect(r.status).toBe(2);
        expect(r.stderr).toContain('tell_exemptions[0]');
    });
});

describe('check_voice_lexicon — claim-shapes', () => {
    const claims = claimsFromSlot(slot());

    it('claim-shapes: superlative, comparative, absolute, certification and guarantee phrases are found', () => {
        const text = [
            'We are industry-leading.',
            'It is faster than any rival.',
            'Expect zero downtime.',
            'An award-winning team.',
            'We guarantee it.',
        ].join('\n');
        const found = scanClaims(text, [], NOW);
        expect(found.map((f) => [f.line, f.claim_class, f.severity])).toEqual([
            [1, 'superlative', 'warning'],
            [2, 'comparative', 'warning'],
            [3, 'absolute', 'warning'],
            [4, 'certification', 'warning'],
            [5, 'guarantee', 'warning'],
        ]);
        expect(found.every((f) => f.kind === 'unbacked-claim')).toBe(true);
    });

    it('claim-shapes: a sentence carrying a live claim entry is backed; an expired one is not', () => {
        const backed = scanClaims('We built the fastest importer we measured — industry-leading.\n', claims, NOW);
        expect(backed).toEqual([]);
        const expired = scanClaims('Zero downtime since 2024, guaranteed.\n', claims, NOW);
        expect(expired).toEqual([expect.objectContaining({ kind: 'unbacked-claim', text: 'Zero downtime' })]);
        expect(expired[0]?.note).toMatch(/expired 2026-01-01/);
    });

    it('claim-shapes: German phrases are hints, bare words never fire, quoted claims are exempt', () => {
        const found = scanClaims('Wir sind Marktführer.\nThe only way, the best tool.\nThey said "number one".\n', [], NOW);
        expect(found.map((f) => [f.line, f.severity])).toEqual([[1, 'hint']]);
    });

    it('claim-shapes: no English registry entry is a single bare word (NG-10)', () => {
        const bare = CLAIM_PHRASES.filter((p) => p.language === 'en' && !/[\s\-.]/u.test(p.phrase)).map((p) => p.phrase);
        expect(bare).toEqual([]);
    });
});

describe('check_voice_lexicon — negative-corpus', () => {
    it('negative-corpus: registry v2 stays at or under 0.1 claim hits per 10k words on the pre-registered v2 corpus', () => {
        const listFile = path.join(REPO_ROOT, 'tests', 'fixtures', 'voice-lexicon', 'negative-corpus-v2.txt');
        const files = fs
            .readFileSync(listFile, 'utf8')
            .split('\n')
            .filter((l) => l.trim() !== '' && !l.startsWith('#'));
        expect(files.length).toBeGreaterThan(100);
        // A live ratchet over the registered list, not a replay of the
        // registered run (that reading is frozen in the 2026-10-19 evidence
        // note): a guideline later deleted is dropped, never an ENOENT, and a
        // claim phrase later written into one reds here on purpose.
        const present = files.filter((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));
        expect(present.length, 'most of the registered corpus must still exist').toBeGreaterThan(100);
        let words = 0;
        let hits = 0;
        for (const rel of present) {
            const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
            words += text.split(/\s+/u).filter(Boolean).length;
            hits += scanClaims(text, [], NOW).length;
        }
        expect(words).toBeGreaterThan(50_000);
        expect((hits / words) * 10_000).toBeLessThanOrEqual(0.1);
    });
});

describe('check_voice_lexicon — draft-surfaces', () => {
    it('draft-surfaces: --draft - reads the finished draft from stdin, so no surface writes it to disk', () => {
        const gw = write('gw.md', GHOSTWRITER_PROFILE);
        const r = run(['--draft', '-', '--ghostwriter', gw], 'A real game-changer.\n');
        expect(r.status).toBe(1);
        expect(r.stdout).toMatch(/^-:1:\d+ error avoid "game-changer"/mu);
    });

    it('draft-surfaces: a draft piped as printed — one fenced block — is scanned, not exempted', () => {
        const gw = write('gw.md', GHOSTWRITER_PROFILE);
        const r = run(['--draft', '-', '--ghostwriter', gw], '```markdown\nIntro.\nA real game-changer.\n```\n');
        expect(r.status).toBe(1);
        expect(r.stdout).toMatch(/^-:3:\d+ error avoid "game-changer"/mu);
        for (const fenced of [
            '````markdown\nA real game-changer.\n````\n',
            '```\nA real game-changer.\n   ```\n',
            '~~~\nA real game-changer.\n~~~~\n',
            '```\nIntro.\n```js\nx\n```\nA real game-changer.\n```\n',
        ]) {
            const unwrapped = unwrapSingleFence(fenced);
            expect(unwrapped.split('\n').length).toBe(fenced.split('\n').length);
            expect(blankExempt(unwrapped)).toContain('game-changer');
        }
        expect(unwrapSingleFence('Plain.\n```\ncode\n```\n')).toBe('Plain.\n```\ncode\n```\n');
    });

    it('draft-surfaces: an empty or unpiped draft is exit 2, never a clean pass', () => {
        const r = run(['--draft', '-'], '');
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/draft is empty/);
    });

    it('draft-surfaces: every surface says what exit 2 means', () => {
        for (const rel of [
            'src/domains/gtm-marketing/ghostwriter/write/command.md',
            'src/domains/gtm-marketing/post-as/me/command.md',
            'src/skills/humanizer/SKILL.md',
            'src/domains/brand/brand/review/command.md',
        ]) {
            expect(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'), rel).toMatch(/[Ee]xit \*{0,2}2\*{0,2} /u);
        }
    });

    it('draft-surfaces: every drafting surface runs the checker on its finished draft', () => {
        const surfaces = [
            'src/domains/gtm-marketing/ghostwriter/write/command.md',
            'src/domains/gtm-marketing/post-as/me/command.md',
            'src/skills/humanizer/SKILL.md',
            'src/domains/brand/brand/review/command.md',
        ];
        for (const rel of surfaces) {
            const body = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
            expect(body, rel).toContain('check_voice_lexicon.ts --draft -');
        }
    });
});

describe('check_voice_lexicon — user-source', () => {
    // 5.5 (E16): the user's own `style.avoid` from `.agent-user.md` is the third
    // lexicon source, at `warning`. Absent, the file contributes nothing.
    const USER_MD = [
        '---',
        'version: 1',
        'identity:',
        '  name: "Sam"',
        'language: "en"',
        'style:',
        '  pace: "pragmatic"',
        '  avoid:',
        '    - { pattern: "circle back", match: word, note: "say when" }',
        '    - { pattern: "synerg", match: substring }',
        'last_updated: "2026-10-20"',
        '---',
        '# Notes',
        '',
    ].join('\n');

    it('user-source: style.avoid loads as user terms; an absent field loads none', () => {
        expect(lexiconFromUserProfile(USER_MD)).toEqual([
            { term: 'circle back', match: 'word', source: 'user', note: 'say when' },
            { term: 'synerg', match: 'substring', source: 'user' },
        ]);
        expect(lexiconFromUserProfile(USER_MD.replace(/ {2}avoid:\n(?: {4}- .*\n)+/u, ''))).toEqual([]);
    });

    it('user-source: --user flags a hit at warning with source user and exits 0', () => {
        const user = write('.agent-user.md', USER_MD);
        const draft = write('d.md', 'We will circle back on the synergies.\n');
        const r = run(['--draft', draft, '--user', user, '--json']);
        expect(r.status, r.stderr).toBe(0);
        const out = JSON.parse(r.stdout) as { lexicon: { status: string }; findings: Array<Record<string, unknown>> };
        expect(out.lexicon.status).toBe('scanned');
        expect(out.findings).toEqual([
            expect.objectContaining({ kind: 'avoid', severity: 'warning', source: 'user', text: 'circle back', note: 'say when' }),
            expect.objectContaining({ kind: 'avoid', severity: 'warning', source: 'user', text: 'synerg' }),
        ]);
    });

    it('user-source: a user file without style.avoid behaves as no user file — SKIPPED, exit 0', () => {
        const user = write('.agent-user.md', USER_MD.replace(/ {2}avoid:\n(?: {4}- .*\n)+/u, ''));
        const draft = write('d.md', 'We will circle back.\n');
        const r = run(['--draft', draft, '--user', user, '--json']);
        expect(r.status, r.stderr).toBe(0);
        expect((JSON.parse(r.stdout) as { lexicon: { status: string } }).lexicon.status).toBe('skipped');
    });

    it('user-source: an invalid style.avoid is exit 2, never a silent skip', () => {
        const user = write('.agent-user.md', USER_MD.replace('match: substring', 'match: regex'));
        const draft = write('d.md', 'Plain.\n');
        const r = run(['--draft', draft, '--user', user]);
        expect(r.status).toBe(2);
        expect(r.stderr).toMatch(/style\.avoid/);
    });

    it('user-source: /post-as:me passes the user file to the checker', () => {
        const body = fs.readFileSync(path.join(REPO_ROOT, 'src/domains/gtm-marketing/post-as/me/command.md'), 'utf8');
        expect(body).toContain('--user .agent-user.md');
        expect(body).not.toMatch(/has no such\s+field/u);
    });
});
