# Staged assets — image/brand/typography + greenfield roadmaps

> **Transient.** Tracked-but-deletable staging for
> [`road-to-image-brand-typography.md`](../roadmaps/road-to-image-brand-typography.md)
> and [`road-to-greenfield-scaffold.md`](../roadmaps/road-to-greenfield-scaffold.md).
> Holds material the source feedback already produced that would otherwise be
> lost (the feedback file lives under the gitignored `agents/tmp/`). **Consume
> during the cited phase, then delete this file** — it is not durable
> documentation, just a hand-off so no work is lost before the roadmaps run.
>
> Lives in `agents/roadmap-assets/` (sibling of `agents/roadmaps/`) on purpose:
> the dashboard generator and `lint-roadmap-complexity` scan
> `agents/roadmaps/**`, so a sidecar there would be miscounted as a roadmap.

## 1. `eval:record` TS recorder — drop-in for Phase D (`road-to-image-brand-typography.md`)

> **Apply the council decision when porting:** the recorder below carries a
> single global floor (`--min-recall 1.0 / --min-precision 0.8`). Phase D's
> council verdict is **domain-specific floors** (image 1.0/0.85, iconography
> 1.0/0.9, brand-strategy 0.9/0.7). Replace the flat default with a per-skill
> floor lookup keyed on the skill/manifest before this ships. Target paths:
> `src/cli/commands/recordTriggerEval.ts` + co-located
> `recordTriggerEval.test.ts`; register `eval:record` in
> `src/cli/registry.ts` and wire commander in `src/cli/agent-config.ts`.

### `src/cli/commands/recordTriggerEval.ts`

