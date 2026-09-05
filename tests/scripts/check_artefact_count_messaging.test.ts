/**
 * Artefact-count messaging gate
 * (road-to-truth-and-reference-hygiene Phase 1).
 *
 * Unit tests for the scan logic + the dedicated regression case: multiple
 * DIFFERENT numbers for one artefact kind (the README 150-vs-162-vs-166
 * command drift that motivated the gate). Also runs the live gate against
 * the real repo surfaces so a merge cannot land with drifted prose.
 */
import { describe, expect, it } from "vitest";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
    anchor_coverage_gaps,
    canonical_for,
    DATED_MEASUREMENT_MARKER,
    main,
    RULE_SURFACE_DIR,
    rule_surfaces,
    scan_structured,
    scan_text,
    STRUCTURED_SURFACES,
} from "../../src/scripts/check_artefact_count_messaging.js";

const EXPECTED = { skills: 264, commands: 166, rules: 95, guidelines: 87, personas: 29 };

describe("scan_text — count-shaped prose detection", () => {
    it("passes prose that matches the canonical counts", () => {
        const { findings } = scan_text(
            "fixture.md",
            "**264 skills, 166 commands, 95 governed rules** — one layer.",
            EXPECTED,
        );
        expect(findings).toEqual([]);
    });

    it("fails a single drifted number", () => {
        const { findings } = scan_text(
            "fixture.md",
            "ships 258 skills and 166 commands.",
            EXPECTED,
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ kind: "skills", found: 258, expected: 264 });
    });

    it("regression: multiple DIFFERENT numbers for one kind are all surfaced", () => {
        // The motivating failure mode: 150, 162 and 166 commands in one doc.
        const { findings, seen } = scan_text(
            "fixture.md",
            [
                "You don't memorize 150 commands.",
                "Depth: 162 commands with a router.",
                "Browse all 166 commands here.",
            ].join("\n"),
            EXPECTED,
        );
        expect(seen["commands"]).toEqual(new Set([150, 162, 166]));
        // 150 and 162 drift; 166 matches.
        expect(findings.map((f) => f.found).sort()).toEqual([150, 162]);
    });

    it("flags '~' approximations even when numerically correct", () => {
        const { findings } = scan_text("fixture.md", "a subset of the ~264 skills", EXPECTED);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ kind: "skills", approx: true });
    });

    it("does NOT match bare 'N rules' (subset scopes are legitimate)", () => {
        const { findings } = scan_text(
            "fixture.md",
            "the 9 kernel rules and 91 router rules stay out of scope; 88 rules total once.",
            EXPECTED,
        );
        expect(findings).toEqual([]);
    });

    it("matches 'governed rules' as the canonical total phrasing", () => {
        const { findings } = scan_text("fixture.md", "93 governed rules ship.", EXPECTED);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ kind: "rules", found: 93, expected: 95 });
    });
});

describe("canonical_for — source-of-truth resolution", () => {
    it("commands resolve to the ACTIVE count (badge parity)", () => {
        expect(canonical_for("commands")).toBeGreaterThan(0);
    });
    it("skills/rules resolve from the artefact tree", () => {
        expect(canonical_for("skills")).toBeGreaterThan(200);
        expect(canonical_for("rules")).toBeGreaterThan(50);
    });
});

describe("scan_structured — generated YAML surfaces (CAPABILITIES.yaml drift class)", () => {
    const FIELDS = STRUCTURED_SURFACES[0]!.fields;

    it("passes totals that match the canonical counts", () => {
        const { findings } = scan_structured(
            "CAPABILITIES.yaml",
            "meta:\n  skills_total: 264\n  commands_total: 166\n",
            FIELDS,
            EXPECTED,
        );
        expect(findings).toEqual([]);
    });

    it("fails a deliberate off-by-one (the 268-vs-271 regression)", () => {
        const { findings } = scan_structured(
            "CAPABILITIES.yaml",
            "meta:\n  skills_total: 263\n  commands_total: 166\n",
            FIELDS,
            EXPECTED,
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ kind: "skills", found: 263, expected: 264 });
    });

    it("feeds the cross-surface inconsistency net (prose vs YAML disagree)", () => {
        const prose = scan_text("README.md", "ships 264 skills.", EXPECTED);
        const yaml = scan_structured(
            "CAPABILITIES.yaml",
            "  skills_total: 263\n",
            FIELDS,
            EXPECTED,
        );
        const seen = new Set([...prose.seen["skills"]!, ...yaml.seen["skills"]!]);
        expect(seen.size).toBeGreaterThan(1); // two DIFFERENT numbers → gate fires
    });

    it("absent field is skipped (owned by the generator's own --check)", () => {
        const { findings } = scan_structured("CAPABILITIES.yaml", "meta: {}\n", FIELDS, EXPECTED);
        expect(findings).toEqual([]);
    });
});

