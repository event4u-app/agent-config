#!/usr/bin/env node
/**
 * One-shot migration: inject the `suggestion:` frontmatter block into every
 * command under `.agent-src.uncondensed/commands/`.
 *
 * TypeScript twin of `src/scripts/migrate_command_suggestions.py` (ADR-090 —
 * Python→TS migration, Phase 8 / Wave 8e). Faithful twin: the legacy
 * `.agent-src.uncondensed/commands/` path is part of the original module's
 * contract and is reproduced verbatim. Public surface mirrors the Python module
 * exactly: same stdout summary line, same stderr WARNING, same exit codes
 * (0 / 1), and byte-identical rewritten files.
 *
 * Source-of-truth table: `agents/settings/contexts/command-suggestion-eligibility.md`
 * (locked at end of road-to-context-aware-command-suggestion Phase 1).
 *
 * Idempotent: if `suggestion:` is already present for a command, the file is
 * left untouched. Re-runnable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/migrate_command_suggestions.ts → parents[2] is the package root
// (mirrors the Python module's parent.parent.parent resolution).
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const DEFAULT_COMMANDS_DIR = path.join(ROOT, '.agent-src.uncondensed', 'commands');

/** Test seam: the Python `COMMANDS_DIR` global is reassignable in tests. */
let _COMMANDS_DIR = DEFAULT_COMMANDS_DIR;
export function _setCommandsDirForTest(dir: string): void {
    _COMMANDS_DIR = dir;
}
export function _getCommandsDirForTest(): string {
    return _COMMANDS_DIR;
}

export const INELIGIBLE: Record<string, string> = {
    'agent-handoff': 'Explicit fresh-chat handoff — must be deliberate, never inferred from prose.',
    'agent-status': 'Pure status display; no natural-language trigger distinct from idle small-talk.',
    'agents-cleanup': 'Consumes prior audit output; only meaningful right after /agents-audit.',
    'agents-prepare': 'One-shot project scaffolding; only run during initial setup.',
    'chat-history': "Status display only; no NL trigger distinct from 'show status'.",
    'chat-history-clear': 'Destructive log wipe — must be deliberate.',
    'chat-history-resume': 'Explicit resume mechanic with foreign/returning state machine.',
    condense: 'Package-internal tooling; only the event4u/agent-config repo runs this.',
    'copilot-agents-init': 'Project init — only deliberately during onboarding.',
    'copilot-agents-optimize': 'Maintenance refactor; only when the maintainer chooses to run it.',
    'do-and-judge': 'Subagent orchestration — overlaps /work and judge skills; keep explicit.',
    'do-in-steps': 'Subagent orchestration — overlaps /work and /roadmap:process-*; keep explicit.',
    'fix-portability': 'Package-internal — only the event4u/agent-config repo runs this.',
    'fix-references': 'Package-internal — only the event4u/agent-config repo runs this.',
    judge: 'Sibling of /review-changes — eligibility routed there; keep this explicit.',
    'memory-full': "Description states 'never auto-triggered' — opt-in deep-load only.",
    'memory-promote': 'Curation pipeline — overlaps /memory-add; keep explicit.',
    mode: 'Role-mode switch is a deliberate context change.',
    onboard: 'Gated by the onboarding-gate rule already; never inferred from prose.',
    'optimize-augmentignore': 'Niche maintenance tool with no recurring NL trigger.',
    'optimize-rtk-filters': 'Niche maintenance tool with no recurring NL trigger.',
    'package-reset': 'Package-internal destructive reset.',
    'package-test': 'Package-internal — only the event4u/agent-config repo runs this.',
    'propose-memory': 'Programmatic intake fallback — overlaps /memory-add; keep explicit.',
    'set-cost-profile': 'Settings mutation — must be deliberate.',
    'sync-agent-settings': 'Settings sync — must be deliberate.',
    'sync-gitignore': 'Settings sync — must be deliberate.',
};