```ts
/**
 * `agent-config eval:record` — native TS implementation.
 *
 * Records a live trigger-eval result into a corpus manifest's `upstream`
 * block (the second half of the corpus-refresh DoD, ADR-061 §6). It does
 * NOT run the eval — `skill_trigger_eval.py`'s confirmation gate hard-aborts
 * under automation by design, so the live run stays a human, interactive
 * step. This command is a *post-processor*: it reads the `EvalResult` JSON the
 * live run wrote (`--output`), enforces a precision/recall floor, and writes
 * the measured numbers back into the manifest so the result becomes
 * provenance — tied to the exact upstream SHA it was measured against.
 *
 * Integrity guards:
 * - Refuses to record a result whose `router` is not the real Anthropic
 *   client (a `--dry-run` / MockRouter result can never masquerade as
 *   provenance), unless `--allow-mock` is passed for plumbing checks.
 * - Stamps `sha_at_eval` from the manifest's current `upstream.sha`, so a
 *   recorded number is forever attached to the pin it was run against. A
 *   later SHA bump visibly invalidates it (`sha_at_eval` != `upstream.sha`).
 *
 * Exit codes mirror the legacy Python recorder:
 *   2 — integrity / IO error (nothing written)
 *   1 — floor not met (recorded for the audit trail, but a failing gate)
 *   0 — pass
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { sep } from 'node:path';
import { z } from 'zod';
import { logger } from '../log/logger.js';

export interface RecordTriggerEvalOptions {
    /** Path to the EvalResult JSON written by skill_trigger_eval.py --output. */
    evalJson: string;
    /** Path to the corpus manifest.json to patch. */
    manifest: string;
    /** Floor: no should-trigger query may be missed (default 1.0). */
    minRecall?: number;
    /** Floor: tolerated false-positive rate (default 0.8). */
    minPrecision?: number;
    /** Permit recording a non-live (MockRouter) result — plumbing only. */
    allowMock?: boolean;
    /** Validate and print the record, but do not write the manifest. */
    dryRun?: boolean;
}

/** Subset of `skill_trigger_eval.py`'s `EvalResult` we depend on. */
const EvalResultSchema = z.object({
    skill: z.string().optional(),
    model: z.string().optional(),
    router: z.string(),
    metrics: z.object({
        precision: z.number(),
        recall: z.number(),
        true_positive: z.number().optional(),
        false_positive: z.number().optional(),
        false_negative: z.number().optional(),
        true_negative: z.number().optional(),
    }),
});

const ManifestSchema = z
    .object({
        upstream: z.object({ sha: z.string() }).passthrough(),
    })
    .passthrough();

interface LastEval {
    date: string;
    model: string;
    router: string;
    sha_at_eval: string;
    precision: number;
    recall: number;
    true_positive: number | null;
    false_positive: number | null;
    false_negative: number | null;
    true_negative: number | null;
    floor: { min_precision: number; min_recall: number };
    passed: boolean;
}

class RecordError extends Error {}

function readJson(path: string): unknown {
    let raw: string;
    try {
        raw = readFileSync(path, 'utf8');
    } catch {
        throw new RecordError(`file not found: ${path}`);
    }
    try {
        return JSON.parse(raw);
    } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        throw new RecordError(`invalid JSON in ${path}: ${detail}`);
    }
}

/**
 * Best-effort skill-name inference from the manifest's location. Layout is
 * `.../skills/<skill>/data/manifest.json`. Used only to catch an accidental
 * mismatch between the eval JSON and the manifest being patched.
 */
function expectedSkillFromManifest(manifestPath: string): string | null {
    const parts = manifestPath.split(sep);
    const i = parts.indexOf('skills');
    if (i >= 0 && i + 1 < parts.length) return parts[i + 1] ?? null;
    return null;
}

export function runRecordTriggerEval(opts: RecordTriggerEvalOptions): number {
    const minRecall = opts.minRecall ?? 1.0;
    const minPrecision = opts.minPrecision ?? 0.8;
    const allowMock = opts.allowMock ?? false;
    const dryRun = opts.dryRun ?? false;

    let record: LastEval;
    let manifest: Record<string, unknown>;
    let evalSkill: string | undefined;
    let expectedSkill: string | null;

    try {
        const parsedEval = EvalResultSchema.safeParse(readJson(opts.evalJson));
        if (!parsedEval.success) {
            throw new RecordError(`eval JSON is not a valid EvalResult: ${parsedEval.error.message}`);
        }
        const parsedManifest = ManifestSchema.safeParse(readJson(opts.manifest));
        if (!parsedManifest.success) {
            throw new RecordError(`${opts.manifest} has no \`upstream.sha\` to attach the eval to`);
        }

        const ev = parsedEval.data;
        manifest = parsedManifest.data as Record<string, unknown>;
        const upstream = (manifest as { upstream: { sha: string } }).upstream;

        const router = ev.router.toLowerCase();
        if (router !== 'anthropic' && !allowMock) {
            throw new RecordError(
                `refusing to record a non-live result (router='${router}'). ` +
                    'A dry-run / MockRouter number is not provenance. ' +
                    'Run the live eval, or pass --allow-mock for a plumbing check.',
            );
        }

        expectedSkill = expectedSkillFromManifest(opts.manifest);
        evalSkill = ev.skill;
        if (expectedSkill && evalSkill && evalSkill !== expectedSkill) {
            throw new RecordError(
                `skill mismatch: eval JSON is for '${evalSkill}' but the manifest path implies '${expectedSkill}'`,
            );
        }

        const { precision, recall } = ev.metrics;
        const passed = precision >= minPrecision && recall >= minRecall;

        record = {
            date: new Date().toISOString().slice(0, 10),
            model: ev.model ?? 'unknown',
            router,
            sha_at_eval: upstream.sha,
            precision: Math.round(precision * 1000) / 1000,
            recall: Math.round(recall * 1000) / 1000,
            true_positive: ev.metrics.true_positive ?? null,
            false_positive: ev.metrics.false_positive ?? null,
            false_negative: ev.metrics.false_negative ?? null,
            true_negative: ev.metrics.true_negative ?? null,
            floor: { min_precision: minPrecision, min_recall: minRecall },
            passed,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`❌  ${message}`);
        return 2;
    }

    (manifest as { upstream: Record<string, unknown> }).upstream.last_eval = record;

    const summary =
        `skill=${evalSkill ?? expectedSkill ?? '?'}  ` +
        `precision=${record.precision}  recall=${record.recall}  ` +
        `sha=${record.sha_at_eval.slice(0, 8)}  passed=${record.passed}`;

    if (dryRun) {
        logger.info('(dry-run, manifest not written)');
        logger.info(JSON.stringify(record, null, 2));
        logger.info(summary);
        return record.passed ? 0 : 1;
    }

    writeFileSync(opts.manifest, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    logger.info(`✓  recorded into ${opts.manifest}`);
    logger.info(summary);
    if (!record.passed) {
        logger.warn(
            '⚠  floor NOT met — recorded for the audit trail, but treat this ' +
                "as a failing gate (the description's triggers regressed).",
        );
    }
    return record.passed ? 0 : 1;
}
```

### `src/cli/commands/recordTriggerEval.test.ts`

```ts
/**
 * Tests for `agent-config eval:record` (recordTriggerEval).
 *
 * No network, no real eval run — fixtures only. Asserts the integrity guards
 * and exit-code contract: live result records & passes, mock is rejected,
 * floor miss is recorded but fails.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRecordTriggerEval } from './recordTriggerEval.js';

let dir: string;
let manifestPath: string;
let evalPath: string;

const MANIFEST = {
    upstream: {
        repo: 'https://github.com/nextlevelbuilder/ui-ux-pro-max-skill',
        sha: 'b7e3af80f6e331f6fb456667b82b12cade7c9d35',
        last_checked: '2026-06-07',
    },
};

function writeEval(over: Partial<{ router: string; precision: number; recall: number; skill: string }>): void {
    writeFileSync(
        evalPath,
        JSON.stringify({
            skill: over.skill ?? 'design-intelligence',
            model: 'claude-sonnet-4-5',
            router: over.router ?? 'anthropic',
            metrics: {
                true_positive: 5,
                false_positive: over.precision === undefined ? 1 : 0,
                false_negative: over.recall === undefined ? 0 : 1,
                true_negative: 4,
                precision: over.precision ?? 0.833,
                recall: over.recall ?? 1.0,
            },
        }),
        'utf8',
    );
}

beforeEach(() => {
    // Mirror the real layout `.../skills/<skill>/data/manifest.json` so the
    // skill-mismatch guard has something to infer from.
    dir = mkdtempSync(join(tmpdir(), 'eval-rec-'));
    const dataDir = join(dir, 'skills', 'design-intelligence', 'data');
    mkdirSync(dataDir, { recursive: true });
    manifestPath = join(dataDir, 'manifest.json');
    evalPath = join(dir, 'eval.json');
    writeFileSync(manifestPath, `${JSON.stringify(MANIFEST, null, 2)}\n`, 'utf8');
});

afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
});

describe('runRecordTriggerEval', () => {
    it('records a passing live result and returns 0', () => {
        writeEval({});
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(0);
        const out = JSON.parse(readFileSync(manifestPath, 'utf8')) as { upstream: { last_eval?: { passed: boolean; sha_at_eval: string } } };
        expect(out.upstream.last_eval?.passed).toBe(true);
        expect(out.upstream.last_eval?.sha_at_eval).toBe(MANIFEST.upstream.sha);
    });

    it('rejects a MockRouter result with exit 2 and writes nothing', () => {
        writeEval({ router: 'mock' });
        const before = readFileSync(manifestPath, 'utf8');
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(2);
        expect(readFileSync(manifestPath, 'utf8')).toBe(before);
    });

    it('allows a mock result under --allow-mock', () => {
        writeEval({ router: 'mock' });
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath, allowMock: true });
        expect(code).toBe(0);
    });

    it('records but fails (exit 1) when recall is below the floor', () => {
        writeEval({ recall: 0.8 });
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(1);
        const out = JSON.parse(readFileSync(manifestPath, 'utf8')) as { upstream: { last_eval?: { passed: boolean } } };
        expect(out.upstream.last_eval?.passed).toBe(false);
    });

    it('errors (exit 2) on a skill/manifest mismatch', () => {
        writeEval({ skill: 'some-other-skill' });
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath });
        expect(code).toBe(2);
    });

    it('does not write the manifest in dry-run', () => {
        writeEval({});
        const before = readFileSync(manifestPath, 'utf8');
        const code = runRecordTriggerEval({ evalJson: evalPath, manifest: manifestPath, dryRun: true });
        expect(code).toBe(0);
        expect(readFileSync(manifestPath, 'utf8')).toBe(before);
    });
});
```

## 2. Resource / link appendix — Tracks A/B/C leads

> Leads, **not** dependencies. Each third-party source goes through the same
> adoption gates `design-intelligence` cleared (license + ATTRIBUTION,
> four-operation classification, SHA-pin + refresh DoD, schema-conformant
> frontmatter, trigger-evals). Migrate the relevant links into each track's
> ATTRIBUTION / manifest as that track is built, then drop this section.

## Appendix — resources (with links)

### Image generation (Track A)

- Google AI image docs & pricing (Imagen 4, Nano Banana family) — `https://ai.google.dev/gemini-api/docs/image-generation`, pricing `https://ai.google.dev/gemini-api/docs/pricing`
- OpenAI Images API (GPT Image 2 / 1.5 / Mini) — `https://platform.openai.com/docs/guides/images`, pricing `https://openai.com/api/pricing/`
- Ideogram 3.0 (text-in-image, logos/banners) — `https://about.ideogram.ai/`
- Black Forest Labs Flux 2 — `https://blackforestlabs.ai/`
- fal (`https://fal.ai/`) and Replicate (`https://replicate.com/`) gateways — already wired as adapters
- `logo-generator-skill` — SVG logo generator (code-based, fits Claude-as-orchestrator) — `https://github.com/topics/claude-code-skill` (832⭐ entry; verify repo + license before adoption)
- Note: Claude has no native image gen (Anthropic image-gen stance); Claude Design's image gen is "powered in part by Canva."

### Brand (Track B)

- DTCG specification (stable 2025.10) — `https://www.designtokens.org/`, spec repo `https://github.com/design-tokens/community-group`, format draft `https://www.designtokens.org/tr/drafts/format/`
- Style Dictionary (v4 DTCG support; v5 in progress) — `https://styledictionary.com/`, DTCG notes `https://styledictionary.com/info/dtcg/`
- Tokens Studio (Figma; DTCG vs legacy format) — `https://docs.tokens.studio/manage-settings/token-format`
- Terrazzo (DTCG toolchain) — `https://terrazzo.app/`
- `nextlevelbuilder/ui-ux-pro-max-skill` — its `brand` + `design-system` sub-skills (Apache-2.0/MIT) — `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill` (already SHA-pinned in our ATTRIBUTION)
- `@clawfu/mcp-skills` — 169 marketing/brand skills with brand memory (Ogilvy/Dunford/Cialdini) — via `https://github.com/BehiSecc/awesome-claude-skills`
- `wondelai/skills` — 25 UX/marketing/strategy skills (Norman, Cialdini, Ries) — via the same awesome list
- `Owl-Listener/designer-skills` — Designer Skills Collection — via `https://github.com/rohitg00/awesome-claude-design`
- Brand-tokens workflow primer (2026 pattern) — `https://www.oneminutebranding.com/blog/design-tokens-2026`

### Typography & iconography (Track C)

- Google Fonts (CSS API; ~915 families) — `https://fonts.google.com/`, developer API `https://developers.google.com/fonts/docs/developer_api`
- Iconify (universal icon framework; CSS / web-component / SVG) — `https://iconify.design/`, docs `https://iconify.design/docs/`
- Font Awesome (web-font + CSS framework) — `https://fontawesome.com/`
- Lucide (MIT, ~1500) — `https://lucide.dev/` · Heroicons — `https://heroicons.com/` · Phosphor — `https://phosphoricons.com/` · Tabler — `https://tabler.io/icons` · Remix Icon — `https://remixicon.com/`
- lobe-icons (AI/LLM provider brand marks) — `https://github.com/lobehub/lobe-icons`

### Discovery / ecosystem (all tracks)

- `https://github.com/BehiSecc/awesome-claude-skills` · `https://github.com/rohitg00/awesome-claude-code-toolkit` · `https://github.com/jqueryscript/awesome-claude-code` · `https://github.com/rohitg00/awesome-claude-design`
- superdesign (open-source design agent) — `https://github.com/superdesigndev/superdesign`
- diagram-design (editorial diagrams, HTML+SVG) — via `awesome-claude-code`

> **Adoption discipline reminder:** none of the third-party repos above are
> adopted wholesale. Each goes through the same gates `design-intelligence`
> passed — license + ATTRIBUTION, four-operation classification, SHA-pin +
> refresh DoD, schema-conformant frontmatter, and trigger-evals. The awesome
> lists are leads, not dependencies.
