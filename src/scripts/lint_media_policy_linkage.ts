#!/usr/bin/env tsx
/**
 * Lint structural reachability of media governance policies.
 *
 * Ported from the retired Python `src/scripts/lint_media_policy_linkage.py` (ADR-200,
 * Phase 4 / Wave 4b). The CLI contract is pinned — `--quiet`
 * flag read from argv at module load, scan roots + policy ordering (policies
 * sorted; scan files via rglob), finding messages, output channel (all on
 * stdout except the final orphan summary on stderr), exit codes.
 *
 * Every policy file under `agents/settings/policies/media/` (except README)
 * must be linked from at least one of a skill SKILL.md, a routing rule, or a
 * sibling policy file. A policy that no surface references is a silent —
 * failed — policy.
 *
 * The inherited `POLICY_DIR` and `SCAN_ROOTS` were faithful ports of the .py's
 * paths, and every one of them was stale: the policy root was a level too
 * shallow and the referrer roots named the pre-ADR-051 container. Repaired
 * 2026-08-02; see the constants below.
 *
 * SECOND PASS (skill-link-integrity Phase 3): adapter lifecycle parity. See
 * {@link adapter_lifecycle_findings} — the nearest existing scope for a check
 * `docs/contracts/provider-lifecycle.md` says in its own words that CI does not
 * perform.
 *
 * THIRD PASS: the reverse
 * direction. See {@link render_end_findings} — every command that emits a
 * deliverable medium is listed in both policy trigger lists and calls the
 * finish step.
 *
 * Exit codes: 0 all policies linked, lifecycle tags agree and every render end
 * is listed and finished, 1 one or more orphan policies, a lifecycle
 * disagreement or a render-end finding, 2 dead scope.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

const QUIET = process.argv.includes('--quiet');

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');
/**
 * The policies whose reachability is being checked.
 *
 * This named `agents/policies/media` while the policies have always lived one
 * level deeper, under `agents/settings/policies/media` — the gate's own
 * "…/settings/policies/media/ missing" message named the right path while the
 * constant named the wrong one. Result: `main()` took the missing-dir early
 * return and exited 0 without checking a single policy.
 */
const POLICY_DIR = path.join(REPO, 'agents', 'settings', 'policies', 'media');
const EXEMPT_STEMS: ReadonlySet<string> = new Set(['README']);

/**
 * Surfaces scanned for inbound references to policy files.
 *
 * Three of these named the pre-ADR-051 source container and a fourth named
 * `.claude/skills`, a generated projection absent from this repo — so the
 * reference scan read nothing either. Now the real authoring roots (a command
 * is `src/domains/<pack>/<subpath>/command.md`, hence the domains root) plus
 * the policy directory itself, since a sibling policy is a valid referrer.
 */
const SCAN_ROOTS: readonly string[] = [
    path.join(REPO, 'src', 'skills'),
    path.join(REPO, 'src', 'rules'),
    path.join(REPO, 'src', 'domains'),
    POLICY_DIR,
];

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** `path.stem` — filename without the final suffix. */
function _stem(p: string): string {
    const base = path.basename(p);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.slice(0, dot) : base;
}

/** POSIX relative path of `target` under `root`. */
function _relToPosix(target: string, root: string): string {
    return path.relative(root, target).split(path.sep).join('/');
}

/** Immediate `*.md` children of `dir`, sorted (mirrors sorted(glob('*.md'))). */
function _globMdSorted(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.md')) {
            out.push(path.join(dir, entry.name));
        }
    }
    return out.sort();
}

/**
 * Recursively list `*.md` files under `dir`. Mirrors Python `root.rglob("*.md")`
 * ordering (top-down directory walk, os.scandir order per directory). The
 * caller only counts referrers, so exact ordering does not affect output.
 */
function _rglobMd(dir: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        const dirs: string[] = [];
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                dirs.push(full);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                out.push(full);
            }
        }
        for (const d of dirs) {
            walk(d);
        }
    };
    walk(dir);
    return out;
}

