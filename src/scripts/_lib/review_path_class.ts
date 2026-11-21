/**
 * Path classes for review re-binds: whether a changed path is something a
 * reviewer reviews (`code`) or bookkeeping around it. Shared so the binding
 * drift probe and the review-loop census cannot disagree on what "non-code"
 * means.
 */
export type ReviewPathClass = 'roadmap' | 'docs' | 'agents-other' | 'code';

export function classifyReviewPath(p: string): ReviewPathClass {
    if (p.startsWith('agents/roadmaps/') || p === 'agents/roadmaps-progress.md') return 'roadmap';
    if (p.startsWith('docs/')) return 'docs';
    if (p.startsWith('agents/')) return 'agents-other';
    return 'code';
}
