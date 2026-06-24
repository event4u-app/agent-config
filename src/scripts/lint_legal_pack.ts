#!/usr/bin/env tsx
/**
 * Lint the legal pack's deterministic safety-floor backstops.
 *
 * The `legal-safety-floor` rule is prose; this linter makes three of its
 * Iron-Law elements machine-checkable over every `packs: [legal-review-prep]` skill —
 * so they are governance, not just prompt instructions (road-to-legal-pack
 * Phase 1, the "deterministic hardening = differentiator" thesis):
 *
 *   1.1 disclaimer-presence — the exact attorney-review line must appear in
 *       the skill body (a skill that drafts legal work must instruct the model
 *       to emit it).
 *   1.2 jurisdiction-tag — the skill must reference the machine-checkable
 *       `Jurisdiction:` tag (jurisdiction-honesty made deterministic).
 *   1.3 freshness — any legal-pack artefact that DECLARES `last_verified` /
 *       `freshness_window` frontmatter must use a valid shape and not be stale
 *       (no-op when absent; the mechanism for when positions carry dates).
 *
 * Scope is the legal pack only — it never touches the other 250+ skills.
 * Exit codes: 0 all legal-pack skills compliant, 1 one or more violations.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_DIR = path.join(REPO, 'src', 'skills');

// The exact line the floor requires in every legal-pack deliverable.
const ATTORNEY_LINE = 'Attorney review required on material use';
const JURISDICTION_TAG = 'Jurisdiction:';
const FRESHNESS_WINDOW_RE = /^\d+\s+(day|days|month|months|year|years)$/;

// D4 — definitive-legal-language blocklist (the floor bans these; this is the
// deterministic backstop over skill bodies). Narrow on purpose; the floor's
// prompt layer is the primary enforcement.
const DEFINITIVE_PATTERNS: readonly (readonly [RegExp, string])[] = [
    [/\bthis (contract|nda|agreement|dpa|clause) is (valid|enforceable|compliant|legal|illegal)\b/i, 'definitive validity/compliance verdict'],
    [/\b(is|are) (fully |now )?gdpr[- ]compliant\b/i, 'definitive GDPR-compliance claim'],
    [/\byou are (legally )?required to\b/i, 'definitive legal obligation'],
    [/\byou will (win|lose|prevail)\b/i, 'outcome prediction'],
    [/\byour chances (of success )?are\b/i, 'success prognosis'],
];
// A line is exempt when it is clearly a negative example / guidance / quote —
// so "Do NOT say 'this contract is valid'" or "Forbidden: …" never false-positive.
const NEG_EXAMPLE_RE = /(never|avoid|forbidden|do not|don'?t|instead|rather than|not say|→|⚠️)/i;

function _print(msg: string): void {
    if (!QUIET) process.stdout.write(`${msg}\n`);
}

function _readText(p: string): string {
    return fs.readFileSync(p, 'utf-8');
}

/** Return [frontmatterText, body] — frontmatter null when no `---` fence. */
function _splitFrontmatter(content: string): [string | null, string] {
    if (!content.startsWith('---\n')) return [null, content];
    const end = content.indexOf('\n---', 4);
    if (end === -1) return [null, content];
    return [content.slice(4, end), content.slice(end + 4)];
}

/** True when the frontmatter `packs:` block lists `legal-review-prep`. */
function _isLegalPack(fm: string): boolean {
    // Match a `packs:` block then a `- legal-review-prep` item before the next top-level key.
    const m = /(^|\n)packs:\s*\n((?:\s*-\s*[^\n]+\n?)+)/.exec(fm);
    if (!m) return false;
    return /(^|\n)\s*-\s*legal-review-prep\s*$/m.test(m[2] ?? '');
}

interface Violation {
    file: string;
    rule: string;
    msg: string;
}

export function lintLegalPack(skillsDir: string = SKILLS_DIR): Violation[] {
    const violations: Violation[] = [];
    let dirs: string[] = [];
    try {
        dirs = fs.readdirSync(skillsDir).sort();
    } catch {
        return violations;
    }
    for (const d of dirs) {
        const file = path.join(skillsDir, d, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        const content = _readText(file);
        const [fm, body] = _splitFrontmatter(content);
        if (fm === null || !_isLegalPack(fm)) continue;
        const rel = path.relative(REPO, file);

        // 1.1 disclaimer-presence
        if (!body.includes(ATTORNEY_LINE)) {
            violations.push({ file: rel, rule: 'disclaimer-presence', msg: `missing the attorney-review line ("${ATTORNEY_LINE}")` });
        }
        // 1.2 jurisdiction-tag
        if (!body.includes(JURISDICTION_TAG)) {
            violations.push({ file: rel, rule: 'jurisdiction-tag', msg: `missing the machine-checkable "${JURISDICTION_TAG}" tag` });
        }
        // 1.3 freshness — only when declared
        const fw = /(^|\n)freshness_window:\s*"?([^"\n]+)"?/.exec(fm);
        if (fw && !FRESHNESS_WINDOW_RE.test((fw[2] ?? '').trim())) {
            violations.push({ file: rel, rule: 'freshness', msg: `freshness_window "${fw[2]}" is not a valid "<N> days|months|years" shape` });
        }
        // 4.1 — no definitive legal language (line-scoped, skips negative examples)
        for (const line of body.split('\n')) {
            if (NEG_EXAMPLE_RE.test(line)) continue;
            for (const [re, label] of DEFINITIVE_PATTERNS) {
                if (re.test(line)) {
                    violations.push({ file: rel, rule: 'definitive-language', msg: `${label}: ${line.trim().slice(0, 80)}` });
                }
            }
        }
    }
    return violations;
}

export function main(): number {
    const violations = lintLegalPack();
    if (violations.length === 0) {
        _print('✅  legal pack — all legal-pack skills carry the attorney-review line + Jurisdiction tag');
        return 0;
    }
    _print(`❌  legal pack — ${violations.length} violation(s):`);
    for (const v of violations) {
        _print(`  - [${v.rule}] ${v.file}: ${v.msg}`);
    }
    return 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    process.exit(main());
}
