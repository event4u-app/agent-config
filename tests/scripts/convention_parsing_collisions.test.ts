import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { scan_file } from '../../src/scripts/check_iron_law_prominence.js';
import { has_framework_frontmatter } from '../../src/scripts/lint_framework_leakage.js';
import { parse_mode } from '../../src/scripts/lint_override_kernel_guard.js';
import { riskClassViolations } from '../../src/scripts/lint_pack_risk_class.js';

/**
 * Collision fixtures for the convention-parsing sweep's confirmed `vulnerable`
 * findings — road-to-gates-that-can-fail Phase 6.2. The full population, the
 * criterion, and every verdict live in
 * `agents/evidence/reports/convention-parsing-sweep.md`.
 *
 * Defect class (same as the 9.9.0 CHANGELOG failure fixtured in
 * `changelog_release_section_gate.test.ts`): the gate takes the FIRST match
 * over a repo convention, and the repo's own naming can produce an earlier one.
 * Here all three findings resolve in the dangerous direction — the gate reports
 * success on input it never actually measured.
 *
 * These assertions pin OBSERVED behaviour, not desired behaviour — so a repair
 * SHOULD turn a `KNOWN DEFECT` case red, and that flip is the signal a finding
 * was closed rather than a regression.
 *
 * Two findings have since been closed and their cases now read `REPAIRED`:
 * `lint_framework_leakage` (unanchored frontmatter regex exempted whole files)
 * and `lint_override_kernel_guard` (first `**Mode:**` line won, which let a real
 * `replace` on a safety-floor rule pass as `extend`). Both were gate bypasses,
 * which is why they were fixed rather than filed.
 *
 * The remaining `KNOWN DEFECT` cases are open on purpose: `check_iron_law_prominence`
 * needs delimiter-aware fence tracking (the one-line fix was measured and closes
 * only one of its two directions), `check_proposal` needs fence-stripping across
 * three checks that must agree, and `lint_pack_risk_class` needs a real YAML
 * parse. Each is recorded in the report with its repair named.
 *
 * Every finding ships with a CONTROL asserting the gate DOES fire on the same
 * input without the collision. Without the control a fixture pair would pass
 * just as well against a gate that reports nothing at all, which proves nothing.
 */

const TMP: string[] = [];

function write(name: string, body: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'convention-collision-'));
    TMP.push(dir);
    const p = path.join(dir, name);
    fs.writeFileSync(p, body, 'utf-8');
    return p;
}

afterAll(() => {
    for (const d of TMP) fs.rmSync(d, { recursive: true, force: true });
});

// ── Finding 1 — check_iron_law_prominence: ``` vs ~~~ fence ────────────────────

/**
 * The gate's header states: "Code blocks are skipped to avoid false positives
 * on quoted text." It implements that with `FENCE_RE = /^\s*```/` — backticks
 * only. But `markdown-safe-codeblocks` mandates `~~~` as the OUTER fence when
 * the wrapped content itself contains ``` blocks, and the corpus uses it
 * (`src/skills/emit-tickets/SKILL.md`, `src/agent-src/templates/tickets.md`).
 *
 * The one-line repair `/^\s*(```|~~~)/` — the shape `check_md_language.ts:137`
 * and `check_claims.ts:319` already use — was applied and measured: it turns
 * the false-POSITIVE case red and leaves the false-NEGATIVE case green,
 * because the inner ``` then closes the `~~~` block and the next `~~~` reopens
 * it. A real repair has to remember which delimiter opened the fence.
 */
describe('check_iron_law_prominence — ``` vs ~~~ fence collision', () => {
    const kinds = (p: string): string[] => scan_file(p).map((v) => `${v.kind}@${v.line}`);
    const md = (lines: readonly string[]): string => lines.join('\n');

    it('CONTROL — a real deep Iron Law heading outside any fence is reported', () => {
        const p = write('real.md', md(['# Demo', '', '## Overview', '', '### Iron Law', '', 'NEVER do X.']));
        expect(kinds(p)).toEqual(['deep_iron_law@5']);
    });

    it('CONTROL — the same heading quoted inside a ``` block is correctly skipped', () => {
        const p = write('backtick.md', md(['# Demo', '', '## Overview', '', '```', '### Iron Law', '```', '', '## Notes', '', 'end']));
        expect(kinds(p)).toEqual([]);
    });

    it('KNOWN DEFECT — quoted inside a ~~~ block it is reported anyway (false positive)', () => {
        const p = write('tilde.md', md(['# Demo', '', '## Overview', '', '~~~', '### Iron Law', '~~~', '', '## Notes', '', 'end']));
        expect(kinds(p)).toEqual(['deep_iron_law@6']);
    });

    it('KNOWN DEFECT — an odd ``` inside a ~~~ block hides a real violation (false negative)', () => {
        // The `~~~` wrapper exists precisely because the content shows a ```
        // fence; showing only the opening one is the natural way to document
        // "start a block like this".
        const p = write(
            'odd.md',
            md([
                '# Demo',
                '',
                '## Overview',
                '',
                '~~~',
                'To open a block, type:',
                '',
                '```',
                '',
                '~~~',
                '',
                '### Iron Law',
                '',
                'NEVER do X.',
            ]),
        );
        expect(kinds(p)).toEqual([]);
    });
});