function emit(msg: string): void {
    if (!QUIET) {
        process.stdout.write(`${msg}\n`);
    }
}

function collect_policies(): string[] {
    if (!_exists(POLICY_DIR)) {
        return [];
    }
    return _globMdSorted(POLICY_DIR).filter((p) => !EXEMPT_STEMS.has(_stem(p)));
}

function collect_scan_files(): string[] {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) {
        if (!_exists(root)) {
            continue;
        }
        files.push(..._rglobMd(root));
    }
    return files;
}

/**
 * Return files that reference `policy` by its repo-relative name or basename.
 * Accept both the full path token (`policies/media/likeness.md`) and the
 * bare basename (`]({likeness.md})`) inside a markdown link.
 */
function referrers_for(policy: string, scanFiles: readonly string[]): string[] {
    const name = path.basename(policy);
    const needles = [`policies/media/${name}`, `](${name})`];
    const referrers: string[] = [];
    const policyResolved = fs.realpathSync(policy);
    for (const scanFile of scanFiles) {
        // A policy can't satisfy its own linkage requirement.
        let scanResolved: string;
        try {
            scanResolved = fs.realpathSync(scanFile);
        } catch {
            scanResolved = scanFile;
        }
        if (scanResolved === policyResolved) {
            continue;
        }
        let text: string;
        try {
            text = fs.readFileSync(scanFile, 'utf-8');
        } catch {
            continue;
        }
        if (needles.some((n) => text.includes(n))) {
            referrers.push(scanFile);
        }
    }
    return referrers;
}

// ── Adapter lifecycle parity ────────────────────────────────────────────────
// `docs/contracts/provider-lifecycle.md:101` states the obligation and its own
// gap in one sentence: "Editing an adapter and leaving its header `Lifecycle:`
// comment out of sync with `agents/templates/.ai-video.xml.example` → violation
// (CI does not catch this; the agent must)." This pass makes CI catch it.
//
// EXPECTED GREEN ON LANDING, and that is the point rather than a weakness. The
// premise this was drafted against claimed a live contradiction between the
// higgsfield adapter header and the contract; re-reading the tree refuted it —
// the two surfaces the contract actually obliges to agree DO agree at `stable`,
// and the surface reading `experimental` is § 5, a table that says in its own
// words that it lists the tiers "on the day this contract lands". So there is
// nothing to repair today; the check exists so the next divergence is caught.
// Its sensitivity is proven by a fixture that must be red, not by a finding.
//
// § 5 IS DELIBERATELY NOT AN INPUT. A historical record must not be able to
// fail a live check — wiring it in would make the gate demand that a
// day-one table be edited, which would destroy the record it is.
//
// DRIVEN FROM THE ADAPTERS, NOT FROM THE XML. The example declares providers
// that have no adapter at all (`allin1`, `whisperx`) and one that is a
// documentation placeholder inside a commented example block
// (`my-future-backend`); iterating the xml would demand adapters for all three.
// The reverse direction is still covered: an adapter with no provider entry is
// reported, because a shipped adapter the example never declares is exactly the
// drift this pass is for.

/** `# Lifecycle: <tier>` from an adapter header. */
const ADAPTER_LIFECYCLE_RE = /^#\s*Lifecycle:\s*([a-z]+)/m;

/** Repo-relative adapter dir and the xml example the contract pairs it with. */
const ADAPTER_DIR = path.join(REPO, 'src', 'scripts', 'ai-video', 'adapters');
const AI_VIDEO_EXAMPLE = path.join(REPO, 'agents', 'templates', '.ai-video.xml.example');

