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

import {
    canonical_for,
    main,
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