// ── Finding 2 — lint_pack_risk_class: first `key:` in the block wins ───────────

/**
 * `_field(block, key)` is `new RegExp('(^|\\n)\\s*' + key + ':\\s*([^\\n#]+)')`
 * — no `g`, so the FIRST line in the pack block whose leading whitespace is
 * followed by `key:` wins. `\s*` accepts any indentation, so both a block-scalar
 * continuation line and a nested mapping shadow the real top-level value.
 *
 * Both directions below skip the safety checks on a genuinely high-risk pack:
 * the gate prints its green "risk_class invariant OK" line having measured a
 * description sentence or a nested overlay instead of the pack.
 *
 * Repair (not applied — `lint_*` is owned elsewhere): parse `packs.yml` with the
 * real YAML parser already used by `lint_topics_yaml.ts` / `lint_flows.ts`, or
 * at minimum anchor `_field` to the block's own indentation level.
 */
describe('lint_pack_risk_class — first `key:` in the pack block wins', () => {
    const yaml = (lines: readonly string[]): string => lines.join('\n');
    const msgs = (y: string): string[] => riskClassViolations(y).map((v) => v.msg);

    const HONEST = yaml([
        '- id: danger-pack',
        '  label: Danger',
        '  risk_class: high',
        '  default_install: true',
        '  requires_explicit_consent: false',
        '  surface_tier: core',
        '',
    ]);

    it('CONTROL — a non-compliant high-risk pack produces all three violations', () => {
        expect(msgs(HONEST)).toHaveLength(3);
    });

    it('KNOWN DEFECT — a `description: |` line shadows risk_class, skipping every check', () => {
        const shadowed = yaml([
            '- id: danger-pack',
            '  label: Danger',
            '  description: |',
            '    risk_class: medium was our first guess; see ADR-013.',
            '  risk_class: high',
            '  default_install: true',
            '  requires_explicit_consent: false',
            '  surface_tier: core',
            '',
        ]);
        expect(msgs(shadowed)).toEqual([]);
    });

    it('KNOWN DEFECT — a nested mapping shadows the three compliance fields', () => {
        const nested = yaml([
            '- id: danger-pack',
            '  risk_class: high',
            '  overlays:',
            '    lab-preview:',
            '      surface_tier: lab',
            '      default_install: false',
            '      requires_explicit_consent: true',
            '  default_install: true',
            '  requires_explicit_consent: false',
            '  surface_tier: core',
            '',
        ]);
        expect(msgs(nested)).toEqual([]);
    });
});

// ── Finding 3 — lint_framework_leakage: unanchored frontmatter regex ──────────

/**
 * `FRONTMATTER_FRAMEWORK_RE = /^---\s*\n([\s\S]*?)\n---/m` carries `/m` and no
 * start-of-file guard, unlike every sibling frontmatter parser in the suite
 * (`lint_namespace.ts:215`, `lint_command_routing.ts:35`, …). On a file with no
 * leading frontmatter it latches onto the first `---`-delimited body span. A
 * non-null return makes `main()` `continue` at line 515 — the file is exempted
 * from leakage scanning entirely.
 *
 * Producible today: `src/skills/prediction-pool-optimizer/reference/ev-fixtures.md`
 * has no leading frontmatter and eight bare `---` lines, and it is already in
 * the recursive `*.md` scan. It escapes only because none of those spans holds a
 * `framework:` line. `src/skills/command-writing/SKILL.md` shows the house
 * convention of quoting a `---`-fenced frontmatter EXAMPLE inside prose; one
 * such example carrying `framework: laravel` in a file without real frontmatter
 * is the collision.
 *
 * Repair (not applied — `lint_*` is owned elsewhere): drop `/m` and require the
 * match at index 0, matching the sibling parsers.
 */
