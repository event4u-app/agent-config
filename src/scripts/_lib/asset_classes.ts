// Lives under src/scripts so the shipped linter can import it; the render
// command re-exports it from here rather than owning a second copy.
export const ASSET_CLASSES = ['icon', 'mark', 'illustration', 'diagram', 'animated'] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];
