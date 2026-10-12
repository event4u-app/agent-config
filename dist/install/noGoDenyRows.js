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
import { classifyNoGos } from './noGoRules.js';
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
export function hasNativeDenyList(host) {
    return syntaxFor(host) !== null;
}
export function planDenyRows(noGosSection, host) {
    // Render against the one host whose spelling is established when the target
    // host's is not, so an unsupported host still gets a REPORT of what its
    // no-gos would become rather than an empty screen reading "nothing to do".
    const renderHost = hasNativeDenyList(host) ? host : 'claude';
    const classified = classifyNoGos(noGosSection);
    const rows = classified.map((c) => ({
        classification: c,
        rules: denyRulesFor(renderHost, c),
    }));
    const seen = new Set();
    const rules = [];
    for (const r of rows) {
        for (const rule of r.rules) {
            if (seen.has(rule))
                continue;
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
export function renderDenyPlan(plan, host) {
    const syntax = syntaxFor(plan.enforceable ? host : 'claude');
    const out = [];
    if (plan.rules.length === 0) {
        out.push('No no-go bullet named a path or a command, so there is nothing to enforce.');
    }
    else if (plan.enforceable) {
        out.push(`Deny rows for ${host} (${syntax?.deny_key ?? 'permissions.deny'}), one per enforceable no-go:`, '');
        for (const r of plan.rows) {
            for (const rule of r.rules)
                out.push(`  ${rule}`);
            if (r.rules.length > 0)
                out.push(`      from: ${r.classification.bullet}`);
        }
    }
    else {
        out.push(`${host} has no native deny list established in this tree, so these rows are a`, 'report and nothing is written. They are what the no-gos WOULD become:', '');
        for (const r of plan.rows)
            for (const rule of r.rules)
                out.push(`  ${rule}`);
    }
    if (plan.prose.length > 0) {
        out.push('', 'Instruction-only — no row was built, and the reason for each:');
        for (const p of plan.prose)
            out.push(`  ${p.bullet}`, `      ${p.reason}`);
    }
    if (syntax !== null) {
        out.push('', `Syntax read from ${syntax.docs_url} on ${syntax.docs_at}.`);
    }
    return `${out.join('\n')}\n`;
}
/**
 * Walk `text` as JSON and return the span of the value at `path`.
 *
 * A hand-rolled walk rather than a regex because a regex over JSON cannot tell
 * a brace inside a string from a brace that nests, and a settings file holds
 * both. Returns `null` when the path is absent or the body is not an object.
 */
function locate(text, path) {
    let i = 0;
    const stack = [];
    let pendingKey = null;
    let target = null;
    const opens = [];
    const matches = (depthPath) => depthPath.length === path.length && depthPath.every((s, n) => s === path[n]);
    while (i < text.length) {
        const ch = text[i];
        if (ch === '"') {
            let j = i + 1;
            while (j < text.length) {
                if (text[j] === '\\') {
                    j += 2;
                    continue;
                }
                if (text[j] === '"')
                    break;
                j += 1;
            }
            const literal = text.slice(i + 1, j);
            // A key is a string followed by a colon, inside an object.
            let k = j + 1;
            while (k < text.length && /\s/.test(text[k]))
                k += 1;
            if (text[k] === ':')
                pendingKey = literal;
            i = j + 1;
            continue;
        }
        if (ch === '{' || ch === '[') {
            if (opens.length > 0 && pendingKey !== null)
                stack.push(pendingKey);
            else if (opens.length > 0)
                stack.push('');
            opens.push(i);
            pendingKey = null;
            if (matches(stack))
                target = { open: i, close: -1 };
            i += 1;
            continue;
        }
        if (ch === '}' || ch === ']') {
            const open = opens.pop();
            if (target !== null && target.close === -1 && open === target.open) {
                target = { open: target.open, close: i };
            }
            if (opens.length > 0)
                stack.pop();
            i += 1;
            continue;
        }
        i += 1;
    }
    return target !== null && target.close >= 0 ? target : null;
}
/** The indentation of the line `index` sits on. */
function indentAt(text, index) {
    const lineStart = text.lastIndexOf('\n', index - 1) + 1;
    const m = /^[ \t]*/.exec(text.slice(lineStart, index));
    return m === null ? '' : m[0];
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
export function appendDenyRules(body, rules) {
    const parsed = JSON.parse(body);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('settings body is not a JSON object');
    }
    const perms = parsed['permissions'];
    const existing = perms !== null && typeof perms === 'object' && !Array.isArray(perms)
        ? perms['deny']?.filter((e) => typeof e === 'string') ?? []
        : [];
    const have = new Set(existing);
    const added = rules.filter((r) => !have.has(r));
    const alreadyPresent = rules.filter((r) => have.has(r));
    if (added.length === 0)
        return { text: body, added, alreadyPresent };
    const denySpan = locate(body, ['permissions', 'deny']);
    if (denySpan !== null) {
        const inner = body.slice(denySpan.open + 1, denySpan.close);
        const closeIndent = indentAt(body, denySpan.open);
        const indent = `${closeIndent}    `;
        const entries = added.map((r) => `${indent}${JSON.stringify(r)}`).join(',\n');
        if (inner.trim().length === 0) {
            return {
                text: `${body.slice(0, denySpan.open + 1)}\n${entries}\n${closeIndent}` +
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
    if (rootSpan === null)
        throw new Error('settings body has no root object');
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
//# sourceMappingURL=noGoDenyRows.js.map