describe('lint_framework_leakage — unanchored frontmatter regex', () => {
    it('CONTROL — real leading frontmatter is read correctly', () => {
        const p = write('real.md', '---\nname: x\nframework: laravel\n---\n\n# Doc\n');
        expect(has_framework_frontmatter(p)).toBe('laravel');
    });

    it('CONTROL — a body divider with no framework key does not exempt', () => {
        const p = write('divider.md', '# Reference doc\n\nProse.\n\n---\n\n## Fixture 1\n\nmore\n');
        expect(has_framework_frontmatter(p)).toBeNull();
    });

    it('REPAIRED — a quoted frontmatter EXAMPLE in the body no longer exempts the file', () => {
        const p = write(
            'example-in-body.md',
            [
                '# Reference doc',
                '',
                'Minimum frontmatter for a carve-out skill:',
                '',
                '---',
                'name: example-skill',
                'framework: laravel',
                '---',
                '',
                'The block above is an example, not this file’s frontmatter.',
                '',
            ].join('\n'),
        );
        // Was `'laravel'` before the repair: the unanchored `/m` regex latched
        // onto the body's `---` span, and a non-null return makes the caller
        // `continue`, exempting the file from leakage scanning entirely.
        // Anchoring at index 0 closes it.
        expect(has_framework_frontmatter(p)).toBeNull();
    });
});

// ── Finding 4 — lint_override_kernel_guard: first `**Mode:**` line wins ───────

/**
 * `parse_mode` is a non-global `/im` exec over the WHOLE override file, so the
 * first `**Mode:** \`extend|replace\`` line anywhere wins — including one shown
 * as an illustration. The convention is real: the override contract doc itself
 * carries two `**Mode:**` example lines in one file
 * (`src/agent-src/contexts/override-system.md:105,130`).
 *
 * The false-negative direction is the serious one: `classify_violations` raises
 * "`replace` on a kernel rule — this class may be tightened, never replaced"
 * only when `mode === 'replace'`. An override that really does replace a
 * kernel / safety-floor rule passes the guard when any earlier line in the file
 * reads `**Mode:** \`extend\``. That is a safety-floor guard reporting clean on
 * text it never read.
 *
 * REPAIRED 2026-08-02: `parse_mode` reads EVERY `**Mode:**` line and resolves
 * disagreement to `unknown` — fail closed. The cases below now pin the fix and
 * read `REPAIRED` where they read `KNOWN DEFECT`; that flip is the close signal
 * this file was built to produce.
 */
describe('lint_override_kernel_guard — first `**Mode:**` line wins', () => {
    const md = (lines: readonly string[]): string => lines.join('\n');

    it('CONTROL — a lone header is read correctly in both modes', () => {
        expect(parse_mode(md(['# Override', '', '**Mode:** `extend`', '']))).toBe('extend');
        expect(parse_mode(md(['# Override', '', '**Mode:** `replace`', '']))).toBe('replace');
    });

    it('REPAIRED — an illustrative line no longer shadows the operative header', () => {
        const shadowed = md([
            '# Override: Rule — verify-before-complete',
            '',
            'Do not write it like this:',
            '',
            '**Mode:** `replace`',
            '',
            'That form is refused for kernel rules; the real header follows.',
            '',
            '**Mode:** `extend`',
            '**Original:** `.augment/rules/verify-before-complete.md`',
            '',
        ]);
        // Was `'replace'` — the first `**Mode:**` line anywhere won. Disagreeing
        // declarations now resolve to `unknown`, which the caller already treats
        // as a violation: fail closed rather than pick one.
        expect(parse_mode(shadowed)).toBe('unknown');
    });

    it('REPAIRED — an illustrative `extend` can no longer hide a real `replace`', () => {
        const hidden = md([
            '# Override: Rule — verify-before-complete',
            '',
            'For a non-kernel rule the safe form is:',
            '',
            '**Mode:** `extend`',
            '',
            'But this override actually replaces it:',
            '',
            '**Mode:** `replace`',
            '',
        ]);
        // The serious direction. Was `'extend'` — a safety-floor guard reporting
        // clean on a file that really does declare `replace`.
        expect(parse_mode(hidden)).not.toBe('extend');
        expect(parse_mode(hidden)).toBe('unknown');
    });
});

// ── Finding 5 — check_proposal: first `## 7. Success signal` wins ─────────────

