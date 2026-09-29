#!/usr/bin/env tsx
/**
 * Every shipped skill, and the entry paths that can reach it.
 *
 * `road-to-skill-menu-economy` step 1.1. The roadmap's lever is COUNT ON THE
 * MENU — the description corpus already sits at the schema cap, so there is no
 * byte-shaving budget to spend (K2). Deciding which skills may leave the model
 * menu needs to know, per skill, whether anything other than the menu can
 * reach it. This report answers that mechanically and publishes the rule it
 * used, so a later reader can disagree with the rule rather than with a number.
 *
 * WHAT IT IS NOT
 * --------------
 * It is a REPORT, deliberately: no threshold, no exit code that carries a
 * verdict, and a `report_` prefix so `_lib/gate_population.ts` classifies it
 * out of the gate population rather than by whoever last edited a manifest.
 *
 * It also does NOT decide "sole entry path", and that limit is load-bearing
 * rather than an apology. A command reference proves a command CAN reach the
 * skill; it cannot prove the menu never does. The roadmap's own Risk 1 is
 * precisely this — marking a skill `user-invocable: false` is correct only if
 * the command or flow path really is the only one — so this report produces
 * the evidence for that judgement and never the judgement.
 *
 * THE CLASSIFICATION RULE, stated because it is the whole content
 * -------------------------------------------------------------
 * For each `src/skills/<name>/SKILL.md`, three signals are read:
 *
 *   command_refs  files under `src/domains/**\/command.md` that reference the
 *                 skill in one of three DISAMBIGUATING shapes — `skill:<name>`,
 *                 a `skills/<name>` path, or the bare name in backticks. A
 *                 plain word-boundary match is deliberately NOT used: skill
 *                 names like `security`, `database` and `docker` are ordinary
 *                 English and would hit on every prose mention.
 *   flow_refs     files under `src/flows/` whose own `skills:` list names it.
 *                 Flows carry YAML name lists rather than the shapes above, so
 *                 the command regex read 0 for all 299 on the first pass — a
 *                 false zero, and the reason `flowSkillNames` exists.
 *   menu_present  true unless the frontmatter carries `user-invocable: false`
 *                 or `disable-model-invocation: true` — the two menu-economy
 *                 keys the roadmap measures as nearly unused.
 *
 * and the row is classified:
 *
 *   both          command_refs > 0 AND flow_refs > 0
 *   command-only  command_refs > 0, flow_refs = 0
 *   flow-only     flow_refs > 0, command_refs = 0
 *   model-routed  neither, and the skill is on the menu — the menu is then the
 *                 only entry path this repository can point at
 *   orphan        neither, and the skill is off the menu: nothing in the tree
 *                 reaches it. Reported, never deleted (K3).
 *
 * `command-only` and `flow-only` name a CANDIDATE for `user-invocable: false`,
 * never a decision — see the sole-entry limit above.
 *
 * THE PER-PROFILE MENU, added by `road-to-a-menu-whose-precision-is-measured`
 * 4.1. `--profile minimal|balanced|full|all` prints the menu byte count each
 * shipped install profile delivers. Each profile's preset is read from its own
 * file, and the answer is that all three are equal: no shipped preset declares
 * a key that selects skills, so each one ships the whole menu.
 *
 * The equality note is WITHHELD when any profile carries a key listed in
 * {@link SKILL_SELECTING_INI_KEYS}, and the key is named instead. That is the
 * whole falsifiability claim, stated no wider than it holds: the byte count
 * would not move — nothing here knows what such a key means — but the report
 * stops asserting a conclusion whose premise has changed.
 *
 * Usage:
 *     ./scripts-run src/scripts/report_skill_menu_census                # stdout summary
 *     ./scripts-run src/scripts/report_skill_menu_census --profile all
 *     ./scripts-run src/scripts/report_skill_menu_census --emit         # write the artifact
 *     ./scripts-run src/scripts/report_skill_menu_census --emit --pin <sha>
 *
 * Deterministic: rows sort by skill name, no timestamp is written, and the pin
 * is an argument rather than "now", so a re-run at the same pin over the same
 * tree is byte-identical.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const ARTIFACT_REL = path.join('agents', 'evidence', 'analysis', 'skill-menu-census-2026-09.md');

export type EntryPath = 'both' | 'command-only' | 'flow-only' | 'model-routed' | 'orphan';

export interface SkillRow {
    readonly name: string;
    readonly commandRefs: number;
    readonly flowRefs: number;
    readonly menuPresent: boolean;
    readonly hasTriggerCorpus: boolean;
    readonly entryPath: EntryPath;
    /** One command or flow file, for an operator to start from. Empty when none. */
    readonly firstRef: string;
}

