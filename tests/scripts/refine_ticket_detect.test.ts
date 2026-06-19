// Tests for src/scripts/refine_ticket_detect.ts (py2ts Phase 8 / Wave 8g).
//
// Ports tests/test_refine_ticket_detect.py 1:1 (detection-map load, sub-skill
// matching, repo-aware mode, F1 alignment, F2 word-boundary matching, F3
// alt-signals, F4 parent folding, F6 close-prompt). Repo-aware tests run
// against the REAL repo; git-backed tests build throwaway repos under tmp.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
    Decision,
    SubSkillDecision} from '../../src/scripts/refine_ticket_detect.js';
import {
    CLOSE_PROMPT_FULL,
    CLOSE_PROMPT_READ_ONLY,
    detect,
    fold_parent_context,
    gather_repo_context,
    issuetype_needs_parent,
    load_map,
    render_close_prompt,
    _evaluate_alt_signals,
    _extract_ac_first_words,
    _extract_description_body,
    _extract_ticket_project_key,
    _gather_repo_identifiers,
    _match_project,
    _split_sentences,
} from '../../src/scripts/refine_ticket_detect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'refine_ticket');

function _loadFixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, `${name}.md`), 'utf-8');
}

const detectionMap = load_map();

function _get(decision: Decision, skill: string): SubSkillDecision {
    for (const ss of decision.sub_skills) {
        if (ss.skill === skill) {
            return ss;
        }
    }
    throw new Error(`sub-skill '${skill}' missing from decision`);
}

function _gitAvailable(): boolean {
    return spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
}
const git = _gitAvailable();

// `gather_repo_context` only collects when `<root>/.git` is a *directory*
// (Python `(cwd / ".git").is_dir()`). In a git worktree checkout `.git` is a
// gitdir-pointer FILE, so context gathering legitimately returns empty — the
// same as the Python original. The repo-context-populated assertions below
// therefore only hold in a normal clone; gate them on that precondition.
function _dotGitIsDir(p: string): boolean {
    try {
        return fs.statSync(path.join(p, '.git')).isDirectory();
    } catch {
        return false;
    }
}
const repoGitDir = _dotGitIsDir(REPO_ROOT);

const GIT_ENV = {
    ...process.env,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
};

function _initGitRepo(p: string): void {
    spawnSync('git', ['init', '-q'], { cwd: p });
    spawnSync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: p, env: GIT_ENV });
}

let tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs) {
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    }
    tmpDirs = [];
});

