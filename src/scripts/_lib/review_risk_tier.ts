/** Path risk tiers for the self-review diff partition — see `self_review_gate.ts` `partitionDiff`. */
const RISK_TIERS: readonly (readonly string[])[] = [
    ['src/scripts/', 'src/rules/', '.github/workflows/', 'src/cli/', 'src/install/'],
    ['src/', 'docs/contracts/'],
    ['tests/', 'docs/'],
];

/** 1 = highest risk; a path matching no tier prefix is tier 4. */
export function riskTier(path: string): number {
    const i = RISK_TIERS.findIndex((prefixes) => prefixes.some((p) => path.startsWith(p)));
    return i < 0 ? RISK_TIERS.length + 1 : i + 1;
}