// (trigger_description, trigger_context)
export const ELIGIBLE: Record<string, [string, string]> = {
    'agents-audit': [
        'audit my agent docs, check the state of the agents/ directory',
        'stale files under agents/ or recent edits to .augment/ without doc updates',
    ],
    'analyze-reference-repo': [
        "look at how X does this, compare with that other repo, study this competitor's approach",
        'external repo URL or path mentioned in the prompt',
    ],
    'bug-fix': ['fix this bug, patch the issue, resolve this error', 'branch name matches fix/* or bug/*'],
    'bug-investigate': [
        'why is this broken, investigate this error, trace the root cause',
        'Sentry URL, Jira bug ticket key, or stack trace pasted in the prompt',
    ],
    commit: [
        'commit my changes, save this to git, create commits for these changes',
        'git status shows uncommitted changes',
    ],
    'commit-in-chunks': [
        'commit everything autonomously, split and commit without confirmation',
        'autonomous mode active and uncommitted changes present',
    ],
    'context-create': [
        'document this part of the codebase, create a context doc for X',
        'working in a module without an agents/settings/contexts/ doc',
    ],
    'context-refactor': [
        'update the context doc, refresh this context document',
        'existing agents/settings/contexts/*.md referenced in the prompt',
    ],
    'create-pr': [
        'open a PR, create a pull request, make a PR for this branch',
        'branch is ahead of base and not yet on a PR',
    ],
    'create-pr-description': [
        'write a PR description, draft the PR text',
        'PR exists or branch ready for review without description',
    ],
    'e2e-heal': [
        'fix the failing E2E tests, playwright tests are red',
        'failing test output from tests/e2e/',
    ],
    'e2e-plan': [
        'plan E2E tests for this feature, what should we cover in playwright',
        'new feature or page added without tests/e2e/ coverage',
    ],
    'estimate-ticket': [
        'how big is this ticket, estimate PROJ-123, should we split this',
        'ticket key matching [A-Z]+-[0-9]+ in the prompt and no plan yet',
    ],
    'feature-dev': [
        'build this feature end-to-end, run the full feature workflow',
        'long-form feature description spanning multiple components',
    ],
    'feature-explore': [
        'brainstorm this idea, explore this feature concept',
        'open-ended feature idea without acceptance criteria',
    ],
    'feature-plan': [
        'plan this feature, create a feature spec for X',
        'feature idea referenced and no plan doc exists',
    ],
    'feature-refactor': [
        'update the feature plan, refine the feature spec',
        'existing agents/features/*.md referenced in the prompt',
    ],
    'feature-roadmap': [
        'turn this feature into a roadmap, generate the implementation roadmap',
        'existing feature plan without linked roadmap',
    ],
    'fix-ci': [
        'CI is failing, fix the GitHub Actions errors, the pipeline is red',
        'open PR with failing checks',
    ],
    'fix-pr-bot-comments': [
        'address the Copilot/Greptile comments, fix the bot review feedback',
        'open PR with bot review comments unresolved',
    ],
    'fix-pr-comments': [
        'fix all PR review comments, resolve the review feedback',
        'open PR with unresolved comments (bot + human)',
    ],
    'fix-pr-developer-comments': [
        'fix the human reviewer comments, address the developer feedback',
        'open PR with unresolved human-reviewer comments',
    ],
    'fix-seeder': [
        'the seeder is broken, foreign key errors in seeders',
        'seeder error output or recent edits in database/seeders/',
    ],
    'implement-ticket': [
        'implement this ticket, setze ticket X um, build PROJ-123',
        'ticket key matching [A-Z]+-[0-9]+ in branch name or prompt',
    ],
    'jira-ticket': [
        'implement the ticket on this branch, work on the Jira ticket from the branch',
        'branch name matching feat/PROJ-123-* or similar',
    ],
    'memory-add': [
        'remember this for later, add this to engineering memory, capture this learning',
        'post-incident or post-decision conversation',
    ],
    'module-create': [
        'create a new module, scaffold a module for X',
        'prompt mentions a new domain area without an existing module',
    ],
    'module-explore': [
        'show me the X module, load the module context',
        'existing Modules/<Name>/ referenced in the prompt',
    ],
    'optimize-agents': ['audit agent infrastructure, tune the agent setup', 'maintainer working on .augment/ files'],
    'optimize-skills': ['audit my skills, find duplicate skills', 'maintainer working on .augment/skills/ files'],
    'override-create': [
        'override this skill for the project, customize this rule locally',
        'prompt names a shared skill/rule needing project-specific behavior',
    ],
    'override-manage': ['review my overrides, update the project overrides', 'existing entries under agents/overrides/'],
    'prepare-for-review': [
        'get this branch ready for review, rebase and prep for PR',
        'branch behind base or part of a PR chain',
    ],
    'project-analyze': ['analyze the project structure, do a full project audit', 'new project or after a major refactor'],
    'project-health': [
        "check project health, what's the state of my docs and modules",
        'routine health check, no destructive intent',
    ],
    'quality-fix': [
        'fix the quality errors, run PHPStan and fix issues, fix code style',
        'PHPStan/Rector/ECS output in recent tool results',
    ],
    'refine-ticket': [
        'refine PROJ-123, tighten the acceptance criteria, is this ticket clear',
        'ticket key in prompt with vague acceptance criteria',
    ],
    'review-changes': ['self-review my changes, judge this diff before PR', 'uncommitted or staged changes pre-PR'],
    'review-routing': ['who should review this, suggest reviewers for this PR', 'PR open without assigned reviewers'],
    'roadmap-create': [
        'create a roadmap for X, plan this work as a roadmap',
        'multi-phase work without an existing agents/roadmaps/*.md',
    ],
    'roadmap-execute': [
        'process the roadmap, work through the roadmap autonomously, finish this phase',
        'existing agents/roadmaps/*.md referenced in the prompt',
    ],
    'rule-compliance-audit': ['audit my rules, check rule trigger quality', 'maintainer working on .augment/rules/ files'],
    'tests-create': [
        'write tests for these changes, add tests for this branch',
        'code changes on the branch without matching test changes',
    ],
    'tests-execute': ['run the tests, execute the test suite', 'code changes pending verification'],
    'threat-model': [
        'threat model this change, what could go wrong security-wise',
        'changes touching auth, webhooks, uploads, secrets, or public endpoints',
    ],
    'update-form-request-messages': [
        'sync the form request messages, update the validation messages',
        'edits to app/Http/Requests/*.php referencing rules without messages',
    ],
    'upstream-contribute': [
        'contribute this back to agent-config, upstream this learning',
        'project-local skill/rule that fits the shared package',
    ],
    work: ['build this, implement this, drive this end-to-end', 'free-form prompt without a ticket key'],
};