/** Escape a skill name for use inside a RegExp. Names are kebab-case, so this is cheap insurance. */
function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/**
 * The three disambiguating reference shapes, as one regex.
 *
 * A bare word-boundary match was tried first and rejected on inspection: 299
 * skill names include `security`, `database`, `docker`, `performance` and
 * `mode`, each of which appears in ordinary command prose. A reference that
 * cannot be told from a sentence is not evidence of an entry path.
 */
export function referenceRe(skill: string): RegExp {
    const n = escapeRe(skill);
    const tick = String.fromCharCode(96);
    return new RegExp(
        'skill:\\s*' + n + '(?![a-z0-9-])' +
            '|skills/' + n + '(?:[/\\s' + tick + ')\\]]|$)' +
            '|' + tick + n + tick,
        'u',
    );
}

/** Every file under `dir` matching `pred`, sorted, as repo-relative paths. */
export function walk(root: string, dir: string, pred: (rel: string) => boolean): string[] {
    const out: string[] = [];
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return out;
    const stack: string[] = [dir];
    while (stack.length > 0) {
        const cur = stack.pop() as string;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(path.join(root, cur), { withFileTypes: true });
        } catch {
            continue;
        }
        for (const e of entries) {
            const rel = path.join(cur, e.name);
            if (e.isDirectory()) stack.push(rel);
            else if (e.isFile() && pred(rel)) out.push(rel);
        }
    }
    return out.sort();
}

/** Frontmatter values this report needs. Hand-parsed: only two boolean keys matter. */
export function menuFlags(text: string): { userInvocable: boolean | null; disableModel: boolean | null } {
    const head = text.slice(0, 4000);
    const ui = /^user-invocable:\s*(true|false)\s*$/mu.exec(head);
    const dm = /^disable-model-invocation:\s*(true|false)\s*$/mu.exec(head);
    return {
        userInvocable: ui === null ? null : ui[1] === 'true',
        disableModel: dm === null ? null : dm[1] === 'true',
    };
}

/**
 * The skill names a flow file declares, from its own `skills:` lists.
 *
 * Flows do NOT use the three reference shapes commands use — they carry YAML
 * lists of bare names (`skills: [code-review, adversarial-review]`, or a block
 * sequence). Running the command-shaped regex over them returned flow_refs = 0
 * for all 299 skills on the first pass, which was a false zero and is why this
 * parser exists rather than a wider word-boundary match: a bare name is safe
 * HERE precisely because the `skills:` key bounds where it may be read.
 */
