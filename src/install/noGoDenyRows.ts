/**
 * The consent step between a classified no-go and a host deny list.
 *
 * `road-to-a-project-contract-written-down` step 2.2. Step 2.1 decides what a
 * bullet WOULD become; nothing here happens without the consumer saying yes,
 * and a no writes nothing at all.
 *
 * ```
 * THE ROWS ARE SHOWN BEFORE THEY ARE WRITTEN. A DECLINE WRITES NOTHING.
 * AN ENTRY THE CONSUMER ALREADY HAD SURVIVES THE APPEND BYTE FOR BYTE.
 * A HOST WITH NO NATIVE DENY LIST GETS A REPORT, NEVER A FILE.
 * ```
 *
 * WHY THE APPEND IS TEXTUAL. Parsing the settings file and re-serialising it
 * would reformat a file the consumer owns — re-indenting it, dropping the key
 * order a reader relies on, and rewriting lines this change has no business
 * touching. Risk 4 in the roadmap's register is exactly that: "rewriting the
 * settings file drops a user entry or reorders it". So the body is spliced:
 * every byte outside the insertion point is the byte that was there before,
 * which is a property a test can assert rather than a promise.
 *
 * The file is still PARSED first, to refuse a malformed one rather than splice
 * into it.
 */

import { classifyNoGos, type NoGoClassification } from './noGoRules.js';
import { denyRulesFor, syntaxFor } from './hostPermissionsAdapter.js';

/**
 * Does this tree know how `host` spells a deny rule?
 *
 * A host absent from the adapter is not a host that forbids the idea — it is a
 * host for which nothing here has established a native deny list. The rows are
 * then REPORTED and no file is touched, which is the honesty
 * `host_lowering.yaml` keeps for an unestablished hook slot: absent means
 * nobody established anything, never "cannot".
 */
export function hasNativeDenyList(host: string): boolean {
    return syntaxFor(host) !== null;
}

/** A classified bullet together with what it spells on this host. */
export interface PlannedRow {
    readonly classification: NoGoClassification;
    readonly rules: readonly string[];
}

/** What a run would do, before anything is written. */
export interface DenyPlan {
    /** Every bullet, classified and rendered, in file order. */
    readonly rows: readonly PlannedRow[];
    /** The deny rules the enforceable bullets produced, de-duplicated. */
    readonly rules: readonly string[];
    /** Bullets that stay instruction-only. */
    readonly prose: readonly NoGoClassification[];
    /** False when the host has no established deny list — then `rules` is a report. */
    readonly enforceable: boolean;
}

export function planDenyRows(noGosSection: string, host: string): DenyPlan {
    // Render against the one host whose spelling is established when the target
    // host's is not, so an unsupported host still gets a REPORT of what its
    // no-gos would become rather than an empty screen reading "nothing to do".
    const renderHost = hasNativeDenyList(host) ? host : 'claude';
    const classified = classifyNoGos(noGosSection);
    const rows: PlannedRow[] = classified.map((c) => ({
        classification: c,
        rules: denyRulesFor(renderHost, c),
    }));
    const seen = new Set<string>();
    const rules: string[] = [];
    for (const r of rows) {
        for (const rule of r.rules) {
            if (seen.has(rule)) continue;
            seen.add(rule);
            rules.push(rule);
        }
    }
    return {
        rows,
        rules,
        prose: classified.filter((r) => r.kind === 'prose'),
        enforceable: hasNativeDenyList(host),
    };
}

/**
 * The text shown before the one consent question.
 *
 * Every row names the bullet it came from. Risk 1 in the register is a broad
 * row stopping an edit the consumer later needs "and the agent cannot say why";
 * carrying the source bullet beside the rule is what lets it say why.
 */
