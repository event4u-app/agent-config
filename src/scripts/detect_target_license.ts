#!/usr/bin/env node
/**
 * detect_target_license — deterministic SPDX license detection + derived
 * borrow-compatibility policy (road-to-provenance-and-license-governance
 * S1.2). CLI wrapper — the actual detection/matrix/invalidation/override
 * logic lives in `./_lib/detect_target_license.ts` (that module does the
 * filesystem I/O too; detection is inherently a file-read job). This file
 * owns only argv parsing, stdout/stderr shaping, schema validation, and the
 * `--write` side effect.
 *
 * Usage:
 *   npx tsx src/scripts/detect_target_license.ts [repo-path] [--write] [--json]
 *   npx tsx src/scripts/detect_target_license.ts --help
 *
 * Default (no --write): report only, nothing written to disk.
 * --write   create/update license-policy.yaml in the target repo, unless
 *           escalation is required or the existing file is derived_from: manual.
 *
 * Exit codes: 0 success (including the warn-only "nothing detectable"
 * path); 1 usage/IO/schema error; 2 escalation required — a human decision,
 * never an auto-pick (source disagreement, or a divergent workspace license).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import {
    buildLicensePolicyDocument,
    checkInvalidation,
    detectTargetLicense,
    mergeOverride,
    type LicensePolicyDoc,
} from './_lib/detect_target_license.js';
import { load_schema, validate, type YamlValue } from './validate_frontmatter.js';

export const POLICY_FILENAME = 'license-policy.yaml';

const USAGE = `usage: detect_target_license [repo-path] [--write] [--json] [-h|--help]

Deterministic SPDX license detection + derived borrow-compatibility policy.

  repo-path   target repo root (default: .)
  --write     write/update ${POLICY_FILENAME} in the target repo (skipped on
              escalation, or when the existing file is derived_from: manual)
  --json      machine-readable report on stdout

Exit codes: 0 success, 1 usage/IO/schema error, 2 escalation required.
`;

export interface CliArgs {
    repoPath: string;
    write: boolean;
    json: boolean;
    help: boolean;
}

export function parseArgs(argv: string[]): CliArgs {
    let repoPath = '.';
    let write = false;
    let json = false;
    let help = false;
    for (const a of argv) {
        if (a === '-h' || a === '--help') help = true;
        else if (a === '--write') write = true;
        else if (a === '--json') json = true;
        else if (!a.startsWith('--')) repoPath = a;
    }
    return { repoPath, write, json, help };
}

export function serializeLicensePolicy(doc: LicensePolicyDoc): string {
    return stringifyYaml(doc, { indent: 2 });
}

export function parseLicensePolicyFile(text: string): LicensePolicyDoc {
    return parseYaml(text) as LicensePolicyDoc; // caller schema-validates before trusting this
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);
    if (args.help) {
        process.stdout.write(USAGE);
        return 0;
    }

    const repoRoot = path.resolve(args.repoPath);
    if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
        process.stderr.write(`detect_target_license: error: not a directory: ${repoRoot}\n`);
        return 1;
    }

    const detection = detectTargetLicense(repoRoot);

    if (detection.escalate) {
        if (args.json) {
            process.stdout.write(JSON.stringify({
                escalate: true,
                reason: detection.escalateReason,
                spdx_id: detection.spdxId,
                warnings: detection.warnings,
            }) + '\n');
        } else {
            process.stdout.write(`detect_target_license: ESCALATE — ${detection.escalateReason ?? 'unspecified'}\n`);
            for (const w of detection.warnings) process.stdout.write(`  warning: ${w}\n`);
            process.stdout.write(`No ${POLICY_FILENAME} written. This needs a human decision, never an auto-pick.\n`);
        }
        return 2;
    }

    const nowIso = new Date().toISOString();
    const freshDoc = buildLicensePolicyDocument(detection, nowIso);
    const policyPath = path.join(repoRoot, POLICY_FILENAME);

    let finalDoc: LicensePolicyDoc = freshDoc;
    let rejectedOverrides: string[] = [];
    let action: 'derived' | 'kept-manual' | 're-derived' | 'merged' | 'unchanged' = 'derived';

    if (fs.existsSync(policyPath)) {
        let existing: LicensePolicyDoc | null = null;
        try {
            existing = parseLicensePolicyFile(fs.readFileSync(policyPath, 'utf8'));
        } catch (err) {
            process.stderr.write(
                `detect_target_license: warning: failed to parse existing ${POLICY_FILENAME}, ` +
                `treating as absent: ${err instanceof Error ? err.message : String(err)}\n`,
            );
        }

        if (existing) {
            const invalidation = checkInvalidation(existing, detection);
            if (invalidation.action === 'escalate') {
                if (args.json) {
                    process.stdout.write(JSON.stringify({ escalate: true, reason: invalidation.reason }) + '\n');
                } else {
                    process.stdout.write(`detect_target_license: ESCALATE — ${invalidation.reason}\n`);
                    process.stdout.write(`${POLICY_FILENAME} left unchanged. This needs a human decision, never an auto-pick.\n`);
                }
                return 2;
            }
            if (existing.derived_from === 'manual') {
                finalDoc = existing;
                action = 'kept-manual';
            } else if (invalidation.action === 're-derive') {
                finalDoc = freshDoc;
                action = 're-derived';
            } else {
                const merge = mergeOverride(existing, freshDoc);
                finalDoc = merge.doc;
                rejectedOverrides = merge.rejectedOverrides;
                action = rejectedOverrides.length > 0 || JSON.stringify(merge.doc.policy) !== JSON.stringify(existing.policy)
                    ? 'merged'
                    : 'unchanged';
            }
        }
    }

    if (action !== 'kept-manual') {
        const schema = load_schema('license-policy');
        const errors = validate(finalDoc as unknown as YamlValue, schema);
        if (errors.length > 0) {
            process.stderr.write('detect_target_license: refused — derived policy fails schema validation:\n');
            for (const e of errors) process.stderr.write(`  - ${e.format()}\n`);
            return 1;
        }
    }

    const willWrite = args.write && action !== 'kept-manual';
    if (willWrite) {
        fs.writeFileSync(policyPath, serializeLicensePolicy(finalDoc), 'utf8');
    }

    if (args.json) {
        process.stdout.write(JSON.stringify({
            escalate: false,
            action,
            wrote: willWrite,
            policy_path: policyPath,
            doc: finalDoc,
            rejected_overrides: rejectedOverrides,
        }) + '\n');
    } else {
        process.stdout.write(
            `detect_target_license: detected ${detection.spdxId ?? '(none)'} -> ` +
            `target_class=${detection.targetClass} workspace_scope=${detection.workspaceScope}\n`,
        );
        for (const w of detection.warnings) process.stdout.write(`  warning: ${w}\n`);
        for (const r of rejectedOverrides) process.stdout.write(`  rejected override: ${r}\n`);
        process.stdout.write(
            willWrite
                ? `wrote ${policyPath} (${action})\n`
                : `(dry run — pass --write to update ${policyPath}; action would be: ${action})\n`,
        );
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    const invokedUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === invokedUrl) process.exit(main());
}