/** `<provider id="x" …> … <lifecycle>tier</lifecycle>` pairs, xml order. */
export function parse_example_lifecycles(xml: string): Map<string, string> {
    const out = new Map<string, string>();
    const re = /<provider\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/provider>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
        const tier = /<lifecycle>\s*([a-z]+)\s*<\/lifecycle>/.exec(m[2] as string);
        // First declaration wins: the example's commented "how to add one"
        // block repeats an id shape, and a later placeholder must not overwrite
        // a real entry.
        if (tier && !out.has(m[1] as string)) {
            out.set(m[1] as string, tier[1] as string);
        }
    }
    return out;
}

/** Findings for adapter-vs-example lifecycle disagreement. `[]` = parity holds. */
export function adapter_lifecycle_findings(
    adapterDir: string = ADAPTER_DIR,
    examplePath: string = AI_VIDEO_EXAMPLE,
): string[] {
    const findings: string[] = [];
    let xml: string;
    try {
        xml = fs.readFileSync(examplePath, 'utf-8');
    } catch {
        return [`${_relToPosix(examplePath, REPO)} is unreadable — lifecycle parity cannot be checked`];
    }
    const declared = parse_example_lifecycles(xml);
    let entries: string[];
    try {
        entries = fs.readdirSync(adapterDir).filter((f) => f.endsWith('.sh')).sort();
    } catch {
        return [`${_relToPosix(adapterDir, REPO)} is unreadable — lifecycle parity cannot be checked`];
    }
    for (const file of entries) {
        const id = file.replace(/\.sh$/, '');
        const header = ADAPTER_LIFECYCLE_RE.exec(fs.readFileSync(path.join(adapterDir, file), 'utf-8'));
        if (header === null) {
            findings.push(`adapters/${file}: no \`# Lifecycle:\` header comment`);
            continue;
        }
        const inXml = declared.get(id);
        if (inXml === undefined) {
            findings.push(
                `adapters/${file}: header says \`${header[1] as string}\` but no ` +
                    `<provider id="${id}"> exists in ${_relToPosix(examplePath, REPO)}`,
            );
            continue;
        }
        if (inXml !== header[1]) {
            findings.push(
                `adapters/${file}: header \`${header[1] as string}\` != ` +
                    `<provider id="${id}"><lifecycle>${inXml}</lifecycle>`,
            );
        }
    }
    return findings;
}

// Render ends — the reverse direction.
// The first pass asks whether each policy is reachable from somewhere. It never
// asked the reverse: whether each command that EMITS a deliverable medium is
// named by the policies that govern it and actually runs the carrier step. That
// gap is how four of five video commands and every image command shipped with
// no provenance while the policies called the disclosure non-removable.
//
// A render end is classified by what the command body DOES, never by its name:
//   - video: it writes the `final.mp4` render end;
//   - image: an `/image:*` command that generates through the adapter layer
//     (`scripts/ai-video/adapters/`). `/image:verify` and `/image:analyse` read
//     a medium and emit none, so they are not render ends.
// Intermediates (`/video:scene` clips, the `/video:storyboard` contact sheet)
// are not render ends; the policies say an intermediate that leaves for an
// audience goes through finish first.
//
// A trigger counts only inside the policy's `## Triggers` section and only as an
// explicit `/cluster:sub` id — a mention elsewhere in the file, or a `/cluster:*`
// wildcard, is not a listing.

/** Clusters whose commands can emit a medium. */
const MEDIA_CLUSTERS: ReadonlySet<string> = new Set(['video', 'image', 'audio']);
const COMMAND_ROOT = path.join(REPO, 'src', 'domains');
const RENDER_END_POLICIES: readonly string[] = [
    path.join(POLICY_DIR, 'disclosure.md'),
    path.join(POLICY_DIR, 'transparency.md'),
];
const FINISH_CALL = 'embed-provenance.sh finish';

export type RenderMedium = 'video' | 'image';

export interface RenderEnd {
    file: string;
    id: string;
    medium: RenderMedium;
}

function _frontmatterField(text: string, key: string): string | null {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (fm === null) {
        return null;
    }
    const m = new RegExp(`^${key}:\\s*([A-Za-z0-9_-]+)\\s*$`, 'm').exec(fm[1] as string);
    return m === null ? null : (m[1] as string);
}

