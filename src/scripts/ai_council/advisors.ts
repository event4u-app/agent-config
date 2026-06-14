/**
 * Thinking-style advisors — replace-mode call planning (Phase 6).
 *
 * TypeScript twin of `src/scripts/ai_council/advisors.py` (ADR-094 —
 * Python→TS migration, Phase 1). When `agents/settings/.ai-council.yml`
 * enables an advisor (e.g. `contrarian` bound to `member: anthropic`), the
 * orchestrator REPLACES the matching plain-member call with an
 * advisor-persona call on the same provider. Same total call count as a
 * plain run; bounded extra cost beyond the persona-prompt token delta.
 *
 * This module owns:
 *
 * - `AdvisorPlan`  — resolved swap for a single provider (persona text,
 *   display name, optional model override).
 * - `plan_advisor_swap()` — walks the enabled advisors, reads their
 *   persona files, and returns the per-provider plan map consumed by
 *   `orchestrator.consult()` / `estimate()` and by the CLI.
 * - `resolve_persona_text()` — reads a persona file with condensed-tree
 *   preference and frontmatter strip.
 *
 * Cross-validation against the members block already ran at config load
 * (`config._build_config`); this module trusts that contract and only
 * enforces the **one-advisor-per-provider** rule (replace-mode invariant).
 *
 * Parity notes:
 * - YAML frontmatter is parsed with `yaml` (npm) at `version: '1.1'`, the
 *   same approach the sibling config twin uses to mirror PyYAML `safe_load`.
 * - `str.title()` is mirrored by `_pyTitle` (uppercase first cased char
 *   after any non-cased char; lowercase the rest).
 * - `Path` ops use `node:path`; `Path.exists()` / `read_text()` use `fs`.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { type AdvisorConfig, CouncilConfigError } from './config.js';

/** Resolved advisor swap for a single provider. */
export class AdvisorPlan {
    readonly name: string;
    readonly display_name: string;
    readonly member: string;
    readonly persona_text: string;
    readonly model_override: string | null;

    constructor(args: {
        name: string;
        display_name: string;
        member: string;
        persona_text: string;
        model_override?: string | null;
    }) {
        this.name = args.name;
        this.display_name = args.display_name;
        this.member = args.member;
        this.persona_text = args.persona_text;
        this.model_override = args.model_override ?? null;
    }
}

// Python: re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
// \A → start of string. JS has no \A; anchor with ^ + no 'm' flag means ^
// matches only at string start. re.DOTALL → 's'.
const _FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

type Dict = Record<string, unknown>;

/** Return `[frontmatter_dict, body]`. Missing frontmatter → `[{}, raw]`. */
function _split_frontmatter(raw: string): [Dict, string] {
    const match = _FRONTMATTER_RE.exec(raw);
    if (!match) {
        return [{}, raw];
    }
    let meta: unknown;
    try {
        // yaml.safe_load(...) or {}  — null / empty → {}.
        const parsed = parseYaml(match[1] as string, { version: '1.1' });
        meta = parsed === null || parsed === undefined ? {} : parsed;
    } catch {
        // yaml.YAMLError → {}
        meta = {};
    }
    if (!_isDict(meta)) {
        meta = {};
    }
    // raw[match.end():] — slice from the end of the full match.
    const body = raw.slice(match.index + match[0].length);
    return [meta as Dict, body];
}

/** Prefer frontmatter `role`; fall back to titleized advisor key. */
function _display_name_from(advisor_name: string, frontmatter: Dict): string {
    const role = frontmatter['role'];
    if (typeof role === 'string' && role.trim() !== '') {
        return role.trim();
    }
    return _pyTitle(advisor_name.replace(/-/g, ' ').replace(/_/g, ' '));
}

/**
 * Read a persona file, returning `[body, frontmatter]`.
 *
 * Condensed tree (`dist/agent-src/`) wins so production runs match the
 * same projection the rest of the package consumes. Uncondensed tree
 * (`.agent-src.uncondensed/`) is the fallback for in-repo development
 * before `task sync` has projected the file.
 */