// Python: re.compile(r"^(---\n)(.*?)(\n---\n)", re.DOTALL)
const FRONTMATTER_RE = /^(---\n)([\s\S]*?)(\n---\n)/;

export function build_block(name: string): string {
    if (name in INELIGIBLE) {
        const rationale = INELIGIBLE[name]!.replace(/"/g, '\\"');
        return `suggestion:\n  eligible: false\n  rationale: "${rationale}"`;
    }
    if (name in ELIGIBLE) {
        const [td, tc] = ELIGIBLE[name]!;
        const tdE = td.replace(/"/g, '\\"');
        const tcE = tc.replace(/"/g, '\\"');
        return (
            `suggestion:\n  eligible: true\n` +
            `  trigger_description: "${tdE}"\n` +
            `  trigger_context: "${tcE}"`
        );
    }
    // Python `raise SystemExit(f"command not classified: {name}")` →
    // print message to stderr and exit 1.
    process.stderr.write(`command not classified: ${name}\n`);
    process.exit(1);
}

type MigrateStatus = 'ok' | 'skip' | 'no-frontmatter';

export function migrate_one(p: string): MigrateStatus {
    const name = path.basename(p, '.md');
    const text = fs.readFileSync(p, 'utf-8');
    // Python: text.split("\n---\n", 1)[0] — frontmatter region before the first
    // closing fence; check it for a `\nsuggestion:` line.
    const head = _splitFirst(text, '\n---\n');
    if (head.includes('\nsuggestion:')) {
        return 'skip';
    }
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        return 'no-frontmatter';
    }
    const body = m[2]!;
    const block = build_block(name);
    const newBody = _rstrip(body) + '\n' + block;
    const matchStart = m.index;
    const matchEnd = m.index + m[0].length;
    const newText = text.slice(0, matchStart) + m[1]! + newBody + m[3]! + text.slice(matchEnd);
    fs.writeFileSync(p, newText, 'utf-8');
    return 'ok';
}

/** Python `s.split(sep, 1)[0]` — text before the first occurrence (or all). */
function _splitFirst(s: string, sep: string): string {
    const i = s.indexOf(sep);
    return i === -1 ? s : s.slice(0, i);
}

/** Python `str.rstrip()` — strip trailing whitespace. */
function _rstrip(s: string): string {
    return s.replace(/\s+$/u, '');
}

function _globMdSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const n of names) {
        if (n.endsWith('.md')) {
            const full = path.join(dir, n);
            if (fs.statSync(full).isFile()) {
                out.push(full);
            }
        }
    }
    // Python `Path.glob` results passed through `sorted()` → lexical by full path.
    out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return out;
}

export function main(): number {
    const files = _globMdSorted(_COMMANDS_DIR);
    const counts: Record<MigrateStatus, number> = { ok: 0, skip: 0, 'no-frontmatter': 0 };
    for (const f of files) {
        const status = migrate_one(f);
        counts[status] += 1;
    }
    process.stdout.write(
        `migrated ${counts['ok']}, skipped ${counts['skip']}, ` +
            `no-frontmatter ${counts['no-frontmatter']}, total ${files.length}\n`,
    );
    const expected = Object.keys(INELIGIBLE).length + Object.keys(ELIGIBLE).length;
    if (files.length !== expected) {
        process.stderr.write(`WARNING: file count ${files.length} != table count ${expected}\n`);
        return 1;
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry) {
    process.exit(main());
}