describe('refine_ticket_detect — ported pytest suite', () => {
    it('detection map has both sub-skills', () => {
        expect(detectionMap['version']).toBe(1);
        expect(detectionMap['sub_skills']).toHaveProperty('validate-feature-fit');
        expect(detectionMap['sub_skills']).toHaveProperty('threat-modeling');
    });

    it('clean ticket fires nothing', () => {
        const decision = detect(_loadFixture('clean'), detectionMap);
        expect(_get(decision, 'validate-feature-fit').fired).toBe(false);
        expect(_get(decision, 'threat-modeling').fired).toBe(false);
    });

    it('duplicate-intent fires validate-feature-fit', () => {
        const decision = detect(_loadFixture('duplicate_intent'), detectionMap);
        const vff = _get(decision, 'validate-feature-fit');
        expect(vff.fired).toBe(true);
        expect(vff.matched_keywords.length).toBeGreaterThanOrEqual(vff.require_count);
        expect(vff.matched_keywords).toContain('notifications');
        expect(vff.matched_keywords).toContain('reporting');
    });

    it('security-sensitive fires threat-modeling', () => {
        const decision = detect(_loadFixture('security_sensitive'), detectionMap);
        const tm = _get(decision, 'threat-modeling');
        expect(tm.fired).toBe(true);
        expect(tm.matched_keywords).toContain('webhook');
        expect(
            tm.matched_keywords.includes('secret') || tm.matched_keywords.includes('api key'),
        ).toBe(true);
        expect(tm.matched_keywords).toContain('tenant');
    });

    it('security-sensitive matches CVE regex', () => {
        const decision = detect(_loadFixture('security_sensitive'), detectionMap);
        const tm = _get(decision, 'threat-modeling');
        expect(tm.matched_regex.some((rx) => rx.includes('CVE'))).toBe(true);
    });

    it('orchestration-notes format', () => {
        const notes = detect(_loadFixture('duplicate_intent'), detectionMap).orchestration_notes();
        expect(notes.length).toBe(3);
        expect(notes.some((n) => n.startsWith('`validate-feature-fit`'))).toBe(true);
        expect(notes.some((n) => n.startsWith('`threat-modeling`'))).toBe(true);
        expect(notes.some((n) => n.startsWith('Repo-aware'))).toBe(true);
    });

    it('orchestration-notes visible in output', () => {
        const decision = detect(_loadFixture('security_sensitive'), detectionMap);
        const tm = _get(decision, 'threat-modeling');
        expect(tm.as_output_line()).toContain('fired on:');
        expect(tm.matched_keywords).toContain('webhook');

        const cleanDecision = detect(_loadFixture('clean'), detectionMap);
        expect(_get(cleanDecision, 'validate-feature-fit').as_output_line()).toContain('skipped');
    });

    it('repo-aware detects this repo', () => {
        const decision = detect(_loadFixture('clean'), detectionMap, REPO_ROOT);
        expect(decision.repo_aware).toBe(true);
    });

    it('repo-aware off outside repo', () => {
        const decision = detect(_loadFixture('clean'), detectionMap, mkTmp());
        expect(decision.repo_aware).toBe(false);
    });

    // ---- Phase 3 — repo-aware mode -----------------------------------------

    it('gather_repo_context outside repo', () => {
        const ctx = gather_repo_context(mkTmp());
        expect(ctx.is_empty()).toBe(true);
        expect(ctx.summary_line()).toBe('Repo context — none gathered');
    });

    it.skipIf(!git || !repoGitDir)('gather_repo_context inside this repo', () => {
        const ctx = gather_repo_context(REPO_ROOT);
        expect(ctx.is_empty()).toBe(false);
        expect(ctx.recent_commits.length).toBeGreaterThan(0);
    });

    it.skipIf(!git)('gather_repo_context finds context docs', () => {
        const tmp = mkTmp();
        _initGitRepo(tmp);
        const contexts = path.join(tmp, 'agents', 'contexts');
        fs.mkdirSync(contexts, { recursive: true });
        fs.writeFileSync(path.join(contexts, 'auth-model.md'), '# auth');
        fs.writeFileSync(path.join(contexts, 'tenant-boundaries.md'), '# tenancy');
        const ctx = gather_repo_context(tmp);
        expect(new Set(ctx.context_docs)).toEqual(
            new Set(['auth-model.md', 'tenant-boundaries.md']),
        );
    });

    it.skipIf(!repoGitDir)('detect populates repo context when repo-aware', () => {
        const decision = detect(_loadFixture('clean'), detectionMap, REPO_ROOT);
        expect(decision.repo_aware).toBe(true);
        expect(decision.repo_context.is_empty()).toBe(false);
    });

    it('detect repo context empty outside repo', () => {
        const decision = detect(_loadFixture('clean'), detectionMap, mkTmp());
        expect(decision.repo_aware).toBe(false);
        expect(decision.repo_context.is_empty()).toBe(true);
    });

    it.skipIf(!repoGitDir)('orchestration-notes include repo context when on', () => {
        const notes = detect(_loadFixture('clean'), detectionMap, REPO_ROOT).orchestration_notes();
        expect(notes.some((n) => n.startsWith('Repo context — '))).toBe(true);
        expect(notes.some((n) => n.includes('branches') && n.includes('commits'))).toBe(true);
    });

    it('orchestration-notes omit repo context when off', () => {
        const notes = detect(_loadFixture('clean'), detectionMap, mkTmp()).orchestration_notes();
        expect(notes.some((n) => n.includes('Repo-aware — off'))).toBe(true);
        expect(notes.some((n) => n.startsWith('Repo context — '))).toBe(false);
    });

    it('graceful degrade output shape parity', () => {
        const inside = detect(_loadFixture('clean'), detectionMap, REPO_ROOT).orchestration_notes();
        const outside = detect(_loadFixture('clean'), detectionMap, mkTmp()).orchestration_notes();
        const insideSub = inside.filter((n) => n.startsWith('`'));
        const outsideSub = outside.filter((n) => n.startsWith('`'));
        expect(insideSub).toEqual(outsideSub);
    });

    // ---- Phase F2 — word-boundary keyword matching -------------------------

    it('1Password does not fire password keyword', () => {
        const body =
            '## Ticket\n\n' +
            'Users asked us to document the 1Password rollout.\n' +
            'No sign-in flow changes are planned — this is a docs-only ticket.\n';
        const tm = _get(detect(body, detectionMap), 'threat-modeling');
        expect(tm.fired).toBe(false);
    });

    it('LastPass does not fire password keyword', () => {
        const body = 'We use LastPass to store shared secrets for the team.';
        const tm = _get(detect(body, detectionMap), 'threat-modeling');
        expect(tm.matched_keywords).not.toContain('password');
    });

    it('Bitwarden does not fire password keyword', () => {
        const body = 'Document the Bitwarden browser-extension rollout for staff.';
        const tm = _get(detect(body, detectionMap), 'threat-modeling');
        expect(tm.matched_keywords).not.toContain('password');
        expect(tm.fired).toBe(false);
    });

    it('real password reset still fires', () => {
        const body = 'Implement the password reset flow with email token verification.';
        const tm = _get(detect(body, detectionMap), 'threat-modeling');
        expect(tm.fired).toBe(true);
        expect(tm.matched_keywords).toContain('password');
        expect(tm.matched_keywords).toContain('token');
    });

    it('api substring does not fire on apiary', () => {
        const body = 'Team reviewed the apiary report on rapid prototyping.\nDashboard redesign needed.\n';
        const vff = _get(detect(body, detectionMap), 'validate-feature-fit');
        expect(vff.matched_keywords).not.toContain('api');
    });

    it('api fires as standalone word', () => {
        const body = 'Expose reporting numbers through the API.\nDashboard redesign for the admin view.\n';
        const vff = _get(detect(body, detectionMap), 'validate-feature-fit');
        expect(vff.matched_keywords).toContain('api');
        expect(vff.fired).toBe(true);
    });

    it('password and 1Password in same text', () => {
        const body =
            'Reset a forgotten password from the login screen.\n' +
            'Internal teams use 1Password to store shared credentials.\n';
        const tm = _get(detect(body, detectionMap), 'threat-modeling');
        expect(tm.matched_keywords).toContain('password');
        expect(tm.matched_keywords).toContain('login');
        expect(tm.fired).toBe(true);
    });

    it('multi-word keyword matches api key', () => {
        const body = 'Rotate the stored api key before the next release.';
        const tm = _get(detect(body, detectionMap), 'threat-modeling');
        expect(tm.matched_keywords).toContain('api key');
    });

    it('hyphenated keyword matches multi-tenant', () => {
        const body = 'Verify the multi-tenant query scopes in the reporting module.';
        const tm = _get(detect(body, detectionMap), 'threat-modeling');
        expect(tm.matched_keywords).toContain('multi-tenant');
    });

    // ---- Phase F1 — repo-awareness sanity check ----------------------------

    it('extract project key from heading', () => {
        expect(_extract_ticket_project_key('# DEV-6182 — fix login flow\n\nSome body.')).toBe('DEV');
    });

    it('extract project key returns none without reference', () => {
        expect(_extract_ticket_project_key('# Fix the login flow\n\nNo ticket ID anywhere.')).toBe(
            null,
        );
    });

    it('extract project key picks most frequent', () => {
        const body = '# DEV-6182 — see also DEV-6047 and FOO-12.\nParent: DEV-6047.';
        expect(_extract_ticket_project_key(body)).toBe('DEV');
    });

    it('gather repo identifiers reads composer and package', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 'composer.json'), '{"name": "event4u/agent-config"}');
        fs.writeFileSync(path.join(tmp, 'package.json'), '{"name": "@event4u/agent-config"}');
        const lowered = _gather_repo_identifiers(tmp).map((x) => x.toLowerCase());
        expect(lowered).toContain('event4u');
        expect(lowered).toContain('agent-config');
    });

    it('gather repo identifiers survives malformed json', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 'composer.json'), 'not { valid json');
        expect(_gather_repo_identifiers(tmp)).toEqual([]);
    });

    it.skipIf(!git)('gather repo identifiers includes branch prefixes', () => {
        const tmp = mkTmp();
        _initGitRepo(tmp);
        spawnSync('git', ['checkout', '-q', '-b', 'DEV-6182-login-fix'], { cwd: tmp });
        spawnSync('git', ['checkout', '-q', '-b', 'FOO-12-other'], { cwd: tmp });
        const ids = _gather_repo_identifiers(tmp);
        expect(ids).toContain('DEV');
        expect(ids).toContain('FOO');
    });

    it('match project substring either way', () => {
        expect(_match_project('DEV', ['devtools', 'unrelated'])).toBe(true);
        expect(_match_project('EVENT4U', ['event4u'])).toBe(true);
        expect(_match_project('EVENT', ['event4u', 'agent-config'])).toBe(true);
        expect(_match_project('FOO', ['event4u', 'agent-config'])).toBe(false);
    });

    it('alignment line mismatch in orchestration notes', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 'composer.json'), '{"name": "event4u/agent-config"}');
        const decision = detect('# FOO-42 — add dashboard widget\n\nBody copy.', detectionMap, tmp);
        const notes = decision.orchestration_notes();
        expect(decision.alignment.matched).toBe(false);
        const mismatch = notes.filter((n) => n.startsWith('Repo project mismatch'));
        expect(mismatch.length).toBe(1);
        expect(mismatch[0]).toContain('`FOO`');
        expect(mismatch[0]).toContain('context may not apply');
    });

    it('alignment line match when keys align', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 'composer.json'), '{"name": "event4u/agent-config"}');
        const decision = detect('# AGENT-42 — tune refine-ticket skill\n\nBody.', detectionMap, tmp);
        expect(decision.alignment.matched).toBe(true);
        expect(decision.orchestration_notes().some((n) => n.startsWith('Repo project match'))).toBe(
            true,
        );
    });

    it('alignment absent when no ticket key', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 'composer.json'), '{"name": "event4u/agent-config"}');
        const decision = detect('# Untagged cleanup ticket\n\nNo identifiers anywhere.', detectionMap, tmp);
        expect(decision.alignment.has_data()).toBe(false);
        expect(decision.orchestration_notes().some((n) => n.includes('Repo project'))).toBe(false);
    });

    it('alignment absent when cwd is none', () => {
        const decision = detect('# DEV-6182 — fix login flow\n\nBody.', detectionMap);
        expect(decision.alignment.has_data()).toBe(false);
        expect(decision.orchestration_notes().some((n) => n.includes('Repo project'))).toBe(false);
    });

    // ---- Phase F7 — cross-repo warning independent of repo_aware -----------

    it('F7 alignment line present when repo-aware off', () => {
        const tmp = mkTmp();
        fs.writeFileSync(path.join(tmp, 'composer.json'), '{"name": "event4u/agent-config"}');
        const patched = { ...detectionMap };
        patched['repo_aware'] = { description: 'forced off', signals: [], require_count: 1 };
        const decision = detect('# FOO-42 — add dashboard widget\n\nBody.', patched, tmp);
        expect(decision.repo_aware).toBe(false);
        const notes = decision.orchestration_notes();
        expect(notes.some((n) => n.includes('Repo-aware — off'))).toBe(true);
        expect(notes.filter((n) => n.startsWith('Repo project mismatch')).length).toBe(1);
    });

    // ---- Phase F3 — validate-feature-fit alternative signals ---------------

    it('extract_description_body isolates description heading', () => {
        const body =
            '# Title\n\n## Description\n\nOne sentence. Two sentences.\n\n## Acceptance criteria\n\n- [ ] Thing\n';
        expect(_extract_description_body(body).startsWith('One sentence.')).toBe(true);
        expect(_extract_description_body(body)).not.toContain('Acceptance criteria');
    });

    it('extract_description_body falls back to whole body', () => {
        const body = 'Plain prose. Another sentence.';
        expect(_extract_description_body(body)).toBe(body);
    });

    it('split_sentences counts basic punctuation', () => {
        expect(_split_sentences('One. Two. Three.').length).toBe(3);
        expect(_split_sentences('First! Second? Third.').length).toBe(3);
        expect(_split_sentences('')).toEqual([]);
    });

    it('extract_ac_first_words picks first token per bullet', () => {
        const body =
            '## Acceptance criteria\n\n' +
            '- [ ] Investigate the retry policy\n' +
            '- [ ] Rewrite the dedup logic\n' +
            '- [ ] Add an alert\n' +
            '- [x] Completed item stays counted\n';
        expect(_extract_ac_first_words(body)).toEqual(['investigate', 'rewrite', 'add', 'completed']);
    });

    it('clean fixture stays below alt thresholds', () => {
        const vff = _get(detect(_loadFixture('clean'), detectionMap), 'validate-feature-fit');
        expect(vff.fired).toBe(false);
        expect(vff.matched_alt_signals).toEqual([]);
    });

    it('scope-creep prose fires via alt-signals', () => {
        const vff = _get(detect(_loadFixture('scope_creep_prose'), detectionMap), 'validate-feature-fit');
        expect(vff.fired).toBe(true);
        expect(vff.matched_alt_signals.length).toBeGreaterThan(0);
    });

    it('alt-signals visible in output line', () => {
        const vff = _get(detect(_loadFixture('scope_creep_prose'), detectionMap), 'validate-feature-fit');
        const line = vff.as_output_line();
        expect(line).toContain('fired on');
        expect(['body sentences', 'ac first-words'].some((tag) => line.includes(tag))).toBe(true);
    });

    it('alt-signals empty when spec omits them', () => {
        const specNoAlt = { keywords: [], require_count: 1 };
        const body = "Doesn't matter. Many. Sentences. Here.";
        expect(_evaluate_alt_signals(body, specNoAlt)).toEqual([]);
    });

    it('duplicate-intent fires via keywords not alt', () => {
        const vff = _get(detect(_loadFixture('duplicate_intent'), detectionMap), 'validate-feature-fit');
        expect(vff.fired).toBe(true);
        expect(vff.matched_alt_signals).toEqual([]);
        expect(vff.matched_keywords.length).toBeGreaterThanOrEqual(2);
    });

    // ---- Phase F4 — auto-fetch parent on Story / Sub-task ------------------

    it('issuetype_needs_parent matches story and subtask', () => {
        expect(issuetype_needs_parent('Story')).toBe(true);
        expect(issuetype_needs_parent('story')).toBe(true);
        expect(issuetype_needs_parent('Sub-task')).toBe(true);
        expect(issuetype_needs_parent('Subtask')).toBe(true);
        expect(issuetype_needs_parent('SUB-TASK')).toBe(true);
    });

    it('issuetype_needs_parent skips task bug epic', () => {
        expect(issuetype_needs_parent('Task')).toBe(false);
        expect(issuetype_needs_parent('Bug')).toBe(false);
        expect(issuetype_needs_parent('Epic')).toBe(false);
        expect(issuetype_needs_parent('')).toBe(false);
        expect(issuetype_needs_parent(null)).toBe(false);
    });

    it('fold_parent_context prepends canonical block', () => {
        const ticket = '# PROJ-2 — Story\n\n## Description\n\nChild body.\n';
        const parent = '# PROJ-1 — Epic\n\n- [ ] Parent AC line\n';
        const folded = fold_parent_context(ticket, parent, 'PROJ-1');
        expect(folded.startsWith('## Parent context — PROJ-1\n\n')).toBe(true);
        expect(folded).toContain('Parent AC line');
        expect(folded).toContain('Child body.');
        expect(folded.indexOf('## Parent context')).toBeLessThan(folded.indexOf('# PROJ-2'));
    });

    it('fold_parent_context is idempotent', () => {
        const ticket = '# PROJ-2 — Story\n\n## Description\n\nChild body.\n';
        const parent = '# PROJ-1 — Epic\n\n- [ ] Parent AC\n';
        const once = fold_parent_context(ticket, parent, 'PROJ-1');
        const twice = fold_parent_context(once, parent, 'PROJ-1');
        expect(once).toBe(twice);
        expect(twice.split('## Parent context — PROJ-1').length - 1).toBe(1);
    });

    it('fold_parent_context empty parent stays marked', () => {
        const folded = fold_parent_context('Child', '', 'PROJ-1');
        expect(folded).toContain('_(parent body empty)_');
    });

    it('fold_parent_context feeds detection', () => {
        const child = '# PROJ-2 — Story\n\n## Description\n\nStraightforward one-line child.\n';
        const parent =
            '# PROJ-1 — Epic\n\n## Description\n\n' +
            'Combine the notifications module with the reporting dashboard ' +
            'and fold in invoicing. Admin-only access.\n';
        const folded = fold_parent_context(child, parent, 'PROJ-1');
        const vff = _get(detect(folded, detectionMap), 'validate-feature-fit');
        expect(vff.fired).toBe(true);
    });

    // ---- Phase F6 — close-prompt write-permission probe --------------------

    it('render_close_prompt full when write access present', () => {
        const prompt = render_close_prompt(true);
        expect(prompt).toBe(CLOSE_PROMPT_FULL);
        expect(prompt).toContain('1. Comment on Jira');
        expect(prompt).toContain('2. Replace description');
        expect(prompt).toContain('3. Nothing');
    });

    it('render_close_prompt single option when read-only', () => {
        const prompt = render_close_prompt(false);
        expect(prompt).toBe(CLOSE_PROMPT_READ_ONLY);
        expect(prompt).toContain('Copy-paste');
        expect(prompt).not.toContain('2.');
        expect(prompt).not.toContain('3.');
    });

    it('render_close_prompt probe failure degrades to full', () => {
        expect(render_close_prompt(null)).toBe(CLOSE_PROMPT_FULL);
    });
});