export function renderDenyPlan(plan: DenyPlan, host: string): string {
    const syntax = syntaxFor(plan.enforceable ? host : 'claude');
    const out: string[] = [];
    if (plan.rules.length === 0) {
        out.push('No no-go bullet named a path or a command, so there is nothing to enforce.');
    } else if (plan.enforceable) {
        out.push(
            `Deny rows for ${host} (${syntax?.deny_key ?? 'permissions.deny'}), one per enforceable no-go:`,
            '',
        );
        for (const r of plan.rows) {
            for (const rule of r.rules) out.push(`  ${rule}`);
            if (r.rules.length > 0) out.push(`      from: ${r.classification.bullet}`);
        }
    } else {
        out.push(
            `${host} has no native deny list established in this tree, so these rows are a`,
            'report and nothing is written. They are spelled the way `claude` spells a deny',
            `rule, NOT the way ${host} does — nothing here has established that ${host} reads`,
            'this syntax, or any syntax. They are what the no-gos would become there:',
            '',
        );
        for (const r of plan.rows) for (const rule of r.rules) out.push(`  ${rule}`);
    }
    if (plan.prose.length > 0) {
        out.push('', 'Instruction-only — no row was built, and the reason for each:');
        for (const p of plan.prose) out.push(`  ${p.bullet}`, `      ${p.reason}`);
    }
    if (plan.rules.length > 0 && plan.enforceable) {
        // What the rows do NOT cover, on the consent screen rather than in a
        // comment. The point of the change is to replace a sentence the agent
        // can read past with a rule the host refuses on; a consumer consenting
        // to that should be told where the refusal stops.
        out.push(
            '',
            'What these rows do not reach, per the same documentation:',
            '  · a Bash rule is prefix-matched, so `./artisan …`, `bash -c "…"` and a',
            '    wrapper such as `sail` or `devbox run` are not matched by it.',
            '  · Read and Edit rules reach the file tools and the file commands the host',
            '    recognises in Bash, but not a script that opens the file itself.',
            '  A no-go is still worth writing down when no row can be built for it.',
            '',
            'Where they reach FURTHER than the bullet reads:',
            '  · a path row anchors at the session working directory, not at the repository',
            '    root, and as a DENY rule a single-segment path matches that directory name',
            '    at any depth — `Edit(migrations/**)` also covers `vendor/pkg/migrations/`.',
            '  · the rows go into a file your whole team shares if it is committed. The',
            '    per-developer alternative is `.claude/settings.local.json`; pass it with',
            '    `--settings` if these should bind only you.',
        );
    }
    if (syntax !== null) {
        out.push('', `Syntax read from ${syntax.docs_url} on ${syntax.docs_at}.`);
    }
    return `${out.join('\n')}\n`;
}

/* ------------------------------------------------------------------ *
 * Locating a span inside a JSON body, without re-serialising it.
 * ------------------------------------------------------------------ */

interface Span {
    /** Index of the opening `[` or `{`. */
    readonly open: number;
    /** Index of the matching closing `]` or `}`. */
    readonly close: number;
}

/**
 * Walk `text` as JSON and return the span of the value at `path`.
 *
 * A hand-rolled walk rather than a regex because a regex over JSON cannot tell
 * a brace inside a string from a brace that nests, and a settings file holds
 * both. Returns `null` when the path is absent or the body is not an object.
 */
function locate(text: string, path: readonly string[]): Span | null {
    let i = 0;
    const stack: string[] = [];
    let pendingKey: string | null = null;
    let target: Span | null = null;
    const opens: number[] = [];

    const matches = (depthPath: readonly string[]): boolean =>
        depthPath.length === path.length && depthPath.every((s, n) => s === path[n]);

    while (i < text.length) {
        const ch = text[i] as string;
        if (ch === '"') {
            let j = i + 1;
            while (j < text.length) {
                if (text[j] === '\\') {
                    j += 2;
                    continue;
                }
                if (text[j] === '"') break;
                j += 1;
            }
            const literal = text.slice(i + 1, j);
            // A key is a string followed by a colon, inside an object.
            let k = j + 1;
            while (k < text.length && /\s/.test(text[k] as string)) k += 1;
            if (text[k] === ':') pendingKey = literal;
            i = j + 1;
            continue;
        }
        if (ch === '{' || ch === '[') {
            if (opens.length > 0 && pendingKey !== null) stack.push(pendingKey);
            else if (opens.length > 0) stack.push('');
            opens.push(i);
            pendingKey = null;
            if (matches(stack)) target = { open: i, close: -1 };
            i += 1;
            continue;
        }
        if (ch === '}' || ch === ']') {
            const open = opens.pop();
            if (target !== null && target.close === -1 && open === target.open) {
                target = { open: target.open, close: i };
            }
            if (opens.length > 0) stack.pop();
            // Clear it here too. A key is only pending for the container that
            // opens right after it; carrying it across a close made the SECOND
            // object in an array inherit the first one's last key, so
            // `{"permissions": [{"deny": 1}, {"a": 2}]}` matched on the wrong
            // element and spliced a bare string into an object.
            pendingKey = null;
            i += 1;
            continue;
        }
        if (ch === ',') {
            pendingKey = null;
            i += 1;
            continue;
        }
        i += 1;
    }
    return target !== null && target.close >= 0 ? target : null;
}

/** The indentation of the line `index` sits on. */
function indentAt(text: string, index: number): string {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const m = /^[ \t]*/.exec(text.slice(lineStart, index));
    return m === null ? '' : (m[0] as string);
}

export interface AppendResult {
    readonly text: string;
    /** Rules actually inserted — a rule already present is not re-added. */
    readonly added: readonly string[];
    /** Rules skipped because the file already carried them. */
    readonly alreadyPresent: readonly string[];
}

/**
 * Append `rules` to the settings body's deny list.
 *
 * Three shapes, in order, and all three splice rather than rewrite:
 *   1. `permissions.deny` exists — insert before its `]`.
 *   2. `permissions` exists without `deny` — insert the key after its `{`.
 *   3. neither — insert a whole `permissions` block after the root `{`.
 *
 * Throws on a body that is not a JSON object: refusing a malformed file is the
 * only safe answer, since a splice into one would produce a second malformed
 * file and lose the consumer's content.
 */