export function resolve_persona_text(
    persona_path: string,
    repo_root: string,
): [string, Dict] {
    const candidates = [
        path.join(repo_root, 'dist/agent-src', persona_path),
        path.join(repo_root, '.agent-src.uncondensed', persona_path),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            const raw = fs.readFileSync(candidate, 'utf-8');
            const [meta, body] = _split_frontmatter(raw);
            return [body.trim(), meta];
        }
    }
    const searched = candidates.join('\n  - ');
    throw new CouncilConfigError(
        `Persona file not found for advisor (path=${_pyReprStr(persona_path)}). ` +
            `Searched:\n  - ${searched}`,
    );
}

/**
 * Return `{provider_name: AdvisorPlan}` for every ENABLED advisor.
 *
 * Two enabled advisors targeting the same provider is a
 * `CouncilConfigError` — replace-mode runs one advisor per provider so
 * the call plan never doubles up by accident.
 */
export function plan_advisor_swap(
    advisors: Map<string, AdvisorConfig>,
    repo_root: string,
): Map<string, AdvisorPlan> {
    const plans = new Map<string, AdvisorPlan>();
    for (const adv of advisors.values()) {
        if (!adv.enabled) {
            continue;
        }
        if (plans.has(adv.member)) {
            const existing = (plans.get(adv.member) as AdvisorPlan).name;
            throw new CouncilConfigError(
                `advisors.${adv.name} and advisors.${existing} both bind ` +
                    `member=${_pyReprStr(adv.member)}; only one advisor per provider ` +
                    `per run (replace-mode invariant).`,
            );
        }
        const [body, meta] = resolve_persona_text(adv.persona, repo_root);
        plans.set(
            adv.member,
            new AdvisorPlan({
                name: adv.name,
                display_name: _display_name_from(adv.name, meta),
                member: adv.member,
                persona_text: body,
                model_override: adv.model,
            }),
        );
    }
    return plans;
}

/** Minimal duck-typed member shape consumed by `build_persona_labels`. */
export interface MemberLike {
    readonly name: string;
    readonly model: string;
}

/**
 * Build the peer-review `source → display_name` map.
 *
 * `source` is the `provider:model` string the peer-review pipeline uses
 * for anonymisation; `members` is the post-swap member list
 * (model_override already applied), so the model field matches what the
 * response carries.
 */
export function build_persona_labels(
    plans: Map<string, AdvisorPlan>,
    members: Iterable<MemberLike>,
): Map<string, string> {
    const labels = new Map<string, string>();
    for (const m of members) {
        const plan = plans.get(m.name);
        if (plan === undefined) {
            continue;
        }
        labels.set(`${m.name}:${m.model}`, plan.display_name);
    }
    return labels;
}

// ── Python-parity helpers ───────────────────────────────────────────

/** True when `v` is a plain object (Python `isinstance(meta, dict)`). */
function _isDict(v: unknown): v is Dict {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Mirror Python `str.title()`.
 *
 * A character is uppercased when the previous character is not a cased
 * letter; otherwise it is lowercased. "Cased" = a letter with case
 * distinction (`toUpperCase() !== toLowerCase()`).
 */
function _pyTitle(s: string): string {
    let out = '';
    let prevCased = false;
    for (const ch of s) {
        const isCased = ch.toUpperCase() !== ch.toLowerCase();
        if (isCased) {
            out += prevCased ? ch.toLowerCase() : ch.toUpperCase();
        } else {
            out += ch;
        }
        prevCased = isCased;
    }
    return out;
}

/** Mirror Python `repr()` for a string scalar (single-quoted, escaped). */
function _pyReprStr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let body = s
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    if (quote === "'") {
        body = body.replace(/'/g, "\\'");
    } else {
        body = body.replace(/"/g, '\\"');
    }
    return `${quote}${body}${quote}`;
}