// ---- Golden parity: python3 vs tsx CLI (orchestration notes) ---------------

const PY_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'refine_ticket_detect.py');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'refine_ticket_detect.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}
const py3 = hasPython3();

describe.skipIf(!py3)('refine_ticket_detect — golden parity (python3 vs tsx)', () => {
    // The CLI gathers repo context against cwd. Both run with cwd = a fresh
    // throwaway dir (no .git) so the alignment / repo-context tails are
    // deterministic and free of git timing non-determinism.
    let scratch: string;
    beforeEach(() => {
        scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'rtd-cli-'));
    });
    afterEach(() => {
        try {
            fs.rmSync(scratch, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    });

    function runPy(fixtureBody: string): ReturnType<typeof spawnSync> {
        return spawnSync('python3', [PY_SCRIPT, '-'], {
            cwd: scratch,
            input: fixtureBody,
            encoding: 'utf8',
        });
    }
    function runTs(fixtureBody: string): ReturnType<typeof spawnSync> {
        return spawnSync(TSX_BIN, [TS_SCRIPT, '-'], {
            cwd: scratch,
            input: fixtureBody,
            encoding: 'utf8',
        });
    }

    for (const name of ['clean', 'duplicate_intent', 'scope_creep_prose', 'security_sensitive']) {
        it(`${name} → identical stdout/exit (no repo context)`, () => {
            const body = _loadFixture(name);
            const p = runPy(body);
            const t = runTs(body);
            expect(t.stdout).toBe(p.stdout);
            expect(t.status).toBe(p.status);
        });
    }
});