export function appendDenyRules(body: string, rules: readonly string[]): AppendResult {
    const parsed: unknown = JSON.parse(body);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('settings body is not a JSON object');
    }
    const perms = (parsed as Record<string, unknown>)['permissions'];
    // A `permissions` that is present but NOT an object has no span for
    // `locate` to find, so without this the root branch below would insert a
    // SECOND `"permissions"` key. The file stays parseable, the last key wins,
    // and every row the consumer consented to is silently discarded while the
    // command reports success — measured, and the defect this refusal exists
    // for. Refusing is the only honest answer: merging would have to guess what
    // the existing value meant.
    if (
        Object.hasOwn(parsed as Record<string, unknown>, 'permissions') &&
        (perms === null || typeof perms !== 'object' || Array.isArray(perms))
    ) {
        throw new Error(
            'settings body has a `permissions` key that is not an object — refusing rather ' +
                'than writing a second one',
        );
    }
    // The same refusal one level down, and it is NOT covered by the one above:
    // `locate` finds no span for a `deny` that is not an array either, so the
    // `permissions` branch would insert a SECOND `"deny"` key inside the same
    // object — measured, with the consented row discarded and success
    // reported. A `deny` that is a string or an object was worse still: the
    // filter below threw `perms.deny?.filter is not a function`, which reached
    // the consumer instead of the deliberate refusal written here.
    const denyRaw =
        perms !== null && typeof perms === 'object' && !Array.isArray(perms)
            ? (perms as Record<string, unknown>)['deny']
            : undefined;
    if (
        perms !== null &&
        typeof perms === 'object' &&
        !Array.isArray(perms) &&
        Object.hasOwn(perms as Record<string, unknown>, 'deny') &&
        !Array.isArray(denyRaw)
    ) {
        throw new Error(
            'settings body has a `permissions.deny` key that is not an array — refusing ' +
                'rather than writing a second one',
        );
    }
    const existing: string[] = Array.isArray(denyRaw)
        ? denyRaw.filter((e): e is string => typeof e === 'string')
        : [];

    const have = new Set(existing);
    const added = rules.filter((r) => !have.has(r));
    const alreadyPresent = rules.filter((r) => have.has(r));
    if (added.length === 0) return { text: body, added, alreadyPresent };

    const denySpan = locate(body, ['permissions', 'deny']);
    if (denySpan !== null) {
        const inner = body.slice(denySpan.open + 1, denySpan.close);
        const closeIndent = indentAt(body, denySpan.open);
        const indent = `${closeIndent}    `;
        const entries = added.map((r) => `${indent}${JSON.stringify(r)}`).join(',\n');
        if (inner.trim().length === 0) {
            return {
                text:
                    `${body.slice(0, denySpan.open + 1)}\n${entries}\n${closeIndent}` +
                    `${body.slice(denySpan.close)}`,
                added,
                alreadyPresent,
            };
        }
        // Insert AFTER the last element rather than before the `]`, so the
        // closing bracket keeps the line and the indentation it already had.
        // Splicing at the bracket leaves the comma stranded on its own line and
        // un-indents the `]` — a diff in a file the consumer owns, for nothing.
        const lastChar = inner.replace(/\s+$/, '').length;
        const at = denySpan.open + 1 + lastChar;
        return {
            text: `${body.slice(0, at)},\n${entries}${body.slice(at)}`,
            added,
            alreadyPresent,
        };
    }

    const permSpan = locate(body, ['permissions']);
    if (permSpan !== null) {
        const indent = `${indentAt(body, permSpan.open)}    `;
        const entries = added.map((r) => `${indent}    ${JSON.stringify(r)}`).join(',\n');
        const inner = body.slice(permSpan.open + 1, permSpan.close);
        const sep = inner.trim().length === 0 ? '' : ',';
        const block = `\n${indent}"deny": [\n${entries}\n${indent}]${sep}`;
        return {
            text: `${body.slice(0, permSpan.open + 1)}${block}${body.slice(permSpan.open + 1)}`,
            added,
            alreadyPresent,
        };
    }

    const rootSpan = locate(body, []);
    if (rootSpan === null) throw new Error('settings body has no root object');
    const indent = '    ';
    const entries = added.map((r) => `${indent}        ${JSON.stringify(r)}`).join(',\n');
    const inner = body.slice(rootSpan.open + 1, rootSpan.close);
    const sep = inner.trim().length === 0 ? '' : ',';
    const block = `\n${indent}"permissions": {\n${indent}    "deny": [\n${entries}\n${indent}    ]\n${indent}}${sep}`;
    return {
        text: `${body.slice(0, rootSpan.open + 1)}${block}${body.slice(rootSpan.open + 1)}`,
        added,
        alreadyPresent,
    };
}