function _rglobCommands(root: string): string[] {
    const out: string[] = [];
    const walk = (current: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(current, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name === 'command.md') {
                out.push(full);
            }
        }
    };
    walk(root);
    return out.sort();
}

/** Classify one command body; `null` = not a render end. */
export function classify_render_end(cluster: string, body: string): RenderMedium | null {
    if (/\bfinal\.mp4\b/.test(body)) {
        return 'video';
    }
    if (cluster === 'image' && body.includes('scripts/ai-video/adapters/')) {
        return 'image';
    }
    return null;
}

/** Every command under `root` that emits a deliverable medium, sorted by id. */
export function collect_render_end_commands(root: string = COMMAND_ROOT): RenderEnd[] {
    const ends: RenderEnd[] = [];
    for (const file of _rglobCommands(root)) {
        const text = fs.readFileSync(file, 'utf-8');
        const cluster = _frontmatterField(text, 'cluster');
        const sub = _frontmatterField(text, 'sub');
        // A cluster head (no `sub`) routes; it does not render.
        if (cluster === null || sub === null || !MEDIA_CLUSTERS.has(cluster)) {
            continue;
        }
        const medium = classify_render_end(cluster, text);
        if (medium !== null) {
            ends.push({ file, id: `/${cluster}:${sub}`, medium });
        }
    }
    return ends.sort((a, b) => a.id.localeCompare(b.id));
}

/** Explicit `/cluster:sub` ids inside a policy's `## Triggers` section. */
export function trigger_ids(policyText: string): Set<string> {
    const ids = new Set<string>();
    const start = /^## Triggers[ \t]*$/m.exec(policyText);
    if (start === null) {
        return ids;
    }
    const rest = policyText.slice(start.index + start[0].length);
    const next = /^## /m.exec(rest);
    const section = next === null ? rest : rest.slice(0, next.index);
    for (const m of section.matchAll(/\/([a-z][a-z-]*):([a-z][a-z-]*)\b/g)) {
        ids.add(`/${m[1] as string}:${m[2] as string}`);
    }
    return ids;
}

/** Findings for render ends not listed in a policy or never finished. `[]` = holds. */
export function render_end_findings(
    commandRoot: string = COMMAND_ROOT,
    policies: readonly string[] = RENDER_END_POLICIES,
): string[] {
    const findings: string[] = [];
    const lists = policies.map((p) => {
        let text = '';
        try {
            text = fs.readFileSync(p, 'utf-8');
        } catch {
            findings.push(`${path.basename(p)} is unreadable — its trigger list cannot be checked`);
        }
        return { name: path.basename(p), ids: trigger_ids(text) };
    });
    for (const end of collect_render_end_commands(commandRoot)) {
        for (const list of lists) {
            if (!list.ids.has(end.id)) {
                findings.push(
                    `${end.id} emits a deliverable (${end.medium}) but is not in the ## Triggers list of ${list.name}`,
                );
            }
        }
        if (!fs.readFileSync(end.file, 'utf-8').includes(FINISH_CALL)) {
            findings.push(`${end.id} emits a deliverable (${end.medium}) but never calls \`${FINISH_CALL}\``);
        }
    }
    return findings;
}

/** Adapter count, for the dead-scope assertion. */
export function count_adapters(adapterDir: string = ADAPTER_DIR): number {
    try {
        return fs.readdirSync(adapterDir).filter((f) => f.endsWith('.sh')).length;
    } catch {
        return 0;
    }
}