/**
 * `_checkSuccessSignal` locates the section with a non-global
 * `/^##\s+7\.\s+Success signal\b([\s\S]+?)(?=^##\s)/m` and does not skip fenced
 * blocks. The proposal template's Section 4 instructs the author to paste "the
 * full body of the draft rule / skill / command / guideline" into a ```markdown
 * fence (`src/agent-src/templates/agents/proposal.example.md:83-88`) — so a
 * proposal whose draft artefact is itself about proposal writing legitimately
 * contains an example `## 7. Success signal` ahead of the real one.
 *
 * The gate then validates the example and passes a proposal whose real Section 7
 * is incomplete.
 *
 * Repair (not applied — a consistent fix has to strip fenced blocks for
 * `REQUIRED_SECTIONS`, `_checkSuccessSignal` and `_checkOriginatingProject`
 * alike, which is more than a bounded edit and changes outcomes on valid input):
 * strip fenced spans before section matching, as `check_claims.ts:208-219`
 * already does for its own markers.
 */
describe('check_proposal — first `## 7. Success signal` wins over a fenced example', () => {
    const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
    const TSX = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
    const GATE = path.join(REPO_ROOT, 'src', 'scripts', 'check_proposal.ts');

    /** `section: "success-signal"` messages the gate emits for a fixture. */
    function successSignalFindings(body: string): string[] {
        const p = write('proposal.md', body);
        const res = spawnSync(TSX, [GATE, p, '--format', 'json'], { encoding: 'utf-8', cwd: REPO_ROOT });
        const parsed = JSON.parse(res.stdout) as { findings: Array<{ section: string; message: string }> };
        return parsed.findings.filter((f) => f.section === 'success-signal').map((f) => f.message);
    }

    /** A minimal ten-section proposal whose REAL Section 7 is incomplete. */
    function proposal(draftBody: string): string {
        return [
            '---',
            'proposal_id: proposal-writing-guideline',
            'type: guideline',
            'scope: package',
            'stage: proposed',
            'source_learning: agents/learnings/2026-08-01-proposals.md',
            'target_artifact: dist/agent-src/guidelines/proposal-writing.md',
            'author: maintainer',
            'created: 2026-08-01',
            'last_updated: 2026-08-01',
            'workspaces:',
            '  - agent-config-maintainer',
            'packs:',
            '  - meta',
            'lifecycle: active',
            'trust:',
            '  level: core',
            '  confidence: high',
            '  human_review_required: false',
            'install:',
            '  default: true',
            '  removable: false',
            'evidence:',
            '  - kind: pr',
            '    ref: https://github.com/example/repo/pull/1',
            '    summary: One.',
            '  - kind: incident',
            '    ref: https://github.com/example/repo/issues/2',
            '    summary: Two.',
            '---',
            '',
            '# Proposal: proposal-writing guideline',
            '',
            '## 1. Learning',
            '',
            'Authors omit the success metric.',
            '',
            '## 2. Classification',
            '',
            '- **Scope:** [x] upstream',
            '- **Type:** [x] guideline',
            '',
            '## 3. Evidence',
            '',
            'Two independent references are listed in the frontmatter.',
            '',
            '## 4. Proposed artefact',
            '',
            draftBody,
            '## 5. Quality gate expectations',
            '',
            '- [ ] Passes the linter',
            '',
            '## 6. Replacement justification (if applicable)',
            '',
            'N/A',
            '',
            '## 7. Success signal',
            '',
            '- **Metric:** proposals missing a metric per quarter',
            '- **Target:** zero',
            '',
            '## 8. Risks and alternatives rejected',
            '',
            '- **Risks:** none material',
            '',
            '## 9. Gate verdict (filled by gate, not author)',
            '',
            '- **Verdict:** [ ] pass',
            '',
            '## 10. Upstream PR (filled on stage transition)',
            '',
            '- **PR URL**: pending',
            '',
        ].join('\n');
    }

    const PLAIN_DRAFT = ['```markdown', '# Proposal writing', '', 'Fill every numbered section in order.', '```', ''].join('\n');

    const DRAFT_QUOTING_SECTION_7 = [
        '```markdown',
        '# Proposal writing',
        '',
        'Every proposal ends with a complete success signal, like this:',
        '',
        '## 7. Success signal',
        '',
        '- **Metric:** reviewer comments per month',
        '- **Baseline:** 4',
        '- **Target:** < 1',
        '- **Evaluation date:** 2026-11-01',
        '```',
        '',
    ].join('\n');

    it('CONTROL — the incomplete real Section 7 is caught when nothing shadows it', () => {
        expect(successSignalFindings(proposal(PLAIN_DRAFT)).sort()).toEqual([
            "missing 'Baseline:' entry",
            "missing 'Evaluation date:' entry",
        ]);
    });

    it('KNOWN DEFECT — a complete example inside the Section 4 fence passes the proposal', () => {
        // Same incomplete real Section 7 as the control; only the Section 4
        // draft body differs, so the difference isolates the shadowing.
        expect(successSignalFindings(proposal(DRAFT_QUOTING_SECTION_7))).toEqual([]);
    });
});