export function flowSkillNames(text: string): Set<string> {
    const out = new Set<string>();
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        const inline = /^\s*skills:\s*\[([^\]]*)\]\s*$/u.exec(line);
        if (inline !== null) {
            for (const raw of (inline[1] as string).split(',')) {
                const n = raw.trim().replace(/^['"]|['"]$/gu, '');
                if (n !== '') out.add(n);
            }
            continue;
        }
        if (!/^\s*skills:\s*$/u.test(line)) continue;
        const indent = (/^\s*/u.exec(line) as RegExpExecArray)[0].length;
        for (let j = i + 1; j < lines.length; j += 1) {
            const item = /^(\s*)-\s*(\S.*?)\s*$/u.exec(lines[j] as string);
            if (item === null || (item[1] as string).length <= indent) break;
            out.add((item[2] as string).replace(/^['"]|['"]$/gu, ''));
        }
    }
    return out;
}

export function classify(commandRefs: number, flowRefs: number, menuPresent: boolean): EntryPath {
    if (commandRefs > 0 && flowRefs > 0) return 'both';
    if (commandRefs > 0) return 'command-only';
    if (flowRefs > 0) return 'flow-only';
    return menuPresent ? 'model-routed' : 'orphan';
}

export function census(root: string): SkillRow[] {
    const skillsDir = path.join(root, 'src', 'skills');
    const names = fs
        .readdirSync(skillsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')))
        .map((e) => e.name)
        .sort();

    const commandFiles = walk(root, path.join('src', 'domains'), (rel) => path.basename(rel) === 'command.md');
    const flowFiles = walk(root, path.join('src', 'flows'), () => true);
    const commandText = commandFiles.map((rel) => [rel, fs.readFileSync(path.join(root, rel), 'utf-8')] as const);
    const flowDecl = flowFiles.map(
        (rel) => [rel, flowSkillNames(fs.readFileSync(path.join(root, rel), 'utf-8'))] as const,
    );

    const rows: SkillRow[] = [];
    for (const name of names) {
        const skillMd = path.join(skillsDir, name, 'SKILL.md');
        const text = fs.readFileSync(skillMd, 'utf-8');
        const flags = menuFlags(text);
        const menuPresent = flags.userInvocable !== false && flags.disableModel !== true;
        const re = referenceRe(name);
        const cmdHits = commandText.filter(([, t]) => re.test(t)).map(([rel]) => rel);
        const flowHits = flowDecl.filter(([, names]) => names.has(name)).map(([rel]) => rel);
        rows.push({
            name,
            commandRefs: cmdHits.length,
            flowRefs: flowHits.length,
            menuPresent,
            hasTriggerCorpus: fs.existsSync(path.join(skillsDir, name, 'evals', 'triggers.json')),
            entryPath: classify(cmdHits.length, flowHits.length, menuPresent),
            firstRef: cmdHits[0] ?? flowHits[0] ?? '',
        });
    }
    return rows;
}

export function tally(rows: readonly SkillRow[]): Record<EntryPath, number> {
    const t: Record<EntryPath, number> = {
        both: 0,
        'command-only': 0,
        'flow-only': 0,
        'model-routed': 0,
        orphan: 0,
    };
    for (const r of rows) t[r.entryPath] += 1;
    return t;
}

export function renderArtifact(rows: readonly SkillRow[], pin: string): string {
    const t = tally(rows);
    const candidates = t['command-only'] + t['flow-only'];
    const L: string[] = [];
    L.push('<!-- evidence-type: analysis -->');
    L.push('# Skill menu census — every skill, and what can reach it');
    L.push('');
    L.push(`Pinned to commit \`${pin}\`. Generated by \`./scripts-run src/scripts/report_skill_menu_census --emit --pin ${pin}\`;`);
    L.push('re-running it at the same pin over the same tree is byte-identical, which is what');
    L.push('`road-to-skill-menu-economy` step 1.1 asks to be checkable.');
    L.push('');
    L.push('## The rule this census applied');
    L.push('');
    L.push('**Commands.** A `src/domains/**/command.md` file counts as reaching a skill when it');
    L.push('references it in one of three disambiguating shapes — `skill:<name>`, a `skills/<name>`');
    L.push('path, or the bare name in backticks. A plain word-boundary match is NOT used: names');
    L.push('like `security`, `database` and `docker` are ordinary English and would hit on every');
    L.push('prose mention. The `skill:<name>` shape is closed with a negative lookahead rather');
    L.push('than a word boundary: `\\b` sits between `w` and `-`, so `skill:code-review-lens` was a');
    L.push('hit for `code-review` and a skill would have inherited a longer sibling\'s references.');
    L.push('Tightening it moved no figure in this corpus, which is recorded rather than assumed.');
    L.push('');
    L.push('**Flows.** A `src/flows/*.yaml` file counts when its own `skills:` list names the skill.');
    L.push('Flows carry YAML name lists rather than the shapes above, so applying the command regex');
    L.push('to them returned `flow_refs = 0` for all 299 skills on the first pass. That was a false');
    L.push('zero, corrected before publication; a bare name is safe here precisely because the');
    L.push('`skills:` key bounds where it may be read.');
    L.push('');
    L.push('**Menu.** `menu_present` is true unless the frontmatter carries `user-invocable: false`');
    L.push('or `disable-model-invocation: true`.');
    L.push('');
    L.push('| Class | Meaning |');
    L.push('|---|---|');
    L.push('| `both` | reachable from a command AND from a flow |');
    L.push('| `command-only` | a command references it; no flow does |');
    L.push('| `flow-only` | a flow references it; no command does |');
    L.push('| `model-routed` | neither, and it is on the menu — the menu is the only entry path this tree can point at |');
    L.push('| `orphan` | neither, and it is off the menu: nothing here reaches it |');
    L.push('');
    L.push('## What this census does NOT establish');
    L.push('');
    L.push('It does not decide **sole entry path**. A command reference proves a command CAN');
    L.push('reach the skill; nothing here proves the menu never does. `command-only` and');
    L.push('`flow-only` are therefore CANDIDATES for `user-invocable: false` and never the');
    L.push('marking decision — the roadmap\'s Risk 1 is exactly this misclassification, and its');
    L.push('stated mitigation is a successful command invocation per marked skill, which is a');
    L.push('step 1.2 obligation and not something a static scan can discharge.');
    L.push('');
    L.push('An `orphan` row is a question, not a deletion list (K3).');
    L.push('');
    L.push('## Totals');
    L.push('');
    L.push('| Class | Count |');
    L.push('|---|---:|');
    for (const k of ['both', 'command-only', 'flow-only', 'model-routed', 'orphan'] as EntryPath[]) {
        L.push(`| \`${k}\` | ${String(t[k])} |`);
    }
    L.push(`| **total** | **${String(rows.length)}** |`);
    L.push('');
    L.push(`Menu-removal candidates (\`command-only\` + \`flow-only\`): **${String(candidates)}**.`);
    L.push('');
    L.push('## Rows');
    L.push('');
    L.push('| Skill | Entry path | cmd refs | flow refs | on menu | triggers.json | first reference |');
    L.push('|---|---|---:|---:|:-:|:-:|---|');
    for (const r of rows) {
        L.push(
            `| \`${r.name}\` | \`${r.entryPath}\` | ${String(r.commandRefs)} | ${String(r.flowRefs)} | ` +
                `${r.menuPresent ? 'yes' : 'no'} | ${r.hasTriggerCorpus ? 'yes' : 'no'} | ` +
                `${r.firstRef === '' ? '—' : `\`${r.firstRef}\``} |`,
        );
    }
    L.push('');
    return L.join('\n');
}

function headSha(root: string): string {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
}

// ── per-profile menu bytes (road-to-a-menu-whose-precision-is-measured 4.1) ──

/** The shipped install presets, mirroring `install.ts` SUPPORTED_PROFILES. */
export const PROFILES = ['minimal', 'balanced', 'full'] as const;
export type Profile = (typeof PROFILES)[number];

/**
 * Preset keys that would narrow the skill menu.
 *
 * EMPTY, and the emptiness is the finding rather than a stub. A preset selects
 * `rule_loading_tier`, `discipline_profile` and `chat_history_frequency`; which
 * SKILLS are written is decided by `packs:` frontmatter against the active pack
 * set, which no preset names.
 *
 * It is a TRIPWIRE, not a selector, and the distinction is worth stating
 * plainly because the first version of this comment overclaimed it. Nothing
 * here knows what such a key would MEAN, so nothing here can apply one: the
 * byte count would not move. What the list buys is that a preset carrying a
 * listed key is NAMED in the output and the equality note is withheld — so the
 * report stops asserting a conclusion whose premise has changed, instead of
 * printing the same prose over a different tree.
 */
export const SKILL_SELECTING_INI_KEYS: readonly string[] = [];

/** Flat `key=value` read of a profile preset; `;` comments and blanks dropped. */
export function readProfileIni(root: string, profile: Profile): Record<string, string> {
    const p = path.join(root, 'src', 'config', 'profiles', `${profile}.ini`);
    const out: Record<string, string> = {};
    for (const raw of fs.readFileSync(p, 'utf-8').split('\n')) {
        const line = raw.trim();
        if (line === '' || line.startsWith(';') || line.startsWith('#') || line.startsWith('[')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
    return out;
}

export interface ProfileMenu {
    readonly profile: Profile;
    /** Skills this profile writes onto the model menu. */
    readonly menuSkills: number;
    /** Bytes of `- <name>: <description>\n`, the shape `censusSkillsCatalog` sums. */
    readonly menuBytes: number;
    /** chars/4, the estimator the payload budget uses. */
    readonly tokensEstimate: number;
    /** `declared_skill_catalogue_tokens` from the preset, or null when absent. */
    readonly declaredCatalogueTokens: number | null;
    /** Preset keys found that would narrow the menu. Empty today, by measurement. */
    readonly selectingKeys: readonly string[];
}

/**
 * One profile's menu, computed from its preset plus the skill tree.
 *
 * The catalogue LINE is the same shape `preamble_byte_census.censusSkillsCatalog`
 * sums — `- <name>: <description>\n`. The POPULATION deliberately is not, and the
 * difference is stated rather than smoothed over: that census sums every
 * `SKILL.md`, because the payload bucket it feeds is about what the host lists;
 * this one drops a skill carrying `user-invocable: false` or
 * `disable-model-invocation: true`, because a menu is what the MODEL may pick
 * from. Two skills carry such a flag today, so over the same tree and the same
 * line shape this report reads 311 B below the full-population sum. Expect the
 * two to differ; a reader who finds them equal has found a defect in one.
 */
export function menuForProfile(root: string, profile: Profile): ProfileMenu {
    const ini = readProfileIni(root, profile);
    const selectingKeys = SKILL_SELECTING_INI_KEYS.filter((k) => k in ini);
    const skillsDir = path.join(root, 'src', 'skills');
    let menuSkills = 0;
    let menuBytes = 0;
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;
        const text = fs.readFileSync(skillMd, 'utf-8');
        const flags = menuFlags(text);
        if (flags.userInvocable === false || flags.disableModel === true) continue;
        const name = /^name:\s*(\S.*?)\s*$/mu.exec(text.slice(0, 4000))?.[1] ?? entry.name;
        const description = frontmatterDescription(text);
        menuSkills += 1;
        menuBytes += `- ${name}: ${description}\n`.length;
    }
    const declared = ini['declared_skill_catalogue_tokens'];
    return {
        profile,
        menuSkills,
        menuBytes,
        tokensEstimate: Math.round(menuBytes / 4),
        declaredCatalogueTokens: declared === undefined ? null : Number(declared),
        selectingKeys,
    };
}

/**
 * The `description:` value, folded lines included.
 *
 * A `[^\n]+` capture was measured 17.1 % low elsewhere in this tree because it
 * truncates every folded multi-line description; this reads to the next
 * top-level key instead.
 *
 * A double-quoted value has its escapes DECODED. Leaving them encoded counted
 * `\"` as two characters and over-reported the menu by 56 B across 13 skills —
 * small, but the same class of defect as the 17.1 % one above, and a function
 * whose docstring cites that fix should not carry a second instance of it.
 */
export function frontmatterDescription(text: string): string {
    if (!text.startsWith('---')) return '';
    const end = text.indexOf('\n---', 3);
    if (end === -1) return '';
    const lines = text.slice(3, end).split('\n');
    const at = lines.findIndex((l) => /^description:/u.test(l));
    if (at === -1) return '';
    const parts = [(lines[at] as string).replace(/^description:\s*/u, '')];
    for (let i = at + 1; i < lines.length; i += 1) {
        const l = lines[i] as string;
        if (/^\S/u.test(l)) break;
        parts.push(l.trim());
    }
    const joined = parts.join(' ').trim();
    if (joined.length >= 2 && joined.startsWith('"') && joined.endsWith('"')) {
        return joined.slice(1, -1).replace(/\\(["\\])/gu, '$1');
    }
    if (joined.length >= 2 && joined.startsWith("'") && joined.endsWith("'")) {
        return joined.slice(1, -1).replace(/''/gu, "'");
    }
    return joined;
}

/** Render the per-profile menu table. Returns the lines, so tests read them. */
export function renderProfileMenus(menus: readonly ProfileMenu[]): string[] {
    const L: string[] = [];
    L.push('menu bytes per install profile (name + description, the catalogue shape):');
    L.push('  profile    skills   menu_bytes   ~tokens   declared');
    for (const m of menus) {
        L.push(
            `  ${m.profile.padEnd(10)} ${String(m.menuSkills).padStart(6)} ` +
                `${String(m.menuBytes).padStart(12)} ${String(m.tokensEstimate).padStart(9)} ` +
                `${(m.declaredCatalogueTokens === null ? '—' : String(m.declaredCatalogueTokens)).padStart(10)}`,
        );
    }
    const flagged = menus.filter((m) => m.selectingKeys.length > 0);
    if (flagged.length > 0) {
        L.push('');
        L.push('  A preset declares a key that could select skills, so the equality below is NOT');
        L.push('  asserted — the premise it rested on has changed. Keys found:');
        for (const m of flagged) L.push(`    ${m.profile}: ${m.selectingKeys.join(', ')}`);
        return L;
    }
    const distinct = new Set(menus.map((m) => m.menuBytes));
    if (menus.length > 1 && distinct.size === 1) {
        L.push('');
        L.push(
            '  All profiles report the SAME menu_bytes, and that is a measurement, not a',
        );
        L.push(
            '  placeholder: no preset declares a key that selects skills, so each ships the',
        );
        L.push(
            '  whole menu. The preset chooses which RULES activate; which SKILLS are written',
        );
        L.push(
            '  is decided by `packs:` frontmatter against the active pack set. A menu-bytes',
        );
        L.push(
            '  lever therefore has to move packs or the menu flags — changing profile does',
        );
        L.push('  nothing. The three presets already record this in their own comments.');
    }
    return L;
}

export function main(argv: readonly string[]): number {
    const root = REPO_ROOT;
    const profIdx = argv.indexOf('--profile');
    if (profIdx !== -1) {
        const want = argv[profIdx + 1] ?? 'all';
        const chosen: Profile[] =
            want === 'all' ? [...PROFILES] : PROFILES.includes(want as Profile) ? [want as Profile] : [];
        if (chosen.length === 0) {
            process.stderr.write(
                `report_skill_menu_census: --profile expects ${PROFILES.join(' | ')} | all, got ${want}\n`,
            );
            return 2;
        }
        if (argv.includes('--emit')) {
            // Refused rather than ignored: `--emit` writes the census artifact,
            // `--profile` prints a table and writes nothing, and silently doing
            // the second when the caller asked for both is how an artifact goes
            // un-refreshed without anyone noticing.
            process.stderr.write('report_skill_menu_census: --profile and --emit are separate runs\n');
            return 2;
        }
        const menus = chosen.map((p) => menuForProfile(root, p));
        process.stdout.write(`${renderProfileMenus(menus).join('\n')}\n`);
        return 0;
    }
    const emit = argv.includes('--emit');
    const pinIdx = argv.indexOf('--pin');
    const pin = pinIdx !== -1 && pinIdx + 1 < argv.length ? (argv[pinIdx + 1] as string) : headSha(root);
    const rows = census(root);
    const t = tally(rows);
    if (emit) {
        const out = path.join(root, ARTIFACT_REL);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, renderArtifact(rows, pin), 'utf-8');
        process.stdout.write(`wrote ${ARTIFACT_REL} · ${String(rows.length)} row(s) · pin ${pin}\n`);
    }
    process.stdout.write(`scanned: ${String(rows.length)} skill(s)\n`);
    for (const k of ['both', 'command-only', 'flow-only', 'model-routed', 'orphan'] as EntryPath[]) {
        process.stdout.write(`  ${k.padEnd(14)} ${String(t[k]).padStart(4)}\n`);
    }
    process.stdout.write(
        `  menu-removal candidates (command-only + flow-only): ${String(t['command-only'] + t['flow-only'])}\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main(process.argv.slice(2)));
}