function main(): number {
    // Scope assertions replace the two silent early returns this gate used to
    // take. Both are deliberately WITHOUT `allowEmpty`: "the policy directory
    // is missing" was not a benign optional-surface case here, it was the bug —
    // the constant pointed one level too shallow and the gate green-lit an
    // unchecked policy set for as long as it has existed.
    const policies = collect_policies();
    const scanFiles = collect_scan_files();
    try {
        assertScanned({
            gate: 'lint_media_policy_linkage',
            scanned: policies.length,
            units: 'policy file(s)',
            roots: [_relToPosix(POLICY_DIR, REPO)],
        });
        assertScanned({
            gate: 'lint_media_policy_linkage',
            scanned: scanFiles.length,
            units: 'referrer-candidate file(s)',
            roots: SCAN_ROOTS.map((r) => _relToPosix(r, REPO)),
        });
        // Zero adapters means the adapter root moved, not that parity holds.
        assertScanned({
            gate: 'lint_media_policy_linkage',
            scanned: count_adapters(),
            units: 'ai-video adapter(s)',
            roots: [_relToPosix(ADAPTER_DIR, REPO)],
        });
        // Zero render ends means the command root or the classifier moved,
        // not that every render end is finished.
        assertScanned({
            gate: 'lint_media_policy_linkage',
            scanned: collect_render_end_commands().length,
            units: 'media render-end command(s)',
            roots: [_relToPosix(COMMAND_ROOT, REPO)],
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) {
            throw exc;
        }
        process.stderr.write(`❌  ${exc.message}\n`);
        return 2;
    }

    const orphans: string[] = [];
    for (const policy of policies) {
        const referrers = referrers_for(policy, scanFiles);
        const rel = _relToPosix(policy, REPO);
        if (referrers.length === 0) {
            orphans.push(policy);
            emit(`❌  ORPHAN  ${rel}`);
            continue;
        }
        emit(`✅  ${rel}  (${referrers.length} referrer(s))`);
    }

    const lifecycle = adapter_lifecycle_findings();
    for (const f of lifecycle) {
        emit(`❌  LIFECYCLE  ${f}`);
    }

    if (orphans.length > 0) {
        process.stderr.write(
            `\nmedia-policy-linkage: ${orphans.length} orphan policy ` +
                `file(s) — every policy must be linked from a skill, rule, ` +
                `or sibling policy.\n`,
        );
        for (const o of orphans) {
            process.stderr.write(`  - ${_relToPosix(o, REPO)}\n`);
        }
        return 1;
    }

    const renderEnds = render_end_findings();
    for (const f of renderEnds) {
        emit(`❌  RENDER-END  ${f}`);
    }

    if (lifecycle.length > 0) {
        process.stderr.write(
            `\nadapter-lifecycle-parity: ${lifecycle.length} disagreement(s) ` +
                `between an adapter header and agents/templates/.ai-video.xml.example. ` +
                `The day-one table in docs/contracts/provider-lifecycle.md § 5 is NOT ` +
                `an input here — it is a historical record.\n`,
        );
        for (const f of lifecycle) {
            process.stderr.write(`  - ${f}\n`);
        }
        return 1;
    }

    if (renderEnds.length > 0) {
        process.stderr.write(
            `\nmedia-render-ends: ${renderEnds.length} finding(s) — every command that ` +
                `emits a deliverable medium must be in the ## Triggers list of disclosure.md ` +
                `and transparency.md and call \`${FINISH_CALL}\`.\n`,
        );
        for (const f of renderEnds) {
            process.stderr.write(`  - ${f}\n`);
        }
        return 1;
    }

    emit(
        `media-policy-linkage: ${policies.length} policy file(s) — all ` +
            `linked (${scanFiles.length} file(s) scanned for referrers).`,
    );
    emit(
        `adapter-lifecycle-parity: ${count_adapters()} adapter(s) — every ` +
            `\`# Lifecycle:\` header agrees with its <provider> entry.`,
    );
    emit(
        `media-render-ends: ${collect_render_end_commands().length} render end(s) — each is ` +
            `listed in both trigger lists and calls the finish step.`,
    );
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}

export { REPO, POLICY_DIR, SCAN_ROOTS, collect_policies, collect_scan_files, referrers_for, main };