describe("live gate — real repo surfaces", () => {
    it("all flagship surfaces (incl. structured) are in sync with source", () => {
        expect(main(["--quiet"])).toBe(0);
    });
});

describe("governed rules are inside the scanned set", () => {
    // The hole this gate had: SURFACES named sixteen doc paths and no rule path,
    // while rules are the most-delivered surface this package ships. Two stale
    // skill counts sat there for weeks and the gate that exists to catch exactly
    // that phrasing never looked at the directory they live in.
    it("the rule surface is enumerated, not hand-listed", () => {
        const rules = rule_surfaces();
        expect(rules.length).toBeGreaterThan(50);
        expect(rules).toContain(`${RULE_SURFACE_DIR}/token-budget-discipline.md`);
        expect(rules).toContain(`${RULE_SURFACE_DIR}/missing-skill-recovery.md`);
        for (const r of rules) {
            expect(r.endsWith(".md")).toBe(true);
        }
    });

    it("a stale count in a rule IS a finding", () => {
        // The denial direction. Without this the widening could be a no-op and
        // the suite would still be green.
        const { findings } = scan_text(
            `${RULE_SURFACE_DIR}/some-rule.md`,
            "the CI linter counts rich-tagged skills. With 271 skills the cap is ~40.",
            EXPECTED,
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ kind: "skills", found: 271 });
    });
});

describe("the dated-measurement marker", () => {
    const DATED = "on 2026-08-16 that install projected 297 skills";

    it("silences the line it sits on", () => {
        const { findings, seen } = scan_text(
            "fixture.md",
            `${DATED} ${DATED_MEASUREMENT_MARKER}`,
            EXPECTED,
        );
        expect(findings).toEqual([]);
        // Not merely unreported — not SEEN either, so a dated figure can never
        // feed the cross-surface inconsistency net with a denominator that was
        // never this package's.
        expect(seen["skills"]).toBeUndefined();
    });

    it("the identical line WITHOUT the marker is still a finding", () => {
        // Polarity. A marker that silenced nothing would pass the test above by
        // accident, and a marker applied file-wide would silence the live counts
        // in the same rule.
        const { findings } = scan_text("fixture.md", DATED, EXPECTED);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ kind: "skills", found: 297 });
    });

    it("it is per line, not per file", () => {
        const { findings } = scan_text(
            "fixture.md",
            `${DATED} ${DATED_MEASUREMENT_MARKER}\nand today the suite ships 271 skills.`,
            EXPECTED,
        );
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ line: 2, found: 271 });
    });
});

describe("anchor_coverage_gaps honours the dated-measurement marker", () => {
    // The value pass (`scan_text`) skipped a marked line from the day the
    // marker shipped; this pass did not, so a legitimately dated figure was
    // silenced on value and still demanded an anchor for coverage — and an
    // anchor is the one repair that must NOT be applied to it, because
    // `update_counts` would rewrite a recorded measurement to today's total.
    // Polarity is tested in both directions: a marker that silenced nothing
    // would pass the first case by accident.
    function withSurface(body: string): ReturnType<typeof anchor_coverage_gaps> {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "acm-anchor-"));
        try {
            fs.mkdirSync(path.join(root, "docs"), { recursive: true });
            fs.writeFileSync(path.join(root, "docs", "CLAIMS.md"), body);
            return anchor_coverage_gaps(root);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    }

    const DATED_LINE = "- claim: measured 2026-09-04, 0 of 299 skills were invoked.";

    it("reports an un-anchored count-shaped line with no marker", () => {
        const gaps = withSurface(`${DATED_LINE}\n`);
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toMatchObject({ file: "docs/CLAIMS.md", kind: "skills", line: 1 });
    });

    it("reports nothing once the same line carries the marker", () => {
        const gaps = withSurface(`${DATED_LINE} ${DATED_MEASUREMENT_MARKER}\n`);
        expect(gaps).toEqual([]);
    });

    it("is per line — a marked line does not silence its neighbour", () => {
        const gaps = withSurface(
            `${DATED_LINE} ${DATED_MEASUREMENT_MARKER}\nand the suite ships 299 skills today.\n`,
        );
        expect(gaps).toHaveLength(1);
        expect(gaps[0]).toMatchObject({ line: 2 });
    });
});
