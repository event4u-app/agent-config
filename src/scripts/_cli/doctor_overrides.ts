/**
 * The doctor's override-delivery check, extracted from `cmd_doctor.ts`.
 *
 * Extracted rather than inlined because `cmd_doctor.ts` sits at 3,852 lines against
 * the 1,500-line ceiling, so `check_source_size_budget` refuses ANY net growth in it
 * — the same ratchet that refused two earlier attempts at an unrelated feature. The
 * check landed inline first and the gate said so (128 new violations); this file is
 * the fix, and it is a pure move. A new file under the ceiling contributes zero
 * excess, so the total falls by exactly what left.
 *
 * Kept as its own module rather than folded into a grab-bag of checks: it is the only
 * consumer of `KERNEL_RULE_ID_SET` in the doctor, and that import came with it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { KERNEL_RULE_ID_SET } from '../_lib/kernel_rules.js';

type Dict = Record<string, unknown>;

function isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/**
 * Override DELIVERY and audit state — steps 3.1 and 3.2 of
 * `road-to-override-efficacy-proof`.
 *
 * The report already knew `agents/overrides/` existed, as an install-mode marker
 * (`_is_global_only_consumer`). It never said what was IN it, so a consumer who
 * placed an override had no surface anywhere that confirmed the file was seen.
 *
 * THE VOCABULARY IS THE CONTRACT, and step 3.2 makes it a checkable one. This line
 * says `present`, `registered`, `cited` — never `enforced`, `applied`, `honoured`
 * or `honored`. Those four words would make it read as a claim that the agent
 * changed its behaviour, which is Phase 2's number and is deferred on population
 * validity. A delivery check quoted as an efficacy claim is the exact defect this
 * roadmap exists to close, so the words it must not use are asserted against by
 * `agent-config doctor 2>&1 | grep -iE 'override.*(enforced|applied|honoured|honored)'`
 * returning nothing.
 *
 * `warn` rather than `error` on an uncited or unregistered override: the strict
 * gate (`lint_override_kernel_guard --strict`) is what refuses those in CI. Two
 * surfaces failing the same fact would make `doctor` a second gate with no
 * authority, and the doctor's job is to tell a consumer what state they are in.
 */
export function _check_overrides(project_root: string): Dict {
    const dir = path.join(project_root, 'agents', 'overrides', 'rules');
    if (!isDir(dir)) {
        return {
            id: 'overrides',
            status: 'skip',
            message: 'no agents/overrides/rules/ — no overrides declared',
            remedy: '',
        };
    }
    let names: string[];
    try {
        names = fs
            .readdirSync(dir)
            .filter((n) => n.endsWith('.md'))
            .sort();
    } catch {
        return {
            id: 'overrides',
            status: 'warn',
            message: 'agents/overrides/rules/ is present but unreadable',
            remedy: 'check permissions on agents/overrides/rules/',
        };
    }
    if (names.length === 0) {
        return {
            id: 'overrides',
            status: 'ok',
            message: 'agents/overrides/rules/ present, 0 overrides declared',
            remedy: '',
        };
    }
    const registryPath = path.join(project_root, 'agents', 'overrides', 'kernel-exceptions.yml');
    // Parse the `exceptions:` block the same way the audit does, rather than
    // grepping for the rule name anywhere in the file. The first version did grep,
    // and it read `verify-before-complete` as UNREGISTERED even though the registry
    // lists it — the name appears inside a `justification:` block and the entry key
    // is `rule:`, so a bare name match neither confirms nor denies registration. A
    // doctor line that contradicts the strict gate is worse than no line.
    const registered = new Set<string>();
    if (isFile(registryPath)) {
        let inExceptions = false;
        for (const raw of fs.readFileSync(registryPath, 'utf-8').split('\n')) {
            const line = raw.replace(/\s+$/, '');
            if (/^exceptions:\s*$/.test(line)) {
                inExceptions = true;
                continue;
            }
            if (!inExceptions) continue;
            if (/^\S/.test(line)) break;
            const m = /^\s*-?\s*rule:\s*"?([a-z0-9-]+)"?\s*$/i.exec(line);
            if (m?.[1] !== undefined) registered.add(m[1]);
        }
    }
    let kernel = 0;
    let uncited = 0;
    let unregisteredKernel = 0;
    for (const n of names) {
        const rule = n.replace(/\.md$/, '');
        const isKernel = KERNEL_RULE_ID_SET.has(rule);
        if (isKernel) kernel += 1;
        const text = fs.readFileSync(path.join(dir, n), 'utf-8');
        // Same shape the audit's `has_citation` looks for. Duplicated rather than
        // imported because cmd_doctor must not pull a lint module into the CLI's
        // startup path; the strict gate owns the authoritative check and this is a
        // report.
        if (!/^>\s*Overrides:/m.test(text)) uncited += 1;
        if (isKernel && !registered.has(rule)) {
            unregisteredKernel += 1;
        }
    }
    const parts = [
        `${String(names.length)} override(s) present`,
        `${String(kernel)} kernel`,
    ];
    // Registration is stated POSITIVELY, not only on failure. Step 3.1's verify
    // names four words the line must carry — one override, kernel, registered,
    // cited — and a count that appears only when it is wrong leaves a reader
    // unable to tell "all registered" from "registration not checked".
    if (kernel > 0) {
        parts.push(`${String(kernel - unregisteredKernel)}/${String(kernel)} kernel registered`);
    }
    parts.push(`${String(names.length - uncited)}/${String(names.length)} cited`);
    // Deliberately last and deliberately blunt: without it the counts read as a
    // verdict on whether the overrides work.
    parts.push('delivery only — efficacy unmeasured');
    return {
        id: 'overrides',
        status: uncited > 0 || unregisteredKernel > 0 ? 'warn' : 'ok',
        message: parts.join(', '),
        remedy:
            uncited > 0 || unregisteredKernel > 0
                ? 'run `./scripts-run src/scripts/lint_override_kernel_guard --strict` for the detail'
                : '',
    };
}
